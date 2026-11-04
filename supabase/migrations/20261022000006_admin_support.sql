-- =============================================================================
-- Fluxdesk — Migração 0006: apoio à administração
--  * endurecimento de privilégios padrão para objetos futuros
--  * estatísticas por usuário e por categoria (somente administradores)
--  * consistência de categorias (nunca desativar a última ativa)
--  * configurações do sistema (regras de atendimento aplicadas pelo banco)
-- =============================================================================

-- Objetos criados daqui em diante não herdam acesso amplo para anon/authenticated:
-- cada tabela e função precisa de GRANT/REVOKE explícito.
alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;
alter default privileges in schema public revoke execute on functions from public, anon;

-- ---------------------------------------------------------------------------
-- Estatísticas (security invoker + checagem de administrador)
-- ---------------------------------------------------------------------------
create or replace function public.user_ticket_stats()
returns table (user_id uuid, requested bigint, assigned bigint, assigned_open bigint)
language sql stable security invoker set search_path = ''
as $$
  select
    p.id,
    (select count(*) from public.tickets t where t.requester_id = p.id),
    (select count(*) from public.tickets t where t.assignee_id = p.id),
    (select count(*) from public.tickets t
       where t.assignee_id = p.id
         and t.status in ('open', 'in_progress', 'waiting_requester', 'waiting_third_party'))
  from public.profiles p
  where public.is_admin()
$$;

create or replace function public.category_ticket_counts()
returns table (category_id uuid, total bigint, in_progress bigint)
language sql stable security invoker set search_path = ''
as $$
  select
    c.id,
    (select count(*) from public.tickets t where t.category_id = c.id),
    (select count(*) from public.tickets t
       where t.category_id = c.id
         and t.status in ('open', 'in_progress', 'waiting_requester', 'waiting_third_party'))
  from public.categories c
  where public.is_admin()
$$;

revoke execute on function public.user_ticket_stats() from public, anon;
revoke execute on function public.category_ticket_counts() from public, anon;
grant execute on function public.user_ticket_stats() to authenticated;
grant execute on function public.category_ticket_counts() to authenticated;

-- ---------------------------------------------------------------------------
-- Categorias: sempre deve existir ao menos uma ativa (senão ninguém abre chamados)
-- ---------------------------------------------------------------------------
create or replace function public.guard_last_active_category()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if old.is_active and not new.is_active then
    if not exists (select 1 from public.categories c where c.is_active and c.id <> old.id) then
      raise exception 'É necessário manter ao menos uma categoria ativa.' using errcode = '23514';
    end if;
  end if;
  return new;
end
$$;

create trigger categories_guard_last_active
  before update on public.categories
  for each row execute function public.guard_last_active_category();

-- ---------------------------------------------------------------------------
-- Configurações do sistema (linha única)
-- ---------------------------------------------------------------------------
create table public.app_settings (
  id                       boolean primary key default true check (id),
  allow_requester_priority boolean not null default true,
  -- Prazo (em dias) para o solicitante reabrir um chamado resolvido; NULL = sem limite.
  requester_reopen_days    integer check (requester_reopen_days is null or requester_reopen_days between 1 and 365),
  updated_at               timestamptz not null default now(),
  updated_by               uuid references public.profiles (id) on delete set null
);

insert into public.app_settings (id) values (true);

revoke all on public.app_settings from anon, authenticated;
alter table public.app_settings enable row level security;

grant select on public.app_settings to authenticated;
grant update (allow_requester_priority, requester_reopen_days) on public.app_settings to authenticated;

create policy app_settings_select on public.app_settings
  for select to authenticated using (public.is_active_user());

create policy app_settings_update on public.app_settings
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

create or replace function public.guard_settings_update()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  new.id := old.id;
  new.updated_at := now();
  new.updated_by := auth.uid();
  perform public.log_audit('settings_changed', 'settings', null,
    jsonb_build_object(
      'allow_requester_priority', jsonb_build_array(old.allow_requester_priority, new.allow_requester_priority),
      'requester_reopen_days', jsonb_build_array(old.requester_reopen_days, new.requester_reopen_days)));
  return new;
end
$$;

create trigger app_settings_guard_update
  before update on public.app_settings
  for each row execute function public.guard_settings_update();

-- Regra 1: sem permissão para escolher prioridade, chamados de solicitantes nascem "Média".
create or replace function public.apply_priority_setting()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if auth.uid() is not null and public.current_user_role() = 'requester' then
    if not (select s.allow_requester_priority from public.app_settings s) then
      new.priority := 'medium';
    end if;
  end if;
  return new;
end
$$;

create trigger tickets_apply_priority_setting
  before insert on public.tickets
  for each row execute function public.apply_priority_setting();

-- Regra 2: prazo para o solicitante reabrir chamados resolvidos.
create or replace function public.guard_reopen_window()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_days integer;
begin
  if auth.uid() is null or new.status is not distinct from old.status then
    return new;
  end if;
  if old.status = 'resolved' and new.status = 'open' and public.current_user_role() = 'requester' then
    select s.requester_reopen_days into v_days from public.app_settings s;
    if v_days is not null and old.resolved_at is not null
       and now() > old.resolved_at + make_interval(days => v_days) then
      raise exception 'O prazo de % dia(s) para reabrir este chamado terminou.', v_days using errcode = '42501';
    end if;
  end if;
  return new;
end
$$;

create trigger tickets_guard_reopen_window
  before update on public.tickets
  for each row execute function public.guard_reopen_window();

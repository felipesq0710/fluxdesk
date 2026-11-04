-- =============================================================================
-- Fluxdesk — Migração 0002: funções auxiliares e triggers de negócio
-- As regras críticas (transições de status, escalada de privilégios, histórico
-- e notificações) vivem no banco: o cliente nunca é confiável.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Helpers de identidade (security definer evita recursão de RLS em profiles)
-- ---------------------------------------------------------------------------
create or replace function public.current_user_role()
returns public.user_role
language sql stable security definer set search_path = ''
as $$
  select p.role from public.profiles p where p.id = auth.uid() and p.is_active
$$;

create or replace function public.is_active_user()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_active)
$$;

create or replace function public.is_admin()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select coalesce(public.current_user_role() = 'admin', false)
$$;

create or replace function public.is_staff()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select coalesce(public.current_user_role() in ('technician', 'admin'), false)
$$;

-- O usuário atual pode ver este chamado?
create or replace function public.can_view_ticket(p_ticket uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select public.is_active_user() and exists (
    select 1 from public.tickets t
    where t.id = p_ticket
      and (
        public.is_admin()
        or (public.current_user_role() = 'technician' and (t.assignee_id = auth.uid() or t.assignee_id is null))
        or t.requester_id = auth.uid()
      )
  )
$$;

-- O usuário atual pode comentar / anexar neste chamado?
create or replace function public.can_comment_on_ticket(p_ticket uuid, p_kind public.comment_kind)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select public.is_active_user() and exists (
    select 1 from public.tickets t
    where t.id = p_ticket
      and t.status <> 'closed'
      and (
        public.is_admin()
        or (public.current_user_role() = 'technician' and t.assignee_id = auth.uid())
        or (p_kind = 'public' and t.requester_id = auth.uid())
      )
  )
$$;

-- ---------------------------------------------------------------------------
-- Criação automática de perfil após cadastro
-- Sempre 'requester': o papel NUNCA vem de metadados enviados pelo cliente.
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''), split_part(new.email, '@', 1))
  );
  return new;
end
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Rótulos legíveis (usados em notificações e histórico)
-- ---------------------------------------------------------------------------
create or replace function public.status_label(p_status public.ticket_status)
returns text
language sql immutable set search_path = ''
as $$
  select case p_status
    when 'open' then 'Aberto'
    when 'in_progress' then 'Em atendimento'
    when 'waiting_requester' then 'Aguardando solicitante'
    when 'waiting_third_party' then 'Aguardando terceiros'
    when 'resolved' then 'Resolvido'
    when 'closed' then 'Encerrado'
  end
$$;

-- ---------------------------------------------------------------------------
-- Notificação e auditoria (somente via trigger; sem INSERT direto para clientes)
-- ---------------------------------------------------------------------------
create or replace function public.push_notification(
  p_recipient uuid,
  p_ticket uuid,
  p_type public.notification_type,
  p_title text,
  p_body text
)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if p_recipient is null then
    return;
  end if;
  insert into public.notifications (recipient_id, ticket_id, type, title, body)
  values (p_recipient, p_ticket, p_type, p_title, p_body);
end
$$;

create or replace function public.log_audit(p_action text, p_entity text, p_entity_id uuid, p_details jsonb)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.audit_log (actor_id, action, entity, entity_id, details)
  values (auth.uid(), p_action, p_entity, p_entity_id, coalesce(p_details, '{}'::jsonb));
end
$$;

-- Funções internas não devem ser chamadas diretamente pela API.
revoke execute on function public.push_notification(uuid, uuid, public.notification_type, text, text) from public, anon, authenticated;
revoke execute on function public.log_audit(text, text, uuid, jsonb) from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Proteção de perfis: sem escalada de privilégio
-- ---------------------------------------------------------------------------
create or replace function public.guard_profile_update()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  new.updated_at := now();

  -- Manutenção via SQL Editor / service role (sem JWT de usuário).
  if auth.uid() is null then
    return new;
  end if;

  if new.id <> old.id or new.email is distinct from old.email or new.created_at <> old.created_at then
    raise exception 'Campos imutáveis do perfil não podem ser alterados.' using errcode = '42501';
  end if;

  if new.role is distinct from old.role or new.is_active is distinct from old.is_active then
    if not public.is_admin() then
      raise exception 'Apenas administradores podem alterar perfil de acesso ou estado da conta.' using errcode = '42501';
    end if;
    if old.id = auth.uid() then
      raise exception 'Você não pode alterar o próprio perfil de acesso nem desativar a própria conta.' using errcode = '42501';
    end if;
  end if;

  if old.role = 'admin' and old.is_active and (new.role <> 'admin' or not new.is_active) then
    if not exists (
      select 1 from public.profiles p where p.role = 'admin' and p.is_active and p.id <> old.id
    ) then
      raise exception 'É necessário manter ao menos um administrador ativo.' using errcode = '23514';
    end if;
  end if;

  return new;
end
$$;

create trigger profiles_guard_update
  before update on public.profiles
  for each row execute function public.guard_profile_update();

create or replace function public.audit_profile_changes()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.role is distinct from old.role then
    perform public.log_audit('profile_role_changed', 'profile', new.id,
      jsonb_build_object('user', new.full_name, 'from', old.role, 'to', new.role));
  end if;
  if new.is_active is distinct from old.is_active then
    perform public.log_audit(case when new.is_active then 'profile_activated' else 'profile_deactivated' end,
      'profile', new.id, jsonb_build_object('user', new.full_name));
  end if;
  return new;
end
$$;

create trigger profiles_audit_changes
  after update on public.profiles
  for each row execute function public.audit_profile_changes();

-- ---------------------------------------------------------------------------
-- Categorias: updated_at + auditoria + consistência
-- ---------------------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end
$$;

create trigger categories_touch before update on public.categories
  for each row execute function public.touch_updated_at();

create or replace function public.audit_category_changes()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    perform public.log_audit('category_created', 'category', new.id, jsonb_build_object('name', new.name));
  elsif new.is_active is distinct from old.is_active then
    perform public.log_audit(case when new.is_active then 'category_activated' else 'category_deactivated' end,
      'category', new.id, jsonb_build_object('name', new.name));
  elsif new.name is distinct from old.name then
    perform public.log_audit('category_renamed', 'category', new.id,
      jsonb_build_object('from', old.name, 'to', new.name));
  end if;
  return new;
end
$$;

create trigger categories_audit after insert or update on public.categories
  for each row execute function public.audit_category_changes();

-- ---------------------------------------------------------------------------
-- Chamados: criação (valida categoria ativa)
-- ---------------------------------------------------------------------------
create or replace function public.guard_ticket_insert()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if not exists (select 1 from public.categories c where c.id = new.category_id and c.is_active) then
    raise exception 'Categoria inválida ou inativa.' using errcode = '23514';
  end if;
  new.status := 'open';
  new.assignee_id := null;
  new.resolved_at := null;
  new.closed_at := null;
  new.created_at := now();
  new.updated_at := now();
  return new;
end
$$;

create trigger tickets_guard_insert
  before insert on public.tickets
  for each row execute function public.guard_ticket_insert();

-- ---------------------------------------------------------------------------
-- Chamados: regras de atualização (fonte de verdade das permissões por coluna)
-- ---------------------------------------------------------------------------
create or replace function public.guard_ticket_update()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_role public.user_role;
  v_transition_ok boolean;
  v_content_changed boolean;
begin
  new.updated_at := now();

  -- Campos imutáveis para qualquer origem.
  if new.id <> old.id or new.number <> old.number or new.requester_id <> old.requester_id
     or new.created_at <> old.created_at then
    raise exception 'Campos imutáveis do chamado não podem ser alterados.' using errcode = '42501';
  end if;

  -- Transições de status válidas (valem também para manutenção via SQL).
  if new.status is distinct from old.status then
    v_transition_ok := case old.status
      when 'open' then new.status in ('in_progress', 'waiting_requester', 'waiting_third_party', 'resolved', 'closed')
      when 'in_progress' then new.status in ('open', 'waiting_requester', 'waiting_third_party', 'resolved', 'closed')
      when 'waiting_requester' then new.status in ('in_progress', 'waiting_third_party', 'resolved', 'closed')
      when 'waiting_third_party' then new.status in ('in_progress', 'waiting_requester', 'resolved', 'closed')
      when 'resolved' then new.status in ('open', 'in_progress', 'closed')
      when 'closed' then new.status in ('open')
    end;
    if not coalesce(v_transition_ok, false) then
      raise exception 'Transição de status inválida: % → %.',
        public.status_label(old.status), public.status_label(new.status) using errcode = '23514';
    end if;
  end if;

  if v_uid is not null then
    v_role := public.current_user_role();
    if v_role is null then
      raise exception 'Conta inativa ou sem perfil de acesso.' using errcode = '42501';
    end if;

    v_content_changed := new.title is distinct from old.title or new.description is distinct from old.description;

    if v_role = 'admin' then
      if new.assignee_id is not null and new.assignee_id is distinct from old.assignee_id then
        if not exists (
          select 1 from public.profiles p
          where p.id = new.assignee_id and p.is_active and p.role in ('technician', 'admin')
        ) then
          raise exception 'O responsável deve ser um técnico ou administrador ativo.' using errcode = '23514';
        end if;
      end if;
    elsif v_role = 'technician' then
      if old.assignee_id is not null and old.assignee_id <> v_uid then
        raise exception 'Este chamado está atribuído a outro técnico.' using errcode = '42501';
      end if;
      if v_content_changed then
        raise exception 'Técnicos não podem editar título ou descrição do chamado.' using errcode = '42501';
      end if;
      if new.assignee_id is distinct from old.assignee_id then
        if not ((old.assignee_id is null and new.assignee_id = v_uid)
                or (old.assignee_id = v_uid and new.assignee_id is null)) then
          raise exception 'Técnicos só podem assumir ou liberar o próprio chamado.' using errcode = '42501';
        end if;
      end if;
    else
      -- Solicitante: apenas o dono do chamado, com poderes mínimos.
      if old.requester_id <> v_uid then
        raise exception 'Sem permissão para alterar este chamado.' using errcode = '42501';
      end if;
      if new.priority is distinct from old.priority or new.assignee_id is distinct from old.assignee_id then
        raise exception 'Solicitantes não podem alterar prioridade ou responsável.' using errcode = '42501';
      end if;
      if (v_content_changed or new.category_id is distinct from old.category_id)
         and (old.status <> 'open' or old.assignee_id is not null) then
        raise exception 'O chamado só pode ser editado enquanto estiver aberto e sem responsável.' using errcode = '42501';
      end if;
      if new.status is distinct from old.status and not (
        (old.status = 'waiting_requester' and new.status = 'in_progress')
        or (old.status = 'resolved' and new.status in ('closed', 'open'))
      ) then
        raise exception 'Solicitantes só podem responder solicitações, confirmar ou reabrir chamados resolvidos.' using errcode = '42501';
      end if;
    end if;

    if old.status = 'closed' and new.status is distinct from old.status and v_role <> 'admin' then
      raise exception 'Apenas administradores podem reabrir chamados encerrados.' using errcode = '42501';
    end if;

    if new.category_id is distinct from old.category_id then
      if not exists (select 1 from public.categories c where c.id = new.category_id and c.is_active) then
        raise exception 'Categoria inválida ou inativa.' using errcode = '23514';
      end if;
    end if;
  end if;

  -- Atendimento exige responsável: técnicos assumem automaticamente.
  if new.status in ('in_progress', 'waiting_requester', 'waiting_third_party', 'resolved')
     and new.assignee_id is null then
    if v_uid is not null and public.current_user_role() = 'technician' then
      new.assignee_id := v_uid;
    else
      raise exception 'Atribua um responsável antes de iniciar o atendimento.' using errcode = '23514';
    end if;
  end if;

  -- Datas derivadas do status.
  if new.status is distinct from old.status then
    if new.status = 'resolved' then
      new.resolved_at := now();
      new.closed_at := null;
    elsif new.status = 'closed' then
      new.closed_at := now();
    elsif old.status in ('resolved', 'closed') then
      new.resolved_at := null;
      new.closed_at := null;
    end if;
  end if;

  return new;
end
$$;

create trigger tickets_guard_update
  before update on public.tickets
  for each row execute function public.guard_ticket_update();

-- ---------------------------------------------------------------------------
-- Chamados: histórico e notificações após criação
-- ---------------------------------------------------------------------------
create or replace function public.after_ticket_insert()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_staff record;
begin
  insert into public.ticket_history (ticket_id, actor_id, event_type, new_value)
  values (new.id, new.requester_id, 'created', public.status_label(new.status));

  perform public.push_notification(new.requester_id, new.id, 'ticket_created',
    'Chamado ' || new.code || ' aberto', 'Recebemos sua solicitação: ' || new.title);

  for v_staff in
    select p.id from public.profiles p
    where p.is_active and p.role in ('technician', 'admin') and p.id <> new.requester_id
  loop
    perform public.push_notification(v_staff.id, new.id, 'ticket_created',
      'Novo chamado ' || new.code, new.title);
  end loop;

  return new;
end
$$;

create trigger tickets_after_insert
  after insert on public.tickets
  for each row execute function public.after_ticket_insert();

-- ---------------------------------------------------------------------------
-- Chamados: histórico e notificações após atualização
-- ---------------------------------------------------------------------------
create or replace function public.after_ticket_update()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_event text;
  v_old_name text;
  v_new_name text;
  v_admin record;
begin
  if new.status is distinct from old.status then
    v_event := case
      when new.status = 'resolved' then 'resolved'
      when new.status = 'closed' then 'closed'
      when new.status = 'open' and old.status in ('resolved', 'closed') then 'reopened'
      else 'status_changed'
    end;
    insert into public.ticket_history (ticket_id, actor_id, event_type, old_value, new_value)
    values (new.id, v_actor, v_event, public.status_label(old.status), public.status_label(new.status));

    if v_actor is distinct from new.requester_id then
      perform public.push_notification(
        new.requester_id, new.id,
        case new.status
          when 'waiting_requester' then 'info_requested'::public.notification_type
          when 'resolved' then 'ticket_resolved'::public.notification_type
          when 'closed' then 'ticket_closed'::public.notification_type
          else 'status_changed'::public.notification_type
        end,
        case new.status
          when 'waiting_requester' then 'Precisamos de mais informações — ' || new.code
          when 'resolved' then 'Chamado ' || new.code || ' resolvido'
          when 'closed' then 'Chamado ' || new.code || ' encerrado'
          else 'Chamado ' || new.code || ' atualizado'
        end,
        'Status: ' || public.status_label(new.status)
      );
    else
      -- Ação do solicitante (responder, confirmar, reabrir): avisa a equipe.
      if new.assignee_id is not null then
        perform public.push_notification(new.assignee_id, new.id, 'status_changed',
          'Chamado ' || new.code || ' atualizado pelo solicitante', 'Status: ' || public.status_label(new.status));
      else
        for v_admin in select p.id from public.profiles p where p.is_active and p.role = 'admin' loop
          perform public.push_notification(v_admin.id, new.id, 'status_changed',
            'Chamado ' || new.code || ' atualizado pelo solicitante', 'Status: ' || public.status_label(new.status));
        end loop;
      end if;
    end if;
  end if;

  if new.priority is distinct from old.priority then
    insert into public.ticket_history (ticket_id, actor_id, event_type, old_value, new_value)
    values (new.id, v_actor, 'priority_changed', old.priority::text, new.priority::text);
  end if;

  if new.category_id is distinct from old.category_id then
    select c.name into v_old_name from public.categories c where c.id = old.category_id;
    select c.name into v_new_name from public.categories c where c.id = new.category_id;
    insert into public.ticket_history (ticket_id, actor_id, event_type, old_value, new_value)
    values (new.id, v_actor, 'category_changed', v_old_name, v_new_name);
  end if;

  if new.title is distinct from old.title or new.description is distinct from old.description then
    insert into public.ticket_history (ticket_id, actor_id, event_type)
    values (new.id, v_actor, 'edited');
  end if;

  if new.assignee_id is distinct from old.assignee_id then
    select p.full_name into v_old_name from public.profiles p where p.id = old.assignee_id;
    select p.full_name into v_new_name from public.profiles p where p.id = new.assignee_id;
    insert into public.ticket_history (ticket_id, actor_id, event_type, old_value, new_value)
    values (new.id, v_actor, 'assignee_changed', v_old_name, v_new_name);

    if new.assignee_id is not null and new.assignee_id is distinct from v_actor then
      perform public.push_notification(new.assignee_id, new.id, 'ticket_assigned',
        'Chamado ' || new.code || ' atribuído a você', new.title);
    end if;
    if new.assignee_id is not null and new.requester_id is distinct from v_actor
       and new.status is not distinct from old.status then
      perform public.push_notification(new.requester_id, new.id, 'ticket_assigned',
        'Um responsável foi designado — ' || new.code, 'Seu chamado está com ' || v_new_name || '.');
    end if;
  end if;

  return new;
end
$$;

create trigger tickets_after_update
  after update on public.tickets
  for each row execute function public.after_ticket_update();

-- ---------------------------------------------------------------------------
-- Comentários: notificações (nunca expõem o conteúdo) e retomada do atendimento
-- ---------------------------------------------------------------------------
create or replace function public.guard_comment_insert()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  new.created_at := now();
  return new;
end
$$;

create trigger ticket_comments_guard_insert
  before insert on public.ticket_comments
  for each row execute function public.guard_comment_insert();

create or replace function public.after_comment_insert()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_ticket public.tickets;
  v_admin record;
begin
  select * into v_ticket from public.tickets t where t.id = new.ticket_id;

  -- Notas internas NUNCA geram notificação para o solicitante.
  if new.kind = 'public' then
    if new.author_id = v_ticket.requester_id then
      if v_ticket.assignee_id is not null then
        perform public.push_notification(v_ticket.assignee_id, v_ticket.id, 'comment_added',
          'Nova mensagem em ' || v_ticket.code, 'O solicitante respondeu ao chamado.');
      else
        for v_admin in select p.id from public.profiles p where p.is_active and p.role = 'admin' loop
          perform public.push_notification(v_admin.id, v_ticket.id, 'comment_added',
            'Nova mensagem em ' || v_ticket.code, 'O solicitante respondeu ao chamado.');
        end loop;
      end if;

      -- Resposta do solicitante retoma o atendimento.
      if v_ticket.status = 'waiting_requester' then
        update public.tickets set status = 'in_progress' where id = v_ticket.id;
      else
        update public.tickets set updated_at = now() where id = v_ticket.id;
      end if;
    else
      perform public.push_notification(v_ticket.requester_id, v_ticket.id, 'comment_added',
        'Nova mensagem em ' || v_ticket.code, 'A equipe de suporte respondeu ao seu chamado.');
      update public.tickets set updated_at = now() where id = v_ticket.id;
    end if;
  else
    update public.tickets set updated_at = now() where id = v_ticket.id;
  end if;

  return new;
end
$$;

create trigger ticket_comments_after_insert
  after insert on public.ticket_comments
  for each row execute function public.after_comment_insert();

-- ---------------------------------------------------------------------------
-- Base de conhecimento: datas e publicação
-- ---------------------------------------------------------------------------
create or replace function public.guard_article_write()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  new.updated_at := now();
  if tg_op = 'INSERT' then
    new.created_at := now();
  end if;
  if new.status = 'published' and (tg_op = 'INSERT' or old.status <> 'published') then
    new.published_at := now();
  elsif new.status = 'draft' then
    new.published_at := null;
  end if;
  return new;
end
$$;

create trigger knowledge_articles_guard before insert or update on public.knowledge_articles
  for each row execute function public.guard_article_write();

-- ---------------------------------------------------------------------------
-- Permissões de execução das funções auxiliares
-- ---------------------------------------------------------------------------
revoke execute on function public.current_user_role() from public, anon;
revoke execute on function public.is_active_user() from public, anon;
revoke execute on function public.is_admin() from public, anon;
revoke execute on function public.is_staff() from public, anon;
revoke execute on function public.can_view_ticket(uuid) from public, anon;
revoke execute on function public.can_comment_on_ticket(uuid, public.comment_kind) from public, anon;
grant execute on function public.current_user_role() to authenticated;
grant execute on function public.is_active_user() to authenticated;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.is_staff() to authenticated;
grant execute on function public.can_view_ticket(uuid) to authenticated;
grant execute on function public.can_comment_on_ticket(uuid, public.comment_kind) to authenticated;

-- =============================================================================
-- Fluxdesk — Migração 0005: agregações de dashboard e relatórios
-- SECURITY INVOKER: as consultas passam pelas políticas RLS do usuário que chama,
-- então cada perfil enxerga somente os números que pode ver.
-- Intervalo: p_from inclusivo, p_to exclusivo. Dias calculados em p_tz.
-- "Resolvidos" na linha do tempo contam pela data de resolução (resolved_at).
-- =============================================================================

create or replace function public.ticket_report(
  p_from     timestamptz default null,
  p_to       timestamptz default null,
  p_category uuid default null,
  p_priority public.ticket_priority default null,
  p_status   public.ticket_status default null,
  p_assignee uuid default null,
  p_tz       text default 'America/Sao_Paulo'
)
returns jsonb
language sql stable security invoker set search_path = ''
as $$
  with f as (
    select t.*
    from public.tickets t
    where (p_from is null or t.created_at >= p_from)
      and (p_to is null or t.created_at < p_to)
      and (p_category is null or t.category_id = p_category)
      and (p_priority is null or t.priority = p_priority)
      and (p_status is null or t.status = p_status)
      and (p_assignee is null or t.assignee_id = p_assignee)
  ),
  r as (
    select t.*
    from public.tickets t
    where t.resolved_at is not null
      and (p_from is null or t.resolved_at >= p_from)
      and (p_to is null or t.resolved_at < p_to)
      and (p_category is null or t.category_id = p_category)
      and (p_priority is null or t.priority = p_priority)
      and (p_assignee is null or t.assignee_id = p_assignee)
  ),
  created_by_day as (
    select (f.created_at at time zone p_tz)::date as d, count(*) as c from f group by 1
  ),
  resolved_by_day as (
    select (r.resolved_at at time zone p_tz)::date as d, count(*) as c from r group by 1
  )
  select jsonb_build_object(
    'totals', (
      select jsonb_build_object(
        'total', count(*),
        'open', count(*) filter (where status = 'open'),
        'in_progress', count(*) filter (where status = 'in_progress'),
        'waiting', count(*) filter (where status in ('waiting_requester', 'waiting_third_party')),
        'resolved', count(*) filter (where status in ('resolved', 'closed')),
        'critical', count(*) filter (where priority = 'critical' and status not in ('resolved', 'closed')),
        'resolved_with_date', count(*) filter (where resolved_at is not null),
        'avg_resolution_hours', round(
          (avg(extract(epoch from (resolved_at - created_at)) / 3600.0)
            filter (where resolved_at is not null))::numeric, 1)
      ) from f
    ),
    'by_status', (
      select coalesce(jsonb_agg(jsonb_build_object('key', s.status, 'count', s.c) order by s.status), '[]'::jsonb)
      from (select status, count(*) as c from f group by status) s
    ),
    'by_priority', (
      select coalesce(jsonb_agg(jsonb_build_object('key', s.priority, 'count', s.c) order by s.priority), '[]'::jsonb)
      from (select priority, count(*) as c from f group by priority) s
    ),
    'by_category', (
      select coalesce(jsonb_agg(jsonb_build_object('key', s.name, 'count', s.c) order by s.c desc, s.name), '[]'::jsonb)
      from (
        select coalesce(c.name, 'Sem categoria') as name, count(*) as c
        from f left join public.categories c on c.id = f.category_id
        group by 1
      ) s
    ),
    'by_assignee', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'key', s.name, 'count', s.c, 'resolved', s.resolved, 'avg_resolution_hours', s.avg_h
      ) order by s.c desc, s.name), '[]'::jsonb)
      from (
        select coalesce(p.full_name, 'Não atribuído') as name,
               count(*) as c,
               count(*) filter (where f.resolved_at is not null) as resolved,
               round((avg(extract(epoch from (f.resolved_at - f.created_at)) / 3600.0)
                 filter (where f.resolved_at is not null))::numeric, 1) as avg_h
        from f left join public.profiles p on p.id = f.assignee_id
        group by 1
      ) s
    ),
    'timeline', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'day', x.d, 'created', x.created, 'resolved', x.resolved
      ) order by x.d), '[]'::jsonb)
      from (
        select coalesce(a.d, b.d) as d, coalesce(a.c, 0) as created, coalesce(b.c, 0) as resolved
        from created_by_day a full join resolved_by_day b on a.d = b.d
      ) x
    )
  )
$$;

revoke execute on function public.ticket_report(timestamptz, timestamptz, uuid, public.ticket_priority, public.ticket_status, uuid, text) from public, anon;
grant execute on function public.ticket_report(timestamptz, timestamptz, uuid, public.ticket_priority, public.ticket_status, uuid, text) to authenticated;

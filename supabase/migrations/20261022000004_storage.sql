-- =============================================================================
-- Fluxdesk — Migração 0004: Storage de anexos (bucket privado)
-- Caminho do objeto: {ticket_id}/{arquivo}. O acesso deriva das regras do chamado.
-- =============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'ticket-attachments',
  'ticket-attachments',
  false,
  10485760,
  array[
    'image/png', 'image/jpeg', 'image/webp', 'image/gif',
    'application/pdf', 'text/plain', 'text/csv',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ]
)
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Extrai o id do chamado da primeira pasta do caminho (null se inválido).
create or replace function public.storage_ticket_id(p_name text)
returns uuid
language plpgsql immutable set search_path = ''
as $$
begin
  return (string_to_array(p_name, '/'))[1]::uuid;
exception when others then
  return null;
end
$$;

revoke execute on function public.storage_ticket_id(text) from public, anon;
grant execute on function public.storage_ticket_id(text) to authenticated;

create policy "fluxdesk_attachments_select" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'ticket-attachments'
    and public.can_view_ticket(public.storage_ticket_id(name))
  );

create policy "fluxdesk_attachments_insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'ticket-attachments'
    and public.can_comment_on_ticket(public.storage_ticket_id(name), 'public')
  );

-- Remoção: administrador ou quem registrou o anexo.
create policy "fluxdesk_attachments_delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'ticket-attachments'
    and (
      public.is_admin()
      or exists (
        select 1 from public.ticket_attachments a
        where a.storage_path = storage.objects.name and a.uploader_id = auth.uid()
      )
    )
  );

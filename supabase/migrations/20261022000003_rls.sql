-- =============================================================================
-- Fluxdesk — Migração 0003: privilégios mínimos e Row Level Security
-- Princípio: nega por padrão. Cada tabela tem RLS ativa e concessões por coluna.
-- Regras finas por coluna/papel ficam nos triggers da migração 0002.
-- =============================================================================

-- Remove concessões amplas padrão do Supabase e reconcede apenas o necessário.
revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
revoke all on all functions in schema public from anon;

grant usage on sequence public.ticket_number_seq to authenticated;

alter table public.profiles            enable row level security;
alter table public.categories          enable row level security;
alter table public.tickets             enable row level security;
alter table public.ticket_comments     enable row level security;
alter table public.ticket_attachments  enable row level security;
alter table public.ticket_history      enable row level security;
alter table public.notifications       enable row level security;
alter table public.knowledge_articles  enable row level security;
alter table public.audit_log           enable row level security;

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
grant select on public.profiles to authenticated;
grant update (full_name, role, is_active) on public.profiles to authenticated;

-- O próprio usuário sempre lê seu perfil (a UI precisa saber se a conta foi desativada).
-- Outros perfis: equipe vê todos; solicitantes veem apenas quem participa dos seus chamados.
create policy profiles_select on public.profiles
  for select to authenticated
  using (
    id = auth.uid()
    or (
      public.is_active_user()
      and (
        public.is_staff()
        or exists (select 1 from public.tickets t where t.assignee_id = profiles.id or t.requester_id = profiles.id)
        or exists (select 1 from public.ticket_comments c where c.author_id = profiles.id)
      )
    )
  );

-- Usuário comum só altera o próprio nome (colunas sensíveis protegidas por trigger).
create policy profiles_update on public.profiles
  for update to authenticated
  using (public.is_active_user() and (id = auth.uid() or public.is_admin()))
  with check (public.is_active_user() and (id = auth.uid() or public.is_admin()));

-- ---------------------------------------------------------------------------
-- categories
-- ---------------------------------------------------------------------------
grant select on public.categories to authenticated;
grant insert (name, description, is_active), update (name, description, is_active) on public.categories to authenticated;

create policy categories_select on public.categories
  for select to authenticated using (public.is_active_user());

create policy categories_insert on public.categories
  for insert to authenticated with check (public.is_admin());

create policy categories_update on public.categories
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- tickets
-- ---------------------------------------------------------------------------
grant select on public.tickets to authenticated;
grant insert (title, description, requester_id, category_id, priority) on public.tickets to authenticated;
grant update (title, description, category_id, priority, status, assignee_id) on public.tickets to authenticated;

create policy tickets_select on public.tickets
  for select to authenticated
  using (
    public.is_active_user()
    and (
      public.is_admin()
      or (public.current_user_role() = 'technician' and (assignee_id = auth.uid() or assignee_id is null))
      or requester_id = auth.uid()
    )
  );

create policy tickets_insert on public.tickets
  for insert to authenticated
  with check (public.is_active_user() and requester_id = auth.uid());

create policy tickets_update on public.tickets
  for update to authenticated
  using (
    public.is_active_user()
    and (
      public.is_admin()
      or (public.current_user_role() = 'technician' and (assignee_id = auth.uid() or assignee_id is null))
      or requester_id = auth.uid()
    )
  )
  with check (
    public.is_active_user()
    and (
      public.is_admin()
      or (public.current_user_role() = 'technician' and (assignee_id = auth.uid() or assignee_id is null))
      or requester_id = auth.uid()
    )
  );

-- Chamados nunca são excluídos (encerram-se); sem política de DELETE.

-- ---------------------------------------------------------------------------
-- ticket_comments  (notas internas somente para a equipe)
-- ---------------------------------------------------------------------------
grant select on public.ticket_comments to authenticated;
grant insert (ticket_id, author_id, kind, body) on public.ticket_comments to authenticated;

create policy ticket_comments_select on public.ticket_comments
  for select to authenticated
  using (
    public.can_view_ticket(ticket_id)
    and (kind = 'public' or public.is_staff())
  );

create policy ticket_comments_insert on public.ticket_comments
  for insert to authenticated
  with check (
    author_id = auth.uid()
    and public.can_comment_on_ticket(ticket_id, kind)
  );

-- Comentários são imutáveis: sem UPDATE/DELETE.

-- ---------------------------------------------------------------------------
-- ticket_attachments
-- ---------------------------------------------------------------------------
grant select, delete on public.ticket_attachments to authenticated;
grant insert (ticket_id, uploader_id, file_name, storage_path, mime_type, size_bytes) on public.ticket_attachments to authenticated;

create policy ticket_attachments_select on public.ticket_attachments
  for select to authenticated using (public.can_view_ticket(ticket_id));

create policy ticket_attachments_insert on public.ticket_attachments
  for insert to authenticated
  with check (
    uploader_id = auth.uid()
    and public.can_comment_on_ticket(ticket_id, 'public')
    and storage_path like ticket_id::text || '/%'
  );

create policy ticket_attachments_delete on public.ticket_attachments
  for delete to authenticated
  using (public.can_view_ticket(ticket_id) and (uploader_id = auth.uid() or public.is_admin()));

-- ---------------------------------------------------------------------------
-- ticket_history (somente leitura para clientes)
-- ---------------------------------------------------------------------------
grant select on public.ticket_history to authenticated;

create policy ticket_history_select on public.ticket_history
  for select to authenticated using (public.can_view_ticket(ticket_id));

-- ---------------------------------------------------------------------------
-- notifications (cada usuário vê e marca apenas as próprias)
-- ---------------------------------------------------------------------------
grant select on public.notifications to authenticated;
grant update (is_read) on public.notifications to authenticated;

create policy notifications_select on public.notifications
  for select to authenticated using (recipient_id = auth.uid() and public.is_active_user());

create policy notifications_update on public.notifications
  for update to authenticated
  using (recipient_id = auth.uid() and public.is_active_user())
  with check (recipient_id = auth.uid());

-- ---------------------------------------------------------------------------
-- knowledge_articles
-- ---------------------------------------------------------------------------
grant select, delete on public.knowledge_articles to authenticated;
grant insert (title, content, category_id, author_id, status, tags) on public.knowledge_articles to authenticated;
grant update (title, content, category_id, status, tags) on public.knowledge_articles to authenticated;

create policy knowledge_articles_select on public.knowledge_articles
  for select to authenticated
  using (public.is_active_user() and (status = 'published' or public.is_staff()));

create policy knowledge_articles_insert on public.knowledge_articles
  for insert to authenticated
  with check (public.is_staff() and author_id = auth.uid());

create policy knowledge_articles_update on public.knowledge_articles
  for update to authenticated
  using (public.is_staff() and (public.is_admin() or author_id = auth.uid()))
  with check (public.is_staff() and (public.is_admin() or author_id = auth.uid()));

create policy knowledge_articles_delete on public.knowledge_articles
  for delete to authenticated
  using (public.is_staff() and (public.is_admin() or author_id = auth.uid()));

-- ---------------------------------------------------------------------------
-- audit_log (somente administradores leem; ninguém escreve pela API)
-- ---------------------------------------------------------------------------
grant select on public.audit_log to authenticated;

create policy audit_log_select on public.audit_log
  for select to authenticated using (public.is_admin());

-- =============================================================================
-- Fluxdesk — Migração 0001: esquema base
-- Tipos, tabelas, restrições de integridade e índices.
-- Decisão: aplicação de organização única (single-tenant). Veja docs/ARQUITETURA.md.
-- =============================================================================

create extension if not exists pg_trgm with schema extensions;

-- ---------------------------------------------------------------------------
-- Tipos enumerados
-- ---------------------------------------------------------------------------
create type public.user_role as enum ('requester', 'technician', 'admin');

create type public.ticket_status as enum (
  'open',
  'in_progress',
  'waiting_requester',
  'waiting_third_party',
  'resolved',
  'closed'
);

create type public.ticket_priority as enum ('low', 'medium', 'high', 'critical');

create type public.comment_kind as enum ('public', 'internal');

create type public.article_status as enum ('draft', 'published');

create type public.notification_type as enum (
  'ticket_created',
  'ticket_assigned',
  'status_changed',
  'comment_added',
  'info_requested',
  'ticket_resolved',
  'ticket_closed'
);

-- ---------------------------------------------------------------------------
-- Perfis (1:1 com auth.users)
-- ---------------------------------------------------------------------------
create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  email       text not null,
  full_name   text not null check (char_length(trim(full_name)) between 2 and 120),
  role        public.user_role not null default 'requester',
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index profiles_role_idx on public.profiles (role) where is_active;
create index profiles_name_trgm_idx on public.profiles using gin (full_name extensions.gin_trgm_ops);

-- ---------------------------------------------------------------------------
-- Categorias
-- ---------------------------------------------------------------------------
create table public.categories (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (char_length(trim(name)) between 2 and 80),
  description text check (description is null or char_length(description) <= 300),
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create unique index categories_name_unique_idx on public.categories (lower(trim(name)));

-- ---------------------------------------------------------------------------
-- Chamados
-- ---------------------------------------------------------------------------
create sequence public.ticket_number_seq as bigint start 1;

create table public.tickets (
  id           uuid primary key default gen_random_uuid(),
  number       bigint not null unique default nextval('public.ticket_number_seq'),
  code         text generated always as ('FLX-' || lpad(number::text, 6, '0')) stored,
  title        text not null check (char_length(trim(title)) between 3 and 160),
  description  text not null check (char_length(trim(description)) between 10 and 10000),
  requester_id uuid not null references public.profiles (id) on delete restrict,
  assignee_id  uuid references public.profiles (id) on delete set null,
  category_id  uuid not null references public.categories (id) on delete restrict,
  priority     public.ticket_priority not null default 'medium',
  status       public.ticket_status not null default 'open',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  resolved_at  timestamptz,
  closed_at    timestamptz
);

alter sequence public.ticket_number_seq owned by public.tickets.number;

create unique index tickets_code_unique_idx on public.tickets (code);
create index tickets_requester_idx on public.tickets (requester_id);
create index tickets_assignee_idx on public.tickets (assignee_id);
create index tickets_category_idx on public.tickets (category_id);
create index tickets_status_idx on public.tickets (status);
create index tickets_priority_idx on public.tickets (priority);
create index tickets_created_at_idx on public.tickets (created_at desc);
create index tickets_updated_at_idx on public.tickets (updated_at desc);
create index tickets_resolved_at_idx on public.tickets (resolved_at) where resolved_at is not null;
create index tickets_title_trgm_idx on public.tickets using gin (title extensions.gin_trgm_ops);
create index tickets_code_trgm_idx on public.tickets using gin (code extensions.gin_trgm_ops);

-- ---------------------------------------------------------------------------
-- Comentários (públicos e notas internas) — imutáveis após criação
-- ---------------------------------------------------------------------------
create table public.ticket_comments (
  id         uuid primary key default gen_random_uuid(),
  ticket_id  uuid not null references public.tickets (id) on delete cascade,
  author_id  uuid not null references public.profiles (id) on delete restrict,
  kind       public.comment_kind not null default 'public',
  body       text not null check (char_length(trim(body)) between 1 and 5000),
  created_at timestamptz not null default now()
);

create index ticket_comments_ticket_idx on public.ticket_comments (ticket_id, created_at);
create index ticket_comments_author_idx on public.ticket_comments (author_id);

-- ---------------------------------------------------------------------------
-- Anexos (metadados; arquivos ficam no Supabase Storage)
-- ---------------------------------------------------------------------------
create table public.ticket_attachments (
  id           uuid primary key default gen_random_uuid(),
  ticket_id    uuid not null references public.tickets (id) on delete cascade,
  uploader_id  uuid not null references public.profiles (id) on delete restrict,
  file_name    text not null check (char_length(file_name) between 1 and 255),
  storage_path text not null unique,
  mime_type    text not null check (mime_type in (
    'image/png', 'image/jpeg', 'image/webp', 'image/gif',
    'application/pdf', 'text/plain', 'text/csv',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  )),
  size_bytes   bigint not null check (size_bytes > 0 and size_bytes <= 10485760),
  created_at   timestamptz not null default now()
);

create index ticket_attachments_ticket_idx on public.ticket_attachments (ticket_id);

-- ---------------------------------------------------------------------------
-- Histórico do chamado (preenchido somente por triggers)
-- ---------------------------------------------------------------------------
create table public.ticket_history (
  id         uuid primary key default gen_random_uuid(),
  ticket_id  uuid not null references public.tickets (id) on delete cascade,
  actor_id   uuid references public.profiles (id) on delete set null,
  event_type text not null check (event_type in (
    'created', 'status_changed', 'resolved', 'closed', 'reopened',
    'priority_changed', 'assignee_changed', 'category_changed', 'edited'
  )),
  old_value  text,
  new_value  text,
  created_at timestamptz not null default now()
);

create index ticket_history_ticket_idx on public.ticket_history (ticket_id, created_at);

-- ---------------------------------------------------------------------------
-- Notificações (preenchidas somente por triggers)
-- ---------------------------------------------------------------------------
create table public.notifications (
  id           uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.profiles (id) on delete cascade,
  ticket_id    uuid references public.tickets (id) on delete cascade,
  type         public.notification_type not null,
  title        text not null,
  body         text,
  is_read      boolean not null default false,
  created_at   timestamptz not null default now()
);

create index notifications_recipient_idx on public.notifications (recipient_id, is_read, created_at desc);

-- ---------------------------------------------------------------------------
-- Base de conhecimento
-- ---------------------------------------------------------------------------
create table public.knowledge_articles (
  id           uuid primary key default gen_random_uuid(),
  title        text not null check (char_length(trim(title)) between 3 and 160),
  content      text not null check (char_length(trim(content)) between 10 and 50000),
  category_id  uuid references public.categories (id) on delete set null,
  author_id    uuid not null references public.profiles (id) on delete restrict,
  status       public.article_status not null default 'draft',
  tags         text[] not null default '{}' check (cardinality(tags) <= 10),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  published_at timestamptz
);

create index knowledge_articles_status_idx on public.knowledge_articles (status, updated_at desc);
create index knowledge_articles_category_idx on public.knowledge_articles (category_id);
create index knowledge_articles_tags_idx on public.knowledge_articles using gin (tags);
create index knowledge_articles_title_trgm_idx on public.knowledge_articles using gin (title extensions.gin_trgm_ops);
create index knowledge_articles_content_trgm_idx on public.knowledge_articles using gin (content extensions.gin_trgm_ops);

-- ---------------------------------------------------------------------------
-- Auditoria administrativa (preenchida somente por triggers)
-- ---------------------------------------------------------------------------
create table public.audit_log (
  id          uuid primary key default gen_random_uuid(),
  actor_id    uuid references public.profiles (id) on delete set null,
  action      text not null,
  entity      text not null,
  entity_id   uuid,
  details     jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);

create index audit_log_created_idx on public.audit_log (created_at desc);

-- ---------------------------------------------------------------------------
-- Dados de configuração (não são dados de demonstração)
-- ---------------------------------------------------------------------------
insert into public.categories (name, description) values
  ('Hardware', 'Computadores, periféricos e equipamentos físicos'),
  ('Software', 'Instalação, erros e licenças de aplicativos'),
  ('Rede e Internet', 'Conectividade, Wi-Fi, VPN e acesso à rede'),
  ('Acessos e Senhas', 'Contas, permissões e redefinição de senhas'),
  ('Outros', 'Solicitações que não se encaixam nas demais categorias');

import { PGlite } from '@electric-sql/pglite'
import { pg_trgm } from '@electric-sql/pglite/contrib/pg_trgm'
import { readFileSync, readdirSync } from 'node:fs'
import assert from 'node:assert/strict'

// Executa as migrações em um PostgreSQL embutido (PGlite) com stubs de auth/storage
// do Supabase e verifica RLS, triggers e privilégios com papéis diferentes.
// Uso: npm run test:db
import { fileURLToPath } from 'node:url'
const MIG_DIR = process.argv[2] ?? fileURLToPath(new URL('../migrations', import.meta.url))
const db = new PGlite({ extensions: { pg_trgm } })

// ---- Stubs mínimos do Supabase (auth, storage, roles) ----------------------
await db.exec(`
  create schema extensions;
  create role anon nologin;
  create role authenticated nologin;
  grant usage on schema public to anon, authenticated;
  grant usage on schema extensions to anon, authenticated;
  create schema auth;
  create table auth.users (
    id uuid primary key default gen_random_uuid(),
    email text,
    raw_user_meta_data jsonb not null default '{}'::jsonb
  );
  create function auth.uid() returns uuid language sql stable
    as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  grant usage on schema auth to anon, authenticated;
  grant execute on function auth.uid() to anon, authenticated;
  create schema storage;
  create table storage.buckets (
    id text primary key, name text, public boolean,
    file_size_limit bigint, allowed_mime_types text[]
  );
  create table storage.objects (
    id uuid primary key default gen_random_uuid(),
    bucket_id text, name text, owner_id text
  );
  alter table storage.objects enable row level security;
  grant usage on schema storage to authenticated;
  grant select, insert, delete on storage.objects to authenticated;
`)

for (const f of readdirSync(MIG_DIR).filter((n) => n.endsWith('.sql')).sort()) {
  try {
    await db.exec(readFileSync(`${MIG_DIR}/${f}`, 'utf8'))
    console.log(`migração aplicada: ${f}`)
  } catch (e) {
    console.error(`FALHA em ${f}: ${e.message}`)
    process.exit(1)
  }
}

// ---- Helpers ---------------------------------------------------------------
async function as(uid, sql, params = []) {
  await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub', '${uid}', false);`)
  try {
    return await db.query(sql, params)
  } finally {
    await db.exec(`reset role; select set_config('request.jwt.claim.sub', '', false);`)
  }
}
async function fails(uid, sql, params, pattern) {
  try {
    await as(uid, sql, params)
  } catch (e) {
    if (pattern) assert.match(e.message, pattern, `erro inesperado: ${e.message}`)
    return e.message
  }
  assert.fail(`esperava falha, mas executou: ${sql}`)
}
async function admin(sql, params = []) {
  return db.query(sql, params) // superusuário: sem JWT (auth.uid() = null)
}

let passed = 0
async function t(name, fn) {
  try {
    await fn()
    passed++
    console.log(`  ✔ ${name}`)
  } catch (e) {
    console.error(`  ✘ ${name}\n      ${e.message}`)
    process.exitCode = 1
  }
}

async function newUser(email, name, meta = {}) {
  const r = await admin(
    `insert into auth.users (email, raw_user_meta_data) values ($1, $2::jsonb) returning id`,
    [email, JSON.stringify({ full_name: name, ...meta })],
  )
  return r.rows[0].id
}

// ---- Usuários --------------------------------------------------------------
const evil = await newUser('evil@x.com', 'Evil', { role: 'admin' })
const adm = await newUser('adm@x.com', 'Ana Admin')
const t1 = await newUser('t1@x.com', 'Tiago Técnico')
const t2 = await newUser('t2@x.com', 'Teresa Técnica')
const r1 = await newUser('r1@x.com', 'Rita Requerente')
const r2 = await newUser('r2@x.com', 'Rui Requerente')
await admin(`update public.profiles set role='admin' where id=$1`, [adm])
await admin(`update public.profiles set role='technician' where id = any($1::uuid[])`, [[t1, t2]])
const cat = (await admin(`select id from public.categories where name='Software'`)).rows[0].id

console.log('\nPerfis e escalada de privilégio')
await t('cadastro com metadata role=admin vira solicitante', async () => {
  const r = await admin(`select role from public.profiles where id=$1`, [evil])
  assert.equal(r.rows[0].role, 'requester')
})
await t('solicitante não consegue virar administrador', async () => {
  await fails(r1, `update public.profiles set role='admin' where id=$1`, [r1], /administradores|permission|violates/i)
})
await t('solicitante não altera e-mail do perfil (sem permissão de coluna)', async () => {
  await fails(r1, `update public.profiles set email='x@y.com' where id=$1`, [r1], /permission denied/i)
})
await t('solicitante altera o próprio nome', async () => {
  await as(r1, `update public.profiles set full_name='Rita R.' where id=$1`, [r1])
  const r = await admin(`select full_name from public.profiles where id=$1`, [r1])
  assert.equal(r.rows[0].full_name, 'Rita R.')
})
await t('administrador não pode rebaixar a si mesmo', async () => {
  await fails(adm, `update public.profiles set role='technician' where id=$1`, [adm], /próprio perfil/i)
})
await t('administrador promove usuário e a ação é auditada', async () => {
  await as(adm, `update public.profiles set role='technician' where id=$1`, [evil])
  const a = await admin(`select count(*)::int c from public.audit_log where action='profile_role_changed' and actor_id=$1`, [adm])
  assert.equal(a.rows[0].c, 1)
  await as(adm, `update public.profiles set role='requester' where id=$1`, [evil])
})
await t('solicitante não lê a auditoria', async () => {
  const r = await as(r1, `select * from public.audit_log`)
  assert.equal(r.rows.length, 0)
})

console.log('\nChamados: criação e visibilidade')
let ticket
await t('solicitante abre chamado; número FLX-000001 gerado', async () => {
  const r = await as(
    r1,
    `insert into public.tickets (title, description, requester_id, category_id, priority)
     values ('Impressora offline', 'A impressora do setor não responde.', $1, $2, 'high') returning id, code, status`,
    [r1, cat],
  )
  ticket = r.rows[0]
  assert.equal(ticket.code, 'FLX-000001')
  assert.equal(ticket.status, 'open')
})
await t('solicitante não abre chamado em nome de outro', async () => {
  await fails(r1, `insert into public.tickets (title, description, requester_id, category_id)
    values ('Falso chamado', 'Tentando se passar por outro.', $1, $2)`, [r2, cat], /row-level security/i)
})
await t('solicitante não define status/técnico na criação (colunas protegidas)', async () => {
  await fails(r1, `insert into public.tickets (title, description, requester_id, category_id, status)
    values ('Chamado burlado', 'Tentando já nascer resolvido.', $1, $2, 'resolved')`, [r1, cat], /permission denied/i)
})
await t('outro solicitante não enxerga o chamado', async () => {
  const r = await as(r2, `select id from public.tickets`)
  assert.equal(r.rows.length, 0)
})
await t('técnicos veem chamado sem responsável; admin vê tudo', async () => {
  assert.equal((await as(t1, `select id from public.tickets`)).rows.length, 1)
  assert.equal((await as(t2, `select id from public.tickets`)).rows.length, 1)
  assert.equal((await as(adm, `select id from public.tickets`)).rows.length, 1)
})
await t('equipe e solicitante recebem notificação de criação', async () => {
  const n = await admin(`select recipient_id from public.notifications where type='ticket_created'`)
  const ids = n.rows.map((x) => x.recipient_id)
  for (const u of [r1, t1, t2, adm]) assert.ok(ids.includes(u))
  assert.ok(!ids.includes(r2))
})
await t('histórico registra a criação', async () => {
  const h = await admin(`select event_type from public.ticket_history where ticket_id=$1`, [ticket.id])
  assert.deepEqual(h.rows.map((x) => x.event_type), ['created'])
})

console.log('\nChamados: atribuição e permissões de edição')
await t('solicitante não altera prioridade nem responsável', async () => {
  await fails(r1, `update public.tickets set priority='critical' where id=$1`, [ticket.id], /prioridade ou respons/i)
  await fails(r1, `update public.tickets set assignee_id=$2 where id=$1`, [ticket.id, t1], /prioridade ou respons/i)
})
await t('técnico inicia atendimento e assume automaticamente', async () => {
  await as(t1, `update public.tickets set status='in_progress' where id=$1`, [ticket.id])
  const r = await admin(`select assignee_id, status from public.tickets where id=$1`, [ticket.id])
  assert.equal(r.rows[0].assignee_id, t1)
  assert.equal(r.rows[0].status, 'in_progress')
})
await t('outro técnico não vê nem altera chamado já atribuído', async () => {
  assert.equal((await as(t2, `select id from public.tickets`)).rows.length, 0)
  const r = await as(t2, `update public.tickets set priority='low' where id=$1 returning id`, [ticket.id])
  assert.equal(r.rows.length, 0)
})
await t('técnico não reatribui a terceiros', async () => {
  await fails(t1, `update public.tickets set assignee_id=$2 where id=$1`, [ticket.id, t2], /row-level security|assumir ou liberar/i)
})
await t('técnico não edita título/descrição', async () => {
  await fails(t1, `update public.tickets set title='Outro título' where id=$1`, [ticket.id], /título ou descrição/i)
})
await t('administrador reatribui só a equipe ativa', async () => {
  await fails(adm, `update public.tickets set assignee_id=$2 where id=$1`, [ticket.id, r2], /técnico ou administrador/i)
  await as(adm, `update public.tickets set assignee_id=$2 where id=$1`, [ticket.id, t2])
  await as(adm, `update public.tickets set assignee_id=$2 where id=$1`, [ticket.id, t1])
})
await t('número, solicitante e data de criação são imutáveis', async () => {
  await fails(adm, `update public.tickets set requester_id=$2 where id=$1`, [ticket.id, r2], /permission denied|imutáveis/i)
})

console.log('\nComentários públicos × notas internas')
await t('técnico registra nota interna; solicitante não a enxerga', async () => {
  await as(t1, `insert into public.ticket_comments (ticket_id, author_id, kind, body)
    values ($1, $2, 'internal', 'SEGREDO: reiniciar spooler remoto')`, [ticket.id, t1])
  await as(t1, `insert into public.ticket_comments (ticket_id, author_id, kind, body)
    values ($1, $2, 'public', 'Estamos verificando a impressora.')`, [ticket.id, t1])
  const forReq = await as(r1, `select kind, body from public.ticket_comments where ticket_id=$1`, [ticket.id])
  assert.equal(forReq.rows.length, 1)
  assert.equal(forReq.rows[0].kind, 'public')
  assert.equal((await as(t1, `select id from public.ticket_comments`)).rows.length, 2)
})
await t('solicitante não cria nota interna', async () => {
  await fails(r1, `insert into public.ticket_comments (ticket_id, author_id, kind, body)
    values ($1, $2, 'internal', 'Tentando nota interna')`, [ticket.id, r1], /row-level security/i)
})
await t('notificações do solicitante nunca vazam a nota interna', async () => {
  const n = await as(r1, `select title, body from public.notifications`)
  const all = JSON.stringify(n.rows)
  assert.ok(!/SEGREDO|spooler/i.test(all), all)
})
await t('comentário não pode ser editado nem excluído', async () => {
  await fails(t1, `update public.ticket_comments set body='alterado'`, [], /permission denied/i)
  await fails(adm, `delete from public.ticket_comments`, [], /permission denied/i)
})
await t('técnico não comenta em chamado de outro técnico', async () => {
  await fails(t2, `insert into public.ticket_comments (ticket_id, author_id, kind, body)
    values ($1, $2, 'public', 'Intruso')`, [ticket.id, t2], /row-level security/i)
})
await t('outro solicitante não comenta no chamado alheio', async () => {
  await fails(r2, `insert into public.ticket_comments (ticket_id, author_id, kind, body)
    values ($1, $2, 'public', 'Intruso')`, [ticket.id, r2], /row-level security/i)
})

console.log('\nFluxo de status')
await t('aguardando solicitante → resposta do solicitante retoma o atendimento', async () => {
  await as(t1, `update public.tickets set status='waiting_requester' where id=$1`, [ticket.id])
  const n = await as(r1, `select type from public.notifications where type='info_requested'`)
  assert.equal(n.rows.length, 1)
  await as(r1, `insert into public.ticket_comments (ticket_id, author_id, kind, body)
    values ($1, $2, 'public', 'Já reiniciei e continua offline.')`, [ticket.id, r1])
  const s = await admin(`select status from public.tickets where id=$1`, [ticket.id])
  assert.equal(s.rows[0].status, 'in_progress')
})
await t('resolver preenche resolved_at e notifica', async () => {
  await as(t1, `update public.tickets set status='resolved' where id=$1`, [ticket.id])
  const s = await admin(`select resolved_at from public.tickets where id=$1`, [ticket.id])
  assert.ok(s.rows[0].resolved_at)
  const n = await as(r1, `select 1 from public.notifications where type='ticket_resolved'`)
  assert.equal(n.rows.length, 1)
})
await t('solicitante reabre chamado resolvido (limpa resolved_at)', async () => {
  await as(r1, `update public.tickets set status='open' where id=$1`, [ticket.id])
  const s = await admin(`select resolved_at, status from public.tickets where id=$1`, [ticket.id])
  assert.equal(s.rows[0].resolved_at, null)
  const h = await admin(`select event_type from public.ticket_history where ticket_id=$1 order by created_at, id`, [ticket.id])
  assert.ok(h.rows.map((x) => x.event_type).includes('reopened'))
})
await t('solicitante não resolve nem muda status livremente', async () => {
  await fails(r1, `update public.tickets set status='in_progress' where id=$1`, [ticket.id], /Solicitantes só podem/i)
})
await t('transição inválida é rejeitada (fechado → resolvido)', async () => {
  await as(adm, `update public.tickets set status='in_progress' where id=$1`, [ticket.id])
  await as(adm, `update public.tickets set status='closed' where id=$1`, [ticket.id])
  await fails(adm, `update public.tickets set status='resolved' where id=$1`, [ticket.id], /Transição de status inválida/i)
})
await t('somente administrador reabre chamado encerrado', async () => {
  await fails(t1, `update public.tickets set status='open' where id=$1`, [ticket.id], /administradores podem reabrir/i)
  await as(adm, `update public.tickets set status='open' where id=$1`, [ticket.id])
})
await t('chamados não podem ser excluídos', async () => {
  await fails(adm, `delete from public.tickets`, [], /permission denied/i)
})

console.log('\nHistórico e notificações são somente leitura')
await t('histórico não aceita escrita de clientes', async () => {
  await fails(adm, `insert into public.ticket_history (ticket_id, event_type) values ($1, 'created')`, [ticket.id], /permission denied/i)
  await fails(adm, `update public.ticket_history set new_value='x'`, [], /permission denied/i)
})
await t('notificações: sem INSERT; só marca como lida; só as próprias', async () => {
  await fails(r1, `insert into public.notifications (recipient_id, type, title) values ($1, 'comment_added', 'x')`, [r1], /permission denied/i)
  await fails(r1, `update public.notifications set title='x'`, [], /permission denied/i)
  await as(r1, `update public.notifications set is_read=true`)
  const mine = await as(r1, `select count(*)::int c from public.notifications where is_read=false`)
  assert.equal(mine.rows[0].c, 0)
  const others = await admin(`select count(*)::int c from public.notifications where recipient_id=$1 and is_read=true`, [t1])
  assert.equal(others.rows[0].c, 0)
})
await t('solicitante só vê o histórico do próprio chamado', async () => {
  assert.ok((await as(r1, `select 1 from public.ticket_history`)).rows.length > 0)
  assert.equal((await as(r2, `select 1 from public.ticket_history`)).rows.length, 0)
})

console.log('\nAnexos e Storage')
await t('anexo com tipo não permitido é rejeitado', async () => {
  await fails(r1, `insert into public.ticket_attachments (ticket_id, uploader_id, file_name, storage_path, mime_type, size_bytes)
    values ($1::uuid, $2, 'x.exe', $1::text || '/x.exe', 'application/x-msdownload', 100)`, [ticket.id, r1], /violates check|mime/i)
})
await t('anexo acima de 10 MB é rejeitado', async () => {
  await fails(r1, `insert into public.ticket_attachments (ticket_id, uploader_id, file_name, storage_path, mime_type, size_bytes)
    values ($1::uuid, $2, 'g.pdf', $1::text || '/g.pdf', 'application/pdf', 20000000)`, [ticket.id, r1], /violates check|size/i)
})
await t('solicitante anexa ao próprio chamado; outro solicitante não', async () => {
  await as(r1, `insert into public.ticket_attachments (ticket_id, uploader_id, file_name, storage_path, mime_type, size_bytes)
    values ($1::uuid, $2, 'print.png', $1::text || '/print.png', 'image/png', 1024)`, [ticket.id, r1])
  await fails(r2, `insert into public.ticket_attachments (ticket_id, uploader_id, file_name, storage_path, mime_type, size_bytes)
    values ($1::uuid, $2, 'p.png', $1::text || '/p.png', 'image/png', 1024)`, [ticket.id, r2], /row-level security/i)
  assert.equal((await as(r2, `select 1 from public.ticket_attachments`)).rows.length, 0)
})
await t('caminho do anexo precisa começar pelo id do chamado', async () => {
  await fails(r1, `insert into public.ticket_attachments (ticket_id, uploader_id, file_name, storage_path, mime_type, size_bytes)
    values ($1, $2, 'p.png', 'outra-pasta/p.png', 'image/png', 1024)`, [ticket.id, r1], /row-level security/i)
})
await t('storage.objects: upload só na pasta do próprio chamado', async () => {
  await as(r1, `insert into storage.objects (bucket_id, name, owner_id) values ('ticket-attachments', $1::text || '/print.png', $2)`, [ticket.id, r1])
  await fails(r2, `insert into storage.objects (bucket_id, name, owner_id) values ('ticket-attachments', $1::text || '/hack.png', $2)`, [ticket.id, r2], /row-level security/i)
  await fails(r1, `insert into storage.objects (bucket_id, name, owner_id) values ('ticket-attachments', 'lixo/arquivo.png', $1)`, [r1], /row-level security/i)
  assert.equal((await as(r2, `select 1 from storage.objects`)).rows.length, 0)
  assert.equal((await as(t1, `select 1 from storage.objects`)).rows.length, 1)
})

console.log('\nCategorias')
await t('solicitante não cria categoria; admin cria e desativa', async () => {
  await fails(r1, `insert into public.categories (name) values ('Hack')`, [], /row-level security/i)
  const c = await as(adm, `insert into public.categories (name) values ('Impressoras') returning id`)
  await as(adm, `update public.categories set is_active=false where id=$1`, [c.rows[0].id])
  await fails(r1, `insert into public.tickets (title, description, requester_id, category_id)
    values ('Categoria inativa', 'Usando categoria desativada.', $1, $2)`, [r1, c.rows[0].id], /Categoria inválida/i)
})
await t('categoria com chamados não pode ser excluída', async () => {
  await fails(adm, `delete from public.categories where id=$1`, [cat], /permission denied/i)
})

console.log('\nBase de conhecimento')
let art
await t('técnico cria rascunho; solicitante só vê publicados', async () => {
  const a = await as(t1, `insert into public.knowledge_articles (title, content, author_id, status, tags)
    values ('Como reiniciar a impressora', 'Passo a passo detalhado de reinício.', $1, 'draft', '{impressora}') returning id`, [t1])
  art = a.rows[0].id
  assert.equal((await as(r1, `select 1 from public.knowledge_articles`)).rows.length, 0)
  await as(t1, `update public.knowledge_articles set status='published' where id=$1`, [art])
  assert.equal((await as(r1, `select 1 from public.knowledge_articles`)).rows.length, 1)
  const p = await admin(`select published_at from public.knowledge_articles where id=$1`, [art])
  assert.ok(p.rows[0].published_at)
})
await t('solicitante não cria nem edita artigos', async () => {
  await fails(r1, `insert into public.knowledge_articles (title, content, author_id) values ('Artigo x', 'Conteúdo de teste longo.', $1)`, [r1], /row-level security/i)
  const r = await as(r1, `update public.knowledge_articles set title='hack' where id=$1 returning id`, [art])
  assert.equal(r.rows.length, 0)
})
await t('técnico não edita artigo de outro técnico (admin pode)', async () => {
  const r = await as(t2, `update public.knowledge_articles set title='Outro título' where id=$1 returning id`, [art])
  assert.equal(r.rows.length, 0)
  const ra = await as(adm, `update public.knowledge_articles set title='Reiniciar impressora' where id=$1 returning id`, [art])
  assert.equal(ra.rows.length, 1)
})

console.log('\nRelatórios (RLS aplicada às agregações)')
await t('solicitante enxerga só os próprios números; admin vê o total', async () => {
  await as(r2, `insert into public.tickets (title, description, requester_id, category_id)
    values ('Wi-Fi lento', 'A rede Wi-Fi está muito lenta hoje.', $1, $2)`, [r2, cat])
  const rr = await as(r1, `select public.ticket_report() as j`)
  const ra = await as(adm, `select public.ticket_report() as j`)
  assert.equal(rr.rows[0].j.totals.total, 1)
  assert.equal(ra.rows[0].j.totals.total, 2)
  assert.ok(Array.isArray(ra.rows[0].j.timeline))
})
await t('filtros do relatório funcionam', async () => {
  const r = await as(adm, `select public.ticket_report(p_priority => 'high') as j`)
  assert.equal(r.rows[0].j.totals.total, 1)
})

console.log('\nContrato usado pela interface (embeds, assumir/liberar, edição)')
await t('FKs usadas nos embeds do PostgREST existem com os nomes esperados', async () => {
  const r = await admin(`select conrelid::regclass::text as tbl, conname from pg_constraint
    where contype='f' and confrelid='public.profiles'::regclass and connamespace='public'::regnamespace`)
  const names = r.rows.map((x) => x.conname)
  assert.ok(names.includes('tickets_requester_id_fkey'), names.join())
  assert.ok(names.includes('tickets_assignee_id_fkey'), names.join())
  assert.ok(names.includes('knowledge_articles_author_id_fkey'), names.join())
  // Embeds sem dica (author/actor/uploader) exigem exatamente uma FK da tabela para profiles.
  for (const tbl of ['ticket_comments', 'ticket_history', 'ticket_attachments']) {
    assert.equal(r.rows.filter((x) => x.tbl === tbl).length, 1, `${tbl} deve ter uma única FK para profiles`)
  }
  const c = await admin(`select count(*)::int n from pg_constraint where contype='f'
    and conrelid='public.tickets'::regclass and confrelid='public.categories'::regclass`)
  assert.equal(c.rows[0].n, 1)
})

let t3
await t('técnico assume chamado livre mudando apenas o responsável', async () => {
  t3 = (await as(r2, `insert into public.tickets (title, description, requester_id, category_id)
    values ('Teclado falhando', 'Algumas teclas não funcionam.', $1, $2) returning id`, [r2, cat])).rows[0].id
  await as(t1, `update public.tickets set assignee_id=$2 where id=$1`, [t3, t1])
  const r = await admin(`select assignee_id, status from public.tickets where id=$1`, [t3])
  assert.equal(r.rows[0].assignee_id, t1)
  assert.equal(r.rows[0].status, 'open')
})
await t('solicitante edita título e categoria só enquanto aberto e sem responsável', async () => {
  const free = (await as(r2, `insert into public.tickets (title, description, requester_id, category_id)
    values ('Monitor piscando', 'A tela pisca de tempos em tempos.', $1, $2) returning id`, [r2, cat])).rows[0].id
  await as(r2, `update public.tickets set title='Monitor piscando muito' where id=$1`, [free])
  assert.equal((await admin(`select title from public.tickets where id=$1`, [free])).rows[0].title, 'Monitor piscando muito')
  await fails(r2, `update public.tickets set title='Editado após atribuição' where id=$1`, [t3], /só pode ser editado/i)
})
await t('liberar: sem voltar o status, o trigger reatribui ao próprio técnico (por isso a UI envia status=open junto)', async () => {
  await as(t1, `update public.tickets set status='in_progress' where id=$1`, [t3])
  await as(t1, `update public.tickets set assignee_id=null where id=$1`, [t3])
  assert.equal((await admin(`select assignee_id from public.tickets where id=$1`, [t3])).rows[0].assignee_id, t1)
})
await t('liberar com status=open devolve o chamado à fila', async () => {
  await as(t1, `update public.tickets set assignee_id=null, status='open' where id=$1`, [t3])
  const r = await admin(`select assignee_id, status from public.tickets where id=$1`, [t3])
  assert.equal(r.rows[0].assignee_id, null)
  assert.equal(r.rows[0].status, 'open')
  const h = await admin(`select new_value from public.ticket_history where ticket_id=$1 and event_type='assignee_changed' order by created_at desc, id limit 1`, [t3])
  assert.equal(h.rows[0].new_value, null)
})
await t('liberar de "Aguardando terceiros" não é possível (transição inexistente para Aberto)', async () => {
  await as(t1, `update public.tickets set status='waiting_third_party' where id=$1`, [t3])
  await fails(t1, `update public.tickets set assignee_id=null, status='open' where id=$1`, [t3], /Transição de status inválida/i)
})
await t('solicitante confirma resolução (resolvido → encerrado) e não reabre depois', async () => {
  await as(t1, `update public.tickets set status='resolved' where id=$1`, [t3])
  await as(r2, `update public.tickets set status='closed' where id=$1`, [t3])
  const r = await admin(`select status, closed_at from public.tickets where id=$1`, [t3])
  assert.equal(r.rows[0].status, 'closed')
  assert.ok(r.rows[0].closed_at)
  await fails(r2, `update public.tickets set status='open' where id=$1`, [t3], /Solicitantes só podem/i)
})
await t('busca por número usa a coluna gerada (ILIKE em code) e por título', async () => {
  const byCode = await as(adm, `select count(*)::int n from public.tickets where code ilike '%000001%'`)
  assert.equal(byCode.rows[0].n, 1)
  const byTitle = await as(adm, `select count(*)::int n from public.tickets where title ilike '%teclado%'`)
  assert.equal(byTitle.rows[0].n, 1)
})
await t('paginação por intervalo com total exato retorna a contagem completa', async () => {
  const total = await as(adm, `select count(*)::int n from public.tickets`)
  const page = await as(adm, `select id from public.tickets order by created_at desc, id asc limit 2 offset 0`)
  assert.ok(total.rows[0].n >= 4)
  assert.equal(page.rows.length, 2)
})

console.log('\nApoio à administração (migração 0006)')
await t('estatísticas por usuário e categoria só existem para administradores', async () => {
  const a = await as(adm, `select * from public.user_ticket_stats()`)
  assert.ok(a.rows.length >= 6)
  const tiago = a.rows.find((x) => x.user_id === t1)
  assert.ok(Number(tiago.assigned) >= 1)
  assert.equal((await as(t1, `select * from public.user_ticket_stats()`)).rows.length, 0)
  assert.equal((await as(r2, `select * from public.user_ticket_stats()`)).rows.length, 0)
  assert.ok((await as(adm, `select * from public.category_ticket_counts()`)).rows.length >= 1)
  assert.equal((await as(r2, `select * from public.category_ticket_counts()`)).rows.length, 0)
})
await t('não é possível desativar a última categoria ativa', async () => {
  const active = (await admin(`select id from public.categories where is_active`)).rows.map((r) => r.id)
  for (const id of active.slice(1)) await as(adm, `update public.categories set is_active=false where id=$1`, [id])
  await fails(adm, `update public.categories set is_active=false where id=$1`, [active[0]], /ao menos uma categoria ativa/i)
  for (const id of active.slice(1)) await as(adm, `update public.categories set is_active=true where id=$1`, [id])
})
await t('configurações: leitura para ativos, escrita só para administrador, com auditoria', async () => {
  assert.equal((await as(r2, `select allow_requester_priority from public.app_settings`)).rows.length, 1)
  const denied = await as(r2, `update public.app_settings set allow_requester_priority=false returning id`).catch(() => ({ rows: [] }))
  assert.equal(denied.rows.length, 0)
  const tech = await as(t1, `update public.app_settings set allow_requester_priority=false returning id`).catch(() => ({ rows: [] }))
  assert.equal(tech.rows.length, 0)
  assert.equal((await admin(`select allow_requester_priority from public.app_settings`)).rows[0].allow_requester_priority, true)
  await as(adm, `update public.app_settings set allow_requester_priority=false`)
  assert.equal((await admin(`select count(*)::int n from public.audit_log where action='settings_changed'`)).rows[0].n, 1)
})
await t('sem permissão de prioridade, solicitante abre chamado "Média"; equipe segue livre', async () => {
  const r = await as(r2, `insert into public.tickets (title, description, requester_id, category_id, priority)
    values ('Tentando prioridade', 'Quero marcar como crítico.', $1, $2, 'critical') returning priority`, [r2, cat])
  assert.equal(r.rows[0].priority, 'medium')
  const ta = (await as(adm, `insert into public.tickets (title, description, requester_id, category_id, priority)
    values ('Aberto pela equipe', 'Equipe define prioridade.', $1, $2, 'critical') returning priority`, [adm, cat])).rows[0]
  assert.equal(ta.priority, 'critical')
  await as(adm, `update public.app_settings set allow_requester_priority=true`)
})
await t('prazo de reabertura: dentro do prazo reabre, fora do prazo é recusado; sem limite volta a permitir', async () => {
  const id = (await as(r2, `insert into public.tickets (title, description, requester_id, category_id)
    values ('Mouse sem sinal', 'O mouse sem fio parou de responder.', $1, $2) returning id`, [r2, cat])).rows[0].id
  await as(t1, `update public.tickets set assignee_id=$2, status='resolved' where id=$1`, [id, t1])
  await as(adm, `update public.app_settings set requester_reopen_days=3`)
  await admin(`update public.tickets set resolved_at = now() - interval '5 days' where id=$1`, [id])
  await fails(r2, `update public.tickets set status='open' where id=$1`, [id], /prazo de 3 dia/i)
  await admin(`update public.tickets set resolved_at = now() - interval '1 day' where id=$1`, [id])
  await as(r2, `update public.tickets set status='open' where id=$1`, [id])
  assert.equal((await admin(`select status from public.tickets where id=$1`, [id])).rows[0].status, 'open')
  await as(adm, `update public.app_settings set requester_reopen_days=null`)
})
await t('valores inválidos de prazo são recusados pelo banco', async () => {
  await fails(adm, `update public.app_settings set requester_reopen_days=0`, [], /violates check/i)
  await fails(adm, `update public.app_settings set requester_reopen_days=999`, [], /violates check/i)
})

console.log('\nContas desativadas')
await t('usuário desativado perde todo o acesso', async () => {
  await as(adm, `update public.profiles set is_active=false where id=$1`, [r1])
  assert.equal((await as(r1, `select 1 from public.tickets`)).rows.length, 0)
  assert.equal((await as(r1, `select 1 from public.notifications`)).rows.length, 0)
  assert.equal((await as(r1, `select 1 from public.profiles where id=$1`, [r1])).rows.length, 1, 'ainda lê o próprio perfil')
  await fails(r1, `insert into public.tickets (title, description, requester_id, category_id)
    values ('Conta inativa', 'Tentando abrir com conta inativa.', $1, $2)`, [r1, cat], /row-level security/i)
})
await t('não é possível remover o último administrador', async () => {
  await admin(`update public.profiles set role='admin' where id=$1`, [t2])
  await as(adm, `update public.profiles set role='technician' where id=$1`, [t2]) // há outro admin (adm): ok
  await fails(t1, `update public.profiles set role='admin' where id=$1`, [t1], /administradores|permission/i)
})

console.log(`\n${passed} verificações aprovadas${process.exitCode ? ' — COM FALHAS' : ''}`)
process.exit(process.exitCode ?? 0)

// MODO DEMONSTRAÇÃO — dados 100% fictícios, mantidos em memória.
// Existe apenas para apresentar a interface sem um projeto Supabase (npm run dev:demo).
// Nunca é incluído no build de produção (ver vite.demo.config.ts).
import { STATUS_LABEL } from '@/lib/ticketLabels'
import type {
  AppNotification,
  AppSettings,
  Category,
  KnowledgeArticle,
  Profile,
  Ticket,
  TicketAttachment,
  TicketComment,
  TicketHistoryEvent,
  TicketPriority,
  TicketStatus,
  UserRole,
} from '@/types/domain'

export const DEMO_ROLE_KEY = 'fluxdesk-demo-role'
// Senha fictícia exibida na tela de login da demonstração (a demonstração não valida senhas).
export const DEMO_PASSWORD = 'demo1234'

const DAY = 86_400_000
const HOUR = 3_600_000
const NOW = Date.now()

// Gerador pseudoaleatório determinístico: a demonstração é sempre igual.
function prng(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const rand = prng(20261028)
const pick = <T,>(items: readonly T[]): T => items[Math.floor(rand() * items.length)] as T
const iso = (ms: number) => new Date(ms).toISOString()

// ---------------------------------------------------------------------------
// Pessoas e categorias
// ---------------------------------------------------------------------------
function person(id: string, name: string, email: string, role: UserRole, daysAgo: number): Profile {
  return { id, email, full_name: name, role, is_active: true, created_at: iso(NOW - daysAgo * DAY), updated_at: iso(NOW - daysAgo * DAY) }
}

export const PEOPLE: Profile[] = [
  person('d0000000-0000-4000-8000-000000000001', 'Marina Albuquerque', 'admin@demo.fluxdesk', 'admin', 180),
  person('d0000000-0000-4000-8000-000000000002', 'Rafael Tavares', 'tecnico@demo.fluxdesk', 'technician', 160),
  person('d0000000-0000-4000-8000-000000000003', 'Camila Duarte', 'camila@demo.fluxdesk', 'technician', 150),
  person('d0000000-0000-4000-8000-000000000004', 'Bruno Siqueira', 'bruno@demo.fluxdesk', 'technician', 120),
  person('d0000000-0000-4000-8000-000000000005', 'Helena Prado', 'solicitante@demo.fluxdesk', 'requester', 140),
  person('d0000000-0000-4000-8000-000000000006', 'Diego Moreira', 'diego@demo.fluxdesk', 'requester', 130),
  person('d0000000-0000-4000-8000-000000000007', 'Larissa Nogueira', 'larissa@demo.fluxdesk', 'requester', 100),
  person('d0000000-0000-4000-8000-000000000008', 'Pedro Aguiar', 'pedro@demo.fluxdesk', 'requester', 90),
  person('d0000000-0000-4000-8000-000000000009', 'Juliana Matos', 'juliana@demo.fluxdesk', 'requester', 60),
]
const ADMIN = PEOPLE[0] as Profile
const REQUESTERS = PEOPLE.filter((p) => p.role === 'requester')
export const DEMO_USERS: Record<UserRole, Profile> = {
  admin: ADMIN,
  technician: PEOPLE[1] as Profile,
  requester: PEOPLE[4] as Profile,
}

export const CATEGORIES: Category[] = [
  ['c0000000-0000-4000-8000-000000000001', 'Hardware', 'Computadores, periféricos e equipamentos físicos'],
  ['c0000000-0000-4000-8000-000000000002', 'Software', 'Instalação, erros e licenças de aplicativos'],
  ['c0000000-0000-4000-8000-000000000003', 'Rede e Internet', 'Conectividade, Wi-Fi, VPN e acesso à rede'],
  ['c0000000-0000-4000-8000-000000000004', 'Acessos e Senhas', 'Contas, permissões e redefinição de senhas'],
  ['c0000000-0000-4000-8000-000000000005', 'Outros', 'Solicitações que não se encaixam nas demais categorias'],
].map(([id, name, description]) => ({ id: id as string, name: name as string, description: description as string, is_active: true, created_at: iso(NOW - 200 * DAY), updated_at: iso(NOW - 200 * DAY) }))

// ---------------------------------------------------------------------------
// Chamados
// ---------------------------------------------------------------------------
const TEMPLATES: Record<string, [string, string][]> = {
  Hardware: [
    ['Impressora do financeiro não imprime', 'A impressora do setor financeiro mostra "offline" desde o início da manhã. Já reiniciamos o equipamento e o cabo de rede parece conectado.'],
    ['Monitor com linhas na tela', 'O monitor da estação 14 apresenta linhas verticais após alguns minutos ligado. Troquei o cabo HDMI e o problema continua.'],
    ['Notebook não carrega a bateria', 'O notebook só liga conectado na tomada e a bateria fica em 0%. O carregador é o original.'],
    ['Teclado com teclas travando', 'Várias teclas do teclado precisam ser pressionadas duas vezes para funcionar.'],
    ['Solicitação de segundo monitor', 'Preciso de um segundo monitor para acompanhar planilhas e reuniões ao mesmo tempo.'],
  ],
  Software: [
    ['Erro ao abrir o sistema de estoque', 'Ao abrir o sistema de estoque aparece a mensagem "falha ao carregar módulo" logo após o login.'],
    ['Instalar licença do editor de PDF', 'Preciso da licença do editor de PDF para assinar contratos. Já tenho aprovação do gestor.'],
    ['Planilha trava ao salvar', 'A planilha de fechamento mensal trava por vários minutos sempre que tento salvar.'],
    ['Atualização do antivírus falhou', 'O antivírus exibe "atualização pendente" há três dias e não conclui o download.'],
    ['Aplicativo de reuniões sem áudio', 'Nas reuniões, os participantes não me ouvem, embora o microfone funcione nas configurações do Windows.'],
  ],
  'Rede e Internet': [
    ['VPN desconecta a cada 10 minutos', 'Trabalhando de casa, a VPN cai a cada dez minutos e preciso autenticar novamente.'],
    ['Wi-Fi lento na sala de reuniões', 'A conexão da sala 3 está muito lenta, o que prejudica videochamadas com clientes.'],
    ['Sem acesso à pasta compartilhada', 'Não consigo abrir a pasta compartilhada do comercial desde ontem.'],
    ['Ponto de rede sem sinal', 'O ponto de rede da mesa 22 não fornece conexão. Testei com outro cabo.'],
  ],
  'Acessos e Senhas': [
    ['Redefinir senha do e-mail corporativo', 'Esqueci a senha do e-mail e o link de recuperação não chegou ao meu celular.'],
    ['Liberar acesso ao sistema financeiro', 'Assumi novas atividades e preciso de acesso de leitura ao sistema financeiro.'],
    ['Conta bloqueada após tentativas', 'Minha conta foi bloqueada após algumas tentativas de login. Preciso desbloquear com urgência.'],
    ['Criar acesso para novo colaborador', 'Um novo colaborador do comercial começa na segunda e precisa de e-mail e acesso ao CRM.'],
  ],
  Outros: [
    ['Dúvida sobre política de uso de dispositivos', 'Posso usar meu celular pessoal para acessar o e-mail corporativo? Onde está a política?'],
    ['Solicitação de treinamento da ferramenta', 'Gostaria de um treinamento rápido sobre a nova ferramenta de gestão de projetos.'],
    ['Mudança de mesa e ramal', 'Estou mudando de setor e preciso transferir o ramal e a configuração da estação.'],
  ],
}

const COMMENT_TEXTS = {
  tech: [
    'Olá! Já estou analisando. Pode me confirmar se o problema acontece também em outro horário?',
    'Fiz um teste remoto e identifiquei a causa. Vou aplicar a correção e aviso assim que terminar.',
    'Atualizei a configuração. Pode testar novamente e me dizer se normalizou?',
    'Estamos aguardando o fornecedor para concluir. Atualizo este chamado assim que houver retorno.',
  ],
  requester: [
    'Bom dia! Aconteceu de novo agora há pouco, por volta das 9h.',
    'Testei aqui e funcionou. Muito obrigada pela ajuda!',
    'Continua igual. Anexei o que aparece na tela.',
  ],
  internal: [
    'Mesmo padrão do chamado anterior desta área. Provável problema no switch do andar.',
    'Cliente com urgência por causa de fechamento. Priorizar hoje.',
    'Aguardando peça de reposição, prazo estimado de 3 dias úteis.',
  ],
}

const SETTINGS_DEFAULT: AppSettings = { allow_requester_priority: true, requester_reopen_days: 7, updated_at: iso(NOW - 10 * DAY) }

function weighted<T>(entries: [T, number][]): T {
  const total = entries.reduce((s, [, w]) => s + w, 0)
  let r = rand() * total
  for (const [value, w] of entries) {
    r -= w
    if (r <= 0) return value
  }
  return (entries[entries.length - 1] as [T, number])[0]
}

function buildTickets(): Ticket[] {
  const list: Ticket[] = []
  const total = 54
  for (let i = 1; i <= total; i++) {
    const category = pick(CATEGORIES)
    const [title, description] = pick(TEMPLATES[category.name] ?? (TEMPLATES.Outros as [string, string][]))
    const ageDays = Math.floor(78 * Math.pow(rand(), 1.7))
    const created = NOW - ageDays * DAY - Math.floor(rand() * 9 * HOUR)
    const requester = weighted<Profile>([[REQUESTERS[0] as Profile, 3], ...REQUESTERS.slice(1).map((r): [Profile, number] => [r, 1.4])])
    const priority = weighted<TicketPriority>([['low', 20], ['medium', 45], ['high', 25], ['critical', 10]])
    const status: TicketStatus =
      ageDays > 18
        ? weighted<TicketStatus>([['closed', 38], ['resolved', 47], ['in_progress', 7], ['waiting_third_party', 5], ['waiting_requester', 3]])
        : weighted<TicketStatus>([['open', 24], ['in_progress', 30], ['waiting_requester', 11], ['waiting_third_party', 6], ['resolved', 24], ['closed', 5]])
    const assignee: Profile | null =
      status === 'open' && rand() < 0.75 ? null : weighted<Profile>([[PEOPLE[1] as Profile, 4], [PEOPLE[2] as Profile, 3], [PEOPLE[3] as Profile, 3], [ADMIN, 0.6]])
    let resolvedAt: string | null = null
    let closedAt: string | null = null
    let updated = created + Math.floor(rand() * Math.min(ageDays, 3) * DAY) + HOUR
    if (status === 'resolved' || status === 'closed') {
      const r = Math.min(NOW - HOUR, created + (2 + Math.floor(rand() * 58)) * HOUR)
      resolvedAt = iso(r)
      updated = r
      if (status === 'closed') {
        const c = Math.min(NOW - 30 * 60_000, r + (1 + Math.floor(rand() * 3)) * DAY)
        closedAt = iso(c)
        updated = c
      }
    }
    updated = Math.min(updated, NOW - 5 * 60_000)
    list.push({
      id: `a0000000-0000-4000-8000-${String(i).padStart(12, '0')}`,
      number: i,
      code: `FLX-${String(i).padStart(6, '0')}`,
      title,
      description,
      requester_id: requester.id,
      assignee_id: assignee?.id ?? null,
      category_id: category.id,
      priority,
      status,
      created_at: iso(created),
      updated_at: iso(updated),
      resolved_at: resolvedAt,
      closed_at: closedAt,
      requester: { id: requester.id, full_name: requester.full_name },
      assignee: assignee ? { id: assignee.id, full_name: assignee.full_name } : null,
      category: { id: category.id, name: category.name },
    })
  }
  return list
}

export const db = {
  tickets: buildTickets(),
  comments: new Map<string, TicketComment[]>(),
  history: new Map<string, TicketHistoryEvent[]>(),
  attachments: new Map<string, TicketAttachment[]>(),
  notifications: [] as AppNotification[],
  articles: [] as KnowledgeArticle[],
  settings: { ...SETTINGS_DEFAULT } as AppSettings,
  people: PEOPLE.map((p) => ({ ...p })),
  categories: CATEGORIES.map((c) => ({ ...c })),
  nextNumber: 55,
  seq: 1,
}

export const nextId = (prefix: string) => `${prefix}0000000-0000-4000-8000-${String(db.seq++ + 1000).padStart(12, '0')}`

const personById = (id: string) => db.people.find((p) => p.id === id)

// Comentários e histórico são derivados do estado do chamado na primeira consulta.
export function commentsOf(t: Ticket): TicketComment[] {
  const existing = db.comments.get(t.id)
  if (existing) return existing
  const rnd = prng(t.number * 7919)
  const out: TicketComment[] = []
  const created = Date.parse(t.created_at)
  const end = Date.parse(t.updated_at)
  const add = (kind: 'public' | 'internal', authorId: string, body: string, at: number) => {
    const a = personById(authorId)
    out.push({
      id: `m${t.number}-${out.length}`,
      ticket_id: t.id,
      author_id: authorId,
      kind,
      body,
      created_at: iso(Math.min(at, NOW - 60_000)),
      author: a ? { id: a.id, full_name: a.full_name, role: a.role } : null,
    })
  }
  if (t.assignee_id && t.status !== 'open') {
    const span = Math.max(HOUR, end - created)
    add('public', t.assignee_id, COMMENT_TEXTS.tech[Math.floor(rnd() * 2)] as string, created + span * 0.25)
    if (rnd() < 0.7) add('public', t.requester_id, COMMENT_TEXTS.requester[Math.floor(rnd() * 3)] as string, created + span * 0.45)
    if (rnd() < 0.6) add('internal', t.assignee_id, COMMENT_TEXTS.internal[Math.floor(rnd() * 3)] as string, created + span * 0.5)
    if (t.status === 'resolved' || t.status === 'closed') add('public', t.assignee_id, COMMENT_TEXTS.tech[2] as string, created + span * 0.8)
  }
  db.comments.set(t.id, out)
  return out
}

export function historyOf(t: Ticket): TicketHistoryEvent[] {
  const existing = db.history.get(t.id)
  if (existing) return existing
  const created = Date.parse(t.created_at)
  const end = Date.parse(t.updated_at)
  const span = Math.max(HOUR, end - created)
  const out: TicketHistoryEvent[] = []
  const ev = (type: TicketHistoryEvent['event_type'], actorId: string | null, from: string | null, to: string | null, at: number) => {
    const a = actorId ? personById(actorId) : null
    out.push({ id: `h${t.number}-${out.length}`, ticket_id: t.id, actor_id: actorId, event_type: type, old_value: from, new_value: to, created_at: iso(at), actor: a ? { full_name: a.full_name } : null })
  }
  ev('created', t.requester_id, null, STATUS_LABEL.open, created)
  if (t.assignee_id) {
    ev('assignee_changed', t.assignee_id, null, t.assignee?.full_name ?? null, created + span * 0.1)
    if (t.status !== 'open') ev('status_changed', t.assignee_id, STATUS_LABEL.open, STATUS_LABEL.in_progress, created + span * 0.12)
  }
  if (t.status === 'waiting_requester' || t.status === 'waiting_third_party')
    ev('status_changed', t.assignee_id, STATUS_LABEL.in_progress, STATUS_LABEL[t.status], created + span * 0.6)
  if (t.resolved_at) ev('resolved', t.assignee_id, STATUS_LABEL.in_progress, STATUS_LABEL.resolved, Date.parse(t.resolved_at))
  if (t.closed_at) ev('closed', ADMIN.id, STATUS_LABEL.resolved, STATUS_LABEL.closed, Date.parse(t.closed_at))
  db.history.set(t.id, out)
  return out
}

export function attachmentsOf(t: Ticket): TicketAttachment[] {
  const existing = db.attachments.get(t.id)
  if (existing) return existing
  const list: TicketAttachment[] =
    t.number % 5 === 0
      ? [{ id: `f${t.number}`, ticket_id: t.id, uploader_id: t.requester_id, file_name: 'captura-de-tela.png', storage_path: `demo/${t.id}/captura-de-tela.png`, mime_type: 'image/png', size_bytes: 248_193, created_at: t.created_at, uploader: { full_name: t.requester?.full_name ?? '' } }]
      : []
  db.attachments.set(t.id, list)
  return list
}

// ---------------------------------------------------------------------------
// Visibilidade (espelha a RLS)
// ---------------------------------------------------------------------------
export function visibleTickets(role: UserRole, userId: string): Ticket[] {
  if (role === 'admin') return db.tickets
  if (role === 'technician') return db.tickets.filter((t) => t.assignee_id === null || t.assignee_id === userId)
  return db.tickets.filter((t) => t.requester_id === userId)
}

export function currentActor(): { role: UserRole; user: Profile } {
  let role: UserRole = 'admin'
  try {
    const saved = sessionStorage.getItem(DEMO_ROLE_KEY)
    if (saved === 'admin' || saved === 'technician' || saved === 'requester') role = saved
  } catch {
    // sem armazenamento
  }
  return { role, user: DEMO_USERS[role] }
}

// ---------------------------------------------------------------------------
// Notificações iniciais
// ---------------------------------------------------------------------------
function seedNotifications() {
  const kinds: [AppNotification['type'], string][] = [
    ['status_changed', 'Status alterado'],
    ['comment_added', 'Novo comentário'],
    ['ticket_assigned', 'Chamado atribuído'],
    ['ticket_resolved', 'Chamado resolvido'],
    ['info_requested', 'Informações solicitadas'],
  ]
  for (const role of ['admin', 'technician', 'requester'] as UserRole[]) {
    const user = DEMO_USERS[role]
    const mine = visibleTickets(role, user.id)
      .slice()
      .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
      .slice(0, 12)
    mine.forEach((t, idx) => {
      const [type, label] = kinds[idx % kinds.length] as [AppNotification['type'], string]
      db.notifications.push({
        id: `n-${role}-${idx}`,
        recipient_id: user.id,
        ticket_id: t.id,
        type,
        title: `${label} — ${t.code}`,
        body: t.title,
        is_read: idx > 4,
        created_at: t.updated_at,
      })
    })
  }
}
seedNotifications()

// ---------------------------------------------------------------------------
// Base de conhecimento
// ---------------------------------------------------------------------------
function article(n: number, title: string, category: string | null, tags: string[], content: string, status: 'published' | 'draft', daysAgo: number): KnowledgeArticle {
  const cat = category ? db.categories.find((c) => c.name === category) : undefined
  return {
    id: `b0000000-0000-4000-8000-${String(n).padStart(12, '0')}`,
    title,
    content,
    category_id: cat?.id ?? null,
    author_id: (PEOPLE[1 + (n % 3)] as Profile).id,
    status,
    tags,
    created_at: iso(NOW - (daysAgo + 5) * DAY),
    updated_at: iso(NOW - daysAgo * DAY),
    published_at: status === 'published' ? iso(NOW - daysAgo * DAY) : null,
    author: { full_name: (PEOPLE[1 + (n % 3)] as Profile).full_name },
    category: cat ? { id: cat.id, name: cat.name } : null,
  }
}
db.articles = [
  article(1, 'Como configurar a VPN no notebook corporativo', 'Rede e Internet', ['vpn', 'acesso remoto'], '## Antes de começar\n\nConfirme que o notebook está atualizado e conectado à internet.\n\n## Passo a passo\n\n1. Abra o cliente de VPN pelo menu Iniciar.\n2. Informe o endereço **vpn.suaempresa.com.br**.\n3. Entre com seu usuário e a senha do e-mail corporativo.\n4. Confirme o código enviado ao seu celular.\n\n## Se a conexão cair\n\n- Verifique se o Wi-Fi está estável.\n- Feche e abra o cliente de VPN.\n- Se o problema continuar, abra um chamado na categoria `Rede e Internet`.', 'published', 4),
  article(2, 'Redefinir a senha do e-mail corporativo', 'Acessos e Senhas', ['senha', 'e-mail'], '## Pelo autoatendimento\n\n1. Acesse a página de login do e-mail.\n2. Escolha **Esqueci minha senha**.\n3. Receba o código no celular cadastrado.\n4. Crie uma senha com 12 caracteres ou mais.\n\n> Se o código não chegar em 5 minutos, abra um chamado informando seu nome completo.', 'published', 9),
  article(3, 'Impressora offline: o que verificar primeiro', 'Hardware', ['impressora'], '## Checklist rápido\n\n- O equipamento está ligado e sem papel preso?\n- O cabo de rede está firme nas duas pontas?\n- A impressora correta está definida como padrão?\n\n## Ainda offline?\n\nAnote o modelo e o número da etiqueta de patrimônio e abra um chamado em **Hardware**.', 'published', 14),
  article(4, 'Instalação de software: o que pedir e como', 'Software', ['licença', 'instalação'], '## Solicitação\n\nInforme o nome do programa, a finalidade e o gestor que aprovou. Programas fora do catálogo passam por análise de segurança.\n\n## Prazos\n\nSoftware do catálogo: até 1 dia útil. Fora do catálogo: até 5 dias úteis.', 'published', 21),
  article(5, 'Boas práticas para videochamadas sem falhas', 'Software', ['reunião', 'áudio'], '## Antes da reunião\n\n- Teste o microfone e a câmera.\n- Feche aplicativos que usam muita banda.\n- Prefira cabo de rede ao Wi-Fi quando possível.', 'published', 30),
  article(6, 'Política de uso de dispositivos pessoais (rascunho)', null, ['política'], '## Rascunho\n\nTexto em revisão com o time de segurança. Será publicado após aprovação.', 'draft', 2),
]

// ---------------------------------------------------------------------------
// Relatório (espelha a função SQL ticket_report)
// ---------------------------------------------------------------------------
export function localDay(iso8601: string): string {
  const d = new Date(iso8601)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

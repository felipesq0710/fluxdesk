# Fluxdesk — Arquitetura e decisões técnicas

## Visão geral

SPA em React + TypeScript (Vite) falando diretamente com o Supabase (Auth, PostgreSQL, Storage).
Não há backend Node.js: a autorização é imposta pelo **banco** (RLS, privilégios por coluna e triggers).
O navegador usa apenas a chave `anon`; nenhuma chave `service_role` existe no código-fonte.

## Decisões principais

| Decisão | Motivo |
| --- | --- |
| **Organização única (single-tenant)** | O requisito torna multiempresa opcional. Implementar isolamento parcial é mais perigoso do que não implementar. Evoluir para multiempresa exige `organization_id` em todas as tabelas e políticas (listado em "Melhorias futuras"). |
| **Regras no banco, não no cliente** | O cliente é não confiável. Transições de status, permissões por papel e escalada de privilégio são validadas em triggers `security definer`. A UI apenas espelha as regras para esconder ações indisponíveis. |
| **Privilégios por coluna** | `grant update (colunas)` impede que um cliente altere colunas como `role`, `number` ou `resolved_at` mesmo com RLS permissiva. Regras que dependem do papel ficam nos triggers. |
| **Histórico, notificações e auditoria só por trigger** | Essas tabelas não têm `INSERT/UPDATE/DELETE` para clientes. Não podem ser forjadas nem editadas pelo usuário comum. |
| **Comentários imutáveis** | Sem `UPDATE/DELETE`: preserva a trilha da conversa. |
| **Chamados nunca são excluídos** | Encerram-se. Categorias não são excluídas, apenas desativadas (FK `restrict`). |
| **Papel nunca vem do cliente** | O trigger `handle_new_user` cria sempre `requester`, ignorando metadados de cadastro. O primeiro administrador é promovido manualmente via SQL (ver README). |
| **Desativação de conta via RLS** | `is_active = false` bloqueia todo acesso a dados (todas as políticas exigem `is_active_user()`). A conta de autenticação em si não é banida; isso exigiria `service_role` (ver limitações). |
| **Agregações com `security invoker`** | `ticket_report` roda com as permissões de quem chama: cada perfil só vê números dos chamados que pode ver. |

## Modelo de dados

```
auth.users 1─1 profiles (role, is_active)
categories 1─* tickets *─1 profiles (requester) / profiles (assignee)
tickets 1─* ticket_comments (kind: public | internal)
tickets 1─* ticket_attachments ── arquivos no bucket privado "ticket-attachments"
tickets 1─* ticket_history      (preenchido por trigger)
profiles 1─* notifications      (preenchido por trigger)
categories 1─* knowledge_articles (tags em text[])
audit_log                        (ações administrativas, por trigger)
```

Número do chamado: `number` vem de uma sequence (único, sem duplicidade sob concorrência); `code` é coluna gerada `FLX-000001`.

## Matriz de permissões

| Ação | Solicitante | Técnico | Administrador |
| --- | :-: | :-: | :-: |
| Ver chamados | próprios | atribuídos a ele + sem responsável | todos |
| Abrir chamado | ✔ | ✔ | ✔ |
| Editar título/descrição/categoria | só enquanto aberto e sem responsável | categoria (não título/descrição) | ✔ |
| Alterar prioridade | ✘ | ✔ (seus chamados) | ✔ |
| Assumir / liberar chamado | ✘ | ✔ (apenas para si) | atribui a qualquer técnico/admin ativo |
| Alterar status | responder solicitação, confirmar, reabrir resolvido | ✔ (seus chamados) | ✔ |
| Reabrir chamado encerrado | ✘ | ✘ | ✔ |
| Comentário público | nos próprios (não encerrados) | nos seus | ✔ |
| Nota interna | ✘ | ✔ (nos seus) | ✔ |
| Anexos | nos próprios | nos seus | ✔ |
| Base de conhecimento | ler publicados | ler tudo; criar; editar os próprios | ✔ |
| Dashboard | resumo dos próprios chamados | padrão: seus chamados (pode ampliar para os que enxerga) | todos |
| Relatórios e exportação CSV | ✘ | dentro do que enxerga (RLS) | todos |
| Usuários, categorias, configurações do sistema | ✘ | ✘ | ✔ |
| Auditoria (tabela `audit_log`, leitura) | ✘ | ✘ | ✔ (sem tela dedicada nesta versão) |

## Status e transições

```
open ─────────► in_progress ◄──► waiting_requester
  │                │  ▲            ◄──► waiting_third_party
  │                ▼  │
  └──────────► resolved ──► closed ──(somente admin)──► open
                  │  ▲
                  └──┘ reabertura (solicitante ou equipe)
```

Qualquer estado de atendimento (`in_progress`, `waiting_*`, `resolved`) exige responsável; técnicos assumem automaticamente ao iniciar o atendimento.

## Segurança em camadas

1. **RLS** em todas as tabelas, com política de negação por padrão.
2. **Privilégios mínimos** por coluna (`revoke all` + `grant` explícito).
3. **Triggers `security definer`** com `search_path = ''` para regras dependentes de papel.
4. **Storage privado**: o acesso ao arquivo deriva do acesso ao chamado (pasta = id do chamado).
5. **Validação** em duas camadas: Zod no cliente e `CHECK` constraints no banco (tamanho, tipo MIME, comprimentos).
6. **Notificações sem conteúdo sensível**: notas internas nunca geram notificações e o texto delas jamais é copiado para outras tabelas.

## Como as políticas são verificadas

`npm run test:db` aplica as migrações em um PostgreSQL embutido (PGlite) com stubs de `auth`/`storage` e executa verificações com papéis diferentes (`supabase/tests/rls.test.mjs`). Limite: é um PostgreSQL real, mas **não** é o Supabase hospedado — a verificação final com contas reais de cada perfil continua necessária (roteiro no README).

## Fase 4 — funcionalidades complementares

### Relatórios e Dashboard
- Dashboard (`/`) e Relatórios (`/relatorios`) usam o mesmo componente (`ReportView`) alimentado pela função SQL `ticket_report` (`security invoker`): **os números respeitam a RLS** de quem consulta, então um solicitante só enxerga agregações dos próprios chamados.
- Filtros (período, categoria, prioridade, status, responsável) ficam na URL (`useReportFilters`): link compartilhável e botão Voltar funcional. Técnicos abrem o Dashboard com `assignee=me`.
- Período filtra pela **data de criação**; na linha do tempo, "resolvidos" contam pela **data de resolução**. Intervalos acima de 92 dias são agrupados por semana.
- Tempo médio de resolução só aparece com **ao menos 3 chamados resolvidos** no filtro; abaixo disso a tela diz "dados insuficientes" (nada de média enganosa). Por responsável, o mesmo limite.
- Gráficos (recharts): barras horizontais de matiz único para distribuições, duas linhas finas (criados × resolvidos) com legenda, tooltip, e botão **Gráfico/Tabela** (a tabela é a alternativa acessível). Cores via variáveis CSS (`--chart-1/2`), com paleta categórica validada nos dois temas (claro `#2a78d6` / `#eb6834`; escuro `#3987e5` / `#d95926`).
- **Exportação CSV**: busca em lotes de 1.000 até **10.000 linhas** (aviso quando truncado). Separador `;`, BOM UTF-8 e CRLF (abre direto no Excel pt-BR); células iniciadas por `= + - @` recebem apóstrofo (proteção contra injeção de fórmula). Notas internas nunca entram.

### Base de conhecimento
- Rascunho/publicado: solicitantes só leem publicados (RLS); técnicos criam e editam **os próprios**; administradores gerenciam todos (a UI espelha em `canManageArticle`).
- Conteúdo em Markdown mínimo (títulos, listas, citação, código, negrito, links). O renderizador (`lib/markdown.ts`) produz uma árvore de dados e o React escapa todo texto: **não há `dangerouslySetInnerHTML`**, HTML digitado aparece como texto e links aceitam apenas `http`, `https` e `mailto`.
- Busca por título/conteúdo (`ilike` com trigram), filtro por categoria e por tag (clique na tag). A listagem não traz o corpo dos artigos.

### Administração e configurações
- **Usuários**: busca, filtros, paginação; trocar perfil e (de)sativar com confirmação. As regras vivem no banco: ninguém altera o próprio perfil/estado e é obrigatório manter ao menos um administrador ativo; a UI desabilita e explica, e mostra a mensagem do banco se algo for recusado. Contagens vêm de `user_ticket_stats()` (somente admin).
- **Categorias**: criar, editar, (des)ativar; desativar avisa quantos chamados em aberto existem (`category_ticket_counts()`); o banco garante ao menos uma categoria ativa e nomes únicos (case-insensitive). Categorias nunca são excluídas.
- **Configurações**: tema (claro, escuro ou seguir o sistema; salvo só no navegador), nome, troca de senha (exige a senha atual, verificada por novo login) e, para administradores, as **duas regras reais** da tabela `app_settings`: prioridade escolhida pelo solicitante e prazo para reabrir chamado resolvido. Ambas são impostas por triggers, não só pela interface.
- Notificações: lista paginada, marcar como lida/todas, contador no cabeçalho (atualização a cada 60 s; sem tempo real/websocket).

## Redesign visual

Alteração restrita ao front-end (estilos, componentes e composição das telas); **nenhum arquivo de `supabase/`, serviço, contexto de autenticação, `.env.example` ou política RLS foi modificado**. Único acréscimo de lógica: `previousRange`/`previousFilters`/`computeTrend` em `src/lib/report.ts`, que reaproveitam a função `ticket_report` existente para comparar períodos de mesma duração. Tokens em `tailwind.config.js` + `src/index.css`; detalhes na seção "Design system e acessibilidade" do README.

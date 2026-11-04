# Fluxdesk

**Suporte organizado. Fluxo eficiente.**

Fluxdesk é um sistema de Help Desk / ITSM em português do Brasil: solicitantes abrem chamados, técnicos atendem, administradores gerenciam o sistema. Projeto de portfólio, construído com React + TypeScript no front-end e Supabase (Auth, PostgreSQL com RLS, Storage) como backend. **Não existe servidor Node separado**: as regras de negócio vivem no banco (políticas RLS, triggers e funções SQL).

> **Estado de verificação (leia antes de implantar).** O código foi verificado com `typecheck`, `lint`, `build`, testes de interface e testes de banco rodando em um PostgreSQL local (PGlite). **Ainda não foi executado contra um projeto Supabase hospedado, nem implantado na Vercel.** Os e-mails de autenticação, o Storage real e as consultas do PostgREST só foram validados por esquema, PGlite e mocks. Siga o passo a passo abaixo e a seção "Checklist de validação" ao subir o primeiro ambiente.

## Sumário

1. [Funcionalidades](#funcionalidades)
2. [Stack](#stack)
3. [Configuração local](#configuração-local)
4. [Configuração do Supabase](#configuração-do-supabase)
5. [Migrations](#migrations)
6. [Storage (anexos)](#storage-anexos)
7. [Primeiro administrador e perfis de teste](#primeiro-administrador-e-perfis-de-teste)
8. [Testes](#testes)
9. [Deploy na Vercel](#deploy-na-vercel)
10. [Permissões](#permissões)
11. [Segurança](#segurança)
12. [Design system e acessibilidade](#design-system-e-acessibilidade)
13. [Limitações conhecidas](#limitações-conhecidas)
14. [Capturas de tela](#capturas-de-tela)
15. [Melhorias futuras](#melhorias-futuras)
16. [Estrutura do projeto](#estrutura-do-projeto)

## Funcionalidades

- **Autenticação**: cadastro, login, recuperação e redefinição de senha, sessão persistente, rotas protegidas por perfil, aviso de sessão expirada, tela para conta desativada.
- **Chamados**: abertura com anexos, listagem com busca, filtros e paginação (estado na URL), detalhe com comentários públicos e **notas internas**, histórico automático, atribuição (assumir/liberar), mudança de status por regras de transição, reabertura (com prazo configurável).
- **Minha fila** (equipe): abas "Atribuídos a mim", "Sem responsável", "Críticos", "Aguardando solicitante" e "Atualizados recentemente", com contagens reais.
- **Dashboard**: indicadores e gráficos por status, prioridade, categoria e linha do tempo; solicitantes veem apenas os próprios números.
- **Relatórios** (equipe): mesmos indicadores com filtros de período, categoria, prioridade, status e responsável, tabela por responsável e **exportação CSV** (compatível com Excel pt-BR).
- **Notificações**: geradas por triggers (novo chamado, atribuição, mudança de status, comentário, resolução), lista paginada, marcar como lida, contador no cabeçalho.
- **Base de conhecimento**: artigos em rascunho/publicado, categorias, tags, busca, editor com pré-visualização.
- **Administração**: usuários (perfil e ativação), categorias, configurações do sistema.
- **Configurações pessoais**: tema claro/escuro/sistema, nome, troca de senha.

## Stack

| Camada | Tecnologias |
| --- | --- |
| Interface | React 19, TypeScript 6 (strict), Vite 8, Tailwind CSS 3, React Router 7 (rotas com carregamento sob demanda) |
| Dados | TanStack Query 5, React Hook Form + Zod, supabase-js 2 |
| Gráficos | recharts 3 |
| Backend | Supabase: Auth (PKCE), PostgreSQL + RLS, Storage privado |
| Testes | Vitest, Testing Library, vitest-axe, PGlite (banco local) |

Paleta da marca: `#2457FF` (azul), `#FFFFFF`, `#DFF7FF`, `#111111`, `#16A34A` (sucesso), `#F59E0B` (alerta), `#DC2626` (erro). Textos pequenos usam tons derivados (ex.: `green-700`, `red-700`/`red-400` no escuro) para manter contraste AA.

## Configuração local

Requisitos: Node.js 20+ e npm.

```bash
npm install
cp .env.example .env.local   # preencha com os dados do seu projeto Supabase
npm run dev
```

Variáveis (somente públicas — **nunca** coloque a chave `service_role` no front-end):

| Variável | Onde encontrar |
| --- | --- |
| `VITE_SUPABASE_URL` | Supabase → Project Settings → API → Project URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase → Project Settings → API → `anon` `public` |

Sem as variáveis, o app mostra uma tela de configuração ausente em vez de quebrar.

Scripts: `dev`, `build`, `preview`, `lint`, `typecheck`, `test`, `test:watch`, `test:db`.

## Configuração do Supabase

1. Crie um projeto em [supabase.com](https://supabase.com).
2. **Authentication → Providers → Email**: mantenha habilitado. Recomenda-se **manter a confirmação de e-mail ligada**; o app trata os dois casos (com e sem confirmação).
3. **Authentication → URL Configuration**:
   - *Site URL*: a URL de produção (ex.: `https://seu-app.vercel.app`) — em desenvolvimento, `http://localhost:5173`.
   - *Redirect URLs*: adicione `http://localhost:5173/**` e `https://seu-app.vercel.app/**`. O app usa `/entrar` (confirmação de cadastro) e `/redefinir-senha` (recuperação).
4. Aplique as migrations (próxima seção).
5. Copie URL e `anon key` para `.env.local`.

> O link de redefinição de senha usa PKCE: ele precisa ser aberto **no mesmo navegador** em que a recuperação foi solicitada.

## Migrations

Em `supabase/migrations/`, para aplicar **em ordem**:

| Arquivo | Conteúdo |
| --- | --- |
| `20261022000001_schema.sql` | Tipos, tabelas, índices (inclui busca por trigramas) e categorias iniciais |
| `20261022000002_functions_triggers.sql` | Criação de perfil no cadastro, regras de status, histórico, notificações e auditoria (triggers) |
| `20261022000003_rls.sql` | RLS em todas as tabelas, GRANTs por coluna e funções auxiliares |
| `20261022000004_storage.sql` | Bucket privado `ticket-attachments` e políticas de Storage |
| `20261022000005_reports.sql` | Função `ticket_report` (agregações) |
| `20261022000006_admin_support.sql` | Estatísticas administrativas, trava da última categoria ativa, tabela `app_settings` |

Opção A — Supabase CLI:

```bash
npx supabase login
npx supabase link --project-ref SEU_PROJECT_REF
npx supabase db push
```

Opção B — SQL Editor do painel: cole e execute cada arquivo, na ordem.

Se alguma migration falhar, **não pule**: as seguintes dependem das anteriores.

## Storage (anexos)

A migration `0004` cria o bucket **privado** `ticket-attachments` (limite de 10 MB por arquivo; tipos: PNG, JPEG, WebP, GIF, PDF, TXT, CSV, DOCX, XLSX) e as políticas que derivam o acesso das regras do chamado: quem pode ver o chamado pode baixar; quem pode comentar publicamente pode enviar; só administrador ou quem enviou pode remover. Os arquivos ficam em `{id_do_chamado}/{arquivo}` e são acessados por **URLs assinadas de 60 segundos**. Nada é público.

## Primeiro administrador e perfis de teste

Todo cadastro nasce como **solicitante** — o papel nunca vem do navegador. Para criar o primeiro administrador:

1. Cadastre-se normalmente pelo app (e confirme o e-mail, se exigido).
2. No SQL Editor do Supabase:

```sql
update public.profiles set role = 'admin' where email = 'seu-email@exemplo.com';
```

Depois disso, promova técnicos em **Usuários** (menu do administrador). Para testar cada perfil, crie três contas (ex.: `admin@…`, `tecnico@…`, `solicitante@…`) e ajuste os perfis dessa forma.

## Duas versões, dois builds

| | Demo pública | Versão funcional (pessoal) |
| --- | --- | --- |
| Dados e login | fictícios, em memória, autenticação simulada | reais, via Supabase Auth/PostgreSQL |
| Rodar | `npm run dev:demo` | `npm run dev` (com `.env.local`) |
| Build | `npm run build:demo` → `dist-demo/` | `npm run build` → `dist/` |
| Ambiente | não lê `.env*` nem variáveis `VITE_*` (`envDir: false` + `envPrefix` próprio em `vite.demo.config.ts`) | `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` (local ou na hospedagem) |

A demo troca, só na sua configuração, a entrada e os módulos que falam com o Supabase (`vite.demo.config.ts`); o `build` funcional nunca inclui `src/demo`. Para conferir o isolamento: `npm run verify:builds` (constrói os dois com valores **falsos** de ambiente e verifica que `dist` não tem dados/autenticação simulados e que `dist-demo` não tem URL, chave nem cliente do Supabase; não acessa a rede nem o banco).

## Demonstração para recrutadores

Versão isolada, com **dados 100% fictícios em memória**: não usa o Supabase, não exige `.env.local` e nunca entra no build de produção.

```bash
npm run dev:demo     # abre a demonstração em modo de desenvolvimento
npm run build:demo   # gera dist-demo/ (site estático que pode ser publicado à parte)
```

Na tela de login há três botões de acesso com um clique. Credenciais fictícias (a demonstração não valida a senha):

| Perfil | E-mail | Senha |
| --- | --- | --- |
| Administrador | `admin@demo.fluxdesk` | `demo1234` |
| Técnico | `tecnico@demo.fluxdesk` | `demo1234` |
| Solicitante | `solicitante@demo.fluxdesk` | `demo1234` |

Uma faixa discreta no canto inferior direito identifica a demonstração e permite trocar de perfil. As alterações feitas ficam só na memória do navegador.

## Testes

```bash
npm run typecheck   # TypeScript estrito
npm run lint        # ESLint
npm test            # 307 testes de interface/serviço/regras (Vitest)
npm run test:db     # (opcional, local) 66 verificações de RLS e triggers em PostgreSQL local (PGlite)
npm run build       # build de produção
```

- **Testes de interface** usam um cliente Supabase simulado; qualquer uso acidental do cliente real falha o teste.
- **Acessibilidade**: `src/test/a11y.test.tsx` roda o axe nas telas principais. O jsdom não calcula contraste, então o contraste foi conferido por cálculo (ver acima).
- **Banco** (`supabase/tests/rls.test.mjs`): aplica as migrations em um PostgreSQL local (PGlite) com `auth`/`storage` simulados e verifica, **por perfil** (solicitante, técnico, administrador, conta desativada): quem vê o quê, notas internas invisíveis a solicitantes (tabela e notificações), transições de status, colunas protegidas, comentários imutáveis, chamados nunca excluídos, papel não alterável pelo próprio usuário, último administrador protegido, prazo de reabertura etc.

Como testar a RLS em um projeto real (recomendado antes de publicar): com as três contas de teste, abra o mesmo chamado em cada uma e confirme que (a) o solicitante não vê notas internas nem chamados de outros; (b) o técnico só vê chamados seus ou sem responsável; (c) apenas o administrador acessa Usuários, Categorias e Configurações do sistema, e ao digitar essas URLs com outro perfil aparece "Acesso não autorizado".

Testes ponta a ponta (Playwright) **não foram incluídos**: exigiriam um projeto Supabase de teste com contas reais, o que não estava disponível. Consulte "Melhorias futuras".

## Deploy na Vercel

1. Suba o repositório para o GitHub e importe o projeto na Vercel (preset **Vite**; build `npm run build`, saída `dist`).
2. Em *Settings → Environment Variables*, defina `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`.
3. `vercel.json` já reescreve todas as rotas para `index.html` (necessário para o React Router).
4. Após o primeiro deploy, adicione a URL final em **Supabase → Authentication → URL Configuration** (Site URL e Redirect URLs).
5. Faça o "Checklist de validação" abaixo.

### Checklist de validação (primeiro ambiente real)

- [ ] Cadastro envia o e-mail de confirmação e o link leva a `/entrar`.
- [ ] Recuperação de senha: o link abre `/redefinir-senha` no mesmo navegador.
- [ ] Abrir chamado com anexo; baixar o anexo (URL assinada) com o dono e negar com outro solicitante.
- [ ] Nota interna criada por técnico não aparece para o solicitante (tela e notificações).
- [ ] Dashboard e Relatórios carregam (`ticket_report`) e a exportação CSV abre no Excel.
- [ ] Páginas de administração só funcionam para administradores.

## Permissões

| Ação | Solicitante | Técnico | Administrador |
| --- | :-: | :-: | :-: |
| Ver chamados | próprios | atribuídos a ele + sem responsável | todos |
| Abrir chamado | ✔ | ✔ | ✔ |
| Editar chamado | título/descrição/categoria enquanto aberto e sem responsável | categoria | ✔ |
| Alterar prioridade | ✘ | ✔ (seus chamados) | ✔ |
| Assumir / liberar | ✘ | ✔ (para si) | atribui a qualquer membro da equipe |
| Alterar status | responder, confirmar, reabrir resolvido | ✔ (seus chamados) | ✔ |
| Reabrir encerrado | ✘ | ✘ | ✔ |
| Comentário público | nos próprios | nos seus | ✔ |
| Nota interna | ✘ | ✔ (nos seus) | ✔ |
| Anexos | nos próprios | nos seus | ✔ |
| Base de conhecimento | ler publicados | ler tudo, criar, editar os próprios | ✔ |
| Dashboard | próprios números | seus chamados (pode ampliar) | todos |
| Relatórios e CSV | ✘ | dentro do que enxerga | todos |
| Usuários, categorias, configurações do sistema | ✘ | ✘ | ✔ |

A matriz completa, o diagrama de status e as decisões de arquitetura estão em [`docs/ARQUITETURA.md`](docs/ARQUITETURA.md).

## Segurança

- **RLS em todas as tabelas** e GRANTs por coluna: o cliente só consegue alterar o que a regra permite, mesmo chamando a API diretamente.
- **Notas internas** são filtradas na política da tabela e nas notificações; não dependem da interface.
- **Papel nunca vem do cliente**: o gatilho de cadastro cria sempre `requester`; alterações de papel/estado só por administrador e nunca na própria conta.
- Histórico, notificações e auditoria são escritos **apenas por triggers** (`security definer`, `search_path` vazio).
- Comentários são imutáveis; chamados nunca são excluídos.
- **Anexos**: bucket privado, validação de tipo e tamanho no cliente **e** no bucket, URLs assinadas de 60 s.
- **Conteúdo do usuário**: o React escapa todo texto; a base de conhecimento usa renderizador próprio sem `dangerouslySetInnerHTML`, com links restritos a `http`, `https` e `mailto`. O CSV neutraliza células que começariam com `= + - @`.
- Buscas sanitizam caracteres especiais do filtro do PostgREST.
- Somente a chave `anon` é usada no front-end; não há segredos no repositório (`.env*` ignorado).
- Mensagens de erro de autenticação não revelam se um e-mail existe na recuperação de senha.
- Desativar um usuário é feito por `is_active`: **todas as políticas exigem conta ativa**, então a pessoa perde o acesso aos dados imediatamente.

## Design system e acessibilidade

**Identidade visual** (tokens em `tailwind.config.js` e `src/index.css`): azul cobalto `#0038FF` como cor de ação, areia `#FFD8B8` como acento pontual (marcadores, contadores, destaques), grafite no tema escuro (navegação e painel principal), neutros frios para superfícies. Tipografia self-hosted (`@fontsource-variable`): *Bricolage Grotesque* (títulos e números) e *Hanken Grotesk* (texto). Tema claro e escuro projetados separadamente (superfícies, bordas, texto, gráficos e estados).

- Cores são tokens CSS (`--canvas`, `--surface`, `--fg`, `--brand-fg`, `--chart-*`…) consumidos pelo Tailwind; componentes reutilizáveis em `@layer components` (`card`, `btn-*`, `field-*`, `data-table`, `stack-table`, `page-title`).
- No tema claro o cartão principal do Dashboard usa um degradê azul sutil (do azul claro da marca ao branco, com um brilho no canto); no escuro, o painel grafite com brilho azul. Textos, números, legenda e gráfico mantêm contraste ≥ 4,5:1 (séries ≥ 3:1).
- Status = glifo de círculo; prioridade = barras ascendentes; nenhum depende só de cor.
- O Dashboard usa **somente dados reais**: a tendência compara o período com o período imediatamente anterior de mesma duração (segunda chamada à função `ticket_report`, sem alteração no banco) e some em "Todo o período".
- Séries dos gráficos validadas contra as superfícies escuras (`#5B7CFF` / `#D8733A`); o areia nunca é usado como cor de série.
- Contraste conferido por cálculo: texto principal ≥ 15:1, secundário ≥ 6:1, mudo ≥ 4,5:1, azul de ação sobre superfície ≥ 7:1 nos dois temas.

### Revisão visual (v4)

- **Conversa**: respostas da equipe e do solicitante têm degradês muito sutis (variações das superfícies, também no escuro), deslocamento lateral em telas ≥ 640 px e o rótulo "resposta da equipe" em texto; nota interna com borda tracejada areia e selo com cadeado. Nome, papel e horário ficam sempre na mesma posição.
- **Dashboard**: "Exige atenção" no topo (críticos, sem responsável ou parados; para solicitantes, "Aguardando você"). Série temporal agrupada por semana acima de 14 dias; análises por status, prioridade, categoria e responsável ficam recolhidas.
- **Prazo**: o banco não tem campo de prazo/SLA. "Parado há N dias" é calculado só a partir da última atualização real (limite de 3 dias em `src/lib/attention.ts`), apenas para chamados ativos.
- **Lista**: marca lateral em críticos ativos; cartões mobile com prioridade no topo e responsável + atualização na base.
- **Cor com moderação**: item ativo da navegação neutro (azul só no marcador), barras de distribuição em cinza-azulado (≥ 3:1), azul reservado a ações.
- **Demonstração**: o seletor flutuante virou uma faixa no fluxo da página (não cobre conteúdo); o bloco de acesso fica abaixo do formulário de login.

### Acessibilidade e responsividade

- Navegação por teclado, foco visível, link "Ir para o conteúdo", rótulos associados a campos, erros com `aria-describedby`, diálogos com armadilha de foco e `Esc`, tabelas com cabeçalhos e legendas, estados anunciados (`role="status"`/`alert`).
- Gráficos têm **alternativa em tabela** e não dependem só de cor (legenda, rótulos e tooltip). `prefers-reduced-motion` respeitado.
- Verificação automática com axe em 11 telas (sem violações) e contraste de texto conferido por cálculo; textos pequenos de status usam tons com contraste AA.
- Layout responsivo: menu lateral vira gaveta no celular, listas e tabelas viram cartões abaixo de 1024 px (sem rolagem horizontal), filtros recolhem em telas pequenas.
- **Não foi feita** revisão manual com leitor de tela real nem teste em dispositivos físicos.

## Limitações conhecidas

- Não validado contra Supabase hospedado nem na Vercel (veja o aviso no topo).
- Desativar usuário **não** bane a conta no Supabase Auth (isso exigiria `service_role`/Edge Function); a pessoa ainda consegue autenticar, mas não acessa dados.
- Notificações atualizam por consulta periódica (60 s), sem tempo real.
- Exportação CSV limitada a 10.000 linhas por vez (com aviso); relatórios agregam no banco, sem limite.
- Aplicação de instância única (single-tenant): sem separação entre organizações.
- Sem SLA/prazo (a interface mostra apenas há quanto tempo o chamado está sem atualização), e-mails transacionais de chamados, edição de comentários, nem tela para a auditoria (`audit_log` é gravado e legível por administradores via SQL).
- Contas são criadas pelo cadastro; o administrador não cria nem convida usuários pela interface.
- O bundle dos gráficos (recharts) é carregado junto com o Dashboard, a página inicial.

## Capturas de tela

Geradas no **modo demonstração** (`npm run dev:demo`, dados fictícios identificados na própria interface), não de um ambiente real:

| Tela | Arquivo |
| --- | --- |
| Login | `docs/screenshots/login.png` |
| Dashboard (claro) | `docs/screenshots/dashboard-claro.png` |
| Dashboard (escuro) | `docs/screenshots/dashboard-escuro.png` |
| Lista de chamados | `docs/screenshots/chamados.png` |
| Detalhe do chamado (escuro) | `docs/screenshots/chamado-detalhe-escuro.png` |
| Lista no celular (escuro) | `docs/screenshots/chamados-mobile-escuro.png` |

## Melhorias futuras

- Testes ponta a ponta (Playwright) contra um projeto Supabase de teste, incluindo um roteiro por perfil.
- Edge Function para banir/convidar usuários e e-mails transacionais.
- Tempo real (Supabase Realtime) em chamados e notificações.
- SLA com prazos por prioridade e indicadores de cumprimento.
- Tela de auditoria e busca de texto completo na base de conhecimento.
- Multi-organização (tenant) e importação de usuários.
- Edição de comentários com histórico, menções e modelos de resposta.

## Estrutura do projeto

```
src/
  components/   interface reutilizável (ui, layout, tickets, reports, knowledge, feedback)
  contexts/     autenticação e tema
  hooks/        consultas (TanStack Query) e utilidades
  lib/          regras puras (permissões, filtros, status, relatórios, CSV, markdown)
  pages/        telas (auth, tickets, reports, knowledge, admin, configurações)
  routes/       roteador e guardas por perfil
  schemas/      validação Zod dos formulários
  services/     acesso ao Supabase (única camada que fala com a API)
  test/         utilitários, fixtures e teste de acessibilidade
supabase/
  migrations/   esquema, triggers, RLS, storage, relatórios, administração
  tests/        verificações de RLS/triggers em PostgreSQL local
docs/           arquitetura e decisões
```

---

Fluxdesk — projeto de portfólio. Todas as marcas e dados exibidos no sistema são do próprio usuário que o instalar; o build de produção não inclui dados de demonstração (o modo demo, `npm run dev:demo`, é separado e identificado por uma faixa fixa).

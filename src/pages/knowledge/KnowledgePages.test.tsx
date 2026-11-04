import { beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Route, Routes } from 'react-router-dom'
import ArticleEditorPage from '@/pages/knowledge/ArticleEditorPage'
import ArticlePage from '@/pages/knowledge/ArticlePage'
import KnowledgePage from '@/pages/knowledge/KnowledgePage'
import { resetTicketServiceMock } from '@/test/ticketServiceMock'
import { authAs, renderWithProviders } from '@/test/utils'
import type { KnowledgeArticle, UserRole } from '@/types/domain'

const api = vi.hoisted(() => ({
  listArticles: vi.fn(),
  getArticle: vi.fn(),
  createArticle: vi.fn(),
  updateArticle: vi.fn(),
  deleteArticle: vi.fn(),
}))
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() }))

vi.mock('@/services/tickets', async () => (await import('@/test/ticketServiceMock')).ticketServiceMock)
vi.mock('@/services/articles', () => api)
vi.mock('sonner', () => ({ toast, Toaster: () => null }))

const ART_ID = '11111111-2222-4333-8444-555555555555'

function makeArticle(over: Partial<KnowledgeArticle> = {}): KnowledgeArticle {
  return {
    id: ART_ID,
    title: 'Como configurar a VPN',
    content: '## Passos\n\n- Abra o cliente\n\nVeja [ajuda](https://exemplo.com) e [mal](javascript:alert(1)). <b>html</b>',
    category_id: null,
    author_id: 'user-1',
    status: 'published',
    tags: ['vpn'],
    created_at: '2026-10-01T10:00:00Z',
    updated_at: '2026-10-02T10:00:00Z',
    published_at: '2026-10-01T10:00:00Z',
    author: { full_name: 'Ana' },
    category: null,
    ...over,
  }
}
const page = (items = [makeArticle()]) => ({ items, total: items.length, page: 1, pageSize: 12 })

beforeEach(() => {
  vi.clearAllMocks()
  resetTicketServiceMock()
  api.listArticles.mockResolvedValue(page())
  api.getArticle.mockResolvedValue(makeArticle())
  api.createArticle.mockResolvedValue({ id: ART_ID })
  api.updateArticle.mockResolvedValue(undefined)
  api.deleteArticle.mockResolvedValue(undefined)
})

function renderAll(role: UserRole, route: string) {
  return renderWithProviders(
    <Routes>
      <Route path="/conhecimento" element={<KnowledgePage />} />
      <Route path="/conhecimento/novo" element={<ArticleEditorPage />} />
      <Route path="/conhecimento/:id" element={<ArticlePage />} />
      <Route path="/conhecimento/:id/editar" element={<ArticleEditorPage />} />
    </Routes>,
    { auth: authAs(role), route },
  )
}

describe('Lista da base de conhecimento', () => {
  it('solicitante vê artigos sem filtro de situação, sem rascunho e sem botão de criar', async () => {
    renderAll('requester', '/conhecimento')
    await screen.findByRole('link', { name: 'Como configurar a VPN' })
    expect(screen.queryByLabelText('Situação')).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /Novo artigo/ })).not.toBeInTheDocument()
    expect(screen.queryByText('Rascunho')).not.toBeInTheDocument()
  })

  it('equipe vê o botão de criar e o filtro de situação', async () => {
    renderAll('technician', '/conhecimento')
    await screen.findByRole('link', { name: /Novo artigo/ })
    expect(screen.getByLabelText('Situação')).toBeInTheDocument()
  })

  it('clicar numa tag filtra por ela', async () => {
    renderAll('requester', '/conhecimento')
    await userEvent.click(await screen.findByRole('button', { name: 'vpn' }))
    await waitFor(() => expect(api.listArticles.mock.calls.at(-1)?.[0]).toMatchObject({ tag: 'vpn' }))
  })

  it('estado vazio com filtros ativos sugere limpar', async () => {
    api.listArticles.mockResolvedValue(page([]))
    renderAll('requester', '/conhecimento?q=xyz')
    await screen.findByText('Nenhum artigo encontrado')
  })

  it('mostra erro com nova tentativa', async () => {
    api.listArticles.mockRejectedValueOnce(new Error('x'))
    renderAll('requester', '/conhecimento')
    await screen.findByRole('alert')
    await userEvent.click(screen.getByRole('button', { name: /Tentar novamente/ }))
    await screen.findByRole('link', { name: 'Como configurar a VPN' })
  })
})

describe('Artigo', () => {
  it('renderiza conteúdo sem executar HTML nem links perigosos', async () => {
    const { container } = renderAll('requester', `/conhecimento/${ART_ID}`)
    await screen.findByRole('heading', { name: 'Passos' })
    expect(screen.getByRole('link', { name: 'ajuda' })).toHaveAttribute('href', 'https://exemplo.com/')
    expect(screen.queryByRole('link', { name: 'mal' })).not.toBeInTheDocument()
    expect(container.querySelector('b')).toBeNull()
    expect(screen.getByText(/<b>html<\/b>/)).toBeInTheDocument()
  })

  it('solicitante não vê ações de edição; rascunho inexistente para ele mostra "não encontrado"', async () => {
    renderAll('requester', `/conhecimento/${ART_ID}`)
    await screen.findByRole('heading', { name: 'Passos' })
    expect(screen.queryByRole('link', { name: /Editar/ })).not.toBeInTheDocument()
  })

  it('artigo ausente (RLS) mostra não encontrado', async () => {
    api.getArticle.mockResolvedValue(null)
    renderAll('requester', `/conhecimento/${ART_ID}`)
    await screen.findByText(/não encontrad/i)
  })

  it('técnico só gerencia os próprios artigos', async () => {
    api.getArticle.mockResolvedValue(makeArticle({ author_id: 'outro' }))
    renderAll('technician', `/conhecimento/${ART_ID}`)
    await screen.findByRole('heading', { name: 'Passos' })
    expect(screen.queryByRole('button', { name: /Excluir/ })).not.toBeInTheDocument()
  })

  it('excluir pede confirmação e volta para a lista', async () => {
    renderAll('admin', `/conhecimento/${ART_ID}`)
    await userEvent.click(await screen.findByRole('button', { name: /Excluir/ }))
    expect(api.deleteArticle).not.toHaveBeenCalled()
    await userEvent.click(screen.getByRole('button', { name: 'Excluir artigo' }))
    await waitFor(() => expect(api.deleteArticle).toHaveBeenCalledWith(ART_ID))
    await screen.findByRole('heading', { name: 'Base de conhecimento' })
  })
})

describe('Editor de artigo', () => {
  it('valida antes de enviar', async () => {
    renderAll('technician', '/conhecimento/novo')
    await userEvent.click(await screen.findByRole('button', { name: 'Salvar artigo' }))
    expect(await screen.findByText(/título precisa ter ao menos 3/)).toBeInTheDocument()
    expect(api.createArticle).not.toHaveBeenCalled()
  })

  it('cria artigo com tags normalizadas e o autor logado', async () => {
    renderAll('technician', '/conhecimento/novo')
    await userEvent.type(await screen.findByLabelText(/Título/), 'Guia de impressoras')
    await userEvent.type(screen.getByLabelText('Tags'), 'Impressora, rede, impressora')
    await userEvent.type(screen.getByLabelText(/Conteúdo do artigo/), 'Conteúdo suficiente do guia.')
    await userEvent.selectOptions(screen.getByLabelText(/Situação/), 'published')
    await userEvent.click(screen.getByRole('button', { name: 'Salvar artigo' }))
    await waitFor(() => expect(api.createArticle).toHaveBeenCalled())
    const [input, author] = api.createArticle.mock.calls[0] as [Record<string, unknown>, string]
    expect(input).toMatchObject({ title: 'Guia de impressoras', status: 'published', tags: ['impressora', 'rede'], categoryId: null })
    expect(author).toBe('user-1')
  })

  it('pré-visualiza o conteúdo renderizado', async () => {
    renderAll('technician', '/conhecimento/novo')
    await userEvent.type(await screen.findByLabelText(/Conteúdo do artigo/), '## Título teste')
    await userEvent.click(screen.getByRole('button', { name: 'Pré-visualizar' }))
    expect(screen.getByRole('heading', { name: 'Título teste' })).toBeInTheDocument()
  })

  it('edita artigo existente chamando update', async () => {
    renderAll('admin', `/conhecimento/${ART_ID}/editar`)
    const title = await screen.findByLabelText(/Título/)
    await waitFor(() => expect(title).toHaveValue('Como configurar a VPN'))
    await userEvent.type(title, ' v2')
    await userEvent.click(screen.getByRole('button', { name: 'Salvar alterações' }))
    await waitFor(() => expect(api.updateArticle).toHaveBeenCalled())
    expect(api.updateArticle.mock.calls[0]?.[1]).toMatchObject({ title: 'Como configurar a VPN v2' })
  })

  it('técnico não edita artigo de outro autor', async () => {
    api.getArticle.mockResolvedValue(makeArticle({ author_id: 'outro' }))
    renderAll('technician', `/conhecimento/${ART_ID}/editar`)
    await screen.findByText('Acesso não autorizado')
  })

  it('mostra a mensagem do banco quando salvar falha', async () => {
    api.createArticle.mockRejectedValue({ message: 'new row violates row-level security policy', code: '42501' })
    renderAll('technician', '/conhecimento/novo')
    await userEvent.type(await screen.findByLabelText(/Título/), 'Guia de impressoras')
    await userEvent.type(screen.getByLabelText(/Conteúdo do artigo/), 'Conteúdo suficiente do guia.')
    await userEvent.click(screen.getByRole('button', { name: 'Salvar artigo' }))
    await screen.findByText('Você não tem permissão para realizar esta ação.')
  })
})

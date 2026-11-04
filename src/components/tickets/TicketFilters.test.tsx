import { describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TicketFilters } from '@/components/tickets/TicketFilters'
import { DEFAULT_FILTERS, type TicketFilters as Filters } from '@/lib/ticketFilters'

const categories = [
  { id: 'c1', name: 'Hardware', description: null, is_active: true, created_at: '', updated_at: '' },
  { id: 'c2', name: 'Legado', description: null, is_active: false, created_at: '', updated_at: '' },
]

function setup(filters: Partial<Filters> = {}, props: Partial<Parameters<typeof TicketFilters>[0]> = {}) {
  const onChange = vi.fn()
  const onClear = vi.fn()
  render(<TicketFilters filters={{ ...DEFAULT_FILTERS, ...filters }} onChange={onChange} onClear={onClear} categories={categories} {...props} />)
  return { onChange, onClear }
}

describe('TicketFilters', () => {
  it('seleções chamam onChange com o valor escolhido', async () => {
    const { onChange } = setup()
    await userEvent.selectOptions(screen.getByLabelText('Status'), 'resolved')
    expect(onChange).toHaveBeenLastCalledWith({ status: 'resolved' })
    await userEvent.selectOptions(screen.getByLabelText('Prioridade'), 'critical')
    expect(onChange).toHaveBeenLastCalledWith({ priority: 'critical' })
    await userEvent.selectOptions(screen.getByLabelText('Categoria'), 'c1')
    expect(onChange).toHaveBeenLastCalledWith({ category: 'c1' })
  })

  it('categorias inativas continuam filtráveis e são identificadas', () => {
    setup()
    expect(screen.getByRole('option', { name: 'Legado (inativa)' })).toBeInTheDocument()
  })

  it('período por datas', async () => {
    const { onChange } = setup()
    await userEvent.type(screen.getByLabelText('Aberto de'), '2026-03-01')
    expect(onChange).toHaveBeenLastCalledWith({ from: '2026-03-01' })
  })

  it('busca só dispara após a pausa na digitação', async () => {
    const { onChange } = setup()
    await userEvent.type(screen.getByLabelText('Buscar'), 'rede')
    expect(onChange).not.toHaveBeenCalled()
    await waitFor(() => expect(onChange).toHaveBeenCalledTimes(1), { timeout: 2000 })
    expect(onChange).toHaveBeenCalledWith({ search: 'rede' })
  })

  it('filtro por responsável aparece só quando a lista da equipe é fornecida', () => {
    setup()
    expect(screen.queryByLabelText('Responsável')).not.toBeInTheDocument()
  })

  it('com equipe, oferece "Atribuídos a mim", "Sem responsável" e cada técnico', () => {
    setup({}, { staff: [{ id: 't1', full_name: 'Tiago' }] })
    const select = screen.getByLabelText('Responsável')
    expect(select).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Atribuídos a mim' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Sem responsável' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Tiago' })).toBeInTheDocument()
  })

  it('botão limpar só existe com filtros ativos e limpa também a busca digitada', async () => {
    const { onClear } = setup({ status: 'open', search: 'wifi' })
    expect(screen.getByLabelText('Buscar')).toHaveValue('wifi')
    await userEvent.click(screen.getByRole('button', { name: 'Limpar filtros' }))
    expect(onClear).toHaveBeenCalledOnce()
    expect(screen.getByLabelText('Buscar')).toHaveValue('')
  })

  it('sem filtros ativos não mostra o botão limpar', () => {
    setup()
    expect(screen.queryByRole('button', { name: 'Limpar filtros' })).not.toBeInTheDocument()
  })
})

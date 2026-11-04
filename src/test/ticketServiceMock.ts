import { vi } from 'vitest'
import { CATEGORY_ID } from '@/test/fixtures'

// Substituto de '@/services/tickets' para testes de interface (sem rede nem Supabase).
export const ticketServiceMock = {
  ATTACHMENTS_BUCKET: 'ticket-attachments',
  listTickets: vi.fn(),
  countTickets: vi.fn(),
  getTicket: vi.fn(),
  createTicket: vi.fn(),
  updateTicket: vi.fn(),
  listCategories: vi.fn(),
  listStaff: vi.fn(),
  listComments: vi.fn(),
  addComment: vi.fn(),
  listHistory: vi.fn(),
  listAttachments: vi.fn(),
  uploadAttachment: vi.fn(),
  uploadAttachments: vi.fn(),
  getAttachmentUrl: vi.fn(),
  deleteAttachment: vi.fn(),
}

export function resetTicketServiceMock() {
  for (const fn of Object.values(ticketServiceMock)) if (typeof fn === 'function') fn.mockReset()
  ticketServiceMock.listCategories.mockResolvedValue([
    { id: CATEGORY_ID, name: 'Software', description: null, is_active: true, created_at: '', updated_at: '' },
  ])
  ticketServiceMock.countTickets.mockResolvedValue(0)
  ticketServiceMock.listStaff.mockResolvedValue([])
  ticketServiceMock.listComments.mockResolvedValue([])
  ticketServiceMock.listHistory.mockResolvedValue([])
  ticketServiceMock.listAttachments.mockResolvedValue([])
  ticketServiceMock.updateTicket.mockResolvedValue(undefined)
  ticketServiceMock.addComment.mockResolvedValue(undefined)
}

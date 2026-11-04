import { describe, expect, it, vi } from 'vitest'
import { useState } from 'react'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AttachmentPicker } from '@/components/tickets/AttachmentPicker'
import { MAX_ATTACHMENT_BYTES, MAX_ATTACHMENTS_PER_UPLOAD } from '@/lib/attachments'

function Harness({ onChange }: { onChange?: (f: File[]) => void }) {
  const [files, setFiles] = useState<File[]>([])
  return (
    <AttachmentPicker
      files={files}
      onChange={(f) => {
        setFiles(f)
        onChange?.(f)
      }}
    />
  )
}

const user = () => userEvent.setup({ applyAccept: false })
const file = (name: string, type: string, size = 10) => {
  const f = new File(['x'], name, { type })
  Object.defineProperty(f, 'size', { value: size })
  return f
}

describe('AttachmentPicker', () => {
  it('lista arquivos válidos e permite removê-los', async () => {
    const u = user()
    render(<Harness />)
    await u.upload(screen.getByLabelText('Anexos'), file('print.png', 'image/png', 2048))
    expect(screen.getByText('print.png')).toBeInTheDocument()
    expect(screen.getByText('2,0 KB')).toBeInTheDocument()
    await u.click(screen.getByRole('button', { name: 'Remover print.png' }))
    expect(screen.queryByText('print.png')).not.toBeInTheDocument()
  })

  it('rejeita tipo não permitido com mensagem clara e não adiciona o arquivo', async () => {
    const onChange = vi.fn()
    render(<Harness onChange={onChange} />)
    await user().upload(screen.getByLabelText('Anexos'), file('instalador.exe', 'application/x-msdownload'))
    expect(screen.getByRole('alert')).toHaveTextContent('tipo de arquivo não permitido')
    expect(onChange).not.toHaveBeenCalled()
  })

  it('rejeita arquivo acima do limite', async () => {
    render(<Harness />)
    await user().upload(screen.getByLabelText('Anexos'), file('enorme.pdf', 'application/pdf', MAX_ATTACHMENT_BYTES + 1))
    expect(screen.getByRole('alert')).toHaveTextContent('excede o limite')
  })

  it('aceita os válidos e reporta os inválidos na mesma seleção', async () => {
    render(<Harness />)
    await user().upload(screen.getByLabelText('Anexos'), [file('ok.pdf', 'application/pdf'), file('ruim.html', 'text/html')])
    expect(screen.getByText('ok.pdf')).toBeInTheDocument()
    expect(screen.queryByText('ruim.html')).not.toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent('ruim.html')
  })

  it('limita a quantidade de arquivos', async () => {
    render(<Harness />)
    const many = Array.from({ length: MAX_ATTACHMENTS_PER_UPLOAD + 1 }, (_, i) => file(`f${i}.png`, 'image/png'))
    await user().upload(screen.getByLabelText('Anexos'), many)
    const selected = screen.getByRole('list', { name: 'Arquivos selecionados' })
    expect(within(selected).getAllByRole('listitem')).toHaveLength(MAX_ATTACHMENTS_PER_UPLOAD)
    expect(screen.getByRole('alert')).toHaveTextContent(`Limite de ${MAX_ATTACHMENTS_PER_UPLOAD} arquivos`)
    expect(screen.getByLabelText('Anexos')).toBeDisabled()
  })
})

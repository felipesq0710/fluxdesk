import { fireEvent, render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { describe, expect, it } from 'vitest'
import { Avatar } from '@/components/ui/Avatar'

function renderAvatar(props: React.ComponentProps<typeof Avatar>) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={queryClient}><Avatar {...props} /></QueryClientProvider>)
}

describe('Avatar', () => {
  it('usa as iniciais quando a imagem não consegue carregar', () => {
    renderAvatar({ name: 'Felipe Schneider', imageUrl: 'https://example.test/avatar' })
    fireEvent.error(document.querySelector('img')!)
    expect(screen.getByText('FS')).toBeInTheDocument()
  })

  it('usa as iniciais quando não há avatar cadastrado', () => {
    renderAvatar({ name: 'Felipe Schneider', imageUrl: null })
    expect(screen.getByText('FS')).toBeInTheDocument()
  })
})

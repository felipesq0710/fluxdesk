import { useCallback, useState } from 'react'
import { Outlet } from 'react-router-dom'
import { Header } from '@/components/layout/Header'
import { MobileNav } from '@/components/layout/MobileNav'
import { Sidebar } from '@/components/layout/Sidebar'
import { useProfile } from '@/hooks/useAuth'

export default function AppLayout() {
  const profile = useProfile()
  const [menuOpen, setMenuOpen] = useState(false)
  const closeMenu = useCallback(() => setMenuOpen(false), [])

  return (
    <div className="min-h-screen lg:pl-60">
      <a
        href="#conteudo"
        className="sr-only z-50 rounded-control bg-brand px-4 py-2 text-sm font-medium text-white focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
      >
        Ir para o conteúdo
      </a>

      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 border-r border-line lg:block dark:border-white/[0.06]">
        <Sidebar role={profile.role} />
      </aside>

      <MobileNav open={menuOpen} onClose={closeMenu} role={profile.role} />
      <Header onOpenMenu={() => setMenuOpen(true)} />

      <main id="conteudo" tabIndex={-1} className="mx-auto max-w-[112rem] px-4 pb-16 pt-6 outline-none sm:px-6 lg:px-8 lg:pt-8 2xl:px-10">
        <Outlet />
      </main>
    </div>
  )
}

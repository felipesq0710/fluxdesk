import { createBrowserRouter, type RouteObject } from 'react-router-dom'
import { FullPageLoader } from '@/components/feedback/FullPageLoader'
import { ADMIN_ROLES, STAFF_ROLES } from '@/lib/permissions'
import NotFoundPage from '@/pages/NotFoundPage'
import RouteErrorPage from '@/pages/RouteErrorPage'
import { PublicOnly, RequireAuth, RequireRole } from '@/routes/guards'

function page(loader: () => Promise<{ default: React.ComponentType }>): Pick<RouteObject, 'lazy'> {
  return { lazy: async () => ({ Component: (await loader()).default }) }
}

export const routes: RouteObject[] = [
  {
    HydrateFallback: FullPageLoader,
    errorElement: <RouteErrorPage />,
    children: [
      {
        element: <PublicOnly />,
        children: [
          { path: '/entrar', ...page(() => import('@/pages/auth/LoginPage')) },
          { path: '/cadastro', ...page(() => import('@/pages/auth/RegisterPage')) },
          { path: '/recuperar-senha', ...page(() => import('@/pages/auth/ForgotPasswordPage')) },
        ],
      },
      // A redefinição usa a sessão de recuperação criada pelo link do e-mail.
      { path: '/redefinir-senha', ...page(() => import('@/pages/auth/ResetPasswordPage')) },
      {
        element: <RequireAuth />,
        children: [
          {
            lazy: async () => ({ Component: (await import('@/layouts/AppLayout')).default }),
            children: [
              { index: true, ...page(() => import('@/pages/reports/DashboardPage')) },
              { path: 'chamados', ...page(() => import('@/pages/tickets/TicketsPage')) },
              { path: 'chamados/novo', ...page(() => import('@/pages/tickets/NewTicketPage')) },
              { path: 'chamados/:id', ...page(() => import('@/pages/tickets/TicketDetailPage')) },
              { path: 'conhecimento', ...page(() => import('@/pages/knowledge/KnowledgePage')) },
              { path: 'conhecimento/:id', ...page(() => import('@/pages/knowledge/ArticlePage')) },
              { path: 'notificacoes', ...page(() => import('@/pages/NotificationsPage')) },
              { path: 'configuracoes', ...page(() => import('@/pages/SettingsPage')) },
              {
                element: <RequireRole roles={STAFF_ROLES} />,
                children: [
                  { path: 'conhecimento/novo', ...page(() => import('@/pages/knowledge/ArticleEditorPage')) },
                  { path: 'conhecimento/:id/editar', ...page(() => import('@/pages/knowledge/ArticleEditorPage')) },
                  { path: 'minha-fila', ...page(() => import('@/pages/tickets/QueuePage')) },
                  { path: 'relatorios', ...page(() => import('@/pages/reports/ReportsPage')) },
                ],
              },
              {
                element: <RequireRole roles={ADMIN_ROLES} />,
                children: [
                  { path: 'usuarios', ...page(() => import('@/pages/admin/UsersPage')) },
                  { path: 'categorias', ...page(() => import('@/pages/admin/CategoriesPage')) },
                ],
              },
              { path: '*', ...page(() => import('@/pages/NotFoundContent')) },
            ],
          },
        ],
      },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]

export const router = createBrowserRouter(routes)

import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Search, Users } from 'lucide-react'
import { toast } from 'sonner'
import { EmptyState } from '@/components/feedback/EmptyState'
import { ErrorState } from '@/components/feedback/ErrorState'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { Pagination } from '@/components/ui/Pagination'
import { SelectField } from '@/components/ui/SelectField'
import { Spinner } from '@/components/ui/Spinner'
import { useUserMutations, useUsers, useUserStats } from '@/hooks/useAdmin'
import { useProfile } from '@/hooks/useAuth'
import { ROLES, ROLE_LABEL } from '@/lib/constants'
import { dbErrorMessage } from '@/lib/errors'
import { formatDate } from '@/lib/format'
import { parseUserFilters, userFiltersToParams } from '@/lib/userFilters'
import type { UserFilters } from '@/services/profiles'
import type { Profile, UserRole } from '@/types/domain'

type Pending = { kind: 'role'; user: Profile; role: UserRole } | { kind: 'active'; user: Profile; active: boolean }

export default function UsersPage() {
  const me = useProfile()
  const [params, setParams] = useSearchParams()
  const filters = parseUserFilters(params)
  const users = useUsers(filters)
  const stats = useUserStats()
  const { changeRole, setActive } = useUserMutations()
  const [pending, setPending] = useState<Pending | null>(null)
  const [text, setText] = useState(filters.search)
  const lastSent = useRef(filters.search)

  const update = (patch: Partial<UserFilters>) => setParams(userFiltersToParams({ ...filters, page: 1, ...patch }), { replace: true })

  useEffect(() => {
    const value = text.trim()
    if (value === filters.search) return
    const t = window.setTimeout(() => {
      lastSent.current = value
      update({ search: value })
    }, 350)
    return () => window.clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text])
  useEffect(() => {
    if (filters.search !== lastSent.current) {
      lastSent.current = filters.search
      setText(filters.search)
    }
  }, [filters.search])

  const busy = changeRole.isPending || setActive.isPending

  async function confirm() {
    if (!pending) return
    try {
      if (pending.kind === 'role') {
        await changeRole.mutateAsync({ id: pending.user.id, role: pending.role })
        toast.success(`Perfil de ${pending.user.full_name} alterado para ${ROLE_LABEL[pending.role]}.`)
      } else {
        await setActive.mutateAsync({ id: pending.user.id, active: pending.active })
        toast.success(pending.active ? `${pending.user.full_name} foi reativado.` : `${pending.user.full_name} foi desativado.`)
      }
    } catch (error) {
      toast.error(dbErrorMessage(error))
    } finally {
      setPending(null)
    }
  }

  function describe(p: Pending): { title: string; description: string; label: string; destructive: boolean } {
    if (p.kind === 'role') {
      return {
        title: 'Alterar perfil de acesso?',
        description: `${p.user.full_name} passará de ${ROLE_LABEL[p.user.role]} para ${ROLE_LABEL[p.role]}. As permissões mudam imediatamente.`,
        label: 'Alterar perfil',
        destructive: false,
      }
    }
    const open = stats.data?.[p.user.id]?.assigned_open ?? 0
    return p.active
      ? { title: 'Reativar usuário?', description: `${p.user.full_name} voltará a acessar o sistema.`, label: 'Reativar', destructive: false }
      : {
          title: 'Desativar usuário?',
          description: `${p.user.full_name} perderá o acesso imediatamente.${open > 0 ? ` Há ${open} chamado${open > 1 ? 's' : ''} em aberto atribuído${open > 1 ? 's' : ''} a esta pessoa; eles continuam atribuídos até serem reatribuídos.` : ''}`,
          label: 'Desativar',
          destructive: true,
        }
  }

  const data = users.data

  return (
    <div className="space-y-4">
      <div>
        <h1 className="page-title">Usuários</h1>
        <p className="page-lead">Gerencie perfis de acesso e o estado das contas. Contas são criadas pelo cadastro.</p>
      </div>

      <section aria-label="Filtros de usuários" className="card p-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <label htmlFor="user-search" className="field-label">
              Buscar
            </label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-muted" aria-hidden="true" />
              <input id="user-search" type="search" className="field-input pl-9" maxLength={100} autoComplete="off" placeholder="Nome ou e-mail" value={text} onChange={(e) => setText(e.target.value)} />
            </div>
          </div>
          <SelectField label="Perfil" value={filters.role} onChange={(e) => update({ role: e.target.value as UserFilters['role'] })}>
            <option value="">Todos</option>
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABEL[r]}
              </option>
            ))}
          </SelectField>
          <SelectField label="Situação" value={filters.status} onChange={(e) => update({ status: e.target.value as UserFilters['status'] })}>
            <option value="">Todas</option>
            <option value="active">Ativos</option>
            <option value="inactive">Desativados</option>
          </SelectField>
        </div>
      </section>

      {users.isPending ? (
        <div role="status" className="card flex items-center justify-center gap-2 py-16 text-sm text-fg-muted">
          <Spinner /> Carregando usuários…
        </div>
      ) : users.isError ? (
        <ErrorState title="Não foi possível carregar os usuários" message={dbErrorMessage(users.error)} onRetry={() => void users.refetch()} />
      ) : data && data.items.length === 0 ? (
        <div className="card">
          <EmptyState icon={Users} title="Nenhum usuário encontrado" description="Ajuste os filtros para ver outros resultados." />
        </div>
      ) : (
        data && (
          <div className="card overflow-x-auto">
            <table className="stack-table w-full text-sm lg:min-w-[56rem]">
              <caption className="sr-only">Usuários do sistema</caption>
              <thead>
                <tr className="border-b border-line text-left text-xs text-fg-muted">
                  <th scope="col" className="px-4 py-3 font-medium">Usuário</th>
                  <th scope="col" className="px-4 py-3 font-medium">Perfil</th>
                  <th scope="col" className="px-4 py-3 font-medium">Situação</th>
                  <th scope="col" className="px-4 py-3 text-right font-medium">Abertos por ele</th>
                  <th scope="col" className="px-4 py-3 text-right font-medium">Atribuídos (em aberto)</th>
                  <th scope="col" className="px-4 py-3 font-medium">Desde</th>
                  <th scope="col" className="px-4 py-3 font-medium"><span className="sr-only">Ações</span></th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((u) => {
                  const self = u.id === me.id
                  const st = stats.data?.[u.id]
                  return (
                    <tr key={u.id} className="border-b border-line/60 last:border-0">
                      <th scope="row" className="px-4 py-3 text-left font-normal">
                        <span className="block font-medium text-fg">{u.full_name}{self && <span className="ml-1 text-xs text-fg-muted">(você)</span>}</span>
                        <span className="block text-xs text-fg-muted">{u.email}</span>
                      </th>
                      <td data-label="Perfil" className="px-4 py-3">
                        <SelectField
                          label={`Perfil de ${u.full_name}`}
                          hideLabel
                          value={u.role}
                          disabled={self || busy}
                          title={self ? 'Você não pode alterar o próprio perfil.' : undefined}
                          onChange={(e) => setPending({ kind: 'role', user: u, role: e.target.value as UserRole })}
                        >
                          {ROLES.map((r) => (
                            <option key={r} value={r}>
                              {ROLE_LABEL[r]}
                            </option>
                          ))}
                        </SelectField>
                      </td>
                      <td data-label="Situação" className="px-4 py-3">
                        <span className={u.is_active ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'}>{u.is_active ? 'Ativo' : 'Desativado'}</span>
                      </td>
                      <td data-label="Abertos por ele" className="px-4 py-3 text-right tabular-nums">{st ? st.requested : '—'}</td>
                      <td data-label="Atribuídos (em aberto)" className="px-4 py-3 text-right tabular-nums">{st ? `${st.assigned} (${st.assigned_open})` : '—'}</td>
                      <td data-label="Desde" className="px-4 py-3 text-fg-muted">{formatDate(u.created_at)}</td>
                      <td className="px-4 py-3 text-right max-lg:pt-2">
                        <button
                          type="button"
                          className="btn-secondary btn-sm"
                          disabled={self || busy}
                          title={self ? 'Você não pode desativar a própria conta.' : undefined}
                          onClick={() => setPending({ kind: 'active', user: u, active: !u.is_active })}
                        >
                          {u.is_active ? 'Desativar' : 'Reativar'}
                          <span className="sr-only"> {u.full_name}</span>
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            <Pagination page={data.page} pageSize={data.pageSize} total={data.total} onPageChange={(page) => update({ page })} disabled={users.isFetching} />
          </div>
        )
      )}

      {pending && (
        <ConfirmDialog
          open
          pending={busy}
          title={describe(pending).title}
          description={describe(pending).description}
          confirmLabel={describe(pending).label}
          destructive={describe(pending).destructive}
          onConfirm={() => void confirm()}
          onCancel={() => setPending(null)}
        />
      )}
    </div>
  )
}

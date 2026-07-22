import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import { Loader2, Download, RefreshCw } from 'lucide-react'
import * as invitesService from '../../services/invitesService'

const ghostBtn =
  'inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-accent disabled:opacity-60'
const selectCls = 'rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground'

const RSVP_STATE_LABEL = { confirmed: 'Confirmado', waitlisted: 'Lista de espera', declined: 'Não vai', pending: 'Pendente' }
const RSVP_BADGE = {
  confirmed: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-400',
  waitlisted: 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-400',
  declined: 'bg-red-100 text-red-800 dark:bg-red-500/15 dark:text-red-400',
  pending: 'bg-muted text-muted-foreground',
}
const PAY_LABEL = {
  pending: 'Pendente',
  awaiting_validation: 'Em validação',
  paid: 'Pago',
  failed: 'Falhado',
  expired: 'Expirado',
  cancelled: 'Cancelado',
}

// Data + hora (para a lista e o Excel).
function fmtDateTime(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleString('pt-PT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function payLabel(state) {
  if (!state || state === 'not_applicable') return ''
  return PAY_LABEL[state] || state
}

// Vista GLOBAL das inscrições de TODOS os convites. Agrega os convidados de cada
// convite (não há endpoint agregado — carrega convite a convite) e mostra as
// colunas comuns + exportação para Excel. Para o detalhe das respostas do
// formulário, abre-se o convite na aba "Convites".
export default function InviteSubmissionsAdmin() {
  const [rows, setRows] = useState(null)
  const [invites, setInvites] = useState([])
  const [filterInvite, setFilterInvite] = useState('')
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const invs = await invitesService.listInvites()
      setInvites(invs)
      const perInvite = await Promise.all(
        invs.map(async (inv) => {
          try {
            const guests = await invitesService.listInviteGuests(inv.id)
            return guests.map((g) => ({ ...g, inviteId: inv.id, inviteTitle: inv.title }))
          } catch {
            return []
          }
        })
      )
      const all = perInvite.flat()
      all.sort((a, b) => new Date(b.respondedAt || b.createdAt || 0) - new Date(a.respondedAt || a.createdAt || 0))
      setRows(all)
    } catch (err) {
      toast.error(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load()
  }, [load])

  const filtered = filterInvite ? (rows || []).filter((r) => r.inviteId === filterInvite) : rows || []

  // Exporta para CSV (abre no Excel): BOM UTF-8 + separador ';'.
  const exportRows = () => {
    if (!filtered.length) return
    const cols = [
      ['Convite', (g) => g.inviteTitle || ''],
      ['Nome', (g) => g.name || ''],
      ['Email', (g) => g.email || ''],
      ['Telemóvel', (g) => g.phone || ''],
      ['Estado', (g) => RSVP_STATE_LABEL[g.rsvpState] || g.rsvpState || ''],
      ['Pagamento', (g) => payLabel(g.paymentState)],
      ['Lugares', (g) => g.guestsCount ?? ''],
      ['Data de inscrição', (g) => fmtDateTime(g.respondedAt || g.createdAt)],
    ]
    const cell = (v) => {
      const s = String(v ?? '')
      return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
    }
    const lines = [cols.map((c) => cell(c[0])).join(';')]
    for (const g of filtered) lines.push(cols.map((c) => cell(c[1](g))).join(';'))
    const csv = '\uFEFF' + lines.join('\r\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'inscricoes-todos-os-convites.csv'
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }

  if (loading) {
    return <p className="py-8 text-center text-sm text-muted-foreground">A carregar…</p>
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="m-0 text-sm text-muted-foreground">
          {filtered.length} inscriç{filtered.length === 1 ? 'ão' : 'ões'} em {invites.length} convite
          {invites.length === 1 ? '' : 's'}.
        </p>
        <div className="flex flex-shrink-0 flex-wrap items-center gap-2">
          <select
            className={selectCls}
            value={filterInvite}
            onChange={(e) => setFilterInvite(e.target.value)}
            aria-label="Filtrar por convite"
          >
            <option value="">Todos os convites</option>
            {invites.map((inv) => (
              <option key={inv.id} value={inv.id}>
                {inv.title}
              </option>
            ))}
          </select>
          <button type="button" onClick={load} className={ghostBtn}>
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            Atualizar
          </button>
          <button type="button" onClick={exportRows} disabled={!filtered.length} className={ghostBtn}>
            <Download className="h-4 w-4" aria-hidden="true" />
            Exportar Excel
          </button>
        </div>
      </div>

      {!filtered.length ? (
        <p className="py-8 text-center text-sm text-muted-foreground">Ainda não há inscrições.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-left text-xs uppercase text-muted-foreground">
                <th className="p-2 font-semibold">Convite</th>
                <th className="p-2 font-semibold">Nome</th>
                <th className="p-2 font-semibold">Email</th>
                <th className="p-2 font-semibold">Telemóvel</th>
                <th className="p-2 font-semibold">Estado</th>
                <th className="p-2 font-semibold">Pagamento</th>
                <th className="p-2 font-semibold">Lugares</th>
                <th className="p-2 font-semibold">Data</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((g) => (
                <tr key={g.id} className="border-b border-border/60 last:border-0">
                  <td className="p-2 text-foreground">{g.inviteTitle}</td>
                  <td className="p-2 font-medium text-foreground">{g.name || '—'}</td>
                  <td className="p-2 text-muted-foreground">{g.email || ''}</td>
                  <td className="p-2 text-muted-foreground">{g.phone || ''}</td>
                  <td className="p-2">
                    <span className={`rounded-full px-2 py-[3px] text-[11px] font-semibold ${RSVP_BADGE[g.rsvpState] || 'bg-muted text-muted-foreground'}`}>
                      {RSVP_STATE_LABEL[g.rsvpState] || g.rsvpState || '—'}
                    </span>
                  </td>
                  <td className="p-2 text-muted-foreground">{payLabel(g.paymentState) || '—'}</td>
                  <td className="p-2 text-muted-foreground">{g.guestsCount ?? ''}</td>
                  <td className="p-2 text-muted-foreground">{fmtDateTime(g.respondedAt || g.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

import { useState, useEffect, useCallback, Fragment } from 'react'
import { toast } from 'sonner'
import { Download, RefreshCw, Eye, Pencil, Ban, Trash2, Loader2 } from 'lucide-react'
import * as invitesService from '../../services/invitesService'

const ghostBtn =
  'inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-accent disabled:opacity-60'
const iconBtn =
  'inline-flex items-center justify-center rounded-lg border border-border bg-background p-1.5 text-foreground transition-colors hover:bg-accent disabled:opacity-40'
const primaryBtn =
  'inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60'
const selectCls = 'rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground'
const inputCls = 'w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground'
const labelCls = 'flex flex-col gap-1 text-xs font-medium text-muted-foreground'

const RSVP_STATE_LABEL = { confirmed: 'Confirmada', waitlisted: 'Lista de espera', declined: 'Cancelada', pending: 'Pendente' }
const RSVP_BADGE = {
  confirmed: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-400',
  waitlisted: 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-400',
  declined: 'bg-red-100 text-red-800 dark:bg-red-500/15 dark:text-red-400',
  pending: 'bg-muted text-muted-foreground',
}
const RSVP_STATE_OPTIONS = [
  { value: 'confirmed', label: 'Confirmada' },
  { value: 'pending', label: 'Pendente' },
  { value: 'waitlisted', label: 'Lista de espera' },
  { value: 'declined', label: 'Cancelada' },
]
const PAY_LABEL = {
  pending: 'Pendente',
  awaiting_validation: 'Em validação',
  paid: 'Pago',
  failed: 'Falhado',
  expired: 'Expirado',
  cancelled: 'Cancelado',
  not_applicable: 'Sem pagamento',
}
const PAY_STATE_OPTIONS = [
  { value: 'pending', label: 'Pendente de pagamento' },
  { value: 'awaiting_validation', label: 'Em validação' },
  { value: 'paid', label: 'Pago' },
  { value: 'not_applicable', label: 'Sem pagamento' },
]

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

// Formata a resposta de um campo do formulário para leitura.
function formatAnswer(value) {
  if (value == null || value === '') return ''
  if (Array.isArray(value)) {
    return value
      .map((c) =>
        c && typeof c === 'object'
          ? [c.nome, c.idade ? `${c.idade} anos` : '', c.telefone, c.email, c.alergias, c.observacoes].filter(Boolean).join(' – ')
          : String(c)
      )
      .filter(Boolean)
      .join('; ')
  }
  if (typeof value === 'boolean') return value ? 'Sim' : 'Não'
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

// Vista GLOBAL das inscrições de TODOS os convites. Agrega os convidados de cada
// convite (não há endpoint agregado — carrega convite a convite), filtra por
// convite/estado/pagamento, permite ver detalhes, editar, cancelar ou eliminar
// cada inscrição, e exporta para Excel. Só gestores de convites.
export default function InviteSubmissionsAdmin() {
  const [rows, setRows] = useState(null)
  const [invites, setInvites] = useState([])
  const [filterInvite, setFilterInvite] = useState('')
  const [filterState, setFilterState] = useState('')
  const [filterPay, setFilterPay] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [expanded, setExpanded] = useState(null) // { id, mode: 'details' | 'edit' }
  const [editForm, setEditForm] = useState(null) // { name, email, phone, rsvpState }

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

  const filtered = (rows || []).filter((r) => {
    if (filterInvite && r.inviteId !== filterInvite) return false
    if (filterState && (r.rsvpState || 'pending') !== filterState) return false
    if (filterPay && (r.paymentState || 'not_applicable') !== filterPay) return false
    return true
  })

  // Estatísticas do evento selecionado (contam TODAS as inscrições desse convite,
  // independentemente dos filtros de estado/pagamento).
  const eventRows = filterInvite ? (rows || []).filter((r) => r.inviteId === filterInvite) : []
  const eventStats = {
    total: eventRows.length,
    confirmed: eventRows.filter((r) => r.rsvpState === 'confirmed').length,
    pending: eventRows.filter((r) => (r.rsvpState || 'pending') === 'pending').length,
    waitlisted: eventRows.filter((r) => r.rsvpState === 'waitlisted').length,
    declined: eventRows.filter((r) => r.rsvpState === 'declined').length,
  }

  const openDetails = (g) =>
    setExpanded((e) => (e?.id === g.id && e.mode === 'details' ? null : { id: g.id, mode: 'details' }))

  const openEdit = (g) => {
    setEditForm({ name: g.name || '', email: g.email || '', phone: g.phone || '', rsvpState: g.rsvpState || 'pending' })
    setExpanded((e) => (e?.id === g.id && e.mode === 'edit' ? null : { id: g.id, mode: 'edit' }))
  }

  const closePanel = () => {
    setExpanded(null)
    setEditForm(null)
  }

  const saveEdit = async (g) => {
    setBusy(true)
    try {
      await invitesService.updateInviteGuest(g.inviteId, g.id, editForm)
      toast.success('Inscrição atualizada.')
      closePanel()
      await load()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setBusy(false)
    }
  }

  const cancelReg = async (g) => {
    if (g.rsvpState === 'declined') return
    if (!window.confirm(`Cancelar a inscrição de "${g.name || g.email || 'convidado'}"? Deixa de contar como confirmada.`)) return
    setBusy(true)
    try {
      await invitesService.cancelInviteGuest(g.inviteId, g.id)
      toast.success('Inscrição cancelada.')
      await load()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setBusy(false)
    }
  }

  const deleteReg = async (g) => {
    if (!window.confirm(`Eliminar definitivamente a inscrição de "${g.name || g.email || 'convidado'}"? Esta ação é irreversível.`)) return
    setBusy(true)
    try {
      await invitesService.deleteInviteGuest(g.inviteId, g.id)
      toast.success('Inscrição eliminada.')
      closePanel()
      await load()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setBusy(false)
    }
  }

  // Exporta para CSV (abre no Excel): BOM UTF-8 + separador ';'. Respeita os filtros.
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
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-wrap items-end gap-3">
          <label className={labelCls}>
            Convite
            <select className={selectCls} value={filterInvite} onChange={(e) => setFilterInvite(e.target.value)}>
              <option value="">Todos os convites</option>
              {invites.map((inv) => (
                <option key={inv.id} value={inv.id}>
                  {inv.title}
                </option>
              ))}
            </select>
          </label>
          <label className={labelCls}>
            Estado da inscrição
            <select className={selectCls} value={filterState} onChange={(e) => setFilterState(e.target.value)}>
              <option value="">Todos os estados</option>
              {RSVP_STATE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <label className={labelCls}>
            Pagamento
            <select className={selectCls} value={filterPay} onChange={(e) => setFilterPay(e.target.value)}>
              <option value="">Todos os pagamentos</option>
              {PAY_STATE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="flex flex-shrink-0 items-center gap-2">
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

      {filterInvite ? (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
          {[
            { label: 'Inscrições do evento', value: eventStats.total, cls: 'text-foreground' },
            { label: 'Confirmadas', value: eventStats.confirmed, cls: 'text-emerald-700 dark:text-emerald-400' },
            { label: 'Pendentes', value: eventStats.pending, cls: 'text-foreground' },
            { label: 'Lista de espera', value: eventStats.waitlisted, cls: 'text-amber-700 dark:text-amber-400' },
            { label: 'Canceladas', value: eventStats.declined, cls: 'text-red-700 dark:text-red-400' },
          ].map((s) => (
            <div key={s.label} className="rounded-lg border border-border bg-card p-3 text-center">
              <div className={`text-2xl font-bold ${s.cls}`}>{s.value}</div>
              <div className="text-xs text-muted-foreground">{s.label}</div>
            </div>
          ))}
        </div>
      ) : null}

      <p className="m-0 text-sm text-muted-foreground">
        {filtered.length} inscriç{filtered.length === 1 ? 'ão' : 'ões'}
        {filtered.length !== (rows || []).length ? ` (de ${(rows || []).length})` : ''} em {invites.length} convite
        {invites.length === 1 ? '' : 's'}.
      </p>

      {!filtered.length ? (
        <p className="py-8 text-center text-sm text-muted-foreground">Nenhuma inscrição corresponde aos filtros.</p>
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
                <th className="p-2 text-right font-semibold">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((g) => {
                const isOpen = expanded?.id === g.id
                const answers = Object.entries(g.extra || {}).filter(([, v]) => formatAnswer(v) !== '')
                return (
                  <Fragment key={g.id}>
                    <tr className="border-b border-border/60">
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
                      <td className="p-2 whitespace-nowrap text-muted-foreground">{fmtDateTime(g.respondedAt || g.createdAt)}</td>
                      <td className="p-2">
                        <div className="flex items-center justify-end gap-1">
                          <button type="button" onClick={() => openDetails(g)} className={iconBtn} title="Ver mais detalhes" aria-label="Ver mais detalhes">
                            <Eye className="h-4 w-4" aria-hidden="true" />
                          </button>
                          <button type="button" onClick={() => openEdit(g)} className={iconBtn} title="Editar" aria-label="Editar">
                            <Pencil className="h-4 w-4" aria-hidden="true" />
                          </button>
                          <button
                            type="button"
                            onClick={() => cancelReg(g)}
                            disabled={busy || g.rsvpState === 'declined'}
                            className={iconBtn}
                            title="Cancelar inscrição"
                            aria-label="Cancelar inscrição"
                          >
                            <Ban className="h-4 w-4" aria-hidden="true" />
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteReg(g)}
                            disabled={busy}
                            className="inline-flex items-center justify-center rounded-lg border border-destructive/40 bg-transparent p-1.5 text-destructive transition-colors hover:bg-destructive/10 disabled:opacity-40"
                            title="Eliminar inscrição"
                            aria-label="Eliminar inscrição"
                          >
                            <Trash2 className="h-4 w-4" aria-hidden="true" />
                          </button>
                        </div>
                      </td>
                    </tr>

                    {isOpen && expanded.mode === 'details' ? (
                      <tr className="border-b border-border/60 bg-muted/20">
                        <td colSpan={9} className="p-3">
                          <div className="flex flex-col gap-2">
                            <p className="m-0 text-xs font-semibold uppercase text-muted-foreground">Detalhes da inscrição</p>
                            <dl className="grid grid-cols-1 gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
                              <div className="flex gap-2">
                                <dt className="font-medium text-muted-foreground">Convite:</dt>
                                <dd className="text-foreground">{g.inviteTitle}</dd>
                              </div>
                              <div className="flex gap-2">
                                <dt className="font-medium text-muted-foreground">Data de inscrição:</dt>
                                <dd className="text-foreground">{fmtDateTime(g.respondedAt || g.createdAt)}</dd>
                              </div>
                              {answers.length === 0 ? (
                                <div className="text-muted-foreground">Sem respostas adicionais no formulário.</div>
                              ) : (
                                answers.map(([k, v]) => (
                                  <div key={k} className="flex gap-2">
                                    <dt className="font-medium text-muted-foreground">{k}:</dt>
                                    <dd className="text-foreground">{formatAnswer(v)}</dd>
                                  </div>
                                ))
                              )}
                            </dl>
                          </div>
                        </td>
                      </tr>
                    ) : null}

                    {isOpen && expanded.mode === 'edit' && editForm ? (
                      <tr className="border-b border-border/60 bg-muted/20">
                        <td colSpan={9} className="p-3">
                          <div className="flex flex-col gap-3">
                            <p className="m-0 text-xs font-semibold uppercase text-muted-foreground">Editar inscrição</p>
                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                              <label className={labelCls}>
                                Nome
                                <input className={inputCls} value={editForm.name} onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))} />
                              </label>
                              <label className={labelCls}>
                                Email
                                <input className={inputCls} type="email" value={editForm.email} onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))} />
                              </label>
                              <label className={labelCls}>
                                Telemóvel
                                <input className={inputCls} value={editForm.phone} onChange={(e) => setEditForm((f) => ({ ...f, phone: e.target.value }))} />
                              </label>
                              <label className={labelCls}>
                                Estado
                                <select className={inputCls} value={editForm.rsvpState} onChange={(e) => setEditForm((f) => ({ ...f, rsvpState: e.target.value }))}>
                                  {RSVP_STATE_OPTIONS.map((o) => (
                                    <option key={o.value} value={o.value}>
                                      {o.label}
                                    </option>
                                  ))}
                                </select>
                              </label>
                            </div>
                            <div className="flex items-center gap-2">
                              <button type="button" onClick={() => saveEdit(g)} disabled={busy} className={primaryBtn}>
                                {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
                                Guardar
                              </button>
                              <button type="button" onClick={closePanel} disabled={busy} className={ghostBtn}>
                                Cancelar
                              </button>
                            </div>
                          </div>
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

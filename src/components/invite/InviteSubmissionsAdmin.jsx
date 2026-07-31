import { useState, useEffect, useCallback, Fragment } from 'react'
import { toast } from 'sonner'
import { Download, RefreshCw, Eye, Pencil, Ban, Trash2, Loader2, Undo2, StickyNote } from 'lucide-react'
import * as invitesService from '../../services/invitesService'
import { inscricaoSituacao, SITUACAO_LABEL, SITUACAO_BADGE, classifyGuestPeople } from './inviteUtils'

const ghostBtn =
  'inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-accent disabled:opacity-60'
const iconBtn =
  'inline-flex items-center justify-center rounded-lg border border-border bg-background p-1.5 text-foreground transition-colors hover:bg-accent disabled:opacity-40'
const primaryBtn =
  'inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60'
const selectCls = 'rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground'
const inputCls = 'w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground'
const labelCls = 'flex flex-col gap-1 text-xs font-medium text-muted-foreground'

// Estado editável (rsvpState em bruto) do formulário de edição.
const RSVP_STATE_OPTIONS = [
  { value: 'confirmed', label: 'Confirmada' },
  { value: 'pending', label: 'Pendente' },
  { value: 'waitlisted', label: 'Lista de espera' },
  { value: 'declined', label: 'Cancelada' },
]
// Opções do filtro por situação (estado combinado da inscrição).
const SITUACAO_OPTIONS = [
  { value: 'confirmada', label: 'Confirmada' },
  { value: 'comprovativo', label: 'Pendente comprovativo' },
  { value: 'validacao', label: 'Aprovação de comprovativo pendente' },
  { value: 'espera', label: 'Lista de espera' },
  { value: 'cancelada', label: 'Cancelada' },
  { value: 'reembolso', label: 'Reembolso pedido' },
  { value: 'reembolsado', label: 'Reembolsado' },
]
const PAY_LABEL = {
  pending: 'Pendente',
  awaiting_validation: 'Em validação',
  paid: 'Pago',
  failed: 'Falhado',
  expired: 'Expirado',
  cancelled: 'Cancelado',
  refund_requested: 'Reembolso pedido',
  refunded: 'Reembolsado',
  not_applicable: 'Sem pagamento',
}
// Estados de pagamento em que o organizador pode marcar como reembolsado.
const REFUNDABLE_PAY = new Set(['paid', 'awaiting_validation', 'refund_requested'])

// Rótulo curto da composição (ex.: "2A · 1J · 3C").
function peopleLabel(p) {
  if (!p || !p.total) return ''
  const parts = [`${p.adultos}A`]
  if (p.jovens) parts.push(`${p.jovens}J`)
  parts.push(`${p.criancas}C`)
  return parts.join(' · ')
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

// Chaves do `extra` já mostradas em colunas próprias (não repetir em "Respostas").
const DEDICATED_EXTRA_KEYS = new Set(['tipoInscricao', 'membros', 'donationAmount', 'numCriancas'])

// Junta as restantes respostas do formulário (chave: valor) numa só célula do Excel.
function extraAnswersText(g) {
  const extra = g.extra || {}
  return Object.entries(extra)
    .filter(([k, v]) => !DEDICATED_EXTRA_KEYS.has(k) && formatAnswer(v) !== '')
    .map(([k, v]) => `${k}: ${formatAnswer(v)}`)
    .join('; ')
}

// Vista GLOBAL das inscrições de TODOS os convites. Agrega os convidados de cada
// convite (não há endpoint agregado — carrega convite a convite), filtra por
// convite/estado/pagamento, permite ver detalhes, editar, cancelar ou eliminar
// cada inscrição, e exporta para Excel. Só gestores de convites.
export default function InviteSubmissionsAdmin() {
  const [rows, setRows] = useState(null)
  const [invites, setInvites] = useState([])
  const [filterInvite, setFilterInvite] = useState('')
  const [filterChurch, setFilterChurch] = useState('')
  const [filterTicket, setFilterTicket] = useState('')
  const [filterSituacao, setFilterSituacao] = useState('')
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
            return guests.map((g) => ({ ...g, inviteId: inv.id, inviteTitle: inv.title, inviteCommunity: inv.community || null }))
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
    if (filterChurch && (r.inviteCommunity || 'Sem igreja') !== filterChurch) return false
    if (filterTicket && (r.ticket?.name || 'Sem bilhete') !== filterTicket) return false
    if (filterSituacao && inscricaoSituacao(r) !== filterSituacao) return false
    return true
  })

  // Opções de filtro derivadas das inscrições carregadas (igreja = comunidade do
  // convite; bilhete = nome do bilhete escolhido).
  const churchOptions = [...new Set((rows || []).map((r) => r.inviteCommunity || 'Sem igreja'))].sort((a, b) =>
    a.localeCompare(b, 'pt')
  )
  const ticketOptions = [...new Set((rows || []).map((r) => r.ticket?.name || 'Sem bilhete'))].sort((a, b) =>
    a.localeCompare(b, 'pt')
  )

  // Estatísticas do evento selecionado (contam TODAS as inscrições desse convite,
  // por situação, independentemente do filtro de situação).
  const eventRows = filterInvite ? (rows || []).filter((r) => r.inviteId === filterInvite) : []
  const countSit = (key) => eventRows.filter((r) => inscricaoSituacao(r) === key).length
  const eventStats = {
    total: eventRows.length,
    confirmada: countSit('confirmada'),
    comprovativo: countSit('comprovativo'),
    validacao: countSit('validacao'),
    espera: countSit('espera'),
    cancelada: countSit('cancelada'),
    reembolso: countSit('reembolso') + countSit('reembolsado'),
  }

  // Repartição das inscrições visíveis (respeita os filtros ativos). As pessoas
  // (adultos/jovens/crianças) contam apenas inscrições confirmadas (rsvp 'confirmed').
  const people = filtered.reduce(
    (acc, r) => {
      if (r.rsvpState !== 'confirmed') return acc
      const p = classifyGuestPeople(r, r.ticket)
      acc.adultos += p.adultos
      acc.jovens += p.jovens
      acc.criancas += p.criancas
      acc.total += p.total
      return acc
    },
    { adultos: 0, jovens: 0, criancas: 0, total: 0 }
  )
  const groupBy = (keyFn) => {
    const m = new Map()
    for (const r of filtered) {
      const key = keyFn(r)
      const cur = m.get(key) || { name: key, count: 0, pessoas: 0, adultos: 0, criancas: 0 }
      cur.count += 1
      if (r.rsvpState === 'confirmed') {
        const p = classifyGuestPeople(r, r.ticket)
        cur.pessoas += p.total
        cur.adultos += p.adultos
        cur.criancas += p.criancas
      }
      m.set(key, cur)
    }
    return [...m.values()].sort((a, b) => b.count - a.count)
  }
  const byTicket = groupBy((r) => r.ticket?.name || 'Sem bilhete')
  const byChurch = groupBy((r) => r.inviteCommunity || 'Sem igreja')

  const openDetails = (g) =>
    setExpanded((e) => (e?.id === g.id && e.mode === 'details' ? null : { id: g.id, mode: 'details' }))

  const openEdit = (g) => {
    setEditForm({ name: g.name || '', email: g.email || '', phone: g.phone || '', rsvpState: g.rsvpState || 'pending', adminNotes: g.adminNotes || '' })
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

  // Marca a inscrição como reembolsada (cancela a presença + fecha o pagamento).
  const refundReg = async (g) => {
    if (!window.confirm(`Marcar a inscrição de "${g.name || g.email || 'convidado'}" como reembolsada? A presença é cancelada e o lugar libertado.`)) return
    setBusy(true)
    try {
      await invitesService.markInviteGuestRefunded(g.inviteId, g.id)
      toast.success('Inscrição marcada como reembolsada.')
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
      ['Nº do bilhete', (g) => g.code || ''],
      ['Convite', (g) => g.inviteTitle || ''],
      ['Igreja', (g) => g.inviteCommunity || ''],
      ['Bilhete', (g) => g.ticket?.name || ''],
      ['Nome', (g) => g.name || ''],
      ['Email', (g) => g.email || ''],
      ['Telemóvel', (g) => g.phone || ''],
      ['Estado', (g) => SITUACAO_LABEL[inscricaoSituacao(g)] || ''],
      ['Pagamento', (g) => payLabel(g.paymentState)],
      ['Tipo de inscrição', (g) => g.extra?.tipoInscricao || ''],
      ['Adultos', (g) => classifyGuestPeople(g, g.ticket).adultos],
      ['Jovens', (g) => classifyGuestPeople(g, g.ticket).jovens],
      ['Crianças', (g) => classifyGuestPeople(g, g.ticket).criancas],
      ['Membros', (g) => formatAnswer(g.extra?.membros)],
      ['Doação (€)', (g) => (g.extra?.donationAmount != null && g.extra?.donationAmount !== '' ? String(g.extra.donationAmount) : '')],
      ['Lugares', (g) => g.guestsCount ?? ''],
      ['Nº de crianças', (g) => (g.extra?.numCriancas != null ? g.extra.numCriancas : '')],
      ['Data de inscrição', (g) => fmtDateTime(g.respondedAt || g.createdAt)],
      ['Check-in', (g) => (g.checkedInAt ? fmtDateTime(g.checkedInAt) : '')],
      ['Notas internas', (g) => g.adminNotes || ''],
      ['Respostas', (g) => extraAnswersText(g)],
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
            Igreja
            <select className={selectCls} value={filterChurch} onChange={(e) => setFilterChurch(e.target.value)}>
              <option value="">Todas as igrejas</option>
              {churchOptions.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
          <label className={labelCls}>
            Bilhete
            <select className={selectCls} value={filterTicket} onChange={(e) => setFilterTicket(e.target.value)}>
              <option value="">Todos os bilhetes</option>
              {ticketOptions.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>
          <label className={labelCls}>
            Situação da inscrição
            <select className={selectCls} value={filterSituacao} onChange={(e) => setFilterSituacao(e.target.value)}>
              <option value="">Todas as situações</option>
              {SITUACAO_OPTIONS.map((o) => (
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
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-7">
          {[
            { label: 'Inscrições do evento', value: eventStats.total, cls: 'text-foreground' },
            { label: 'Confirmadas', value: eventStats.confirmada, cls: 'text-emerald-700 dark:text-emerald-400' },
            { label: 'Pendente comprovativo', value: eventStats.comprovativo, cls: 'text-amber-700 dark:text-amber-400' },
            { label: 'Aprovação pendente', value: eventStats.validacao, cls: 'text-sky-700 dark:text-sky-400' },
            { label: 'Lista de espera', value: eventStats.espera, cls: 'text-amber-700 dark:text-amber-400' },
            { label: 'Canceladas', value: eventStats.cancelada, cls: 'text-red-700 dark:text-red-400' },
            { label: 'Reembolsos', value: eventStats.reembolso, cls: 'text-orange-700 dark:text-orange-400' },
          ].map((s) => (
            <div key={s.label} className="rounded-lg border border-border bg-card p-3 text-center">
              <div className={`text-2xl font-bold ${s.cls}`}>{s.value}</div>
              <div className="text-xs text-muted-foreground">{s.label}</div>
            </div>
          ))}
        </div>
      ) : null}

      {filtered.length ? (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
          <div className="rounded-lg border border-border bg-card p-3">
            <p className="m-0 mb-2 text-xs font-semibold uppercase text-muted-foreground">Pessoas (confirmadas)</p>
            <div className="flex flex-wrap gap-4">
              <div>
                <span className="text-2xl font-bold text-foreground">{people.adultos}</span>{' '}
                <span className="text-xs text-muted-foreground">adultos</span>
              </div>
              {people.jovens ? (
                <div>
                  <span className="text-2xl font-bold text-foreground">{people.jovens}</span>{' '}
                  <span className="text-xs text-muted-foreground">jovens</span>
                </div>
              ) : null}
              <div>
                <span className="text-2xl font-bold text-foreground">{people.criancas}</span>{' '}
                <span className="text-xs text-muted-foreground">crianças</span>
              </div>
              <div>
                <span className="text-2xl font-bold text-primary">{people.total}</span>{' '}
                <span className="text-xs text-muted-foreground">total</span>
              </div>
            </div>
          </div>
          <div className="rounded-lg border border-border bg-card p-3">
            <p className="m-0 mb-2 text-xs font-semibold uppercase text-muted-foreground">Por bilhete</p>
            {byTicket.length ? (
              <ul className="m-0 flex list-none flex-col gap-1 p-0 text-sm">
                {byTicket.map((t) => (
                  <li key={t.name} className="flex items-center justify-between gap-2">
                    <span className="truncate text-foreground">{t.name}</span>
                    <span className="flex-shrink-0 text-muted-foreground">
                      {t.count} insc.{t.pessoas ? ` · ${t.pessoas} pes. (${t.adultos}A·${t.criancas}C)` : ''}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="m-0 text-sm text-muted-foreground">—</p>
            )}
          </div>
          <div className="rounded-lg border border-border bg-card p-3">
            <p className="m-0 mb-2 text-xs font-semibold uppercase text-muted-foreground">Por igreja</p>
            {byChurch.length ? (
              <ul className="m-0 flex list-none flex-col gap-1 p-0 text-sm">
                {byChurch.map((c) => (
                  <li key={c.name} className="flex items-center justify-between gap-2">
                    <span className="truncate text-foreground">{c.name}</span>
                    <span className="flex-shrink-0 text-muted-foreground">
                      {c.count} insc.{c.pessoas ? ` · ${c.pessoas} pes.` : ''}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="m-0 text-sm text-muted-foreground">—</p>
            )}
          </div>
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
                <th className="p-2 font-semibold">Nº do bilhete</th>
                <th className="p-2 font-semibold">Convite</th>
                <th className="p-2 font-semibold">Bilhete</th>
                <th className="p-2 font-semibold">Nome</th>
                <th className="p-2 font-semibold">Email</th>
                <th className="p-2 font-semibold">Telemóvel</th>
                <th className="p-2 font-semibold">Estado</th>
                <th className="p-2 font-semibold">Pagamento</th>
                <th className="p-2 font-semibold">Pessoas</th>
                <th className="p-2 font-semibold">Data</th>
                <th className="p-2 text-right font-semibold">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((g) => {
                const isOpen = expanded?.id === g.id
                const answers = Object.entries(g.extra || {}).filter(([, v]) => formatAnswer(v) !== '')
                const pr = classifyGuestPeople(g, g.ticket)
                const canRefund = REFUNDABLE_PAY.has(g.paymentState)
                return (
                  <Fragment key={g.id}>
                    <tr className="border-b border-border/60">
                      <td className="p-2 font-mono text-xs font-semibold text-foreground">{g.code || '—'}</td>
                      <td className="p-2 text-foreground">{g.inviteTitle}</td>
                      <td className="p-2 text-muted-foreground">{g.ticket?.name || '—'}</td>
                      <td className="p-2 font-medium text-foreground">
                        <span className="inline-flex items-center gap-1">
                          {g.name || '—'}
                          {g.adminNotes ? <StickyNote className="h-3.5 w-3.5 text-amber-500" aria-label="Tem notas internas" /> : null}
                        </span>
                      </td>
                      <td className="p-2 text-muted-foreground">{g.email || ''}</td>
                      <td className="p-2 text-muted-foreground">{g.phone || ''}</td>
                      <td className="p-2">
                        <span className={`rounded-full px-2 py-[3px] text-[11px] font-semibold ${SITUACAO_BADGE[inscricaoSituacao(g)]}`}>
                          {SITUACAO_LABEL[inscricaoSituacao(g)]}
                        </span>
                      </td>
                      <td className="p-2 text-muted-foreground">{payLabel(g.paymentState) || '—'}</td>
                      <td className="p-2 whitespace-nowrap text-muted-foreground" title={`${pr.total} pessoa(s)`}>
                        <span className="font-semibold text-foreground">{pr.total}</span>
                        {peopleLabel(pr) ? <span className="ml-1 text-xs">({peopleLabel(pr)})</span> : null}
                      </td>
                      <td className="p-2 whitespace-nowrap text-muted-foreground">{fmtDateTime(g.respondedAt || g.createdAt)}</td>
                      <td className="p-2">
                        <div className="flex items-center justify-end gap-1">
                          <button type="button" onClick={() => openDetails(g)} className={iconBtn} title="Ver mais detalhes" aria-label="Ver mais detalhes">
                            <Eye className="h-4 w-4" aria-hidden="true" />
                          </button>
                          <button type="button" onClick={() => openEdit(g)} className={iconBtn} title="Editar / notas" aria-label="Editar">
                            <Pencil className="h-4 w-4" aria-hidden="true" />
                          </button>
                          {canRefund ? (
                            <button
                              type="button"
                              onClick={() => refundReg(g)}
                              disabled={busy}
                              className="inline-flex items-center justify-center rounded-lg border border-orange-300 bg-transparent p-1.5 text-orange-600 transition-colors hover:bg-orange-50 disabled:opacity-40 dark:border-orange-500/40 dark:text-orange-400 dark:hover:bg-orange-500/10"
                              title="Marcar como reembolsada"
                              aria-label="Marcar como reembolsada"
                            >
                              <Undo2 className="h-4 w-4" aria-hidden="true" />
                            </button>
                          ) : null}
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
                        <td colSpan={11} className="p-3">
                          <div className="flex flex-col gap-2">
                            <p className="m-0 text-xs font-semibold uppercase text-muted-foreground">Detalhes da inscrição</p>
                            <dl className="grid grid-cols-1 gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
                              <div className="flex gap-2">
                                <dt className="font-medium text-muted-foreground">Convite:</dt>
                                <dd className="text-foreground">{g.inviteTitle}</dd>
                              </div>
                              <div className="flex gap-2">
                                <dt className="font-medium text-muted-foreground">Igreja:</dt>
                                <dd className="text-foreground">{g.inviteCommunity || 'Sem igreja'}</dd>
                              </div>
                              <div className="flex gap-2">
                                <dt className="font-medium text-muted-foreground">Bilhete:</dt>
                                <dd className="text-foreground">{g.ticket?.name || '—'}</dd>
                              </div>
                              <div className="flex gap-2">
                                <dt className="font-medium text-muted-foreground">Composição:</dt>
                                <dd className="text-foreground">
                                  {pr.adultos} adulto{pr.adultos === 1 ? '' : 's'}
                                  {pr.jovens ? ` · ${pr.jovens} jovem${pr.jovens === 1 ? '' : 's'}` : ''}
                                  {` · ${pr.criancas} criança${pr.criancas === 1 ? '' : 's'}`}
                                  {` (total ${pr.total})`}
                                </dd>
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
                            {g.adminNotes ? (
                              <div className="rounded-md border border-amber-200 bg-amber-50 p-2 dark:border-amber-500/30 dark:bg-amber-500/10">
                                <p className="m-0 text-xs font-semibold uppercase text-amber-700 dark:text-amber-400">Notas internas</p>
                                <p className="m-0 whitespace-pre-wrap text-sm text-foreground">{g.adminNotes}</p>
                              </div>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    ) : null}

                    {isOpen && expanded.mode === 'edit' && editForm ? (
                      <tr className="border-b border-border/60 bg-muted/20">
                        <td colSpan={11} className="p-3">
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
                            <label className={labelCls}>
                              Notas internas (comentários / follow-up)
                              <textarea
                                className={inputCls + ' min-h-[70px] resize-y'}
                                value={editForm.adminNotes}
                                onChange={(e) => setEditForm((f) => ({ ...f, adminNotes: e.target.value }))}
                                placeholder="Notas visíveis apenas para a organização (ex.: contactar, pagamento em falta, observações)."
                                maxLength={2000}
                              />
                            </label>
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

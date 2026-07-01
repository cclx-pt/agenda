import { useState, useEffect, useCallback, useMemo } from 'react'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import {
  X, Check, Ban, Download, Plus, Trash2, ShieldCheck, ClipboardCheck, Filter,
} from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { useModalA11y } from '../hooks/useModalA11y'
import { useChurches } from '../hooks/useChurches'
import { useCategories } from '../hooks/useCategories'
import * as eventsService from '../services/eventsService'
import { CATEGORY_META, formatDateNumericValue, formatTimeRange } from '../utils/calendarHelpers'

const STATUS_OPTIONS = [
  { value: 'pendente', label: 'Pendentes' },
  { value: 'publicado', label: 'Aprovados' },
  { value: 'rejeitado', label: 'Rejeitados' },
  { value: 'todos', label: 'Todos' },
]

const STATUS_LABEL = {
  pendente: 'Pendente',
  publicado: 'Aprovado',
  rejeitado: 'Rejeitado',
  rascunho: 'Rascunho',
}

const STATUS_BADGE = {
  pendente: 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-400',
  publicado: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-400',
  rejeitado: 'bg-red-100 text-red-800 dark:bg-red-500/15 dark:text-red-400',
  rascunho: 'bg-muted text-muted-foreground',
}

const emptyDelegation = { delegateId: '', church: '', category: '', startDate: '', endDate: '', active: true }

function csvEscape(v) {
  const s = String(v ?? '')
  return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

function downloadCsv(content, filename) {
  const blob = new Blob(['\uFEFF' + content], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export default function ApprovalsPanel({ onClose, onChanged }) {
  const { user } = useAuth()
  const containerRef = useModalA11y(onClose)
  const { churches } = useChurches()
  const { categories } = useCategories()

  const canManageDelegations = user?.role === 'admin' || user?.role === 'aprovador'

  const [tab, setTab] = useState('approvals')
  const [status, setStatus] = useState('pendente')
  const [churchFilter, setChurchFilter] = useState('Todas')
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)

  const [delegations, setDelegations] = useState([])
  const [editors, setEditors] = useState([])
  const [delForm, setDelForm] = useState(emptyDelegation)

  const categoryLabel = useCallback(
    (slug) => categories.find((c) => c.slug === slug)?.label || CATEGORY_META[slug]?.label || slug,
    [categories]
  )

  const loadApprovals = useCallback(async () => {
    setLoading(true)
    try {
      setEvents(await eventsService.listApprovals(status))
    } catch (err) {
      toast.error(err.message)
    } finally {
      setLoading(false)
    }
  }, [status])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadApprovals()
  }, [loadApprovals])

  const loadDelegations = useCallback(async () => {
    if (!canManageDelegations) return
    try {
      const [dels, eds] = await Promise.all([
        eventsService.listDelegations(),
        eventsService.listDelegationEditors(),
      ])
      setDelegations(dels)
      setEditors(eds)
    } catch (err) {
      toast.error(err.message)
    }
  }, [canManageDelegations])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadDelegations()
  }, [loadDelegations])

  const churchesInEvents = useMemo(() => {
    const set = new Set(events.map((e) => e.community).filter(Boolean))
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'pt'))
  }, [events])

  const visibleEvents = useMemo(
    () => (churchFilter === 'Todas' ? events : events.filter((e) => e.community === churchFilter)),
    [events, churchFilter]
  )

  const handleApprove = async (evt) => {
    setBusy(true)
    try {
      await eventsService.approveEvent(evt.id)
      toast.success('Evento aprovado.')
      onChanged?.()
      await loadApprovals()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setBusy(false)
    }
  }

  const handleReject = async (evt) => {
    const reason = window.prompt('Motivo da rejeição:')
    if (reason == null) return
    if (!reason.trim()) {
      toast.error('É obrigatório indicar o motivo da rejeição.')
      return
    }
    setBusy(true)
    try {
      await eventsService.rejectEvent(evt.id, reason.trim())
      toast.success('Evento rejeitado.')
      onChanged?.()
      await loadApprovals()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setBusy(false)
    }
  }

  const handleExport = () => {
    if (visibleEvents.length === 0) {
      toast.info('Sem eventos para exportar nesta vista.')
      return
    }
    const header = ['Data', 'Hora', 'Titulo', 'Igreja', 'Categoria', 'Estado', 'Responsavel', 'Contacto']
    const rows = visibleEvents.map((e) => [
      formatDateNumericValue(e.startDatetime),
      formatTimeRange(e.timeStart, e.timeEnd) || '',
      e.title || '',
      e.community || '',
      categoryLabel(e.category),
      STATUS_LABEL[e.status] || e.status || '',
      e.organizerName || '',
      e.organizerContact || '',
    ])
    const content = [header, ...rows].map((r) => r.map(csvEscape).join(';')).join('\r\n')
    downloadCsv(content, `aprovacoes-${status}-${new Date().toISOString().slice(0, 10)}.csv`)
  }

  const setDelField = (key) => (e) => {
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value
    setDelForm((f) => ({ ...f, [key]: value }))
  }

  const handleCreateDelegation = async (e) => {
    e.preventDefault()
    if (!delForm.delegateId || !delForm.startDate || !delForm.endDate) {
      toast.error('Escolha o editor e o intervalo de datas.')
      return
    }
    if (delForm.endDate < delForm.startDate) {
      toast.error('A data de fim não pode ser anterior à de início.')
      return
    }
    setBusy(true)
    try {
      await eventsService.createDelegation({
        delegateId: delForm.delegateId,
        church: delForm.church || null,
        category: delForm.category || null,
        startDate: delForm.startDate,
        endDate: delForm.endDate,
        active: delForm.active,
      })
      toast.success('Delegação criada.')
      setDelForm(emptyDelegation)
      await loadDelegations()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setBusy(false)
    }
  }

  const handleToggleDelegation = async (d) => {
    setBusy(true)
    try {
      await eventsService.updateDelegation(d.id, {
        delegateId: d.delegateId,
        church: d.church,
        category: d.category,
        startDate: d.startDate,
        endDate: d.endDate,
        active: !d.active,
      })
      await loadDelegations()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setBusy(false)
    }
  }

  const handleDeleteDelegation = async (d) => {
    if (!window.confirm(`Eliminar a delegação para "${d.delegateName || d.delegateEmail}"?`)) return
    setBusy(true)
    try {
      await eventsService.deleteDelegation(d.id)
      await loadDelegations()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setBusy(false)
    }
  }

  const tabBtn = (id, label, icon) => (
    <button
      type="button"
      onClick={() => setTab(id)}
      className={
        'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] font-semibold transition-colors ' +
        (tab === id ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent hover:text-foreground')
      }
    >
      {icon}
      {label}
    </button>
  )

  return (
    <motion.div
      className="fixed inset-0 z-[300] flex items-start justify-center overflow-y-auto bg-black/60 px-4 py-10 max-[560px]:p-0"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
      role="dialog" aria-modal="true" aria-label="Aprovações"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}
    >
      <motion.div
        ref={containerRef} tabIndex={-1}
        className="flex max-h-[calc(100vh-80px)] w-[900px] max-w-[96vw] flex-col overflow-hidden rounded-xl border border-border bg-background shadow-lg max-[560px]:h-full max-[560px]:max-h-full max-[560px]:w-full max-[560px]:max-w-full max-[560px]:rounded-none"
        initial={{ opacity: 0, y: 30, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 20, scale: 0.98 }} transition={{ duration: 0.25, ease: 'easeOut' }}
      >
        {/* Header */}
        <div className="flex flex-shrink-0 items-center justify-between gap-3 border-b border-border px-5 py-4">
          <h2 className="m-0 flex items-center gap-2 text-base font-bold text-foreground">
            <ClipboardCheck className="h-5 w-5 text-primary" aria-hidden="true" />
            Aprovações
          </h2>
          <div className="flex items-center gap-2">
            {tabBtn('approvals', 'Aprovações', <ClipboardCheck className="h-4 w-4" aria-hidden="true" />)}
            {canManageDelegations && tabBtn('delegations', 'Delegações', <ShieldCheck className="h-4 w-4" aria-hidden="true" />)}
            <button
              type="button"
              className="cursor-pointer rounded p-1 text-lg text-muted-foreground transition-colors hover:bg-accent"
              onClick={onClose}
              aria-label="Fechar"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex flex-col gap-3 overflow-y-auto px-5 pb-5 pt-4">
          {tab === 'approvals' ? (
            <>
              {/* Toolbar */}
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <Filter className="h-3.5 w-3.5" aria-hidden="true" />
                  <select
                    className="cursor-pointer rounded-lg border border-input bg-background px-2.5 py-2 text-[13px] text-foreground"
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                    aria-label="Estado"
                  >
                    {STATUS_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>
                <select
                  className="cursor-pointer rounded-lg border border-input bg-background px-2.5 py-2 text-[13px] text-foreground"
                  value={churchFilter}
                  onChange={(e) => setChurchFilter(e.target.value)}
                  aria-label="Igreja"
                >
                  <option value="Todas">Todas as igrejas</option>
                  {churchesInEvents.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
                <span className="text-[13px] text-muted-foreground">{visibleEvents.length} evento{visibleEvents.length === 1 ? '' : 's'}</span>
                <button
                  type="button"
                  onClick={handleExport}
                  className="ml-auto inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-border bg-transparent px-3 py-2 text-[13px] font-semibold text-foreground transition-colors hover:bg-accent"
                >
                  <Download className="h-4 w-4" aria-hidden="true" />
                  Exportar Excel
                </button>
              </div>

              {/* List */}
              {loading ? (
                <p className="py-8 text-center text-sm text-muted-foreground">A carregar…</p>
              ) : visibleEvents.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">Sem eventos para mostrar.</p>
              ) : (
                <ul className="m-0 flex list-none flex-col gap-2 p-0">
                  {visibleEvents.map((e) => (
                    <li key={e.id} className="flex items-center justify-between gap-3 rounded-[10px] border border-border bg-muted/40 p-3 max-[560px]:flex-col max-[560px]:items-stretch">
                      <div className="flex min-w-0 flex-col gap-0.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <strong className="text-sm text-foreground">{e.title}</strong>
                          <span className={'rounded-full px-2 py-[3px] text-[11px] font-bold uppercase tracking-wide ' + (STATUS_BADGE[e.status] || STATUS_BADGE.rascunho)}>
                            {STATUS_LABEL[e.status] || e.status}
                          </span>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {formatDateNumericValue(e.startDatetime)}
                          {formatTimeRange(e.timeStart, e.timeEnd) ? ` · ${formatTimeRange(e.timeStart, e.timeEnd)}` : ''}
                          {' · '}{e.community}
                          {' · '}{categoryLabel(e.category)}
                          {e.organizerName ? ` · ${e.organizerName}` : ''}
                        </span>
                        {e.status === 'rejeitado' && e.rejectionReason ? (
                          <span className="text-xs text-destructive">Motivo: {e.rejectionReason}</span>
                        ) : null}
                      </div>
                      {e.status === 'pendente' && (
                        <div className="flex flex-shrink-0 gap-1.5 max-[560px]:justify-end">
                          <button
                            type="button"
                            onClick={() => handleApprove(e)}
                            disabled={busy}
                            className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-emerald-600/40 bg-transparent px-3 py-2 text-[13px] font-semibold text-emerald-700 transition-colors hover:bg-emerald-100 disabled:opacity-50 dark:text-emerald-400 dark:hover:bg-emerald-500/15"
                          >
                            <Check className="h-4 w-4" aria-hidden="true" />
                            Aprovar
                          </button>
                          <button
                            type="button"
                            onClick={() => handleReject(e)}
                            disabled={busy}
                            className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-destructive/40 bg-transparent px-3 py-2 text-[13px] font-semibold text-destructive transition-colors hover:bg-destructive/10 disabled:opacity-50"
                          >
                            <Ban className="h-4 w-4" aria-hidden="true" />
                            Rejeitar
                          </button>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </>
          ) : (
            <>
              {/* Delegation create form */}
              <form onSubmit={handleCreateDelegation} className="flex flex-col gap-3 rounded-[10px] border border-border bg-muted/40 p-3.5">
                <p className="m-0 text-[13px] font-semibold text-foreground">Nova delegação de aprovação</p>
                <div className="grid grid-cols-2 gap-3 max-[560px]:grid-cols-1">
                  <label className="flex flex-col gap-1.5 text-xs font-semibold text-muted-foreground">
                    Editor (delegado) *
                    <select className="rounded-lg border border-input bg-background px-[11px] py-[9px] text-sm text-foreground" value={delForm.delegateId} onChange={setDelField('delegateId')} required>
                      <option value="">— Selecione —</option>
                      {editors.map((ed) => (
                        <option key={ed.id} value={ed.id}>{ed.name || ed.email}</option>
                      ))}
                    </select>
                  </label>
                  <label className="flex flex-col gap-1.5 text-xs font-semibold text-muted-foreground">
                    Igreja
                    <select className="rounded-lg border border-input bg-background px-[11px] py-[9px] text-sm text-foreground" value={delForm.church} onChange={setDelField('church')}>
                      <option value="">Todas as igrejas</option>
                      {churches.map((c) => (
                        <option key={c.id} value={c.name}>{c.name}</option>
                      ))}
                    </select>
                  </label>
                  <label className="flex flex-col gap-1.5 text-xs font-semibold text-muted-foreground">
                    Categoria
                    <select className="rounded-lg border border-input bg-background px-[11px] py-[9px] text-sm text-foreground" value={delForm.category} onChange={setDelField('category')}>
                      <option value="">Todas as categorias</option>
                      {categories.map((c) => (
                        <option key={c.id} value={c.slug}>{c.label}</option>
                      ))}
                    </select>
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <label className="flex flex-col gap-1.5 text-xs font-semibold text-muted-foreground">
                      Início *
                      <input type="date" className="rounded-lg border border-input bg-background px-[11px] py-[9px] text-sm text-foreground" value={delForm.startDate} onChange={setDelField('startDate')} required />
                    </label>
                    <label className="flex flex-col gap-1.5 text-xs font-semibold text-muted-foreground">
                      Fim *
                      <input type="date" className="rounded-lg border border-input bg-background px-[11px] py-[9px] text-sm text-foreground" value={delForm.endDate} onChange={setDelField('endDate')} required />
                    </label>
                  </div>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <label className="flex cursor-pointer items-center gap-[7px] text-[13px] font-medium text-foreground">
                    <input type="checkbox" checked={delForm.active} onChange={setDelField('active')} />
                    Ativa
                  </label>
                  <button type="submit" disabled={busy} className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-primary px-3.5 py-[9px] text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50">
                    <Plus className="h-4 w-4" aria-hidden="true" />
                    Criar delegação
                  </button>
                </div>
              </form>

              {/* Delegation list */}
              {delegations.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">Ainda não há delegações.</p>
              ) : (
                <ul className="m-0 flex list-none flex-col gap-2 p-0">
                  {delegations.map((d) => (
                    <li key={d.id} className="flex items-center justify-between gap-3 rounded-[10px] border border-border bg-muted/40 p-3 max-[560px]:flex-col max-[560px]:items-stretch">
                      <div className="flex min-w-0 flex-col gap-0.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <strong className="text-sm text-foreground">{d.delegateName || d.delegateEmail}</strong>
                          <span className={'rounded-full px-2 py-[3px] text-[11px] font-bold uppercase tracking-wide ' + (d.active ? STATUS_BADGE.publicado : STATUS_BADGE.rascunho)}>
                            {d.active ? 'Ativa' : 'Inativa'}
                          </span>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {d.church || 'Todas as igrejas'} · {d.category ? categoryLabel(d.category) : 'Todas as categorias'}
                          {' · '}{d.startDate} a {d.endDate}
                        </span>
                      </div>
                      <div className="flex flex-shrink-0 gap-1.5 max-[560px]:justify-end">
                        <button
                          type="button"
                          onClick={() => handleToggleDelegation(d)}
                          disabled={busy}
                          className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg border border-border bg-transparent px-3 text-[13px] font-semibold text-foreground transition-colors hover:bg-accent disabled:opacity-50"
                        >
                          {d.active ? 'Desativar' : 'Ativar'}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteDelegation(d)}
                          disabled={busy}
                          className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border border-border bg-transparent text-foreground transition-colors hover:bg-red-100 hover:text-red-700 disabled:opacity-50 dark:hover:bg-red-500/20 dark:hover:text-red-400"
                          aria-label="Eliminar delegação"
                          title="Eliminar"
                        >
                          <Trash2 className="h-4 w-4" aria-hidden="true" />
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>
      </motion.div>
    </motion.div>
  )
}

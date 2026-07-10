import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import {
  Plus, Pencil, Trash2, ExternalLink, Copy, Eye, Send, ArrowLeft, ArrowUp, ArrowDown,
  Users, Image as ImageIcon, Loader2, ChevronDown, ChevronRight,
} from 'lucide-react'
import * as invitesService from '../../services/invitesService'
import { uploadEventImage } from '../../services/eventsService'
import DateField from '../DateField'
import TimeField from '../TimeField'
import { BlockEditor } from './InviteBlockEditors'
import { BLOCK_META, ADDABLE_TYPES, defaultContent } from './inviteBlockMeta'

const inputCls = 'w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground'
const labelCls = 'flex flex-col gap-1 text-sm font-medium text-foreground'
const primaryBtn =
  'inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60'
const ghostBtn =
  'inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-accent disabled:opacity-60'

const STATUS_BADGE = {
  rascunho: 'bg-muted text-muted-foreground',
  publicado: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-400',
  fechado: 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-400',
}
const STATUS_LABEL = { rascunho: 'Rascunho', publicado: 'Publicado', fechado: 'Fechado' }

const PAY_METHOD_LABEL = { mbway: 'MB WAY', transferencia: 'Transferência', referencia: 'Referência' }
const PAY_LABEL = {
  pending: 'Pendente',
  awaiting_validation: 'Em validação',
  paid: 'Pago',
  failed: 'Falhado',
  expired: 'Expirado',
  cancelled: 'Cancelado',
}
const PAY_BADGE = {
  pending: 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-400',
  awaiting_validation: 'bg-sky-100 text-sky-800 dark:bg-sky-500/15 dark:text-sky-400',
  paid: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-400',
  failed: 'bg-red-100 text-red-800 dark:bg-red-500/15 dark:text-red-400',
}

function toDateInput(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}
function toTimeInput(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n) => String(n).padStart(2, '0')
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}
function combineDateTime(date, time) {
  if (!date) return null
  return new Date(`${date}T${time || '00:00'}`).toISOString()
}

function publicUrl(slug) {
  return `${window.location.origin}/invite/${encodeURIComponent(slug)}`
}

// Rótulo curto de data para as opções do seletor de evento.
function fmtEventOpt(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

// ── Editor de um convite ─────────────────────────────────────────
function InviteEditor({ invite, onBack, onSaved }) {
  const [settings, setSettings] = useState(() => ({
    eventId: invite.eventId ?? '',
    title: invite.title ?? '',
    colorTheme: invite.colorTheme ?? '#1F3864',
    // Datas do EVENTO.
    startDate: toDateInput(invite.startDatetime),
    startTime: toTimeInput(invite.startDatetime),
    endDate: toDateInput(invite.endDatetime),
    endTime: toTimeInput(invite.endDatetime),
    location: invite.location ?? '',
    // Banner.
    bannerUrl: invite.bannerUrl ?? '',
    useEventBanner: !!invite.useEventBanner,
    // Custo / pagamento (método único).
    costType: invite.costType ?? 'gratuito',
    costAmount: invite.costAmount ?? '',
    paymentMethod: invite.paymentMethod ?? 'mbway',
    // Janela de INSCRIÇÃO.
    rsvpEnabled: invite.rsvpEnabled !== false,
    rsvpStartDate: toDateInput(invite.rsvpStartDatetime),
    rsvpStartTime: toTimeInput(invite.rsvpStartDatetime),
    rsvpEndDate: toDateInput(invite.rsvpDeadline),
    rsvpEndTime: toTimeInput(invite.rsvpDeadline),
    capacity: invite.capacity ?? '',
    metaDescription: invite.metaDescription ?? '',
  }))
  const [tickets, setTickets] = useState(() => invite.tickets || [])
  const [events, setEvents] = useState([])
  const [blocks, setBlocks] = useState(() => invite.blocks || [])
  const [openBlock, setOpenBlock] = useState(null)
  const [busy, setBusy] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [addType, setAddType] = useState(ADDABLE_TYPES[0]?.type ?? 'info_extra')
  const [guests, setGuests] = useState(null)
  const [payments, setPayments] = useState(null)

  // Carrega os eventos publicados/futuros associáveis.
  useEffect(() => {
    let alive = true
    invitesService
      .getSelectableEvents()
      .then((evs) => {
        if (alive) setEvents(evs)
      })
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [])

  const setField = (k) => (e) => {
    const v = e.target.type === 'checkbox' ? e.target.checked : e.target.value
    setSettings((s) => ({ ...s, [k]: v }))
  }

  // Associa (ou desassocia) um evento: herda título, datas do evento, local e banner.
  const pickEvent = (eventId) => {
    const ev = events.find((x) => x.id === eventId)
    setSettings((s) => ({
      ...s,
      eventId,
      ...(ev
        ? {
            title: s.title.trim() ? s.title : ev.title,
            startDate: toDateInput(ev.startDatetime),
            startTime: toTimeInput(ev.startDatetime),
            endDate: toDateInput(ev.endDatetime),
            endTime: toTimeInput(ev.endDatetime),
            location: s.location.trim() ? s.location : ev.location || '',
            useEventBanner: ev.bannerUrl ? true : s.useEventBanner,
          }
        : {}),
    }))
  }

  const handleBanner = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const url = await uploadEventImage(file)
      setSettings((s) => ({ ...s, bannerUrl: url }))
      toast.success('Imagem carregada.')
    } catch (err) {
      toast.error(err.message)
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  // Blocos: reordenar, visibilidade, remover, adicionar, editar conteúdo.
  const moveBlock = (i, dir) => {
    const j = i + dir
    if (j < 0 || j >= blocks.length) return
    const next = [...blocks]
    ;[next[i], next[j]] = [next[j], next[i]]
    setBlocks(next)
  }
  const toggleVisible = (i) => setBlocks((b) => b.map((blk, idx) => (idx === i ? { ...blk, visible: !blk.visible } : blk)))
  const removeBlock = (i) => setBlocks((b) => b.filter((_, idx) => idx !== i))
  const setBlockContent = (i, content) => setBlocks((b) => b.map((blk, idx) => (idx === i ? { ...blk, content } : blk)))
  const addBlock = () => {
    setBlocks((b) => [...b, { id: null, type: addType, visible: true, content: defaultContent(addType) }])
    setOpenBlock(blocks.length)
  }

  // Bilhetes: adicionar/editar/remover tipos.
  const addTicket = () =>
    setTickets((t) => [...t, { id: null, name: '', kind: 'individual', price: '', capacity: '', groupSize: '', active: true }])
  const setTicketField = (i, k, v) => setTickets((t) => t.map((tk, idx) => (idx === i ? { ...tk, [k]: v } : tk)))
  const removeTicket = (i) => setTickets((t) => t.filter((_, idx) => idx !== i))

  const buildSettingsPayload = () => ({
    eventId: settings.eventId || null,
    title: settings.title.trim(),
    colorTheme: settings.colorTheme || null,
    startDatetime: combineDateTime(settings.startDate, settings.startTime),
    endDatetime: settings.endDate ? combineDateTime(settings.endDate, settings.endTime) : null,
    location: settings.location.trim() || null,
    bannerUrl: settings.bannerUrl.trim() || null,
    useEventBanner: settings.useEventBanner,
    metaImageUrl: settings.bannerUrl.trim() || null,
    metaDescription: settings.metaDescription.trim() || null,
    costType: settings.costType,
    costAmount: settings.costType === 'gratuito' ? null : Number(settings.costAmount) || null,
    paymentMethod: settings.costType === 'gratuito' ? null : settings.paymentMethod,
    rsvpEnabled: settings.rsvpEnabled,
    rsvpStartDatetime: settings.rsvpStartDate ? combineDateTime(settings.rsvpStartDate, settings.rsvpStartTime || '00:00') : null,
    rsvpDeadline: settings.rsvpEndDate ? combineDateTime(settings.rsvpEndDate, settings.rsvpEndTime || '23:59') : null,
    capacity: settings.capacity ? Number(settings.capacity) : null,
  })

  const save = async () => {
    if (!settings.title.trim()) {
      toast.error('O título é obrigatório.')
      return
    }
    setBusy(true)
    try {
      await invitesService.updateInvite(invite.id, buildSettingsPayload())
      if (settings.costType !== 'gratuito') {
        await invitesService.saveTickets(
          invite.id,
          tickets
            .filter((t) => (t.name || '').trim())
            .map((t) => ({
              id: t.id || null,
              name: t.name.trim(),
              kind: t.kind || 'individual',
              price: t.price === '' || t.price == null ? null : Number(t.price),
              capacity: t.capacity === '' || t.capacity == null ? null : Number(t.capacity),
              groupSize: t.groupSize === '' || t.groupSize == null ? null : Number(t.groupSize),
              active: t.active !== false,
            }))
        )
      }
      const updated = await invitesService.saveInviteBlocks(
        invite.id,
        blocks.map((b) => ({ type: b.type, visible: b.visible, content: b.content }))
      )
      toast.success('Convite guardado.')
      onSaved?.(updated)
    } catch (err) {
      toast.error(err.message)
    } finally {
      setBusy(false)
    }
  }

  const changeStatus = async (status) => {
    setBusy(true)
    try {
      const updated = await invitesService.setInviteStatus(invite.id, status)
      toast.success(status === 'publicado' ? 'Convite publicado.' : 'Estado atualizado.')
      onSaved?.(updated)
    } catch (err) {
      toast.error(err.message)
    } finally {
      setBusy(false)
    }
  }

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(publicUrl(invite.slug))
      toast.success('Link copiado.')
    } catch {
      toast.error('Não foi possível copiar.')
    }
  }

  const loadGuests = async () => {
    try {
      const [g, p] = await Promise.all([
        invitesService.listInviteGuests(invite.id),
        settings.costType !== 'gratuito' ? invitesService.listInvitePayments(invite.id) : Promise.resolve([]),
      ])
      setGuests(g)
      setPayments(p)
    } catch (err) {
      toast.error(err.message)
    }
  }

  const validatePay = async (p) => {
    setBusy(true)
    try {
      await invitesService.validatePayment(p.id)
      toast.success('Pagamento validado.')
      await loadGuests()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setBusy(false)
    }
  }

  const rejectPay = async (p) => {
    if (!window.confirm('Rejeitar este pagamento? O convidado poderá tentar de novo.')) return
    setBusy(true)
    try {
      await invitesService.rejectPayment(p.id)
      toast.success('Pagamento rejeitado.')
      await loadGuests()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={onBack} className={ghostBtn}>
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Voltar
        </button>
        <span className={`rounded-full px-2.5 py-1 text-xs font-bold uppercase ${STATUS_BADGE[invite.status]}`}>
          {STATUS_LABEL[invite.status]}
        </span>
        <div className="ml-auto flex flex-wrap gap-2">
          <button type="button" onClick={copyLink} className={ghostBtn}>
            <Copy className="h-4 w-4" aria-hidden="true" />
            Copiar link
          </button>
          <a href={publicUrl(invite.slug)} target="_blank" rel="noreferrer" className={ghostBtn}>
            <ExternalLink className="h-4 w-4" aria-hidden="true" />
            Abrir
          </a>
          {invite.status !== 'publicado' ? (
            <button type="button" onClick={() => changeStatus('publicado')} disabled={busy} className={primaryBtn}>
              <Send className="h-4 w-4" aria-hidden="true" />
              Publicar
            </button>
          ) : (
            <button type="button" onClick={() => changeStatus('fechado')} disabled={busy} className={ghostBtn}>
              Fechar inscrições
            </button>
          )}
        </div>
      </div>

      {/* Definições da página */}
      <section className="rounded-xl border border-border bg-card p-4">
        <h3 className="m-0 mb-3 text-sm font-bold uppercase tracking-wide text-muted-foreground">Definições</h3>
        <div className="flex flex-col gap-3">
          {/* Evento associado (herda título, datas e imagem) */}
          <label className={labelCls}>
            Evento associado
            <select className={inputCls} value={settings.eventId} onChange={(e) => pickEvent(e.target.value)}>
              <option value="">— Sem evento (datas manuais) —</option>
              {events.map((ev) => (
                <option key={ev.id} value={ev.id}>
                  {ev.title}{ev.startDatetime ? ` · ${fmtEventOpt(ev.startDatetime)}` : ''}
                </option>
              ))}
            </select>
            <span className="text-xs text-muted-foreground">
              Escolha um evento futuro do calendário para herdar o título, as datas e a imagem. As datas do evento e das inscrições são independentes.
            </span>
          </label>

          <label className={labelCls}>
            Título *
            <input className={inputCls} value={settings.title} onChange={setField('title')} />
          </label>

          {/* Banner: usar a imagem do evento ou carregar uma própria */}
          <div className={labelCls}>
            Imagem de banner
            {settings.eventId ? (
              <label className="inline-flex items-center gap-2 text-sm font-normal text-foreground">
                <input type="checkbox" checked={settings.useEventBanner} onChange={setField('useEventBanner')} />
                Usar a imagem do evento
              </label>
            ) : null}
            {!settings.useEventBanner ? (
              <div className="flex items-center gap-3">
                {settings.bannerUrl ? (
                  <img src={settings.bannerUrl} alt="Banner" className="h-16 w-28 rounded-lg object-cover" />
                ) : (
                  <div className="flex h-16 w-28 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                    <ImageIcon className="h-5 w-5" aria-hidden="true" />
                  </div>
                )}
                <label className={ghostBtn + ' cursor-pointer'}>
                  {uploading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <ImageIcon className="h-4 w-4" aria-hidden="true" />}
                  {uploading ? 'A carregar…' : 'Carregar'}
                  <input type="file" accept="image/png,image/jpeg" className="hidden" onChange={handleBanner} />
                </label>
              </div>
            ) : (
              <span className="text-xs text-muted-foreground">A página vai usar a imagem do evento associado.</span>
            )}
          </div>

          {/* Datas do EVENTO */}
          <p className="m-0 mt-1 text-xs font-bold uppercase tracking-wide text-muted-foreground">Datas do evento</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className={labelCls}>
              Data de início
              <DateField className={inputCls} value={settings.startDate} onChange={(v) => setSettings((s) => ({ ...s, startDate: v }))} ariaLabel="Data de início" />
            </label>
            <label className={labelCls}>
              Hora de início
              <TimeField className={inputCls} value={settings.startTime} onChange={(v) => setSettings((s) => ({ ...s, startTime: v }))} ariaLabel="Hora de início" />
            </label>
            <label className={labelCls}>
              Data de fim
              <DateField className={inputCls} value={settings.endDate} onChange={(v) => setSettings((s) => ({ ...s, endDate: v }))} ariaLabel="Data de fim" />
            </label>
            <label className={labelCls}>
              Hora de fim
              <TimeField className={inputCls} value={settings.endTime} onChange={(v) => setSettings((s) => ({ ...s, endTime: v }))} ariaLabel="Hora de fim" />
            </label>
          </div>

          <label className={labelCls}>
            Local
            <input className={inputCls} value={settings.location} onChange={setField('location')} />
          </label>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className={labelCls}>
              Cor do tema
              <input type="color" className="h-10 w-full rounded-lg border border-input bg-background" value={settings.colorTheme} onChange={setField('colorTheme')} />
            </label>
            <label className={labelCls}>
              Custo
              <select className={inputCls} value={settings.costType} onChange={setField('costType')}>
                <option value="gratuito">Gratuito</option>
                <option value="pago">Pago</option>
                <option value="voluntario">Oferta voluntária</option>
              </select>
            </label>
          </div>

          {settings.costType !== 'gratuito' ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className={labelCls}>
                Valor por omissão (€)
                <input type="number" min="0" step="0.01" className={inputCls} value={settings.costAmount} onChange={setField('costAmount')} />
                <span className="text-xs text-muted-foreground">Usado quando não há bilhetes; com bilhetes, o preço vem do bilhete.</span>
              </label>
              <label className={labelCls}>
                Método de pagamento
                <select className={inputCls} value={settings.paymentMethod} onChange={setField('paymentMethod')}>
                  <option value="mbway">MB WAY</option>
                  <option value="transferencia">Transferência bancária</option>
                  <option value="referencia">Referência Multibanco</option>
                </select>
              </label>
            </div>
          ) : null}

          {/* Datas de INSCRIÇÃO (janela) */}
          <p className="m-0 mt-1 text-xs font-bold uppercase tracking-wide text-muted-foreground">Datas das inscrições</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className={labelCls}>
              Abertura
              <DateField className={inputCls} value={settings.rsvpStartDate} onChange={(v) => setSettings((s) => ({ ...s, rsvpStartDate: v }))} ariaLabel="Abertura das inscrições" />
            </label>
            <label className={labelCls}>
              Hora de abertura
              <TimeField className={inputCls} value={settings.rsvpStartTime} onChange={(v) => setSettings((s) => ({ ...s, rsvpStartTime: v }))} ariaLabel="Hora de abertura" />
            </label>
            <label className={labelCls}>
              Fecho
              <DateField className={inputCls} value={settings.rsvpEndDate} onChange={(v) => setSettings((s) => ({ ...s, rsvpEndDate: v }))} ariaLabel="Fecho das inscrições" />
            </label>
            <label className={labelCls}>
              Hora de fecho
              <TimeField className={inputCls} value={settings.rsvpEndTime} onChange={(v) => setSettings((s) => ({ ...s, rsvpEndTime: v }))} ariaLabel="Hora de fecho" />
            </label>
          </div>

          <label className={labelCls}>
            Capacidade total (lugares)
            <input type="number" min="1" className={inputCls} value={settings.capacity} onChange={setField('capacity')} />
          </label>

          <label className="inline-flex items-center gap-2 text-sm font-medium text-foreground">
            <input type="checkbox" checked={settings.rsvpEnabled} onChange={setField('rsvpEnabled')} />
            Inscrições abertas
          </label>

          <label className={labelCls}>
            Descrição (partilha / Open Graph)
            <textarea className={inputCls} rows={2} value={settings.metaDescription} onChange={setField('metaDescription')} />
          </label>
        </div>
      </section>

      {/* Bilhetes (eventos pagos) */}
      {settings.costType !== 'gratuito' ? (
        <section className="rounded-xl border border-border bg-card p-4">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="m-0 text-sm font-bold uppercase tracking-wide text-muted-foreground">Bilhetes</h3>
            <button type="button" onClick={addTicket} className={ghostBtn}>
              <Plus className="h-4 w-4" aria-hidden="true" />
              Adicionar bilhete
            </button>
          </div>
          {tickets.length === 0 ? (
            <p className="m-0 text-sm text-muted-foreground">
              Sem bilhetes. Adicione tipos (individual, grupo, campanha…); sem bilhetes usa-se o valor por omissão.
            </p>
          ) : (
            <ul className="m-0 flex list-none flex-col gap-2 p-0">
              {tickets.map((t, i) => (
                <li key={t.id || `new-${i}`} className="rounded-lg border border-border bg-background p-2">
                  <div className="flex items-start gap-2">
                    <div className="flex flex-1 flex-col gap-1.5">
                      <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                        <input className={inputCls} placeholder="Nome (ex.: Adulto, Família)" value={t.name} onChange={(e) => setTicketField(i, 'name', e.target.value)} />
                        <select className={inputCls} value={t.kind} onChange={(e) => setTicketField(i, 'kind', e.target.value)}>
                          <option value="individual">Individual</option>
                          <option value="grupo">Grupo</option>
                          <option value="campanha">Campanha</option>
                        </select>
                      </div>
                      <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-3">
                        <input type="number" min="0" step="0.01" className={inputCls} placeholder="Preço (€)" value={t.price} onChange={(e) => setTicketField(i, 'price', e.target.value)} />
                        <input type="number" min="1" className={inputCls} placeholder="Capacidade" value={t.capacity} onChange={(e) => setTicketField(i, 'capacity', e.target.value)} />
                        {t.kind === 'grupo' ? (
                          <input type="number" min="1" className={inputCls} placeholder="Pessoas/bilhete" value={t.groupSize} onChange={(e) => setTicketField(i, 'groupSize', e.target.value)} />
                        ) : (
                          <span />
                        )}
                      </div>
                      <label className="inline-flex items-center gap-1.5 text-sm text-foreground">
                        <input type="checkbox" checked={t.active !== false} onChange={(e) => setTicketField(i, 'active', e.target.checked)} />
                        Ativo
                        {t.sold != null ? <span className="text-xs text-muted-foreground">· vendidos: {t.sold}</span> : null}
                      </label>
                    </div>
                    <button type="button" onClick={() => removeTicket(i)} className="rounded p-1 text-destructive hover:bg-destructive/10" aria-label="Remover bilhete">
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}

      {/* Blocos de conteúdo */}
      <section className="rounded-xl border border-border bg-card p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="m-0 text-sm font-bold uppercase tracking-wide text-muted-foreground">Blocos da página</h3>
        </div>
        <ul className="m-0 flex list-none flex-col gap-2 p-0">
          {blocks.map((block, i) => (
            <li key={block.id || `new-${i}`} className="rounded-lg border border-border bg-background">
              <div className="flex items-center gap-2 p-2">
                <button
                  type="button"
                  onClick={() => setOpenBlock(openBlock === i ? null : i)}
                  className="inline-flex flex-1 items-center gap-2 text-left text-sm font-semibold text-foreground"
                >
                  {openBlock === i ? <ChevronDown className="h-4 w-4" aria-hidden="true" /> : <ChevronRight className="h-4 w-4" aria-hidden="true" />}
                  {BLOCK_META[block.type]?.label || block.type}
                  {!block.visible ? <span className="text-xs font-normal text-muted-foreground">(oculto)</span> : null}
                </button>
                <button type="button" onClick={() => toggleVisible(i)} className="rounded p-1 text-muted-foreground hover:bg-accent" aria-label="Alternar visibilidade" title="Mostrar/ocultar">
                  <Eye className={'h-4 w-4 ' + (block.visible ? '' : 'opacity-30')} aria-hidden="true" />
                </button>
                <button type="button" onClick={() => moveBlock(i, -1)} disabled={i === 0} className="rounded p-1 text-muted-foreground hover:bg-accent disabled:opacity-30" aria-label="Subir">
                  <ArrowUp className="h-4 w-4" aria-hidden="true" />
                </button>
                <button type="button" onClick={() => moveBlock(i, 1)} disabled={i === blocks.length - 1} className="rounded p-1 text-muted-foreground hover:bg-accent disabled:opacity-30" aria-label="Descer">
                  <ArrowDown className="h-4 w-4" aria-hidden="true" />
                </button>
                <button type="button" onClick={() => removeBlock(i)} className="rounded p-1 text-destructive hover:bg-destructive/10" aria-label="Remover bloco">
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
              {openBlock === i ? (
                <div className="border-t border-border p-3">
                  <BlockEditor type={block.type} content={block.content} onChange={(content) => setBlockContent(i, content)} />
                </div>
              ) : null}
            </li>
          ))}
        </ul>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <select className={inputCls + ' max-w-[240px]'} value={addType} onChange={(e) => setAddType(e.target.value)}>
            {ADDABLE_TYPES.map((t) => (
              <option key={t.type} value={t.type}>{t.label}</option>
            ))}
          </select>
          <button type="button" onClick={addBlock} className={ghostBtn}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            Adicionar bloco
          </button>
        </div>
      </section>

      {/* Inscrições */}
      <section className="rounded-xl border border-border bg-card p-4">
        <div className="flex items-center justify-between">
          <h3 className="m-0 text-sm font-bold uppercase tracking-wide text-muted-foreground">Inscrições</h3>
          <button type="button" onClick={loadGuests} className={ghostBtn}>
            <Users className="h-4 w-4" aria-hidden="true" />
            {guests ? 'Atualizar' : 'Ver inscrições'}
          </button>
        </div>
        {guests ? (
          guests.length === 0 ? (
            <p className="m-0 mt-3 text-sm text-muted-foreground">Ainda não há inscrições.</p>
          ) : (
            <ul className="m-0 mt-3 flex list-none flex-col gap-1 p-0">
              {guests.map((g) => (
                <li key={g.id} className="flex flex-wrap items-center gap-2 border-b border-border/60 py-1.5 text-sm">
                  <span className="font-medium text-foreground">{g.name || '(sem nome)'}</span>
                  {g.email ? <span className="text-muted-foreground">{g.email}</span> : null}
                  <span className="text-muted-foreground">· {g.guestsCount} lugar(es)</span>
                  <span className="ml-auto rounded-full bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground">{g.rsvpState}</span>
                </li>
              ))}
            </ul>
          )
        ) : null}
      </section>

      {/* Pagamentos (só para eventos pagos) */}
      {settings.costType !== 'gratuito' && payments ? (
        <section className="rounded-xl border border-border bg-card p-4">
          <h3 className="m-0 mb-2 text-sm font-bold uppercase tracking-wide text-muted-foreground">Pagamentos</h3>
          {payments.length === 0 ? (
            <p className="m-0 text-sm text-muted-foreground">Sem pagamentos ainda.</p>
          ) : (
            <ul className="m-0 flex list-none flex-col gap-1 p-0">
              {payments.map((p) => (
                <li key={p.id} className="flex flex-wrap items-center gap-2 border-b border-border/60 py-1.5 text-sm">
                  <span className="font-medium text-foreground">{p.guestName || '(sem nome)'}</span>
                  <span className="text-muted-foreground">· {PAY_METHOD_LABEL[p.method] || p.method}</span>
                  {p.amount != null ? (
                    <span className="text-muted-foreground">· {Number(p.amount).toFixed(2)} {p.currency}</span>
                  ) : null}
                  {p.receiptUrl ? (
                    <a href={p.receiptUrl} target="_blank" rel="noreferrer" className="text-primary hover:underline">
                      comprovativo
                    </a>
                  ) : null}
                  <span className={'ml-auto rounded-full px-2 py-0.5 text-xs font-semibold ' + (PAY_BADGE[p.status] || 'bg-muted text-muted-foreground')}>
                    {PAY_LABEL[p.status] || p.status}
                  </span>
                  {['pending', 'awaiting_validation'].includes(p.status) ? (
                    <div className="flex gap-1.5">
                      <button type="button" onClick={() => validatePay(p)} disabled={busy} className="rounded-lg border border-emerald-600/40 px-2.5 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 disabled:opacity-50 dark:text-emerald-400 dark:hover:bg-emerald-500/15">
                        Validar
                      </button>
                      <button type="button" onClick={() => rejectPay(p)} disabled={busy} className="rounded-lg border border-destructive/40 px-2.5 py-1 text-xs font-semibold text-destructive hover:bg-destructive/10 disabled:opacity-50">
                        Rejeitar
                      </button>
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}

      {/* Barra de ações fixa em baixo */}
      <div className="sticky bottom-0 -mx-1 flex justify-end gap-2 border-t border-border bg-background/95 py-3 backdrop-blur">
        <button type="button" onClick={save} disabled={busy} className={primaryBtn}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
          Guardar convite
        </button>
      </div>
    </div>
  )
}

// ── Lista + criação ──────────────────────────────────────────────
export default function InvitesAdmin() {
  const [invites, setInvites] = useState([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState(null)
  const [editing, setEditing] = useState(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setInvites(await invitesService.listInvites())
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

  const openEditor = async (id) => {
    setBusy(true)
    try {
      const invite = await invitesService.getInvite(id)
      setEditing(invite)
      setEditingId(id)
    } catch (err) {
      toast.error(err.message)
    } finally {
      setBusy(false)
    }
  }

  const createInvite = async () => {
    const title = window.prompt('Título do convite:')
    if (title == null || !title.trim()) return
    setBusy(true)
    try {
      const invite = await invitesService.createInvite({ title: title.trim() })
      setEditing(invite)
      setEditingId(invite.id)
      toast.success('Convite criado.')
    } catch (err) {
      toast.error(err.message)
    } finally {
      setBusy(false)
    }
  }

  const deleteInvite = async (inv) => {
    if (!window.confirm(`Eliminar o convite "${inv.title}"? Esta ação é irreversível.`)) return
    setBusy(true)
    try {
      await invitesService.deleteInvite(inv.id)
      toast.success('Convite eliminado.')
      await load()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setBusy(false)
    }
  }

  const copyLink = async (slug) => {
    try {
      await navigator.clipboard.writeText(publicUrl(slug))
      toast.success('Link copiado.')
    } catch {
      toast.error('Não foi possível copiar.')
    }
  }

  if (editingId && editing) {
    return (
      <InviteEditor
        invite={editing}
        onBack={() => {
          setEditingId(null)
          setEditing(null)
          load()
        }}
        onSaved={(updated) => setEditing((prev) => ({ ...updated, blocks: updated.blocks ?? prev.blocks }))}
      />
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="m-0 text-sm text-muted-foreground">
          Páginas de convite públicas e partilháveis, com blocos de conteúdo, inscrições e partilha.
        </p>
        <button type="button" onClick={createInvite} disabled={busy} className={primaryBtn}>
          <Plus className="h-4 w-4" aria-hidden="true" />
          Novo convite
        </button>
      </div>

      {loading ? (
        <p className="py-8 text-center text-sm text-muted-foreground">A carregar…</p>
      ) : invites.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">Ainda não há convites. Crie o primeiro.</p>
      ) : (
        <ul className="m-0 flex list-none flex-col gap-2 p-0">
          {invites.map((inv) => (
            <li key={inv.id} className="flex flex-wrap items-center gap-3 rounded-[10px] border border-border bg-muted/40 p-3">
              <div className="flex min-w-0 flex-col gap-0.5">
                <div className="flex flex-wrap items-center gap-2">
                  <strong className="text-sm text-foreground">{inv.title}</strong>
                  <span className={`rounded-full px-2 py-[3px] text-[11px] font-bold uppercase ${STATUS_BADGE[inv.status]}`}>
                    {STATUS_LABEL[inv.status]}
                  </span>
                </div>
                <span className="text-xs text-muted-foreground">/invite/{inv.slug}</span>
              </div>
              <div className="ml-auto flex flex-shrink-0 gap-1.5">
                <button type="button" onClick={() => openEditor(inv.id)} disabled={busy} className={ghostBtn}>
                  <Pencil className="h-4 w-4" aria-hidden="true" />
                  Editar
                </button>
                <button type="button" onClick={() => copyLink(inv.slug)} className={ghostBtn} aria-label="Copiar link">
                  <Copy className="h-4 w-4" aria-hidden="true" />
                </button>
                <a href={publicUrl(inv.slug)} target="_blank" rel="noreferrer" className={ghostBtn} aria-label="Abrir">
                  <ExternalLink className="h-4 w-4" aria-hidden="true" />
                </a>
                <button type="button" onClick={() => deleteInvite(inv)} disabled={busy} className="inline-flex items-center rounded-lg border border-destructive/40 bg-transparent px-3 py-2 text-destructive transition-colors hover:bg-destructive/10" aria-label="Eliminar">
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

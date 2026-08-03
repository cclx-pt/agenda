import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import {
  Plus, Pencil, Trash2, ExternalLink, Copy, Eye, Send, ArrowLeft, ArrowUp, ArrowDown,
  Users, Image as ImageIcon, Loader2, Download, ChevronDown, ChevronRight,
  Calendar as CalendarIcon, MapPin,
} from 'lucide-react'
import * as invitesService from '../../services/invitesService'
import { uploadEventImage, getPaymentMethods } from '../../services/eventsService'
import DateField from '../DateField'
import TimeField from '../TimeField'
import PaymentMethodsAdmin from '../PaymentMethodsAdmin'
import InviteSubmissionsAdmin from './InviteSubmissionsAdmin'
import InviteSettingsAdmin from './InviteSettingsAdmin'
import CheckinAdmin from './CheckinAdmin'
import { useAuth } from '../../hooks/useAuth'
import { BlockEditor, RsvpEditor } from './InviteBlockEditors'
import { RsvpCard } from './InvitePage'
import { BLOCK_META, ADDABLE_TYPES, defaultContent } from './inviteBlockMeta'
import { getFormFields, SYSTEM_KEYS, mergeFormSchemas } from './inviteFormFields'
import { inscricaoSituacao, SITUACAO_LABEL, classifyGuestPeople } from './inviteUtils'
import { Switch } from '@/components/ui/switch'

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
  refund_requested: 'Reembolso pedido',
  refunded: 'Reembolsado',
}
const PAY_BADGE = {
  pending: 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-400',
  awaiting_validation: 'bg-sky-100 text-sky-800 dark:bg-sky-500/15 dark:text-sky-400',
  paid: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-400',
  failed: 'bg-red-100 text-red-800 dark:bg-red-500/15 dark:text-red-400',
  refund_requested: 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-400',
  refunded: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-400',
}

// Tipo de PREÇO do bilhete: Pago (com valor), Grátis (0€) ou Doação (valor à
// escolha do doador). A composição (individual/grupo) é um campo à parte.
const TICKET_KINDS = [
  { value: 'individual', label: 'Pago' },
  { value: 'gratis', label: 'Grátis' },
  { value: 'voluntaria', label: 'Doação' },
]
// Composição do bilhete: individual ou grupo. O grupo abre a lista de membros
// (nome, idade e observações se < 11) no formulário de inscrição.
const PARTY_TYPES = [
  { value: 'single', label: 'Individual' },
  { value: 'group', label: 'Grupo' },
]
// Normaliza o tipo de preço; tipos legados de composição ('grupo'/'campanha') → pago.
function normalizeKind(kind) {
  if (kind === 'individual' || kind === 'gratis' || kind === 'voluntaria') return kind
  return 'individual'
}
// Composição efetiva de um bilhete (deriva de tipos legados baseados no kind).
function normalizePartyType(t) {
  // Legado: kind 'grupo'/'campanha' e o antigo party_type 'family' → grupo.
  if (t.kind === 'grupo' || t.kind === 'campanha') return 'group'
  if (t.partyType === 'family' || t.partyType === 'group') return 'group'
  return 'single'
}
// Um bilhete é gratuito se for do tipo "grátis" ou (não-voluntária) sem preço > 0.
function ticketIsFree(t) {
  if (t.kind === 'gratis') return true
  if (t.kind === 'voluntaria') return false
  const p = Number(t.price)
  return !Number.isFinite(p) || p <= 0
}
// Há pelo menos um bilhete pago (com nome preenchido)?
function hasPaidTicket(tickets) {
  return (tickets || []).some((t) => (t.name || '').trim() && !ticketIsFree(t))
}
// Métodos de pagamento oferecidos por um bilhete (array; retrocompat com o único).
function ticketMethods(t) {
  if (Array.isArray(t.paymentMethods) && t.paymentMethods.length) return t.paymentMethods
  return t.paymentMethod ? [t.paymentMethod] : []
}
// Método de pagamento do primeiro bilhete pago (para o fluxo de pagamento do convite).
function firstPaidTicketMethod(tickets) {
  const t = (tickets || []).find((x) => (x.name || '').trim() && !ticketIsFree(x) && ticketMethods(x).length)
  return t ? ticketMethods(t)[0] || null : null
}

// O banner fica SEMPRE em primeiro e o rodapé SEMPRE em último; os restantes blocos
// mantêm a ordem relativa. Usado para normalizar a ordem e travar a reordenação.
const FIXED_FIRST_BLOCK = 'banner'
const FIXED_LAST_BLOCK = 'rodape'
const isFixedBlock = (t) => t === FIXED_FIRST_BLOCK || t === FIXED_LAST_BLOCK
function orderInviteBlocks(list) {
  const arr = Array.isArray(list) ? list : []
  const first = arr.filter((b) => b.type === FIXED_FIRST_BLOCK)
  const last = arr.filter((b) => b.type === FIXED_LAST_BLOCK)
  const middle = arr.filter((b) => !isFixedBlock(b.type))
  return [...first, ...middle, ...last]
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

// Data + hora do evento associado (para o cartão de "output" do evento).
function fmtEventWhen(start, end) {
  if (!start) return ''
  const ds = new Date(start)
  if (Number.isNaN(ds.getTime())) return ''
  const dOpts = { day: '2-digit', month: '2-digit', year: 'numeric' }
  const tOpts = { hour: '2-digit', minute: '2-digit' }
  const sDate = ds.toLocaleDateString('pt-PT', dOpts)
  let out = `${sDate} · ${ds.toLocaleTimeString('pt-PT', tOpts)}`
  if (end) {
    const de = new Date(end)
    if (!Number.isNaN(de.getTime())) {
      const eTime = de.toLocaleTimeString('pt-PT', tOpts)
      const eDate = de.toLocaleDateString('pt-PT', dOpts)
      out += eDate === sDate ? ` – ${eTime}` : ` → ${eDate} · ${eTime}`
    }
  }
  return out
}

// Data + hora (para a lista de inscrições e o Excel).
function fmtDateTime(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleString('pt-PT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

// Formata a resposta de um campo do formulário para leitura/exportação.
function formatAnswer(field, value) {
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
  if (typeof value === 'boolean' || field?.type === 'checkbox') return value ? 'Sim' : 'Não'
  return String(value)
}

// Formata um valor de doação (€) para leitura/exportação; vazio se não aplicável.
function fmtDonation(v) {
  const n = Number(v)
  return Number.isFinite(n) && n > 0 ? `${n.toFixed(2)} EUR` : ''
}

// ── Editor de um convite ─────────────────────────────────────────
// Rótulo do botão de gravar consoante o separador ativo.
const SAVE_LABEL = {
  definicoes: 'Guardar definições',
  bilhetes: 'Guardar bilhetes',
  inscricao: 'Guardar inscrição',
  pagina: 'Guardar página',
}

function InviteEditor({ invite, onBack, onSaved, onManageRegistrations }) {
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
    mapUrl: invite.mapUrl ?? '',
    // Banner.
    bannerUrl: invite.bannerUrl ?? '',
    useEventBanner: !!invite.useEventBanner,
    // Modo de inscrição + janela.
    registrationMode: invite.registrationMode ?? 'internal',
    registrationUrl: invite.registrationUrl ?? '',
    rsvpEnabled: invite.rsvpEnabled !== false,
    rsvpStartDate: toDateInput(invite.rsvpStartDatetime),
    rsvpStartTime: toTimeInput(invite.rsvpStartDatetime),
    rsvpEndDate: toDateInput(invite.rsvpDeadline),
    rsvpEndTime: toTimeInput(invite.rsvpDeadline),
    capacity: invite.capacity ?? '',
    waitlistEnabled: invite.waitlistEnabled === true,
    spotsOnLanding: invite.spotsOnLanding === true,
    spotsOnRegistration: invite.spotsOnRegistration === true,
    metaDescription: invite.metaDescription ?? '',
  }))
  const [tickets, setTickets] = useState(() =>
    (invite.tickets || []).map((t) => ({
      ...t,
      partyType: normalizePartyType(t),
      kind: normalizeKind(t.kind),
      paymentMethods:
        Array.isArray(t.paymentMethods) && t.paymentMethods.length
          ? t.paymentMethods
          : t.paymentMethod
            ? [t.paymentMethod]
            : [],
      mbNumbers: Array.isArray(t.mbNumbers) ? t.mbNumbers : [],
    }))
  )
  // Semeia com o evento já associado (mesmo passado) para que apareça sempre.
  const [events, setEvents] = useState(() => (invite.event ? [invite.event] : []))
  const [blocks, setBlocks] = useState(() => orderInviteBlocks(invite.blocks || []))
  const [openBlock, setOpenBlock] = useState(null)
  const [busy, setBusy] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [addType, setAddType] = useState(ADDABLE_TYPES[0]?.type ?? 'info_extra')
  const [guests, setGuests] = useState(null)
  const [payments, setPayments] = useState(null)
  const [tab, setTab] = useState('definicoes')
  const [showFormPreview, setShowFormPreview] = useState(false)
  // Métodos de pagamento ativos (geridos no Admin) para configurar nos bilhetes.
  const [paymentMethodOptions, setPaymentMethodOptions] = useState([])
  // NIB/IBAN partilhado (Definições) — mostrado só-leitura no bilhete (transferência).
  const [inviteIban, setInviteIban] = useState('')

  // Deteção de alterações por guardar: compara o estado gravável atual (definições
  // + bilhetes + blocos, que inclui o formulário) com o último snapshot guardado.
  const [savedSnapshot, setSavedSnapshot] = useState(() => JSON.stringify({ settings, tickets, blocks }))
  const dirty = savedSnapshot !== JSON.stringify({ settings, tickets, blocks })

  // Avisa ao fechar/recarregar o browser com alterações por guardar.
  useEffect(() => {
    if (!dirty) return undefined
    const handler = (e) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [dirty])

  // Voltar: confirma se houver alterações por guardar.
  const handleBack = () => {
    if (dirty && !window.confirm('Tens alterações por guardar. Sair sem guardar?')) return
    onBack()
  }

  // Carrega os eventos associáveis (atuais/futuros), preservando o evento já
  // associado que possa estar fora dessa lista (ex.: já decorreu).
  useEffect(() => {
    let alive = true
    invitesService
      .getSelectableEvents()
      .then((evs) => {
        if (!alive) return
        setEvents((prev) => {
          const extra = prev.filter((p) => !evs.some((e) => e.id === p.id))
          return [...evs, ...extra]
        })
      })
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [])

  // Carrega os métodos de pagamento ativos (para o seletor de métodos dos bilhetes).
  useEffect(() => {
    let alive = true
    getPaymentMethods()
      .then((m) => {
        if (alive) setPaymentMethodOptions((m || []).filter((x) => x.active))
      })
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [])

  // Carrega o NIB/IBAN das Definições de convites (mostrado só-leitura no bilhete).
  useEffect(() => {
    let alive = true
    invitesService
      .getInviteSettings()
      .then((s) => {
        if (alive) setInviteIban(s?.paymentInfo?.iban || '')
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

  // Associa (ou desassocia) um evento: herda título, datas, local, mapa e imagem.
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
            location: ev.location || s.location,
            mapUrl: ev.mapUrl || s.mapUrl,
            bannerUrl: ev.bannerUrl || s.bannerUrl,
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

  // Blocos: visibilidade, remover, adicionar, editar conteúdo (reordenar via movePageBlock).
  const toggleVisible = (i) => setBlocks((b) => b.map((blk, idx) => (idx === i ? { ...blk, visible: !blk.visible } : blk)))
  const removeBlock = (i) => setBlocks((b) => b.filter((_, idx) => idx !== i))
  const setBlockContent = (i, content) => setBlocks((b) => b.map((blk, idx) => (idx === i ? { ...blk, content } : blk)))
  const addBlock = () => {
    // Insere antes do rodapé (que fica sempre em último); o próprio rodapé vai para o fim.
    const footerIdx = addType === FIXED_LAST_BLOCK ? -1 : blocks.findIndex((x) => x.type === FIXED_LAST_BLOCK)
    const insertAt = footerIdx === -1 ? blocks.length : footerIdx
    const newBlock = { id: null, type: addType, visible: true, content: defaultContent(addType) }
    setBlocks((b) => [...b.slice(0, insertAt), newBlock, ...b.slice(insertAt)])
    setOpenBlock(insertAt)
  }

  // Bilhetes: adicionar/editar/remover tipos.
  const addTicket = () =>
    setTickets((t) => [...t, { id: null, name: '', kind: 'individual', partyType: 'single', price: '', capacity: '', groupSize: '', paymentMethods: [], mbEntity: '', mbReference: '', mbNumbers: [], refundDeadline: '', childMaxAge: '', adultMinAge: '', active: true }])
  const setTicketField = (i, k, v) => setTickets((t) => t.map((tk, idx) => (idx === i ? { ...tk, [k]: v } : tk)))
  const removeTicket = (i) => setTickets((t) => t.filter((_, idx) => idx !== i))

  const buildSettingsPayload = () => ({
    eventId: settings.eventId || null,
    title: settings.title.trim(),
    colorTheme: settings.colorTheme || null,
    startDatetime: combineDateTime(settings.startDate, settings.startTime),
    endDatetime: settings.endDate ? combineDateTime(settings.endDate, settings.endTime) : null,
    location: settings.location.trim() || null,
    mapUrl: settings.mapUrl.trim() || null,
    bannerUrl: settings.bannerUrl.trim() || null,
    useEventBanner: settings.useEventBanner,
    metaImageUrl: settings.bannerUrl.trim() || null,
    metaDescription: settings.metaDescription.trim() || null,
    costType: hasPaidTicket(tickets) ? 'pago' : 'gratuito',
    costAmount: null,
    paymentMethod: firstPaidTicketMethod(tickets),
    rsvpEnabled: settings.rsvpEnabled,
    registrationMode: settings.registrationMode,
    registrationUrl: settings.registrationMode === 'external' ? settings.registrationUrl.trim() || null : null,
    rsvpStartDatetime: settings.rsvpStartDate ? combineDateTime(settings.rsvpStartDate, settings.rsvpStartTime || '00:00') : null,
    rsvpDeadline: settings.rsvpEndDate ? combineDateTime(settings.rsvpEndDate, settings.rsvpEndTime || '23:59') : null,
    capacity: settings.capacity ? Number(settings.capacity) : null,
    waitlistEnabled: settings.waitlistEnabled,
    spotsOnLanding: settings.spotsOnLanding,
    spotsOnRegistration: settings.spotsOnRegistration,
    // Sem override por convite: usa a comunidade da inscrição (resolvida no backend).
    jotformCommunity: null,
  })

  const save = async () => {
    if (!settings.title.trim()) {
      toast.error('O título é obrigatório.')
      return
    }
    setBusy(true)
    try {
      await invitesService.updateInvite(invite.id, buildSettingsPayload())
      await invitesService.saveTickets(
        invite.id,
        tickets
          .filter((t) => (t.name || '').trim())
          .map((t) => ({
            id: t.id || null,
            name: t.name.trim(),
            kind: normalizeKind(t.kind),
            partyType: normalizePartyType(t),
            price: t.kind === 'gratis' ? 0 : t.price === '' || t.price == null ? null : Number(t.price),
            capacity: t.capacity === '' || t.capacity == null ? null : Number(t.capacity),
            groupSize:
              normalizePartyType(t) !== 'single' ? (t.groupSize === '' || t.groupSize == null ? null : Number(t.groupSize)) : null,
            paymentMethods: ticketIsFree(t) ? [] : ticketMethods(t),
            paymentMethod: ticketIsFree(t) ? null : ticketMethods(t)[0] || null,
            mbEntity: (t.mbEntity || '').trim() || null,
            mbReference: (t.mbReference || '').trim() || null,
            mbNumbers: (t.mbNumbers || []).map((n) => String(n).trim()).filter(Boolean).slice(0, 4),
            refundDeadline: normalizeKind(t.kind) === 'individual' ? t.refundDeadline || null : null,
            childMaxAge: t.childMaxAge === '' || t.childMaxAge == null ? null : Number(t.childMaxAge),
            adultMinAge: t.adultMinAge === '' || t.adultMinAge == null ? null : Number(t.adultMinAge),
            active: t.active !== false,
          }))
      )
      const updated = await invitesService.saveInviteBlocks(
        invite.id,
        blocks.map((b) => ({
          type: b.type,
          visible: b.visible,
          // Materializa os campos do formulário no bloco rsvp para o backend poder
          // validar obrigatórios/consentimentos server-side.
          content: b.type === 'rsvp' ? { ...b.content, fields: getFormFields(b.content) } : b.content,
        }))
      )
      setSavedSnapshot(JSON.stringify({ settings, tickets, blocks }))
      toast.success('Convite guardado.')
      onSaved?.(updated)
    } catch (err) {
      toast.error(err.message)
    } finally {
      setBusy(false)
    }
  }

  const changeStatus = async (status) => {
    // Inscrições internas exigem pelo menos um tipo de bilhete antes de publicar.
    if (
      status === 'publicado' &&
      settings.registrationMode === 'internal' &&
      !tickets.some((t) => (t.name || '').trim())
    ) {
      toast.error('Cria pelo menos um tipo de bilhete antes de publicar (inscrições internas).')
      return
    }
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
        hasPaidTicket(tickets) ? invitesService.listInvitePayments(invite.id) : Promise.resolve([]),
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

  // Colunas de respostas do formulário (vista detalhada + Excel). Derivadas da
  // configuração do bloco RSVP, mais quaisquer chaves órfãs presentes nas respostas.
  const rsvpBlock = blocks.find((b) => b.type === 'rsvp')
  // À-prova-de-edições: junta o schema ATUAL com os snapshots guardados em cada
  // inscrição, para continuar a mostrar (com o rótulo original) campos entretanto
  // removidos/renomeados no formulário depois de já haver inscrições.
  const answerFields = mergeFormSchemas(
    getFormFields(rsvpBlock?.content || {}),
    (guests || []).map((g) => g.schemaSnapshot)
  ).filter((f) => f.type !== 'section' && !SYSTEM_KEYS.includes(f.key))
  const extraAnswerKeys = (() => {
    const known = new Set(answerFields.map((f) => f.key))
    known.add('donationAmount') // apresentado numa coluna própria "Doação"
    known.add('membros') // lista de membros (família/grupo) — coluna própria
    known.add('tipoInscricao') // individual/família/grupo — coluna própria
    known.add('numCriancas') // nº de crianças — coluna própria (não conta p/ assistência)
    const keys = []
    for (const g of guests || []) {
      for (const k of Object.keys(g.extra || {})) {
        if (!known.has(k) && !keys.includes(k)) keys.push(k)
      }
    }
    return keys
  })()
  const ticketName = (id) => tickets.find((t) => t.id === id)?.name || ''

  // Formulário de inscrição (bloco rsvp) editado num separador próprio, fora dos blocos.
  const rsvpIndex = blocks.findIndex((b) => b.type === 'rsvp')
  const setRsvpContent = (content) => {
    if (rsvpIndex >= 0) setBlockContent(rsvpIndex, content)
    else setBlocks((bs) => [...bs, { id: null, type: 'rsvp', visible: true, content }])
  }
  // Blocos da PÁGINA (exclui o rsvp, que se configura no separador Formulário).
  const pageBlocks = blocks.map((b, i) => ({ b, i })).filter(({ b }) => b.type !== 'rsvp')
  const movePageBlock = (vi, dir) => {
    const target = vi + dir
    if (target < 0 || target >= pageBlocks.length) return
    // Banner fica sempre em primeiro e rodapé em último: não se movem nem se trocam.
    if (isFixedBlock(pageBlocks[vi].b.type) || isFixedBlock(pageBlocks[target].b.type)) return
    const a = pageBlocks[vi].i
    const bIdx = pageBlocks[target].i
    setBlocks((bs) => {
      const n = [...bs]
      ;[n[a], n[bIdx]] = [n[bIdx], n[a]]
      return n
    })
  }
  // Resumo (KPIs) das inscrições para o separador “Inscrições” (só indicadores).
  const guestStats = (() => {
    const list = guests || []
    const bySit = (key) => list.filter((g) => inscricaoSituacao(g) === key).length
    const ppl = list.reduce(
      (acc, g) => {
        if (g.rsvpState === 'confirmed') {
          const p = classifyGuestPeople(g, g.ticket)
          acc.adultos += p.adultos
          acc.jovens += p.jovens
          acc.criancas += p.criancas
          acc.total += p.total
        }
        return acc
      },
      { adultos: 0, jovens: 0, criancas: 0, total: 0 }
    )
    return {
      total: list.length,
      confirmada: bySit('confirmada'),
      comprovativo: bySit('comprovativo'),
      validacao: bySit('validacao'),
      espera: bySit('espera'),
      cancelada: bySit('cancelada'),
      reembolso: bySit('reembolso') + bySit('reembolsado'),
      ppl,
    }
  })()

  // Página sintética para a pré-visualização do formulário (sem submeter).
  const previewPage = {
    slug: invite.slug,
    invite: {
      costType: hasPaidTicket(tickets) ? 'pago' : 'gratuito',
      costAmount: null,
      costCurrency: 'EUR',
      // Rótulos dos métodos de pagamento configurados (para a pré-visualização
      // mostrar os mesmos nomes que a página pública, incl. renomeados/personalizados).
      paymentMethodLabels: Object.fromEntries((paymentMethodOptions || []).map((m) => [m.key, m.label])),
      paymentMethodType: Object.fromEntries((paymentMethodOptions || []).map((m) => [m.key, m.type])),
      paymentMethodNumbers: Object.fromEntries((paymentMethodOptions || []).filter((m) => m.type === 'mbway').map((m) => [m.key, m.numbers || []])),
      rsvpStartDatetime: settings.rsvpStartDate ? combineDateTime(settings.rsvpStartDate, settings.rsvpStartTime || '00:00') : null,
      rsvpDeadline: settings.rsvpEndDate ? combineDateTime(settings.rsvpEndDate, settings.rsvpEndTime || '23:59') : null,
    },
    tickets: (tickets || [])
      .filter((t) => (t.name || '').trim() && t.active !== false)
      .map((t) => ({
        id: t.id || t.name,
        name: t.name,
        price: t.price === '' || t.price == null ? null : Number(t.price),
        currency: 'EUR',
        kind: t.kind,
        partyType: normalizePartyType(t),
        groupSize: t.groupSize ? Number(t.groupSize) : null,
        paymentMethods: ticketMethods(t),
        mbEntity: t.mbEntity || null,
        mbReference: t.mbReference || null,
        soldOut: false,
      })),
  }

  // Exporta as inscrições para CSV (abre no Excel): BOM UTF-8 + separador ';'.
  const exportGuests = () => {
    if (!guests || guests.length === 0) return
    // Campos do tipo 'children' → expandidos em colunas por criança (Nome/Idade/
    // Alergias), até ao máximo de crianças existente, para se poder contabilizar.
    const childRowsOf = (g, key) =>
      (Array.isArray(g.extra?.[key]) ? g.extra[key] : []).filter((c) => c && (c.nome || c.idade || c.alergias))
    const childCols = []
    for (const f of answerFields.filter((af) => af.type === 'children')) {
      const max = guests.reduce((m, g) => Math.max(m, childRowsOf(g, f.key).length), 0)
      const base = f.label || f.key
      for (let k = 0; k < max; k += 1) {
        childCols.push([`${base} ${k + 1} — Nome`, (g) => childRowsOf(g, f.key)[k]?.nome || ''])
        childCols.push([`${base} ${k + 1} — Idade`, (g) => childRowsOf(g, f.key)[k]?.idade ?? ''])
        childCols.push([`${base} ${k + 1} — Alergias`, (g) => childRowsOf(g, f.key)[k]?.alergias || ''])
      }
    }
    const cols = [
      ['Nº do bilhete', (g) => g.code || ''],
      ['Nome', (g) => g.name || ''],
      ['Email', (g) => g.email || ''],
      ['Telemóvel', (g) => g.phone || ''],
      ['Estado', (g) => SITUACAO_LABEL[inscricaoSituacao(g)] || ''],
      ['Pagamento', (g) => (g.paymentState === 'not_applicable' ? '' : PAY_LABEL[g.paymentState] || g.paymentState || '')],
      ['Bilhete', (g) => ticketName(g.ticketId)],
      ['Tipo de inscrição', (g) => g.extra?.tipoInscricao || ''],
      ['Membros', (g) => formatAnswer(null, g.extra?.membros)],
      ['Doação (€)', (g) => fmtDonation(g.extra?.donationAmount)],
      ['Lugares', (g) => g.guestsCount ?? ''],
      ['Nº de crianças', (g) => (g.extra?.numCriancas != null ? g.extra.numCriancas : '')],
      ['Data de inscrição', (g) => fmtDateTime(g.respondedAt || g.createdAt)],
      ['Check-in', (g) => (g.checkedInAt ? fmtDateTime(g.checkedInAt) : '')],
      ...answerFields.filter((f) => f.type !== 'children').map((f) => [f.label || f.key, (g) => formatAnswer(f, g.extra?.[f.key])]),
      ...childCols,
      ...extraAnswerKeys.map((k) => [k, (g) => formatAnswer(null, g.extra?.[k])]),
    ]
    const cell = (v) => {
      const s = String(v ?? '')
      return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
    }
    const lines = [cols.map((c) => cell(c[0])).join(';')]
    for (const g of guests) lines.push(cols.map((c) => cell(c[1](g))).join(';'))
    const csv = '\uFEFF' + lines.join('\r\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `inscricoes-${invite.slug}.csv`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }

  // Evento do calendário atualmente associado (para o cartão de "output").
  const selectedEvent = events.find((e) => e.id === settings.eventId) || null

  // Modo de inscrição → separadores dinâmicos + roteiro (semáforo de conclusão).
  const isInternal = settings.registrationMode === 'internal'
  const hasAnyTicket = tickets.some((t) => (t.name || '').trim())
  const tabs = [
    { id: 'definicoes', label: 'Definições' },
    ...(isInternal ? [{ id: 'bilhetes', label: 'Bilhetes' }, { id: 'inscricao', label: 'Inscrição' }] : []),
    { id: 'pagina', label: 'Página' },
    ...(isInternal ? [{ id: 'checkin', label: 'Check-in' }] : []),
  ]
  const activeTab = tabs.some((t) => t.id === tab) ? tab : 'definicoes'
  const roadmap = [
    { label: 'Definições', tabId: 'definicoes', done: Boolean(settings.title.trim()) },
    ...(isInternal
      ? [
          { label: 'Bilhete', tabId: 'bilhetes', done: hasAnyTicket },
          { label: 'Inscrição', tabId: 'inscricao', done: hasAnyTicket && settings.rsvpEnabled },
        ]
      : []),
    ...(settings.registrationMode === 'external'
      ? [{ label: 'Inscrição', tabId: 'definicoes', done: Boolean(settings.registrationUrl.trim()) }]
      : []),
    { label: 'Página', tabId: 'pagina', done: pageBlocks.length > 0 },
  ]

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={handleBack} className={ghostBtn}>
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
          <a
            href={`${publicUrl(invite.slug)}?preview=${invite.id}`}
            target="_blank"
            rel="noreferrer"
            className={ghostBtn}
          >
            <Eye className="h-4 w-4" aria-hidden="true" />
            Pré-visualizar
          </a>
          {isInternal ? (
            <button type="button" onClick={onManageRegistrations} className={ghostBtn}>
              <Users className="h-4 w-4" aria-hidden="true" />
              Gestão de Inscrições
            </button>
          ) : null}
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

      {/* Semáforo de conclusão por etapa */}
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-muted/30 p-3">
        {roadmap.map((step, i) => (
          <button
            key={`${step.tabId}-${i}`}
            type="button"
            onClick={() => setTab(step.tabId)}
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-2.5 py-1 text-xs font-semibold text-foreground transition-colors hover:bg-accent"
            title={step.done ? 'Concluído' : 'Por concluir'}
          >
            <span className={`h-2.5 w-2.5 flex-shrink-0 rounded-full ${step.done ? 'bg-emerald-500' : 'bg-amber-400'}`} aria-hidden="true" />
            {step.label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-1 border-b border-border">
        {tabs.map((tb) => (
          <button
            key={tb.id}
            type="button"
            onClick={() => setTab(tb.id)}
            className={
              'rounded-t-lg px-3 py-2 text-sm font-semibold transition-colors ' +
              (activeTab === tb.id
                ? 'border-b-2 border-primary text-foreground'
                : 'text-muted-foreground hover:text-foreground')
            }
          >
            {tb.label}
          </button>
        ))}
      </div>

      {activeTab === 'definicoes' ? (
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
              Escolha um evento atual ou futuro do calendário para herdar o título, as datas e a imagem. Cada convite liga-se a um único evento. As datas do evento e das inscrições são independentes.
            </span>
          </label>

          {/* Evento escolhido — mostrado como "output" (só leitura) */}
          {selectedEvent ? (
            <div className="flex items-start gap-3 rounded-lg border border-primary/30 bg-primary/5 p-3">
              {selectedEvent.bannerUrl ? (
                <img src={selectedEvent.bannerUrl} alt="" className="h-16 w-24 flex-shrink-0 rounded-md object-cover" />
              ) : (
                <div className="flex h-16 w-24 flex-shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                  <CalendarIcon className="h-5 w-5" aria-hidden="true" />
                </div>
              )}
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-primary">
                  <CalendarIcon className="h-3.5 w-3.5" aria-hidden="true" />
                  Evento do calendário
                </span>
                <span className="truncate text-sm font-bold text-foreground">{selectedEvent.title}</span>
                {fmtEventWhen(selectedEvent.startDatetime, selectedEvent.endDatetime) ? (
                  <span className="text-xs text-muted-foreground">
                    {fmtEventWhen(selectedEvent.startDatetime, selectedEvent.endDatetime)}
                  </span>
                ) : null}
                {selectedEvent.location ? (
                  <span className="flex items-center gap-1 truncate text-xs text-muted-foreground">
                    <MapPin className="h-3.5 w-3.5 flex-shrink-0" aria-hidden="true" />
                    {selectedEvent.location}
                  </span>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => pickEvent('')}
                className="flex-shrink-0 rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs font-semibold text-foreground transition-colors hover:bg-accent"
              >
                Desassociar
              </button>
            </div>
          ) : null}

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
            Local / morada
            <input className={inputCls} value={settings.location} onChange={setField('location')} />
          </label>

          <label className={labelCls}>
            Localização Google (link do Maps)
            <input className={inputCls} type="url" placeholder="https://maps.google.com/…" value={settings.mapUrl} onChange={setField('mapUrl')} />
            <span className="text-xs text-muted-foreground">Herdado do evento associado; podes também colar um link do Google Maps.</span>
          </label>

          {/* Modo de inscrição */}
          <label className={labelCls}>
            Inscrições
            <select className={inputCls} value={settings.registrationMode} onChange={setField('registrationMode')}>
              <option value="none">Sem inscrição</option>
              <option value="external">Com inscrição externa (link)</option>
              <option value="internal">Com inscrição interna (nesta página)</option>
            </select>
            <span className="text-xs text-muted-foreground">
              Interna: bilhetes + formulário nesta plataforma (separadores próprios). Externa: encaminha para um link. Sem inscrição: só página informativa.
            </span>
          </label>

          {settings.registrationMode === 'external' ? (
            <label className={labelCls}>
              Link de inscrição externa
              <input className={inputCls} type="url" placeholder="https://…" value={settings.registrationUrl} onChange={setField('registrationUrl')} />
            </label>
          ) : null}
        </div>
      </section>
      ) : null}

      {activeTab === 'bilhetes' ? (
      <section className="rounded-xl border border-border bg-card p-4">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="m-0 text-sm font-bold uppercase tracking-wide text-muted-foreground">Bilhetes</h3>
          <button type="button" onClick={addTicket} className={ghostBtn}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            Adicionar bilhete
          </button>
        </div>
        <p className="m-0 mb-3 text-xs text-muted-foreground">
          O custo da inscrição é definido pelos bilhetes. Preço: pago (com valor), grátis (0€) ou doação (valor à escolha). Tipo de inscrição: individual, família ou grupo (família/grupo abrem a lista de membros no formulário). O método de pagamento define-se em cada bilhete pago.
        </p>
        {tickets.length === 0 ? (
          <p className="m-0 text-sm text-muted-foreground">
            Sem bilhetes — a inscrição é gratuita. Adicione bilhetes para definir tipos e custos.
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
                        {TICKET_KINDS.map((k) => (
                          <option key={k.value} value={k.value}>
                            {k.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
                      Tipo de inscrição
                      <select className={inputCls} value={normalizePartyType(t)} onChange={(e) => setTicketField(i, 'partyType', e.target.value)}>
                        {PARTY_TYPES.map((p) => (
                          <option key={p.value} value={p.value}>
                            {p.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-3">
                      {t.kind === 'gratis' ? (
                        <input className={inputCls + ' text-muted-foreground'} value="Grátis (0€)" disabled readOnly />
                      ) : (
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          className={inputCls}
                          placeholder={t.kind === 'voluntaria' ? 'Valor sugerido (€)' : 'Preço (€)'}
                          value={t.price}
                          onChange={(e) => setTicketField(i, 'price', e.target.value)}
                        />
                      )}
                      <input type="number" min="1" className={inputCls} placeholder="Capacidade" value={t.capacity} onChange={(e) => setTicketField(i, 'capacity', e.target.value)} />
                      {normalizePartyType(t) !== 'single' ? (
                        <input type="number" min="1" className={inputCls} placeholder="Máx. de pessoas" value={t.groupSize} onChange={(e) => setTicketField(i, 'groupSize', e.target.value)} />
                      ) : (
                        <span />
                      )}
                    </div>
                    <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                      <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
                        Criança até aos (anos)
                        <input type="number" min="0" max="120" className={inputCls} placeholder="ex.: 10" value={t.childMaxAge ?? ''} onChange={(e) => setTicketField(i, 'childMaxAge', e.target.value)} />
                      </label>
                      <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
                        Adulto a partir dos (anos)
                        <input type="number" min="0" max="120" className={inputCls} placeholder="ex.: 18" value={t.adultMinAge ?? ''} onChange={(e) => setTicketField(i, 'adultMinAge', e.target.value)} />
                      </label>
                    </div>
                    <p className="m-0 text-xs text-muted-foreground">
                      Idades usadas para contar crianças e adultos nas inscrições deste bilhete. Em branco = criança com menos de 11 anos.
                    </p>
                    {t.kind === 'individual' ? (
                      <label className="flex flex-col gap-1 text-sm font-medium text-foreground sm:max-w-[16rem]">
                        Data limite de reembolso
                        <DateField
                          value={t.refundDeadline || ''}
                          onChange={(v) => setTicketField(i, 'refundDeadline', v)}
                          className={inputCls}
                          ariaLabel="Data limite de reembolso"
                        />
                        <span className="text-xs font-normal text-muted-foreground">
                          Até esta data (inclusive) o inscrito pode pedir reembolso na página de gestão. Em branco = sem reembolso.
                        </span>
                      </label>
                    ) : null}
                    {normalizePartyType(t) !== 'single' ? (
                      <p className="m-0 text-xs text-muted-foreground">
                        No formulário público, este bilhete abre a lista de membros do grupo — pede nome, idade e (se for menor de 11) observações.
                      </p>
                    ) : null}
                    {t.kind === 'voluntaria' ? (
                      <p className="m-0 text-xs text-muted-foreground">
                        No formulário público, o doador indica o valor que quiser (o valor acima é apenas sugerido).
                      </p>
                    ) : null}
                    {!ticketIsFree(t) ? (
                      <div className="flex flex-col gap-1 text-sm font-medium text-foreground">
                        Métodos de pagamento
                        {paymentMethodOptions.length === 0 ? (
                          <span className="text-xs font-normal text-muted-foreground">
                            Sem métodos ativos. Ative-os em “Métodos de pagamento” (no topo da lista de convites).
                          </span>
                        ) : (
                          <div className="flex flex-wrap gap-x-4 gap-y-1.5">
                            {paymentMethodOptions.map((pm) => {
                              const selected = (t.paymentMethods || []).includes(pm.key)
                              return (
                                <label key={pm.key} className="inline-flex items-center gap-1.5 text-sm font-normal text-foreground">
                                  <input
                                    type="checkbox"
                                    checked={selected}
                                    onChange={(e) => {
                                      const cur = t.paymentMethods || []
                                      const next = e.target.checked ? [...cur, pm.key] : cur.filter((k) => k !== pm.key)
                                      setTicketField(i, 'paymentMethods', next)
                                    }}
                                  />
                                  {pm.label}
                                </label>
                              )
                            })}
                          </div>
                        )}
                        <span className="text-xs font-normal text-muted-foreground">
                          Escolha os métodos disponíveis para este bilhete (o convidado escolhe um). Processamento a desenvolver.
                        </span>
                      </div>
                    ) : null}
                    {!ticketIsFree(t) &&
                    paymentMethodOptions.some((pm) => pm.type === 'referencia-multibanco' && (t.paymentMethods || []).includes(pm.key)) ? (
                      <div className="flex flex-col gap-1">
                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                          <input
                            className={inputCls}
                            placeholder="Entidade (Ref. Multibanco)"
                            value={t.mbEntity || ''}
                            onChange={(e) => setTicketField(i, 'mbEntity', e.target.value)}
                          />
                          <input
                            className={inputCls}
                            placeholder="Referência"
                            value={t.mbReference || ''}
                            onChange={(e) => setTicketField(i, 'mbReference', e.target.value)}
                          />
                        </div>
                        <span className="text-xs font-normal text-muted-foreground">
                          Entidade e referência Multibanco deste bilhete (mostradas ao convidado que escolher este método).
                        </span>
                      </div>
                    ) : null}
                    {/* MB WAY: números editáveis por bilhete (em branco usa os do método). */}
                    {!ticketIsFree(t) &&
                    paymentMethodOptions.some((pm) => pm.type === 'mbway' && (t.paymentMethods || []).includes(pm.key)) ? (
                      <div className="flex flex-col gap-1.5">
                        <span className="text-sm font-medium text-foreground">Números MB WAY</span>
                        {(t.mbNumbers || []).map((num, ni) => (
                          <div key={ni} className="flex items-center gap-2">
                            <input
                              className={inputCls}
                              inputMode="tel"
                              placeholder="Número MB WAY (ex.: 912345678)"
                              value={num}
                              onChange={(e) => {
                                const next = [...(t.mbNumbers || [])]
                                next[ni] = e.target.value
                                setTicketField(i, 'mbNumbers', next)
                              }}
                            />
                            <button
                              type="button"
                              onClick={() => setTicketField(i, 'mbNumbers', (t.mbNumbers || []).filter((_, x) => x !== ni))}
                              className="rounded p-1 text-destructive hover:bg-destructive/10"
                              aria-label="Remover número"
                            >
                              <Trash2 className="h-4 w-4" aria-hidden="true" />
                            </button>
                          </div>
                        ))}
                        {(t.mbNumbers || []).length < 4 ? (
                          <button
                            type="button"
                            onClick={() => setTicketField(i, 'mbNumbers', [...(t.mbNumbers || []), ''])}
                            className="inline-flex items-center gap-1 self-start text-xs font-semibold text-primary hover:underline"
                          >
                            <Plus className="h-3.5 w-3.5" aria-hidden="true" /> Adicionar número
                          </button>
                        ) : null}
                        <span className="text-xs font-normal text-muted-foreground">
                          Até 4 números MB WAY deste bilhete. Em branco, usa os números definidos no método de pagamento.
                        </span>
                      </div>
                    ) : null}
                    {/* Transferência: NIB só-leitura (definido nas Definições de convites). */}
                    {!ticketIsFree(t) &&
                    paymentMethodOptions.some((pm) => pm.type === 'transferencia' && (t.paymentMethods || []).includes(pm.key)) ? (
                      <div className="flex flex-col gap-1">
                        <span className="text-sm font-medium text-foreground">NIB / IBAN (transferência)</span>
                        <input
                          className={inputCls + ' bg-muted text-muted-foreground'}
                          value={inviteIban || 'Defina o IBAN nas Definições de convites'}
                          readOnly
                          aria-readonly="true"
                        />
                        <span className="text-xs font-normal text-muted-foreground">
                          Partilhado por todos os convites (Definições). Aqui é apenas visualização.
                        </span>
                      </div>
                    ) : null}
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

      {activeTab === 'inscricao' ? (
        <>
        <section className="rounded-xl border border-border bg-card p-4">
          <h3 className="m-0 mb-3 text-sm font-bold uppercase tracking-wide text-muted-foreground">Inscrições</h3>
          <div className="flex flex-col gap-3">
            {!hasAnyTicket ? (
              <p className="m-0 rounded-lg bg-amber-100 p-2 text-xs text-amber-800 dark:bg-amber-500/15 dark:text-amber-300">
                As inscrições precisam de pelo menos um tipo de bilhete. Cria bilhetes no separador “Bilhetes”.
              </p>
            ) : null}
            <p className="m-0 text-xs font-bold uppercase tracking-wide text-muted-foreground">Datas das inscrições</p>
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
            <div className="flex flex-col gap-1">
              <label className="inline-flex items-center gap-3 text-sm font-medium text-foreground">
                <Switch checked={settings.rsvpEnabled} onCheckedChange={(v) => setSettings((s) => ({ ...s, rsvpEnabled: v }))} />
                Inscrições {settings.rsvpEnabled ? 'abertas' : 'fechadas'}
              </label>
              {settings.rsvpEnabled && invite.status !== 'publicado' ? (
                <span className="text-xs text-amber-700 dark:text-amber-400">
                  As inscrições só abrem depois de publicar o convite.
                </span>
              ) : null}
            </div>
            <div className="flex flex-col gap-1">
              <label className="inline-flex items-center gap-3 text-sm font-medium text-foreground">
                <Switch checked={settings.waitlistEnabled} onCheckedChange={(v) => setSettings((s) => ({ ...s, waitlistEnabled: v }))} />
                Lista de espera {settings.waitlistEnabled ? 'ativa' : 'inativa'}
              </label>
              <span className="text-xs text-muted-foreground">
                {settings.waitlistEnabled
                  ? 'Com a lotação esgotada, o convidado pode inscrever-se em lista de espera (é avisado antes).'
                  : 'Com a lotação esgotada, as inscrições ficam indisponíveis.'}
              </span>
            </div>
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Contador de vagas</span>
              <label className="inline-flex items-center gap-3 text-sm font-medium text-foreground">
                <Switch checked={settings.spotsOnLanding} onCheckedChange={(v) => setSettings((s) => ({ ...s, spotsOnLanding: v }))} />
                Mostrar na página inicial
              </label>
              <label className="inline-flex items-center gap-3 text-sm font-medium text-foreground">
                <Switch checked={settings.spotsOnRegistration} onCheckedChange={(v) => setSettings((s) => ({ ...s, spotsOnRegistration: v }))} />
                Mostrar na inscrição
              </label>
              <span className="text-xs text-muted-foreground">Requer capacidade definida.</span>
            </div>
          </div>
        </section>
        <section className="rounded-xl border border-border bg-card p-4">
          <div className="mb-1 flex items-center justify-between gap-2">
            <h3 className="m-0 text-sm font-bold uppercase tracking-wide text-muted-foreground">Formulário de inscrição</h3>
            <button type="button" onClick={() => setShowFormPreview((v) => !v)} className={ghostBtn}>
              <Eye className="h-4 w-4" aria-hidden="true" />
              {showFormPreview ? 'Editar campos' : 'Pré-visualizar'}
            </button>
          </div>
          <p className="m-0 mb-3 text-xs text-muted-foreground">
            Configure aqui os campos que os convidados preenchem — é um assunto à parte dos blocos da página.
          </p>
          {showFormPreview ? (
            <div className="rounded-xl border border-dashed border-border bg-muted/30 p-3">
              <RsvpCard
                block={{ content: rsvpBlock?.content || {} }}
                page={previewPage}
                accent={settings.colorTheme || '#1F3864'}
                guestStatus={null}
                onSubmitted={() => {}}
                preview
              />
            </div>
          ) : (
            <RsvpEditor content={rsvpBlock?.content || {}} onChange={setRsvpContent} tickets={tickets} />
          )}
        </section>
        </>
      ) : null}

      {activeTab === 'pagina' ? (
        <>
      {/* Blocos de conteúdo */}
      <section className="rounded-xl border border-border bg-card p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="m-0 text-sm font-bold uppercase tracking-wide text-muted-foreground">Blocos da página</h3>
        </div>
        <ul className="m-0 flex list-none flex-col gap-2 p-0">
          {pageBlocks.map(({ b: block, i }, vi) => {
            const fixed = isFixedBlock(block.type)
            const upDisabled = vi === 0 || fixed || isFixedBlock(pageBlocks[vi - 1].b.type)
            const downDisabled = vi === pageBlocks.length - 1 || fixed || isFixedBlock(pageBlocks[vi + 1].b.type)
            return (
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
                <button type="button" onClick={() => movePageBlock(vi, -1)} disabled={upDisabled} className="rounded p-1 text-muted-foreground hover:bg-accent disabled:opacity-30" aria-label="Subir">
                  <ArrowUp className="h-4 w-4" aria-hidden="true" />
                </button>
                <button type="button" onClick={() => movePageBlock(vi, 1)} disabled={downDisabled} className="rounded p-1 text-muted-foreground hover:bg-accent disabled:opacity-30" aria-label="Descer">
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
            )
          })}
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
        </>
      ) : null}

      {activeTab === 'checkin' ? <CheckinAdmin invite={invite} /> : null}

      {activeTab === 'inscricoes' ? (
        <>
      {/* Inscrições */}
      <section className="rounded-xl border border-border bg-card p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="m-0 text-sm font-bold uppercase tracking-wide text-muted-foreground">Inscrições — resumo</h3>
          <div className="flex flex-wrap gap-2">
            {guests && guests.length > 0 ? (
              <button type="button" onClick={exportGuests} className={ghostBtn}>
                <Download className="h-4 w-4" aria-hidden="true" />
                Exportar Excel
              </button>
            ) : null}
            <button type="button" onClick={loadGuests} className={ghostBtn}>
              <Users className="h-4 w-4" aria-hidden="true" />
              {guests ? 'Atualizar' : 'Ver KPIs'}
            </button>
          </div>
        </div>
        {guests ? (
          guests.length === 0 ? (
            <p className="m-0 mt-3 text-sm text-muted-foreground">Ainda não há inscrições.</p>
          ) : (
            <div className="mt-3 flex flex-col gap-3">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-7">
                {[
                  { label: 'Inscrições', value: guestStats.total, cls: 'text-foreground' },
                  { label: 'Confirmadas', value: guestStats.confirmada, cls: 'text-emerald-700 dark:text-emerald-400' },
                  { label: 'Pendente comprovativo', value: guestStats.comprovativo, cls: 'text-amber-700 dark:text-amber-400' },
                  { label: 'Aprovação pendente', value: guestStats.validacao, cls: 'text-sky-700 dark:text-sky-400' },
                  { label: 'Lista de espera', value: guestStats.espera, cls: 'text-amber-700 dark:text-amber-400' },
                  { label: 'Canceladas', value: guestStats.cancelada, cls: 'text-red-700 dark:text-red-400' },
                  { label: 'Reembolsos', value: guestStats.reembolso, cls: 'text-orange-700 dark:text-orange-400' },
                ].map((s) => (
                  <div key={s.label} className="rounded-lg border border-border bg-background p-3 text-center">
                    <div className={`text-2xl font-bold ${s.cls}`}>{s.value}</div>
                    <div className="text-xs text-muted-foreground">{s.label}</div>
                  </div>
                ))}
              </div>
              <div className="rounded-lg border border-border bg-background p-3">
                <p className="m-0 mb-2 text-xs font-semibold uppercase text-muted-foreground">Pessoas (confirmadas)</p>
                <div className="flex flex-wrap gap-4 text-sm">
                  <div>
                    <span className="text-xl font-bold text-foreground">{guestStats.ppl.adultos}</span>{' '}
                    <span className="text-xs text-muted-foreground">adultos</span>
                  </div>
                  {guestStats.ppl.jovens ? (
                    <div>
                      <span className="text-xl font-bold text-foreground">{guestStats.ppl.jovens}</span>{' '}
                      <span className="text-xs text-muted-foreground">jovens</span>
                    </div>
                  ) : null}
                  <div>
                    <span className="text-xl font-bold text-foreground">{guestStats.ppl.criancas}</span>{' '}
                    <span className="text-xs text-muted-foreground">crianças</span>
                  </div>
                  <div>
                    <span className="text-xl font-bold text-primary">{guestStats.ppl.total}</span>{' '}
                    <span className="text-xs text-muted-foreground">total</span>
                  </div>
                </div>
              </div>
              <p className="m-0 text-xs text-muted-foreground">
                Para gerir cada inscrição em detalhe (editar, cancelar, reembolsar, notas), abra{' '}
                <span className="font-semibold text-foreground">Convites → Inscrições</span>.
              </p>
            </div>
          )
        ) : (
          <p className="m-0 mt-3 text-sm text-muted-foreground">Clique em “Ver KPIs” para carregar o resumo.</p>
        )}
      </section>

      {/* Pagamentos (só quando há bilhetes pagos) */}
      {hasPaidTicket(tickets) && payments ? (
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
        </>
      ) : null}

      {/* Barra de ações fixa em baixo */}
      <div className="sticky bottom-0 -mx-1 flex items-center justify-end gap-2 border-t border-border bg-background/95 py-3 backdrop-blur">
        {dirty ? (
          <span className="mr-auto inline-flex items-center gap-1.5 text-xs font-semibold text-amber-600 dark:text-amber-400">
            <span className="h-2 w-2 rounded-full bg-amber-500" aria-hidden="true" />
            Alterações por guardar
          </span>
        ) : null}
        <button type="button" onClick={save} disabled={busy} className={primaryBtn}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
          {SAVE_LABEL[activeTab] || 'Guardar convite'}
        </button>
      </div>
    </div>
  )
}

// ── Lista + criação ──────────────────────────────────────────────
export default function InvitesAdmin() {
  const { hasRole } = useAuth()
  const isAdmin = hasRole('admin')
  const [invites, setInvites] = useState([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState(null)
  const [editing, setEditing] = useState(null)
  const [adminTab, setAdminTab] = useState('convites')
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
        onManageRegistrations={() => {
          setEditingId(null)
          setEditing(null)
          setAdminTab('inscricoes')
        }}
      />
    )
  }

  const tabs = [
    { id: 'convites', label: 'Convites' },
    { id: 'inscricoes', label: 'Gestão de inscrições' },
    ...(isAdmin
      ? [
          { id: 'metodos', label: 'Meios de pagamento' },
          { id: 'definicoes', label: 'Definições' },
        ]
      : []),
  ]
  const activeTab = tabs.some((t) => t.id === adminTab) ? adminTab : 'convites'

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-1 border-b border-border">
        {tabs.map((tb) => (
          <button
            key={tb.id}
            type="button"
            onClick={() => setAdminTab(tb.id)}
            className={
              'rounded-t-lg px-3 py-2 text-sm font-semibold transition-colors ' +
              (activeTab === tb.id
                ? 'border-b-2 border-primary text-foreground'
                : 'text-muted-foreground hover:text-foreground')
            }
          >
            {tb.label}
          </button>
        ))}
      </div>

      {activeTab === 'inscricoes' ? (
        <InviteSubmissionsAdmin />
      ) : activeTab === 'metodos' ? (
        <PaymentMethodsAdmin />
      ) : activeTab === 'definicoes' ? (
        <InviteSettingsAdmin />
      ) : (
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between gap-3">
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
                  {inv.registrationMode === 'internal' ? (
                    <span
                      className={
                        'rounded-full px-2 py-[3px] text-[11px] font-semibold ' +
                        (inv.status === 'publicado' && inv.rsvpEnabled
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-400'
                          : 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-400')
                      }
                    >
                      {inv.status === 'publicado' && inv.rsvpEnabled ? 'Inscrições abertas' : 'Inscrições fechadas'}
                    </span>
                  ) : null}
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
                <button type="button" onClick={() => deleteInvite(inv)} disabled={busy} className="inline-flex items-center rounded-lg border border-destructive/40 bg-transparent px-3 py-2 text-destructive transition-colors hover:bg-destructive/10" aria-label="Eliminar">
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
        </div>
      )}
    </div>
  )
}

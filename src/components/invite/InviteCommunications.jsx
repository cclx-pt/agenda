import { useCallback, useEffect, useState } from 'react'
import {
  AlertTriangle,
  CalendarClock,
  Copy,
  Eye,
  Image,
  Link,
  Mail,
  Plus,
  RotateCcw,
  Save,
  Send,
  Trash2,
  Video,
  Zap,
} from 'lucide-react'
import { toast } from 'sonner'
import * as invitesService from '../../services/invitesService'

const inputCls =
  'w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground'
const labelCls = 'flex flex-col gap-1 text-sm font-medium text-foreground'
const primaryBtn =
  'inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50'
const ghostBtn =
  'inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-2 text-sm font-semibold text-foreground hover:bg-accent disabled:opacity-50'

const TYPES = {
  update: 'Atualização',
  warning: 'Aviso',
  reminder: 'Lembrete',
  post_event: 'Pós-evento',
}
const STATUS = {
  draft: 'Rascunho',
  scheduled: 'Agendada',
  queued: 'Em fila',
  sending: 'A enviar',
  sent: 'Enviada',
  sent_with_errors: 'Enviada com falhas',
  failed: 'Falhou',
  cancelled: 'Cancelada',
}
const RSVP = [
  ['confirmed', 'Confirmada'],
  ['pending', 'Pendente'],
  ['waitlisted', 'Lista de espera'],
  ['declined', 'Cancelada'],
  ['cancelled', 'Cancelada pelo participante'],
]
const PAYMENTS = [
  ['not_applicable', 'Não aplicável'],
  ['pending', 'Pagamento pendente'],
  ['awaiting_validation', 'Em validação'],
  ['paid', 'Pago'],
  ['expired', 'Expirado'],
  ['refund_requested', 'Reembolso pedido'],
  ['refunded', 'Reembolsado'],
]
const EMPTY = {
  type: 'update',
  name: '',
  subject: '',
  preheader: '',
  blocks: [{ type: 'text', text: '' }],
  audience: {
    rsvpStates: [],
    paymentStates: [],
    ticketIds: [],
    checkedIn: null,
    formMatch: 'all',
    formConditions: [],
  },
}

const FORM_OPERATORS = {
  checkbox: [
    ['equals', 'é'],
    ['not_equals', 'não é'],
  ],
  number: [
    ['equals', 'igual a'],
    ['not_equals', 'diferente de'],
    ['greater_than', 'maior que'],
    ['greater_or_equal', 'maior ou igual a'],
    ['less_than', 'menor que'],
    ['less_or_equal', 'menor ou igual a'],
    ['empty', 'sem resposta'],
    ['not_empty', 'com resposta'],
  ],
  default: [
    ['equals', 'é igual a'],
    ['not_equals', 'é diferente de'],
    ['contains', 'contém'],
    ['not_contains', 'não contém'],
    ['empty', 'sem resposta'],
    ['not_empty', 'com resposta'],
  ],
}

function operatorsFor(field) {
  return FORM_OPERATORS[field?.type] ?? FORM_OPERATORS.default
}

function initialCondition(field) {
  return {
    fieldKey: field?.key ?? '',
    operator: 'equals',
    value: field?.type === 'checkbox' ? true : '',
  }
}

function validateDraft(campaign) {
  if (!campaign.name.trim()) return 'Indique o nome interno da comunicação.'
  if (!campaign.subject.trim()) return 'Indique o assunto do email.'
  if (!campaign.blocks.length) return 'Adicione pelo menos um bloco de conteúdo.'
  const incompleteCondition = (campaign.audience.formConditions ?? []).some(
    (condition) =>
      !['empty', 'not_empty'].includes(condition.operator) &&
      (condition.value === '' || condition.value === undefined)
  )
  if (incompleteCondition) return 'Preencha o valor de todas as condições da audiência.'
  return null
}

function editableCampaign(source) {
  return {
    type: source.type,
    name: source.name,
    subject: source.subject,
    preheader: source.preheader,
    blocks: source.blocks.map((block) => ({
      ...block,
      ...(Array.isArray(block.items)
        ? { items: block.items.map((item) => ({ ...item })) }
        : {}),
    })),
    audience: {
      rsvpStates: [...(source.audience?.rsvpStates ?? [])],
      paymentStates: [...(source.audience?.paymentStates ?? [])],
      ticketIds: [...(source.audience?.ticketIds ?? [])],
      checkedIn: source.audience?.checkedIn ?? null,
      formMatch: source.audience?.formMatch ?? 'all',
      formConditions: (source.audience?.formConditions ?? []).map((condition) => ({
        ...condition,
      })),
    },
  }
}

function statusClasses(status) {
  if (status === 'sent') return 'bg-emerald-100 text-emerald-800'
  if (status === 'sent_with_errors') return 'bg-amber-100 text-amber-800'
  if (status === 'failed') return 'bg-red-100 text-red-800'
  if (status === 'queued' || status === 'sending') return 'bg-sky-100 text-sky-800'
  if (status === 'scheduled') return 'bg-violet-100 text-violet-800'
  return 'bg-muted text-muted-foreground'
}

function lisbonDateTimeToIso(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value)
  if (!match) return null
  const parts = match.slice(1).map(Number)
  const desiredUtc = Date.UTC(parts[0], parts[1] - 1, parts[2], parts[3], parts[4])
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Lisbon',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  })
  const shown = Object.fromEntries(
    formatter.formatToParts(new Date(desiredUtc)).map((part) => [part.type, part.value])
  )
  const shownUtc = Date.UTC(
    Number(shown.year),
    Number(shown.month) - 1,
    Number(shown.day),
    Number(shown.hour),
    Number(shown.minute)
  )
  return new Date(desiredUtc + (desiredUtc - shownUtc)).toISOString()
}

function isoToLisbonDateTime(value) {
  if (!value) return ''
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Europe/Lisbon',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  })
    .format(new Date(value))
    .replace(' ', 'T')
}

function BlockEditor({ block, onChange, onRemove }) {
  const common = (
    <select
      className={inputCls}
      value={block.type}
      onChange={(event) => {
        const type = event.target.value
        const initial =
          type === 'text' || type === 'warning'
            ? { type, text: '' }
            : type === 'image'
              ? { type, url: '', alt: '' }
              : type === 'video'
                ? { type, url: '', title: '' }
                : type === 'button'
                  ? { type, url: '', label: '' }
                  : { type, items: [{ title: '', description: '' }] }
        onChange(initial)
      }}
    >
      <option value="text">Texto</option>
      <option value="warning">Aviso</option>
      <option value="image">Imagem</option>
      <option value="video">Vídeo (link)</option>
      <option value="button">Botão</option>
      <option value="workshops">Workshops</option>
    </select>
  )
  return (
    <div className="rounded-lg border border-border bg-background p-3">
      <div className="mb-2 flex items-center gap-2">
        {common}
        <button
          type="button"
          onClick={onRemove}
          className="rounded p-2 text-destructive hover:bg-destructive/10"
          aria-label="Remover bloco"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
      {block.type === 'text' || block.type === 'warning' ? (
        <textarea
          className={inputCls + ' min-h-28'}
          value={block.text}
          onChange={(event) => onChange({ ...block, text: event.target.value })}
          placeholder={block.type === 'warning' ? 'Informação importante…' : 'Escreva a mensagem…'}
        />
      ) : null}
      {block.type === 'image' ? (
        <div className="grid gap-2 sm:grid-cols-2">
          <input
            className={inputCls}
            value={block.url}
            onChange={(event) => onChange({ ...block, url: event.target.value })}
            placeholder="https://…/imagem.jpg"
          />
          <input
            className={inputCls}
            value={block.alt}
            onChange={(event) => onChange({ ...block, alt: event.target.value })}
            placeholder="Descrição da imagem"
          />
        </div>
      ) : null}
      {block.type === 'video' ? (
        <div className="grid gap-2 sm:grid-cols-2">
          <input
            className={inputCls}
            value={block.url}
            onChange={(event) => onChange({ ...block, url: event.target.value })}
            placeholder="Link do vídeo"
          />
          <input
            className={inputCls}
            value={block.title}
            onChange={(event) => onChange({ ...block, title: event.target.value })}
            placeholder="Título do vídeo"
          />
        </div>
      ) : null}
      {block.type === 'button' ? (
        <div className="grid gap-2 sm:grid-cols-2">
          <input
            className={inputCls}
            value={block.label}
            onChange={(event) => onChange({ ...block, label: event.target.value })}
            placeholder="Texto do botão"
          />
          <input
            className={inputCls}
            value={block.url}
            onChange={(event) => onChange({ ...block, url: event.target.value })}
            placeholder="https://…"
          />
        </div>
      ) : null}
      {block.type === 'workshops' ? (
        <div className="flex flex-col gap-2">
          {block.items.map((item, index) => (
            <div key={index} className="grid gap-2 sm:grid-cols-[1fr_2fr_auto]">
              <input
                className={inputCls}
                value={item.title}
                onChange={(event) =>
                  onChange({
                    ...block,
                    items: block.items.map((current, itemIndex) =>
                      itemIndex === index ? { ...current, title: event.target.value } : current
                    ),
                  })
                }
                placeholder="Workshop"
              />
              <input
                className={inputCls}
                value={item.description}
                onChange={(event) =>
                  onChange({
                    ...block,
                    items: block.items.map((current, itemIndex) =>
                      itemIndex === index
                        ? { ...current, description: event.target.value }
                        : current
                    ),
                  })
                }
                placeholder="Descrição"
              />
              <button
                type="button"
                className="rounded p-2 text-destructive hover:bg-destructive/10"
                onClick={() =>
                  onChange({
                    ...block,
                    items: block.items.filter((_, itemIndex) => itemIndex !== index),
                  })
                }
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
          <button
            type="button"
            className={ghostBtn + ' self-start'}
            onClick={() =>
              onChange({ ...block, items: [...block.items, { title: '', description: '' }] })
            }
          >
            <Plus className="h-4 w-4" />
            Workshop
          </button>
        </div>
      ) : null}
    </div>
  )
}

function CampaignPreview({ campaign, invite }) {
  const bannerUrl =
    invite.useEventBanner && invite.event?.bannerUrl
      ? invite.event.bannerUrl
      : invite.bannerUrl
  return (
    <div className="rounded-lg bg-gray-100 p-3 sm:p-6">
      <div className="mx-auto max-w-[600px] overflow-hidden bg-white text-gray-900 shadow-sm">
        {bannerUrl ? (
          <img src={bannerUrl} alt={invite.title} className="block h-auto w-full" />
        ) : null}
        <div className="bg-[#1f3864] px-5 py-6 text-white sm:px-8">
          <p className="m-0 text-xs font-bold uppercase tracking-widest text-blue-100">
            Agenda CCLX
          </p>
          <h4 className="mb-0 mt-1 text-2xl font-bold text-white">{invite.title}</h4>
        </div>
        <div className="p-5 sm:p-8">
          <p className="mb-5 mt-0">Olá,</p>
          {campaign.blocks.map((block, index) => {
        if (block.type === 'text')
          return (
            <p key={index} className="mb-5 whitespace-pre-line leading-relaxed">
              {block.text || 'Texto da mensagem'}
            </p>
          )
        if (block.type === 'warning')
          return (
            <div
              key={index}
              className="mb-4 border-l-4 border-amber-600 bg-amber-50 p-3 text-amber-900"
            >
              <strong>Aviso</strong>
              <br />
              {block.text}
            </div>
          )
        if (block.type === 'image')
          return block.url ? (
            <img
              key={index}
              src={block.url}
              alt={block.alt}
              className="mb-4 h-auto max-w-full rounded-lg"
            />
          ) : null
        if (block.type === 'video')
          return (
            <a
              key={index}
              href={block.url}
              className="mb-4 flex items-center gap-2 font-bold text-blue-800"
            >
              <Video className="h-4 w-4" />
              {block.title || 'Ver vídeo'}
            </a>
          )
        if (block.type === 'button')
          return (
            <a
              key={index}
              href={block.url}
              className="mb-4 inline-block rounded-lg bg-[#1f3864] px-5 py-2.5 font-bold text-white"
            >
              {block.label || 'Abrir'}
            </a>
          )
        if (block.type === 'workshops')
          return (
            <div key={index} className="mb-4">
              <h4 className="font-bold">Workshops</h4>
              {block.items.map((item, itemIndex) => (
                <div key={itemIndex} className="border-t py-2">
                  <strong>{item.title}</strong>
                  <p className="m-0 text-sm text-gray-600">{item.description}</p>
                </div>
              ))}
            </div>
          )
        return null
          })}
          <p className="mb-0 mt-2 inline-block border border-[#1f3864] px-5 py-3 text-sm font-bold text-[#1f3864]">
            Ver {invite.title}
          </p>
        </div>
        <div className="border-t border-gray-200 bg-gray-50 px-5 py-4 text-xs text-gray-500 sm:px-8">
          Comunicação operacional relativa à sua inscrição.
          <br />
          Agenda CCLX
          <br />
          <span className="underline">Cancelar a receção de emails deste evento</span>
        </div>
      </div>
    </div>
  )
}

export default function InviteCommunications({ invite, tickets = [], formFields = [] }) {
  const [campaigns, setCampaigns] = useState([])
  const [campaign, setCampaign] = useState(EMPTY)
  const [campaignId, setCampaignId] = useState(null)
  const [campaignStatus, setCampaignStatus] = useState('draft')
  const [audienceCount, setAudienceCount] = useState(null)
  const [recipients, setRecipients] = useState([])
  const [loadingRecipients, setLoadingRecipients] = useState(false)
  const [validationError, setValidationError] = useState(null)
  const [busy, setBusy] = useState(false)
  const [preview, setPreview] = useState(false)
  const [templates, setTemplates] = useState([])
  const [segments, setSegments] = useState([])
  const [automations, setAutomations] = useState([])
  const [scheduledAt, setScheduledAt] = useState('')
  const [metrics, setMetrics] = useState(null)
  const [automationDraft, setAutomationDraft] = useState({
    triggerType: 'before_event',
    offsetMinutes: 1440,
    templateKey: 'event_reminder',
  })

  const load = useCallback(async () => {
    try {
      setCampaigns(await invitesService.listInviteCampaigns(invite.id))
    } catch (error) {
      toast.error(error.message)
    }
  }, [invite.id])
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load()
  }, [load])
  const loadTools = useCallback(async () => {
    try {
      const [nextTemplates, nextSegments, nextAutomations] = await Promise.all([
        invitesService.listInviteCampaignTemplates(invite.id),
        invitesService.listInviteCampaignSegments(invite.id),
        invitesService.listInviteCampaignAutomations(invite.id),
      ])
      setTemplates(nextTemplates)
      setSegments(nextSegments)
      setAutomations(nextAutomations)
    } catch (error) {
      toast.error(error.message)
    }
  }, [invite.id])
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadTools()
  }, [loadTools])

  const readOnly = campaignStatus !== 'draft'
  const processing = campaignStatus === 'queued' || campaignStatus === 'sending'
  const audienceFields = formFields.filter(
    (field) =>
      field?.key &&
      !['section', 'document', 'children'].includes(field.type) &&
      !['name', 'email', 'phone'].includes(field.key)
  )

  const updateAudience = (key, value, checked) => {
    setAudienceCount(null)
    setCampaign((current) => ({
      ...current,
      audience: {
        ...current.audience,
        [key]: Array.isArray(current.audience[key])
          ? checked
            ? [...current.audience[key], value]
            : current.audience[key].filter((item) => item !== value)
          : value,
      },
    }))
  }
  const setAudienceValue = (key, value) => {
    setAudienceCount(null)
    setCampaign((current) => ({
      ...current,
      audience: { ...current.audience, [key]: value },
    }))
  }
  const loadRecipients = useCallback(async (selectedId) => {
    setLoadingRecipients(true)
    try {
      setRecipients(
        await invitesService.listInviteCampaignRecipients(invite.id, selectedId)
      )
      if (typeof invitesService.getInviteCampaignMetrics === 'function') {
        setMetrics(await invitesService.getInviteCampaignMetrics(invite.id, selectedId))
      }
    } catch (error) {
      toast.error(error.message)
      setRecipients([])
      setMetrics(null)
      setValidationError(null)
    } finally {
      setLoadingRecipients(false)
    }
  }, [invite.id])

  useEffect(() => {
    if (!campaigns.some((item) => ['scheduled', 'queued', 'sending'].includes(item.status)))
      return undefined
    const interval = window.setInterval(async () => {
      try {
        const nextCampaigns = await invitesService.listInviteCampaigns(invite.id)
        setCampaigns(nextCampaigns)
        const selected = nextCampaigns.find((item) => item.id === campaignId)
        if (selected) {
          setCampaignStatus(selected.status)
          await loadRecipients(selected.id)
        }
      } catch (error) {
        toast.error(error.message)
      }
    }, 2500)
    return () => window.clearInterval(interval)
  }, [campaignId, campaigns, invite.id, loadRecipients])
  const selectCampaign = (selected) => {
    setCampaignId(selected.id)
    setCampaignStatus(selected.status)
    setCampaign(editableCampaign(selected))
    setAudienceCount(null)
    setPreview(selected.status !== 'draft')
    setRecipients([])
    setValidationError(null)
    setScheduledAt(isoToLisbonDateTime(selected.scheduledAt))
    setMetrics(null)
    if (selected.status !== 'draft') loadRecipients(selected.id)
  }
  const reset = () => {
    setCampaignId(null)
    setCampaignStatus('draft')
    setCampaign(EMPTY)
    setAudienceCount(null)
    setRecipients([])
    setValidationError(null)
    setPreview(false)
    setScheduledAt('')
    setMetrics(null)
  }
  const duplicateAsDraft = () => {
    setCampaignId(null)
    setCampaignStatus('draft')
    setCampaign({
      ...editableCampaign(campaign),
      name: `${campaign.name} (cópia)`,
    })
    setAudienceCount(null)
    setRecipients([])
    setPreview(false)
    toast.success('Cópia criada como novo rascunho. Guarde para a adicionar ao histórico.')
  }

  const save = async () => {
    if (readOnly) return null
    const errorMessage = validateDraft(campaign)
    setValidationError(errorMessage)
    if (errorMessage) {
      toast.error(errorMessage)
      return null
    }
    setBusy(true)
    try {
      const saved = campaignId
        ? await invitesService.updateInviteCampaign(invite.id, campaignId, campaign)
        : await invitesService.createInviteCampaign(invite.id, campaign)
      setCampaignId(saved.id)
      setCampaign(saved)
      setValidationError(null)
      await load()
      toast.success('Comunicação guardada.')
      return saved
    } catch (error) {
      toast.error(error.message)
      return null
    } finally {
      setBusy(false)
    }
  }
  const calculateAudience = async () => {
    setBusy(true)
    try {
      const result = await invitesService.previewInviteCampaignAudience(
        invite.id,
        campaign.audience
      )
      setAudienceCount(result.count)
    } catch (error) {
      toast.error(error.message)
    } finally {
      setBusy(false)
    }
  }
  const sendTest = async () => {
    const testEmail = window.prompt('Email destinatário para o teste:')?.trim()
    if (!testEmail) return
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(testEmail)) {
      toast.error('Indique um email de teste válido.')
      return
    }
    const saved = await save()
    if (!saved) return
    setBusy(true)
    try {
      await invitesService.testInviteCampaign(invite.id, saved.id, testEmail)
      toast.success('Email de teste enviado.')
    } catch (error) {
      toast.error(error.message)
    } finally {
      setBusy(false)
    }
  }
  const sendCampaign = async () => {
    const saved = await save()
    if (!saved) return
    const result = await invitesService.previewInviteCampaignAudience(invite.id, saved.audience)
    setAudienceCount(result.count)
    if (!result.count) return toast.error('A audiência não tem destinatários.')
    if (
      !window.confirm(
        `Enviar agora para ${result.count} destinatário(s)?\n\n` +
          `Filtros ativos: ${saved.audience.rsvpStates.length} de inscrição, ` +
          `${saved.audience.paymentStates.length} de pagamento, ` +
          `${saved.audience.ticketIds.length} de bilhete e ` +
          `${saved.audience.formConditions.length} do formulário.\n\n` +
          'O envio não pode ser anulado.'
      )
    )
      return
    setBusy(true)
    try {
      const queued = await invitesService.sendInviteCampaign(invite.id, saved.id)
      setCampaignStatus(queued.status)
      setPreview(true)
      toast.success(`Comunicação colocada em fila para ${result.count} destinatário(s).`)
      await Promise.all([load(), loadRecipients(saved.id)])
    } catch (error) {
      toast.error(error.message)
    } finally {
      setBusy(false)
    }
  }
  const remove = async (selected) => {
    if (!window.confirm(`Eliminar o rascunho "${selected.name}"?`)) return
    try {
      await invitesService.deleteInviteCampaign(invite.id, selected.id)
      if (campaignId === selected.id) reset()
      await load()
    } catch (error) {
      toast.error(error.message)
    }
  }
  const retryFailed = async () => {
    if (!campaignId || !window.confirm('Repetir apenas os envios falhados?')) return
    setBusy(true)
    try {
      const retried = await invitesService.retryFailedInviteCampaign(invite.id, campaignId)
      setCampaignStatus(retried.status)
      await Promise.all([load(), loadRecipients(campaignId)])
      toast.success('Os envios falhados foram colocados novamente em fila.')
    } catch (error) {
      toast.error(error.message)
    } finally {
      setBusy(false)
    }
  }

  const applyTemplateDraft = async (templateKey) => {
    setBusy(true)
    try {
      const created = await invitesService.createInviteCampaignFromTemplate(
        invite.id,
        templateKey
      )
      await load()
      selectCampaign(created)
      toast.success('Template aplicado a um novo rascunho.')
    } catch (error) {
      toast.error(error.message)
    } finally {
      setBusy(false)
    }
  }
  const saveSegment = async () => {
    const name = window.prompt('Nome do segmento:')?.trim()
    if (!name) return
    setBusy(true)
    try {
      await invitesService.saveInviteCampaignSegment(invite.id, {
        name,
        audience: campaign.audience,
      })
      await loadTools()
      toast.success('Segmento guardado.')
    } catch (error) {
      toast.error(error.message)
    } finally {
      setBusy(false)
    }
  }
  const deleteSegment = async (segment) => {
    if (!window.confirm(`Eliminar o segmento "${segment.name}"?`)) return
    try {
      await invitesService.deleteInviteCampaignSegment(invite.id, segment.id)
      await loadTools()
    } catch (error) {
      toast.error(error.message)
    }
  }
  const scheduleCampaign = async () => {
    const iso = lisbonDateTimeToIso(scheduledAt)
    if (!iso) return toast.error('Indique a data e hora do envio.')
    const selectedId =
      campaignStatus === 'scheduled' ? campaignId : (await save())?.id
    if (!selectedId) return
    setBusy(true)
    try {
      const scheduled = await invitesService.scheduleInviteCampaign(
        invite.id,
        selectedId,
        iso
      )
      setCampaignStatus(scheduled.status)
      setPreview(true)
      await Promise.all([load(), loadRecipients(selectedId)])
      toast.success(
        campaignStatus === 'scheduled'
          ? 'Agendamento atualizado.'
          : 'Comunicação agendada.'
      )
    } catch (error) {
      toast.error(error.message)
    } finally {
      setBusy(false)
    }
  }
  const cancelSchedule = async () => {
    if (!campaignId || !window.confirm('Cancelar este envio agendado?')) return
    setBusy(true)
    try {
      const cancelled = await invitesService.cancelInviteCampaignSchedule(
        invite.id,
        campaignId
      )
      setCampaignStatus(cancelled.status)
      await load()
      toast.success('Agendamento cancelado.')
    } catch (error) {
      toast.error(error.message)
    } finally {
      setBusy(false)
    }
  }
  const saveAutomation = async () => {
    setBusy(true)
    try {
      await invitesService.saveInviteCampaignAutomation(invite.id, {
        ...automationDraft,
        enabled: true,
        audience: campaign.audience,
      })
      await loadTools()
      toast.success('Automatização criada.')
    } catch (error) {
      toast.error(error.message)
    } finally {
      setBusy(false)
    }
  }
  const toggleAutomation = async (automation) => {
    try {
      await invitesService.saveInviteCampaignAutomation(invite.id, {
        ...automation,
        enabled: !automation.enabled,
      })
      await loadTools()
    } catch (error) {
      toast.error(error.message)
    }
  }
  const deleteAutomation = async (automation) => {
    if (!window.confirm('Eliminar esta automatização?')) return
    try {
      await invitesService.deleteInviteCampaignAutomation(invite.id, automation.id)
      await loadTools()
    } catch (error) {
      toast.error(error.message)
    }
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[280px_minmax(0,1fr)]">
      <aside className="rounded-lg border border-border bg-card p-3">
        <details className="mb-2 rounded-lg border border-border p-2">
          <summary className="cursor-pointer text-sm font-bold">Templates</summary>
          <div className="mt-2 flex flex-col gap-1">
            {templates.map((template) => (
              <button
                key={template.key}
                type="button"
                className={ghostBtn + ' justify-start text-left'}
                disabled={busy}
                onClick={() => applyTemplateDraft(template.key)}
              >
                {template.label}
              </button>
            ))}
          </div>
        </details>
        <details className="mb-2 rounded-lg border border-border p-2">
          <summary className="cursor-pointer text-sm font-bold">Segmentos guardados</summary>
          <div className="mt-2 flex flex-col gap-1">
            {segments.map((segment) => (
              <div key={segment.id} className="flex items-center gap-1">
                <button
                  type="button"
                  className={ghostBtn + ' min-w-0 flex-1 justify-start truncate'}
                  disabled={readOnly}
                  onClick={() => {
                    setCampaign((current) => ({
                      ...current,
                      audience: editableCampaign({
                        ...current,
                        audience: segment.audience,
                      }).audience,
                    }))
                    setAudienceCount(null)
                  }}
                >
                  {segment.name}
                </button>
                <button
                  type="button"
                  className="p-2 text-destructive"
                  onClick={() => deleteSegment(segment)}
                  aria-label={`Eliminar segmento ${segment.name}`}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
            {!readOnly ? (
              <button type="button" className={ghostBtn} onClick={saveSegment}>
                <Save className="h-4 w-4" />
                Guardar audiência atual
              </button>
            ) : null}
          </div>
        </details>
        <details className="mb-3 rounded-lg border border-border p-2">
          <summary className="cursor-pointer text-sm font-bold">Automatizações</summary>
          <div className="mt-2 flex flex-col gap-2">
            {automations.map((automation) => (
              <div key={automation.id} className="rounded border border-border p-2 text-xs">
                <div className="font-semibold">
                  {templates.find((item) => item.key === automation.templateKey)?.label ??
                    automation.templateKey}
                </div>
                <div className="text-muted-foreground">
                  {automation.triggerType === 'after_event' ? 'Depois' : 'Antes'} do evento ·{' '}
                  {automation.offsetMinutes / 60} h
                </div>
                <div className="mt-1 flex gap-1">
                  <button
                    type="button"
                    className={ghostBtn + ' px-2 py-1 text-xs'}
                    onClick={() => toggleAutomation(automation)}
                  >
                    {automation.enabled ? 'Pausar' : 'Ativar'}
                  </button>
                  <button
                    type="button"
                    className="p-1 text-destructive"
                    onClick={() => deleteAutomation(automation)}
                    aria-label="Eliminar automatização"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
            <select
              className={inputCls}
              value={automationDraft.templateKey}
              onChange={(event) =>
                setAutomationDraft({ ...automationDraft, templateKey: event.target.value })
              }
            >
              {templates.map((template) => (
                <option key={template.key} value={template.key}>
                  {template.label}
                </option>
              ))}
            </select>
            <select
              className={inputCls}
              value={automationDraft.triggerType}
              onChange={(event) =>
                setAutomationDraft({ ...automationDraft, triggerType: event.target.value })
              }
            >
              <option value="before_event">Antes do evento</option>
              <option value="payment_pending">Pagamento pendente antes do evento</option>
              <option value="after_event">Depois do evento</option>
            </select>
            <label className="text-xs">
              Horas de antecedência/intervalo
              <input
                className={inputCls}
                type="number"
                min="0"
                value={automationDraft.offsetMinutes / 60}
                onChange={(event) =>
                  setAutomationDraft({
                    ...automationDraft,
                    offsetMinutes: Math.round(Number(event.target.value) * 60),
                  })
                }
              />
            </label>
            <button type="button" className={ghostBtn} disabled={busy} onClick={saveAutomation}>
              <Zap className="h-4 w-4" />
              Criar regra
            </button>
          </div>
        </details>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="m-0 text-sm font-bold uppercase text-muted-foreground">Histórico</h3>
          <button
            type="button"
            className="rounded p-2 hover:bg-accent"
            onClick={reset}
            title="Nova comunicação"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
        <div className="flex flex-col gap-2">
          {campaigns.length ? (
            campaigns.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => selectCampaign(item)}
                className={`rounded-lg border p-3 text-left hover:bg-accent ${
                  campaignId === item.id ? 'border-primary bg-accent' : 'border-border'
                }`}
              >
                <span className="block truncate text-sm font-semibold">{item.name}</span>
                <span className="mt-1 flex items-center justify-between gap-2 text-xs text-muted-foreground">
                  <span className={`rounded-full px-2 py-0.5 ${statusClasses(item.status)}`}>
                    {STATUS[item.status]}
                  </span>
                  <span>
                    {item.status !== 'draft'
                      ? `${item.sentCount}/${item.recipientCount}`
                      : TYPES[item.type]}
                  </span>
                </span>
                {item.status === 'draft' ? (
                  <span
                    role="button"
                    tabIndex={0}
                    className="mt-2 inline-flex text-destructive"
                    onClick={(event) => {
                      event.stopPropagation()
                      remove(item)
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </span>
                ) : null}
              </button>
            ))
          ) : (
            <p className="text-sm text-muted-foreground">Ainda não há comunicações.</p>
          )}
        </div>
      </aside>
      <section className="flex min-w-0 flex-col gap-4 rounded-lg border border-border bg-card p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="m-0 text-base font-bold">
              {readOnly
                ? 'Resultados da comunicação'
                : campaignId
                  ? 'Editar rascunho'
                  : 'Novo rascunho'}
            </h3>
            <p className="m-0 text-sm text-muted-foreground">
              Emails operacionais para pessoas inscritas neste convite.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {campaignId ? (
              <button type="button" className={ghostBtn} onClick={duplicateAsDraft}>
                <Copy className="h-4 w-4" />
                Copiar para novo rascunho
              </button>
            ) : null}
            <button
              type="button"
              className={ghostBtn}
              onClick={() => setPreview((value) => !value)}
            >
              <Eye className="h-4 w-4" />
              {preview ? (readOnly ? 'Ver detalhes' : 'Editar') : 'Pré-visualizar'}
            </button>
          </div>
        </div>
        {preview ? (
          <CampaignPreview campaign={campaign} invite={invite} />
        ) : (
          <fieldset disabled={readOnly} className="contents">
            <div className="grid gap-3 md:grid-cols-2">
              <label className={labelCls}>
                Tipo
                <select
                  className={inputCls}
                  value={campaign.type}
                  onChange={(event) => setCampaign({ ...campaign, type: event.target.value })}
                >
                  {Object.entries(TYPES).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <label className={labelCls}>
                Nome interno
                <input
                  className={inputCls}
                  value={campaign.name}
                  onChange={(event) => setCampaign({ ...campaign, name: event.target.value })}
                  placeholder="Ex.: Informações de acesso"
                />
              </label>
              <label className={labelCls}>
                Assunto
                <input
                  className={inputCls}
                  value={campaign.subject}
                  onChange={(event) => setCampaign({ ...campaign, subject: event.target.value })}
                />
              </label>
              <label className={labelCls}>
                Preheader
                <input
                  className={inputCls}
                  value={campaign.preheader}
                  onChange={(event) => setCampaign({ ...campaign, preheader: event.target.value })}
                  placeholder="Resumo visível na caixa de entrada"
                />
              </label>
            </div>
            <div>
              <h4 className="mb-2 text-sm font-bold">Audiência</h4>
              <div className="grid gap-3 rounded-lg border border-border bg-muted/20 p-3 lg:grid-cols-3">
                <fieldset>
                  <legend className="mb-1 text-xs font-bold uppercase text-muted-foreground">
                    Inscrição
                  </legend>
                  {RSVP.map(([value, label]) => (
                    <label key={value} className="flex items-center gap-2 py-1 text-sm">
                      <input
                        type="checkbox"
                        checked={campaign.audience.rsvpStates.includes(value)}
                        onChange={(event) =>
                          updateAudience('rsvpStates', value, event.target.checked)
                        }
                      />
                      {label}
                    </label>
                  ))}
                </fieldset>
                <fieldset>
                  <legend className="mb-1 text-xs font-bold uppercase text-muted-foreground">
                    Pagamento
                  </legend>
                  {PAYMENTS.map(([value, label]) => (
                    <label key={value} className="flex items-center gap-2 py-1 text-sm">
                      <input
                        type="checkbox"
                        checked={campaign.audience.paymentStates.includes(value)}
                        onChange={(event) =>
                          updateAudience('paymentStates', value, event.target.checked)
                        }
                      />
                      {label}
                    </label>
                  ))}
                </fieldset>
                <div>
                  <label className={labelCls}>
                    Check-in
                    <select
                      className={inputCls}
                      value={
                        campaign.audience.checkedIn == null
                          ? 'all'
                          : String(campaign.audience.checkedIn)
                      }
                      onChange={(event) =>
                        updateAudience(
                          'checkedIn',
                          null,
                          event.target.value === 'all' ? null : event.target.value === 'true'
                        )
                      }
                    >
                      <option value="all">Todos</option>
                      <option value="true">Com check-in</option>
                      <option value="false">Sem check-in</option>
                    </select>
                  </label>
                  {tickets.length ? (
                    <fieldset className="mt-3">
                      <legend className="mb-1 text-xs font-bold uppercase text-muted-foreground">
                        Bilhete
                      </legend>
                      {tickets.map((ticket) => (
                        <label key={ticket.id} className="flex items-center gap-2 py-1 text-sm">
                          <input
                            type="checkbox"
                            checked={campaign.audience.ticketIds.includes(ticket.id)}
                            onChange={(event) =>
                              updateAudience('ticketIds', ticket.id, event.target.checked)
                            }
                          />
                          {ticket.name}
                        </label>
                      ))}
                    </fieldset>
                  ) : null}
                </div>
              </div>
              {audienceFields.length ? (
                <div className="mt-3 rounded-lg border border-border bg-muted/20 p-3">
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <h5 className="m-0 text-sm font-bold">Respostas do formulário</h5>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">Corresponder a</span>
                      <select
                        className={inputCls + ' w-auto'}
                        value={campaign.audience.formMatch ?? 'all'}
                        onChange={(event) => setAudienceValue('formMatch', event.target.value)}
                      >
                        <option value="all">todas as condições</option>
                        <option value="any">qualquer condição</option>
                      </select>
                    </div>
                  </div>
                  <div className="flex flex-col gap-2">
                    {(campaign.audience.formConditions ?? []).map((condition, index) => {
                      const field = audienceFields.find(
                        (candidate) => candidate.key === condition.fieldKey
                      )
                      const operators = operatorsFor(field)
                      const needsValue = !['empty', 'not_empty'].includes(condition.operator)
                      return (
                        <div
                          key={`${condition.fieldKey}-${index}`}
                          className="grid gap-2 md:grid-cols-[1.4fr_1fr_1.2fr_auto]"
                        >
                          <select
                            aria-label={`Campo da condição ${index + 1}`}
                            className={inputCls}
                            value={condition.fieldKey}
                            onChange={(event) => {
                              const nextField = audienceFields.find(
                                (candidate) => candidate.key === event.target.value
                              )
                              const conditions = [...campaign.audience.formConditions]
                              conditions[index] = initialCondition(nextField)
                              setAudienceValue('formConditions', conditions)
                            }}
                          >
                            {audienceFields.map((candidate) => (
                              <option key={candidate.key} value={candidate.key}>
                                {candidate.label}
                              </option>
                            ))}
                          </select>
                          <select
                            aria-label={`Operador da condição ${index + 1}`}
                            className={inputCls}
                            value={condition.operator}
                            onChange={(event) => {
                              const conditions = [...campaign.audience.formConditions]
                              conditions[index] = {
                                ...condition,
                                operator: event.target.value,
                              }
                              setAudienceValue('formConditions', conditions)
                            }}
                          >
                            {operators.map(([value, label]) => (
                              <option key={value} value={value}>
                                {label}
                              </option>
                            ))}
                          </select>
                          {needsValue ? (
                            field?.type === 'checkbox' ? (
                              <select
                                aria-label={`Valor da condição ${index + 1}`}
                                className={inputCls}
                                value={String(condition.value)}
                                onChange={(event) => {
                                  const conditions = [...campaign.audience.formConditions]
                                  conditions[index] = {
                                    ...condition,
                                    value: event.target.value === 'true',
                                  }
                                  setAudienceValue('formConditions', conditions)
                                }}
                              >
                                <option value="true">Marcado</option>
                                <option value="false">Não marcado</option>
                              </select>
                            ) : field?.options?.length ? (
                              <select
                                aria-label={`Valor da condição ${index + 1}`}
                                className={inputCls}
                                value={condition.value ?? ''}
                                onChange={(event) => {
                                  const conditions = [...campaign.audience.formConditions]
                                  conditions[index] = {
                                    ...condition,
                                    value: event.target.value,
                                  }
                                  setAudienceValue('formConditions', conditions)
                                }}
                              >
                                <option value="">Selecionar…</option>
                                {field.options.map((option) => (
                                  <option key={option} value={option}>
                                    {option}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              <input
                                aria-label={`Valor da condição ${index + 1}`}
                                className={inputCls}
                                type={field?.type === 'number' ? 'number' : 'text'}
                                value={condition.value ?? ''}
                                onChange={(event) => {
                                  const conditions = [...campaign.audience.formConditions]
                                  conditions[index] = {
                                    ...condition,
                                    value:
                                      field?.type === 'number' && event.target.value !== ''
                                        ? Number(event.target.value)
                                        : event.target.value,
                                  }
                                  setAudienceValue('formConditions', conditions)
                                }}
                              />
                            )
                          ) : (
                            <span />
                          )}
                          <button
                            type="button"
                            className="rounded p-2 text-destructive hover:bg-destructive/10"
                            aria-label={`Remover condição ${index + 1}`}
                            onClick={() =>
                              setAudienceValue(
                                'formConditions',
                                campaign.audience.formConditions.filter(
                                  (_, conditionIndex) => conditionIndex !== index
                                )
                              )
                            }
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      )
                    })}
                  </div>
                  <button
                    type="button"
                    className={ghostBtn + ' mt-2'}
                    onClick={() =>
                      setAudienceValue('formConditions', [
                        ...(campaign.audience.formConditions ?? []),
                        initialCondition(audienceFields[0]),
                      ])
                    }
                  >
                    <Plus className="h-4 w-4" />
                    Condição
                  </button>
                </div>
              ) : null}
              <div className="mt-2 flex items-center gap-3">
                <button
                  type="button"
                  onClick={calculateAudience}
                  disabled={busy}
                  className={ghostBtn}
                >
                  <Mail className="h-4 w-4" />
                  Calcular audiência
                </button>
                {audienceCount != null ? (
                  <strong className="text-sm">{audienceCount} destinatário(s)</strong>
                ) : null}
              </div>
            </div>
            <div>
              <div className="mb-2 flex items-center justify-between">
                <h4 className="m-0 text-sm font-bold">Conteúdo</h4>
                <button
                  type="button"
                  className={ghostBtn}
                  onClick={() =>
                    setCampaign({
                      ...campaign,
                      blocks: [...campaign.blocks, { type: 'text', text: '' }],
                    })
                  }
                >
                  <Plus className="h-4 w-4" />
                  Bloco
                </button>
              </div>
              <div className="flex flex-col gap-2">
                {campaign.blocks.map((block, index) => (
                  <BlockEditor
                    key={index}
                    block={block}
                    onChange={(updated) =>
                      setCampaign({
                        ...campaign,
                        blocks: campaign.blocks.map((current, blockIndex) =>
                          blockIndex === index ? updated : current
                        ),
                      })
                    }
                    onRemove={() =>
                      setCampaign({
                        ...campaign,
                        blocks: campaign.blocks.filter((_, blockIndex) => blockIndex !== index),
                      })
                    }
                  />
                ))}
              </div>
            </div>
          </fieldset>
        )}
        <div className="flex flex-wrap items-end gap-2 border-t border-border pt-4">
          {readOnly ? (
            <>
              <button type="button" className={primaryBtn} onClick={duplicateAsDraft}>
                <Copy className="h-4 w-4" />
                Copiar para novo rascunho
              </button>
              {campaignStatus === 'scheduled' ? (
                <>
                  <label className="text-xs font-medium">
                    Nova data (hora de Lisboa)
                    <input
                      type="datetime-local"
                      className={inputCls + ' mt-1'}
                      value={scheduledAt}
                      onChange={(event) => setScheduledAt(event.target.value)}
                    />
                  </label>
                  <button
                    type="button"
                    className={ghostBtn}
                    disabled={busy || !scheduledAt}
                    onClick={scheduleCampaign}
                  >
                    <CalendarClock className="h-4 w-4" />
                    Reagendar
                  </button>
                  <button
                    type="button"
                    className={ghostBtn}
                    disabled={busy}
                    onClick={cancelSchedule}
                  >
                    Cancelar agendamento
                  </button>
                </>
              ) : null}
              {recipients.some((recipient) => recipient.status === 'failed') ? (
                <button type="button" className={ghostBtn} disabled={busy} onClick={retryFailed}>
                  <RotateCcw className="h-4 w-4" />
                  Repetir falhados
                </button>
              ) : null}
            </>
          ) : (
            <>
              <button type="button" className={ghostBtn} disabled={busy} onClick={save}>
                <Save className="h-4 w-4" />
                Guardar rascunho
              </button>
              <button type="button" className={ghostBtn} disabled={busy} onClick={sendTest}>
                <Send className="h-4 w-4" />
                Enviar teste
              </button>
              <button type="button" className={primaryBtn} disabled={busy} onClick={sendCampaign}>
                <Send className="h-4 w-4" />
                Enviar agora
              </button>
              <label className="flex items-end gap-2 text-xs font-medium">
                <span>
                  Agendar (hora de Lisboa)
                  <input
                    type="datetime-local"
                    className={inputCls + ' mt-1'}
                    value={scheduledAt}
                    onChange={(event) => setScheduledAt(event.target.value)}
                  />
                </span>
                <button
                  type="button"
                  className={ghostBtn}
                  disabled={busy || !scheduledAt}
                  onClick={scheduleCampaign}
                >
                  <CalendarClock className="h-4 w-4" />
                  Agendar
                </button>
              </label>
            </>
          )}
        </div>
        {validationError ? (
          <p role="alert" className="m-0 text-sm font-medium text-destructive">
            {validationError}
          </p>
        ) : null}
        {readOnly ? (
          <>
          {metrics ? (
            <div className="grid gap-2 rounded-lg border border-border p-3 sm:grid-cols-4">
              <div>
                <div className="text-xs text-muted-foreground">Fornecedor</div>
                <strong className="text-sm">{metrics.provider.name.toUpperCase()}</strong>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Aceites</div>
                <strong className="text-sm">{metrics.events.accepted ?? 0}</strong>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Falhas</div>
                <strong className="text-sm">{metrics.events.failed ?? 0}</strong>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">
                  Tentativas / entregues confirmados
                </div>
                <strong className="text-sm">
                  {metrics.attempts ?? 0} /{' '}
                  {metrics.provider.capabilities.deliveryWebhooks
                    ? metrics.events.delivered ?? 0
                    : 'não disponível'}
                </strong>
              </div>
            </div>
          ) : null}
          <div className="rounded-lg border border-border">
            <div className="flex items-center justify-between border-b border-border px-3 py-2">
              <h4 className="m-0 text-sm font-bold">Resultados por destinatário</h4>
              <span className="text-xs text-muted-foreground">
                {loadingRecipients ? 'A carregar…' : `${recipients.length} destinatário(s)`}
              </span>
            </div>
            {processing && recipients.length ? (
              <div className="border-b border-border px-3 py-3">
                <div className="mb-1 flex justify-between text-xs text-muted-foreground">
                  <span>{campaignStatus === 'queued' ? 'A aguardar processamento' : 'A enviar'}</span>
                  <span>
                    {recipients.filter((recipient) =>
                      ['sent', 'failed', 'skipped'].includes(recipient.status)
                    ).length}
                    /{recipients.length}
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full bg-primary transition-all"
                    style={{
                      width: `${
                        (recipients.filter((recipient) =>
                          ['sent', 'failed', 'skipped'].includes(recipient.status)
                        ).length /
                          recipients.length) *
                        100
                      }%`,
                    }}
                  />
                </div>
              </div>
            ) : null}
            {!loadingRecipients && recipients.length ? (
              <div className="max-h-72 overflow-auto">
                <table className="w-full text-left text-sm">
                  <thead className="sticky top-0 bg-muted">
                    <tr>
                      <th className="px-3 py-2">Destinatário</th>
                      <th className="px-3 py-2">Estado</th>
                      <th className="px-3 py-2">Tentativas</th>
                      <th className="px-3 py-2">Erro</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recipients.map((recipient) => (
                      <tr key={recipient.id} className="border-t border-border">
                        <td className="px-3 py-2">
                          <span className="block font-medium">{recipient.name || 'Sem nome'}</span>
                          <span className="text-xs text-muted-foreground">{recipient.email}</span>
                        </td>
                        <td className="px-3 py-2">
                          {recipient.status === 'sent'
                            ? 'Enviado'
                            : recipient.status === 'failed'
                              ? 'Falhou'
                              : recipient.status === 'processing'
                                ? 'A enviar'
                                : recipient.status === 'skipped'
                                  ? 'Ignorado'
                                : 'Em fila'}
                        </td>
                        <td className="px-3 py-2">{recipient.attemptCount}</td>
                        <td className="max-w-72 px-3 py-2 text-xs text-destructive">
                          {recipient.error || '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : !loadingRecipients ? (
              <p className="m-0 p-3 text-sm text-muted-foreground">
                Não existem resultados individuais.
              </p>
            ) : null}
          </div>
          </>
        ) : null}
        <p className="m-0 flex items-start gap-2 text-xs text-muted-foreground">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-none" />
          Apenas inscritos com email são incluídos. Esta comunicação é operacional e relativa ao
          evento.
        </p>
      </section>
    </div>
  )
}

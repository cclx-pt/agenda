import { useCallback, useEffect, useState } from 'react'
import {
  AlertTriangle,
  Eye,
  Image,
  Link,
  Mail,
  Plus,
  Save,
  Send,
  Trash2,
  Video,
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
const STATUS = { draft: 'Rascunho', sending: 'A enviar', sent: 'Enviada', failed: 'Falhou' }
const RSVP = [
  ['confirmed', 'Confirmada'],
  ['pending', 'Pendente'],
  ['waitlist', 'Lista de espera'],
  ['declined', 'Cancelada'],
]
const PAYMENTS = [
  ['pending', 'Pagamento pendente'],
  ['awaiting_validation', 'Em validação'],
  ['paid', 'Pago'],
  ['failed', 'Falhado'],
  ['refund_requested', 'Reembolso pedido'],
  ['refunded', 'Reembolsado'],
]
const EMPTY = {
  type: 'update',
  name: '',
  subject: '',
  preheader: '',
  blocks: [{ type: 'text', text: '' }],
  audience: { rsvpStates: [], paymentStates: [], ticketIds: [], checkedIn: null },
}

function statusClasses(status) {
  if (status === 'sent') return 'bg-emerald-100 text-emerald-800'
  if (status === 'failed') return 'bg-red-100 text-red-800'
  if (status === 'sending') return 'bg-sky-100 text-sky-800'
  return 'bg-muted text-muted-foreground'
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
  return (
    <div className="rounded-lg border border-border bg-white p-5 text-gray-900 shadow-sm">
      <p className="mb-4">Olá,</p>
      {campaign.blocks.map((block, index) => {
        if (block.type === 'text')
          return (
            <p key={index} className="mb-4 whitespace-pre-line leading-relaxed">
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
      <p className="mt-5 text-sm font-bold text-[#1f3864]">Ver {invite.title}</p>
    </div>
  )
}

export default function InviteCommunications({ invite, tickets = [] }) {
  const [campaigns, setCampaigns] = useState([])
  const [campaign, setCampaign] = useState(EMPTY)
  const [campaignId, setCampaignId] = useState(null)
  const [audienceCount, setAudienceCount] = useState(null)
  const [busy, setBusy] = useState(false)
  const [preview, setPreview] = useState(false)

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

  const updateAudience = (key, value, checked) =>
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
  const selectCampaign = (selected) => {
    if (selected.status !== 'draft') return
    setCampaignId(selected.id)
    setCampaign({
      type: selected.type,
      name: selected.name,
      subject: selected.subject,
      preheader: selected.preheader,
      blocks: selected.blocks,
      audience: selected.audience,
    })
    setAudienceCount(null)
  }
  const reset = () => {
    setCampaignId(null)
    setCampaign(EMPTY)
    setAudienceCount(null)
    setPreview(false)
  }

  const save = async () => {
    setBusy(true)
    try {
      const saved = campaignId
        ? await invitesService.updateInviteCampaign(invite.id, campaignId, campaign)
        : await invitesService.createInviteCampaign(invite.id, campaign)
      setCampaignId(saved.id)
      setCampaign(saved)
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
        `Enviar agora para ${result.count} destinatário(s)? O envio não pode ser anulado.`
      )
    )
      return
    setBusy(true)
    try {
      const sent = await invitesService.sendInviteCampaign(invite.id, saved.id)
      toast.success(
        `Comunicação concluída: ${sent.sentCount} enviada(s), ${sent.failedCount} falhada(s).`
      )
      reset()
      await load()
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

  return (
    <div className="grid gap-4 xl:grid-cols-[280px_minmax(0,1fr)]">
      <aside className="rounded-lg border border-border bg-card p-3">
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
                className="rounded-lg border border-border p-3 text-left hover:bg-accent disabled:cursor-default"
                disabled={item.status !== 'draft'}
              >
                <span className="block truncate text-sm font-semibold">{item.name}</span>
                <span className="mt-1 flex items-center justify-between gap-2 text-xs text-muted-foreground">
                  <span className={`rounded-full px-2 py-0.5 ${statusClasses(item.status)}`}>
                    {STATUS[item.status]}
                  </span>
                  <span>
                    {item.status === 'sent' || item.status === 'failed'
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
              {campaignId ? 'Editar comunicação' : 'Nova comunicação'}
            </h3>
            <p className="m-0 text-sm text-muted-foreground">
              Emails operacionais para pessoas inscritas neste convite.
            </p>
          </div>
          <button type="button" className={ghostBtn} onClick={() => setPreview((value) => !value)}>
            <Eye className="h-4 w-4" />
            {preview ? 'Editar' : 'Pré-visualizar'}
          </button>
        </div>
        {preview ? (
          <CampaignPreview campaign={campaign} invite={invite} />
        ) : (
          <>
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
          </>
        )}
        <div className="flex flex-wrap items-end gap-2 border-t border-border pt-4">
          <button type="button" className={ghostBtn} disabled={busy} onClick={save}>
            <Save className="h-4 w-4" />
            Guardar
          </button>
          <button type="button" className={ghostBtn} disabled={busy} onClick={sendTest}>
            <Send className="h-4 w-4" />
            Enviar teste
          </button>
          <button type="button" className={primaryBtn} disabled={busy} onClick={sendCampaign}>
            <Send className="h-4 w-4" />
            Enviar agora
          </button>
        </div>
        <p className="m-0 flex items-start gap-2 text-xs text-muted-foreground">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-none" />
          Apenas inscritos com email são incluídos. Esta comunicação é operacional e relativa ao
          evento.
        </p>
      </section>
    </div>
  )
}

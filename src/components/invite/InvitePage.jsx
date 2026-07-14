import { useEffect, useState } from 'react'
import { toast, Toaster } from 'sonner'
import { Ticket, Loader2, CheckCircle2, Clock, CreditCard, Upload, Plus, Trash2 } from 'lucide-react'
import * as invitesService from '../../services/invitesService'
import {
  BannerCard, InfoExtraCard, NarrativeCard, SpeakersCard, AgendaCard, WorkshopsCard,
  PaymentCard, LocationCard, FaqsCard, ShareCard, FooterCard,
} from './InviteCards'
import { fmtDateRange } from './inviteUtils'
import {
  getFormFields, isVisible, initialValues, validateForm, buildSubmission,
} from './inviteFormFields'

// Mapa tipo → componente (rsvp é tratado à parte: precisa de estado/handlers).
const BLOCK_COMPONENTS = {
  banner: BannerCard,
  cabecalho: BannerCard,
  info_extra: InfoExtraCard,
  convite_narrativo: NarrativeCard,
  oradores: SpeakersCard,
  agenda: AgendaCard,
  workshops: WorkshopsCard,
  pagamento: PaymentCard,
  localizacao: LocationCard,
  faqs: FaqsCard,
  partilha: ShareCard,
  rodape: FooterCard,
}

// Aplica os metadados (título + Open Graph) da página. Nota: para crawlers
// (WhatsApp/redes) as tags OG têm de ser renderizadas no servidor — isto só
// afeta o browser. Uma renderização OG server-side é um seguimento futuro.
function applyMeta(meta) {
  if (!meta) return
  if (meta.title) document.title = meta.title
  const set = (attr, key, value) => {
    if (!value) return
    let el = document.head.querySelector(`meta[${attr}="${key}"]`)
    if (!el) {
      el = document.createElement('meta')
      el.setAttribute(attr, key)
      document.head.appendChild(el)
    }
    el.setAttribute('content', value)
  }
  set('name', 'description', meta.description)
  set('property', 'og:title', meta.title)
  set('property', 'og:description', meta.description)
  set('property', 'og:image', meta.image)
  set('property', 'og:type', 'website')
}

const STATUS_STYLE = {
  confirmed: 'border-emerald-500/40 bg-emerald-50 text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-300',
  waitlisted: 'border-amber-500/40 bg-amber-50 text-amber-800 dark:bg-amber-500/10 dark:text-amber-300',
  declined: 'border-border bg-muted text-muted-foreground',
  pending: 'border-border bg-muted text-muted-foreground',
}

function StatusCard({ status }) {
  if (!status) return null
  const cls = STATUS_STYLE[status.rsvpState] || STATUS_STYLE.pending
  return (
    <div className={`flex items-start gap-3 rounded-2xl border p-4 ${cls}`}>
      {status.rsvpState === 'confirmed' ? (
        <CheckCircle2 className="mt-0.5 h-5 w-5 flex-shrink-0" aria-hidden="true" />
      ) : (
        <Clock className="mt-0.5 h-5 w-5 flex-shrink-0" aria-hidden="true" />
      )}
      <p className="m-0 text-sm font-medium">{status.message || 'A tua resposta foi registada.'}</p>
    </div>
  )
}

function RsvpCard({ block, page, accent, onSubmitted, guestStatus }) {
  const c = block.content || {}
  const inv = page.invite
  const fields = getFormFields(c)
  const [deadlinePassed] = useState(
    () => Boolean(inv.rsvpDeadline) && Date.now() > Date.parse(inv.rsvpDeadline)
  )
  const [notOpenYet] = useState(
    () => Boolean(inv.rsvpStartDatetime) && Date.now() < Date.parse(inv.rsvpStartDatetime)
  )
  const tickets = (page.tickets || []).filter((t) => !t.soldOut)
  const paidWithTickets = inv.costType !== 'gratuito' && tickets.length > 0
  const [values, setValues] = useState(() => initialValues(fields))
  const [ticketId, setTicketId] = useState('')
  const [busy, setBusy] = useState(false)

  // Já respondeu (tem estado): mostra o cartão de estado em vez do formulário.
  if (guestStatus) {
    return (
      <div id="inscricoes" className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <h2 className="m-0 mb-3 text-xl font-bold text-foreground">Inscrição</h2>
        <StatusCard status={guestStatus} />
      </div>
    )
  }

  const setVal = (key, v) => setValues((s) => ({ ...s, [key]: v }))
  const inputCls = 'w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground'

  const submit = async (e) => {
    e.preventDefault()
    const err = validateForm(fields, values)
    if (err) {
      toast.error(err)
      return
    }
    if (paidWithTickets && !ticketId) {
      toast.error('Escolha um bilhete.')
      return
    }
    const { name, email, phone, extra } = buildSubmission(fields, values)
    if (!name.trim()) {
      toast.error('Indique o seu nome.')
      return
    }
    setBusy(true)
    try {
      const res = await invitesService.submitRsvp(page.slug, {
        name,
        email,
        phone,
        guestsCount: 1,
        attend: true,
        ticketId: ticketId || null,
        extra: Object.keys(extra).length ? extra : null,
      })
      onSubmitted(res)
      toast.success('Inscrição registada. Obrigado!')
    } catch (err) {
      toast.error(err.message)
    } finally {
      setBusy(false)
    }
  }

  // Renderiza um campo do formulário conforme o seu tipo (respeita condicionais).
  const renderField = (f) => {
    if (!isVisible(f, values)) return null
    if (f.type === 'section') {
      return (
        <div key={f.key} className="mt-2 border-b border-border pb-1">
          <h3 className="m-0 text-sm font-bold uppercase tracking-wide text-muted-foreground">{f.label}</h3>
        </div>
      )
    }
    const val = values[f.key]
    const req = f.required ? <span className="text-destructive"> *</span> : null

    if (f.type === 'children') {
      const kids = Array.isArray(val) ? val : []
      const setKids = (next) => setVal(f.key, next)
      const patchKid = (i, patch) => setKids(kids.map((k, idx) => (idx === i ? { ...k, ...patch } : k)))
      return (
        <div key={f.key} className="flex flex-col gap-2 rounded-lg border border-border bg-background/60 p-3">
          <p className="m-0 text-sm font-medium text-foreground">
            {f.label}
            {req}
          </p>
          {kids.map((kid, i) => (
            <div key={i} className="flex items-start gap-2 rounded-lg border border-border bg-background p-2">
              <div className="grid flex-1 grid-cols-1 gap-1.5 sm:grid-cols-3">
                <input className={inputCls} placeholder="Nome" value={kid.nome ?? ''} onChange={(e) => patchKid(i, { nome: e.target.value })} />
                <input type="number" min="0" max="18" className={inputCls} placeholder="Idade" value={kid.idade ?? ''} onChange={(e) => patchKid(i, { idade: e.target.value })} />
                <input className={inputCls} placeholder="Alergias / necessidades" value={kid.alergias ?? ''} onChange={(e) => patchKid(i, { alergias: e.target.value })} />
              </div>
              <button type="button" onClick={() => setKids(kids.filter((_, idx) => idx !== i))} className="rounded p-1 text-destructive hover:bg-destructive/10" aria-label="Remover criança">
                <Trash2 className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => setKids([...kids, { nome: '', idade: '', alergias: '' }])}
            className="inline-flex items-center gap-1 self-start rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs font-semibold text-foreground hover:bg-accent"
          >
            <Plus className="h-3.5 w-3.5" aria-hidden="true" />
            Adicionar criança
          </button>
        </div>
      )
    }

    if (f.type === 'checkbox') {
      return (
        <label key={f.key} className="flex items-start gap-2 text-sm text-foreground">
          <input type="checkbox" className="mt-0.5 h-4 w-4 flex-shrink-0" checked={!!val} onChange={(e) => setVal(f.key, e.target.checked)} />
          <span>
            {f.label}
            {req}
          </span>
        </label>
      )
    }

    if (f.type === 'select') {
      return (
        <label key={f.key} className="flex flex-col gap-1 text-sm font-medium text-foreground">
          <span>
            {f.label}
            {req}
          </span>
          <select className={inputCls} value={val ?? ''} onChange={(e) => setVal(f.key, e.target.value)}>
            <option value="">— Selecione —</option>
            {(f.options || []).map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        </label>
      )
    }

    if (f.type === 'radio') {
      return (
        <div key={f.key} className="flex flex-col gap-1 text-sm font-medium text-foreground">
          <span>
            {f.label}
            {req}
          </span>
          <div className="flex flex-wrap gap-3">
            {(f.options || []).map((o) => (
              <label key={o} className="inline-flex items-center gap-1.5 font-normal">
                <input type="radio" name={f.key} value={o} checked={val === o} onChange={() => setVal(f.key, o)} />
                {o}
              </label>
            ))}
          </div>
        </div>
      )
    }

    if (f.type === 'textarea') {
      return (
        <label key={f.key} className="flex flex-col gap-1 text-sm font-medium text-foreground">
          <span>
            {f.label}
            {req}
          </span>
          <textarea className={inputCls} rows={2} placeholder={f.placeholder ?? ''} value={val ?? ''} onChange={(e) => setVal(f.key, e.target.value)} />
        </label>
      )
    }

    const inputType = f.type === 'email' ? 'email' : f.type === 'tel' ? 'tel' : f.type === 'number' ? 'number' : 'text'
    return (
      <label key={f.key} className="flex flex-col gap-1 text-sm font-medium text-foreground">
        <span>
          {f.label}
          {req}
        </span>
        <input type={inputType} className={inputCls} placeholder={f.placeholder ?? ''} value={val ?? ''} onChange={(e) => setVal(f.key, e.target.value)} />
      </label>
    )
  }

  return (
    <div id="inscricoes" className="rounded-2xl border border-border bg-card p-6 shadow-sm">
      <h2 className="m-0 mb-1 text-xl font-bold text-foreground">Inscrição</h2>
      {c.infoText ? <p className="m-0 mb-4 text-sm text-muted-foreground">{c.infoText}</p> : null}
      {deadlinePassed ? (
        <p className="m-0 rounded-lg bg-muted p-3 text-sm text-muted-foreground">O prazo de inscrição terminou.</p>
      ) : notOpenYet ? (
        <p className="m-0 rounded-lg bg-muted p-3 text-sm text-muted-foreground">As inscrições ainda não abriram.</p>
      ) : (
        <form onSubmit={submit} className="flex flex-col gap-3">
          {paidWithTickets ? (
            <label className="flex flex-col gap-1 text-sm font-medium text-foreground">
              Bilhete *
              <select className={inputCls} value={ticketId} onChange={(e) => setTicketId(e.target.value)}>
                <option value="">— Escolha o bilhete —</option>
                {tickets.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                    {t.price != null ? ` — ${Number(t.price).toFixed(2)} ${t.currency}` : ''}
                    {t.kind === 'grupo' && t.groupSize ? ` (${t.groupSize} pessoas)` : ''}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          {fields.map(renderField)}
          <button
            type="submit"
            disabled={busy}
            className="mt-1 inline-flex items-center justify-center gap-2 rounded-lg px-5 py-2.5 text-sm font-bold text-white shadow-sm transition-opacity hover:opacity-90 disabled:opacity-60"
            style={{ backgroundColor: accent }}
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Ticket className="h-4 w-4" aria-hidden="true" />}
            {c.ctaLabel || 'Confirmar Presença'}
          </button>
        </form>
      )}
    </div>
  )
}

const PAYMENT_METHOD_LABEL = {
  mbway: 'MB WAY',
  transferencia: 'Transferência bancária',
  referencia: 'Referência Multibanco',
}

// Fluxo de pagamento do convidado (aparece só para eventos pagos, a quem já se
// inscreveu). Escolha do método → instruções (IBAN/referência) → comprovativo.
function PaymentFlowCard({ slug, guestToken, invite, guestStatus, accent, onUpdate }) {
  const applicable =
    invite.costType !== 'gratuito' && !!guestToken && !!guestStatus && guestStatus.paymentState !== 'not_applicable'
  const [payment, setPayment] = useState(null)
  const [busy, setBusy] = useState(false)
  const [uploading, setUploading] = useState(false)

  useEffect(() => {
    if (!applicable) return undefined
    let alive = true
    invitesService
      .getGuestPayment(slug, guestToken)
      .then((p) => {
        if (alive) setPayment(p)
      })
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [applicable, slug, guestToken])

  if (!applicable) return null

  const cardCls = 'rounded-2xl border border-border bg-card p-6 shadow-sm'
  const rowCls = 'flex justify-between gap-3 border-b border-border/60 py-1.5 text-sm'
  const stateNow = payment?.status || guestStatus.paymentState

  if (stateNow === 'paid') {
    return (
      <div className={cardCls + ' flex items-center gap-2 text-emerald-700 dark:text-emerald-400'}>
        <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
        <p className="m-0 font-semibold">Pagamento confirmado. Obrigado!</p>
      </div>
    )
  }
  if (stateNow === 'awaiting_validation') {
    return (
      <div className={cardCls}>
        <h2 className="m-0 mb-1 text-lg font-bold text-foreground">Pagamento</h2>
        <p className="m-0 text-sm text-muted-foreground">Comprovativo recebido. Aguarda validação do organizador.</p>
      </div>
    )
  }

  const choose = async (method) => {
    setBusy(true)
    try {
      const p = await invitesService.initiatePayment(slug, guestToken, method)
      setPayment(p)
      onUpdate?.({ ...guestStatus, paymentState: p.status })
    } catch (err) {
      toast.error(err.message)
    } finally {
      setBusy(false)
    }
  }
  const onReceipt = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const p = await invitesService.uploadReceipt(slug, guestToken, file)
      setPayment(p)
      onUpdate?.({ ...guestStatus, paymentState: p.status })
      toast.success('Comprovativo enviado. Aguarda validação.')
    } catch (err) {
      toast.error(err.message)
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  const methods = invite.paymentMethod ? [invite.paymentMethod] : []
  const instr = payment?.instructions

  return (
    <div className={cardCls}>
      <h2 className="m-0 mb-3 inline-flex items-center gap-2 text-lg font-bold text-foreground">
        <CreditCard className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
        Pagamento
      </h2>
      {!instr ? (
        <div className="flex flex-col gap-2">
          <p className="m-0 text-sm text-muted-foreground">Escolha como quer pagar:</p>
          {methods.length === 0 ? (
            <p className="m-0 text-sm text-muted-foreground">Sem métodos configurados. Contacte o organizador.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {methods.map((m) => (
                <button
                  key={m}
                  type="button"
                  disabled={busy}
                  onClick={() => choose(m)}
                  className="rounded-lg px-4 py-2 text-sm font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
                  style={{ backgroundColor: accent }}
                >
                  {PAYMENT_METHOD_LABEL[m] || m}
                </button>
              ))}
            </div>
          )}
        </div>
      ) : instr.type === 'transfer' ? (
        <div className="flex flex-col gap-2">
          <div className={rowCls}>
            <span className="text-muted-foreground">IBAN</span>
            <span className="font-mono font-semibold text-foreground">{instr.iban}</span>
          </div>
          <div className={rowCls}>
            <span className="text-muted-foreground">Beneficiário</span>
            <span className="font-semibold text-foreground">{instr.beneficiary}</span>
          </div>
          {instr.amount != null ? (
            <div className={rowCls}>
              <span className="text-muted-foreground">Valor</span>
              <span className="font-semibold text-foreground">{Number(instr.amount).toFixed(2)} {instr.currency}</span>
            </div>
          ) : null}
          <label
            className="mt-2 inline-flex cursor-pointer items-center gap-2 self-start rounded-lg px-4 py-2 text-sm font-bold text-white hover:opacity-90"
            style={{ backgroundColor: accent }}
          >
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Upload className="h-4 w-4" aria-hidden="true" />}
            {uploading ? 'A enviar…' : 'Carregar comprovativo'}
            <input type="file" accept="image/png,image/jpeg,application/pdf" className="hidden" onChange={onReceipt} />
          </label>
        </div>
      ) : instr.type === 'reference' ? (
        <div className="flex flex-col gap-2">
          <div className={rowCls}>
            <span className="text-muted-foreground">Entidade</span>
            <span className="font-mono font-semibold text-foreground">{instr.entity}</span>
          </div>
          <div className={rowCls}>
            <span className="text-muted-foreground">Referência</span>
            <span className="font-mono font-semibold text-foreground">{instr.reference}</span>
          </div>
          {instr.amount != null ? (
            <div className={rowCls}>
              <span className="text-muted-foreground">Valor</span>
              <span className="font-semibold text-foreground">{Number(instr.amount).toFixed(2)} {instr.currency}</span>
            </div>
          ) : null}
          <p className="m-0 text-xs text-muted-foreground">
            Pague no homebanking ou Multibanco. Confirmamos a inscrição assim que recebermos o pagamento.
          </p>
        </div>
      ) : null}
    </div>
  )
}

export default function InvitePage({ slug }) {
  const [state, setState] = useState({ loading: true, error: null, page: null })
  const [guestStatus, setGuestStatus] = useState(null)
  const [guestToken, setGuestToken] = useState(
    () => new URLSearchParams(window.location.search).get('g') || undefined
  )

  useEffect(() => {
    let alive = true
    const params = new URLSearchParams(window.location.search)
    const token = params.get('g') || undefined
    invitesService
      .getPublicInvite(slug, token)
      .then((page) => {
        if (!alive) return
        applyMeta(page.meta)
        setState({ loading: false, error: null, page })
        if (page.guestStatus) setGuestStatus(page.guestStatus)
      })
      .catch((err) => {
        if (!alive) return
        setState({ loading: false, error: err, page: null })
      })
    return () => {
      alive = false
    }
  }, [slug])

  const { loading, error, page } = state

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-muted-foreground">
        <Loader2 className="h-8 w-8 animate-spin" aria-hidden="true" />
      </div>
    )
  }
  if (error || !page) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-2 bg-background px-6 text-center">
        <h1 className="m-0 text-2xl font-bold text-foreground">Convite não encontrado</h1>
        <p className="m-0 text-muted-foreground">O link pode estar errado ou o convite já não está disponível.</p>
      </div>
    )
  }

  const accent = page.invite.colorTheme || '#1F3864'

  const onRsvpSubmitted = (res) => {
    setGuestStatus(res.status)
    // Atualiza o URL com o token pessoal para futuras visitas (sem recarregar).
    if (res.token) {
      setGuestToken(res.token)
      const url = new URL(window.location.href)
      url.searchParams.set('g', res.token)
      window.history.replaceState({}, '', url)
    }
  }

  return (
    <div className="min-h-screen bg-background pb-10" style={{ '--invite-accent': accent }}>
      <Toaster position="top-center" richColors />
      {page.preview ? (
        <div className="bg-amber-500 py-1.5 text-center text-xs font-bold uppercase tracking-wide text-white">
          Pré-visualização
        </div>
      ) : null}
      <div className="mx-auto flex max-w-2xl flex-col gap-4 px-4 pt-4">
        {guestStatus ? <StatusCard status={guestStatus} /> : null}
        {page.blocks.map((block) => {
          if (block.type === 'rsvp') {
            return (
              <RsvpCard
                key={block.id}
                block={block}
                page={page}
                accent={accent}
                guestStatus={guestStatus}
                onSubmitted={onRsvpSubmitted}
              />
            )
          }
          const Comp = BLOCK_COMPONENTS[block.type]
          if (!Comp) return null
          if (block.type === 'pagamento') {
            return (
              <div key={block.id} className="flex flex-col gap-4">
                <Comp block={block} page={page} accent={accent} />
                <PaymentFlowCard
                  slug={page.slug}
                  guestToken={guestToken}
                  invite={page.invite}
                  guestStatus={guestStatus}
                  accent={accent}
                  onUpdate={setGuestStatus}
                />
              </div>
            )
          }
          return <Comp key={block.id} block={block} page={page} accent={accent} />
        })}
        {/* Rodapé de marca discreto quando não há bloco rodapé próprio. */}
        {!page.blocks.some((b) => b.type === 'rodape') ? (
          <p className="mt-2 text-center text-xs text-muted-foreground">
            {fmtDateRange(page.invite.startDatetime, page.invite.endDatetime)} · Feito com a Agenda CCLX
          </p>
        ) : null}
      </div>
    </div>
  )
}

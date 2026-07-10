import { useEffect, useState } from 'react'
import { toast, Toaster } from 'sonner'
import { Ticket, Loader2, CheckCircle2, Clock } from 'lucide-react'
import * as invitesService from '../../services/invitesService'
import {
  BannerCard, InfoExtraCard, NarrativeCard, SpeakersCard, AgendaCard, WorkshopsCard,
  PaymentCard, LocationCard, FaqsCard, ShareCard, FooterCard,
} from './InviteCards'
import { fmtDateRange } from './inviteUtils'

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
  const [deadlinePassed] = useState(
    () => Boolean(inv.rsvpDeadline) && Date.now() > Date.parse(inv.rsvpDeadline)
  )
  const [form, setForm] = useState({ name: '', email: '', phone: '', guestsCount: 1, attend: 'yes' })
  const [extra, setExtra] = useState({})
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

  const setField = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))
  const extraFields = Array.isArray(c.extraFields) ? c.extraFields : []

  const submit = async (e) => {
    e.preventDefault()
    if (!form.name.trim()) {
      toast.error('Indique o seu nome.')
      return
    }
    setBusy(true)
    try {
      const res = await invitesService.submitRsvp(page.slug, {
        name: form.name.trim(),
        email: form.email.trim() || null,
        phone: form.phone.trim() || null,
        guestsCount: Number(form.guestsCount) || 1,
        attend: form.attend === 'yes',
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

  const inputCls = 'w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground'

  return (
    <div id="inscricoes" className="rounded-2xl border border-border bg-card p-6 shadow-sm">
      <h2 className="m-0 mb-1 text-xl font-bold text-foreground">Inscrição</h2>
      {c.infoText ? <p className="m-0 mb-4 text-sm text-muted-foreground">{c.infoText}</p> : null}
      {deadlinePassed ? (
        <p className="m-0 rounded-lg bg-muted p-3 text-sm text-muted-foreground">O prazo de inscrição terminou.</p>
      ) : (
        <form onSubmit={submit} className="flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-sm font-medium text-foreground">
            Nome *
            <input className={inputCls} value={form.name} onChange={setField('name')} required />
          </label>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-sm font-medium text-foreground">
              Email
              <input type="email" className={inputCls} value={form.email} onChange={setField('email')} />
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium text-foreground">
              Telefone
              <input className={inputCls} value={form.phone} onChange={setField('phone')} />
            </label>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-sm font-medium text-foreground">
              Nº de pessoas
              <input type="number" min="1" max="50" className={inputCls} value={form.guestsCount} onChange={setField('guestsCount')} />
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium text-foreground">
              Vais estar presente?
              <select className={inputCls} value={form.attend} onChange={setField('attend')}>
                <option value="yes">Sim, confirmo</option>
                <option value="no">Não vou poder ir</option>
              </select>
            </label>
          </div>
          {extraFields.map((f) => (
            <label key={f.key} className="flex flex-col gap-1 text-sm font-medium text-foreground">
              {f.label}
              {f.type === 'boolean' ? (
                <input
                  type="checkbox"
                  className="h-4 w-4"
                  checked={!!extra[f.key]}
                  onChange={(e) => setExtra((x) => ({ ...x, [f.key]: e.target.checked }))}
                />
              ) : (
                <input
                  type={f.type === 'number' ? 'number' : 'text'}
                  className={inputCls}
                  value={extra[f.key] ?? ''}
                  onChange={(e) => setExtra((x) => ({ ...x, [f.key]: e.target.value }))}
                />
              )}
            </label>
          ))}
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

export default function InvitePage({ slug }) {
  const [state, setState] = useState({ loading: true, error: null, page: null })
  const [guestStatus, setGuestStatus] = useState(null)

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

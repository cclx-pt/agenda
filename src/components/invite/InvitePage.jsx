import { useEffect, useState } from 'react'
import { toast, Toaster } from 'sonner'
import { Ticket, Loader2, CheckCircle2, Clock, CreditCard, Upload, Plus, Trash2, ArrowLeft, ArrowRight, Users, Smartphone, ExternalLink, FileText } from 'lucide-react'
import * as invitesService from '../../services/invitesService'
import {
  BannerCard, OverviewCard, InfoExtraCard, NarrativeCard, MultimediaCard, GoodToKnowCard, SpeakersCard, AgendaCard, WorkshopsCard,
  PaymentCard, LocationCard, FaqsCard, ShareCard, FooterCard,
} from './InviteCards'
import { fmtDateRange, inviteRsvpHref, inviteHomeHref, ticketPrice } from './inviteUtils'
import {
  getFormFields, visibleKeys, initialValues, validateFields, buildSubmission, countPeople, countChildren,
} from './inviteFormFields'

// Mapa tipo → componente (rsvp é tratado à parte: precisa de estado/handlers).
const BLOCK_COMPONENTS = {
  banner: BannerCard,
  cabecalho: BannerCard,
  overview: OverviewCard,
  info_extra: InfoExtraCard,
  convite_narrativo: NarrativeCard,
  multimedia: MultimediaCard,
  good_to_know: GoodToKnowCard,
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

// Rótulo do botão de inscrição. O antigo default "Confirmar Presença" passa a "Inscrever-me".
function ctaText(content) {
  const l = (content?.ctaLabel || '').trim()
  return l && l !== 'Confirmar Presença' ? l : 'Inscrever-me'
}

const STATUS_STYLE = {
  confirmed: 'border-emerald-500/40 bg-emerald-50 text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-300',
  waitlisted: 'border-amber-500/40 bg-amber-50 text-amber-800 dark:bg-amber-500/10 dark:text-amber-300',
  declined: 'border-border bg-muted text-muted-foreground',
  pending: 'border-border bg-muted text-muted-foreground',
}

// Data/hora por extenso (Europe/Lisbon) — mesmo formato do email de confirmação.
function fmtWhenLong(value) {
  if (!value) return ''
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleString('pt-PT', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Lisbon',
  })
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

// Contador de vagas disponíveis (aparece quando o convite tem capacidade definida).
function SpotsCounter({ invite, accent }) {
  const { capacity, spotsLeft } = invite
  if (spotsLeft == null || !capacity) return null
  const taken = Math.max(0, capacity - spotsLeft)
  const pct = capacity > 0 ? Math.min(100, Math.round((taken / capacity) * 100)) : 0
  const soldOut = spotsLeft <= 0
  return (
    <div className="flex flex-col gap-1.5 rounded-xl border border-border bg-card p-3 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-foreground">
          <Users className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          {soldOut ? 'Vagas esgotadas' : `${spotsLeft} vaga(s) disponíveis`}
        </span>
        <span className="text-xs text-muted-foreground">
          {taken}/{capacity}
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={soldOut ? 'h-full rounded-full bg-destructive' : 'h-full rounded-full'}
          style={{ width: `${pct}%`, backgroundColor: soldOut ? undefined : accent }}
        />
      </div>
      {soldOut ? (
        <span className="text-xs text-muted-foreground">Novas inscrições entram em lista de espera.</span>
      ) : null}
    </div>
  )
}

// Escolha do bilhete — 1º passo da inscrição. O utilizador começa por ESCOLHER o
// bilhete; só depois se abre o formulário. Usa-se com `onSelect` (botão, na página
// de inscrição) ou com `hrefFor` (link, na landing). Bilhetes esgotados aparecem
// desativados.
function TicketChooser({ tickets, accent, onSelect, hrefFor, heading = 'Escolhe o teu bilhete' }) {
  const list = tickets || []
  if (!list.length) return null
  const cardCls =
    'flex w-full flex-col gap-1 rounded-xl border border-border bg-background p-4 text-left shadow-sm transition-shadow hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1'
  return (
    <div className="flex flex-col gap-2">
      {heading ? <p className="m-0 text-sm font-semibold text-foreground">{heading}</p> : null}
      {list.map((t) => {
        const isGroup = t.kind === 'grupo' || t.partyType === 'family' || t.partyType === 'group'
        const body = (
          <>
            <div className="flex items-start justify-between gap-3">
              <span className="font-semibold text-foreground">{t.name}</span>
              <span className="shrink-0 text-sm font-bold" style={{ color: accent }}>
                {ticketPrice(t)}
              </span>
            </div>
            {t.description ? <span className="text-xs text-muted-foreground">{t.description}</span> : null}
            {isGroup ? (
              <span className="text-xs text-muted-foreground">Grupo{t.groupSize ? ` até ${t.groupSize} pessoas` : ''}</span>
            ) : null}
            {t.soldOut ? (
              <span className="mt-1 text-xs font-semibold text-destructive">Esgotado</span>
            ) : (
              <span className="mt-1 inline-flex items-center gap-1 text-xs font-semibold" style={{ color: accent }}>
                Escolher e continuar
                <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
              </span>
            )}
          </>
        )
        if (t.soldOut) {
          return (
            <div key={t.id} className={cardCls + ' cursor-not-allowed opacity-60'} aria-disabled="true">
              {body}
            </div>
          )
        }
        if (hrefFor) {
          return (
            <a key={t.id} href={hrefFor(t)} className={cardCls}>
              {body}
            </a>
          )
        }
        return (
          <button key={t.id} type="button" onClick={() => onSelect?.(t.id)} className={cardCls}>
            {body}
          </button>
        )
      })}
    </div>
  )
}

export function BannerRegistrationAction({ block, invite, tickets, slug, accent, guestStatus, preview = false }) {
  const [choosingTicket, setChoosingTicket] = useState(false)
  const [deadlinePassed] = useState(
    () => !preview && Boolean(invite.rsvpDeadline) && Date.now() > Date.parse(invite.rsvpDeadline)
  )
  const [notOpenYet] = useState(
    () => !preview && Boolean(invite.rsvpStartDatetime) && Date.now() < Date.parse(invite.rsvpStartDatetime)
  )
  const content = block.content || {}
  const mode = invite.registrationMode || 'internal'
  if (mode === 'none') return null

  const activeTickets = (tickets || []).filter((ticket) => ticket.active !== false)
  const hasTickets = mode === 'internal' && activeTickets.length > 0
  const href = mode === 'external' ? invite.registrationUrl || '#' : inviteRsvpHref(slug)
  const buttonClass =
    'relative flex w-full items-center gap-3 overflow-hidden rounded-lg border-2 border-dashed bg-background px-5 py-3 text-left shadow-sm transition-shadow hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2'
  const buttonContent = (
    <>
      <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full text-white" style={{ backgroundColor: accent }}>
        <Ticket className="h-5 w-5" aria-hidden="true" />
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Inscrição</span>
        <span className="font-bold text-foreground">{guestStatus ? 'Ver / gerir a minha inscrição' : ctaText(content)}</span>
      </span>
      <ArrowRight className="h-5 w-5 flex-shrink-0" style={{ color: accent }} aria-hidden="true" />
    </>
  )

  if (mode === 'internal' && !guestStatus && (deadlinePassed || notOpenYet)) {
    return (
      <p className="m-0 rounded-lg bg-muted p-3 text-sm text-muted-foreground">
        {deadlinePassed ? 'O prazo de inscrição terminou.' : 'As inscrições ainda não abriram.'}
      </p>
    )
  }
  if (hasTickets && choosingTicket) {
    return (
      <TicketChooser
        tickets={activeTickets}
        accent={accent}
        hrefFor={(ticket) => inviteRsvpHref(slug, ticket.id)}
        heading={content.ticketHeading || 'Escolhe o teu bilhete'}
      />
    )
  }
  if (hasTickets && !guestStatus) {
    return (
      <button type="button" onClick={() => setChoosingTicket(true)} className={buttonClass} style={{ borderColor: accent }}>
        {buttonContent}
      </button>
    )
  }
  return (
    <a
      href={href}
      target={mode === 'external' ? '_blank' : undefined}
      rel={mode === 'external' ? 'noreferrer' : undefined}
      className={buttonClass}
      style={{ borderColor: accent }}
    >
      {buttonContent}
    </a>
  )
}

// Secção de membros (bilhete de família ou grupo): nome, idade e — se a pessoa
// tiver menos de 11 anos — uma observação / necessidade especial.
function MembersSection({ title, members, setMembers, max, inputCls }) {
  const add = () => setMembers([...members, { nome: '', idade: '', observacoes: '' }])
  const patch = (i, chg) => setMembers(members.map((m, idx) => (idx === i ? { ...m, ...chg } : m)))
  const remove = (i) => setMembers(members.filter((_, idx) => idx !== i))
  const atMax = max && members.length >= max
  const isChild = (age) => age !== '' && age != null && Number(age) < 11
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border bg-background/60 p-3">
      <p className="m-0 text-sm font-semibold text-foreground">
        {title}
        {max ? <span className="font-normal text-muted-foreground"> · até {max} pessoas</span> : null}
      </p>
      <p className="m-0 text-xs text-muted-foreground">
        Indique o nome e a idade de cada pessoa. Para menores de 11 anos, indique também observações ou necessidades especiais.
      </p>
      {members.map((m, i) => (
        <div key={i} className="flex items-start gap-2 rounded-lg border border-border bg-background p-2">
          <div className="grid flex-1 grid-cols-1 gap-1.5">
            <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
              <input className={inputCls} placeholder={`Nome da pessoa ${i + 1}`} value={m.nome ?? ''} onChange={(e) => patch(i, { nome: e.target.value })} />
              <input type="number" inputMode="numeric" min="0" max="120" className={inputCls} placeholder="Idade" value={m.idade ?? ''} onChange={(e) => patch(i, { idade: e.target.value })} />
            </div>
            {isChild(m.idade) ? (
              <input
                className={inputCls}
                placeholder="Observações / necessidades especiais (menor de 11)"
                value={m.observacoes ?? ''}
                onChange={(e) => patch(i, { observacoes: e.target.value })}
              />
            ) : null}
          </div>
          <button type="button" onClick={() => remove(i)} className="mt-1 rounded p-1 text-destructive hover:bg-destructive/10" aria-label="Remover pessoa">
            <Trash2 className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={add}
        disabled={atMax}
        className="inline-flex items-center gap-1 self-start rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs font-semibold text-foreground hover:bg-accent disabled:opacity-50"
      >
        <Plus className="h-3.5 w-3.5" aria-hidden="true" />
        Adicionar pessoa
      </button>
      {atMax ? <span className="text-xs text-muted-foreground">Limite de {max} pessoas atingido.</span> : null}
    </div>
  )
}

export function RsvpCard({ block, page, accent, onSubmitted, guestStatus, preview = false }) {
  const c = block.content || {}
  const inv = page.invite
  const fields = getFormFields(c)
  // Em pré-visualização (organizador) o formulário mostra-se sempre, mesmo que o
  // prazo tenha terminado ou as inscrições ainda não tenham aberto.
  const [deadlinePassed] = useState(
    () => !preview && Boolean(inv.rsvpDeadline) && Date.now() > Date.parse(inv.rsvpDeadline)
  )
  const [notOpenYet] = useState(
    () => !preview && Boolean(inv.rsvpStartDatetime) && Date.now() < Date.parse(inv.rsvpStartDatetime)
  )
  const tickets = (page.tickets || []).filter((t) => !t.soldOut)
  const hasTickets = tickets.length > 0
  const [values, setValues] = useState(() => initialValues(fields))
  const [errors, setErrors] = useState({})
  const [ticketId, setTicketId] = useState(() => {
    if (typeof window === 'undefined') return preview && tickets.length ? tickets[0].id : ''
    const wanted = new URLSearchParams(window.location.search).get('ticket')
    if (wanted && tickets.some((t) => t.id === wanted)) return wanted
    // Na pré-visualização do Admin, seleciona logo o 1.º bilhete para mostrar o formulário.
    return preview && tickets.length ? tickets[0].id : ''
  })
  const [members, setMembers] = useState([{ nome: '', idade: '', observacoes: '' }])
  const [busy, setBusy] = useState(false)

  // Já respondeu (tem estado): confirmação com o MESMO layout do email.
  if (guestStatus) {
    const ticketLink = typeof window !== 'undefined' ? window.location.href : ''
    const code = guestStatus.code || ''
    // QR apenas com o NÚMERO do bilhete (código).
    const qrSrc = code
      ? `https://api.qrserver.com/v1/create-qr-code/?size=220x220&margin=8&data=${encodeURIComponent(code)}`
      : ''
    const guestTicket = (page.tickets || []).find((t) => t.id === guestStatus.ticketId) || null
    const whenText = fmtWhenLong(inv.startDatetime)
    const valueLine = guestTicket
      ? guestTicket.kind === 'voluntaria'
        ? 'Doação (valor à tua escolha)'
        : guestTicket.kind === 'gratis'
          ? 'Grátis'
          : guestTicket.price != null && guestTicket.price > 0
            ? `Valor: ${Number(guestTicket.price).toFixed(2)} ${guestTicket.currency || 'EUR'}`
            : 'Grátis'
      : ''
    return (
      <div id="inscricoes" className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        {inv.bannerUrl ? <img src={inv.bannerUrl} alt={inv.title} className="h-auto w-full object-cover" /> : null}
        <div className="flex flex-col gap-3 p-6">
          <h2 className="m-0 text-xl font-bold" style={{ color: accent }}>
            Inscrição registada
          </h2>
          <p className="m-0 text-sm text-foreground">{guestStatus.name ? `Olá ${guestStatus.name},` : 'Olá,'}</p>
          <p className="m-0 text-sm text-foreground">
            Recebemos a tua inscrição em <strong>{inv.title}</strong>.
          </p>
          {whenText ? (
            <p className="m-0 text-sm text-muted-foreground">
              <strong className="text-foreground">Quando:</strong> {whenText}
            </p>
          ) : null}
          {inv.location ? (
            <p className="m-0 text-sm text-muted-foreground">
              <strong className="text-foreground">Local:</strong> {inv.location}
            </p>
          ) : null}
          {guestStatus.message ? (
            <p className="m-0 rounded-lg bg-muted p-3 text-sm text-foreground">{guestStatus.message}</p>
          ) : null}
          {guestTicket ? (
            <div className="rounded-lg border border-border p-3">
              <p className="m-0 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Bilhete</p>
              <p className="m-0 mt-0.5 font-bold text-foreground">{guestTicket.name}</p>
              {valueLine ? <p className="m-0 text-sm text-foreground">{valueLine}</p> : null}
              {code ? (
                <p className="m-0 mt-1 text-sm text-foreground">
                  Código: <span className="font-mono font-bold">{code}</span>
                </p>
              ) : null}
            </div>
          ) : code ? (
            <p className="m-0 text-sm text-muted-foreground">
              Código do bilhete: <span className="font-mono font-bold text-foreground">{code}</span>
            </p>
          ) : null}
          {Array.isArray(guestStatus.data) && guestStatus.data.length ? (
            <div className="flex flex-col gap-1 rounded-lg border border-border p-3">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Dados da inscrição</span>
              <dl className="grid grid-cols-1 gap-x-4 gap-y-1 text-sm sm:grid-cols-2">
                {guestStatus.data.map((d, i) => (
                  <div key={i} className="flex flex-col">
                    <dt className="text-xs text-muted-foreground">{d.label}</dt>
                    <dd className="m-0 text-foreground">{d.value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          ) : null}
          {qrSrc ? (
            <div className="flex flex-col items-center gap-2 pt-1">
              <img src={qrSrc} alt="QR do bilhete" width={200} height={200} className="rounded-xl border border-border" />
              <p className="m-0 text-xs text-muted-foreground">Lê o QR ou abre o teu bilhete:</p>
              {ticketLink ? (
                <a href={ticketLink} className="max-w-full break-all text-center text-xs font-semibold hover:underline" style={{ color: accent }}>
                  {ticketLink}
                </a>
              ) : null}
            </div>
          ) : null}
          {guestStatus.managePassword ? (
            <div className="rounded-lg border border-dashed border-border bg-muted/40 p-4">
              <p className="m-0 text-sm font-bold text-foreground">Gerir a tua inscrição</p>
              <p className="m-0 mt-1 text-xs text-muted-foreground">
                Guarda a senha abaixo — precisas dela (com o código) para cancelar ou pedir reembolso.
              </p>
              <div className="mt-2 flex flex-col gap-1 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-muted-foreground">Código de reserva</span>
                  <span className="font-mono font-bold text-foreground">{guestStatus.manageCode || code}</span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-muted-foreground">Senha</span>
                  <span className="font-mono font-bold text-foreground">{guestStatus.managePassword}</span>
                </div>
              </div>
              {guestStatus.manageUrl ? (
                <a
                  href={guestStatus.manageUrl}
                  className="mt-3 inline-flex w-fit items-center gap-1.5 text-sm font-semibold hover:underline"
                  style={{ color: accent }}
                >
                  Gerir inscrição
                </a>
              ) : null}
            </div>
          ) : null}
          <p className="m-0 text-xs text-muted-foreground">
            Guarda esta página — tem os dados do teu bilhete. O link é pessoal e único desta inscrição.
          </p>
        </div>
      </div>
    )
  }

  const setVal = (key, v) => {
    setValues((s) => ({ ...s, [key]: v }))
    setErrors((e) => {
      if (!e[key]) return e
      const n = { ...e }
      delete n[key]
      return n
    })
  }
  const inputCls = 'w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground'
  const visible = visibleKeys(fields, values, ticketId)
  const selectedTicket = tickets.find((t) => t.id === ticketId) || null
  const partyType =
    selectedTicket &&
    (selectedTicket.kind === 'grupo' || selectedTicket.partyType === 'family' || selectedTicket.partyType === 'group')
      ? 'group'
      : 'single'
  const hasMembers = partyType === 'group'
  const membersCap = selectedTicket?.groupSize || null
  // Métodos de pagamento oferecidos pelo bilhete — mostrados só como informação;
  // o pagamento é despoletado depois, a partir do bilhete enviado por email.
  const ticketPayMethods = selectedTicket?.paymentMethods || []

  const submit = async (e) => {
    e.preventDefault()
    const errs = validateFields(fields, values, ticketId)
    if (Object.keys(errs).length) {
      setErrors(errs)
      const firstKey = fields.find((f) => errs[f.key])?.key
      if (firstKey && typeof document !== 'undefined') {
        document.getElementById(`f_${firstKey}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }
      toast.error('Corrige os campos assinalados.')
      return
    }
    setErrors({})
    if (hasTickets && !ticketId) {
      toast.error('Escolha um bilhete.')
      return
    }
    const cleanMembers = hasMembers ? members.filter((m) => (m.nome || '').trim()) : []
    if (hasMembers && cleanMembers.length === 0) {
      toast.error('Indique pelo menos um membro do grupo.')
      return
    }
    const { name, email, phone, extra } = buildSubmission(fields, values, ticketId)
    if (!name.trim()) {
      toast.error('Indique o seu nome.')
      return
    }
    if (preview) {
      toast.success('Pré-visualização: o formulário é válido (não é submetido).')
      return
    }
    const finalExtra = { ...extra }
    if (cleanMembers.length) {
      finalExtra.membros = cleanMembers
      finalExtra.tipoInscricao = 'Grupo'
    }
    // As crianças NÃO contam para a assistência (capacidade) — os dados ficam
    // guardados e o nº de crianças é contabilizado à parte (numCriancas).
    const isChildMember = (m) => m.idade !== '' && m.idade != null && Number(m.idade) < 11
    const memberChildren = hasMembers ? cleanMembers.filter(isChildMember).length : 0
    const childrenCount = countChildren(fields, values, ticketId) + memberChildren
    if (childrenCount > 0) finalExtra.numCriancas = childrenCount
    const peopleCount = hasMembers
      ? Math.max(1, cleanMembers.length - memberChildren)
      : countPeople(fields, values, ticketId)
    // Lista de espera: se a lotação estiver esgotada, avisa e pede confirmação.
    let acceptWaitlist = false
    const cap = page.invite?.capacity
    const left = page.invite?.spotsLeft
    if (cap && left != null && peopleCount > left) {
      if (page.invite?.waitlistEnabled) {
        const ok =
          typeof window !== 'undefined' &&
          window.confirm('As vagas estão esgotadas. Queres inscrever-te na lista de espera?')
        if (!ok) return
        acceptWaitlist = true
      } else {
        toast.error('As inscrições estão esgotadas.')
        return
      }
    }
    setBusy(true)
    try {
      const res = await invitesService.submitRsvp(page.slug, {
        name,
        email,
        phone,
        guestsCount: peopleCount,
        attend: true,
        ticketId: ticketId || null,
        acceptWaitlist,
        extra: Object.keys(finalExtra).length ? finalExtra : null,
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
    if (!visible.has(f.key)) return null
    if (f.type === 'section') {
      return (
        <div key={f.key} className="mt-2 border-b border-border pb-1">
          <h3 className="m-0 text-sm font-bold uppercase tracking-wide text-muted-foreground">{f.label}</h3>
        </div>
      )
    }
    if (f.type === 'document') {
      if (!f.url) return null
      return (
        <div key={f.key} id={`f_${f.key}`} className="text-sm">
          <a
            href={f.url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 font-medium underline"
            style={{ color: accent }}
          >
            <FileText className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
            {f.label || 'Documento'}
          </a>
          {f.help ? <span className="mt-0.5 block text-xs font-normal text-muted-foreground">{f.help}</span> : null}
        </div>
      )
    }
    const val = values[f.key]
    const err = errors[f.key]
    const req = f.required ? <span className="text-destructive"> *</span> : null
    const help = f.help ? <span className="text-xs font-normal text-muted-foreground">{f.help}</span> : null
    const errMsg = err ? <span className="text-xs font-normal text-destructive">{err}</span> : null
    const fieldCls = inputCls + (err ? ' border-destructive' : '')

    if (f.type === 'children') {
      const kids = Array.isArray(val) ? val : []
      const setKids = (next) => setVal(f.key, next)
      const patchKid = (i, patch) => setKids(kids.map((k, idx) => (idx === i ? { ...k, ...patch } : k)))
      return (
        <div key={f.key} id={`f_${f.key}`} className="flex flex-col gap-2 rounded-lg border border-border bg-background/60 p-3">
          <p className="m-0 text-sm font-medium text-foreground">
            {f.label}
            {req}
          </p>
          {f.help ? <p className="m-0 text-xs font-normal text-muted-foreground">{f.help}</p> : null}
          {err ? <p className="m-0 text-xs font-normal text-destructive">{err}</p> : null}
          {kids.map((kid, i) => (
            <div key={i} className="flex items-start gap-2 rounded-lg border border-border bg-background p-2">
              <div className="grid flex-1 grid-cols-1 gap-1.5 sm:grid-cols-3">
                <input className={inputCls} placeholder="Nome" value={kid.nome ?? ''} onChange={(e) => patchKid(i, { nome: e.target.value })} />
                <input type="number" inputMode="numeric" min="0" max="18" className={inputCls} placeholder="Idade" value={kid.idade ?? ''} onChange={(e) => patchKid(i, { idade: e.target.value })} />
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
        <label key={f.key} id={`f_${f.key}`} className="flex items-start gap-2 text-sm text-foreground">
          <input type="checkbox" className="mt-0.5 h-4 w-4 flex-shrink-0" checked={!!val} aria-invalid={!!err} aria-required={!!f.required} onChange={(e) => setVal(f.key, e.target.checked)} />
          <span>
            {f.label}
            {req}
            {f.link ? (
              <>
                {' '}
                <a href={f.link} target="_blank" rel="noreferrer" className="underline" style={{ color: accent }}>
                  (ler)
                </a>
              </>
            ) : null}
            {f.help ? <span className="block text-xs font-normal text-muted-foreground">{f.help}</span> : null}
            {err ? <span className="block text-xs font-normal text-destructive">{err}</span> : null}
          </span>
        </label>
      )
    }

    if (f.type === 'select') {
      return (
        <label key={f.key} id={`f_${f.key}`} className="flex flex-col gap-1 text-sm font-medium text-foreground">
          <span>
            {f.label}
            {req}
          </span>
          {help}
          <select className={fieldCls} value={val ?? ''} aria-invalid={!!err} aria-required={!!f.required} onChange={(e) => setVal(f.key, e.target.value)}>
            <option value="">— Selecione —</option>
            {(f.options || []).map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
          {errMsg}
        </label>
      )
    }

    if (f.type === 'radio') {
      return (
        <fieldset key={f.key} id={`f_${f.key}`} className="m-0 flex min-w-0 flex-col gap-1 border-0 p-0 text-sm font-medium text-foreground">
          <legend className="float-left p-0">
            {f.label}
            {req}
          </legend>
          {help}
          <div className="flex flex-wrap gap-3">
            {(f.options || []).map((o) => (
              <label key={o} className="inline-flex items-center gap-1.5 font-normal">
                <input type="radio" name={f.key} value={o} checked={val === o} onChange={() => setVal(f.key, o)} />
                {o}
              </label>
            ))}
          </div>
          {errMsg}
        </fieldset>
      )
    }

    if (f.type === 'multiselect') {
      const selected = Array.isArray(val) ? val : []
      const toggle = (o) => setVal(f.key, selected.includes(o) ? selected.filter((x) => x !== o) : [...selected, o])
      return (
        <fieldset key={f.key} id={`f_${f.key}`} className="m-0 flex min-w-0 flex-col gap-1 border-0 p-0 text-sm font-medium text-foreground">
          <legend className="float-left p-0">
            {f.label}
            {req}
          </legend>
          {help}
          <div className="flex flex-col gap-1.5">
            {(f.options || []).map((o) => (
              <label key={o} className="inline-flex items-center gap-2 font-normal">
                <input type="checkbox" className="h-4 w-4" checked={selected.includes(o)} onChange={() => toggle(o)} />
                {o}
              </label>
            ))}
          </div>
          {errMsg}
        </fieldset>
      )
    }

    if (f.type === 'textarea') {
      return (
        <label key={f.key} id={`f_${f.key}`} className="flex flex-col gap-1 text-sm font-medium text-foreground">
          <span>
            {f.label}
            {req}
          </span>
          {help}
          <textarea className={fieldCls} rows={2} placeholder={f.placeholder ?? ''} value={val ?? ''} aria-invalid={!!err} aria-required={!!f.required} onChange={(e) => setVal(f.key, e.target.value)} />
          {errMsg}
        </label>
      )
    }

    const inputType = f.type === 'email' ? 'email' : f.type === 'tel' ? 'tel' : f.type === 'number' ? 'number' : 'text'
    const autoComplete = f.key === 'name' ? 'name' : f.key === 'email' ? 'email' : f.key === 'phone' ? 'tel' : undefined
    const inputMode = f.type === 'tel' ? 'tel' : f.type === 'number' ? 'numeric' : f.type === 'email' ? 'email' : undefined
    return (
      <label key={f.key} id={`f_${f.key}`} className="flex flex-col gap-1 text-sm font-medium text-foreground">
        <span>
          {f.label}
          {req}
        </span>
        {help}
        <input
          type={inputType}
          inputMode={inputMode}
          autoComplete={autoComplete}
          aria-invalid={!!err}
          aria-required={!!f.required}
          className={fieldCls}
          placeholder={f.placeholder ?? ''}
          value={val ?? ''}
          onChange={(e) => setVal(f.key, e.target.value)}
        />
        {errMsg}
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
      ) : hasTickets && !ticketId ? (
        <TicketChooser
          tickets={tickets}
          accent={accent}
          onSelect={setTicketId}
          heading={c.ticketHeading || 'Escolhe o teu bilhete'}
        />
      ) : (
        <form onSubmit={submit} className="flex flex-col gap-3">
          {hasTickets && selectedTicket ? (
            <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-muted/40 p-3">
              <div className="flex min-w-0 flex-col">
                <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Bilhete</span>
                <span className="truncate text-sm font-bold text-foreground">
                  {selectedTicket.name}
                  <span className="font-normal text-muted-foreground"> · {ticketPrice(selectedTicket)}</span>
                </span>
              </div>
              <button
                type="button"
                onClick={() => setTicketId('')}
                className="shrink-0 rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-accent"
              >
                Trocar bilhete
              </button>
            </div>
          ) : null}

          {/* Secção de membros (bilhete de grupo) */}
          {hasMembers ? (
            <MembersSection
              title="Inscrição do grupo"
              members={members}
              setMembers={setMembers}
              max={membersCap}
              inputCls={inputCls}
            />
          ) : null}
          {/* Métodos de pagamento: só informação. O pagamento faz-se depois, a partir do bilhete (email). */}
          {ticketPayMethods.length > 0 ? (
            <div className="flex flex-col gap-1 rounded-lg border border-border bg-muted/30 p-3 text-sm">
              <span className="font-semibold text-foreground">Métodos de pagamento</span>
              <span className="text-muted-foreground">{ticketPayMethods.map((m) => payLabel(page.invite, m)).join(' · ')}</span>
              <span className="text-xs text-muted-foreground">
                O pagamento é feito depois, a partir do teu bilhete (enviado por email após a inscrição).
              </span>
            </div>
          ) : null}
          {fields.map(renderField)}
          <button
            type="submit"
            disabled={busy}
            className="mt-1 inline-flex items-center justify-center gap-2 rounded-lg px-5 py-2.5 text-sm font-bold text-white shadow-sm transition-opacity hover:opacity-90 disabled:opacity-60"
            style={{ backgroundColor: accent }}
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Ticket className="h-4 w-4" aria-hidden="true" />}
            Confirmar inscrição
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

// Nome público de um método de pagamento: usa o rótulo configurado no Admin
// (inclui os personalizados), com fallback para os integrados e para a chave.
function payLabel(invite, method) {
  return invite?.paymentMethodLabels?.[method] || PAYMENT_METHOD_LABEL[method] || method
}

// Se o método exige comprovativo de pagamento (config no Admin; por omissão sim).
function receiptRequired(invite, method) {
  return invite?.paymentMethodReceipt?.[method] !== false
}

// Tipo de um método de pagamento (chave → tipo), definido no Admin. Decide o fluxo.
function methodType(invite, method) {
  return invite?.paymentMethodType?.[method] || null
}

// URL do formulário JotForm que processa os pagamentos MB WAY.
const JOTFORM_MBWAY_URL = 'https://form.jotform.com/240093000783346'

// Constrói o URL do JotForm com os campos pré-preenchidos.
function buildJotformUrl({ local, mobile, eventId, ticketId }) {
  const p = new URLSearchParams()
  p.set('local', local || 'Porto')
  p.set('tipoDe77', 'Eventos')
  p.set('telemovelassociado', mobile || '')
  p.set('refdataid', eventId || '')
  p.set('eventid', ticketId || '')
  return `${JOTFORM_MBWAY_URL}?${p.toString()}`
}

// Fluxo MB WAY: confirmar telemóvel → abrir o JotForm (nova aba) → janela de
// espera com confirmação (fica "em validação" para o organizador confirmar).
function MbwayFlow({ slug, guestToken, invite, guestStatus, accent, onUpdate }) {
  const [mobile, setMobile] = useState(() => guestStatus?.phone || '')
  const [stage, setStage] = useState('confirm') // 'confirm' | 'waiting'
  const [uploading, setUploading] = useState(false)
  const cardCls = 'rounded-2xl border border-border bg-card p-6 shadow-sm'

  const cleanMobile = (mobile || '').replace(/\D/g, '')
  const jotformUrl = buildJotformUrl({
    local: guestStatus?.jotformCommunity,
    mobile: cleanMobile,
    eventId: invite.eventId || slug,
    ticketId: guestStatus?.ticketId,
  })

  // Abre o JotForm numa NOVA página (link real com target=_blank → nunca é
  // bloqueado como popup); valida o telemóvel antes de navegar.
  const onPayClick = (e) => {
    if (cleanMobile.length < 9) {
      e.preventDefault()
      toast.error('Indica um número de telemóvel válido.')
      return
    }
    setStage('waiting')
  }

  // Confirmação do pagamento MB WAY = carregar o comprovativo (obrigatório) →
  // fica "em validação" para o organizador confirmar.
  const onReceipt = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const p = await invitesService.uploadReceipt(slug, guestToken, file)
      onUpdate?.({ ...guestStatus, paymentState: p.status })
      toast.success(p.status === 'paid' ? 'Comprovativo enviado. Obrigado!' : 'Comprovativo enviado. Aguarda validação.')
    } catch (err) {
      toast.error(err.message)
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  return (
    <div className={cardCls}>
      <h2 className="m-0 mb-3 inline-flex items-center gap-2 text-lg font-bold text-foreground">
        <CreditCard className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
        Pagamento — MB WAY
      </h2>
      {stage === 'confirm' ? (
        <div className="flex flex-col gap-3">
          <p className="m-0 text-sm text-muted-foreground">
            Confirma o número de telemóvel associado ao MB WAY. Podes alterá-lo se necessário.
          </p>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-semibold text-foreground">Telemóvel MB WAY</span>
            <span className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2">
              <Smartphone className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
              <input
                type="tel"
                inputMode="numeric"
                autoComplete="tel"
                value={mobile}
                onChange={(e) => setMobile(e.target.value)}
                placeholder="9XX XXX XXX"
                className="w-full bg-transparent text-foreground outline-none"
              />
            </span>
          </label>
          <a
            href={jotformUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={onPayClick}
            className="inline-flex w-fit items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-bold text-white shadow-sm transition-opacity hover:opacity-90"
            style={{ backgroundColor: accent }}
          >
            <ExternalLink className="h-4 w-4" aria-hidden="true" />
            Pagar com MB WAY
          </a>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="flex items-start gap-3 rounded-lg bg-muted p-4">
            <Smartphone className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" aria-hidden="true" />
            <p className="m-0 text-sm text-foreground">
              Confirma o pagamento na app <strong>MB WAY</strong> no teu telemóvel. Depois de pagares com
              sucesso, carrega aqui o comprovativo para confirmarmos a tua inscrição.
            </p>
          </div>
          <label
            className="inline-flex w-fit cursor-pointer items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-bold text-white shadow-sm transition-opacity hover:opacity-90"
            style={{ backgroundColor: accent }}
          >
            {uploading ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <Upload className="h-4 w-4" aria-hidden="true" />
            )}
            {uploading ? 'A enviar…' : `Carregar comprovativo${receiptRequired(invite, guestStatus?.paymentMethod) ? ' (obrigatório)' : ' (opcional)'}`}
            <input type="file" accept="image/png,image/jpeg,application/pdf" className="hidden" onChange={onReceipt} />
          </label>
          <a
            href={jotformUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex w-fit items-center gap-1.5 text-sm font-semibold hover:underline"
            style={{ color: accent }}
          >
            <ExternalLink className="h-4 w-4" aria-hidden="true" />
            Reabrir pagamento MB WAY
          </a>
        </div>
      )}
    </div>
  )
}

// Fluxo de pagamento do convidado (aparece só para eventos pagos, a quem já se
// inscreveu). Escolha do método → instruções (IBAN/referência) → comprovativo.
function PaymentFlowCard({ slug, guestToken, invite, guestStatus, accent, onUpdate }) {
  // Mostra a secção de pagamento/comprovativo quando o bilhete do convidado NÃO
  // é grátis (pago OU doação). O anexo do comprovativo está sempre ligado ao bilhete.
  const applicable = !!guestToken && !!guestStatus && guestStatus.showReceipt
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

  // MB WAY Contribuir (integração JotForm): fluxo dedicado (telemóvel → JotForm → comprovativo).
  const payMethod = guestStatus.paymentMethod || invite.paymentMethod || null
  if (methodType(invite, payMethod) === 'mbway-contribuir') {
    return (
      <MbwayFlow
        slug={slug}
        guestToken={guestToken}
        invite={invite}
        guestStatus={guestStatus}
        accent={accent}
        onUpdate={onUpdate}
      />
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
      toast.success(p.status === 'paid' ? 'Comprovativo enviado. Obrigado!' : 'Comprovativo enviado. Aguarda validação.')
    } catch (err) {
      toast.error(err.message)
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  // Método do bilhete (o convidado já não escolhe — vem resolvido do bilhete).
  const isDonation = !!guestStatus.isDonation
  // Doação = contribuição voluntária → comprovativo sempre OPCIONAL. Caso
  // contrário, respeita a configuração do método (paymentMethodReceipt).
  const receiptReq = !isDonation && receiptRequired(invite, payMethod)
  const methods = payMethod ? [payMethod] : []
  const instr = payment?.instructions

  // Anexar comprovativo — sempre disponível, ligado ao bilhete (mostra se é
  // obrigatório ou opcional). Não obriga a "iniciar" o pagamento primeiro.
  const receiptBlock = (
    <div className="mt-3 flex flex-col gap-1.5 border-t border-border/60 pt-3">
      <p className="m-0 text-sm text-foreground">
        {receiptReq ? 'Este bilhete exige comprovativo de pagamento.' : 'Comprovativo opcional para este bilhete.'}
      </p>
      <label
        className="inline-flex cursor-pointer items-center gap-2 self-start rounded-lg px-4 py-2 text-sm font-bold text-white hover:opacity-90"
        style={{ backgroundColor: accent }}
      >
        {uploading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Upload className="h-4 w-4" aria-hidden="true" />}
        {uploading ? 'A enviar…' : `Anexar comprovativo${receiptReq ? ' (obrigatório)' : ' (opcional)'}`}
        <input type="file" accept="image/png,image/jpeg,application/pdf" className="hidden" onChange={onReceipt} />
      </label>
    </div>
  )

  return (
    <div className={cardCls}>
      <h2 className="m-0 mb-3 inline-flex items-center gap-2 text-lg font-bold text-foreground">
        <CreditCard className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
        {isDonation ? 'Contribuição' : 'Pagamento'}
      </h2>
      {isDonation ? (
        <p className="m-0 mb-3 text-sm text-muted-foreground">
          A tua inscrição está confirmada. A contribuição é voluntária — se quiseres contribuir, usa o método abaixo.
        </p>
      ) : null}
      {!instr ? (
        <div className="flex flex-col gap-2">
          {methods.length === 0 ? (
            <p className="m-0 text-sm text-muted-foreground">Sem método de pagamento configurado. Contacta o organizador.</p>
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
                  {busy ? 'A carregar…' : `Como pagar — ${payLabel(invite, m)}`}
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
            Paga no homebanking ou Multibanco. Confirmamos a inscrição assim que recebermos o pagamento.
          </p>
        </div>
      ) : instr.type === 'mbway' ? (
        <div className="flex flex-col gap-2">
          <p className="m-0 text-sm text-muted-foreground">
            {instr.note || 'Envia o valor por MB WAY para um dos números indicados e depois anexa o comprovativo.'}
          </p>
          {(instr.numbers || []).length ? (
            <div className="flex flex-col gap-1">
              {instr.numbers.map((n) => (
                <div key={n} className={rowCls}>
                  <span className="text-muted-foreground">MB WAY</span>
                  <span className="font-mono font-semibold text-foreground">{n}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="m-0 text-sm text-muted-foreground">Sem números configurados. Contacta o organizador.</p>
          )}
          {instr.amount != null ? (
            <div className={rowCls}>
              <span className="text-muted-foreground">Valor</span>
              <span className="font-semibold text-foreground">{Number(instr.amount).toFixed(2)} {instr.currency}</span>
            </div>
          ) : null}
        </div>
      ) : instr.type === 'cash' ? (
        <div className="flex flex-col gap-2">
          <p className="m-0 text-sm text-muted-foreground">
            {instr.note || 'Paga em numerário junto de um líder, banca da igreja ou livraria, e depois anexa o comprovativo.'}
          </p>
          {instr.amount != null ? (
            <div className={rowCls}>
              <span className="text-muted-foreground">Valor</span>
              <span className="font-semibold text-foreground">{Number(instr.amount).toFixed(2)} {instr.currency}</span>
            </div>
          ) : null}
        </div>
      ) : instr.type === 'custom' ? (
        <div className="flex flex-col gap-2">
          <p className="m-0 text-sm text-muted-foreground">
            {instr.note || 'Segue as instruções do organizador para concluir o pagamento e depois anexa o comprovativo.'}
          </p>
          {instr.amount != null ? (
            <div className={rowCls}>
              <span className="text-muted-foreground">Valor</span>
              <span className="font-semibold text-foreground">{Number(instr.amount).toFixed(2)} {instr.currency}</span>
            </div>
          ) : null}
        </div>
      ) : null}
      {receiptBlock}
    </div>
  )
}

export default function InvitePage({ slug, view = 'landing', previewId = null }) {
  const [state, setState] = useState({ loading: true, error: null, page: null })
  const [guestStatus, setGuestStatus] = useState(null)
  const [guestToken, setGuestToken] = useState(
    () => (previewId ? undefined : new URLSearchParams(window.location.search).get('g') || undefined)
  )

  useEffect(() => {
    let alive = true
    const params = new URLSearchParams(window.location.search)
    const token = previewId ? undefined : params.get('g') || undefined
    // Pré-visualização (organizador autenticado): usa o payload de preview, que
    // funciona mesmo com o convite em rascunho ou com as inscrições fechadas.
    const load = previewId
      ? invitesService.getInvitePreview(previewId)
      : invitesService.getPublicInvite(slug, token)
    load
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
  }, [slug, previewId])

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
    // Atualiza o contador de vagas de imediato (sem recarregar).
    if (res.spotsLeft != null) {
      setState((s) => (s.page ? { ...s, page: { ...s.page, invite: { ...s.page.invite, spotsLeft: res.spotsLeft } } } : s))
    }
    // Atualiza o URL com o token pessoal para futuras visitas (sem recarregar).
    if (res.token) {
      setGuestToken(res.token)
      const url = new URL(window.location.href)
      url.searchParams.set('g', res.token)
      window.history.replaceState({}, '', url)
    }
  }

  const homeHref = inviteHomeHref(slug)

  // Página dedicada de inscrição (/invite/<slug>/inscricao): cabeçalho compacto,
  // contador de vagas, formulário e (para pagos) o fluxo de pagamento.
  if (view === 'rsvp') {
    const mode = page.invite.registrationMode || 'internal'
    if (mode !== 'internal') {
      return (
        <div className="min-h-screen bg-background pb-10" style={{ '--invite-accent': accent }}>
          <Toaster position="top-center" richColors />
          <div className="mx-auto flex max-w-3xl flex-col gap-4 px-4 pt-4">
            <a href={homeHref} className="inline-flex w-fit items-center gap-1.5 text-sm font-semibold hover:underline" style={{ color: accent }}>
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              Voltar ao convite
            </a>
            <div className="rounded-2xl border border-border bg-card p-6 text-center shadow-sm">
              <h1 className="m-0 text-lg font-bold text-foreground">{page.invite.title}</h1>
              {mode === 'external' ? (
                <a href={page.invite.registrationUrl || '#'} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-bold text-white" style={{ backgroundColor: accent }}>
                  <Ticket className="h-4 w-4" aria-hidden="true" />
                  Ir para a inscrição
                </a>
              ) : (
                <p className="m-0 mt-2 text-sm text-muted-foreground">Este convite não tem inscrições.</p>
              )}
            </div>
          </div>
        </div>
      )
    }
    const rsvpBlock = page.blocks.find((b) => b.type === 'rsvp') || { id: 'rsvp', type: 'rsvp', content: {} }
    return (
      <div className="min-h-screen bg-background pb-10" style={{ '--invite-accent': accent }}>
        <Toaster position="top-center" richColors />
        <div className="mx-auto flex max-w-3xl flex-col gap-4 px-4 pt-4">
          <a href={homeHref} className="inline-flex w-fit items-center gap-1.5 text-sm font-semibold hover:underline" style={{ color: accent }}>
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Voltar ao convite
          </a>
          {!guestStatus ? (
            <>
              <BannerCard
                block={page.blocks.find((b) => b.type === 'banner' || b.type === 'cabecalho') || { content: {} }}
                page={page}
                accent={accent}
              />
              {page.invite.spotsOnRegistration ? <SpotsCounter invite={page.invite} accent={accent} /> : null}
            </>
          ) : null}
          <RsvpCard block={rsvpBlock} page={page} accent={accent} guestStatus={guestStatus} onSubmitted={onRsvpSubmitted} preview={page.preview} />
          <PaymentFlowCard
            slug={page.slug}
            guestToken={guestToken}
            invite={page.invite}
            guestStatus={guestStatus}
            accent={accent}
            onUpdate={setGuestStatus}
          />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background pb-10" style={{ '--invite-accent': accent }}>
      <Toaster position="top-center" richColors />
      {page.preview ? (
        <div className="bg-amber-500 py-1.5 text-center text-xs font-bold uppercase tracking-wide text-white">
          Pré-visualização
        </div>
      ) : null}
      <div className="mx-auto flex max-w-3xl flex-col gap-4 px-4 pt-4">
        {guestStatus ? <StatusCard status={guestStatus} /> : null}
        {page.blocks.map((block) => {
          if (block.type === 'rsvp') {
            // O RSVP configura o formulário e só aparece na página dedicada de inscrição.
            // Na landing, o CTA e a escolha de bilhete pertencem ao banner.
            return null
          }
          const Comp = BLOCK_COMPONENTS[block.type]
          if (!Comp) return null
          if (block.type === 'banner' || block.type === 'cabecalho') {
            return (
              <Comp key={block.id} block={block} page={page} accent={accent} showInformation>
                {page.invite.spotsOnLanding ? <SpotsCounter invite={page.invite} accent={accent} /> : null}
                <BannerRegistrationAction
                  block={block}
                  invite={page.invite}
                  tickets={page.tickets}
                  slug={slug}
                  accent={accent}
                  guestStatus={guestStatus}
                  preview={page.preview}
                />
              </Comp>
            )
          }
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

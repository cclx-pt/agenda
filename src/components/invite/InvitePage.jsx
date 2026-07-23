import { useEffect, useState } from 'react'
import { toast, Toaster } from 'sonner'
import { Ticket, Loader2, CheckCircle2, Clock, CreditCard, Upload, Plus, Trash2, ArrowLeft, Users, Smartphone, ExternalLink, FileText } from 'lucide-react'
import * as invitesService from '../../services/invitesService'
import {
  BannerCard, OverviewCard, InfoExtraCard, NarrativeCard, GoodToKnowCard, SpeakersCard, AgendaCard, WorkshopsCard,
  PaymentCard, LocationCard, FaqsCard, ShareCard, FooterCard,
} from './InviteCards'
import { fmtDateRange, inviteRsvpHref, inviteHomeHref } from './inviteUtils'
import {
  getFormFields, visibleKeys, initialValues, validateFields, buildSubmission, countPeople,
} from './inviteFormFields'

// Mapa tipo → componente (rsvp é tratado à parte: precisa de estado/handlers).
const BLOCK_COMPONENTS = {
  banner: BannerCard,
  cabecalho: BannerCard,
  overview: OverviewCard,
  info_extra: InfoExtraCard,
  convite_narrativo: NarrativeCard,
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

// Rótulo de preço/tipo de um bilhete para as opções do seletor.
function ticketPriceLabel(t) {
  if (t.kind === 'gratis') return ' — Grátis'
  if (t.kind === 'voluntaria') {
    return t.price != null && t.price > 0
      ? ` — Doação (sugerido ${Number(t.price).toFixed(2)} ${t.currency})`
      : ' — Doação (valor à escolha)'
  }
  return t.price != null && t.price > 0 ? ` — ${Number(t.price).toFixed(2)} ${t.currency}` : ' — Grátis'
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
  const [deadlinePassed] = useState(
    () => Boolean(inv.rsvpDeadline) && Date.now() > Date.parse(inv.rsvpDeadline)
  )
  const [notOpenYet] = useState(
    () => Boolean(inv.rsvpStartDatetime) && Date.now() < Date.parse(inv.rsvpStartDatetime)
  )
  const tickets = (page.tickets || []).filter((t) => !t.soldOut)
  const hasTickets = tickets.length > 0
  const [values, setValues] = useState(() => initialValues(fields))
  const [errors, setErrors] = useState({})
  const [ticketId, setTicketId] = useState(() => {
    if (typeof window === 'undefined') return ''
    const wanted = new URLSearchParams(window.location.search).get('ticket')
    return wanted && tickets.some((t) => t.id === wanted) ? wanted : ''
  })
  const [members, setMembers] = useState([{ nome: '', idade: '', observacoes: '' }])
  const [paymentChoice, setPaymentChoice] = useState('')
  const [busy, setBusy] = useState(false)

  // Já respondeu (tem estado): mostra o estado + os dados do bilhete (email/código/QR/link).
  if (guestStatus) {
    const ticketLink = typeof window !== 'undefined' ? window.location.href : ''
    const qrSrc = ticketLink
      ? `https://api.qrserver.com/v1/create-qr-code/?size=200x200&margin=8&data=${encodeURIComponent(ticketLink)}`
      : ''
    return (
      <div id="inscricoes" className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-6 shadow-sm">
        <h2 className="m-0 text-xl font-bold text-foreground">Inscrição</h2>
        <StatusCard status={guestStatus} />
        <p className="m-0 rounded-lg bg-muted p-3 text-sm text-foreground">
          <strong>Verifica o teu email</strong> — enviámos os dados do bilhete e o link único da tua inscrição.
        </p>
        {guestStatus.code ? (
          <p className="m-0 text-sm text-muted-foreground">
            Código do bilhete: <span className="font-mono font-bold text-foreground">{guestStatus.code}</span>
          </p>
        ) : null}
        {qrSrc ? (
          <div className="flex justify-center">
            <img src={qrSrc} alt="QR do bilhete" width={180} height={180} className="rounded-xl border border-border" />
          </div>
        ) : null}
        {ticketLink ? (
          <div className="flex flex-col gap-1">
            <span className="text-xs font-semibold text-muted-foreground">O teu link (único):</span>
            <div className="flex items-center gap-2">
              <input readOnly value={ticketLink} className="w-full truncate rounded-lg border border-input bg-background px-3 py-2 text-xs text-muted-foreground" />
              <button
                type="button"
                onClick={() => {
                  try {
                    navigator.clipboard?.writeText(ticketLink)
                    toast.success('Link copiado.')
                  } catch {
                    /* clipboard indisponível */
                  }
                }}
                className="shrink-0 rounded-lg px-3 py-2 text-xs font-bold text-white"
                style={{ backgroundColor: accent }}
              >
                Copiar
              </button>
            </div>
          </div>
        ) : null}
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
  // Métodos de pagamento oferecidos pelo bilhete (vários → o convidado escolhe um).
  const ticketPayMethods = selectedTicket?.paymentMethods || []
  const effectiveMethod = ticketPayMethods.includes(paymentChoice) ? paymentChoice : ticketPayMethods[0] || ''

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
    if (effectiveMethod) finalExtra.paymentMethod = effectiveMethod
    const peopleCount = hasMembers ? Math.max(1, cleanMembers.length) : countPeople(fields, values, ticketId)
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
      ) : (
        <form onSubmit={submit} className="flex flex-col gap-3">
          {hasTickets ? (
            <label className="flex flex-col gap-1 text-sm font-medium text-foreground">
              Bilhete *
              <select className={inputCls} value={ticketId} onChange={(e) => setTicketId(e.target.value)}>
                <option value="">— Escolha o bilhete —</option>
                {tickets.map((t) => {
                  const pt = t.kind === 'grupo' || t.partyType === 'family' || t.partyType === 'group' ? 'group' : 'single'
                  return (
                    <option key={t.id} value={t.id}>
                      {t.name}
                      {ticketPriceLabel(t)}
                      {pt !== 'single' ? ` · Grupo${t.groupSize ? ` até ${t.groupSize}` : ''}` : ''}
                    </option>
                  )
                })}
              </select>
            </label>
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
          {/* Método de pagamento: se o bilhete oferecer vários, o convidado escolhe um. */}
          {ticketPayMethods.length > 1 ? (
            <fieldset className="flex flex-col gap-1.5 text-sm font-medium text-foreground">
              <legend className="mb-1">Método de pagamento *</legend>
              {ticketPayMethods.map((m) => (
                <label key={m} className="inline-flex items-center gap-2 font-normal text-foreground">
                  <input
                    type="radio"
                    name="paymentChoice"
                    checked={effectiveMethod === m}
                    onChange={() => setPaymentChoice(m)}
                  />
                  {payLabel(page.invite, m)}
                </label>
              ))}
            </fieldset>
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
      toast.success('Comprovativo enviado. Aguarda validação.')
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
                  {payLabel(invite, m)}
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
            {uploading ? 'A enviar…' : `Carregar comprovativo${receiptRequired(invite, payMethod) ? '' : ' (opcional)'}`}
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
      ) : instr.type === 'mbway' ? (
        <div className="flex flex-col gap-2">
          <p className="m-0 text-sm text-muted-foreground">
            {instr.note || 'Envie o valor por MB WAY para um dos números indicados e depois carregue o comprovativo.'}
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
            <p className="m-0 text-sm text-muted-foreground">Sem números configurados. Contacte o organizador.</p>
          )}
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
            {uploading ? 'A enviar…' : `Carregar comprovativo${receiptRequired(invite, payMethod) ? '' : ' (opcional)'}`}
            <input type="file" accept="image/png,image/jpeg,application/pdf" className="hidden" onChange={onReceipt} />
          </label>
        </div>
      ) : instr.type === 'cash' ? (
        <div className="flex flex-col gap-2">
          <p className="m-0 text-sm text-muted-foreground">
            {instr.note || 'Pague em numerário junto de um líder, banca da igreja ou livraria, e depois carregue o comprovativo.'}
          </p>
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
            {uploading ? 'A enviar…' : `Carregar comprovativo${receiptRequired(invite, payMethod) ? '' : ' (opcional)'}`}
            <input type="file" accept="image/png,image/jpeg,application/pdf" className="hidden" onChange={onReceipt} />
          </label>
        </div>
      ) : instr.type === 'custom' ? (
        <div className="flex flex-col gap-2">
          <p className="m-0 text-sm text-muted-foreground">
            {instr.note || 'Siga as instruções do organizador para concluir o pagamento e depois carregue o comprovativo.'}
          </p>
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
            {uploading ? 'A enviar…' : `Carregar comprovativo${receiptRequired(invite, payMethod) ? '' : ' (opcional)'}`}
            <input type="file" accept="image/png,image/jpeg,application/pdf" className="hidden" onChange={onReceipt} />
          </label>
        </div>
      ) : null}
    </div>
  )
}

// Bloco de inscrição na LANDING: contador de vagas + botão que leva à página
// dedicada de inscrição (em vez do formulário inline).
function RsvpTeaser({ block, invite, accent, guestStatus, rsvpHref }) {
  const c = block.content || {}
  const [deadlinePassed] = useState(() => Boolean(invite.rsvpDeadline) && Date.now() > Date.parse(invite.rsvpDeadline))
  const [notOpenYet] = useState(() => Boolean(invite.rsvpStartDatetime) && Date.now() < Date.parse(invite.rsvpStartDatetime))
  const mode = invite.registrationMode || 'internal'
  if (mode === 'none') return null
  if (mode === 'external') {
    return (
      <div id="inscricoes" className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-6 shadow-sm">
        <h2 className="m-0 text-xl font-bold text-foreground">Inscrição</h2>
        {c.infoText ? <p className="m-0 text-sm text-muted-foreground">{c.infoText}</p> : null}
        <a
          href={invite.registrationUrl || '#'}
          target="_blank"
          rel="noreferrer"
          className="inline-flex w-fit items-center justify-center gap-2 rounded-lg px-5 py-2.5 text-sm font-bold text-white shadow-sm transition-opacity hover:opacity-90"
          style={{ backgroundColor: accent }}
        >
          <Ticket className="h-4 w-4" aria-hidden="true" />
          {ctaText(c)}
        </a>
      </div>
    )
  }
  return (
    <div id="inscricoes" className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-6 shadow-sm">
      <h2 className="m-0 text-xl font-bold text-foreground">Inscrição</h2>
      {c.infoText ? <p className="m-0 text-sm text-muted-foreground">{c.infoText}</p> : null}
      {invite.spotsOnLanding ? <SpotsCounter invite={invite} accent={accent} /> : null}
      {guestStatus ? (
        <>
          <StatusCard status={guestStatus} />
          <a href={rsvpHref} className="inline-flex w-fit items-center gap-1.5 text-sm font-semibold hover:underline" style={{ color: accent }}>
            Ver / gerir a minha inscrição
          </a>
        </>
      ) : deadlinePassed ? (
        <p className="m-0 rounded-lg bg-muted p-3 text-sm text-muted-foreground">O prazo de inscrição terminou.</p>
      ) : notOpenYet ? (
        <p className="m-0 rounded-lg bg-muted p-3 text-sm text-muted-foreground">As inscrições ainda não abriram.</p>
      ) : (
        <a
          href={rsvpHref}
          className="inline-flex w-fit items-center justify-center gap-2 rounded-lg px-5 py-2.5 text-sm font-bold text-white shadow-sm transition-opacity hover:opacity-90"
          style={{ backgroundColor: accent }}
        >
          <Ticket className="h-4 w-4" aria-hidden="true" />
          {ctaText(c)}
        </a>
      )}
    </div>
  )
}

export default function InvitePage({ slug, view = 'landing' }) {
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

  const rsvpHref = inviteRsvpHref(slug)
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
          <BannerCard
            block={page.blocks.find((b) => b.type === 'banner' || b.type === 'cabecalho') || { content: {} }}
            page={page}
            accent={accent}
          />
          {page.invite.spotsOnRegistration ? <SpotsCounter invite={page.invite} accent={accent} /> : null}
          <RsvpCard block={rsvpBlock} page={page} accent={accent} guestStatus={guestStatus} onSubmitted={onRsvpSubmitted} />
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
            return (
              <RsvpTeaser
                key={block.id}
                block={block}
                invite={page.invite}
                accent={accent}
                guestStatus={guestStatus}
                rsvpHref={rsvpHref}
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

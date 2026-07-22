import { useState } from 'react'
import {
  Calendar, MapPin, Clock, Share2, Copy, Mail, Ticket, Info, Users, CreditCard,
  Check, ExternalLink, HelpCircle, FileText, Sparkles, Car, DoorOpen,
} from 'lucide-react'
import { fmtTime, fmtDateRange, toEmbed, buildIcs, ticketPrice, inviteRsvpHref } from './inviteUtils'

const cardCls = 'rounded-2xl border border-border bg-card p-6 shadow-sm'
const titleCls = 'mb-4 text-xl font-bold text-foreground'

// ── Cartões ──────────────────────────────────────────────────────

function BannerCard({ block, page, accent }) {
  const c = block.content || {}
  const inv = page.invite
  const image = c.imageUrl || inv.bannerUrl
  const name = c.eventName || inv.title
  const start = c.startDate || inv.startDatetime
  const end = c.endDate || inv.endDatetime
  const location = c.location || inv.location
  const dates = c.dates || fmtDateRange(start, end)
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
      {image ? (
        <img src={image} alt={name} className="aspect-[16/9] w-full object-cover" />
      ) : (
        <div className="flex aspect-[16/9] w-full items-center justify-center bg-muted text-muted-foreground">
          <Calendar className="h-12 w-12" aria-hidden="true" />
        </div>
      )}
      <div className="p-6">
        <h1 className="m-0 text-2xl font-extrabold tracking-tight text-foreground sm:text-3xl">{name}</h1>
        <div className="mt-4 flex flex-col gap-1.5 text-sm text-muted-foreground">
          {dates ? (
            <span className="inline-flex items-center gap-2">
              <Calendar className="h-4 w-4" style={{ color: accent }} aria-hidden="true" />
              {dates}
              {fmtTime(start) ? ` · ${fmtTime(start)}` : ''}
            </span>
          ) : null}
          {location ? (
            <span className="inline-flex items-center gap-2">
              <MapPin className="h-4 w-4" style={{ color: accent }} aria-hidden="true" />
              {location}
            </span>
          ) : null}
          {inv.mapUrl ? (
            <a href={inv.mapUrl} target="_blank" rel="noreferrer" className="inline-flex w-fit items-center gap-2 font-semibold hover:underline" style={{ color: accent }}>
              <ExternalLink className="h-4 w-4" aria-hidden="true" />
              Ver no Google Maps
            </a>
          ) : null}
        </div>
      </div>
    </div>
  )
}

function OverviewCard({ block }) {
  const c = block.content || {}
  if (!c.title && !c.body) return null
  return (
    <div className={cardCls}>
      <h2 className="m-0 mb-3 inline-flex items-center gap-2 text-xl font-bold text-foreground">
        <FileText className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
        {c.title || 'Sobre o evento'}
      </h2>
      {c.body ? <p className="m-0 whitespace-pre-line leading-relaxed text-foreground">{c.body}</p> : null}
    </div>
  )
}

function InfoExtraCard({ block }) {
  const c = block.content || {}
  return (
    <div className={cardCls}>
      <h2 className="m-0 mb-2 inline-flex items-center gap-2 text-lg font-bold text-foreground">
        <Info className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
        {c.title || 'Informação'}
      </h2>
      {c.body ? <p className="m-0 whitespace-pre-line text-foreground">{c.body}</p> : null}
    </div>
  )
}

// Secção "Bom saber" (Good to know): destaques + logistica (idade, portas,
// estacionamento) + informações livres. Esconde-se quando está tudo vazio.
function GoodToKnowCard({ block, accent }) {
  const c = block.content || {}
  const highlights = (c.highlights || [])
    .map((h) => (typeof h === 'string' ? h : h?.text))
    .filter(Boolean)
  const items = (c.items || []).filter((it) => it && it.label && it.value)
  const tiles = [
    c.ageInfo ? { icon: Users, label: 'Idade', value: c.ageInfo } : null,
    c.doorTime ? { icon: DoorOpen, label: 'Abertura de portas', value: c.doorTime } : null,
    c.parkingInfo ? { icon: Car, label: 'Estacionamento', value: c.parkingInfo } : null,
  ].filter(Boolean)
  if (highlights.length === 0 && tiles.length === 0 && items.length === 0) return null
  return (
    <div className={cardCls}>
      <h2 className="m-0 mb-4 inline-flex items-center gap-2 text-xl font-bold text-foreground">
        <Sparkles className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
        {c.title || 'Bom saber'}
      </h2>
      {highlights.length > 0 ? (
        <ul className="m-0 mb-4 flex list-none flex-col gap-2 p-0">
          {highlights.map((h, i) => (
            <li key={i} className="flex items-start gap-2 text-foreground">
              <Check className="mt-0.5 h-4 w-4 flex-shrink-0" style={{ color: accent }} aria-hidden="true" />
              <span>{h}</span>
            </li>
          ))}
        </ul>
      ) : null}
      {tiles.length > 0 ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {tiles.map((t, i) => {
            const Icon = t.icon
            return (
              <div key={i} className="flex flex-col gap-1 rounded-xl border border-border bg-background p-3">
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  <Icon className="h-4 w-4" aria-hidden="true" />
                  {t.label}
                </span>
                <span className="text-sm font-medium text-foreground">{t.value}</span>
              </div>
            )
          })}
        </div>
      ) : null}
      {items.length > 0 ? (
        <dl className="m-0 mt-4 flex flex-col gap-2">
          {items.map((it, i) => (
            <div key={i} className="flex flex-col border-b border-border/60 pb-2 last:border-0 sm:flex-row sm:gap-3">
              <dt className="text-sm font-semibold text-foreground sm:min-w-[160px]">{it.label}</dt>
              <dd className="m-0 text-sm text-muted-foreground">{it.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
    </div>
  )
}

function NarrativeCard({ block }) {
  const c = block.content || {}
  const embed = toEmbed(c.videoUrl)
  return (
    <div className={cardCls}>
      {c.narrative ? <p className="m-0 whitespace-pre-line text-lg leading-relaxed text-foreground">{c.narrative}</p> : null}
      {embed ? (
        <div className="mt-4 overflow-hidden rounded-xl">
          <iframe
            src={embed}
            title="Vídeo"
            className="aspect-video w-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
      ) : null}
    </div>
  )
}

function SpeakersCard({ block }) {
  const c = block.content || {}
  const speakers = (c.speakers || []).filter((s) => s.name && s.bio)
  if (speakers.length === 0) return null
  return (
    <div className={cardCls}>
      <h2 className={titleCls}>{c.title || 'Oradores e Convidados'}</h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {speakers.map((s, i) => (
          <div key={i} className="flex gap-3 rounded-xl border border-border bg-background p-3">
            {s.photoUrl ? (
              <img src={s.photoUrl} alt={s.name} className="h-16 w-16 flex-shrink-0 rounded-full object-cover" />
            ) : (
              <div className="flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-full bg-muted">
                <Users className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
              </div>
            )}
            <div className="min-w-0">
              <p className="m-0 font-bold text-foreground">{s.name}</p>
              {s.role ? <p className="m-0 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{s.role}</p> : null}
              <p className="m-0 mt-1 text-sm text-muted-foreground">{s.bio}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function AgendaCard({ block, accent }) {
  const c = block.content || {}
  // Suporta estrutura por dias (days[]) ou lista simples (items[]).
  const days = c.days || (c.items ? [{ label: null, items: c.items }] : [])
  const [active, setActive] = useState(0)
  if (days.length === 0) return null
  const day = days[active] || days[0]
  return (
    <div className={cardCls}>
      <h2 className={titleCls}>{c.title || 'Programa'}</h2>
      {days.length > 1 ? (
        <div className="mb-4 flex flex-wrap gap-2">
          {days.map((d, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setActive(i)}
              className={
                'rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors ' +
                (i === active ? 'text-white' : 'bg-muted text-muted-foreground hover:bg-accent')
              }
              style={i === active ? { backgroundColor: accent } : undefined}
            >
              {d.label || `Dia ${i + 1}`}
            </button>
          ))}
        </div>
      ) : null}
      <ul className="m-0 flex list-none flex-col gap-2 p-0">
        {(day.items || []).map((it, i) => (
          <li key={i} className="flex gap-3 border-b border-border/60 pb-2 last:border-0">
            <span className="inline-flex min-w-[64px] items-center gap-1 font-mono text-sm font-semibold" style={{ color: accent }}>
              <Clock className="h-3.5 w-3.5" aria-hidden="true" />
              {it.time && it.time.includes('T') ? fmtTime(it.time) : it.time}
            </span>
            <span className="text-foreground">
              {it.title}
              {it.owner ? <span className="text-muted-foreground"> · {it.owner}</span> : null}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function WorkshopsCard({ block }) {
  const c = block.content || {}
  const items = c.items || []
  if (items.length === 0) return null
  return (
    <div className={cardCls}>
      <h2 className={titleCls}>{c.title || 'Workshops'}</h2>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {items.map((w, i) => (
          <div key={i} className="rounded-xl border border-border bg-background p-4">
            <p className="m-0 font-bold text-foreground">{w.title}</p>
            <p className="m-0 mt-1 text-sm text-muted-foreground">{w.description}</p>
            <p className="m-0 mt-2 text-xs font-semibold text-muted-foreground">
              {w.facilitator}
              {w.day ? ` · ${w.day}` : ''}
              {w.time ? ` · ${w.time}` : ''}
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}

const COST_LABEL = { gratuito: 'Gratuito', pago: 'Pago', voluntario: 'Doação' }
const METHOD_LABEL = { mbway: 'MB WAY', transferencia: 'Transferência bancária', referencia: 'Referência Multibanco' }

function PaymentCard({ block, page, accent }) {
  const inv = page.invite
  const c = block.content || {}
  const tickets = page.tickets || []
  const costType = c.costType || inv.costType || 'gratuito'
  const amount = c.fixedAmount ?? inv.costAmount
  const currency = inv.costCurrency || 'EUR'
  const mode = inv.registrationMode || 'internal'
  // Métodos aceites: a união dos métodos de todos os bilhetes (vários por bilhete).
  const ticketMethodSet = [
    ...new Set(tickets.flatMap((t) => t.paymentMethods || (t.paymentMethod ? [t.paymentMethod] : []))),
  ]
  const methods =
    c.allowedMethods || (ticketMethodSet.length ? ticketMethodSet : inv.paymentMethod ? [inv.paymentMethod] : [])
  return (
    <div className={cardCls}>
      <h2 className="m-0 mb-3 inline-flex items-center gap-2 text-lg font-bold text-foreground">
        <CreditCard className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
        Bilhetes
      </h2>
      {tickets.length > 0 ? (
        <ul className="m-0 flex list-none flex-col gap-2 p-0">
          {tickets.map((t) => {
            const registerHref =
              t.soldOut || mode === 'none'
                ? null
                : mode === 'external'
                  ? inv.registrationUrl || null
                  : inviteRsvpHref(page.slug, t.id)
            return (
              <li key={t.id} className="flex flex-col gap-2 rounded-lg border border-border bg-background px-3 py-2">
                <div className="flex items-center justify-between gap-3">
                  <span className="flex min-w-0 flex-col">
                    <span className="text-sm font-semibold text-foreground">{t.name}</span>
                    {(t.partyType === 'family' || t.partyType === 'group' || t.kind === 'grupo') && t.groupSize ? (
                      <span className="text-xs text-muted-foreground">{t.partyType === 'family' ? 'Família' : 'Grupo'} até {t.groupSize} pessoas</span>
                    ) : null}
                    {t.description ? <span className="text-xs text-muted-foreground">{t.description}</span> : null}
                  </span>
                  <span className="whitespace-nowrap text-sm font-bold text-foreground">
                    {t.soldOut ? <span className="text-destructive">Esgotado</span> : ticketPrice(t)}
                  </span>
                </div>
                {registerHref ? (
                  <a
                    href={registerHref}
                    {...(mode === 'external' ? { target: '_blank', rel: 'noreferrer' } : {})}
                    className="inline-flex w-fit items-center gap-1.5 self-end rounded-lg px-3 py-1.5 text-xs font-bold text-white shadow-sm transition-opacity hover:opacity-90"
                    style={{ backgroundColor: accent }}
                  >
                    <Ticket className="h-3.5 w-3.5" aria-hidden="true" />
                    Inscrever-me
                  </a>
                ) : null}
              </li>
            )
          })}
        </ul>
      ) : costType === 'gratuito' ? (
        <p className="m-0 text-lg font-bold text-emerald-600 dark:text-emerald-400">Gratuito</p>
      ) : (
        <p className="m-0 text-lg font-bold text-foreground">
          {amount != null ? `${Number(amount).toFixed(2)} ${currency}` : COST_LABEL[costType]}
          {costType === 'voluntario' ? <span className="text-sm font-normal text-muted-foreground"> (sugerido)</span> : null}
        </p>
      )}
      {methods.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {methods.map((m) => (
            <span key={m} className="rounded-full bg-muted px-3 py-1 text-xs font-semibold text-muted-foreground">
              {inv.paymentMethodLabels?.[m] || METHOD_LABEL[m] || m}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  )
}

function LocationCard({ page }) {
  // Morada e link do mapa herdados da página de detalhe (Definições).
  const address = page.invite.location
  const mapUrl = page.invite.mapUrl
  if (!address && !mapUrl) return null
  const directions = mapUrl || (address ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}` : null)
  return (
    <div className={cardCls}>
      <h2 className="m-0 mb-3 inline-flex items-center gap-2 text-lg font-bold text-foreground">
        <MapPin className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
        Localização
      </h2>
      {address ? <p className="m-0 text-foreground">{address}</p> : null}
      {directions ? (
        <a href={directions} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline">
          <ExternalLink className="h-4 w-4" aria-hidden="true" />
          Ver direções
        </a>
      ) : null}
    </div>
  )
}

function FaqsCard({ block }) {
  const c = block.content || {}
  const items = (c.items || []).filter((f) => f.question && f.answer)
  if (items.length === 0) return null
  return (
    <div className={cardCls}>
      <h2 className="m-0 mb-3 inline-flex items-center gap-2 text-lg font-bold text-foreground">
        <HelpCircle className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
        {c.title || 'Perguntas frequentes'}
      </h2>
      <div className="flex flex-col gap-3">
        {items.map((f, i) => (
          <details key={i} className="rounded-lg border border-border bg-background p-3">
            <summary className="cursor-pointer font-semibold text-foreground">{f.question}</summary>
            <p className="m-0 mt-2 text-sm text-muted-foreground">{f.answer}</p>
          </details>
        ))}
      </div>
    </div>
  )
}

function ShareCard({ page, accent }) {
  const [copied, setCopied] = useState(false)
  const url = typeof window !== 'undefined' ? window.location.href.split('?')[0] : ''
  const text = `${page.invite.title} — ${url}`
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      /* ignore */
    }
  }
  const ics = buildIcs(page.invite)
  return (
    <div className={cardCls}>
      <h2 className="m-0 mb-3 inline-flex items-center gap-2 text-lg font-bold text-foreground">
        <Share2 className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
        Partilhar
      </h2>
      <div className="flex flex-wrap gap-2">
        <a
          href={`https://wa.me/?text=${encodeURIComponent(text)}`}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-accent"
        >
          WhatsApp
        </a>
        <a
          href={`mailto:?subject=${encodeURIComponent(page.invite.title)}&body=${encodeURIComponent(text)}`}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-accent"
        >
          <Mail className="h-4 w-4" aria-hidden="true" />
          Email
        </a>
        <button
          type="button"
          onClick={copy}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-accent"
        >
          {copied ? <Check className="h-4 w-4 text-emerald-600" aria-hidden="true" /> : <Copy className="h-4 w-4" aria-hidden="true" />}
          {copied ? 'Copiado' : 'Copiar link'}
        </button>
        {ics ? (
          <a
            href={ics}
            download="convite.ics"
            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
            style={{ backgroundColor: accent }}
          >
            <Calendar className="h-4 w-4" aria-hidden="true" />
            Adicionar ao calendário
          </a>
        ) : null}
      </div>
    </div>
  )
}

function FooterCard({ block }) {
  const c = block.content || {}
  return (
    <div className="mt-2 flex flex-col items-center gap-3 py-6 text-center">
      {Array.isArray(c.socialLinks) && c.socialLinks.length > 0 ? (
        <div className="flex gap-3">
          {c.socialLinks.map((s, i) => (
            <a key={i} href={s.url} target="_blank" rel="noreferrer" className="text-sm font-semibold text-muted-foreground hover:text-foreground">
              {s.platform}
            </a>
          ))}
        </div>
      ) : null}
      <p className="m-0 text-xs text-muted-foreground">
        {c.contactEmail ? <span>{c.contactEmail}</span> : null}
        {c.contactEmail && c.contactPhone ? ' · ' : ''}
        {c.contactPhone ? <span>{c.contactPhone}</span> : null}
      </p>
    </div>
  )
}

export {
  BannerCard,
  OverviewCard,
  InfoExtraCard,
  NarrativeCard,
  GoodToKnowCard,
  SpeakersCard,
  AgendaCard,
  WorkshopsCard,
  PaymentCard,
  LocationCard,
  FaqsCard,
  ShareCard,
  FooterCard,
}

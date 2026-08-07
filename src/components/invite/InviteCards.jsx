import { useEffect, useState } from 'react'
import {
  Calendar, MapPin, Clock, Share2, Copy, Mail, Ticket, Info, Users, CreditCard,
  Check, ExternalLink, HelpCircle, FileText, Sparkles, Car, DoorOpen, Globe,
  Images, Play, Link as LinkIcon, Video, List, Presentation, X, ZoomIn,
} from 'lucide-react'
import { fmtTime, fmtDateRange, toEmbed, buildIcs, ticketPrice, inviteRsvpHref } from './inviteUtils'
import { RichText } from './RichText'

const cardCls = 'rounded-2xl border border-border bg-card p-6 shadow-sm'

// ── Cartões ──────────────────────────────────────────────────────

function BannerCard({ block, page, accent, children, showInformation = false }) {
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
          {showInformation && c.information?.trim() ? (
            <span className="inline-flex items-start gap-2 text-foreground">
              <Info className="mt-0.5 h-4 w-4 flex-shrink-0" style={{ color: accent }} aria-hidden="true" />
              <span className="whitespace-pre-line">{c.information}</span>
            </span>
          ) : null}
        </div>
        {children ? <div className="mt-5 flex flex-col gap-3">{children}</div> : null}
      </div>
    </div>
  )
}

function OverviewCard({ block }) {
  const c = block.content || {}
  return (
    <div className={cardCls}>
      <h2 className="m-0 mb-3 inline-flex items-center gap-2 text-xl font-bold text-foreground">
        {c.showIcon !== false ? <FileText className="h-5 w-5 text-muted-foreground" aria-hidden="true" /> : null}
        {c.title || 'Sobre o evento'}
      </h2>
      {c.body ? (
        <RichText
          value={c.body}
          className="m-0 leading-relaxed text-foreground [&_a]:text-primary [&_a]:underline [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:m-0 [&_p]:mb-2 [&_ul]:list-disc [&_ul]:pl-5"
        />
      ) : null}
    </div>
  )
}

function InfoExtraCard({ block }) {
  const c = block.content || {}
  return (
    <div className={cardCls}>
      <h2 className="m-0 mb-2 inline-flex items-center gap-2 text-lg font-bold text-foreground">
        {c.showIcon !== false ? <Info className="h-5 w-5 text-muted-foreground" aria-hidden="true" /> : null}
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
  return (
    <div className={cardCls}>
      <h2 className="m-0 mb-4 inline-flex items-center gap-2 text-xl font-bold text-foreground">
        {c.showIcon !== false ? <Sparkles className="h-5 w-5 text-muted-foreground" aria-hidden="true" /> : null}
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
      {c.title ? (
        <h2 className="m-0 mb-4 inline-flex items-center gap-2 text-xl font-bold text-foreground">
          {c.showIcon !== false ? <Video className="h-5 w-5 text-muted-foreground" aria-hidden="true" /> : null}
          {c.title}
        </h2>
      ) : null}
      {c.narrative ? (
        <RichText
          value={c.narrative}
          className="m-0 text-lg leading-relaxed text-foreground [&_a]:text-primary [&_a]:underline [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:m-0 [&_p]:mb-2 [&_ul]:list-disc [&_ul]:pl-5"
        />
      ) : null}
      {c.guestName || c.guestBio ? (
        <div className="mt-4 rounded-xl border border-border bg-background p-4">
          {c.guestName ? <p className="m-0 font-bold text-foreground">{c.guestName}</p> : null}
          <RichText value={c.guestBio} className="m-0 mt-1 text-sm text-muted-foreground [&_a]:underline [&_p]:m-0" />
        </div>
      ) : null}
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

function MultimediaCard({ block, accent }) {
  const c = block.content || {}
  const items = (Array.isArray(c.items) ? c.items : []).filter((item) => item?.url)
  const [expandedImage, setExpandedImage] = useState(null)
  useEffect(() => {
    if (!expandedImage) return undefined
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') setExpandedImage(null)
    }
    document.addEventListener('keydown', closeOnEscape)
    return () => document.removeEventListener('keydown', closeOnEscape)
  }, [expandedImage])
  return (
    <div className={cardCls}>
      <h2 className="m-0 mb-4 inline-flex items-center gap-2 text-xl font-bold text-foreground">
        {c.showIcon !== false ? <Images className="h-5 w-5 text-muted-foreground" aria-hidden="true" /> : null}
        {c.title || 'Multimédia'}
      </h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {items.map((item, index) => {
          const embed = item.type === 'youtube' ? toEmbed(item.url) : null
          if (embed) {
            return (
              <div key={index} className="overflow-hidden rounded-xl border border-border bg-background sm:col-span-2">
                <iframe src={embed} title={item.title || `Vídeo ${index + 1}`} className="aspect-video w-full" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />
                {item.title || item.caption ? <div className="p-3"><MediaText item={item} /></div> : null}
              </div>
            )
          }
          if (item.type === 'image') {
            return (
              <figure key={index} className="m-0 overflow-hidden rounded-xl border border-border bg-background">
                <button type="button" className="group relative block w-full cursor-zoom-in" onClick={() => setExpandedImage(item)} aria-label={`Ampliar ${item.title || 'imagem'}`}>
                  <img src={item.url} alt={item.title || item.caption || ''} className="aspect-[4/3] w-full object-cover" loading="lazy" />
                  <span className="absolute bottom-2 right-2 flex h-8 w-8 items-center justify-center rounded-full bg-black/65 text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
                    <ZoomIn className="h-4 w-4" aria-hidden="true" />
                  </span>
                </button>
                {item.title || item.caption ? <figcaption className="p-3"><MediaText item={item} /></figcaption> : null}
              </figure>
            )
          }
          if (item.type === 'video') {
            return (
              <figure key={index} className="m-0 overflow-hidden rounded-xl border border-border bg-background sm:col-span-2">
                <video src={item.url} className="aspect-video w-full bg-black object-contain" controls preload="metadata" playsInline />
                {item.title || item.caption ? <figcaption className="p-3"><MediaText item={item} /></figcaption> : null}
              </figure>
            )
          }
          return (
            <a key={index} href={item.url} target="_blank" rel="noreferrer" className="flex min-h-24 items-center gap-3 rounded-xl border border-border bg-background p-4 transition-colors hover:bg-accent">
              {item.type === 'instagram' ? <Images className="h-6 w-6 flex-shrink-0" style={{ color: accent }} aria-hidden="true" /> : item.type === 'youtube' ? <Play className="h-6 w-6 flex-shrink-0" style={{ color: accent }} aria-hidden="true" /> : <LinkIcon className="h-6 w-6 flex-shrink-0" style={{ color: accent }} aria-hidden="true" />}
              <span className="min-w-0 flex-1"><MediaText item={item} fallback={item.type === 'instagram' ? 'Ver no Instagram' : item.type === 'youtube' ? 'Ver no YouTube' : 'Abrir link'} /></span>
              <ExternalLink className="h-4 w-4 flex-shrink-0 text-muted-foreground" aria-hidden="true" />
            </a>
          )
        })}
      </div>
      {expandedImage ? (
        <div className="fixed inset-0 z-[500] flex items-center justify-center bg-black/90 p-4" role="dialog" aria-modal="true" aria-label={expandedImage.title || 'Imagem ampliada'} onClick={() => setExpandedImage(null)}>
          <button type="button" className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/15 text-white hover:bg-white/25" onClick={() => setExpandedImage(null)} aria-label="Fechar imagem ampliada">
            <X className="h-6 w-6" aria-hidden="true" />
          </button>
          <img src={expandedImage.url} alt={expandedImage.title || expandedImage.caption || ''} className="max-h-[90vh] max-w-[95vw] object-contain" onClick={(event) => event.stopPropagation()} />
        </div>
      ) : null}
    </div>
  )
}

function MediaText({ item, fallback = '' }) {
  return (
    <>
      <span className="block font-semibold text-foreground">{item.title || fallback}</span>
      {item.caption ? <span className="mt-1 block whitespace-pre-line text-sm text-muted-foreground">{item.caption}</span> : null}
    </>
  )
}

function SpeakersCard({ block }) {
  const c = block.content || {}
  const speakers = (c.speakers || []).filter((s) => s.name && s.bio)
  return (
    <div className={cardCls}>
      <h2 className="mb-4 inline-flex items-center gap-2 text-xl font-bold text-foreground">
        {c.showIcon !== false ? <Users className="h-5 w-5 text-muted-foreground" aria-hidden="true" /> : null}
        {c.title || 'Oradores e Convidados'}
      </h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {speakers.map((s, i) => (
          <div key={i} className="flex gap-3 rounded-xl border border-border bg-background p-3">
            {s.photoUrl ? (
              <img src={s.photoUrl} alt={s.name} className="h-20 w-20 flex-shrink-0 rounded-full object-cover" />
            ) : (
              <div className="flex h-20 w-20 flex-shrink-0 items-center justify-center rounded-full bg-muted">
                <Users className="h-8 w-8 text-muted-foreground" aria-hidden="true" />
              </div>
            )}
            <div className="min-w-0">
              <p className="m-0 font-bold text-foreground">{s.name}</p>
              {s.role ? <p className="m-0 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{s.role}</p> : null}
              <RichText value={s.bio} className="m-0 mt-1 text-sm text-muted-foreground [&_a]:underline [&_p]:m-0" />
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
  const day = days[active] || days[0] || { items: [] }
  return (
    <div className={cardCls}>
      <h2 className="mb-4 inline-flex items-center gap-2 text-xl font-bold text-foreground">
        {c.showIcon !== false ? <List className="h-5 w-5 text-muted-foreground" aria-hidden="true" /> : null}
        {c.title || 'Programa'}
      </h2>
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
      <ul className="m-0 flex list-none flex-col p-0">
        {(day.items || []).map((it, i) => (
          <li key={i} className="relative flex min-h-14 gap-4 border-l border-border/80 pb-4 pl-5 last:border-transparent last:pb-0">
            <span
              className="absolute -left-1.5 top-2 h-3 w-3 rounded-full border-2 border-background"
              style={{ backgroundColor: accent }}
              aria-hidden="true"
            />
            <time
              className="mt-0.5 inline-flex h-8 min-w-[72px] shrink-0 items-center justify-center gap-1.5 rounded-md px-2.5 text-sm font-bold tabular-nums"
              style={{ color: accent, backgroundColor: `color-mix(in srgb, ${accent} 12%, transparent)` }}
            >
              <Clock className="h-3.5 w-3.5" strokeWidth={2.25} aria-hidden="true" />
              {it.time && it.time.includes('T') ? fmtTime(it.time) : it.time}
            </time>
            <span className="pt-1.5 text-foreground">
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
  return (
    <div className={cardCls}>
      <h2 className="mb-4 inline-flex items-center gap-2 text-xl font-bold text-foreground">
        {c.showIcon !== false ? <Presentation className="h-5 w-5 text-muted-foreground" aria-hidden="true" /> : null}
        {c.title || 'Workshops'}
      </h2>
      {c.information ? (
        <div className="mb-4 flex items-start gap-2 rounded-lg border border-border bg-muted/40 p-3 text-sm text-foreground">
          <Info className="mt-0.5 h-4 w-4 flex-shrink-0 text-muted-foreground" aria-hidden="true" />
          <p className="m-0 whitespace-pre-line">{c.information}</p>
        </div>
      ) : null}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {items.map((w, i) => (
          <div key={i} className="rounded-xl border border-border bg-background p-4">
            <p className="m-0 font-bold text-foreground">{w.title}</p>
            <RichText value={w.description} className="m-0 mt-1 text-sm text-muted-foreground [&_a]:underline [&_p]:m-0" />
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
        {c.showIcon !== false ? <CreditCard className="h-5 w-5 text-muted-foreground" aria-hidden="true" /> : null}
        Bilhetes
      </h2>
      {c.information ? (
        <div className="mb-4 flex items-start gap-2 rounded-lg border border-border bg-muted/40 p-3 text-sm text-foreground">
          <Info className="mt-0.5 h-4 w-4 flex-shrink-0 text-muted-foreground" aria-hidden="true" />
          <p className="m-0 whitespace-pre-line">{c.information}</p>
        </div>
      ) : null}
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
                      <span className="text-xs text-muted-foreground">Grupo até {t.groupSize} pessoas</span>
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

function LocationCard({ block, page }) {
  const c = block.content || {}
  // Morada e link do mapa herdados da página de detalhe (Definições).
  const address = page.invite.location
  const mapUrl = page.invite.mapUrl
  const directions = mapUrl || (address ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}` : null)
  return (
    <div className={cardCls}>
      <h2 className="m-0 mb-3 inline-flex items-center gap-2 text-lg font-bold text-foreground">
        {c.showIcon !== false ? <MapPin className="h-5 w-5 text-muted-foreground" aria-hidden="true" /> : null}
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
  return (
    <div className={cardCls}>
      <h2 className="m-0 mb-3 inline-flex items-center gap-2 text-lg font-bold text-foreground">
        {c.showIcon !== false ? <HelpCircle className="h-5 w-5 text-muted-foreground" aria-hidden="true" /> : null}
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

function ShareCard({ block, page, accent }) {
  const c = block.content || {}
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
        {c.showIcon !== false ? <Share2 className="h-5 w-5 text-muted-foreground" aria-hidden="true" /> : null}
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

// Ícones das redes sociais. As marcas (Facebook/Instagram/YouTube) já não vêm no
// lucide-react, por isso são SVG embutido (herdam a cor via currentColor).
const IconFacebook = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M22 12c0-5.523-4.477-10-10-10S2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.878v-6.987H7.898V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.988C18.343 21.128 22 16.991 22 12z" />
  </svg>
)
const IconInstagram = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="2" y="2" width="20" height="20" rx="5" />
    <circle cx="12" cy="12" r="4" />
    <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
  </svg>
)
const IconYoutube = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M23.5 6.2a3 3 0 0 0-2.11-2.12C19.5 3.55 12 3.55 12 3.55s-7.5 0-9.39.53A3 3 0 0 0 .5 6.2 31.4 31.4 0 0 0 0 12a31.4 31.4 0 0 0 .5 5.8 3 3 0 0 0 2.11 2.12c1.89.53 9.39.53 9.39.53s7.5 0 9.39-.53a3 3 0 0 0 2.11-2.12A31.4 31.4 0 0 0 24 12a31.4 31.4 0 0 0-.5-5.8ZM9.6 15.6V8.4l6.2 3.6-6.2 3.6Z" />
  </svg>
)

const SOCIAL_ICON = { facebook: IconFacebook, instagram: IconInstagram, youtube: IconYoutube, website: Globe }
const SOCIAL_LABEL = { facebook: 'Facebook', instagram: 'Instagram', youtube: 'YouTube', website: 'Website' }

function FooterCard({ block, page }) {
  const c = block.content || {}
  const links = (Array.isArray(c.socialLinks) ? c.socialLinks : []).filter((s) => s && s.url && String(s.url).trim())
  const hasContent = c.logoUrl || links.length > 0 || c.contactEmail || c.contactPhone
  // Rodapé vazio → linha de marca discreta (usa as datas do convite).
  if (!hasContent) {
    return (
      <p className="mt-2 text-center text-xs text-muted-foreground">
        {fmtDateRange(page?.invite?.startDatetime, page?.invite?.endDatetime)} · Feito com a Agenda CCLX
      </p>
    )
  }
  return (
    <div className="mt-2 flex flex-col items-center gap-3 py-6 text-center">
      {c.logoUrl ? <img src={c.logoUrl} alt="CCLX" className="h-12 w-auto object-contain" /> : null}
      {links.length > 0 ? (
        <div className="flex items-center gap-3">
          {links.map((s, i) => {
            const key = String(s.platform || '').toLowerCase()
            const Icon = SOCIAL_ICON[key] || Globe
            return (
              <a
                key={i}
                href={s.url}
                target="_blank"
                rel="noreferrer"
                aria-label={SOCIAL_LABEL[key] || s.platform || 'Ligação'}
                title={SOCIAL_LABEL[key] || s.platform}
                className="text-muted-foreground transition-colors hover:text-foreground"
              >
                <Icon className="h-5 w-5" aria-hidden="true" />
              </a>
            )
          })}
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
  MultimediaCard,
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

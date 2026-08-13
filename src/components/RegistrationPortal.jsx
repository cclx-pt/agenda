import { useEffect, useState } from 'react'
import {
  ArrowUpRight,
  CalendarDays,
  Camera,
  CirclePlay,
  Globe,
  Link as LinkIcon,
  MapPin,
  MessageCircle,
} from 'lucide-react'
import { fetchEvents } from '../services/apiService'
import { getRegistrationPortalLinks } from '../services/eventsService'
import { classifyPortalEntries, eventDestination, selectRegistrationEvents } from '../utils/registrationPortal'
import defaultLogoUrl from '../assets/cclx_line_logo.png'

const defaultHeader = {
  logoUrl: '',
  title: 'Inscrições e ligações',
  description: 'Encontra aqui as inscrições abertas e os canais oficiais da comunidade.',
}

const platformIcons = {
  youtube: CirclePlay,
  instagram: Camera,
  facebook: MessageCircle,
  website: Globe,
  other: LinkIcon,
}

const dateFormatter = new Intl.DateTimeFormat('pt-PT', {
  weekday: 'short',
  day: 'numeric',
  month: 'long',
})

function formatEventDate(event) {
  const value = event.startDatetime || (event.date ? `${event.date}T12:00:00` : null)
  if (!value) return ''
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '' : dateFormatter.format(date)
}

export default function RegistrationPortal() {
  const [data, setData] = useState({ header: defaultHeader, links: [], events: [] })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    Promise.all([getRegistrationPortalLinks(), fetchEvents()])
      .then(([portal, events]) => {
        if (!active) return
        setData({
          header: portal.header || defaultHeader,
          links: portal.links || [],
          events: selectRegistrationEvents(events),
        })
      })
      .catch(() => {
        if (active) setError('Não foi possível carregar as inscrições neste momento.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [])

  const configured = classifyPortalEntries(data.links)
  const hasRegistrations = data.events.length > 0 || configured.registrations.length > 0

  return (
    <main className="min-h-screen bg-white text-[#17191c]">
      <div className="mx-auto flex min-h-screen w-full max-w-[680px] flex-col px-4 pb-12 pt-10 sm:px-6 sm:pt-14">
        <header className="mb-8 flex flex-col items-center text-center">
          <div className="mb-4 flex h-24 w-24 items-center justify-center rounded-full bg-black p-5 ring-2 ring-[#d9dce1] ring-offset-4 ring-offset-white">
            <img src={data.header.logoUrl || defaultLogoUrl} alt="CCLX" className="h-auto w-full object-contain" />
          </div>
          <p className="text-xs font-bold uppercase text-[#6b7078]">CCLX</p>
          <h1 className="mt-2 text-3xl font-extrabold sm:text-4xl">{data.header.title}</h1>
          <p className="mt-3 max-w-md text-sm leading-6 text-[#5d626a]">
            {data.header.description}
          </p>
        </header>

        {loading ? (
          <div className="flex flex-col gap-3" aria-label="A carregar inscrições">
            {[0, 1, 2].map((item) => (
              <div key={item} className="h-[66px] animate-pulse rounded-full border border-[#e0e2e5] bg-[#f1f2f4]" />
            ))}
          </div>
        ) : error ? (
          <p className="rounded-2xl border border-red-200 bg-red-50 p-4 text-center text-sm text-red-700">{error}</p>
        ) : (
          <div className="flex flex-col gap-8">
            {hasRegistrations && (
              <section aria-labelledby="portal-events-title">
                <h2 id="portal-events-title" className="mb-3 text-center text-xs font-bold uppercase text-[#6b7078]">
                  Próximas inscrições
                </h2>
                <div className="flex flex-col gap-4">
                  {data.events.map((event) => (
                    <a
                      key={event.id}
                      href={eventDestination(event)}
                      target="_blank"
                      rel="noreferrer"
                      className="group grid min-h-[76px] grid-cols-[58px_1fr_auto] items-center gap-3 rounded-[38px] border border-[#dfe1e5] bg-[#f1f2f4] p-2 pr-5 transition-[transform,background-color] duration-200 hover:-translate-y-0.5 hover:bg-[#e8eaed] focus:outline-none focus:ring-2 focus:ring-black focus:ring-offset-2 focus:ring-offset-white"
                    >
                      {event.imageUrl ? (
                        <img src={event.imageUrl} alt="" className="h-[58px] w-[58px] rounded-full object-cover" />
                      ) : (
                        <span className="flex h-[58px] w-[58px] items-center justify-center rounded-full bg-white text-[#34383e]">
                          <CalendarDays size={24} aria-hidden="true" />
                        </span>
                      )}
                      <span className="min-w-0">
                        <strong className="block text-sm leading-5 sm:text-base">{event.title}</strong>
                        <span className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-[#666b73] sm:text-xs">
                          <span className="inline-flex items-center gap-1"><CalendarDays size={13} />{formatEventDate(event)}</span>
                          {event.location && <span className="inline-flex items-center gap-1"><MapPin size={13} />{event.location}</span>}
                        </span>
                      </span>
                      <ArrowUpRight size={18} className="text-[#555a62] transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" aria-hidden="true" />
                    </a>
                  ))}
                  {configured.registrations.map((entry, index) => {
                    const PlatformIcon = platformIcons[entry.platform] || LinkIcon
                    return (
                      <PortalEntry
                        key={`${entry.url}-${index}`}
                        entry={entry}
                        icon={PlatformIcon}
                      />
                    )
                  })}
                </div>
              </section>
            )}

            {configured.links.length > 0 && (
              <section aria-labelledby="portal-links-title">
                <h2 id="portal-links-title" className="mb-3 text-center text-xs font-bold uppercase text-[#6b7078]">
                  Ligações CCLX
                </h2>
                <div className="flex flex-col gap-4">
                  {configured.links.map((link, index) => {
                    const PlatformIcon = platformIcons[link.platform] || LinkIcon
                    return <PortalEntry key={`${link.url}-${index}`} entry={link} icon={PlatformIcon} />
                  })}
                </div>
              </section>
            )}

            {!hasRegistrations && configured.links.length === 0 && (
              <p className="rounded-2xl border border-[#dfe1e5] bg-[#f1f2f4] p-6 text-center text-sm text-[#666b73]">
                Não existem inscrições ou ligações disponíveis neste momento.
              </p>
            )}
          </div>
        )}

        <footer className="mt-auto pt-12 text-center text-xs text-[#7a7f87]">Comunidade Cristã de Lisboa</footer>
      </div>
    </main>
  )
}

function PortalEntry({ entry, icon: PlatformIcon }) {
  return (
    <a
      href={entry.url}
      target="_blank"
      rel="noreferrer"
      className="group grid min-h-[66px] grid-cols-[50px_1fr_auto] items-center gap-3 rounded-[33px] border border-[#dfe1e5] bg-[#f1f2f4] p-[7px] pr-5 transition-[transform,background-color] duration-200 hover:-translate-y-0.5 hover:bg-[#e8eaed] focus:outline-none focus:ring-2 focus:ring-black focus:ring-offset-2 focus:ring-offset-white"
    >
      <span className="flex h-[50px] w-[50px] items-center justify-center overflow-hidden rounded-full bg-white text-[#34383e]">
        {entry.imageUrl ? (
          <img src={entry.imageUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <PlatformIcon size={22} aria-hidden="true" />
        )}
      </span>
      <span className="min-w-0">
        <strong className="block text-sm leading-5">{entry.title}</strong>
        {entry.description && <span className="mt-0.5 block text-xs text-[#666b73]">{entry.description}</span>}
      </span>
      <ArrowUpRight size={18} className="text-[#555a62] transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" aria-hidden="true" />
    </a>
  )
}
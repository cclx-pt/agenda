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
import { useI18n } from '../hooks/useI18n'
import { fetchEvents } from '../services/apiService'
import { getRegistrationPortalLinks } from '../services/eventsService'
import { eventDestination, selectRegistrationEvents } from '../utils/registrationPortal'
import defaultLogoUrl from '../assets/cclx_line_logo.png'

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
  const { logoUrl } = useI18n()
  const [data, setData] = useState({ links: [], events: [] })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    Promise.all([getRegistrationPortalLinks(), fetchEvents()])
      .then(([links, events]) => {
        if (!active) return
        setData({
          links,
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

  return (
    <main className="min-h-screen bg-[#f4f4f4] text-[#131313]">
      <div className="fixed inset-x-0 top-0 h-1 bg-[#f1ad00]" aria-hidden="true" />
      <div className="mx-auto flex min-h-screen w-full max-w-[680px] flex-col px-5 pb-16 pt-12 sm:px-8 sm:pt-16">
        <header className="mb-10 flex flex-col items-center text-center">
          <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-black p-4 shadow-[0_10px_30px_rgba(0,0,0,0.16)]">
            <img src={logoUrl || defaultLogoUrl} alt="CCLX" className="h-auto w-full object-contain" />
          </div>
          <p className="mb-2 text-xs font-bold uppercase text-[#9a6f00]">CCLX</p>
          <h1 className="text-3xl font-extrabold sm:text-4xl">Inscrições e ligações</h1>
          <p className="mt-3 max-w-md text-sm leading-6 text-[#636363]">
            Encontra aqui as inscrições abertas e os canais oficiais da comunidade.
          </p>
        </header>

        {loading ? (
          <div className="flex flex-col gap-3" aria-label="A carregar inscrições">
            {[0, 1, 2].map((item) => (
              <div key={item} className="h-20 animate-pulse rounded-lg bg-white/70" />
            ))}
          </div>
        ) : error ? (
          <p className="rounded-lg border border-red-200 bg-white p-4 text-center text-sm text-red-700">{error}</p>
        ) : (
          <div className="flex flex-col gap-9">
            {data.events.length > 0 && (
              <section aria-labelledby="portal-events-title">
                <h2 id="portal-events-title" className="mb-3 text-xs font-bold uppercase text-[#636363]">
                  Próximas inscrições
                </h2>
                <div className="flex flex-col gap-3">
                  {data.events.map((event) => (
                    <a
                      key={event.id}
                      href={eventDestination(event)}
                      target="_blank"
                      rel="noreferrer"
                      className="group grid min-h-24 grid-cols-[72px_1fr_auto] items-center gap-4 rounded-lg border border-[#dcdcdc] bg-white p-3 shadow-[0_4px_18px_rgba(0,0,0,0.06)] transition-transform hover:-translate-y-0.5 hover:border-[#f1ad00] focus:outline-none focus:ring-2 focus:ring-[#f1ad00]"
                    >
                      {event.imageUrl ? (
                        <img src={event.imageUrl} alt="" className="h-[72px] w-[72px] rounded-md object-cover" />
                      ) : (
                        <span className="flex h-[72px] w-[72px] items-center justify-center rounded-md bg-[#1b1c1d] text-[#f1ad00]">
                          <CalendarDays size={28} aria-hidden="true" />
                        </span>
                      )}
                      <span className="min-w-0">
                        <strong className="block text-base leading-5">{event.title}</strong>
                        <span className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-[#636363]">
                          <span className="inline-flex items-center gap-1"><CalendarDays size={13} />{formatEventDate(event)}</span>
                          {event.location && <span className="inline-flex items-center gap-1"><MapPin size={13} />{event.location}</span>}
                        </span>
                      </span>
                      <ArrowUpRight size={20} className="text-[#9a6f00] transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" aria-hidden="true" />
                    </a>
                  ))}
                </div>
              </section>
            )}

            {data.links.length > 0 && (
              <section aria-labelledby="portal-links-title">
                <h2 id="portal-links-title" className="mb-3 text-xs font-bold uppercase text-[#636363]">
                  Ligações CCLX
                </h2>
                <div className="flex flex-col gap-3">
                  {data.links.map((link, index) => {
                    const PlatformIcon = platformIcons[link.platform] || LinkIcon
                    return (
                      <a
                        key={`${link.url}-${index}`}
                        href={link.url}
                        target="_blank"
                        rel="noreferrer"
                        className="group grid min-h-20 grid-cols-[44px_1fr_auto] items-center gap-3 rounded-lg border border-[#dcdcdc] bg-white px-4 py-3 shadow-[0_4px_18px_rgba(0,0,0,0.06)] transition-transform hover:-translate-y-0.5 hover:border-[#f1ad00] focus:outline-none focus:ring-2 focus:ring-[#f1ad00]"
                      >
                        <span className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-md bg-[#1b1c1d] text-[#f1ad00]">
                          {link.imageUrl ? (
                            <img src={link.imageUrl} alt="" className="h-full w-full object-cover" />
                          ) : (
                            <PlatformIcon size={22} aria-hidden="true" />
                          )}
                        </span>
                        <span className="min-w-0">
                          <strong className="block text-sm">{link.title}</strong>
                          {link.description && <span className="mt-0.5 block text-xs text-[#636363]">{link.description}</span>}
                        </span>
                        <ArrowUpRight size={20} className="text-[#9a6f00] transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" aria-hidden="true" />
                      </a>
                    )
                  })}
                </div>
              </section>
            )}

            {data.events.length === 0 && data.links.length === 0 && (
              <p className="rounded-lg border border-[#dcdcdc] bg-white p-6 text-center text-sm text-[#636363]">
                Não existem inscrições ou ligações disponíveis neste momento.
              </p>
            )}
          </div>
        )}

        <footer className="mt-auto pt-14 text-center text-xs text-[#636363]">Comunidade Cristã de Lisboa</footer>
      </div>
    </main>
  )
}
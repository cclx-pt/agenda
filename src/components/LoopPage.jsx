import { useEffect, useState, useCallback } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { CalendarDays, Church, Clock, MapPin, Ticket, UserCheck } from 'lucide-react'
import { getLoop } from '../services/apiService'
import { formatDateLabel, formatTimeRange } from '../utils/calendarHelpers'
import { useEventColors } from '../hooks/useEventColors'

const BASE_MS = 15000 // duração base por cartaz
const FEATURED_MS = 30000 // eventos em destaque ficam mais tempo
const REFETCH_MS = 5 * 60 * 1000 // recarrega os eventos a cada 5 min

/**
 * LoopPage — página pública (para TV) que passa em carrossel, permanentemente,
 * os cartazes/cards dos eventos marcados para o Loop de uma igreja. Eventos em
 * destaque ficam mais tempo. Recarrega periodicamente para apanhar novidades.
 */
export default function LoopPage({ church }) {
  const [state, setState] = useState({ loading: true, active: false, events: [], error: null, format: '16:9' })
  const [index, setIndex] = useState(0)
  const { colorFor, subColorMap } = useEventColors()

  const load = useCallback(async () => {
    try {
      const data = await getLoop(church)
      setState({ loading: false, active: data.active, events: data.events, error: null, format: data.format })
    } catch (err) {
      setState((s) => ({ ...s, loading: false, error: err.message }))
    }
  }, [church])

  useEffect(() => {
    load()
    const t = setInterval(load, REFETCH_MS)
    return () => clearInterval(t)
  }, [load])

  const events = state.events
  const count = events.length

  // Avança conforme a duração do cartaz atual (destaque = mais tempo).
  useEffect(() => {
    if (count === 0) return
    const current = events[index % count]
    const dur = current?.featured ? FEATURED_MS : BASE_MS
    const t = setTimeout(() => setIndex((i) => (i + 1) % count), dur)
    return () => clearTimeout(t)
  }, [index, count, events])

  const wrap = (children) => (
    <div className="flex h-screen w-screen flex-col items-center justify-center gap-4 bg-neutral-950 text-neutral-400">
      {children}
    </div>
  )

  if (state.loading) return wrap(<span className="text-2xl">A carregar…</span>)
  if (state.error) return wrap(<span className="text-2xl">{state.error}</span>)
  if (!state.active)
    return wrap(
      <>
        <Church className="h-14 w-14" aria-hidden="true" />
        <span className="text-2xl">O Loop não está ativo para “{church}”.</span>
      </>
    )
  if (count === 0)
    return wrap(
      <>
        <CalendarDays className="h-14 w-14" aria-hidden="true" />
        <span className="text-2xl">Sem eventos para mostrar em “{church}”.</span>
      </>
    )

  const evt = events[index % count]
  const vis = colorFor(evt)
  const subColor = evt.subcategory ? subColorMap[evt.subcategory] : null
  // Formato do ecrã da TV (definido na configuração do Loop da igreja): escolhe
  // o cartaz dedicado desse formato, com recurso ao outro formato se faltar.
  const isWide = state.format === '32:9'
  const loopPoster = isWide
    ? evt.loopImage32x9 || evt.loopImage16x9
    : evt.loopImage16x9 || evt.loopImage32x9
  const contactStr =
    [evt.organizerPhone, evt.organizerEmail].filter(Boolean).join(' · ') || evt.organizerContact || ''
  const durSec = (evt.featured ? FEATURED_MS : BASE_MS) / 1000

  return (
    <div className="relative flex h-screen w-screen overflow-hidden bg-neutral-950 text-white">
      <AnimatePresence mode="wait">
        <motion.div
          key={evt.id}
          className="flex h-full w-full items-stretch max-[820px]:flex-col"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.6 }}
        >
          {loopPoster ? (
            // Cartaz dedicado ao formato do ecrã, em ecrã inteiro.
            <div className="flex h-full w-full items-center justify-center bg-black">
              <img
                src={loopPoster}
                alt={evt.title}
                className="h-full w-full object-contain"
              />
            </div>
          ) : (
            <>
          {/* Cartaz / imagem */}
          {evt.imageUrl ? (
            <div className="flex h-full w-3/5 items-center justify-center bg-black p-6 max-[820px]:h-3/5 max-[820px]:w-full">
              <img
                src={evt.imageUrl}
                alt={evt.title}
                className="max-h-full max-w-full rounded-xl object-contain shadow-2xl"
              />
            </div>
          ) : (
            <div className="flex h-full w-3/5 items-center justify-center bg-neutral-900 max-[820px]:h-2/5 max-[820px]:w-full">
              <CalendarDays className="h-28 w-28 text-neutral-700" aria-hidden="true" />
            </div>
          )}

          {/* Conteúdo do card */}
          <div className="flex h-full w-2/5 flex-col justify-center gap-7 p-12 max-[820px]:w-full max-[820px]:gap-4 max-[820px]:p-8">
            <div className="flex flex-wrap items-center gap-2.5">
              {evt.featured && (
                <span className="rounded-md bg-amber-400 px-3 py-1 text-lg font-extrabold uppercase tracking-wide text-neutral-900">
                  ★ Destaque
                </span>
              )}
              <span className="inline-flex items-center gap-2 rounded-md bg-white/10 px-3 py-1 text-lg font-bold uppercase tracking-wide">
                <Church className="h-4 w-4" aria-hidden="true" />
                {evt.community}
              </span>
              <span
                className="rounded-md px-3 py-1 text-lg font-bold uppercase tracking-wide"
                style={{ background: vis.catBg, color: vis.catText }}
              >
                {vis.catLabel}
              </span>
              {evt.subcategory && (
                <span
                  className="rounded-md px-3 py-1 text-lg font-bold uppercase tracking-wide text-neutral-900"
                  style={subColor ? { background: subColor } : { background: '#e5e7eb' }}
                >
                  {evt.subcategory}
                </span>
              )}
            </div>

            <h1 className="text-5xl font-extrabold uppercase leading-[1.1] max-[1200px]:text-4xl max-[820px]:text-3xl">
              {evt.title}
            </h1>

            <div className="flex flex-col gap-5 text-2xl max-[1200px]:text-xl max-[820px]:gap-3 max-[820px]:text-lg">
              <div className="flex items-center gap-4">
                <CalendarDays className="h-8 w-8 flex-shrink-0 text-amber-400" aria-hidden="true" />
                <span className="capitalize">{formatDateLabel(evt.date)}</span>
              </div>
              <div className="flex items-center gap-4">
                <Clock className="h-8 w-8 flex-shrink-0 text-amber-400" aria-hidden="true" />
                <span>{formatTimeRange(evt.timeStart, evt.timeEnd) || 'Dia inteiro'}</span>
              </div>
              {evt.location && (
                <div className="flex items-center gap-4">
                  <MapPin className="h-8 w-8 flex-shrink-0 text-amber-400" aria-hidden="true" />
                  <span>{evt.location}</span>
                </div>
              )}
              {(evt.organizerName || contactStr) && (
                <div className="flex items-center gap-4">
                  <UserCheck className="h-8 w-8 flex-shrink-0 text-amber-400" aria-hidden="true" />
                  <span>
                    {evt.organizerName}
                    {contactStr ? (evt.organizerName ? ` (${contactStr})` : contactStr) : ''}
                  </span>
                </div>
              )}
              {evt.registrationUrl && (
                <div className="flex items-center gap-4">
                  <Ticket className="h-8 w-8 flex-shrink-0 text-amber-400" aria-hidden="true" />
                  <span>Inscrições abertas</span>
                </div>
              )}
            </div>
          </div>
            </>
          )}
        </motion.div>
      </AnimatePresence>

      {/* Barra de progresso até ao próximo cartaz */}
      <div className="absolute inset-x-0 bottom-0 h-1.5 bg-white/10">
        <motion.div
          key={`${evt.id}-bar`}
          className="h-full bg-amber-400"
          initial={{ width: '0%' }}
          animate={{ width: '100%' }}
          transition={{ duration: durSec, ease: 'linear' }}
        />
      </div>

      <div className="absolute right-5 top-5 rounded-full bg-black/50 px-4 py-1.5 text-base font-semibold text-white/70">
        {church} · {(index % count) + 1}/{count}
      </div>
    </div>
  )
}

import { useEffect, useState, useCallback } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { CalendarDays, Church } from 'lucide-react'
import { getLoop } from '../services/apiService'

const REFETCH_MS = 5 * 60 * 1000 // recarrega os eventos a cada 5 min

/**
 * LoopPage — página pública (para TV) que passa em carrossel, permanentemente,
 * os cartazes/cards dos eventos marcados para o Loop de uma igreja. Eventos em
 * destaque ficam mais tempo. Recarrega periodicamente para apanhar novidades.
 */
export default function LoopPage({ church }) {
  const [state, setState] = useState({ loading: true, active: false, events: [], error: null, format: '16:9', secondsPerSlide: 15, secondsPerSlideFeatured: 30 })
  const [index, setIndex] = useState(0)

  const load = useCallback(async () => {
    try {
      const data = await getLoop(church)
      setState({ loading: false, active: data.active, events: data.events, error: null, format: data.format, secondsPerSlide: data.secondsPerSlide, secondsPerSlideFeatured: data.secondsPerSlideFeatured })
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

  // Avança conforme a duração do slide atual (configurável por igreja; destaque
  // fica mais tempo).
  useEffect(() => {
    if (count === 0) return
    const current = events[index % count]
    const secs = current?.featured ? state.secondsPerSlideFeatured : state.secondsPerSlide
    const t = setTimeout(() => setIndex((i) => (i + 1) % count), (secs || 15) * 1000)
    return () => clearTimeout(t)
  }, [index, count, events, state.secondsPerSlide, state.secondsPerSlideFeatured])

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
  // Formato do ecrã da TV (definido na configuração do Loop + CCLX da igreja):
  // escolhe o cartaz dedicado desse formato, com recurso ao outro se faltar.
  const isWide = state.format === '32:9'
  const loopPoster = isWide
    ? evt.loopImage32x9 || evt.loopImage16x9
    : evt.loopImage16x9 || evt.loopImage32x9
  // Só a imagem: o cartaz dedicado ao Loop + CCLX, ou a imagem do próprio evento.
  const image = loopPoster || evt.imageUrl
  const durSec = (evt.featured ? state.secondsPerSlideFeatured : state.secondsPerSlide) || 15

  return (
    <div className="relative flex h-screen w-screen overflow-hidden bg-neutral-950 text-white">
      <AnimatePresence mode="wait">
        <motion.div
          key={evt.id}
          className="flex h-full w-full items-center justify-center bg-black"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.6 }}
        >
          {image ? (
            <img
              src={image}
              alt={evt.title}
              className="h-full w-full object-contain"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-neutral-900">
              <CalendarDays className="h-28 w-28 text-neutral-700" aria-hidden="true" />
            </div>
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
    </div>
  )
}

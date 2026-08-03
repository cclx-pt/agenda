import { useEffect, useState, useCallback, useMemo } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { CalendarDays, Church } from 'lucide-react'
import { getLoop } from '../services/apiService'

const REFETCH_MS = 5 * 60 * 1000 // recarrega os eventos a cada 5 min
const INTRO_VIDEO = '/vinheta-cclx.mp4' // vinheta CCLX antes do loop
const INTRO_MAX_MS = 30000 // segurança: passa ao loop se o vídeo não terminar

/**
 * LoopPage — página pública (para TV) que passa em carrossel, permanentemente,
 * os cartazes/cards dos eventos marcados para o Loop de uma igreja. Eventos em
 * destaque ficam mais tempo. Recarrega periodicamente para apanhar novidades.
 */
export default function LoopPage({ church }) {
  const [state, setState] = useState({ loading: true, active: false, events: [], fixedSlides: [], error: null, format: '16:9', secondsPerSlide: 15, secondsPerSlideFeatured: 30 })
  const [index, setIndex] = useState(0)
  const [introDone, setIntroDone] = useState(false)

  const load = useCallback(async () => {
    try {
      const data = await getLoop(church)
      setState({ loading: false, active: data.active, events: data.events, fixedSlides: data.fixedSlides, error: null, format: data.format, secondsPerSlide: data.secondsPerSlide, secondsPerSlideFeatured: data.secondsPerSlideFeatured })
    } catch (err) {
      setState((s) => ({ ...s, loading: false, error: err.message }))
    }
  }, [church])

  useEffect(() => {
    load()
    const t = setInterval(load, REFETCH_MS)
    return () => clearInterval(t)
  }, [load])

  // Segurança: se o vídeo não disparar onEnded (falha de autoplay/ficheiro),
  // avança para o loop ao fim de INTRO_MAX_MS.
  useEffect(() => {
    if (introDone) return
    const t = setTimeout(() => setIntroDone(true), INTRO_MAX_MS)
    return () => clearTimeout(t)
  }, [introDone])

  const slides = useMemo(() => [
    ...state.events.map((event) => ({ ...event, slideType: 'event' })),
    ...state.fixedSlides.map((slide, slideIndex) => ({ ...slide, id: `fixed-${slideIndex}`, slideType: 'fixed' })),
  ], [state.events, state.fixedSlides])
  const count = slides.length

  // Avança conforme a duração do slide atual (configurável por igreja; destaque
  // fica mais tempo).
  useEffect(() => {
    if (count === 0) return
    const current = slides[index % count]
    const secs = current?.slideType === 'fixed'
      ? current.seconds
      : current?.featured ? state.secondsPerSlideFeatured : state.secondsPerSlide
    const t = setTimeout(() => setIndex((i) => (i + 1) % count), (secs || 15) * 1000)
    return () => clearTimeout(t)
  }, [index, count, slides, state.secondsPerSlide, state.secondsPerSlideFeatured])

  const wrap = (children) => (
    <div className="flex h-screen w-screen flex-col items-center justify-center gap-4 bg-neutral-950 text-neutral-400">
      {children}
    </div>
  )

  // Vinheta CCLX primeiro; ao terminar (ou por erro/segurança) passa ao loop.
  if (!introDone)
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-black">
        <video
          src={INTRO_VIDEO}
          autoPlay
          muted
          playsInline
          onEnded={() => setIntroDone(true)}
          onError={() => setIntroDone(true)}
          className="h-full w-full object-contain"
        />
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
        <span className="text-2xl">Sem conteúdos para mostrar em “{church}”.</span>
      </>
    )

  const slide = slides[index % count]
  // Formato do ecrã da TV (definido na configuração do Loop + CCLX da igreja):
  // escolhe o cartaz dedicado desse formato, com recurso ao outro se faltar.
  const isWide = state.format === '32:9'
  const loopPoster = isWide
    ? slide.loopImage32x9 || slide.loopImage16x9
    : slide.loopImage16x9 || slide.loopImage32x9
  // Só a imagem: o cartaz dedicado ao Loop + CCLX, ou a imagem do próprio evento.
  const image = slide.slideType === 'fixed' ? slide.url : loopPoster || slide.imageUrl
  const durSec = slide.slideType === 'fixed'
    ? slide.seconds
    : (slide.featured ? state.secondsPerSlideFeatured : state.secondsPerSlide) || 15

  return (
    <div className="relative flex h-screen w-screen overflow-hidden bg-neutral-950 text-white">
      <AnimatePresence mode="wait">
        <motion.div
          key={slide.id}
          className="flex h-full w-full items-center justify-center bg-black"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.6 }}
        >
          {slide.slideType === 'fixed' && slide.type === 'video' ? (
            <video
              src={slide.url}
              autoPlay
              muted
              loop
              playsInline
              className="h-full w-full object-contain"
            />
          ) : image ? (
            <img
              src={image}
              alt={slide.slideType === 'event' ? slide.title : ''}
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
          key={`${slide.id}-bar`}
          className="h-full bg-amber-400"
          initial={{ width: '0%' }}
          animate={{ width: '100%' }}
          transition={{ duration: durSec, ease: 'linear' }}
        />
      </div>
    </div>
  )
}

const LOOP_FORMATS = ['16:9', '32:9']
const LOOP_MEDIA_TYPES = ['image', 'video']
const MAX_LOOP_FIXED_SLIDES = 20
const LOOP_DEFAULTS = {
  active: false,
  showGeneral: true,
  weeks: 4,
  format: '16:9',
  secondsPerSlide: 15,
  secondsPerSlideFeatured: 30,
}

function normalizeFixedSlides(value) {
  if (!Array.isArray(value)) return []
  const slides = []
  for (const item of value) {
    if (!item || typeof item !== 'object') continue
    const url = typeof item.url === 'string' ? item.url.trim().slice(0, 1000) : ''
    if (!url || !LOOP_MEDIA_TYPES.includes(item.type)) continue
    const seconds = Number(item.seconds)
    slides.push({
      url,
      type: item.type,
      seconds: Number.isFinite(seconds) && seconds >= 1 && seconds <= 300 ? Math.round(seconds) : 15,
    })
    if (slides.length >= MAX_LOOP_FIXED_SLIDES) break
  }
  return slides
}

export function normalizeLoop(cfg, fallbackName = '') {
  const c = cfg && typeof cfg === 'object' ? cfg : {}
  const weeks = Number(c.weeks)
  const sps = Number(c.secondsPerSlide)
  const spsFeat = Number(c.secondsPerSlideFeatured)
  return {
    name: String(c.name ?? fallbackName ?? '').trim(),
    community: String(c.community ?? '').trim(),
    active: !!c.active,
    showGeneral: c.showGeneral !== false,
    weeks: Number.isInteger(weeks) && weeks >= 1 && weeks <= 52 ? weeks : LOOP_DEFAULTS.weeks,
    format: LOOP_FORMATS.includes(c.format) ? c.format : LOOP_DEFAULTS.format,
    secondsPerSlide:
      Number.isFinite(sps) && sps >= 3 && sps <= 120 ? Math.round(sps) : LOOP_DEFAULTS.secondsPerSlide,
    secondsPerSlideFeatured:
      Number.isFinite(spsFeat) && spsFeat >= 3 && spsFeat <= 300
        ? Math.round(spsFeat)
        : LOOP_DEFAULTS.secondsPerSlideFeatured,
    fixedSlides: normalizeFixedSlides(c.fixedSlides),
  }
}
import { useMemo, useCallback } from 'react'
import { useSubcategories } from './useSubcategories'
import { useCategories } from './useCategories'
import { useI18n } from './useI18n'
import { CATEGORY_META } from '../utils/calendarHelpers'

// Texto escuro legível sobre fundos pastel das subcategorias.
const PASTEL_TEXT = '#334155'

/**
 * useEventColors — resolve as cores de um evento no calendário. Quando o toggle
 * `subcategoryColors` (marca/admin) está ativo e a subcategoria do evento tem
 * cor definida, usa a cor (pastel) da subcategoria; caso contrário usa a cor da
 * categoria (comportamento padrão).
 *
 * `colorFor(evt)` → { subHex, bg, text, dot } para aplicar em chips/blocos/pontos.
 * `subColorMap` (nome→cor) permite colorir sempre o selo da subcategoria.
 */
export function useEventColors() {
  const { subcategories } = useSubcategories()
  const { categories } = useCategories()
  const { subcategoryColors } = useI18n()

  const subColorMap = useMemo(() => {
    const m = {}
    for (const s of subcategories || []) if (s?.name && s?.color) m[s.name] = s.color
    return m
  }, [subcategories])

  const catMap = useMemo(() => {
    const m = {}
    for (const c of categories || []) if (c?.slug) m[c.slug] = c
    return m
  }, [categories])

  const colorFor = useCallback(
    (evt) => {
      const meta = CATEGORY_META[evt?.category] // uma das fixas (cores do tema)
      const dbCat = catMap[evt?.category] // categoria da BD (rótulo/cor personalizados)
      const catLabel = dbCat?.label || meta?.label || evt?.category || CATEGORY_META.evento.label
      // Cor da CATEGORIA (para o selo de categoria — independente do toggle).
      const catBg = meta ? meta.bgVar : dbCat?.color || CATEGORY_META.evento.bgVar
      const catText = meta ? meta.colorVar : dbCat?.color ? PASTEL_TEXT : CATEGORY_META.evento.colorVar
      const catDot = meta ? meta.colorVar : dbCat?.color || CATEGORY_META.evento.colorVar
      // Cor DOMINANTE do evento (chip/bloco/barra/ponto — respeita o toggle).
      const subHex =
        subcategoryColors && evt?.subcategory ? subColorMap[evt.subcategory] || null : null
      return {
        subHex,
        catLabel,
        catBg,
        catText,
        bg: subHex || catBg,
        text: subHex ? PASTEL_TEXT : catText,
        dot: subHex || catDot,
      }
    },
    [catMap, subColorMap, subcategoryColors]
  )

  return { colorFor, subcategoryColors, subColorMap }
}

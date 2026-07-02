import { useMemo, useCallback } from 'react'
import { useSubcategories } from './useSubcategories'
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
  const { subcategoryColors } = useI18n()

  const subColorMap = useMemo(() => {
    const m = {}
    for (const s of subcategories || []) if (s?.name && s?.color) m[s.name] = s.color
    return m
  }, [subcategories])

  const colorFor = useCallback(
    (evt) => {
      const cat = CATEGORY_META[evt?.category] || CATEGORY_META.evento
      const subHex =
        subcategoryColors && evt?.subcategory ? subColorMap[evt.subcategory] || null : null
      return {
        subHex,
        bg: subHex || cat.bgVar,
        text: subHex ? PASTEL_TEXT : cat.colorVar,
        dot: subHex || cat.colorVar,
        catLabel: cat.label,
      }
    },
    [subColorMap, subcategoryColors]
  )

  return { colorFor, subcategoryColors, subColorMap }
}

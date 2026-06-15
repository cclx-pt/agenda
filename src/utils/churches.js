/**
 * churches.js
 *
 * Lista canónica das igrejas CCLX (fonte: IGREJAS.md).
 *
 * Usada para:
 *  - filtrar a agenda por igreja responsável (CommunityFilter);
 *  - alimentar o seletor "Igreja responsável" nos eventos do SoR (ManagePanel);
 *  - normalizar o `responsible_church` recebido da API da inChurch.
 *
 * Os `id` correspondem aos identificadores da inChurch (responsible_church.id).
 */

export const CHURCHES = [
  { id: 33023, name: 'Sede' },
  { id: 34878, name: 'Açores' },
  { id: 33072, name: 'Almada' },
  { id: 33079, name: 'Barreiro' },
  { id: 33077, name: 'Caldas Da Rainha' },
  { id: 33080, name: 'Coruche' },
  { id: 33078, name: 'Moita' },
  { id: 33075, name: 'Porto' },
]

export const CHURCH_NAMES = CHURCHES.map((c) => c.name)

// Igreja por omissão (sede do movimento).
export const DEFAULT_CHURCH = 'Sede'

/** Ordena nomes de igreja: a Sede primeiro, depois alfabética (pt). */
export function compareChurches(a, b) {
  if (a === b) return 0
  if (a === DEFAULT_CHURCH) return -1
  if (b === DEFAULT_CHURCH) return 1
  return a.localeCompare(b, 'pt')
}

/**
 * Tenta inferir a igreja a partir de texto livre (ex.: nome do evento),
 * quando a API não fornece `responsible_church`.
 * Devolve o nome canónico ou `null` se não houver correspondência.
 */
export function inferChurchFromText(text) {
  const t = text || ''
  for (const name of CHURCH_NAMES) {
    if (name === DEFAULT_CHURCH) continue
    if (t.toLowerCase().includes(name.toLowerCase())) return name
  }
  if (/\bsede\b/i.test(t)) return DEFAULT_CHURCH
  return null
}

// Lista canónica das igrejas CCLX (espelha src/utils/churches.js no frontend).
// Usada para validar o acesso por igreja dos utilizadores e o âmbito de gestão
// dos eventos do System of Record.

export const CHURCH_NAMES = [
  'Sede',
  'Açores',
  'Almada',
  'Barreiro',
  'Caldas Da Rainha',
  'Coruche',
  'Moita',
  'Porto',
]

/** Verdadeiro se `name` é uma igreja conhecida. */
export function isKnownChurch(name) {
  return CHURCH_NAMES.includes(name)
}

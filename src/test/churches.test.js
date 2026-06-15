import { describe, it, expect } from 'vitest'
import {
  CHURCHES,
  CHURCH_NAMES,
  DEFAULT_CHURCH,
  compareChurches,
  inferChurchFromText,
} from '../utils/churches'

describe('CHURCHES (lista canónica do IGREJAS.md)', () => {
  it('contém as 8 igrejas com id e nome', () => {
    expect(CHURCHES).toHaveLength(8)
    for (const c of CHURCHES) {
      expect(typeof c.id).toBe('number')
      expect(typeof c.name).toBe('string')
      expect(c.name.length).toBeGreaterThan(0)
    }
  })

  it('inclui a Sede com o id da inChurch', () => {
    expect(CHURCHES).toContainEqual({ id: 33023, name: 'Sede' })
  })

  it('não tem nomes nem ids duplicados', () => {
    expect(new Set(CHURCH_NAMES).size).toBe(CHURCHES.length)
    expect(new Set(CHURCHES.map((c) => c.id)).size).toBe(CHURCHES.length)
  })

  it('CHURCH_NAMES deriva de CHURCHES', () => {
    expect(CHURCH_NAMES).toEqual(CHURCHES.map((c) => c.name))
  })

  it('a igreja por omissão é a Sede e existe na lista', () => {
    expect(DEFAULT_CHURCH).toBe('Sede')
    expect(CHURCH_NAMES).toContain(DEFAULT_CHURCH)
  })

  it('não inclui o valor de marca "CCLX"', () => {
    expect(CHURCH_NAMES).not.toContain('CCLX')
  })
})

describe('compareChurches', () => {
  it('coloca sempre a Sede em primeiro', () => {
    expect(compareChurches('Sede', 'Almada')).toBeLessThan(0)
    expect(compareChurches('Almada', 'Sede')).toBeGreaterThan(0)
  })

  it('ordena as restantes alfabeticamente (pt)', () => {
    expect(compareChurches('Açores', 'Barreiro')).toBeLessThan(0)
    expect(compareChurches('Porto', 'Moita')).toBeGreaterThan(0)
  })

  it('é igual para o mesmo nome', () => {
    expect(compareChurches('Porto', 'Porto')).toBe(0)
  })

  it('ordena uma lista baralhada com a Sede no topo', () => {
    const baralhado = ['Porto', 'Sede', 'Açores', 'Almada', 'Barreiro']
    const ordenado = [...baralhado].sort(compareChurches)
    expect(ordenado).toEqual(['Sede', 'Açores', 'Almada', 'Barreiro', 'Porto'])
  })
})

describe('inferChurchFromText', () => {
  it('reconhece o nome de uma igreja no texto (case-insensitive)', () => {
    expect(inferChurchFromText('Celebração Almada')).toBe('Almada')
    expect(inferChurchFromText('culto porto manhã')).toBe('Porto')
    expect(inferChurchFromText('Encontro Caldas Da Rainha')).toBe('Caldas Da Rainha')
  })

  it('reconhece a Sede pela palavra "sede"', () => {
    expect(inferChurchFromText('CCLX Sede - Escola Bíblica')).toBe('Sede')
  })

  it('devolve null quando não há correspondência', () => {
    expect(inferChurchFromText('Reunião de oração')).toBeNull()
    expect(inferChurchFromText('')).toBeNull()
    expect(inferChurchFromText(null)).toBeNull()
    expect(inferChurchFromText(undefined)).toBeNull()
  })

  it('prefere uma igreja específica a "sede" quando ambas surgem', () => {
    // O ciclo testa primeiro os nomes específicos (exceto Sede).
    expect(inferChurchFromText('Sede e Porto em conjunto')).toBe('Porto')
  })
})

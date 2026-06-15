import { z } from 'zod'
import * as repo from './repository.js'

// Erro de domínio com código HTTP associado.
export class CategoryError extends Error {
  constructor(status, message) {
    super(message)
    this.name = 'CategoryError'
    this.status = status
  }
}

// Slug: identificador estável (minúsculas, números e hífen).
const slug = z
  .string()
  .trim()
  .min(1, 'O identificador é obrigatório.')
  .max(40)
  .regex(/^[a-z0-9-]+$/, 'Use apenas minúsculas, números e hífen.')

// Cor de apresentação no formato #RRGGBB; '' → null.
const color = z
  .string()
  .trim()
  .optional()
  .nullable()
  .transform((v) => (v ? v : null))
  .refine((v) => v === null || /^#[0-9a-fA-F]{6}$/.test(v), 'Cor inválida (use #RRGGBB).')

// Ordem de apresentação; aceita número ou string numérica; vazio → 0.
const sortOrder = z
  .union([z.number().int(), z.string().trim()])
  .optional()
  .nullable()
  .transform((v) => {
    if (v === null || v === undefined || v === '') return 0
    const n = Number(v)
    if (!Number.isInteger(n)) throw new CategoryError(400, 'Ordem inválida.')
    return n
  })

export const createSchema = z.object({
  slug,
  label: z.string().trim().min(1, 'O nome da categoria é obrigatório.').max(80),
  color,
  sortOrder,
})

// O slug é o identificador estável (referenciado por events.category) e não é
// editável; apenas o nome, a cor e a ordem podem ser alterados.
export const updateSchema = z
  .object({
    label: z.string().trim().min(1, 'O nome da categoria é obrigatório.').max(80).optional(),
    color,
    sortOrder,
  })
  .refine((d) => Object.keys(d).length > 0, { message: 'Nada para atualizar.' })

export function list() {
  return repo.list()
}

/** Garante que o slug existe (validação da categoria dos eventos). */
export async function assertKnownCategory(slugValue) {
  if (!slugValue) return
  const known = await repo.listSlugs()
  if (!known.includes(slugValue)) {
    throw new CategoryError(400, `Categoria desconhecida: ${slugValue}`)
  }
}

export async function create(input) {
  const data = createSchema.parse(input)
  const existing = await repo.findBySlug(data.slug)
  if (existing) throw new CategoryError(409, 'Já existe uma categoria com este identificador.')
  return repo.insert(data)
}

export async function update(id, input) {
  const data = updateSchema.parse(input)
  const target = await repo.findById(id)
  if (!target) throw new CategoryError(404, 'Categoria não encontrada.')

  const fields = {}
  if (data.label !== undefined) fields.label = data.label
  if (data.color !== undefined) fields.color = data.color
  if (data.sortOrder !== undefined) fields.sort_order = data.sortOrder
  return repo.update(id, fields)
}

export async function remove(id) {
  const target = await repo.findById(id)
  if (!target) throw new CategoryError(404, 'Categoria não encontrada.')
  const inUse = await repo.countEvents(target.slug)
  if (inUse > 0) {
    throw new CategoryError(409, `Categoria em uso por ${inUse} evento(s).`)
  }
  await repo.remove(id)
}

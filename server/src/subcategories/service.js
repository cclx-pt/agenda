import { z } from 'zod'
import * as repo from './repository.js'

// Erro de domínio com código HTTP associado.
export class SubcategoryError extends Error {
  constructor(status, message) {
    super(message)
    this.name = 'SubcategoryError'
    this.status = status
  }
}

// Nome de apresentação da subcategoria (ex.: "B1", "Escola Dominical").
const name = z.string().trim().min(1, 'O nome da subcategoria é obrigatório.').max(80)

// Ordem de apresentação; aceita número ou string numérica; vazio → 0.
const sortOrder = z
  .union([z.number().int(), z.string().trim()])
  .optional()
  .nullable()
  .transform((v) => {
    if (v === null || v === undefined || v === '') return 0
    const n = Number(v)
    if (!Number.isInteger(n)) throw new SubcategoryError(400, 'Ordem inválida.')
    return n
  })

export const createSchema = z.object({ name, sortOrder })

export const updateSchema = z
  .object({
    name: name.optional(),
    sortOrder,
  })
  .refine((d) => Object.keys(d).length > 0, { message: 'Nada para atualizar.' })

export function list() {
  return repo.list()
}

/** Garante que o nome existe (validação da subcategoria dos eventos). */
export async function assertKnownSubcategory(value) {
  if (!value) return
  const known = await repo.listNames()
  if (!known.some((n) => n.toLowerCase() === value.toLowerCase())) {
    throw new SubcategoryError(400, `Subcategoria desconhecida: ${value}`)
  }
}

export async function create(input) {
  const data = createSchema.parse(input)
  const existing = await repo.findByName(data.name)
  if (existing) throw new SubcategoryError(409, 'Já existe uma subcategoria com este nome.')
  return repo.insert(data)
}

export async function update(id, input) {
  const data = updateSchema.parse(input)
  const target = await repo.findById(id)
  if (!target) throw new SubcategoryError(404, 'Subcategoria não encontrada.')
  if (data.name && data.name.toLowerCase() !== target.name.toLowerCase()) {
    const clash = await repo.findByName(data.name)
    if (clash) throw new SubcategoryError(409, 'Já existe uma subcategoria com este nome.')
  }
  const fields = {}
  if (data.name !== undefined) fields.name = data.name
  if (data.sortOrder !== undefined) fields.sort_order = data.sortOrder
  const result = await repo.update(id, fields)
  if (data.name && data.name !== target.name) {
    await repo.renameInEvents(target.name, data.name)
  }
  return result
}

export async function remove(id) {
  const target = await repo.findById(id)
  if (!target) throw new SubcategoryError(404, 'Subcategoria não encontrada.')
  const inUse = await repo.countEvents(target.name)
  if (inUse > 0) {
    throw new SubcategoryError(409, `Subcategoria em uso por ${inUse} evento(s).`)
  }
  await repo.remove(id)
}

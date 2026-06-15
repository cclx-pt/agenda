import { z } from 'zod'
import * as repo from './repository.js'

// Erro de domínio com código HTTP associado.
export class ChurchError extends Error {
  constructor(status, message) {
    super(message)
    this.name = 'ChurchError'
    this.status = status
  }
}

// Campo opcional de texto: '' → null.
const optionalText = z
  .string()
  .trim()
  .max(255)
  .optional()
  .nullable()
  .transform((v) => (v ? v : null))

// ID externo da inChurch (responsible_church.id). Aceita número ou string
// numérica; '' → null.
const externalId = z
  .union([z.number().int().positive(), z.string().trim()])
  .optional()
  .nullable()
  .transform((v) => {
    if (v === null || v === undefined || v === '') return null
    const n = Number(v)
    if (!Number.isInteger(n) || n <= 0) throw new ChurchError(400, 'ID da API inválido.')
    return n
  })

export const createSchema = z.object({
  name: z.string().trim().min(1, 'O nome da igreja é obrigatório.').max(120),
  externalId,
  address: optionalText,
  postalCode: optionalText,
})

export const updateSchema = z
  .object({
    name: z.string().trim().min(1, 'O nome da igreja é obrigatório.').max(120).optional(),
    externalId,
    address: optionalText,
    postalCode: optionalText,
  })
  .refine((d) => Object.keys(d).length > 0, { message: 'Nada para atualizar.' })

export function list() {
  return repo.list()
}

export function listNames() {
  return repo.listNames()
}

export async function create(input) {
  const data = createSchema.parse(input)
  const existing = await repo.findByName(data.name)
  if (existing) throw new ChurchError(409, 'Já existe uma igreja com este nome.')
  return repo.insert(data)
}

export async function update(id, input) {
  const data = updateSchema.parse(input)
  const target = await repo.findById(id)
  if (!target) throw new ChurchError(404, 'Igreja não encontrada.')

  if (data.name && data.name.toLowerCase() !== target.name.toLowerCase()) {
    const clash = await repo.findByName(data.name)
    if (clash) throw new ChurchError(409, 'Já existe uma igreja com este nome.')
  }

  const fields = {}
  if (data.name !== undefined) fields.name = data.name
  if (data.externalId !== undefined) fields.external_id = data.externalId
  if (data.address !== undefined) fields.address = data.address
  if (data.postalCode !== undefined) fields.postal_code = data.postalCode
  return repo.update(id, fields)
}

export async function remove(id) {
  const target = await repo.findById(id)
  if (!target) throw new ChurchError(404, 'Igreja não encontrada.')
  await repo.remove(id)
}

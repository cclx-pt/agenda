import { z } from 'zod'
import * as repo from './repository.js'

// Erro de domínio com código HTTP associado.
export class PrivacyTagError extends Error {
  constructor(status, message) {
    super(message)
    this.name = 'PrivacyTagError'
    this.status = status
  }
}

// O nome é o identificador (referenciado por events.privacy_tag e
// users.privacy_tags) e não é editável; para renomear, eliminar e recriar.
export const createSchema = z.object({
  name: z.string().trim().min(1, 'O nome da etiqueta é obrigatório.').max(60),
})

export function list() {
  return repo.list()
}

/** Garante que todas as etiquetas indicadas existem (eventos/utilizadores). */
export async function assertKnownPrivacyTags(tags) {
  if (!Array.isArray(tags) || tags.length === 0) return
  const known = new Set(await repo.listNames())
  for (const name of tags) {
    if (!known.has(name)) throw new PrivacyTagError(400, `Etiqueta desconhecida: ${name}`)
  }
}

/** Garante que uma única etiqueta existe (etiqueta de um evento). */
export async function assertKnownPrivacyTag(name) {
  if (!name) return
  await assertKnownPrivacyTags([name])
}

export async function create(input) {
  const data = createSchema.parse(input)
  const existing = await repo.findByName(data.name)
  if (existing) throw new PrivacyTagError(409, 'Já existe uma etiqueta com este nome.')
  return repo.insert(data)
}

export async function remove(id) {
  const target = await repo.findById(id)
  if (!target) throw new PrivacyTagError(404, 'Etiqueta não encontrada.')
  const inUse = await repo.countEvents(target.name)
  if (inUse > 0) {
    throw new PrivacyTagError(409, `Etiqueta em uso por ${inUse} evento(s).`)
  }
  // Limpa a etiqueta das listas de acesso dos utilizadores antes de eliminar.
  await repo.removeFromUsers(target.name)
  await repo.remove(id)
}

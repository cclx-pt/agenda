import { z } from 'zod'
import * as repo from './repository.js'
import * as churchesRepo from '../churches/repository.js'
import * as privacyTagsRepo from '../privacyTags/repository.js'

// Erro de domínio com código HTTP associado.
export class UserError extends Error {
  constructor(status, message) {
    super(message)
    this.name = 'UserError'
    this.status = status
  }
}

const ROLES = ['admin', 'aprovador', 'editor', 'visitante']
// Só aprovador e editor têm âmbito por igreja (admin = todas; visitante não gere).
const isScopedRole = (role) => ['aprovador', 'editor'].includes(role)
// Admin e visitante veem sempre eventos privados ("ver tudo").
const seesAllPrivate = (role) => ['admin', 'visitante'].includes(role)

// Acesso por igreja: lista de nomes de igreja (validados contra a BD), ou
// null (= todas). A validação dos nomes faz-se no serviço (ver BD).
const churchesSchema = z
  .array(z.string().trim().min(1))
  .nullable()
  .optional()

// Garante que todas as igrejas indicadas existem na BD (fonte única da verdade).
async function assertKnownChurches(churches) {
  if (!Array.isArray(churches) || churches.length === 0) return
  const known = new Set(await churchesRepo.listNames())
  for (const name of churches) {
    if (!known.has(name)) throw new UserError(400, `Igreja desconhecida: ${name}`)
  }
}

// Etiquetas de privacidade que o utilizador pode ver: array de nomes (validados
// contra a BD) ou null (= todas as etiquetas / ver tudo).
const privacyTagsSchema = z
  .array(z.string().trim().min(1))
  .nullable()
  .optional()

// Garante que todas as etiquetas indicadas existem na BD.
async function assertKnownPrivacyTags(tags) {
  if (!Array.isArray(tags) || tags.length === 0) return
  const known = new Set(await privacyTagsRepo.listNames())
  for (const name of tags) {
    if (!known.has(name)) throw new UserError(400, `Etiqueta desconhecida: ${name}`)
  }
}

// Normaliza as etiquetas: null/lista vazia = todas (null); resto sem duplicados.
function normalizePrivacyTags(tags) {
  if (tags === undefined) return undefined
  if (tags === null || tags.length === 0) return null
  return [...new Set(tags)]
}

// Normaliza o acesso por igreja: só aprovador/editor têm âmbito; admin e
// visitante = null (sem restrição); lista vazia = todas (null); resto sem duplicados.
function normalizeChurches(role, churches) {
  if (!isScopedRole(role)) return null
  if (churches === undefined) return undefined
  if (churches === null || churches.length === 0) return null
  return [...new Set(churches)]
}

export const createSchema = z.object({
  email: z.string().email('Email inválido.').transform((v) => v.toLowerCase().trim()),
  name: z.string().trim().min(1, 'O nome é obrigatório.').optional().nullable(),
  role: z.enum(ROLES),
  isActive: z.boolean().optional(),
  canViewPrivate: z.boolean().optional(),
  churches: churchesSchema,
  privacyTags: privacyTagsSchema,
})

export const updateSchema = z
  .object({
    name: z.string().trim().min(1).optional(),
    role: z.enum(ROLES).optional(),
    isActive: z.boolean().optional(),
    canViewPrivate: z.boolean().optional(),
    churches: churchesSchema,
    privacyTags: privacyTagsSchema,
  })
  .refine((d) => Object.keys(d).length > 0, { message: 'Nada para atualizar.' })

export function list() {
  return repo.list()
}

export async function create(input) {
  const data = createSchema.parse(input)
  const existing = await repo.findByEmail(data.email)
  if (existing) throw new UserError(409, 'Já existe um utilizador com este email.')
  // Admin e visitante vêem sempre eventos privados ("ver tudo").
  if (seesAllPrivate(data.role)) data.canViewPrivate = true
  // Staff vê todas as igrejas; restante normaliza o acesso por igreja.
  const churches = normalizeChurches(data.role, data.churches) ?? null
  await assertKnownChurches(churches)
  data.churches = churches
  // Etiquetas de privacidade (null = todas).
  const privacyTags = normalizePrivacyTags(data.privacyTags) ?? null
  await assertKnownPrivacyTags(privacyTags)
  data.privacyTags = privacyTags
  return repo.insert(data)
}

export async function update(actor, id, input) {
  const data = updateSchema.parse(input)
  const target = await repo.findById(id)
  if (!target) throw new UserError(404, 'Utilizador não encontrado.')

  // Admin e visitante vêem sempre eventos privados (coerência com o login/JWT).
  const nextRole = data.role ?? target.role
  if (seesAllPrivate(nextRole)) data.canViewPrivate = true

  // Protege o último administrador ativo de ser despromovido/desativado.
  const losesAdmin =
    target.role === 'admin' &&
    ((data.role && data.role !== 'admin') || data.isActive === false)
  if (losesAdmin && (await repo.countAdmins()) <= 1) {
    throw new UserError(409, 'Não é possível remover o último administrador ativo.')
  }

  const fields = {}
  if (data.name !== undefined) fields.name = data.name
  if (data.role !== undefined) fields.role = data.role
  if (data.isActive !== undefined) fields.is_active = data.isActive
  if (data.canViewPrivate !== undefined) fields.can_view_private = data.canViewPrivate
  // Recalcula o acesso por igreja se mudou o papel ou a lista de igrejas.
  if (data.churches !== undefined || data.role !== undefined) {
    const sourceChurches = data.churches !== undefined ? data.churches : target.churches
    const normalized = normalizeChurches(nextRole, sourceChurches)
    await assertKnownChurches(normalized)
    fields.churches = normalized
  }
  // Atualiza as etiquetas de privacidade se foram fornecidas.
  if (data.privacyTags !== undefined) {
    const normalizedTags = normalizePrivacyTags(data.privacyTags)
    await assertKnownPrivacyTags(normalizedTags)
    fields.privacy_tags = normalizedTags
  }
  return repo.update(id, fields)
}

export async function remove(actor, id) {
  const target = await repo.findById(id)
  if (!target) throw new UserError(404, 'Utilizador não encontrado.')
  if (target.id === actor.sub) throw new UserError(409, 'Não podes eliminar a tua própria conta.')
  if (target.role === 'admin' && (await repo.countAdmins()) <= 1) {
    throw new UserError(409, 'Não é possível eliminar o último administrador ativo.')
  }
  await repo.remove(id)
}

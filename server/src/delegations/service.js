import { z } from 'zod'
import * as repo from './repository.js'
import * as usersRepo from '../users/repository.js'
import * as churchesRepo from '../churches/repository.js'
import * as categoriesRepo from '../categories/repository.js'

// Erro de domínio com código HTTP associado.
export class DelegationError extends Error {
  constructor(status, message) {
    super(message)
    this.name = 'DelegationError'
    this.status = status
  }
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const dateStr = z.string().regex(DATE_RE, 'Data inválida (use AAAA-MM-DD).')

const delegationSchema = z
  .object({
    delegateId: z.string().uuid('Editor (delegado) inválido.'),
    // null/ausente = todas as igrejas / todas as categorias.
    church: z.string().trim().min(1).optional().nullable(),
    category: z.string().trim().min(1).optional().nullable(),
    startDate: dateStr,
    endDate: dateStr,
    active: z.boolean().optional(),
  })
  .refine((d) => d.endDate >= d.startDate, {
    message: 'A data de fim não pode ser anterior à de início.',
    path: ['endDate'],
  })

const isAdmin = (role) => role === 'admin'

function userChurches(user) {
  const c = user?.churches
  return Array.isArray(c) && c.length > 0 ? c : null
}

// Um aprovador só pode delegar igrejas a que tem acesso. "Todas" (church null)
// só é permitido a admin ou a aprovador sem âmbito de igreja.
function canDelegateChurch(user, church) {
  if (isAdmin(user.role)) return true
  const churches = userChurches(user)
  if (churches === null) return true
  if (church == null) return false
  return churches.includes(church)
}

// Valida a igreja e a categoria (se fornecidas) contra a BD.
async function assertKnownRefs(data) {
  if (data.church) {
    const names = await churchesRepo.listNames()
    if (!names.includes(data.church)) {
      throw new DelegationError(400, `Igreja desconhecida: ${data.church}`)
    }
  }
  if (data.category) {
    const slugs = await categoriesRepo.listSlugs()
    if (!slugs.includes(data.category)) {
      throw new DelegationError(400, `Categoria desconhecida: ${data.category}`)
    }
  }
}

// O delegado tem de ser um editor ativo.
async function assertDelegateIsEditor(delegateId) {
  const target = await usersRepo.findById(delegateId)
  if (!target) throw new DelegationError(404, 'Editor (delegado) não encontrado.')
  if (target.role !== 'editor') {
    throw new DelegationError(400, 'As delegações só podem ser atribuídas a editores.')
  }
  if (!target.isActive) {
    throw new DelegationError(400, 'O editor indicado está suspenso.')
  }
}

/** Lista para o painel: admin vê todas; aprovador vê as que criou. */
export function listForUser(user) {
  if (isAdmin(user.role)) return repo.list()
  return repo.listByDelegator(user.sub)
}

/** Editores ativos (candidatos a delegado). */
export function listEditors() {
  return repo.listEditors()
}

export async function create(user, input) {
  const data = delegationSchema.parse(input)
  await assertDelegateIsEditor(data.delegateId)
  await assertKnownRefs(data)
  if (!canDelegateChurch(user, data.church ?? null)) {
    throw new DelegationError(403, 'Sem permissão para delegar esta igreja.')
  }
  return repo.insert(data, user.sub)
}

export async function update(user, id, input) {
  const existing = await repo.findById(id)
  if (!existing) throw new DelegationError(404, 'Delegação não encontrada.')
  // Admin edita qualquer uma; aprovador só as que criou.
  if (!isAdmin(user.role) && existing.delegatorId !== user.sub) {
    throw new DelegationError(403, 'Sem permissão para alterar esta delegação.')
  }
  const data = delegationSchema.parse(input)
  await assertDelegateIsEditor(data.delegateId)
  await assertKnownRefs(data)
  if (!canDelegateChurch(user, data.church ?? null)) {
    throw new DelegationError(403, 'Sem permissão para delegar esta igreja.')
  }
  return repo.update(id, data)
}

export async function remove(user, id) {
  const existing = await repo.findById(id)
  if (!existing) throw new DelegationError(404, 'Delegação não encontrada.')
  if (!isAdmin(user.role) && existing.delegatorId !== user.sub) {
    throw new DelegationError(403, 'Sem permissão para eliminar esta delegação.')
  }
  await repo.remove(id)
}

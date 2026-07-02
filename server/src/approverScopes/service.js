import { z } from 'zod'
import * as repo from './repository.js'
import * as usersRepo from '../users/repository.js'
import * as churchesRepo from '../churches/repository.js'
import * as categoriesRepo from '../categories/repository.js'

// Erro de domínio com código HTTP associado.
export class ApproverScopeError extends Error {
  constructor(status, message) {
    super(message)
    this.name = 'ApproverScopeError'
    this.status = status
  }
}

const scopeSchema = z.object({
  approverId: z.string().uuid('Aprovador inválido.'),
  // null/ausente = todas as igrejas / todas as categorias.
  church: z.string().trim().min(1).optional().nullable(),
  category: z.string().trim().min(1).optional().nullable(),
})

async function assertKnownRefs(data) {
  if (data.church) {
    const names = await churchesRepo.listNames()
    if (!names.includes(data.church)) {
      throw new ApproverScopeError(400, `Igreja desconhecida: ${data.church}`)
    }
  }
  if (data.category) {
    const slugs = await categoriesRepo.listSlugs()
    if (!slugs.includes(data.category)) {
      throw new ApproverScopeError(400, `Categoria desconhecida: ${data.category}`)
    }
  }
}

async function assertIsApprover(approverId) {
  const u = await usersRepo.findById(approverId)
  if (!u) throw new ApproverScopeError(404, 'Aprovador não encontrado.')
  if (u.role !== 'aprovador') throw new ApproverScopeError(400, 'O utilizador indicado não é aprovador.')
  if (!u.isActive) throw new ApproverScopeError(400, 'O aprovador indicado está suspenso.')
}

export function list() {
  return repo.list()
}

export function listApprovers() {
  return repo.listApprovers()
}

export async function create(input) {
  const data = scopeSchema.parse(input)
  // Uma regra com igreja E categoria vazias equivaleria a "tudo" (sem efeito).
  if (!data.church && !data.category) {
    throw new ApproverScopeError(400, 'Indique pelo menos uma igreja ou uma categoria.')
  }
  await assertIsApprover(data.approverId)
  await assertKnownRefs(data)
  return repo.insert(data)
}

export async function remove(id) {
  const existing = await repo.findById(id)
  if (!existing) throw new ApproverScopeError(404, 'Configuração não encontrada.')
  await repo.remove(id)
}

// Serviço de gestão de eventos (System of Record). Comunica com o backend
// via proxy Vite (/data/events). Usa cookies de sessão httpOnly.

async function request(url, { method = 'GET', body } = {}) {
  const res = await fetch(url, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    credentials: 'include',
    body: body ? JSON.stringify(body) : undefined,
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(data.error || 'Ocorreu um erro. Tenta novamente.')
  }
  return data
}

/** Lista os eventos de gestão visíveis ao utilizador autenticado. */
export async function listEvents() {
  const { events } = await request('/data/events')
  return events
}

/** Categorias distintas em uso por eventos (qualquer estado + externos). */
export async function listCategoriesInUse() {
  const { categories } = await request('/data/events/categories-in-use')
  return categories
}

/** Histórico de transições de um evento. */
export async function getHistory(id) {
  const { history } = await request(`/data/events/${id}/history`)
  return history
}

export async function createEvent(payload) {
  const { event } = await request('/data/events', { method: 'POST', body: payload })
  return event
}

export async function updateEvent(id, payload, { scope } = {}) {
  const qs = scope === 'series' ? '?scope=series' : ''
  const { event } = await request(`/data/events/${id}${qs}`, { method: 'PUT', body: payload })
  return event
}

export async function deleteEvent(id, { scope } = {}) {
  const qs = scope === 'series' ? '?scope=series' : ''
  await request(`/data/events/${id}${qs}`, { method: 'DELETE' })
}

export async function submitEvent(id) {
  const { event } = await request(`/data/events/${id}/submit`, { method: 'POST' })
  return event
}

export async function approveEvent(id) {
  const { event } = await request(`/data/events/${id}/approve`, { method: 'POST' })
  return event
}

export async function rejectEvent(id, reason) {
  const { event } = await request(`/data/events/${id}/reject`, {
    method: 'POST',
    body: { reason },
  })
  return event
}

// ── Integração inChurch (apenas admin) ───────────────────────────

/** Lê a configuração da integração inChurch (interruptor, intervalo, estado). */
export async function getIntegration() {
  const { integration } = await request('/data/integration')
  return integration
}

/** Atualiza a configuração da integração (enabled, intervalMinutes). */
export async function updateIntegration(payload) {
  const { integration } = await request('/data/integration', { method: 'PUT', body: payload })
  return integration
}

/** Força uma sincronização imediata com a inChurch. Devolve o resumo. */
export async function syncIntegration() {
  const { result } = await request('/data/integration/sync', { method: 'POST' })
  return result
}

/** Purga TODOS os eventos externos (API/inChurch) da base de dados. Devolve o resumo. */
export async function purgeIntegration() {
  const { result } = await request('/data/integration/purge', { method: 'POST' })
  return result
}

// ── Aprovações e delegações ──────────────────────────────────────

/** Lista os eventos para o painel de aprovações, filtrados por estado. */
export async function listApprovals(status = 'pendente') {
  const { events } = await request(`/data/events/approvals?status=${encodeURIComponent(status)}`)
  return events
}

/** Lista as delegações de aprovação (admin: todas; aprovador: as suas). */
export async function listDelegations() {
  const { delegations } = await request('/data/delegations')
  return delegations
}

/** Lista os editores ativos (candidatos a delegado). */
export async function listDelegationEditors() {
  const { editors } = await request('/data/delegations/editors')
  return editors
}

export async function createDelegation(payload) {
  const { delegation } = await request('/data/delegations', { method: 'POST', body: payload })
  return delegation
}

export async function updateDelegation(id, payload) {
  const { delegation } = await request(`/data/delegations/${id}`, { method: 'PUT', body: payload })
  return delegation
}

export async function deleteDelegation(id) {
  await request(`/data/delegations/${id}`, { method: 'DELETE' })
}

// ── Gestão de utilizadores (apenas admin) ────────────────────────

export async function listUsers() {
  const { users } = await request('/data/users')
  return users
}

export async function createUser(payload) {
  const { user } = await request('/data/users', { method: 'POST', body: payload })
  return user
}

export async function updateUser(id, payload) {
  const { user } = await request(`/data/users/${id}`, { method: 'PUT', body: payload })
  return user
}

export async function deleteUser(id) {
  await request(`/data/users/${id}`, { method: 'DELETE' })
}

// ── Relatórios (staff) ───────────────────────────────────────────

export async function getReportSummary() {
  const { summary } = await request('/data/reports/summary')
  return summary
}

// ── Igrejas / organizações ───────────────────────────────────────

/** Lista as igrejas geridas no backoffice (qualquer utilizador autenticado). */
export async function listChurches() {
  const { churches } = await request('/data/churches')
  return churches
}

export async function createChurch(payload) {
  const { church } = await request('/data/churches', { method: 'POST', body: payload })
  return church
}

export async function updateChurch(id, payload) {
  const { church } = await request(`/data/churches/${id}`, { method: 'PUT', body: payload })
  return church
}

export async function deleteChurch(id) {
  await request(`/data/churches/${id}`, { method: 'DELETE' })
}

// ── Categorias de eventos ────────────────────────────────────────

/** Lista as categorias geríveis no backoffice (qualquer utilizador autenticado). */
export async function listCategories() {
  const { categories } = await request('/data/categories')
  return categories
}

export async function createCategory(payload) {
  const { category } = await request('/data/categories', { method: 'POST', body: payload })
  return category
}

export async function updateCategory(id, payload) {
  const { category } = await request(`/data/categories/${id}`, { method: 'PUT', body: payload })
  return category
}

export async function deleteCategory(id) {
  await request(`/data/categories/${id}`, { method: 'DELETE' })
}

// ── Etiquetas de privacidade ─────────────────────────────────────

/** Lista as etiquetas de privacidade (qualquer utilizador autenticado). */
export async function listPrivacyTags() {
  const { privacyTags } = await request('/data/privacy-tags')
  return privacyTags
}

export async function createPrivacyTag(payload) {
  const { privacyTag } = await request('/data/privacy-tags', { method: 'POST', body: payload })
  return privacyTag
}

export async function deletePrivacyTag(id) {
  await request(`/data/privacy-tags/${id}`, { method: 'DELETE' })
}

// ── Upload de imagem ─────────────────────────────────────────────

/**
 * Carrega uma imagem (PNG/JPG, ≤5MB) e devolve a URL relativa servida pelo
 * backend. Usa multipart/form-data (o browser define o boundary).
 */
export async function uploadEventImage(file) {
  const form = new FormData()
  form.append('file', file)
  const res = await fetch('/data/uploads', {
    method: 'POST',
    credentials: 'include',
    body: form,
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(data.error || 'Falha ao carregar a imagem.')
  }
  return data.url
}

/**
 * Carrega um anexo (PDF/PNG/JPG, ≤5MB) e devolve a URL pública. Usa o mesmo
 * endpoint de uploads (multipart/form-data).
 */
export async function uploadEventAttachment(file) {
  const form = new FormData()
  form.append('file', file)
  const res = await fetch('/data/uploads', {
    method: 'POST',
    credentials: 'include',
    body: form,
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(data.error || 'Falha ao carregar o anexo.')
  }
  return data.url
}

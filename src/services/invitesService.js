// Serviço de convites / páginas públicas de convite. Comunica com o backend via
// /data/invites (gestão, autenticado) e /data/public/invite (público, sem sessão).

async function request(url, { method = 'GET', body } = {}) {
  const res = await fetch(url, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    credentials: 'include',
    body: body ? JSON.stringify(body) : undefined,
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const err = new Error(data.error || 'Ocorreu um erro. Tenta novamente.')
    err.status = res.status
    throw err
  }
  return data
}

// ── Gestão (organizador, autenticado) ────────────────────────────

export async function listInvites() {
  const { invites } = await request('/data/invites')
  return invites
}

// Eventos publicados/futuros que se podem associar a um convite.
export async function getSelectableEvents() {
  const { events } = await request('/data/invites/selectable-events')
  return events
}

// Bilhetes de um convite.
export async function listTickets(id) {
  const { tickets } = await request(`/data/invites/${id}/tickets`)
  return tickets
}

export async function saveTickets(id, tickets) {
  const { tickets: saved } = await request(`/data/invites/${id}/tickets`, { method: 'PUT', body: { tickets } })
  return saved
}

export async function createInvite(payload) {
  const { invite } = await request('/data/invites', { method: 'POST', body: payload })
  return invite
}

export async function getInvite(id) {
  const { invite } = await request(`/data/invites/${id}`)
  return invite
}

export async function updateInvite(id, payload) {
  const { invite } = await request(`/data/invites/${id}`, { method: 'PUT', body: payload })
  return invite
}

export async function saveInviteBlocks(id, blocks) {
  const { invite } = await request(`/data/invites/${id}/blocks`, { method: 'PUT', body: { blocks } })
  return invite
}

export async function publishInvite(id) {
  const { invite } = await request(`/data/invites/${id}/publish`, { method: 'POST' })
  return invite
}

export async function setInviteStatus(id, status) {
  const { invite } = await request(`/data/invites/${id}/status`, { method: 'POST', body: { status } })
  return invite
}

export async function deleteInvite(id) {
  await request(`/data/invites/${id}`, { method: 'DELETE' })
}

export async function getInvitePreview(id) {
  const { page } = await request(`/data/invites/${id}/preview`)
  return page
}

export async function listInviteGuests(id) {
  const { guests } = await request(`/data/invites/${id}/guests`)
  return guests
}

// Gestão de uma inscrição (organizador).
export async function updateInviteGuest(inviteId, guestId, payload) {
  const { guest } = await request(`/data/invites/${inviteId}/guests/${guestId}`, { method: 'PUT', body: payload })
  return guest
}

export async function cancelInviteGuest(inviteId, guestId) {
  const { guest } = await request(`/data/invites/${inviteId}/guests/${guestId}/cancel`, { method: 'POST' })
  return guest
}

export async function deleteInviteGuest(inviteId, guestId) {
  await request(`/data/invites/${inviteId}/guests/${guestId}`, { method: 'DELETE' })
}

// ── Definições gerais dos convites (admin) ───────────────────────

export async function getInviteSettings() {
  const { settings } = await request('/data/invite-settings')
  return settings
}

export async function updateInviteSettings(payload) {
  const { settings } = await request('/data/invite-settings', { method: 'PUT', body: payload })
  return settings
}

// ── Público (sem sessão) ─────────────────────────────────────────

export async function getPublicInvite(slug, guestToken) {
  const qs = guestToken ? `?g=${encodeURIComponent(guestToken)}` : ''
  const { page } = await request(`/data/public/invite/${encodeURIComponent(slug)}${qs}`)
  return page
}

export async function submitRsvp(slug, payload) {
  return request(`/data/public/invite/${encodeURIComponent(slug)}/rsvp`, {
    method: 'POST',
    body: payload,
  })
}

// ── Pagamentos ───────────────────────────────────────────────────

// Convidado (público, autenticado pelo token pessoal).
export async function getGuestPayment(slug, guestToken) {
  const qs = guestToken ? `?g=${encodeURIComponent(guestToken)}` : ''
  const { payment } = await request(`/data/public/invite/${encodeURIComponent(slug)}/payment${qs}`)
  return payment
}

export async function initiatePayment(slug, guestToken, method) {
  const qs = guestToken ? `?g=${encodeURIComponent(guestToken)}` : ''
  const { payment } = await request(`/data/public/invite/${encodeURIComponent(slug)}/payment${qs}`, {
    method: 'POST',
    body: { method },
  })
  return payment
}

export async function uploadReceipt(slug, guestToken, file) {
  const qs = guestToken ? `?g=${encodeURIComponent(guestToken)}` : ''
  const form = new FormData()
  form.append('file', file)
  const res = await fetch(`/data/public/invite/${encodeURIComponent(slug)}/payment/receipt${qs}`, {
    method: 'POST',
    credentials: 'include',
    body: form,
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || 'Falha ao carregar o comprovativo.')
  return data.payment
}

// Organizador (autenticado).
export async function listInvitePayments(id) {
  const { payments } = await request(`/data/invites/${id}/payments`)
  return payments
}

export async function validatePayment(paymentId) {
  const { payment } = await request(`/data/invites/payments/${paymentId}/validate`, { method: 'POST' })
  return payment
}

export async function rejectPayment(paymentId) {
  const { payment } = await request(`/data/invites/payments/${paymentId}/reject`, { method: 'POST' })
  return payment
}

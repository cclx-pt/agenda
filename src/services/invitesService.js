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

// ── Comunicações operacionais por email ────────────────────────
export async function listInviteCampaigns(inviteId) {
  const { campaigns } = await request(`/data/invites/${inviteId}/campaigns`)
  return campaigns
}

export async function createInviteCampaign(inviteId, payload) {
  const { campaign } = await request(`/data/invites/${inviteId}/campaigns`, { method: 'POST', body: payload })
  return campaign
}

export async function updateInviteCampaign(inviteId, campaignId, payload) {
  const { campaign } = await request(`/data/invites/${inviteId}/campaigns/${campaignId}`, { method: 'PUT', body: payload })
  return campaign
}

export async function deleteInviteCampaign(inviteId, campaignId) {
  await request(`/data/invites/${inviteId}/campaigns/${campaignId}`, { method: 'DELETE' })
}

export async function previewInviteCampaignAudience(inviteId, audience) {
  const { audience: result } = await request(`/data/invites/${inviteId}/campaigns/audience-preview`, { method: 'POST', body: audience })
  return result
}

export async function testInviteCampaign(inviteId, campaignId, email, name = '') {
  const { result } = await request(`/data/invites/${inviteId}/campaigns/${campaignId}/test`, { method: 'POST', body: { email, name } })
  return result
}

export async function sendInviteCampaign(inviteId, campaignId) {
  const { campaign } = await request(`/data/invites/${inviteId}/campaigns/${campaignId}/send`, { method: 'POST' })
  return campaign
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

export async function resendInviteGuestTicket(inviteId, guestId) {
  await request(`/data/invites/${inviteId}/guests/${guestId}/resend-email`, { method: 'POST' })
}

export async function deleteInviteGuest(inviteId, guestId) {
  await request(`/data/invites/${inviteId}/guests/${guestId}`, { method: 'DELETE' })
}

// Marca o reembolso de uma inscrição como concluído (organizador).
export async function markInviteGuestRefunded(inviteId, guestId) {
  const { guest } = await request(`/data/invites/${inviteId}/guests/${guestId}/refunded`, { method: 'POST' })
  return guest
}

// ── Check-in (organizador) ──────────────────────────────
export async function checkinLookup(inviteId, code) {
  const { result } = await request(`/data/invites/${inviteId}/checkin/lookup?code=${encodeURIComponent(code)}`)
  return result
}

export async function acceptCheckin(inviteId, guestId, on = true) {
  const { guest } = await request(`/data/invites/${inviteId}/checkin/${guestId}`, { method: 'POST', body: { on } })
  return guest
}

// Link de check-in móvel (organizador): obter/criar e rodar (revoga o antigo).
export async function getCheckinLink(inviteId) {
  const { link } = await request(`/data/invites/${inviteId}/checkin/link`)
  return link
}

export async function regenerateCheckinLink(inviteId) {
  const { link } = await request(`/data/invites/${inviteId}/checkin/link/regenerate`, { method: 'POST' })
  return link
}

// Link de Self Follow-up: totais agregados, protegido por token revogável.
export async function getFollowupLink(inviteId) {
  const { link } = await request(`/data/invites/${inviteId}/follow-up/link`)
  return link
}

export async function regenerateFollowupLink(inviteId) {
  const { link } = await request(`/data/invites/${inviteId}/follow-up/link/regenerate`, { method: 'POST' })
  return link
}

export async function publicFollowupStats(slug, token) {
  const { stats } = await request(
    `/data/public/invite/${encodeURIComponent(slug)}/follow-up/stats?k=${encodeURIComponent(token)}`
  )
  return stats
}

// ── Check-in móvel público (autenticado pelo token do link ?k=) ──
export async function publicCheckinContext(slug, token) {
  const { context } = await request(
    `/data/public/invite/${encodeURIComponent(slug)}/checkin/context?k=${encodeURIComponent(token)}`
  )
  return context
}

export async function publicCheckinLookup(slug, token, code) {
  const { result } = await request(
    `/data/public/invite/${encodeURIComponent(slug)}/checkin/lookup?k=${encodeURIComponent(token)}&code=${encodeURIComponent(code)}`
  )
  return result
}

export async function publicAcceptCheckin(slug, token, guestId, on = true) {
  const { guest } = await request(
    `/data/public/invite/${encodeURIComponent(slug)}/checkin/${guestId}?k=${encodeURIComponent(token)}`,
    { method: 'POST', body: { on } }
  )
  return guest
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

// ── Auto-gestão da inscrição (código de reserva + senha) ─────────

export async function inviteManageLogin(slug, code, password) {
  const { manage } = await request(`/data/public/invite/${encodeURIComponent(slug)}/manage`, {
    method: 'POST',
    body: { code, password },
  })
  return manage
}

export async function inviteManageCancel(slug, code, password) {
  const { manage } = await request(`/data/public/invite/${encodeURIComponent(slug)}/manage/cancel`, {
    method: 'POST',
    body: { code, password },
  })
  return manage
}

export async function inviteManageRefund(slug, code, password) {
  const { manage } = await request(`/data/public/invite/${encodeURIComponent(slug)}/manage/refund`, {
    method: 'POST',
    body: { code, password },
  })
  return manage
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

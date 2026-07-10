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

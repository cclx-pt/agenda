// Clientes HTTP para semear/limpar dados e exercitar os endpoints reais dos
// convites. Usam o APIRequestContext do Playwright (partilha o mesmo servidor
// Express que o browser). Setup/teardown por HTTP evita o problema de dois
// contextos (browser vs node) e testa o backend a sério.
import { blocksWithForm } from './data.js'

// Garante 2xx e, em caso de erro, mostra o corpo (mensagem de domínio) para
// diagnósticos claros nos relatórios.
async function ok(res, label) {
  if (!res.ok()) {
    let body
    try {
      body = JSON.stringify(await res.json())
    } catch {
      body = await res.text().catch(() => '')
    }
    throw new Error(`${label} falhou: HTTP ${res.status()} ${body}`)
  }
  return res
}

// ── API de gestão (autenticada como admin) ───────────────────────
export class AdminApi {
  constructor(ctx) {
    this.ctx = ctx
    // Recursos criados por este cliente → limpos no teardown do fixture.
    this.created = { invites: [], events: [] }
  }

  async createInvite(overrides = {}) {
    const body = {
      registrationMode: 'internal',
      rsvpEnabled: true,
      costType: 'gratuito',
      ...overrides,
    }
    const res = await ok(await this.ctx.post('/data/invites', { data: body }), 'createInvite')
    const invite = (await res.json()).invite
    this.created.invites.push(invite.id)
    return invite
  }

  async updateInvite(id, body) {
    const res = await ok(await this.ctx.put(`/data/invites/${id}`, { data: body }), 'updateInvite')
    return (await res.json()).invite
  }

  // Substitui os blocos, injetando o formulário RSVP fornecido no bloco `rsvp`.
  async setForm(id, fields) {
    const res = await ok(
      await this.ctx.put(`/data/invites/${id}/blocks`, { data: { blocks: blocksWithForm(fields) } }),
      'setForm'
    )
    return (await res.json()).invite
  }

  async setBlocks(id, blocks) {
    const res = await ok(await this.ctx.put(`/data/invites/${id}/blocks`, { data: { blocks } }), 'setBlocks')
    return (await res.json()).invite
  }

  async saveTickets(id, tickets) {
    const res = await ok(await this.ctx.put(`/data/invites/${id}/tickets`, { data: { tickets } }), 'saveTickets')
    return (await res.json()).tickets
  }

  async publish(id) {
    const res = await ok(await this.ctx.post(`/data/invites/${id}/publish`), 'publish')
    return (await res.json()).invite
  }

  async setStatus(id, status) {
    const res = await ok(await this.ctx.post(`/data/invites/${id}/status`, { data: { status } }), 'setStatus')
    return (await res.json()).invite
  }

  async getInvite(id) {
    const res = await ok(await this.ctx.get(`/data/invites/${id}`), 'getInvite')
    return (await res.json()).invite
  }

  async listInvites() {
    const res = await ok(await this.ctx.get('/data/invites'), 'listInvites')
    return (await res.json()).invites
  }

  async listGuests(id) {
    const res = await ok(await this.ctx.get(`/data/invites/${id}/guests`), 'listGuests')
    return (await res.json()).guests
  }

  async listPayments(id) {
    const res = await ok(await this.ctx.get(`/data/invites/${id}/payments`), 'listPayments')
    return (await res.json()).payments
  }

  async validatePayment(paymentId) {
    const res = await ok(await this.ctx.post(`/data/invites/payments/${paymentId}/validate`), 'validatePayment')
    return (await res.json()).payment
  }

  async rejectPayment(paymentId) {
    const res = await ok(await this.ctx.post(`/data/invites/payments/${paymentId}/reject`), 'rejectPayment')
    return (await res.json()).payment
  }

  async deleteInvite(id) {
    return this.ctx.delete(`/data/invites/${id}`).catch(() => {})
  }

  // Cria um evento publicado e futuro (admin auto-publica ao submeter) — usado no
  // teste da regra 1 evento ↔ 1 convite.
  async createEvent(overrides = {}) {
    const start = new Date()
    start.setDate(start.getDate() + 30)
    start.setHours(19, 0, 0, 0)
    const end = new Date(start.getTime() + 2 * 60 * 60 * 1000)
    const body = {
      title: overrides.title,
      community: 'Sede',
      category: 'evento',
      startDatetime: start.toISOString(),
      endDatetime: end.toISOString(),
      allDay: false,
      submit: true,
      ...overrides,
    }
    const res = await ok(await this.ctx.post('/data/events', { data: body }), 'createEvent')
    const json = await res.json()
    const event = json.event || json
    if (event?.id) this.created.events.push(event.id)
    return event
  }

  async deleteEvent(id) {
    return this.ctx.delete(`/data/events/${id}`).catch(() => {})
  }

  // Semente completa: convite interno + formulário + bilhetes + publicado.
  // opts: { title, tickets, fields, capacity, waitlistEnabled, rsvpStart, rsvpDeadline, publish=true, invite:{...} }
  async seedPublishedInvite(opts = {}) {
    const { title, tickets, fields, publish = true, ...inviteExtra } = opts
    const invite = await this.createInvite({ title, ...inviteExtra })
    if (fields) await this.setForm(invite.id, fields)
    let savedTickets = []
    if (tickets && tickets.length) savedTickets = await this.saveTickets(invite.id, tickets)
    if (publish) await this.publish(invite.id)
    // Relê para obter slug/estado finais + bilhetes com id.
    const fresh = await this.getInvite(invite.id)
    return { ...fresh, savedTickets }
  }

  async cleanup() {
    for (const id of this.created.invites) await this.deleteInvite(id)
    for (const id of this.created.events) await this.deleteEvent(id)
    this.created.invites = []
    this.created.events = []
  }
}

// ── API pública (sem sessão — como um convidado) ─────────────────
export class PublicApi {
  constructor(ctx) {
    this.ctx = ctx
  }

  // GET da página pública; devolve { status, page } sem lançar (para testar 404/410).
  async getPage(slug, token) {
    const q = token ? `?g=${encodeURIComponent(token)}` : ''
    const res = await this.ctx.get(`/data/public/invite/${encodeURIComponent(slug)}${q}`)
    let page = null
    try {
      page = (await res.json()).page
    } catch {
      /* corpo não-JSON */
    }
    return { status: res.status(), page }
  }

  // Submete uma inscrição; devolve { status, body }.
  async submitRsvp(slug, data) {
    const res = await this.ctx.post(`/data/public/invite/${encodeURIComponent(slug)}/rsvp`, { data })
    let body = null
    try {
      body = await res.json()
    } catch {
      /* corpo não-JSON */
    }
    return { status: res.status(), body }
  }

  async initiatePayment(slug, token, method) {
    const res = await this.ctx.post(
      `/data/public/invite/${encodeURIComponent(slug)}/payment?g=${encodeURIComponent(token)}`,
      { data: { method } }
    )
    let body = null
    try {
      body = await res.json()
    } catch {
      /* corpo não-JSON */
    }
    return { status: res.status(), body }
  }

  // Carrega um comprovativo (PNG mínimo em memória).
  async uploadReceipt(slug, token, { name = 'receipt.png', mime = 'image/png', buffer } = {}) {
    const res = await this.ctx.post(
      `/data/public/invite/${encodeURIComponent(slug)}/payment/receipt?g=${encodeURIComponent(token)}`,
      { multipart: { file: { name, mimeType: mime, buffer: buffer || TINY_PNG } } }
    )
    let body = null
    try {
      body = await res.json()
    } catch {
      /* corpo não-JSON */
    }
    return { status: res.status(), body }
  }
}

// PNG 1×1 transparente (para o upload de comprovativo).
export const TINY_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64'
)

export { ok as assertOk }

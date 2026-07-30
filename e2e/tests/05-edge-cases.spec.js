// Fluxo 5 — Casos-limite e regras: capacidade/lista de espera, janelas de
// inscrição, modos de inscrição, 1 evento ↔ 1 convite, permissões e slugs
// inválidos. Determinísticos → exercitados sobretudo ao nível da API.
import { test, expect } from '../fixtures.js'
import { uniqueTitle, isoInDays } from '../helpers/data.js'

test.describe('Casos-limite e regras', () => {
  test('capacidade esgotada sem lista de espera → 409', async ({ admin, pub }) => {
    const invite = await admin.seedPublishedInvite({
      title: uniqueTitle('edge-capacity'),
      capacity: 1,
      waitlistEnabled: false,
    })
    const first = await pub.submitRsvp(invite.slug, { name: 'Primeiro', attend: true })
    expect(first.status).toBe(201)
    expect(first.body.status.rsvpState).toBe('confirmed')

    const second = await pub.submitRsvp(invite.slug, { name: 'Segundo', attend: true })
    expect(second.status).toBe(409)
  })

  test('capacidade esgotada com lista de espera → waitlisted', async ({ admin, pub }) => {
    const invite = await admin.seedPublishedInvite({
      title: uniqueTitle('edge-waitlist'),
      capacity: 1,
      waitlistEnabled: true,
    })
    const first = await pub.submitRsvp(invite.slug, { name: 'Confirmado', attend: true })
    expect(first.body.status.rsvpState).toBe('confirmed')

    const second = await pub.submitRsvp(invite.slug, { name: 'Espera', attend: true, acceptWaitlist: true })
    expect(second.status).toBe(201)
    expect(second.body.status.rsvpState).toBe('waitlisted')
  })

  test('prazo de inscrição terminado → 410', async ({ admin, pub }) => {
    const invite = await admin.seedPublishedInvite({
      title: uniqueTitle('edge-deadline'),
      rsvpDeadline: isoInDays(-1),
    })
    const res = await pub.submitRsvp(invite.slug, { name: 'Atrasado', attend: true })
    expect(res.status).toBe(410)
  })

  test('inscrições ainda não abriram → 409', async ({ admin, pub }) => {
    const invite = await admin.seedPublishedInvite({
      title: uniqueTitle('edge-notopen'),
      rsvpStartDatetime: isoInDays(3),
    })
    const res = await pub.submitRsvp(invite.slug, { name: 'Cedo', attend: true })
    expect(res.status).toBe(409)
  })

  test('inscrições fechadas (rsvpEnabled=false) → 409', async ({ admin, pub }) => {
    const invite = await admin.createInvite({ title: uniqueTitle('edge-disabled'), rsvpEnabled: false })
    await admin.publish(invite.id)
    const fresh = await admin.getInvite(invite.id)
    const res = await pub.submitRsvp(fresh.slug, { name: 'Fechado', attend: true })
    expect(res.status).toBe(409)
  })

  test('modo de inscrição externo/nenhum não aceita inscrições internas → 409', async ({ admin, pub }) => {
    const external = await admin.createInvite({
      title: uniqueTitle('edge-external'),
      registrationMode: 'external',
      registrationUrl: 'https://example.com/inscricao',
    })
    await admin.publish(external.id)
    const ext = await admin.getInvite(external.id)
    const extRes = await pub.submitRsvp(ext.slug, { name: 'X', attend: true })
    expect(extRes.status).toBe(409)

    const none = await admin.createInvite({ title: uniqueTitle('edge-none'), registrationMode: 'none' })
    await admin.publish(none.id)
    const noneInv = await admin.getInvite(none.id)
    const noneRes = await pub.submitRsvp(noneInv.slug, { name: 'Y', attend: true })
    expect(noneRes.status).toBe(409)
  })

  test('slug desconhecido → 404 (página e inscrição)', async ({ pub }) => {
    const slug = 'e2e-inexistente-xyz-000'
    const page = await pub.getPage(slug)
    expect(page.status).toBe(404)
    const rsvp = await pub.submitRsvp(slug, { name: 'Ninguém', attend: true })
    expect(rsvp.status).toBe(404)
  })

  test('rascunho não é público nem aceita inscrições → 404', async ({ admin, pub }) => {
    const invite = await admin.createInvite({ title: uniqueTitle('edge-draft') }) // sem publicar
    const page = await pub.getPage(invite.slug)
    expect(page.status).toBe(404)
    const rsvp = await pub.submitRsvp(invite.slug, { name: 'Cedo', attend: true })
    expect(rsvp.status).toBe(404)
  })

  test('1 evento ↔ 1 convite: segundo convite no mesmo evento → 409', async ({ admin }) => {
    const event = await admin.createEvent({ title: uniqueTitle('edge-event') })
    expect(event?.id, 'o evento devia ter sido criado').toBeTruthy()

    // 1.º convite liga-se ao evento.
    await admin.createInvite({ title: uniqueTitle('edge-1to1-a'), eventId: event.id })

    // 2.º convite no MESMO evento é rejeitado (regra 1:1).
    const res = await admin.ctx.post('/data/invites', {
      data: {
        title: uniqueTitle('edge-1to1-b'),
        registrationMode: 'internal',
        rsvpEnabled: true,
        costType: 'gratuito',
        eventId: event.id,
      },
    })
    expect(res.status()).toBe(409)
  })

  test('permissões: a API de gestão exige sessão (401)', async ({ request }) => {
    const list = await request.get('/data/invites')
    expect(list.status()).toBe(401)

    const create = await request.post('/data/invites', { data: { title: 'E2E não autorizado' } })
    expect(create.status()).toBe(401)
  })
})

// Ligação evento ↔ convite: o formulário de evento mostra (só leitura) o convite
// interno associado. Validamos o endpoint que alimenta o output e o render na UI.
import { test, expect } from '../fixtures.js'
import { uniqueTitle, ADMIN_STATE } from '../helpers/data.js'

test.describe('Ligação evento ↔ convite (formulário de evento)', () => {
  test('devolve o convite associado a um evento (nome + slug + estado)', async ({ admin }) => {
    const event = await admin.createEvent({ title: uniqueTitle('link-event') })
    const invite = await admin.createInvite({ title: uniqueTitle('link-invite'), eventId: event.id })

    const res = await admin.ctx.get(`/data/events/${event.id}/invite`)
    expect(res.ok(), `HTTP ${res.status()}`).toBeTruthy()
    const { invite: linked } = await res.json()

    expect(linked, 'o evento devia ter um convite associado').toBeTruthy()
    expect(linked.id).toBe(invite.id)
    expect(linked.slug).toBe(invite.slug)
    expect(linked.title).toBe(invite.title)
    expect(linked.registrationMode).toBe('internal')
    // Só expõe o resumo (sem campos internos de gestão).
    expect(Object.keys(linked).sort()).toEqual(
      ['id', 'registrationMode', 'rsvpEnabled', 'slug', 'status', 'title'].sort()
    )
  })

  test('um evento sem convite devolve null', async ({ admin }) => {
    const event = await admin.createEvent({ title: uniqueTitle('link-none') })
    const res = await admin.ctx.get(`/data/events/${event.id}/invite`)
    expect(res.ok()).toBeTruthy()
    const { invite } = await res.json()
    expect(invite).toBeNull()
  })

  test('sem sessão o endpoint exige autenticação (401)', async ({ request }) => {
    const res = await request.get('/data/events/11111111-1111-1111-1111-111111111111/invite')
    expect(res.status()).toBe(401)
  })

  test('o evento público expõe o slug do convite publicado (link no cartão)', async ({ admin, pub }) => {
    const event = await admin.createEvent({ title: uniqueTitle('card-event') })
    const invite = await admin.seedPublishedInvite({ title: uniqueTitle('card-invite'), eventId: event.id })

    const res = await pub.ctx.get('/data/events/public')
    expect(res.ok(), `HTTP ${res.status()}`).toBeTruthy()
    const { events } = await res.json()
    const found = (events || []).find((e) => e.id === event.id)
    expect(found, 'o evento publicado devia constar no payload público').toBeTruthy()
    // O cartão do evento usa este slug para ligar à landing page do convite.
    expect(found.inviteSlug).toBe(invite.slug)
  })

  test.describe('no formulário de evento (UI)', () => {
    test.use({ storageState: ADMIN_STATE })

    test('a aba Inscrição mostra o convite associado (nome + link), só leitura', async ({ page, admin }) => {
      // Evento publicado + convite interno associado (publicado).
      const event = await admin.createEvent({ title: uniqueTitle('link-ui-event') })
      const invite = await admin.seedPublishedInvite({ title: uniqueTitle('link-ui-invite'), eventId: event.id })

      // Abre a gestão de eventos e edita o evento semeado.
      await page.goto('/')
      const eventos = page.getByRole('button', { name: 'Eventos' })
      await expect(eventos).toBeVisible({ timeout: 20_000 })
      await eventos.click()

      const row = page.getByRole('listitem').filter({ hasText: event.title })
      await expect(row).toBeVisible()
      await row.getByRole('button', { name: 'Editar' }).click()

      // Aba "Inscrições e convites".
      await page.getByRole('tab', { name: 'Inscrições e convites' }).click()

      // Output só de leitura: nome do convite + link para a página pública.
      await expect(page.getByText(invite.title)).toBeVisible()
      const openLink = page.getByRole('link', { name: 'Ver página do convite' })
      await expect(openLink).toBeVisible()
      await expect(openLink).toHaveAttribute('href', `/invite/${invite.slug}`)
      // Link para a página de inscrição.
      await expect(page.getByRole('link', { name: 'Página de inscrição' })).toHaveAttribute(
        'href',
        `/invite/${invite.slug}/inscricao`
      )
    })
  })
})

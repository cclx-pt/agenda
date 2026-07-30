// Fluxo 2 — Inscrições públicas (convidado, sem sessão): todos os tipos de
// bilhete + formulário. UI para os caminhos principais, API para validar o estado.
import { test, expect } from '../fixtures.js'
import { uniqueTitle, MINIMAL_FORM } from '../helpers/data.js'

test.describe('Inscrições públicas (inscrições)', () => {
  test('convite grátis sem bilhete: preenche o formulário e recebe confirmação', async ({ page, admin }) => {
    const invite = await admin.seedPublishedInvite({
      title: uniqueTitle('reg-free'),
      fields: MINIMAL_FORM,
    })

    await page.goto(`/invite/${invite.slug}/inscricao`)
    await expect(page.getByRole('button', { name: 'Confirmar inscrição' })).toBeVisible()

    const name = 'Maria E2E'
    await page.locator('#f_name input').fill(name)
    await page.locator('#f_email input').fill('maria.e2e@example.com')
    await page.locator('#f_phone input').fill('912345678')
    await page.getByRole('button', { name: 'Confirmar inscrição' }).click()

    // O formulário é substituído pelo cartão de confirmação (estilo email).
    await expect(page.getByRole('heading', { name: 'Inscrição registada' })).toBeVisible()
    await expect(page.getByText(`Olá ${name},`)).toBeVisible()
    await expect(page.getByText('Código do bilhete:')).toBeVisible()

    // Fonte de verdade: a inscrição foi persistida como confirmada.
    const guests = await admin.listGuests(invite.id)
    const guest = guests.find((g) => g.name === name)
    expect(guest, 'a inscrição devia existir na BD').toBeTruthy()
    expect(guest.rsvpState).toBe('confirmed')
    expect(guest.paymentState).toBe('not_applicable')
  })

  test('bilhete Pago: seleciona o bilhete e fica a aguardar pagamento', async ({ page, admin }) => {
    const invite = await admin.seedPublishedInvite({
      title: uniqueTitle('reg-paid'),
      fields: MINIMAL_FORM,
      tickets: [
        { name: 'Bilhete Grátis', kind: 'gratis' },
        { name: 'Bilhete Pago', kind: 'individual', price: 15, paymentMethod: 'transferencia' },
      ],
    })
    const paid = invite.savedTickets.find((t) => t.name === 'Bilhete Pago')
    expect(paid?.id).toBeTruthy()

    await page.goto(`/invite/${invite.slug}/inscricao`)
    // Com bilhetes, a inscrição começa pela escolha do bilhete (cartões).
    await page.getByRole('button', { name: /Bilhete Pago/ }).click()
    await expect(page.getByRole('button', { name: 'Confirmar inscrição' })).toBeVisible()

    const name = 'Pedro Pago'
    await page.locator('#f_name input').fill(name)
    await page.locator('#f_email input').fill('pedro.pago@example.com')
    await page.locator('#f_phone input').fill('913000111')
    await page.getByRole('button', { name: 'Confirmar inscrição' }).click()

    await expect(page.getByRole('heading', { name: 'Inscrição registada' })).toBeVisible()
    await expect(page.getByText(`Olá ${name},`)).toBeVisible()

    const guests = await admin.listGuests(invite.id)
    const guest = guests.find((g) => g.name === name)
    expect(guest, 'a inscrição paga devia existir').toBeTruthy()
    expect(guest.ticketId).toBe(paid.id)
    expect(guest.rsvpState).toBe('confirmed')
    expect(guest.paymentState).toBe('pending')
  })

  test('bilhete de Grupo: regista membros (API) e conta as pessoas', async ({ admin, pub }) => {
    const invite = await admin.seedPublishedInvite({
      title: uniqueTitle('reg-group'),
      fields: MINIMAL_FORM,
      tickets: [{ name: 'Família', kind: 'grupo', partyType: 'group', groupSize: 4 }],
    })
    const group = invite.savedTickets.find((t) => t.name === 'Família')
    expect(group?.id).toBeTruthy()

    const { status, body } = await pub.submitRsvp(invite.slug, {
      name: 'Grupo Silva',
      email: 'grupo.silva@example.com',
      phone: '914222333',
      guestsCount: 3,
      attend: true,
      ticketId: group.id,
      extra: {
        membros: [
          { nome: 'Ana', idade: 34 },
          { nome: 'Rui', idade: 36 },
          { nome: 'Zé', idade: 8 },
        ],
        tipoInscricao: 'Grupo',
      },
    })

    expect(status).toBe(201)
    expect(body.status.rsvpState).toBe('confirmed')

    const guests = await admin.listGuests(invite.id)
    const guest = guests.find((g) => g.name === 'Grupo Silva')
    expect(guest, 'a inscrição de grupo devia existir').toBeTruthy()
    expect(guest.ticketId).toBe(group.id)
    expect(Array.isArray(guest.extra?.membros)).toBeTruthy()
    expect(guest.extra.membros).toHaveLength(3)
  })

  test('bilhete de Doação: inscreve sem bloquear em pagamento', async ({ admin, pub }) => {
    const invite = await admin.seedPublishedInvite({
      title: uniqueTitle('reg-donation'),
      fields: MINIMAL_FORM,
      tickets: [{ name: 'Doação', kind: 'voluntaria', price: 5 }],
    })
    const donation = invite.savedTickets.find((t) => t.name === 'Doação')
    expect(donation?.id).toBeTruthy()

    const { status, body } = await pub.submitRsvp(invite.slug, {
      name: 'Doador E2E',
      email: 'doador.e2e@example.com',
      attend: true,
      ticketId: donation.id,
      extra: { donationAmount: 20 },
    })

    expect(status).toBe(201)
    expect(body.status.rsvpState).toBe('confirmed')
    // Doação confirma logo (não fica "pending" à espera de pagamento).
    expect(body.status.paymentState).toBe('not_applicable')
  })
})

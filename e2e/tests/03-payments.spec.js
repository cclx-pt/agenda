// Fluxo 3 — Pagamentos + validação do organizador. Bilhete Pago → inscrição
// (pendente) → convidado inicia pagamento e carrega comprovativo → organizador
// valida → estado "pago". O ciclo é exercitado nos endpoints reais e confirmado
// na página pública do convidado.
import { test, expect } from '../fixtures.js'
import { uniqueTitle, MINIMAL_FORM } from '../helpers/data.js'

test.describe('Pagamentos e validação (organizador)', () => {
  test('transferência: comprovativo → validação → pago', async ({ page, admin, pub }) => {
    const invite = await admin.seedPublishedInvite({
      title: uniqueTitle('pay-transfer'),
      costType: 'pago',
      fields: MINIMAL_FORM,
      tickets: [
        { name: 'Bilhete Pago', kind: 'individual', price: 20, paymentMethod: 'transferencia', paymentMethods: ['transferencia'] },
      ],
    })
    const paid = invite.savedTickets.find((t) => t.name === 'Bilhete Pago')
    expect(paid?.id).toBeTruthy()

    // 1) Inscrição no bilhete pago → fica pendente de pagamento.
    const reg = await pub.submitRsvp(invite.slug, {
      name: 'Paga E2E',
      email: 'paga.e2e@example.com',
      phone: '915444333',
      attend: true,
      ticketId: paid.id,
    })
    expect(reg.status).toBe(201)
    const token = reg.body.token
    expect(token, 'token pessoal da inscrição').toBeTruthy()
    expect(reg.body.status.paymentState).toBe('pending')

    // 2) Convidado inicia o pagamento (escolhe transferência).
    const initiated = await pub.initiatePayment(invite.slug, token, 'transferencia')
    expect(initiated.status, `initiate devolveu ${JSON.stringify(initiated.body)}`).toBeLessThan(400)

    // 3) Convidado carrega o comprovativo → fica "em validação".
    const receipt = await pub.uploadReceipt(invite.slug, token)
    expect(receipt.status).toBe(201)
    expect(['awaiting_validation', 'paid']).toContain(receipt.body.payment.status)

    // 4) Organizador valida o pagamento.
    const payments = await admin.listPayments(invite.id)
    expect(payments.length, 'devia existir 1 pagamento').toBeGreaterThan(0)
    const validated = await admin.validatePayment(payments[0].id)
    expect(validated.status).toBe('paid')

    // 5) Estado do convidado reflete "pago" (API + UI).
    const afterPay = await pub.getPage(invite.slug, token)
    expect(afterPay.page.guestStatus.paymentState).toBe('paid')

    await page.goto(`/invite/${invite.slug}/inscricao?g=${token}`)
    await expect(page.getByText(/Inscrição e pagamento confirmados/i)).toBeVisible()
  })

  test('organizador pode rejeitar um comprovativo', async ({ admin, pub }) => {
    const invite = await admin.seedPublishedInvite({
      title: uniqueTitle('pay-reject'),
      costType: 'pago',
      fields: MINIMAL_FORM,
      tickets: [
        { name: 'Bilhete Pago', kind: 'individual', price: 12, paymentMethod: 'transferencia', paymentMethods: ['transferencia'] },
      ],
    })
    const paid = invite.savedTickets.find((t) => t.name === 'Bilhete Pago')

    const reg = await pub.submitRsvp(invite.slug, {
      name: 'Rejeita E2E',
      email: 'rejeita.e2e@example.com',
      attend: true,
      ticketId: paid.id,
    })
    const token = reg.body.token
    await pub.initiatePayment(invite.slug, token, 'transferencia')
    await pub.uploadReceipt(invite.slug, token)

    const payments = await admin.listPayments(invite.id)
    expect(payments.length).toBeGreaterThan(0)
    const rejected = await admin.rejectPayment(payments[0].id)
    // Rejeitar não deixa o pagamento "pago".
    expect(rejected.status).not.toBe('paid')
  })
})

// Fluxo 4 — Confirmação: cartão de estado, código do bilhete, QR e dados da
// inscrição na página pessoal (?g=token), incluindo o convidado que regressa.
import { test, expect } from '../fixtures.js'
import { uniqueTitle, MINIMAL_FORM } from '../helpers/data.js'

test.describe('Confirmação, QR e página de estado', () => {
  test('a página pessoal mostra estado, código, QR e dados', async ({ page, admin, pub }) => {
    const invite = await admin.seedPublishedInvite({
      title: uniqueTitle('confirm'),
      fields: MINIMAL_FORM,
    })

    const name = 'Joana Confirmada'
    const email = 'joana.confirmada@example.com'
    const reg = await pub.submitRsvp(invite.slug, { name, email, phone: '916555444', attend: true })
    expect(reg.status).toBe(201)
    const token = reg.body.token
    const code = reg.body.status.code
    expect(token).toBeTruthy()
    expect(code, 'código do bilhete').toBeTruthy()

    // Página pessoal da inscrição.
    await page.goto(`/invite/${invite.slug}/inscricao?g=${token}`)

    // Cartão de confirmação estilo email.
    await expect(page.getByRole('heading', { name: 'Inscrição registada' })).toBeVisible()
    // Estado (convidado grátis confirmado) + saudação com o nome.
    await expect(page.getByText(/presença está confirmada/i)).toBeVisible()
    await expect(page.getByText(`Olá ${name},`)).toBeVisible()
    // Código do bilhete + o valor real.
    await expect(page.getByText('Código do bilhete:')).toBeVisible()
    await expect(page.getByText(code)).toBeVisible()
    // QR do bilhete.
    await expect(page.getByRole('img', { name: 'QR do bilhete' })).toBeVisible()
    // Dados da inscrição: o email surge na secção de dados (único).
    await expect(page.getByText(email)).toBeVisible()
  })

  test('o convidado que regressa vê o estado tanto no /inscricao como na landing', async ({ page, admin, pub }) => {
    const invite = await admin.seedPublishedInvite({
      title: uniqueTitle('confirm-return'),
      fields: MINIMAL_FORM,
    })
    const reg = await pub.submitRsvp(invite.slug, {
      name: 'Regressa E2E',
      email: 'regressa.e2e@example.com',
      attend: true,
    })
    const token = reg.body.token

    // Regressa à página de inscrição pelo link pessoal → continua a ver a confirmação.
    await page.goto(`/invite/${invite.slug}/inscricao?g=${token}`)
    await expect(page.getByRole('heading', { name: 'Inscrição registada' })).toBeVisible()

    // Na landing, o cartão de estado aparece no topo para o convidado com token.
    await page.goto(`/invite/${invite.slug}?g=${token}`)
    await expect(page.getByText(/presença está confirmada/i).first()).toBeVisible()
  })
})

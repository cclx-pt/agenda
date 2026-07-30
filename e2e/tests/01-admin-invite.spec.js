// Fluxo 1 — Admin: criar, configurar e publicar convites (pela UI de gestão).
// Usa o estado de sessão do admin (projeto "setup"). Semeia bilhetes por API
// quando precisa de um convite publicável, mas as AÇÕES-chave (criar, publicar)
// são feitas na interface.
import { test, expect } from '../fixtures.js'
import { uniqueTitle, MINIMAL_FORM, ADMIN_STATE } from '../helpers/data.js'

test.use({ storageState: ADMIN_STATE })

// Abre o painel de gestão de convites a partir da barra superior.
async function openInvitesAdmin(page) {
  await page.goto('/')
  const openBtn = page.getByRole('button', { name: 'Convites' })
  await expect(openBtn).toBeVisible({ timeout: 20_000 })
  await openBtn.click()
  await expect(page.getByRole('button', { name: 'Novo convite' })).toBeVisible()
}

test.describe('Admin — gestão de convites', () => {
  test('cria um convite pela UI e o rascunho não é público', async ({ page, admin, pub }) => {
    const title = uniqueTitle('admin-create')
    await openInvitesAdmin(page)

    // "Novo convite" pede o título via window.prompt.
    page.once('dialog', (dialog) => dialog.accept(title))
    await page.getByRole('button', { name: 'Novo convite' }).click()

    // O editor abre: botão Publicar + link Abrir para a página pública.
    await expect(page.getByRole('button', { name: 'Publicar' })).toBeVisible()
    const abrir = page.getByRole('link', { name: 'Abrir' })
    const href = await abrir.getAttribute('href')
    const slug = /\/invite\/([^/?#]+)/.exec(href || '')?.[1]
    expect(slug, `slug extraído do link Abrir (${href})`).toBeTruthy()

    // Rastrear para limpeza (foi criado pela UI, não pelo AdminApi).
    const list = await admin.listInvites()
    const mine = list.find((i) => i.title === title)
    expect(mine, 'o convite criado devia aparecer na lista').toBeTruthy()
    admin.created.invites.push(mine.id)

    // Proteção de rascunho (FR): a página pública devolve 404 enquanto não publicado.
    const draft = await pub.getPage(slug)
    expect(draft.status).toBe(404)
  })

  test('publica um convite pela UI e a página pública fica ativa', async ({ page, admin, pub }) => {
    const title = uniqueTitle('admin-publish')
    // Semeia um convite interno já configurado (formulário + bilhete), por publicar.
    const invite = await admin.createInvite({ title })
    await admin.setForm(invite.id, MINIMAL_FORM)
    await admin.saveTickets(invite.id, [{ name: 'Entrada Grátis', kind: 'gratis' }])

    await openInvitesAdmin(page)

    // Abre o editor da linha correspondente ao título único.
    const row = page.getByRole('listitem').filter({ hasText: title })
    await expect(row).toBeVisible()
    await row.getByRole('button', { name: 'Editar' }).click()

    // Publica a partir do editor.
    const publicar = page.getByRole('button', { name: 'Publicar' })
    await expect(publicar).toBeVisible()
    await publicar.click()

    // Estado passa a Publicado → o botão muda para "Fechar inscrições".
    await expect(page.getByRole('button', { name: 'Fechar inscrições' })).toBeVisible()

    // A página pública fica acessível e a inscrição abre.
    const res = await pub.getPage(invite.slug)
    expect(res.status).toBe(200)

    await page.goto(`/invite/${invite.slug}/inscricao`)
    // Com um bilhete configurado, a inscrição começa pelo seletor de bilhete.
    await expect(page.getByText('Escolhe o teu bilhete')).toBeVisible()
  })
})

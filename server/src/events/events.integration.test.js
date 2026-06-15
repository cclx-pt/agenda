/**
 * Teste de integração do fluxo SoR de eventos (corre contra a BD local).
 *
 * Valida o requisito da igreja responsável de ponta a ponta na camada de
 * serviço + repositório + PostgreSQL:
 *   criar evento com igreja → submeter → aprovar → aparecer no feed público.
 *
 * Usa o runner nativo do Node (`node --test`), sem dependências extra.
 * Cada evento criado é removido no fim (cleanup), e a pool é fechada.
 */
import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { pool } from '../db/pool.js'
import * as service from './service.js'
import * as privacyTagsService from '../privacyTags/service.js'

// Ids dos eventos criados durante os testes (removidos no final).
const createdIds = []
let admin

async function createTracked(input) {
  const evt = await service.create(admin, input)
  createdIds.push(evt.id)
  return evt
}

before(async () => {
  const { rows } = await pool.query(
    "SELECT id, email, name, role FROM users WHERE role = 'admin' AND is_active = TRUE LIMIT 1"
  )
  assert.ok(rows[0], 'É necessário um utilizador admin ativo (corre db:seed primeiro).')
  admin = { sub: rows[0].id, role: rows[0].role, email: rows[0].email, name: rows[0].name, canViewPrivate: true }
})

after(async () => {
  for (const id of createdIds) {
    await pool.query('DELETE FROM events WHERE id = $1', [id])
  }
  await pool.end()
})

describe('Fluxo SoR — igreja responsável', () => {
  it('cria um evento com a igreja "Porto" e publica-o no feed público', async () => {
    const created = await createTracked({
      title: '[TESTE] Igreja Porto',
      description: 'Evento de teste de integração.',
      startDatetime: '2026-06-20T19:00:00.000Z',
      endDatetime: '2026-06-20T21:00:00.000Z',
      community: 'Porto',
      category: 'evento',
      isPrivate: false,
    })
    assert.equal(created.community, 'Porto')
    assert.equal(created.status, 'rascunho')

    const submitted = await service.submit(admin, created.id)
    assert.equal(submitted.status, 'pendente')

    const approved = await service.approve(admin, created.id)
    assert.equal(approved.status, 'publicado')
    assert.equal(approved.community, 'Porto')

    const publicos = await service.listPublic()
    const encontrado = publicos.find((e) => e.id === created.id)
    assert.ok(encontrado, 'O evento publicado deve aparecer no feed público.')
    assert.equal(encontrado.community, 'Porto')
  })

  it('usa a Sede como igreja por omissão quando nenhuma é indicada', async () => {
    const created = await createTracked({
      title: '[TESTE] Sem igreja',
      startDatetime: '2026-06-21T10:00:00.000Z',
      category: 'evento',
    })
    assert.equal(created.community, 'Sede')
  })

  it('preserva nomes de igreja com vários termos (ex.: "Caldas Da Rainha")', async () => {
    const created = await createTracked({
      title: '[TESTE] Igreja Caldas',
      startDatetime: '2026-06-22T18:00:00.000Z',
      community: 'Caldas Da Rainha',
      category: 'evento',
    })
    assert.equal(created.community, 'Caldas Da Rainha')

    const lido = await service.getForUser(admin, created.id)
    assert.equal(lido.community, 'Caldas Da Rainha')
  })

  it('não inclui eventos privados no feed público', async () => {
    const created = await createTracked({
      title: '[TESTE] Privado Almada',
      startDatetime: '2026-06-23T20:00:00.000Z',
      community: 'Almada',
      category: 'evento',
      isPrivate: true,
    })
    await service.submit(admin, created.id)
    await service.approve(admin, created.id)

    const publicos = await service.listPublic()
    const encontrado = publicos.find((e) => e.id === created.id)
    assert.equal(encontrado, undefined, 'Eventos privados não devem surgir no feed público.')
  })
})

describe('Âmbito por igreja — criação e aprovação', () => {
  // O acesso por igreja é negado antes de qualquer escrita na BD, por isso
  // basta reutilizar o id do admin para manter a chave estrangeira válida.
  it('um editor sem acesso à igreja não pode criar evento nessa igreja', async () => {
    const editorPorto = { sub: admin.sub, role: 'editor', churches: ['Porto'], canViewPrivate: false }
    await assert.rejects(
      () =>
        service.create(editorPorto, {
          title: '[TESTE] Editor sem acesso',
          startDatetime: '2026-06-24T19:00:00.000Z',
          community: 'Almada',
          category: 'evento',
        }),
      /Sem acesso a esta igreja/
    )
  })

  it('aprovador/editor só moderam pedidos das igrejas a que têm acesso', async () => {
    const created = await createTracked({
      title: '[TESTE] Pendente Almada',
      startDatetime: '2026-06-25T19:00:00.000Z',
      community: 'Almada',
      category: 'evento',
    })
    await service.submit(admin, created.id)

    const aprovadorPorto = { sub: admin.sub, role: 'aprovador', churches: ['Porto'], canViewPrivate: false }
    const editorPorto = { sub: admin.sub, role: 'editor', churches: ['Porto'], canViewPrivate: false }

    await assert.rejects(
      () => service.approve(aprovadorPorto, created.id),
      /Sem acesso a esta igreja/
    )
    await assert.rejects(
      () => service.reject(editorPorto, created.id, 'fora do âmbito'),
      /Sem acesso a esta igreja/
    )

    // O evento continua pendente e o admin (sem âmbito) consegue aprovar.
    const approved = await service.approve(admin, created.id)
    assert.equal(approved.status, 'publicado')
  })
})

describe('Etiquetas de privacidade — visibilidade no calendário', () => {
  const tagA = `[TESTE] Tag A ${Date.now()}`
  const tagB = `[TESTE] Tag B ${Date.now()}`
  let tagAId
  let tagBId
  let privateEventId

  before(async () => {
    const a = await privacyTagsService.create({ name: tagA })
    const b = await privacyTagsService.create({ name: tagB })
    tagAId = a.id
    tagBId = b.id

    // Evento privado com a etiqueta A, publicado.
    const evt = await service.create(admin, {
      title: '[TESTE] Privado com etiqueta A',
      startDatetime: '2026-07-01T19:00:00.000Z',
      community: 'Sede',
      category: 'evento',
      isPrivate: true,
      privacyTag: tagA,
    })
    privateEventId = evt.id
    createdIds.push(evt.id)
    await service.submit(admin, evt.id)
    await service.approve(admin, evt.id)
  })

  after(async () => {
    // Remove primeiro o evento (a etiqueta não pode ser eliminada se em uso).
    await pool.query('DELETE FROM events WHERE id = $1', [privateEventId])
    await privacyTagsService.remove(tagAId)
    await privacyTagsService.remove(tagBId)
  })

  const range = { from: '2026-07-01', to: '2026-07-02' }

  it('utilizador sem etiquetas (todas) vê o evento privado', async () => {
    const user = { sub: admin.sub, role: 'visitante', canViewPrivate: true, privacyTags: null }
    const events = await service.listCalendar(user, range)
    assert.ok(events.some((e) => e.id === privateEventId), 'Deve ver o evento privado.')
  })

  it('utilizador com a etiqueta certa vê o evento privado', async () => {
    const user = { sub: admin.sub, role: 'visitante', canViewPrivate: true, privacyTags: [tagA] }
    const events = await service.listCalendar(user, range)
    assert.ok(events.some((e) => e.id === privateEventId), 'Deve ver o evento da sua etiqueta.')
  })

  it('utilizador com outra etiqueta NÃO vê o evento privado', async () => {
    const user = { sub: admin.sub, role: 'visitante', canViewPrivate: true, privacyTags: [tagB] }
    const events = await service.listCalendar(user, range)
    assert.ok(!events.some((e) => e.id === privateEventId), 'Não deve ver o evento de outra etiqueta.')
  })

  it('etiqueta em uso não pode ser eliminada', async () => {
    await assert.rejects(() => privacyTagsService.remove(tagAId), /em uso/)
  })
})

describe('Recorrência — séries de eventos', () => {
  let seriesId

  after(async () => {
    if (seriesId) await pool.query('DELETE FROM events WHERE series_id = $1', [seriesId])
  })

  it('cria uma série semanal com número fixo de ocorrências', async () => {
    const first = await service.create(admin, {
      title: '[TESTE] Série semanal',
      startDatetime: '2026-08-03T18:00:00.000Z',
      endDatetime: '2026-08-03T19:00:00.000Z',
      community: 'Sede',
      category: 'evento',
      recurrence: { frequency: 'weekly', interval: 1, end: { type: 'count', count: 4 } },
    })
    assert.ok(first.seriesId, 'A ocorrência deve ter series_id.')
    seriesId = first.seriesId

    const { rows } = await pool.query('SELECT start_datetime FROM events WHERE series_id = $1 ORDER BY start_datetime', [seriesId])
    assert.equal(rows.length, 4, 'Devem existir 4 ocorrências.')
    // Espaçadas 7 dias entre a 1.ª e a 2.ª.
    const diff = new Date(rows[1].start_datetime) - new Date(rows[0].start_datetime)
    assert.equal(diff, 7 * 24 * 60 * 60 * 1000, 'Ocorrências semanais devem distar 7 dias.')
  })

  it('atualiza os campos partilhados de toda a série (scope=series)', async () => {
    const { rows } = await pool.query('SELECT id FROM events WHERE series_id = $1 ORDER BY start_datetime', [seriesId])
    const targetId = rows[0].id
    await service.update(
      admin,
      targetId,
      {
        title: '[TESTE] Série semanal (renomeada)',
        startDatetime: '2026-08-03T18:00:00.000Z',
        endDatetime: '2026-08-03T19:00:00.000Z',
        community: 'Sede',
        category: 'evento',
      },
      { scope: 'series' }
    )
    const { rows: after } = await pool.query('SELECT DISTINCT title FROM events WHERE series_id = $1', [seriesId])
    assert.equal(after.length, 1, 'Todas as ocorrências devem partilhar o mesmo título.')
    assert.equal(after[0].title, '[TESTE] Série semanal (renomeada)')
  })

  it('elimina toda a série (scope=series)', async () => {
    const { rows } = await pool.query('SELECT id FROM events WHERE series_id = $1 ORDER BY start_datetime', [seriesId])
    await service.remove(admin, rows[0].id, { scope: 'series' })
    const { rows: remaining } = await pool.query('SELECT id FROM events WHERE series_id = $1', [seriesId])
    assert.equal(remaining.length, 0, 'A série deve ficar vazia após eliminação.')
    seriesId = null
  })
})


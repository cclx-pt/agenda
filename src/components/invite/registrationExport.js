// Kit de exportação para dashboard de IA (por convite): gera os dados das
// inscrições, um JSON Schema e um ficheiro Markdown de instruções para construir
// um dashboard num assistente (ChatGPT/Claude). O schema e o Markdown respeitam o
// ESQUEMA INDIVIDUAL de cada convite (os campos do formulário RSVP desse convite,
// reconstruídos a partir dos snapshots guardados em cada inscrição).
// Módulo puro (sem componentes/React) → reutilizável e testável.

import { mergeFormSchemas, SYSTEM_KEYS } from './inviteFormFields'
import { inscricaoSituacao, SITUACAO_LABEL, classifyGuestPeople, registrationChurch } from './inviteUtils'

const bt = String.fromCharCode(96) // crase, para blocos de código no Markdown
const fence = bt + bt + bt

// Chaves do `extra` já representadas em colunas próprias (não repetir em respostas).
const DEDICATED_KEYS = new Set(['tipoInscricao', 'membros', 'donationAmount', 'numCriancas', 'criancas', 'grupo', 'paymentMethod'])

// Slug do convite para nomear os ficheiros descarregados.
export function inviteExportSlug(invite) {
  if (invite?.slug) return invite.slug
  const base = String(invite?.title || 'convite')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
  return base || 'convite'
}

// Campos do formulário específicos do convite (não-sistema, não-secção), a partir
// dos snapshots das inscrições + eventuais chaves órfãs presentes nas respostas.
export function inviteFormColumns(guests) {
  const list = Array.isArray(guests) ? guests : []
  const snapshots = list.map((g) => g.schemaSnapshot).filter(Array.isArray)
  const merged = mergeFormSchemas([], snapshots)
  const fields = merged
    .filter((f) => f && f.key && f.type !== 'section' && f.type !== 'document' && !SYSTEM_KEYS.includes(f.key))
    .map((f) => ({ key: f.key, label: f.label || f.key, type: f.type || 'text', options: Array.isArray(f.options) ? f.options : null }))
  const known = new Set(fields.map((f) => f.key))
  const seen = new Set()
  for (const g of list) {
    for (const [k, v] of Object.entries(g.extra || {})) {
      if (known.has(k) || DEDICATED_KEYS.has(k) || seen.has(k) || v == null || v === '') continue
      seen.add(k)
      fields.push({
        key: k,
        label: k,
        type: Array.isArray(v) ? 'multiselect' : typeof v === 'boolean' ? 'checkbox' : typeof v === 'number' ? 'number' : 'text',
        options: null,
      })
    }
  }
  return fields
}

// Uma inscrição achatada: colunas padrão + as respostas específicas do convite.
export function buildDataset(guests, fields) {
  const cols = Array.isArray(fields) ? fields : []
  return (Array.isArray(guests) ? guests : []).map((g) => {
    const p = classifyGuestPeople(g, g.ticket)
    const sit = inscricaoSituacao(g)
    const respostas = {}
    for (const f of cols) {
      const v = g.extra ? g.extra[f.key] : undefined
      respostas[f.key] = v === undefined ? null : v
    }
    return {
      codigo: g.code || null,
      nome: g.name || null,
      email: g.email || null,
      telefone: g.phone || null,
      igreja: registrationChurch(g),
      bilhete: g.ticket?.name || null,
      bilheteTipo: g.ticket?.kind || null,
      situacao: sit,
      situacaoLabel: SITUACAO_LABEL[sit] || sit,
      pagamento: g.paymentState || 'not_applicable',
      adultos: p.adultos,
      jovens: p.jovens,
      criancas: p.criancas,
      totalPessoas: p.total,
      lugares: g.guestsCount ?? 1,
      tipoInscricao: g.extra?.tipoInscricao ?? null,
      donativo: g.extra?.donationAmount ?? null,
      membros: Array.isArray(g.extra?.membros) ? g.extra.membros : [],
      dataInscricao: g.respondedAt || g.createdAt || null,
      checkIn: g.checkedInAt || null,
      notas: g.adminNotes || null,
      respostas,
    }
  })
}

// Tipo JSON Schema para um tipo de campo do formulário.
function jsonType(fieldType) {
  if (fieldType === 'number') return { type: ['number', 'null'] }
  if (fieldType === 'checkbox') return { type: ['boolean', 'null'] }
  if (fieldType === 'multiselect') return { type: ['array', 'null'], items: { type: 'string' } }
  if (fieldType === 'children') return { type: ['array', 'null'], items: { type: 'object' } }
  return { type: ['string', 'null'] }
}

// JSON Schema (draft 2020-12) de uma inscrição deste convite, incluindo as
// respostas específicas do formulário.
export function buildJsonSchema(invite, fields) {
  const cols = Array.isArray(fields) ? fields : []
  const respostasProps = {}
  for (const f of cols) {
    const base = jsonType(f.type)
    base.description = f.label || f.key
    if (Array.isArray(f.options) && f.options.length) {
      if (f.type === 'multiselect') base.items = { type: 'string', enum: f.options }
      else base.enum = [...f.options, null]
    }
    respostasProps[f.key] = base
  }
  return {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    $id: `cclx-inscricoes-${inviteExportSlug(invite)}`,
    title: `Inscrições — ${invite?.title || 'Convite'}`,
    description: `Estrutura de cada inscrição do convite "${invite?.title || ''}" da Agenda CCLX. O objeto "respostas" contém as perguntas específicas deste convite.`,
    type: 'array',
    items: {
      type: 'object',
      properties: {
        codigo: { type: ['string', 'null'], description: 'Código único do bilhete/inscrição.' },
        nome: { type: ['string', 'null'], description: 'Nome do inscrito.' },
        email: { type: ['string', 'null'], description: 'Email do inscrito.' },
        telefone: { type: ['string', 'null'], description: 'Telemóvel do inscrito.' },
        igreja: { type: 'string', description: 'Igreja/comunidade do inscrito.' },
        bilhete: { type: ['string', 'null'], description: 'Nome do bilhete escolhido.' },
        bilheteTipo: { type: ['string', 'null'], description: 'Tipo do bilhete: individual | gratis | voluntaria | grupo.' },
        situacao: { type: 'string', enum: Object.keys(SITUACAO_LABEL), description: 'Estado combinado da inscrição.' },
        situacaoLabel: { type: 'string', description: 'Rótulo legível do estado.' },
        pagamento: { type: 'string', description: 'Estado do pagamento (ou not_applicable).' },
        adultos: { type: 'integer' },
        jovens: { type: 'integer' },
        criancas: { type: 'integer' },
        totalPessoas: { type: 'integer', description: 'Total de pessoas nesta inscrição.' },
        lugares: { type: 'integer', description: 'Número de lugares reservados.' },
        tipoInscricao: { type: ['string', 'null'], description: 'Individual / Família / Grupo.' },
        donativo: { type: ['number', 'string', 'null'], description: 'Valor de doação (bilhete de doação).' },
        membros: { type: 'array', items: { type: 'object' }, description: 'Comitiva (nome/idade/…), em bilhetes de grupo/família.' },
        dataInscricao: { type: ['string', 'null'], format: 'date-time' },
        checkIn: { type: ['string', 'null'], format: 'date-time', description: 'Momento do check-in (ou nulo).' },
        notas: { type: ['string', 'null'], description: 'Notas internas da organização.' },
        respostas: {
          type: 'object',
          description: 'Respostas ao formulário específico deste convite (chave → valor).',
          properties: respostasProps,
        },
      },
      required: ['codigo', 'situacao'],
    },
  }
}

// Documentação dos estados combinados da inscrição.
const SITUATION_DOC = [
  ['confirmada', 'inscrição válida/confirmada (conta como pessoas presentes)'],
  ['comprovativo', 'bilhete pago à espera do comprovativo de pagamento'],
  ['validacao', 'comprovativo submetido, a aguardar validação do organizador'],
  ['espera', 'em lista de espera (capacidade esgotada)'],
  ['pendente', 'inscrição iniciada mas ainda não confirmada'],
  ['expirada', 'pagamento expirado'],
  ['cancelada', 'inscrição cancelada'],
  ['reembolso', 'reembolso pedido'],
  ['reembolsado', 'reembolso concluído'],
]

function mdCell(v) {
  return String(v ?? '').replace(/\|/g, '\\|').replace(/\r?\n/g, ' ').trim()
}
function cleanLabel(v) {
  return String(v ?? '').replace(/[:?*]+\s*$/g, '').trim()
}
function formatWhen(start, end) {
  const fmt = (v) => {
    if (!v) return null
    const d = new Date(v)
    if (Number.isNaN(d.getTime())) return null
    return d.toLocaleDateString('pt-PT', { day: '2-digit', month: 'long', year: 'numeric' })
  }
  const a = fmt(start)
  const b = fmt(end)
  if (!a) return null
  return !b || a === b ? a : `${a} – ${b}`
}

// Markdown com instruções para construir o dashboard num motor de IA. Inclui o
// dicionário de dados (com as perguntas específicas deste convite) e um prompt
// pronto a colar.
export function buildDashboardMarkdown(invite, guests, fields) {
  const cols = Array.isArray(fields) ? fields : []
  const list = Array.isArray(guests) ? guests : []
  const slug = inviteExportSlug(invite)
  const dataFile = `${slug}-inscricoes.json`
  const schemaFile = `${slug}-schema.json`
  const title = invite?.title || 'Convite'
  const when = formatWhen(invite?.startDatetime, invite?.endDatetime)
  const chartFields = cols.filter((f) => ['select', 'radio', 'multiselect', 'number'].includes(f.type))

  const lines = [
    `# Dashboard de gestão de inscrições — ${title}`,
    '',
    '> Instruções para gerar um dashboard interativo a partir dos dados **deste** convite',
    '> com um assistente de IA (ChatGPT ou Claude). Anexa os dois ficheiros indicados e',
    '> cola o prompt do fim.',
    '',
    '## Contexto',
    `- Convite: **${title}**`,
    invite?.community ? `- Igreja / comunidade: ${invite.community}` : null,
    when ? `- Datas do evento: ${when}` : null,
    invite?.location ? `- Local: ${invite.location}` : null,
    invite?.status ? `- Estado do convite: ${invite.status}` : null,
    `- Total de inscrições exportadas: ${list.length}`,
    `- Ficheiros: ${dataFile} (dados) · ${schemaFile} (JSON Schema)`,
    '',
    '> AVISO RGPD: os dados incluem nomes, emails e telemóveis. Trata o ficheiro como',
    '> confidencial — não o publiques nem o carregues em serviços não fiáveis.',
    '',
    '## Estrutura dos dados',
    'O ficheiro de dados é um array; cada elemento é uma inscrição com estes campos padrão:',
    '',
    '| Campo | Tipo | Descrição |',
    '| --- | --- | --- |',
    '| codigo | string | Código único do bilhete/inscrição |',
    '| nome, email, telefone | string | Contactos do inscrito |',
    '| igreja | string | Comunidade/igreja do inscrito |',
    '| bilhete, bilheteTipo | string | Bilhete escolhido e o seu tipo |',
    '| situacao | enum | Estado combinado (ver abaixo) |',
    '| pagamento | string | Estado do pagamento |',
    '| adultos, jovens, criancas, totalPessoas | inteiro | Composição de pessoas |',
    '| lugares | inteiro | Nº de lugares da inscrição |',
    '| tipoInscricao | string | Individual / Família / Grupo |',
    '| donativo | número | Valor de doação (bilhete de doação) |',
    '| membros | array | Comitiva (nome/idade/…) em grupo/família |',
    '| dataInscricao, checkIn | data-hora | Momento da inscrição e do check-in |',
    '| notas | string | Notas internas da organização |',
    '| respostas | objeto | Respostas ao formulário deste convite (ver abaixo) |',
    '',
    '### Respostas do formulário (específicas deste convite)',
    cols.length
      ? 'Dentro de "respostas", as chaves específicas deste convite são:'
      : 'Este convite não tem campos de formulário adicionais além dos contactos.',
    ...(cols.length
      ? [
          '',
          '| respostas.&lt;chave&gt; | Pergunta | Tipo | Opções |',
          '| --- | --- | --- | --- |',
          ...cols.map((f) => `| ${mdCell(f.key)} | ${mdCell(f.label)} | ${f.type} | ${mdCell((f.options || []).join(', '))} |`),
        ]
      : []),
    '',
    '## Estados da inscrição (campo situacao)',
    ...SITUATION_DOC.map(([k, d]) => `- ${bt}${k}${bt} — ${d}`),
    '',
    '## Dashboard sugerido',
    '**KPIs:** total de inscrições; confirmadas; pendentes de comprovativo; a aguardar validação; lista de espera; canceladas; reembolsos; total de pessoas (adultos/jovens/crianças); taxa de check-in.',
    '',
    '**Gráficos:**',
    '- Inscrições ao longo do tempo (linha/área) — campo dataInscricao',
    '- Inscrições por igreja (barras) — campo igreja',
    '- Inscrições por bilhete (donut) — campo bilhete',
    '- Estado das inscrições (donut) — campo situacao',
    '- Estado dos pagamentos (barras) — campo pagamento',
    '- Composição de pessoas (barras: adultos / jovens / crianças)',
    ...chartFields.map((f) => `- Distribuição por “${cleanLabel(f.label)}” — campo respostas.${f.key}`),
    '',
    '**Filtros:** igreja, bilhete, situação, pagamento e intervalo de datas (recalculam KPIs e gráficos).',
    '',
    '**Tabela:** lista pesquisável com nome, igreja, bilhete, situação, pagamento, pessoas e data.',
    '',
    '## Prompt para o ChatGPT / Claude',
    fence,
    'És um analista de dados da igreja CCLX. Anexei dois ficheiros:',
    `- ${dataFile}: array de inscrições de um evento (uma inscrição por elemento).`,
    `- ${schemaFile}: o JSON Schema que descreve cada inscrição.`,
    '',
    'Constrói um DASHBOARD de gestão de inscrições num único ficheiro HTML autónomo',
    '(Chart.js via CDN + JavaScript simples, sem backend). Requisitos:',
    '- Cartões de KPI: total, confirmadas, pendentes de comprovativo, a aguardar validação,',
    '  lista de espera, canceladas, reembolsos, total de pessoas e taxa de check-in.',
    '- Gráficos: inscrições por dia, por igreja, por bilhete, estado das inscrições,',
    '  estado dos pagamentos e composição de pessoas (adultos/jovens/crianças).',
    chartFields.length
      ? `- Gráficos adicionais a partir das respostas: ${chartFields.map((f) => cleanLabel(f.label)).join('; ')}.`
      : null,
    '- Filtros interativos por igreja, bilhete, situação, pagamento e intervalo de datas.',
    '- Tabela pesquisável das inscrições.',
    '- Usa apenas os campos do schema; o objeto "respostas" tem as perguntas específicas deste convite.',
    '- Interface em português de Portugal. Trata os dados como confidenciais.',
    'Devolve o HTML completo, pronto a abrir no browser.',
    fence,
    '',
  ].filter((l) => l !== null)

  return lines.join('\n')
}

// Constrói o kit completo (dados + schema + markdown + nomes de ficheiro) de um convite.
export function buildRegistrationKit(invite, guests) {
  const list = Array.isArray(guests) ? guests : []
  const fields = inviteFormColumns(list)
  const slug = inviteExportSlug(invite)
  return {
    slug,
    fields,
    data: buildDataset(list, fields),
    schema: buildJsonSchema(invite, fields),
    markdown: buildDashboardMarkdown(invite, list, fields),
    dataFile: `${slug}-inscricoes.json`,
    schemaFile: `${slug}-schema.json`,
    mdFile: `${slug}-dashboard-instrucoes.md`,
  }
}

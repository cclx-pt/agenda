function registrationChurch(guest) {
  const extra = guest?.extra || {}
  const fields = Array.isArray(guest?.schemaSnapshot) ? guest.schemaSnapshot : []
  const communityField = fields.find((field) =>
    String(field?.label || '').trim().toLocaleLowerCase('pt-PT').startsWith('cclx - comunidade')
  )
  const schemaValue = communityField?.key ? extra[communityField.key] : null
  if (schemaValue != null && String(schemaValue).trim()) return String(schemaValue).trim()
  if (extra.comunidade === 'CCLX' && extra.outra_igreja) return String(extra.outra_igreja).trim()
  if (extra.comunidade === 'Outro' && extra.outra_igreja_qual) return String(extra.outra_igreja_qual).trim()
  return extra.comunidade ? String(extra.comunidade).trim() : 'Sem igreja'
}

function classifyAge(age, ticket) {
  const value = Number(age)
  const known = age != null && age !== '' && !Number.isNaN(value)
  if (!known) return 'adultos'
  const childMax = ticket?.childMaxAge ?? null
  const adultMin = ticket?.adultMinAge ?? null
  if (childMax == null && adultMin == null) return value < 11 ? 'criancas' : 'adultos'
  if (childMax != null && value <= childMax) return 'criancas'
  if (adultMin != null && value >= adultMin) return 'adultos'
  if (childMax != null && adultMin == null) return 'adultos'
  if (adultMin != null && childMax == null) return 'criancas'
  return 'jovens'
}

function classifyPeople(guest, ticket) {
  const extra = guest?.extra || {}
  const members = Array.isArray(extra.membros) ? extra.membros : []
  const children = Array.isArray(extra.criancas) ? extra.criancas : []
  const result = { adultos: 0, jovens: 0, criancas: 0, total: 0 }
  if (members.length) {
    for (const member of members) result[classifyAge(member?.idade, ticket)] += 1
  } else {
    result.adultos += 1
  }
  result.criancas += children.length
  if (!children.length && !members.length && Number(extra.numCriancas) > 0) {
    result.criancas += Math.floor(Number(extra.numCriancas))
  }
  result.total = result.adultos + result.jovens + result.criancas
  return result
}

function isConfirmed(guest) {
  const excludedPayments = ['pending', 'awaiting_validation', 'expired', 'refund_requested', 'refunded']
  return guest?.rsvpState === 'confirmed' && !excludedPayments.includes(guest?.paymentState)
}

function registrationSituation(guest) {
  const rsvp = guest?.rsvpState
  const payment = guest?.paymentState
  if (payment === 'refunded') return 'reembolsado'
  if (payment === 'refund_requested') return 'reembolso'
  if (rsvp === 'declined' || rsvp === 'cancelled') return 'cancelada'
  if (rsvp === 'waitlisted') return 'espera'
  if (rsvp === 'confirmed') {
    if (payment === 'pending') return 'comprovativo'
    if (payment === 'awaiting_validation') return 'validacao'
    if (payment === 'expired') return 'expirada'
    return 'confirmada'
  }
  return 'pendente'
}

function registrationDay(value) {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Lisbon',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}

function addCounts(target, counts) {
  target.registrations += 1
  target.adultos += counts.adultos
  target.jovens += counts.jovens
  target.criancas += counts.criancas
  target.people += counts.total
}

function emptyBreakdown(name) {
  return { name, registrations: 0, people: 0, adultos: 0, jovens: 0, criancas: 0 }
}

export function buildFollowupStats(guests, tickets = []) {
  const ticketById = new Map(tickets.map((ticket) => [ticket.id, ticket]))
  const people = { adultos: 0, jovens: 0, criancas: 0, total: 0 }
  const situations = {
    confirmada: 0,
    comprovativo: 0,
    validacao: 0,
    espera: 0,
    cancelada: 0,
    reembolso: 0,
    reembolsado: 0,
    expirada: 0,
    pendente: 0,
  }
  const churches = new Map()
  const ticketStats = new Map()
  const days = new Map()

  for (const guest of guests) {
    situations[registrationSituation(guest)] += 1
    if (!isConfirmed(guest)) continue
    const ticket = ticketById.get(guest.ticketId)
    const counts = classifyPeople(guest, ticket)
    people.adultos += counts.adultos
    people.jovens += counts.jovens
    people.criancas += counts.criancas
    people.total += counts.total
    const church = registrationChurch(guest)
    const current = churches.get(church) || emptyBreakdown(church)
    addCounts(current, counts)
    churches.set(church, current)

    const ticketName = ticket?.name || 'Sem bilhete'
    const currentTicket = ticketStats.get(ticketName) || emptyBreakdown(ticketName)
    addCounts(currentTicket, counts)
    ticketStats.set(ticketName, currentTicket)

    const day = registrationDay(guest.createdAt)
    if (day) {
      const currentDay = days.get(day) || { date: day, registrations: 0, people: 0, adultos: 0, jovens: 0, criancas: 0 }
      addCounts(currentDay, counts)
      days.set(day, currentDay)
    }
  }

  return {
    registrations: guests.length,
    confirmedRegistrations: situations.confirmada,
    situations,
    people,
    byChurch: [...churches.values()].sort(
      (a, b) => b.registrations - a.registrations || a.name.localeCompare(b.name, 'pt')
    ),
    byTicket: [...ticketStats.values()].sort(
      (a, b) => b.registrations - a.registrations || a.name.localeCompare(b.name, 'pt')
    ),
    byDay: [...days.values()].sort((a, b) => a.date.localeCompare(b.date)),
  }
}
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

export function buildFollowupStats(guests, tickets = []) {
  const ticketById = new Map(tickets.map((ticket) => [ticket.id, ticket]))
  const people = { adultos: 0, jovens: 0, criancas: 0, total: 0 }
  const churches = new Map()

  for (const guest of guests) {
    if (!isConfirmed(guest)) continue
    const counts = classifyPeople(guest, ticketById.get(guest.ticketId))
    people.adultos += counts.adultos
    people.jovens += counts.jovens
    people.criancas += counts.criancas
    people.total += counts.total
    const church = registrationChurch(guest)
    const current = churches.get(church) || { name: church, registrations: 0, people: 0 }
    current.registrations += 1
    current.people += counts.total
    churches.set(church, current)
  }

  return {
    registrations: guests.length,
    confirmedRegistrations: [...guests].filter(isConfirmed).length,
    people,
    byChurch: [...churches.values()].sort(
      (a, b) => b.registrations - a.registrations || a.name.localeCompare(b.name, 'pt')
    ),
  }
}
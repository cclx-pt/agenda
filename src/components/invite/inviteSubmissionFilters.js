import { classifyGuestPeople, inscricaoSituacao, registrationChurch } from './inviteUtils'

export function publishedInvites(invites) {
  return (invites || []).filter((invite) => invite.status === 'publicado')
}

export function filterInviteSubmissions(rows, filters) {
  const name = filters.name.trim().toLocaleLowerCase('pt-PT')
  const phone = filters.phone.replace(/\D/g, '')
  const email = filters.email.trim().toLocaleLowerCase('pt-PT')

  return (rows || []).filter((row) => {
    if (filters.invite && row.inviteId !== filters.invite) return false
    if (filters.church && registrationChurch(row) !== filters.church) return false
    if (filters.ticket && (row.ticket?.name || 'Sem bilhete') !== filters.ticket) return false
    if (filters.situacao && inscricaoSituacao(row) !== filters.situacao) return false
    if (filters.payment && (row.paymentState || 'not_applicable') !== filters.payment) return false
    if (filters.access === 'private' && !row.isPrivateRegistration) return false
    if (filters.access === 'public' && row.isPrivateRegistration) return false

    const people = classifyGuestPeople(row, row.ticket)
    if (filters.people === 'with-children' && people.criancas === 0) return false
    if (filters.people === 'without-children' && people.criancas > 0) return false

    if (name && !String(row.name || '').toLocaleLowerCase('pt-PT').includes(name)) return false
    if (phone && !String(row.phone || '').replace(/\D/g, '').includes(phone)) return false
    if (email && !String(row.email || '').toLocaleLowerCase('pt-PT').includes(email)) return false
    return true
  })
}

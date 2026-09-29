export const DEFAULT_INVITE_STATUS_FILTERS = ['publicado', 'rascunho']

export function inviteHasOpenRegistration(invite) {
  return invite?.status === 'publicado' &&
    invite?.registrationMode === 'internal' &&
    invite?.rsvpEnabled === true &&
    (invite?.spotsLeft == null || invite.spotsLeft > 0)
}

export function filterAdminInvites(invites, { statuses, registration = 'all', community = 'all' }) {
  const selectedStatuses = new Set(statuses)

  return (invites || []).filter((invite) => {
    if (!selectedStatuses.has(invite.status)) return false

    const registrationOpen = inviteHasOpenRegistration(invite)
    if (registration === 'open' && !registrationOpen) return false
    if (registration === 'closed' && registrationOpen) return false

    if (community === 'none') return !invite.community
    if (community !== 'all' && invite.community !== community) return false

    return true
  })
}

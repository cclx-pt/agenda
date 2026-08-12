export function eventDestination(event) {
  if (event.inviteSlug) return `/invite/${encodeURIComponent(event.inviteSlug)}`
  return event.registrationUrl || null
}

export function isUpcoming(event, now = new Date()) {
  if (event.endDatetime) {
    const endTime = Date.parse(event.endDatetime)
    return !Number.isNaN(endTime) && endTime >= now.getTime()
  }

  const endDate = event.endDate || event.date
  if (!endDate) return false
  const localToday = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  return endDate >= localToday
}

export function eventStartTime(event) {
  const value = event.startDatetime || (event.date ? `${event.date}T00:00:00` : '')
  const timestamp = Date.parse(value)
  return Number.isNaN(timestamp) ? Number.MAX_SAFE_INTEGER : timestamp
}

export function selectRegistrationEvents(events, now = new Date()) {
  return events
    .filter(
      (event) => event.includeInRegistrationPortal && isUpcoming(event, now) && eventDestination(event)
    )
    .sort((left, right) => eventStartTime(left) - eventStartTime(right))
}
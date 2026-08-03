export function uniqueLoopEvents(events) {
  const seen = new Set()
  return events.filter((event) => {
    const key = event.seriesId ? `series:${event.seriesId}` : `event:${event.id}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}
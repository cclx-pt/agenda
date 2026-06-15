import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fetchEvents } from '../services/apiService'
import { groupByDate } from '../utils/calendarHelpers'

export function useEvents({ from, to, includePrivate = false, includeDrafts = false } = {}) {
  const { data: events = [], isLoading: loading, error, refetch } = useQuery({
    queryKey: ['events', from, to, includePrivate, includeDrafts],
    queryFn: ({ signal }) => fetchEvents(from, to, { signal, includePrivate, includeDrafts }),
  })

  const eventsByDate = useMemo(() => groupByDate(events), [events])

  return {
    events,
    eventsByDate,
    loading,
    error: error?.message || null,
    reload: refetch,
  }
}

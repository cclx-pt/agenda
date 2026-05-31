import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fetchAllEvents } from '../services/apiService'
import { groupByDate } from '../utils/calendarHelpers'

export function useEvents() {
  const { data: events = [], isLoading: loading, error, refetch } = useQuery({
    queryKey: ['events'],
    queryFn: ({ signal }) => fetchAllEvents({ signal }),
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

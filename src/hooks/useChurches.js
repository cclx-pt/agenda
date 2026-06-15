import { useState, useEffect, useCallback } from 'react'
import * as eventsService from '../services/eventsService'

// Cache simples ao nível do módulo: as igrejas mudam pouco e são partilhadas
// por vários componentes (formulário de eventos, acesso de utilizadores, etc.).
let _cache = null
let _inflight = null
const _subscribers = new Set()

function notify() {
  for (const fn of _subscribers) fn(_cache)
}

async function fetchChurches() {
  if (_inflight) return _inflight
  _inflight = eventsService
    .listChurches()
    .then((churches) => {
      _cache = churches
      _inflight = null
      notify()
      return churches
    })
    .catch((err) => {
      _inflight = null
      throw err
    })
  return _inflight
}

/** Força o recarregamento da lista de igrejas em todos os subscritores. */
export function invalidateChurches() {
  _cache = null
  return fetchChurches().catch(() => {})
}

/**
 * useChurches — devolve a lista de igrejas da BD (partilhada/cacheada).
 * `churches` é um array de `{ id, name, externalId, address, postalCode }`.
 */
export function useChurches() {
  const [churches, setChurches] = useState(_cache ?? [])
  const [loading, setLoading] = useState(_cache === null)
  const [error, setError] = useState(null)

  useEffect(() => {
    const onChange = (list) => setChurches(list ?? [])
    _subscribers.add(onChange)
    if (_cache === null) {
      fetchChurches()
        .then(() => setLoading(false))
        .catch((err) => {
          setError(err.message)
          setLoading(false)
        })
    }
    return () => {
      _subscribers.delete(onChange)
    }
  }, [])

  const reload = useCallback(async () => {
    setLoading(true)
    try {
      await invalidateChurches()
      setError(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  return { churches, loading, error, reload }
}

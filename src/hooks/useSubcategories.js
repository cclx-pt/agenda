import { useState, useEffect, useCallback } from 'react'
import * as eventsService from '../services/eventsService'

// Cache simples ao nível do módulo: as subcategorias mudam pouco e são
// partilhadas por vários componentes (formulário de eventos, gestão, filtros).
let _cache = null
let _inflight = null
const _subscribers = new Set()

function notify() {
  for (const fn of _subscribers) fn(_cache)
}

async function fetchSubcategories() {
  if (_inflight) return _inflight
  _inflight = eventsService
    .listSubcategories()
    .then((subcategories) => {
      _cache = subcategories
      _inflight = null
      notify()
      return subcategories
    })
    .catch((err) => {
      _inflight = null
      throw err
    })
  return _inflight
}

/** Força o recarregamento da lista de subcategorias em todos os subscritores. */
export function invalidateSubcategories() {
  _cache = null
  return fetchSubcategories().catch(() => {})
}

/**
 * useSubcategories — devolve a lista de subcategorias da BD (partilhada/cacheada).
 * `subcategories` é um array de `{ id, name, sortOrder }`.
 */
export function useSubcategories() {
  const [subcategories, setSubcategories] = useState(_cache ?? [])
  const [loading, setLoading] = useState(_cache === null)
  const [error, setError] = useState(null)

  useEffect(() => {
    const onChange = (list) => setSubcategories(list ?? [])
    _subscribers.add(onChange)
    if (_cache === null) {
      fetchSubcategories()
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
      await invalidateSubcategories()
      setError(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  return { subcategories, loading, error, reload }
}

import { useState, useEffect, useCallback } from 'react'
import * as eventsService from '../services/eventsService'

// Cache simples ao nível do módulo: as categorias mudam pouco e são partilhadas
// por vários componentes (formulário de eventos, gestão de categorias, etc.).
let _cache = null
let _inflight = null
const _subscribers = new Set()

function notify() {
  for (const fn of _subscribers) fn(_cache)
}

async function fetchCategories() {
  if (_inflight) return _inflight
  _inflight = eventsService
    .listCategories()
    .then((categories) => {
      _cache = categories
      _inflight = null
      notify()
      return categories
    })
    .catch((err) => {
      _inflight = null
      throw err
    })
  return _inflight
}

/** Força o recarregamento da lista de categorias em todos os subscritores. */
export function invalidateCategories() {
  _cache = null
  return fetchCategories().catch(() => {})
}

/**
 * useCategories — devolve a lista de categorias da BD (partilhada/cacheada).
 * `categories` é um array de `{ id, slug, label, color, sortOrder }`.
 */
export function useCategories() {
  const [categories, setCategories] = useState(_cache ?? [])
  const [loading, setLoading] = useState(_cache === null)
  const [error, setError] = useState(null)

  useEffect(() => {
    const onChange = (list) => setCategories(list ?? [])
    _subscribers.add(onChange)
    if (_cache === null) {
      fetchCategories()
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
      await invalidateCategories()
      setError(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  return { categories, loading, error, reload }
}

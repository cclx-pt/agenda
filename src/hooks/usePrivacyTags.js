import { useState, useEffect, useCallback } from 'react'
import * as eventsService from '../services/eventsService'

// Cache simples ao nível do módulo: as etiquetas de privacidade mudam pouco e
// são partilhadas por vários componentes (formulário de eventos, gestão de
// etiquetas, configuração de utilizadores).
let _cache = null
let _inflight = null
const _subscribers = new Set()

function notify() {
  for (const fn of _subscribers) fn(_cache)
}

async function fetchPrivacyTags() {
  if (_inflight) return _inflight
  _inflight = eventsService
    .listPrivacyTags()
    .then((tags) => {
      _cache = tags
      _inflight = null
      notify()
      return tags
    })
    .catch((err) => {
      _inflight = null
      throw err
    })
  return _inflight
}

/** Força o recarregamento da lista de etiquetas em todos os subscritores. */
export function invalidatePrivacyTags() {
  _cache = null
  return fetchPrivacyTags().catch(() => {})
}

/**
 * usePrivacyTags — devolve a lista de etiquetas de privacidade da BD
 * (partilhada/cacheada). Cada etiqueta é `{ id, name, createdAt, updatedAt }`.
 */
export function usePrivacyTags() {
  const [privacyTags, setPrivacyTags] = useState(_cache ?? [])
  const [loading, setLoading] = useState(_cache === null)
  const [error, setError] = useState(null)

  useEffect(() => {
    const onChange = (list) => setPrivacyTags(list ?? [])
    _subscribers.add(onChange)
    if (_cache === null) {
      fetchPrivacyTags()
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
      await invalidatePrivacyTags()
      setError(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  return { privacyTags, loading, error, reload }
}

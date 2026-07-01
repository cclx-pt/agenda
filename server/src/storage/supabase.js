import { randomUUID } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import { config } from '../config.js'

// Cliente Supabase (inicialização tardia). Usado APENAS no backend, com a
// service role key — NUNCA exposta ao browser. Serve só o Storage (imagens
// de eventos); os dados continuam a passar pelo `pg`.
let client = null

function getClient() {
  if (client) return client
  const { url, serviceRoleKey } = config.supabase
  if (!url || !serviceRoleKey) return null
  client = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  return client
}

/** Indica se o Storage está configurado (URL + service role key presentes). */
export function isStorageConfigured() {
  return Boolean(config.supabase.url && config.supabase.serviceRoleKey)
}

// Garante (uma vez) que o bucket existe e é público — evita falhas de upload
// caso o bucket ainda não tenha sido criado no projeto Supabase.
let bucketReady = false
async function ensureBucket(supabase, bucket) {
  if (bucketReady) return
  const { data, error } = await supabase.storage.getBucket(bucket)
  if (error) console.warn('[storage] getBucket falhou:', error.message)
  if (!data) {
    const { error: createErr } = await supabase.storage.createBucket(bucket, { public: true })
    if (createErr && !/already exists|resource_already_exists/i.test(createErr.message || '')) {
      console.warn('[storage] createBucket falhou:', createErr.message)
    }
  }
  bucketReady = true
}

// Diagnóstico do Storage (cacheado 60s) — usado por /health/full para perceber
// se as credenciais/o bucket estão OK sem tentar um upload real.
let storageCheck = { at: 0, result: null }
export async function verifyStorage() {
  if (!isStorageConfigured()) return { ok: false, configured: false, error: null }
  const now = Date.now()
  if (storageCheck.result && now - storageCheck.at < 60_000) return storageCheck.result
  let result
  try {
    const supabase = getClient()
    const bucket = config.supabase.storageBucket
    const { error } = await supabase.storage.getBucket(bucket)
    result = error
      ? { ok: false, configured: true, error: error.message }
      : { ok: true, configured: true, error: null }
  } catch (e) {
    result = { ok: false, configured: true, error: e?.message ?? String(e) }
  }
  storageCheck = { at: now, result }
  return result
}

/**
 * Carrega um buffer de imagem para o bucket configurado e devolve o URL
 * público. Lança se o Storage não estiver configurado ou o upload falhar.
 */
export async function uploadImage(buffer, { ext, contentType }) {
  const supabase = getClient()
  if (!supabase) {
    throw new Error('Supabase Storage não está configurado.')
  }
  const bucket = config.supabase.storageBucket
  await ensureBucket(supabase, bucket)
  const objectName = `${randomUUID()}${ext}`
  const { error } = await supabase.storage.from(bucket).upload(objectName, buffer, {
    contentType,
    cacheControl: '3600',
    upsert: false,
  })
  if (error) {
    throw new Error(error.message || 'Falha ao carregar para o Supabase Storage.')
  }
  const { data } = supabase.storage.from(bucket).getPublicUrl(objectName)
  return data.publicUrl
}

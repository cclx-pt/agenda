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
  const { data } = await supabase.storage.getBucket(bucket)
  if (!data) {
    await supabase.storage.createBucket(bucket, { public: true }).catch(() => {})
  }
  bucketReady = true
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

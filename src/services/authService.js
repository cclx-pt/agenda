// Serviço de autenticação do front-end. Comunica com o backend via proxy Vite
// (/auth/*). Os cookies de sessão são httpOnly, por isso usamos credentials.

async function postJson(url, body) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(body),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(data.error || 'Ocorreu um erro. Tenta novamente.')
  }
  return data
}

export function requestCode(email) {
  return postJson('/auth/request-code', { email })
}

export function verifyCode(email, code) {
  return postJson('/auth/verify', { email, code })
}

export async function fetchMe() {
  const res = await fetch('/auth/me', { credentials: 'include' })
  if (!res.ok) return null
  const data = await res.json()
  return data.user ?? null
}

export async function logout() {
  await fetch('/auth/logout', { method: 'POST', credentials: 'include' })
}

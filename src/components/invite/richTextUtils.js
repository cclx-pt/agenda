// Utilitários de texto rico (rich text) para os blocos de convite. O conteúdo é
// guardado como HTML simples e SANITIZADO antes de renderizar (allow-list), para
// não introduzir XSS mesmo que o HTML seja adulterado.

// Tags permitidas (formatação básica produzida pelo mini-editor).
const ALLOWED_TAGS = new Set([
  'b', 'strong', 'i', 'em', 'u', 's', 'br', 'p', 'div', 'span', 'font', 'a', 'ul', 'ol', 'li', 'h3', 'h4', 'blockquote',
])
// Tags removidas por completo (com o conteúdo).
const DROP_TAGS = new Set([
  'script', 'style', 'iframe', 'object', 'embed', 'link', 'meta', 'head', 'title', 'noscript', 'template', 'form', 'input', 'button', 'svg',
])
// Propriedades CSS permitidas no atributo style.
const ALLOWED_STYLE_PROPS = new Set([
  'font-weight', 'font-style', 'font-family', 'font-size', 'text-decoration', 'text-decoration-line', 'color', 'text-align',
])

// Verdadeiro quando a string parece conter marcação HTML.
export function looksLikeHtml(s) {
  return typeof s === 'string' && /<[a-z][\s\S]*>/i.test(s)
}

// Escapa texto simples para poder ser inserido como HTML com segurança.
export function escapeText(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

// Filtra um atributo style, mantendo só propriedades da allow-list e valores seguros.
function cleanStyle(style) {
  const out = []
  for (const part of String(style).split(';')) {
    const idx = part.indexOf(':')
    if (idx < 0) continue
    const prop = part.slice(0, idx).trim().toLowerCase()
    const val = part.slice(idx + 1).trim()
    if (!prop || !val) continue
    if (!ALLOWED_STYLE_PROPS.has(prop)) continue
    if (/url\(|expression|javascript:|@import|[<>]/i.test(val)) continue
    out.push(`${prop}: ${val}`)
  }
  return out.join('; ')
}

// Substitui um elemento pelos seus filhos (mantém o conteúdo, descarta a tag).
function unwrap(el) {
  const parent = el.parentNode
  if (!parent) {
    el.remove()
    return
  }
  while (el.firstChild) parent.insertBefore(el.firstChild, el)
  parent.removeChild(el)
}

// Limpa recursivamente os filhos de um nó, aplicando a allow-list.
function sanitizeNode(node, doc) {
  for (const child of [...node.childNodes]) {
    if (child.nodeType === 3) continue // texto
    if (child.nodeType !== 1) {
      child.remove() // comentários e outros
      continue
    }
    const tag = child.tagName.toLowerCase()
    if (DROP_TAGS.has(tag)) {
      child.remove()
      continue
    }
    if (!ALLOWED_TAGS.has(tag)) {
      sanitizeNode(child, doc) // limpa os netos primeiro
      unwrap(child)
      continue
    }
    // Tag permitida: limpar atributos.
    for (const attr of [...child.attributes]) {
      const name = attr.name.toLowerCase()
      if (name.startsWith('on')) {
        child.removeAttribute(attr.name)
        continue
      }
      if (name === 'style') {
        const s = cleanStyle(attr.value)
        if (s) child.setAttribute('style', s)
        else child.removeAttribute('style')
        continue
      }
      if (tag === 'font' && (name === 'face' || name === 'size' || name === 'color')) continue
      if (tag === 'a' && name === 'href') {
        if (!/^(https?:|mailto:)/i.test(attr.value.trim())) child.removeAttribute('href')
        continue
      }
      child.removeAttribute(attr.name)
    }
    if (tag === 'a') {
      child.setAttribute('target', '_blank')
      child.setAttribute('rel', 'noreferrer noopener')
    }
    sanitizeNode(child, doc)
  }
}

// Sanitiza uma string HTML devolvendo apenas a marcação permitida. Requer DOM
// (corre no browser); sem DOM devolve vazio por segurança.
export function sanitizeInviteHtml(html) {
  if (!html) return ''
  if (typeof window === 'undefined' || !window.DOMParser) return ''
  const doc = new window.DOMParser().parseFromString(`<div>${html}</div>`, 'text/html')
  const root = doc.body.firstChild
  if (!root) return ''
  sanitizeNode(root, doc)
  return root.innerHTML
}

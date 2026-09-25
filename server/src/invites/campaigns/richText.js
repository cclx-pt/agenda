import sanitizeHtml from 'sanitize-html'

const allowedTags = [
  'p',
  'br',
  'strong',
  'b',
  'em',
  'i',
  'u',
  'ul',
  'ol',
  'li',
  'a',
  'img',
]

export function sanitizeCampaignRichText(value) {
  return sanitizeHtml(String(value ?? ''), {
    allowedTags,
    allowedAttributes: {
      a: ['href', 'data-email-button'],
      img: ['src', 'alt'],
    },
    allowedSchemes: ['http', 'https'],
    allowedSchemesByTag: {
      a: ['http', 'https'],
      img: ['http', 'https'],
    },
    transformTags: {
      b: 'strong',
      i: 'em',
    },
    exclusiveFilter(frame) {
      return frame.tag === 'a' && !frame.attribs.href
    },
  }).trim()
}

export function richTextToPlainText(value) {
  const withBreaks = sanitizeCampaignRichText(value)
    .replace(
      /<img src="([^"]+)"(?: alt="([^"]*)")?\s*\/?>/gi,
      (_match, src, alt) => `${alt ? `${alt}: ` : ''}${src}\n`
    )
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(?:p|li)>/gi, '\n')
  return sanitizeHtml(withBreaks, {
    allowedTags: [],
    textFilter(text) {
      return text.replace(/\u00a0/g, ' ')
    },
  })
    .replace(/\s*\n\s*/g, '\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim()
}

export function renderCampaignRichText(value) {
  return sanitizeCampaignRichText(value)
    .replace(
      /<a data-email-button(?:="")? href="([^"]+)">([\s\S]*?)<\/a>/g,
      '<a href="$1" style="display:inline-block;margin:4px 0;padding:12px 20px;background:#1f3864;border:1px solid #1f3864;border-radius:6px;font-family:Arial,\'Helvetica Neue\',sans-serif;font-size:15px;line-height:20px;font-weight:700;color:#ffffff;text-decoration:none">$2</a>'
    )
    .replace(
      /<a href="([^"]+)">([\s\S]*?)<\/a>/g,
      '<a href="$1" style="color:#1f3864;text-decoration:underline">$2</a>'
    )
    .replace(
      /<img src="([^"]+)"(?: alt="([^"]*)")?\s*\/?>/g,
      '<img src="$1" alt="$2" width="536" style="display:block;width:100%;max-width:536px;height:auto;margin:16px 0;border:0;border-radius:8px;line-height:100%;outline:none;text-decoration:none" />'
    )
    .replace(/<p>/g, '<p style="margin:0 0 16px">')
    .replace(/<ul>/g, '<ul style="margin:0 0 16px;padding-left:24px">')
    .replace(/<ol>/g, '<ol style="margin:0 0 16px;padding-left:24px">')
}

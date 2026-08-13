import { z } from 'zod'

const portalLinkSchema = z.object({
  type: z.enum(['link', 'registration']).default('link'),
  title: z.string().trim().min(1).max(100),
  url: z.string().trim().url().refine((value) => /^https?:\/\//i.test(value), 'Link inválido (use http/https).'),
  platform: z.enum(['youtube', 'instagram', 'facebook', 'website', 'other']).default('other'),
  description: z.string().trim().max(240).optional().default(''),
  imageUrl: z.string().trim().max(1000).refine(
    (value) => !value || value.startsWith('/') || /^https?:\/\//i.test(value),
    'Imagem inválida.'
  ).optional().default(''),
  active: z.boolean().default(true),
})

const portalLinksSchema = z.array(portalLinkSchema).max(50)

export const DEFAULT_REGISTRATION_PORTAL_HEADER = {
  logoUrl: '',
  title: 'Inscrições e ligações',
  description: 'Encontra aqui as inscrições abertas e os canais oficiais da comunidade.',
}

const portalHeaderSchema = z.object({
  logoUrl: z.string().trim().max(1000).refine(
    (value) => !value || value.startsWith('/') || /^https?:\/\//i.test(value),
    'Logótipo inválido.'
  ).optional().default(''),
  title: z.string().trim().min(1).max(100).default(DEFAULT_REGISTRATION_PORTAL_HEADER.title),
  description: z.string().trim().max(240).default(DEFAULT_REGISTRATION_PORTAL_HEADER.description),
})

const portalConfigSchema = z.object({
  header: portalHeaderSchema.default(DEFAULT_REGISTRATION_PORTAL_HEADER),
  links: portalLinksSchema.default([]),
})

export function normalizeRegistrationPortalLinks(input) {
  return portalLinksSchema.parse(input)
}

export function parseStoredRegistrationPortalLinks(input) {
  const parsed = portalLinksSchema.safeParse(Array.isArray(input) ? input : [])
  return parsed.success ? parsed.data : []
}

export function normalizeRegistrationPortalConfig(input) {
  return portalConfigSchema.parse(Array.isArray(input) ? { links: input } : input)
}

export function parseStoredRegistrationPortalConfig(input) {
  const parsed = portalConfigSchema.safeParse(Array.isArray(input) ? { links: input } : input)
  return parsed.success
    ? parsed.data
    : { header: { ...DEFAULT_REGISTRATION_PORTAL_HEADER }, links: [] }
}
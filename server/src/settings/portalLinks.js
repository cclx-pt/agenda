import { z } from 'zod'

const portalLinkSchema = z.object({
  title: z.string().trim().min(1).max(100),
  url: z.string().trim().url().refine((value) => /^https?:\/\//i.test(value), 'Link inválido (use http/https).'),
  platform: z.enum(['youtube', 'instagram', 'facebook', 'website', 'other']).default('other'),
  description: z.string().trim().max(240).optional().default(''),
  active: z.boolean().default(true),
})

const portalLinksSchema = z.array(portalLinkSchema).max(50)

export function normalizeRegistrationPortalLinks(input) {
  return portalLinksSchema.parse(input)
}

export function parseStoredRegistrationPortalLinks(input) {
  const parsed = portalLinksSchema.safeParse(Array.isArray(input) ? input : [])
  return parsed.success ? parsed.data : []
}
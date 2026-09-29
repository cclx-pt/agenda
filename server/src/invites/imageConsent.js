export const IMAGE_CONSENT_FIELD_LABEL =
  'confirmação/consentimento de proteção de imagem'

export const IMAGE_CONSENT_REFUSAL =
  'Não autorizo a utilização da minha imagem em fotografias ou vídeos captados'

export function findImageConsentField(blocks) {
  const fields =
    blocks.find((block) => block.type === 'rsvp')?.content?.fields ?? []
  return (
    fields.find(
      (field) =>
        String(field?.label ?? '').trim().toLocaleLowerCase('pt-PT') ===
        IMAGE_CONSENT_FIELD_LABEL
    ) ?? null
  )
}

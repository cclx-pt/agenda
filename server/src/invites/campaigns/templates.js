export const campaignTemplates = [
  {
    key: 'access_information',
    label: 'Informações de acesso',
    type: 'update',
    subject: 'Informações de acesso',
    preheader: 'Tudo o que precisa de saber para participar.',
    blocks: [
      {
        type: 'text',
        text: 'Partilhamos as informações essenciais para a sua participação.',
      },
      { type: 'button', label: 'Consultar a minha inscrição', url: '{{eventLink}}' },
    ],
    audience: { rsvpStates: ['confirmed'] },
  },
  {
    key: 'event_reminder',
    label: 'Lembrete antes do evento',
    type: 'reminder',
    subject: 'Lembrete',
    preheader: 'O evento aproxima-se.',
    blocks: [
      {
        type: 'text',
        text: 'O evento aproxima-se. Consulte a sua inscrição e confirme os detalhes.',
      },
      { type: 'button', label: 'Ver a minha inscrição', url: '{{eventLink}}' },
    ],
    audience: { rsvpStates: ['confirmed'] },
  },
  {
    key: 'payment_pending',
    label: 'Pagamento pendente',
    type: 'reminder',
    subject: 'Pagamento pendente',
    preheader: 'Conclua o pagamento da sua inscrição.',
    blocks: [
      {
        type: 'warning',
        text: 'A sua inscrição ainda tem um pagamento pendente.',
      },
      { type: 'button', label: 'Consultar pagamento', url: '{{eventLink}}' },
    ],
    audience: { paymentStates: ['pending', 'awaiting_validation'] },
  },
  {
    key: 'urgent_change',
    label: 'Alteração urgente',
    type: 'warning',
    subject: 'Alteração importante',
    preheader: 'Existe uma atualização importante sobre o evento.',
    blocks: [
      {
        type: 'warning',
        text: 'Existe uma alteração importante sobre o evento. Consulte os detalhes atualizados.',
      },
      { type: 'button', label: 'Ver detalhes atualizados', url: '{{eventLink}}' },
    ],
    audience: { rsvpStates: ['confirmed', 'pending', 'waitlisted'] },
  },
  {
    key: 'cancellation_or_time_change',
    label: 'Cancelamento ou mudança de horário',
    type: 'warning',
    subject: 'Atualização de horário',
    preheader: 'Consulte a alteração ao evento.',
    blocks: [
      {
        type: 'warning',
        text: 'O horário ou a realização do evento foi alterado. Consulte a informação atualizada.',
      },
      { type: 'button', label: 'Consultar atualização', url: '{{eventLink}}' },
    ],
    audience: { rsvpStates: ['confirmed', 'pending', 'waitlisted'] },
  },
  {
    key: 'post_event_thanks',
    label: 'Agradecimento pós-evento',
    type: 'post_event',
    subject: 'Obrigado por participar',
    preheader: 'Obrigado por ter estado connosco.',
    blocks: [
      {
        type: 'text',
        text: 'Obrigado por ter participado. Esperamos voltar a encontrá-lo em breve.',
      },
    ],
    audience: { checkedIn: true },
  },
  {
    key: 'post_event_follow_up',
    label: 'Follow-up pós-evento',
    type: 'post_event',
    subject: 'Como foi a sua experiência?',
    preheader: 'Queremos continuar a acompanhar a sua experiência.',
    blocks: [
      {
        type: 'text',
        text: 'Obrigado por ter estado connosco. Partilhamos consigo os próximos passos e agradecemos o seu feedback.',
      },
      { type: 'button', label: 'Consultar o evento', url: '{{eventLink}}' },
    ],
    audience: { checkedIn: true },
  },
]

export function findCampaignTemplate(key) {
  return campaignTemplates.find((template) => template.key === key) ?? null
}

export function applyTemplate(template, invite, eventLink) {
  const replace = (value) =>
    String(value ?? '')
      .replaceAll('{{eventTitle}}', invite.title)
      .replaceAll('{{eventLink}}', eventLink)
  return {
    type: template.type,
    name: template.label,
    subject: replace(template.subject),
    preheader: replace(template.preheader),
    blocks: template.blocks.map((block) => ({
      ...block,
      ...(block.text ? { text: replace(block.text) } : {}),
      ...(block.label ? { label: replace(block.label) } : {}),
      ...(block.url ? { url: replace(block.url) } : {}),
    })),
    audience: {
      rsvpStates: [],
      paymentStates: [],
      ticketIds: [],
      checkedIn: null,
      formMatch: 'all',
      formConditions: [],
      ...template.audience,
    },
  }
}

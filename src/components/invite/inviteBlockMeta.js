// Metadados dos tipos de bloco de convite (sem componentes, para não disparar o
// aviso react-refresh no ficheiro de editores).

// label + se o utilizador pode adicionar o bloco pelo menu "Adicionar bloco".
export const BLOCK_META = {
  banner: { label: 'Cabeçalho / Banner', addable: false },
  overview: { label: 'Descrição (Overview)', addable: true },
  info_extra: { label: 'Informação', addable: true },
  convite_narrativo: { label: 'Convite (narrativa + vídeo)', addable: true },
  multimedia: { label: 'Multimédia', addable: true },
  good_to_know: { label: 'Bom saber (Good to know)', addable: true },
  oradores: { label: 'Oradores / Lineup', addable: true },
  agenda: { label: 'Programa / Agenda', addable: true },
  workshops: { label: 'Workshops', addable: true },
  rsvp: { label: 'Inscrição (RSVP)', addable: false },
  pagamento: { label: 'Bilhetes', addable: false },
  localizacao: { label: 'Localização', addable: true },
  faqs: { label: 'Perguntas frequentes', addable: true },
  partilha: { label: 'Partilhar', addable: false },
  rodape: { label: 'Rodapé', addable: true },
}

export const ADDABLE_TYPES = Object.entries(BLOCK_META)
  .filter(([, m]) => m.addable)
  .map(([type, m]) => ({ type, label: m.label }))

// Conteúdo inicial ao adicionar um bloco novo.
export function defaultContent(type) {
  switch (type) {
    case 'overview':
      return { title: 'Sobre o evento', body: '' }
    case 'info_extra':
      return { title: '', body: '' }
    case 'convite_narrativo':
      return { narrative: '', guestName: '', guestBio: '', videoUrl: '' }
    case 'multimedia':
      return { title: 'Multimédia', items: [] }
    case 'good_to_know':
      return { title: 'Bom saber', highlights: [], ageInfo: '', doorTime: '', parkingInfo: '', items: [] }
    case 'oradores':
      return { title: 'Oradores / Lineup', speakers: [] }
    case 'agenda':
      return { title: 'Programa', days: [] }
    case 'workshops':
      return { title: 'Workshops', items: [] }
    case 'localizacao':
      return { address: '', directionsUrl: '' }
    case 'faqs':
      return { title: 'Perguntas frequentes', items: [] }
    case 'rodape':
      return {
        logoUrl: '',
        contactEmail: '',
        contactPhone: '',
        socialLinks: [
          { platform: 'facebook', url: '' },
          { platform: 'instagram', url: '' },
          { platform: 'youtube', url: '' },
          { platform: 'website', url: '' },
        ],
      }
    default:
      return {}
  }
}

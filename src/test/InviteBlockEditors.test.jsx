import { useState } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BlockEditor } from '../components/invite/InviteBlockEditors'
import {
  AgendaCard,
  BannerCard,
  FaqsCard,
  GoodToKnowCard,
  LocationCard,
  MultimediaCard,
  OverviewCard,
  PaymentCard,
  SpeakersCard,
  WorkshopsCard,
} from '../components/invite/InviteCards'
import { BannerRegistrationAction, RsvpCard } from '../components/invite/InvitePage'
import { uploadEventImage, uploadMultimediaVideo } from '../services/eventsService'

vi.mock('../services/eventsService', () => ({
  uploadEventImage: vi.fn(),
  uploadMultimediaVideo: vi.fn(),
}))

describe('InviteBlockEditors uploads', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('uses the image uploader for footer images', async () => {
    uploadEventImage.mockResolvedValue('https://storage.example/footer.png')
    const onChange = vi.fn()
    const { container } = render(<BlockEditor type="rodape" content={{}} onChange={onChange} />)
    const file = new File(['image'], 'footer.png', { type: 'image/png' })

    await userEvent.upload(container.querySelector('input[type="file"]'), file)

    await waitFor(() => expect(uploadEventImage).toHaveBeenCalledWith(file))
    expect(uploadMultimediaVideo).not.toHaveBeenCalled()
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ logoUrl: 'https://storage.example/footer.png' }))
  })

  it('uses the direct video uploader for multimedia MP4 files', async () => {
    uploadMultimediaVideo.mockResolvedValue('https://storage.example/video.mp4')
    const onChange = vi.fn()
    const content = { items: [{ type: 'video', url: '', title: '', caption: '' }] }
    const { container } = render(<BlockEditor type="multimedia" content={content} onChange={onChange} />)
    const file = new File(['video'], 'programa.mp4', { type: 'video/mp4' })

    await userEvent.upload(container.querySelector('input[type="file"]'), file)

    await waitFor(() => expect(uploadMultimediaVideo).toHaveBeenCalledWith(file))
    expect(uploadEventImage).not.toHaveBeenCalled()
    expect(onChange).toHaveBeenCalledWith({
      ...content,
      items: [{ ...content.items[0], url: 'https://storage.example/video.mp4' }],
    })
  })

  it('edits and displays ticket information', async () => {
    const onChange = vi.fn()
    const information = 'Inclui almoço e materiais.'
    function Harness() {
      const [content, setContent] = useState({})
      const update = (nextContent) => {
        setContent(nextContent)
        onChange(nextContent)
      }
      return <BlockEditor type="pagamento" content={content} onChange={update} />
    }
    const { rerender } = render(<Harness />)

    await userEvent.type(screen.getByPlaceholderText('Informação geral sobre os bilhetes'), information)
    expect(onChange).toHaveBeenLastCalledWith({ information })

    rerender(
      <PaymentCard
        block={{ content: { information } }}
        page={{ invite: { registrationMode: 'none' }, tickets: [] }}
        accent="#1F3864"
      />,
    )
    expect(screen.getByText(information)).toBeInTheDocument()
  })

  it('edits and displays banner information only when filled', async () => {
    const onChange = vi.fn()
    const information = 'Entrada a partir das 18h30.'
    function Harness() {
      const [content, setContent] = useState({})
      const update = (nextContent) => {
        setContent(nextContent)
        onChange(nextContent)
      }
      return <BlockEditor type="banner" content={content} onChange={update} />
    }
    const editor = render(<Harness />)

    await userEvent.type(screen.getByPlaceholderText('Informação adicional apresentada no cabeçalho'), information)
    expect(onChange).toHaveBeenLastCalledWith({ information })
    editor.unmount()

    const page = { invite: { title: 'Conferência' } }
    const { rerender } = render(<BannerCard block={{ content: {} }} page={page} accent="#1F3864" showInformation />)
    expect(screen.queryByText(information)).not.toBeInTheDocument()
    rerender(<BannerCard block={{ content: { information } }} page={page} accent="#1F3864" showInformation />)
    expect(screen.getByText(information)).toBeInTheDocument()
  })

  it('expands banner tickets and keeps direct internal and external flows', async () => {
    const block = { content: { ctaLabel: 'Garantir lugar' } }
    const ticket = { id: 'ticket-1', name: 'Bilhete geral', kind: 'gratis', active: true }
    const { rerender } = render(
      <BannerRegistrationAction
        block={block}
        invite={{ registrationMode: 'internal' }}
        tickets={[ticket]}
        slug="conferencia"
        accent="#1F3864"
      />,
    )

    await userEvent.click(screen.getByRole('button', { name: /Garantir lugar/i }))
    expect(screen.getByRole('link', { name: /Bilhete geral/i })).toHaveAttribute(
      'href',
      '/invite/conferencia/inscricao?ticket=ticket-1',
    )

    rerender(
      <BannerRegistrationAction
        block={block}
        invite={{ registrationMode: 'internal' }}
        tickets={[]}
        slug="conferencia"
        accent="#1F3864"
      />,
    )
    expect(screen.getByRole('link', { name: /Garantir lugar/i })).toHaveAttribute('href', '/invite/conferencia/inscricao')

    rerender(
      <BannerRegistrationAction
        block={block}
        invite={{ registrationMode: 'external', registrationUrl: 'https://forms.example/register' }}
        tickets={[ticket]}
        slug="conferencia"
        accent="#1F3864"
      />,
    )
    expect(screen.getByRole('link', { name: /Garantir lugar/i })).toHaveAttribute('href', 'https://forms.example/register')
  })

  it('keeps Enter as a new dropdown option', async () => {
    function Harness() {
      const [content, setContent] = useState({
        fields: [{ key: 'participacao', type: 'select', label: 'Participação', options: ['Participante'] }],
      })
      return <BlockEditor type="rsvp" content={content} onChange={setContent} />
    }

    render(<Harness />)
    const options = screen.getByPlaceholderText('Uma opção por linha')
    await userEvent.click(options)
    await userEvent.type(options, '{End}{Enter}Voluntário')

    expect(options).toHaveValue('Participante\nVoluntário')
  })

  it('keeps a conditional section aligned when its dropdown option is renamed', async () => {
    function Harness() {
      const [content, setContent] = useState({
        fields: [
          { key: 'participacao', type: 'select', label: 'Participação', options: ['Participante', 'Voluntário'] },
          { key: 'voluntarios', type: 'section', label: 'Voluntários', visibleWhen: { field: 'participacao', equals: 'Voluntário' } },
        ],
      })
      return <BlockEditor type="rsvp" content={content} onChange={setContent} />
    }

    render(<Harness />)
    const options = screen.getByPlaceholderText('Uma opção por linha')
    await userEvent.click(options)
    options.setSelectionRange('Participante\n'.length, options.value.length)
    await userEvent.keyboard('Equipa')

    expect(options).toHaveValue('Participante\nEquipa')
    expect(screen.getByDisplayValue('Equipa')).toBeInTheDocument()
  })

  it('shows a conditional section in the RSVP preview after selecting its condition', async () => {
    const block = {
      content: {
        fields: [
          { key: 'participacao', type: 'select', label: 'Participação', options: ['Participante', 'Voluntário'] },
          { key: 'voluntarios', type: 'section', label: 'Voluntários', visibleWhen: { field: 'participacao', equals: 'Voluntário' } },
          { key: 'equipa', type: 'text', label: 'Equipa pretendida' },
        ],
      },
    }
    const page = { invite: { registrationMode: 'internal' }, tickets: [] }

    render(<RsvpCard block={block} page={page} accent="#1F3864" onSubmitted={() => {}} preview />)
    expect(screen.queryByText('Voluntários')).not.toBeInTheDocument()

    await userEvent.selectOptions(screen.getByLabelText('Participação'), 'Voluntário')

    expect(screen.getByText('Voluntários')).toBeInTheDocument()
    expect(screen.getByLabelText('Equipa pretendida')).toBeInTheDocument()
  })

  it('shows the full event date range after registration', () => {
    const page = {
      invite: {
        title: 'Conferência',
        startDatetime: '2026-10-02T09:00:00Z',
        endDatetime: '2026-10-04T18:00:00Z',
      },
      tickets: [],
    }

    render(
      <RsvpCard
        block={{ content: {} }}
        page={page}
        accent="#1F3864"
        guestStatus={{ name: 'Ana', code: 'ABC123' }}
        onSubmitted={() => {}}
      />,
    )

    expect(screen.getByText(/2 de outubro de 2026 – 4 de outubro de 2026/)).toBeInTheDocument()
  })

  it('renders visible landing blocks even when they have no content', () => {
    const emptyBlock = { content: {} }
    const page = { invite: {} }

    render(
      <>
        <OverviewCard block={emptyBlock} />
        <GoodToKnowCard block={emptyBlock} accent="#1F3864" />
        <MultimediaCard block={emptyBlock} accent="#1F3864" />
        <SpeakersCard block={emptyBlock} />
        <AgendaCard block={emptyBlock} accent="#1F3864" />
        <WorkshopsCard block={emptyBlock} />
        <LocationCard block={emptyBlock} page={page} />
        <FaqsCard block={emptyBlock} />
      </>,
    )

    for (const heading of [
      'Sobre o evento',
      'Bom saber',
      'Multimédia',
      'Oradores e Convidados',
      'Programa',
      'Workshops',
      'Localização',
      'Perguntas frequentes',
    ]) {
      expect(screen.getByRole('heading', { name: heading })).toBeInTheDocument()
    }
  })
})

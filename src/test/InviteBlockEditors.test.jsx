import { useState } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BlockEditor } from '../components/invite/InviteBlockEditors'
import { RsvpCard } from '../components/invite/InvitePage'
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
})

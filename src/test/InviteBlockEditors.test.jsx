import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BlockEditor } from '../components/invite/InviteBlockEditors'
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
})

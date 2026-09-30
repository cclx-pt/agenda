import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import InviteImageConsent from '../components/invite/InviteImageConsent'
import * as invitesService from '../services/invitesService'

vi.mock('../services/invitesService', () => ({
  getInviteImageConsent: vi.fn(),
  confirmInviteImageConsent: vi.fn(),
}))

describe('InviteImageConsent', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    window.history.replaceState(
      {},
      '',
      '/invite/conferencia/image-consent?g=secret-token&c=campaign-id'
    )
    invitesService.getInviteImageConsent.mockResolvedValue({
      eventTitle: 'Conferência',
      bannerUrl: null,
      canConsent: true,
    })
    invitesService.confirmInviteImageConsent.mockResolvedValue({
      changed: true,
      eventTitle: 'Conferência',
      consentedAt: '2026-09-30T00:00:00.000Z',
    })
  })

  it('requires explicit confirmation before recording image consent', async () => {
    render(<InviteImageConsent slug="conferencia" />)

    expect(
      await screen.findByRole('heading', {
        name: 'Autorizar utilização da imagem',
      })
    ).toBeInTheDocument()
    expect(invitesService.getInviteImageConsent).toHaveBeenCalledWith(
      'conferencia',
      'secret-token',
      'campaign-id'
    )
    expect(invitesService.confirmInviteImageConsent).not.toHaveBeenCalled()

    await userEvent.click(
      screen.getByRole('button', {
        name: 'Confirmo que autorizo a utilização da minha imagem',
      })
    )

    await waitFor(() =>
      expect(invitesService.confirmInviteImageConsent).toHaveBeenCalledWith(
        'conferencia',
        'secret-token',
        'campaign-id'
      )
    )
    expect(
      screen.getByRole('heading', { name: 'Autorização registada' })
    ).toBeInTheDocument()
  })
})

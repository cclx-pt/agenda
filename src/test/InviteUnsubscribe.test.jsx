import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import InviteUnsubscribe from '../components/invite/InviteUnsubscribe'
import * as invitesService from '../services/invitesService'

vi.mock('../services/invitesService', () => ({
  getPublicInvite: vi.fn(),
  unsubscribeInviteCampaignEmails: vi.fn(),
}))

describe('InviteUnsubscribe', () => {
  beforeEach(() => {
    window.history.replaceState({}, '', '/invite/conferencia/unsubscribe?g=secret-token')
    invitesService.getPublicInvite.mockResolvedValue({
      invite: {
        title: 'Conferência',
        bannerUrl: 'https://example.test/banner.jpg',
      },
    })
    invitesService.unsubscribeInviteCampaignEmails.mockResolvedValue({
      unsubscribed: true,
    })
  })

  it('requires confirmation before cancelling campaign emails', async () => {
    render(<InviteUnsubscribe slug="conferencia" />)

    expect(
      await screen.findByRole('heading', { name: 'Cancelar emails' })
    ).toBeInTheDocument()
    expect(invitesService.unsubscribeInviteCampaignEmails).not.toHaveBeenCalled()
    expect(screen.getByRole('img', { name: 'Conferência' })).toHaveAttribute(
      'src',
      'https://example.test/banner.jpg'
    )

    await userEvent.click(
      screen.getByRole('button', { name: 'Cancelar receção de emails' })
    )

    await waitFor(() =>
      expect(invitesService.unsubscribeInviteCampaignEmails).toHaveBeenCalledWith(
        'conferencia',
        'secret-token'
      )
    )
    expect(
      screen.getByRole('heading', { name: 'Emails cancelados' })
    ).toBeInTheDocument()
  })
})

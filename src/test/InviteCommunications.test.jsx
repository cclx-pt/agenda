import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import InviteCommunications from '../components/invite/InviteCommunications'
import * as invitesService from '../services/invitesService'

vi.mock('../services/invitesService', () => ({
  listInviteCampaigns: vi.fn(),
  createInviteCampaign: vi.fn(),
  updateInviteCampaign: vi.fn(),
  deleteInviteCampaign: vi.fn(),
  previewInviteCampaignAudience: vi.fn(),
  testInviteCampaign: vi.fn(),
  sendInviteCampaign: vi.fn(),
  listInviteCampaignRecipients: vi.fn(),
  retryFailedInviteCampaign: vi.fn(),
}))

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

const sentCampaign = {
  id: 'campaign-1',
  type: 'reminder',
  name: 'Lembrete final',
  subject: 'O evento é amanhã',
  preheader: 'Informações importantes',
  blocks: [{ type: 'text', text: 'Até amanhã.' }],
  audience: {
    rsvpStates: ['confirmed'],
    paymentStates: ['paid'],
    ticketIds: [],
    checkedIn: false,
  },
  status: 'sent',
  recipientCount: 10,
  sentCount: 10,
  failedCount: 0,
}

describe('InviteCommunications', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    invitesService.listInviteCampaigns.mockResolvedValue([sentCampaign])
    invitesService.listInviteCampaignRecipients.mockResolvedValue([])
    invitesService.createInviteCampaign.mockImplementation(async (_inviteId, campaign) => ({
      ...campaign,
      id: 'campaign-copy',
      status: 'draft',
    }))
  })

  it('copies a sent communication into a new draft', async () => {
    render(<InviteCommunications invite={{ id: 'invite-1', title: 'Conferência' }} />)

    await userEvent.click(await screen.findByRole('button', { name: /Lembrete final/i }))
    expect(screen.getByRole('heading', { name: 'Resultados da comunicação' })).toBeInTheDocument()

    await userEvent.click(
      screen.getAllByRole('button', { name: 'Copiar para novo rascunho' })[0],
    )

    expect(screen.getByRole('heading', { name: 'Novo rascunho' })).toBeInTheDocument()
    expect(screen.getByLabelText('Nome interno')).toHaveValue('Lembrete final (cópia)')
    expect(screen.getByLabelText('Assunto')).toHaveValue('O evento é amanhã')

    await userEvent.click(screen.getByRole('button', { name: 'Guardar rascunho' }))

    await waitFor(() =>
      expect(invitesService.createInviteCampaign).toHaveBeenCalledWith(
        'invite-1',
        expect.objectContaining({
          name: 'Lembrete final (cópia)',
          subject: 'O evento é amanhã',
          audience: expect.objectContaining(sentCampaign.audience),
        }),
      ),
    )
    expect(invitesService.updateInviteCampaign).not.toHaveBeenCalled()
  })

  it('adds form answer conditions to the audience preview', async () => {
    invitesService.listInviteCampaigns.mockResolvedValue([])
    invitesService.previewInviteCampaignAudience.mockResolvedValue({ count: 3 })
    render(
      <InviteCommunications
        invite={{ id: 'invite-1', title: 'Conferência' }}
        formFields={[
          {
            key: 'comunidade',
            type: 'select',
            label: 'Comunidade',
            options: ['Sede', 'Porto'],
          },
        ]}
      />,
    )

    await userEvent.click(screen.getByRole('button', { name: 'Condição' }))
    await userEvent.selectOptions(screen.getByLabelText('Valor da condição 1'), 'Porto')
    await userEvent.click(screen.getByRole('button', { name: 'Calcular audiência' }))

    await waitFor(() =>
      expect(invitesService.previewInviteCampaignAudience).toHaveBeenCalledWith(
        'invite-1',
        expect.objectContaining({
          formMatch: 'all',
          formConditions: [
            { fieldKey: 'comunidade', operator: 'equals', value: 'Porto' },
          ],
        }),
      ),
    )
    expect(screen.getByText('3 destinatário(s)')).toBeInTheDocument()
  })

  it('shows recipient errors and retries only failed deliveries', async () => {
    const failedCampaign = { ...sentCampaign, status: 'sent_with_errors', failedCount: 1 }
    const failedRecipient = {
      id: 'recipient-1',
      name: 'Ana',
      email: 'ana@example.test',
      status: 'failed',
      attemptCount: 1,
      error: 'SMTP indisponível',
    }
    invitesService.listInviteCampaigns.mockResolvedValue([failedCampaign])
    invitesService.listInviteCampaignRecipients.mockResolvedValue([failedRecipient])
    invitesService.retryFailedInviteCampaign.mockResolvedValue({
      ...failedCampaign,
      status: 'sent',
      sentCount: 10,
      failedCount: 0,
    })
    vi.spyOn(window, 'confirm').mockReturnValue(true)

    render(<InviteCommunications invite={{ id: 'invite-1', title: 'Conferência' }} />)

    await userEvent.click(await screen.findByRole('button', { name: /Lembrete final/i }))
    expect(await screen.findByText('SMTP indisponível')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Repetir falhados' }))

    await waitFor(() =>
      expect(invitesService.retryFailedInviteCampaign).toHaveBeenCalledWith(
        'invite-1',
        'campaign-1',
      ),
    )
  })

  it('queues a campaign and keeps its progress visible', async () => {
    invitesService.listInviteCampaigns.mockResolvedValue([])
    invitesService.previewInviteCampaignAudience.mockResolvedValue({ count: 2 })
    invitesService.createInviteCampaign.mockImplementation(async (_inviteId, campaign) => ({
      ...campaign,
      id: 'campaign-new',
      status: 'draft',
    }))
    invitesService.sendInviteCampaign.mockResolvedValue({
      ...sentCampaign,
      id: 'campaign-new',
      status: 'queued',
      recipientCount: 2,
      sentCount: 0,
    })
    invitesService.listInviteCampaignRecipients.mockResolvedValue([
      {
        id: 'recipient-1',
        name: 'Ana',
        email: 'ana@example.test',
        status: 'pending',
        attemptCount: 0,
      },
      {
        id: 'recipient-2',
        name: 'Bruno',
        email: 'bruno@example.test',
        status: 'pending',
        attemptCount: 0,
      },
    ])
    vi.spyOn(window, 'confirm').mockReturnValue(true)

    render(<InviteCommunications invite={{ id: 'invite-1', title: 'Conferência' }} />)

    await userEvent.type(screen.getByLabelText('Nome interno'), 'Aviso')
    await userEvent.type(screen.getByLabelText('Assunto'), 'Informação')
    await userEvent.type(screen.getByPlaceholderText('Escreva a mensagem…'), 'Mensagem')
    await userEvent.click(screen.getByRole('button', { name: 'Enviar agora' }))

    await waitFor(() =>
      expect(invitesService.sendInviteCampaign).toHaveBeenCalledWith(
        'invite-1',
        'campaign-new',
      ),
    )
    expect(screen.getByRole('heading', { name: 'Resultados da comunicação' })).toBeInTheDocument()
    expect(await screen.findByText('A aguardar processamento')).toBeInTheDocument()
  })
})

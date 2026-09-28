import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
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
  retryInviteCampaignRecipient: vi.fn(),
  listInviteCampaignTemplates: vi.fn(),
  saveInviteCampaignTemplate: vi.fn(),
  createInviteCampaignFromTemplate: vi.fn(),
  listInviteCampaignSegments: vi.fn(),
  saveInviteCampaignSegment: vi.fn(),
  deleteInviteCampaignSegment: vi.fn(),
  scheduleInviteCampaign: vi.fn(),
  cancelInviteCampaignSchedule: vi.fn(),
  listInviteCampaignAutomations: vi.fn(),
  saveInviteCampaignAutomation: vi.fn(),
  deleteInviteCampaignAutomation: vi.fn(),
  getInviteCampaignMetrics: vi.fn(),
  uploadInviteCampaignImage: vi.fn(),
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
    vi.restoreAllMocks()
    vi.clearAllMocks()
    invitesService.listInviteCampaigns.mockResolvedValue([sentCampaign])
    invitesService.listInviteCampaignRecipients.mockResolvedValue([])
    invitesService.listInviteCampaignTemplates.mockResolvedValue([])
    invitesService.listInviteCampaignSegments.mockResolvedValue([])
    invitesService.listInviteCampaignAutomations.mockResolvedValue([])
    invitesService.getInviteCampaignMetrics.mockResolvedValue({
      provider: { name: 'smtp', capabilities: { deliveryWebhooks: false } },
      recipients: { total: 0, sent: 0, failed: 0, skipped: 0 },
      events: {},
      attempts: 0,
      rates: { accepted: 0, failed: 0, delivered: null },
    })
    invitesService.createInviteCampaign.mockImplementation(async (_inviteId, campaign) => ({
      ...campaign,
      id: 'campaign-copy',
      status: 'draft',
    }))
  })

  it('copies a sent communication into a new draft', async () => {
    render(<InviteCommunications invite={{ id: 'invite-1', title: 'Conferência' }} />)

    expect(
      screen.getByText(/todos os utilizadores com acesso a este convite/i),
    ).toBeInTheDocument()
    await userEvent.click(await screen.findByRole('button', { name: /Lembrete final/i }))
    expect(
      screen.getByRole('dialog', { name: 'Gerir comunicação: Lembrete final' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Resultados da comunicação' })).toBeInTheDocument()

    await userEvent.click(
      screen.getAllByRole('button', { name: 'Copiar para novo rascunho' })[0],
    )

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Novo rascunho' })).toBeInTheDocument()
    expect(screen.getByLabelText('Nome interno')).toHaveValue('Lembrete final (cópia)')
    expect(screen.getByText('Conferência |')).toBeInTheDocument()
    expect(screen.getByLabelText('Assunto')).toHaveValue('O evento é amanhã')

    await userEvent.click(
      screen.getByRole('button', { name: 'Guardar rascunho da comunicação' }),
    )

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
    expect(
      screen.getByRole('button', { name: /Lembrete final \(cópia\).*Rascunho/i }),
    ).toBeInTheDocument()
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

  it('shows rich formatting controls for text blocks', async () => {
    invitesService.listInviteCampaigns.mockResolvedValue([])

    render(<InviteCommunications invite={{ id: 'invite-1', title: 'Conferência' }} />)

    expect(screen.getByRole('button', { name: 'Negrito' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Itálico' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Sublinhado' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Lista' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Lista numerada' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Link' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Botão com link' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Imagem no texto' })).toBeInTheDocument()
    const editor = screen.getByRole('textbox', { name: 'Texto da mensagem' })
    expect(editor).toHaveAttribute(
      'contenteditable',
      'true'
    )
    expect(editor).toHaveAttribute('dir', 'ltr')
    await userEvent.type(editor, 'olá')
    expect(editor).toHaveTextContent('olá')
  })

  it('normalizes browser text blocks to paragraphs before saving', async () => {
    invitesService.listInviteCampaigns.mockResolvedValue([])

    render(<InviteCommunications invite={{ id: 'invite-1', title: 'Conferência' }} />)

    const editor = screen.getByRole('textbox', { name: 'Texto da mensagem' })
    editor.innerHTML =
      '<div>Primeiro parágrafo</div><div><br></div><div>Segundo parágrafo</div>'
    fireEvent.input(editor)
    await userEvent.type(screen.getByLabelText('Nome interno'), 'Mensagem')
    await userEvent.type(screen.getByLabelText('Assunto'), 'Informação')
    await userEvent.click(
      screen.getByRole('button', { name: 'Guardar rascunho da comunicação' }),
    )

    await waitFor(() =>
      expect(invitesService.createInviteCampaign).toHaveBeenCalledWith(
        'invite-1',
        expect.objectContaining({
          blocks: [
            expect.objectContaining({
              type: 'text',
              html:
                '<p>Primeiro parágrafo</p><p><br></p><p>Segundo parágrafo</p>',
            }),
          ],
        }),
      ),
    )
  })

  it('uploads an inline image from the local computer', async () => {
    invitesService.listInviteCampaigns.mockResolvedValue([])
    invitesService.uploadInviteCampaignImage.mockResolvedValue(
      'https://storage.example/message.png',
    )
    const execCommand = vi.fn().mockReturnValue(true)
    Object.defineProperty(document, 'execCommand', {
      configurable: true,
      value: execCommand,
    })

    render(<InviteCommunications invite={{ id: 'invite-1', title: 'Conferência' }} />)

    const file = new File(['image'], 'mensagem.png', { type: 'image/png' })
    await userEvent.upload(
      screen.getByLabelText('Carregar imagem do computador'),
      file,
    )

    await waitFor(() =>
      expect(invitesService.uploadInviteCampaignImage).toHaveBeenCalledWith(
        'invite-1',
        file,
      ),
    )
    expect(execCommand).toHaveBeenCalledWith(
      'insertHTML',
      false,
      '<img src="https://storage.example/message.png" alt="mensagem.png" />',
    )
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
    invitesService.listInviteCampaignRecipients.mockResolvedValue([
      failedRecipient,
      {
        id: 'recipient-2',
        name: 'Bruno',
        email: 'bruno@example.test',
        status: 'sent',
        attemptCount: 1,
        error: null,
      },
      {
        id: 'recipient-3',
        name: 'Carla',
        email: 'carla@example.test',
        status: 'pending',
        attemptCount: 0,
        error: null,
      },
      {
        id: 'recipient-4',
        name: 'Diogo',
        email: 'diogo@example.test',
        status: 'processing',
        attemptCount: 1,
        error: null,
      },
      {
        id: 'recipient-5',
        name: 'Eva',
        email: 'eva@example.test',
        status: 'skipped',
        attemptCount: 0,
        error: null,
      },
    ])
    invitesService.retryFailedInviteCampaign.mockResolvedValue({
      ...failedCampaign,
      status: 'sent',
      sentCount: 10,
      failedCount: 0,
    })
    invitesService.retryInviteCampaignRecipient.mockResolvedValue({
      ...failedCampaign,
      status: 'queued',
    })
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    const createObjectURL = vi.fn().mockReturnValue('blob:audience')
    const revokeObjectURL = vi.fn()
    Object.defineProperties(URL, {
      createObjectURL: { configurable: true, value: createObjectURL },
      revokeObjectURL: { configurable: true, value: revokeObjectURL },
    })
    const clickDownload = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => {})

    render(<InviteCommunications invite={{ id: 'invite-1', title: 'Conferência' }} />)

    await userEvent.click(await screen.findByRole('button', { name: /Lembrete final/i }))
    expect(await screen.findByText('SMTP indisponível')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Todos (5)' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Enviados (1)' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Por enviar (2)' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Por enviar (2)' }))
    expect(screen.getByText('carla@example.test')).toBeInTheDocument()
    expect(screen.getByText('diogo@example.test')).toBeInTheDocument()
    expect(screen.queryByText('bruno@example.test')).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Reenviar' }),
    ).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Erros (1)' }))
    expect(screen.getByRole('button', { name: 'Reenviar' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Reenviar' }))
    await waitFor(() =>
      expect(invitesService.retryInviteCampaignRecipient).toHaveBeenCalledWith(
        'invite-1',
        'campaign-1',
        'recipient-1',
      ),
    )
    expect(
      screen.getByRole('button', { name: 'Descarregar audiência CSV' }),
    ).toBeInTheDocument()
    await userEvent.click(
      screen.getByRole('button', { name: 'Descarregar audiência CSV' }),
    )
    expect(createObjectURL).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'text/csv;charset=utf-8' }),
    )
    expect(clickDownload).toHaveBeenCalled()
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:audience')
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
    vi.spyOn(window, 'confirm')
      .mockReturnValueOnce(true)
      .mockReturnValueOnce(true)
    vi.spyOn(window, 'prompt').mockReturnValue('Template do aviso')
    invitesService.saveInviteCampaignTemplate.mockResolvedValue({
      key: 'custom:template-1',
      label: 'Template do aviso',
      custom: true,
      automationCompatible: false,
    })

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
    expect(invitesService.saveInviteCampaignTemplate).toHaveBeenCalledWith(
      'invite-1',
      { campaignId: 'campaign-new', name: 'Template do aviso' },
    )
    expect(
      screen.getByRole('button', { name: 'Template do aviso' }),
    ).toBeInTheDocument()
  })

  it('creates a draft from a reusable template', async () => {
    const template = { key: 'event_reminder', label: 'Lembrete antes do evento' }
    const draft = {
      ...sentCampaign,
      id: 'campaign-template',
      name: template.label,
      status: 'draft',
    }
    invitesService.listInviteCampaignTemplates.mockResolvedValue([template])
    invitesService.createInviteCampaignFromTemplate.mockResolvedValue(draft)

    render(<InviteCommunications invite={{ id: 'invite-1', title: 'Conferência' }} />)

    await userEvent.click(
      await screen.findByRole('button', { name: 'Lembrete antes do evento' })
    )

    await waitFor(() =>
      expect(invitesService.createInviteCampaignFromTemplate).toHaveBeenCalledWith(
        'invite-1',
        'event_reminder'
      )
    )
    expect(screen.getByLabelText('Nome interno')).toHaveValue('Lembrete antes do evento')
  })

  it('schedules a draft using Lisbon local time', async () => {
    invitesService.listInviteCampaigns.mockResolvedValue([])
    invitesService.previewInviteCampaignAudience.mockResolvedValue({ count: 2 })
    invitesService.scheduleInviteCampaign.mockImplementation(
      async (_inviteId, campaignId, scheduledAt) => ({
        ...sentCampaign,
        id: campaignId,
        status: 'scheduled',
        scheduledAt,
      })
    )

    render(<InviteCommunications invite={{ id: 'invite-1', title: 'Conferência' }} />)

    await userEvent.type(screen.getByLabelText('Nome interno'), 'Agendado')
    await userEvent.type(screen.getByLabelText('Assunto'), 'Informação')
    await userEvent.type(screen.getByPlaceholderText('Escreva a mensagem…'), 'Mensagem')
    await userEvent.type(screen.getByLabelText('Agendar (hora de Lisboa)'), '2030-06-01T10:00')
    await userEvent.click(screen.getByRole('button', { name: 'Agendar' }))

    await waitFor(() =>
      expect(invitesService.scheduleInviteCampaign).toHaveBeenCalledWith(
        'invite-1',
        'campaign-copy',
        '2030-06-01T09:00:00.000Z'
      )
    )
  })
})

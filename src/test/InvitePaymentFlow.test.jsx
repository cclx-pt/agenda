import { expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { PaymentFlowCard } from '../components/invite/InvitePage'

vi.mock('../services/invitesService', () => ({
  getGuestPayment: vi.fn(() => new Promise(() => {})),
  initiatePayment: vi.fn(),
  uploadReceipt: vi.fn(),
}))

const invite = {
  paymentMethodLabels: {
    transferencia: 'Transferência bancária',
    mbway: 'MB WAY',
  },
}

const tickets = [
  {
    id: 'ticket-1',
    paymentMethods: ['transferencia', 'mbway'],
  },
]

function renderPaymentFlow(guestStatus) {
  return render(
    <PaymentFlowCard
      slug="evento"
      guestToken="guest-token"
      invite={invite}
      guestStatus={{ ticketId: 'ticket-1', paymentMethod: 'transferencia', ...guestStatus }}
      tickets={tickets}
      accent="#1F3864"
    />,
  )
}

it('allows a donation without offering receipt upload', () => {
  renderPaymentFlow({ isDonation: true, showPayment: true, showReceipt: false, paymentState: 'not_applicable' })

  expect(screen.getByText(/A tua inscrição está confirmada/)).toBeInTheDocument()
  expect(screen.queryByText(/comprovativo/i)).not.toBeInTheDocument()
})

it('shows the payment method resolved during registration', () => {
  renderPaymentFlow({ isDonation: false, showPayment: true, showReceipt: true, paymentState: 'pending' })

  expect(screen.getByRole('heading', { name: 'Pagamento' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Como pagar — Transferência bancária' })).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: /MB WAY/ })).not.toBeInTheDocument()
})

it('omits the payment-method section for free tickets', () => {
  renderPaymentFlow({ isDonation: false, showPayment: false, showReceipt: false, paymentState: null })

  expect(screen.queryByText(/Métodos de (Doação|Pagamento)/)).not.toBeInTheDocument()
})
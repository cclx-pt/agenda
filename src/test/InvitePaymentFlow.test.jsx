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

it('shows all configured methods for donation tickets', () => {
  renderPaymentFlow({ isDonation: true, showReceipt: true, paymentState: 'paid' })

  expect(screen.getByRole('heading', { name: 'Métodos de Doação' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Transferência bancária' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'MB WAY' })).toBeInTheDocument()
})

it('shows all configured methods for paid tickets', () => {
  renderPaymentFlow({ isDonation: false, showReceipt: true, paymentState: 'pending' })

  expect(screen.getByRole('heading', { name: 'Métodos de Pagamento' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Transferência bancária' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'MB WAY' })).toBeInTheDocument()
})

it('omits the payment-method section for free tickets', () => {
  renderPaymentFlow({ isDonation: false, showReceipt: false, paymentState: null })

  expect(screen.queryByText(/Métodos de (Doação|Pagamento)/)).not.toBeInTheDocument()
})
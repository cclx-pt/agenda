import assert from 'node:assert/strict'
import test from 'node:test'
import { ticketPaymentMethodsTitle } from './email.js'

test('renders all donation methods with the donation heading', () => {
  assert.equal(ticketPaymentMethodsTitle({ isDonation: true }), 'Métodos de Doação')
})

test('renders all paid methods with the payment heading', () => {
  assert.equal(ticketPaymentMethodsTitle({ isPaid: true }), 'Métodos de Pagamento')
})

test('omits payment methods for free tickets', () => {
  assert.equal(ticketPaymentMethodsTitle({ isFree: true }), null)
})
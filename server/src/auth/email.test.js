import assert from 'node:assert/strict'
import test from 'node:test'
import { renderTicketPaymentMethods } from './email.js'

test('renders all donation methods with the donation heading', () => {
  const result = renderTicketPaymentMethods({
    isDonation: true,
    methods: [{ label: 'MB Way', detail: '912 345 678' }],
  })
  assert.match(result.text, /^Métodos de Doação:/)
  assert.match(result.text, /MB Way: 912 345 678/)
  assert.match(result.html, /Métodos de Doação/)
})

test('renders all paid methods with the payment heading', () => {
  const result = renderTicketPaymentMethods({
    isPaid: true,
    methods: [{ label: 'Transferência', detail: '<IBAN>' }],
  })
  assert.match(result.text, /^Métodos de Pagamento:/)
  assert.match(result.html, /&lt;IBAN&gt;/)
})

test('omits payment methods for free tickets', () => {
  assert.deepEqual(renderTicketPaymentMethods({ isFree: true }), { text: '', html: '' })
})
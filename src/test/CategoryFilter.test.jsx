import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import CategoryFilter from '../components/CategoryFilter'

const events = [
  { id: '1', category: 'culto' },
  { id: '2', category: 'jovens' },
  { id: '3', category: 'culto' },
]

describe('CategoryFilter', () => {
  it('lists "Todos" plus the categories present in the events', () => {
    render(<CategoryFilter events={events} value="Todos" onChange={() => {}} />)
    const options = screen.getAllByRole('option').map((o) => o.textContent)
    expect(options).toContain('Todos')
    expect(options).toContain('Celebração') // label for "culto"
    expect(options).toContain('Jovens')
    expect(options).not.toContain('Formação') // not present in events
  })

  it('calls onChange with the selected category value', async () => {
    const onChange = vi.fn()
    render(<CategoryFilter events={events} value="Todos" onChange={onChange} />)
    await userEvent.selectOptions(screen.getByRole('combobox'), 'jovens')
    expect(onChange).toHaveBeenCalledWith('jovens')
  })
})

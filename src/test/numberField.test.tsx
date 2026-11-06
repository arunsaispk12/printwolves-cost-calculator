import { useState } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { NumberField, NumInput } from '@/components/planner/ui'

function Harness({ start }: { start: number | null }) {
  const [v, setV] = useState<number | null>(start)
  return (
    <>
      <NumberField label="Cost" value={v} onChange={setV} />
      <output data-testid="state">{String(v)}</output>
    </>
  )
}

describe('NumberField — clearing and zero', () => {
  it('can be emptied fully, and the value reads as 0', () => {
    render(<Harness start={525} />)
    const input = screen.getByLabelText('Cost') as HTMLInputElement
    fireEvent.change(input, { target: { value: '' } })
    expect(input.value).toBe('')
    expect(screen.getByTestId('state').textContent).toBe('0')
  })

  it('accepts an explicit 0 and keeps showing it', () => {
    render(<Harness start={525} />)
    const input = screen.getByLabelText('Cost') as HTMLInputElement
    fireEvent.change(input, { target: { value: '0' } })
    expect(input.value).toBe('0')
  })

  it('does not force a leading 0 when retyping after clearing', () => {
    render(<Harness start={525} />)
    const input = screen.getByLabelText('Cost') as HTMLInputElement
    fireEvent.change(input, { target: { value: '' } })
    fireEvent.change(input, { target: { value: '7' } })
    expect(input.value).toBe('7')
  })

  it('shows a blank field for a value that was never set', () => {
    render(<Harness start={null} />)
    expect((screen.getByLabelText('Cost') as HTMLInputElement).value).toBe('')
  })
})

describe('NumInput — optional value', () => {
  it('reports undefined when emptied, so an optional field stays unset', () => {
    const seen: Array<number | undefined> = []
    render(<NumInput aria-label="unit" value={12} onChange={v => seen.push(v)} />)
    fireEvent.change(screen.getByLabelText('unit'), { target: { value: '' } })
    expect(seen).toEqual([undefined])
  })
})

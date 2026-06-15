import { formatINR, roundPsych, roundUpToRupee } from '@/lib/formatters'

describe('formatINR', () => {
  it('formats 274.66 as ₹274.66', () => {
    expect(formatINR(274.66)).toBe('₹274.66')
  })
  it('formats 10000 as ₹10,000.00', () => {
    expect(formatINR(10000)).toBe('₹10,000.00')
  })
})

describe('roundPsych', () => {
  it('rounds 89 (< 100) to nearest 9 → 89', () => {
    expect(roundPsych(89)).toBe(89)
  })
  it('rounds 94 (< 100) to nearest 9 → 99', () => {
    expect(roundPsych(94)).toBe(99)
  })
  it('rounds 320 (< 500) to nearest 49 → 349', () => {
    expect(roundPsych(320)).toBe(349)
  })
  it('rounds 850 (< 2000) to nearest 99 → 899', () => {
    expect(roundPsych(850)).toBe(899)
  })
  it('rounds 2300 (≥ 2000) to nearest 499 → 2499', () => {
    expect(roundPsych(2300)).toBe(2499)
  })
})

describe('roundUpToRupee', () => {
  it('rounds 274.10 up to 275', () => {
    expect(roundUpToRupee(274.10)).toBe(275)
  })
  it('leaves whole number unchanged', () => {
    expect(roundUpToRupee(274)).toBe(274)
  })
})

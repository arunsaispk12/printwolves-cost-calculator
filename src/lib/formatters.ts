export function formatINR(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
}

export function roundUpToRupee(amount: number): number {
  return Math.ceil(amount)
}

export function roundPsych(price: number): number {
  if (price < 100) {
    return Math.ceil(price / 10) * 10 - 1
  } else if (price < 500) {
    return Math.ceil(price / 50) * 50 - 1
  } else if (price < 2000) {
    return Math.ceil(price / 100) * 100 - 1
  } else {
    return Math.ceil(price / 500) * 500 - 1
  }
}

export function formatPct(value: number, decimals = 1): string {
  return `${value.toFixed(decimals)}%`
}

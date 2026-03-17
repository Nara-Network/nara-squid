export function safeMulDiv(a: bigint, b: bigint, div: bigint): bigint {
  if (a === 0n || b === 0n) return 0n
  if (div === 0n) return 0n
  return (a * b) / div
}

export function pow10(n: number): bigint {
  return 10n ** BigInt(n)
}


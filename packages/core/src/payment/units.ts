export function decimalToAtomicUnits(value: string, decimals: number): string {
  if (!Number.isInteger(decimals) || decimals < 0) {
    throw new Error("Token decimals must be a non-negative integer.");
  }

  const normalized = value.trim();

  if (!/^\d+(?:\.\d+)?$/.test(normalized)) {
    throw new Error(`Invalid decimal amount: "${value}".`);
  }

  const [whole, fraction = ""] = normalized.split(".");

  if (fraction.length > decimals) {
    throw new Error(
      `Amount "${value}" has more than ${decimals} decimal places.`,
    );
  }

  const paddedFraction = fraction.padEnd(decimals, "0");

  const atomic =
    BigInt(whole) * 10n ** BigInt(decimals) + BigInt(paddedFraction || "0");

  return atomic.toString();
}

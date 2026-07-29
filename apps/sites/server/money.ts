export function multiplyDecimal(
  left: string,
  right: string,
  outputDigits: number,
): string {
  const leftParsed = parseDecimal(left);
  const rightParsed = parseDecimal(right);
  const product = leftParsed.value * rightParsed.value;
  const productScale = leftParsed.scale + rightParsed.scale;
  return rescale(product, productScale, outputDigits);
}

export function normalizeMoney(value: string, digits = 2): string {
  const parsed = parseDecimal(value);
  return rescale(parsed.value, parsed.scale, digits);
}

function parseDecimal(value: string): { value: bigint; scale: number } {
  const normalized = value.trim();
  if (!/^\d+(?:\.\d+)?$/u.test(normalized)) {
    throw new Error("Invalid decimal value.");
  }
  const [whole, fraction = ""] = normalized.split(".");
  return {
    value: BigInt(`${whole}${fraction}`),
    scale: fraction.length,
  };
}

function rescale(value: bigint, currentScale: number, targetScale: number): string {
  let scaled = value;
  if (currentScale > targetScale) {
    const divisor = 10n ** BigInt(currentScale - targetScale);
    const quotient = scaled / divisor;
    const remainder = scaled % divisor;
    scaled = quotient + (remainder * 2n >= divisor ? 1n : 0n);
  } else if (currentScale < targetScale) {
    scaled *= 10n ** BigInt(targetScale - currentScale);
  }
  const raw = scaled.toString().padStart(targetScale + 1, "0");
  if (targetScale === 0) return raw;
  return `${raw.slice(0, -targetScale)}.${raw.slice(-targetScale)}`;
}

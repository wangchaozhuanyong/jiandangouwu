export function normalizeLegacyLineBreaks(value: string): string {
  return value.replaceAll("\\n", "\n");
}

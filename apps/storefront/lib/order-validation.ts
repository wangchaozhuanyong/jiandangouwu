export const MIN_ORDER_CONTACT_LENGTH = 4;

export function isValidOrderContact(value: string): boolean {
  return value.trim().length >= MIN_ORDER_CONTACT_LENGTH;
}

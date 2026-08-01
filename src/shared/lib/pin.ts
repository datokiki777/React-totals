/**
 * SHA-256 hex digest of a PIN, using the Web Crypto API. Only this hash is
 * ever stored/synced — never the plaintext PIN, unlike the old app which
 * hardcoded the PIN in plain text in its source.
 */
export async function hashPin(pin: string): Promise<string> {
  const bytes = new TextEncoder().encode(pin);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** A PIN must be 4-8 digits — reasonable range for a device-unlock code. */
export function isValidPinFormat(pin: string): boolean {
  return /^[0-9]{4,8}$/.test(pin);
}

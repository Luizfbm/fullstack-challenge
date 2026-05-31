const CODE_VERIFIER_BYTE_LENGTH = 32;

export function createCodeVerifier(cryptoApi: Crypto = crypto): string {
  const bytes = new Uint8Array(CODE_VERIFIER_BYTE_LENGTH);

  cryptoApi.getRandomValues(bytes);

  return base64UrlEncode(bytes);
}

export async function createCodeChallenge(
  verifier: string,
  cryptoApi: Crypto = crypto,
): Promise<string> {
  const digest = await cryptoApi.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(verifier),
  );

  return base64UrlEncode(new Uint8Array(digest));
}

export function base64UrlEncode(bytes: Uint8Array): string {
  let binary = "";

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

export function base64UrlDecode(value: string): string {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(
    normalized.length + ((4 - (normalized.length % 4)) % 4),
    "=",
  );

  return atob(padded);
}

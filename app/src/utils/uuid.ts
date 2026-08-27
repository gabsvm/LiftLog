import { stringify } from 'uuid';

type CryptoLike = {
  getRandomValues?: (array: Uint8Array) => Uint8Array;
};

type QuickCryptoModule = {
  randomBytes: (size: number) => Uint8Array;
};

function randomBytes(size: number): Uint8Array {
  const bytes = new Uint8Array(size);
  const webCrypto = (
    globalThis as typeof globalThis & { crypto?: CryptoLike }
  ).crypto;

  if (webCrypto?.getRandomValues) {
    webCrypto.getRandomValues(bytes);
    return bytes;
  }

  // Hermes/React Native does not guarantee a global Web Crypto object. Avoid
  // making the whole app depend on QuickCrypto being globally installed just
  // so ordinary model IDs can be created. Load only the native RNG fallback
  // when an UUID is actually requested.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const quickCrypto = require('react-native-quick-crypto') as QuickCryptoModule;
  bytes.set(quickCrypto.randomBytes(size));
  return bytes;
}

export function uuid(): string {
  const bytes = randomBytes(16);

  // RFC 4122 UUID v4: set version and variant bits explicitly before using
  // uuid.stringify(), which itself does not require globalThis.crypto.
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  return stringify(bytes);
}

export const uuidStringify = stringify;

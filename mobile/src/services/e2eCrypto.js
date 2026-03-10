/**
 * E2E Encryption - tweetnacl box (X25519-XSalsa20-Poly1305)
 * Requires: npm install tweetnacl react-native-get-random-values
 * Import react-native-get-random-values at app entry (before other imports)
 */
import * as SecureStore from 'expo-secure-store';

const STORE_KEY_PUBLIC = 'e2e_public_key';
const STORE_KEY_SECRET = 'e2e_secret_key';

let nacl = null;
try {
  nacl = require('tweetnacl');
  try {
    require('react-native-get-random-values');
  } catch (_) {}
} catch (_) {
  console.warn('E2E: tweetnacl not installed. Run: npm install tweetnacl react-native-get-random-values');
}

const b64enc = (b) => {
  if (!b || !b.length) return '';
  if (typeof b === 'string') return btoa(unescape(encodeURIComponent(b)));
  let binary = '';
  const bytes = new Uint8Array(b);
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
};
const b64dec = (s) => {
  if (!s || typeof s !== 'string') return new Uint8Array(0);
  try {
    const binary = atob(s);
    const out = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
    return out;
  } catch {
    return new Uint8Array(0);
  }
};

export async function hasE2EKeys() {
  if (!nacl) return false;
  const pk = await SecureStore.getItemAsync(STORE_KEY_PUBLIC);
  return !!(pk && pk.length > 40);
}

export async function getOrCreateKeyPair() {
  if (!nacl) return null;
  let publicKey = await SecureStore.getItemAsync(STORE_KEY_PUBLIC);
  let secretKey = await SecureStore.getItemAsync(STORE_KEY_SECRET);
  if (publicKey && secretKey) {
    return {
      publicKey: b64dec(publicKey),
      secretKey: b64dec(secretKey),
      publicKeyB64: publicKey,
    };
  }
  const pair = nacl.box.keyPair();
  publicKey = b64enc(pair.publicKey);
  secretKey = b64enc(pair.secretKey);
  await SecureStore.setItemAsync(STORE_KEY_PUBLIC, publicKey);
  await SecureStore.setItemAsync(STORE_KEY_SECRET, secretKey);
  return {
    publicKey: pair.publicKey,
    secretKey: pair.secretKey,
    publicKeyB64: publicKey,
  };
}

export async function encryptFor(recipientPublicKeyB64, plaintext) {
  if (!nacl || !plaintext) return null;
  const keys = await getOrCreateKeyPair();
  if (!keys) return null;
  const theirPk = b64dec(recipientPublicKeyB64);
  if (theirPk.length !== 32) return null;
  const nonce = nacl.randomBytes(24);
  const msg = new TextEncoder().encode(plaintext);
  const boxed = nacl.box(msg, nonce, theirPk, keys.secretKey);
  return {
    content: b64enc(boxed),
    nonce: b64enc(nonce),
  };
}

export async function decryptFrom(senderPublicKeyB64, ciphertextB64, nonceB64) {
  if (!nacl || !ciphertextB64 || !nonceB64) return null;
  const keys = await getOrCreateKeyPair();
  if (!keys) return null;
  const theirPk = b64dec(senderPublicKeyB64);
  const boxed = b64dec(ciphertextB64);
  const nonce = b64dec(nonceB64);
  if (theirPk.length !== 32 || nonce.length !== 24) return null;
  const opened = nacl.box.open(boxed, nonce, theirPk, keys.secretKey);
  if (!opened) return null;
  return new TextDecoder().decode(opened);
}

export async function getPublicKeyB64() {
  const keys = await getOrCreateKeyPair();
  return keys?.publicKeyB64 || null;
}

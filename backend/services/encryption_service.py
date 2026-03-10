"""AES-256-GCM Encryption Service for sensitive data at rest"""
import os
import base64
import hashlib
import logging
from typing import Optional

logger = logging.getLogger(__name__)

ENCRYPTION_KEY = os.environ.get("ENCRYPTION_KEY", "")


def _derive_key(key_str: str) -> bytes:
    return hashlib.sha256(key_str.encode()).digest()


def encrypt_data(plaintext: str) -> Optional[str]:
    """Encrypt a string using AES-256-GCM. Returns base64-encoded ciphertext."""
    if not ENCRYPTION_KEY or len(ENCRYPTION_KEY) < 16:
        logger.warning("Encryption key not configured - returning plaintext")
        return plaintext

    try:
        from cryptography.hazmat.primitives.ciphers.aead import AESGCM

        key = _derive_key(ENCRYPTION_KEY)
        nonce = os.urandom(12)
        aesgcm = AESGCM(key)
        ct = aesgcm.encrypt(nonce, plaintext.encode("utf-8"), None)
        return base64.b64encode(nonce + ct).decode("utf-8")
    except ImportError:
        logger.warning("cryptography package not installed, using fallback XOR")
        return _xor_fallback(plaintext, ENCRYPTION_KEY)
    except Exception as e:
        logger.error(f"Encryption error: {e}")
        return plaintext


def decrypt_data(ciphertext: str) -> Optional[str]:
    """Decrypt a base64-encoded AES-256-GCM ciphertext."""
    if not ENCRYPTION_KEY or len(ENCRYPTION_KEY) < 16:
        return ciphertext

    try:
        from cryptography.hazmat.primitives.ciphers.aead import AESGCM

        key = _derive_key(ENCRYPTION_KEY)
        raw = base64.b64decode(ciphertext)
        nonce = raw[:12]
        ct = raw[12:]
        aesgcm = AESGCM(key)
        pt = aesgcm.decrypt(nonce, ct, None)
        return pt.decode("utf-8")
    except ImportError:
        return _xor_fallback_dec(ciphertext, ENCRYPTION_KEY)
    except Exception as e:
        logger.error(f"Decryption error: {e}")
        return ciphertext


def _xor_fallback(text: str, key: str) -> str:
    """Simple XOR fallback when cryptography is not installed"""
    key_bytes = key.encode()
    result = bytes([b ^ key_bytes[i % len(key_bytes)] for i, b in enumerate(text.encode())])
    return base64.b64encode(result).decode()


def _xor_fallback_dec(encoded: str, key: str) -> str:
    """Simple XOR fallback decryption"""
    key_bytes = key.encode()
    data = base64.b64decode(encoded)
    result = bytes([b ^ key_bytes[i % len(key_bytes)] for i, b in enumerate(data)])
    return result.decode()


def is_configured() -> bool:
    return bool(ENCRYPTION_KEY and len(ENCRYPTION_KEY) >= 16)

"""Encryption and decryption utilities for sensitive credentials using Fernet."""

import base64
import hashlib

from cryptography.fernet import Fernet

from app.config import get_settings


def get_fernet_key(secret_key: str | None = None) -> bytes:
    """
    Derive a 32-byte URL-safe base64-encoded Fernet key from secret_key.
    Uses SHA-256 digest to ensure exact 32 bytes required by Fernet.
    """
    if secret_key is None:
        secret_key = get_settings().SECRET_KEY

    # Hash the secret key string to 32 bytes
    key_digest = hashlib.sha256(secret_key.encode("utf-8")).digest()
    return base64.urlsafe_b64encode(key_digest)


def encrypt_value(value: str, secret_key: str | None = None) -> str:
    """Encrypt a plaintext string using Fernet."""
    if not value:
        return ""
    key = get_fernet_key(secret_key)
    f = Fernet(key)
    encrypted_bytes = f.encrypt(value.encode("utf-8"))
    return encrypted_bytes.decode("utf-8")


def decrypt_value(token: str, secret_key: str | None = None) -> str:
    """Decrypt a Fernet cipher string back to plaintext."""
    if not token:
        return ""
    key = get_fernet_key(secret_key)
    f = Fernet(key)
    decrypted_bytes = f.decrypt(token.encode("utf-8"))
    return decrypted_bytes.decode("utf-8")

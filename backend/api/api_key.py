"""RSA key pair for JWT signing and verification."""

from __future__ import annotations

from datetime import datetime, timezone

from api.api_db import db_get_active_key_pair, db_store_key_pair


def generate_rsa_key_pair():
    from cryptography.hazmat.primitives.asymmetric import rsa
    from cryptography.hazmat.primitives import serialization
    from cryptography.hazmat.backends import default_backend

    private_key = rsa.generate_private_key(
        public_exponent=65537,
        key_size=2048,
        backend=default_backend()
    )

    private_pem = private_key.private_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PrivateFormat.PKCS8,
        encryption_algorithm=serialization.NoEncryption()
    ).decode('utf-8')

    public_key = private_key.public_key()
    public_pem = public_key.public_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PublicFormat.SubjectPublicKeyInfo
    ).decode('utf-8')

    return private_pem, public_pem


def get_or_create_key_pair(session):
    key_pair = db_get_active_key_pair(session)

    if key_pair:
        return key_pair.private_key, key_pair.public_key

    private_key, public_key = generate_rsa_key_pair()

    now = datetime.now(timezone.utc)
    created_at = int(now.timestamp())
    local_now = datetime.now()
    utc_now = datetime.utcnow()
    timezone_offset = int((local_now - utc_now).total_seconds() / 3600)
    timezone_offset = max(-12, min(12, timezone_offset))

    db_store_key_pair(session, private_key, public_key, created_at, timezone_offset)

    return private_key, public_key


def get_private_key(config, session):
    private_key = config.get('JWT_PRIVATE_KEY')

    if private_key:
        if not private_key.strip().startswith('-----BEGIN'):
            try:
                with open(private_key, 'r') as f:
                    return f.read()
            except:
                pass
        else:
            return private_key

    private_key, _ = get_or_create_key_pair(session)
    return private_key


def get_public_key(config, session):
    public_key = config.get('JWT_PUBLIC_KEY')

    if public_key:
        if not public_key.strip().startswith('-----BEGIN'):
            try:
                with open(public_key, 'r') as f:
                    return f.read()
            except:
                pass
        else:
            return public_key

    _, public_key = get_or_create_key_pair(session)
    return public_key


def get_jwks(config, session) -> dict:
    import base64
    from cryptography.hazmat.primitives import serialization
    from cryptography.hazmat.primitives.asymmetric import rsa

    public_key_pem = get_public_key(config, session)
    public_key = serialization.load_pem_public_key(public_key_pem.encode("utf-8"))
    if not isinstance(public_key, rsa.RSAPublicKey):
        raise ValueError("JWKS is only supported for RSA public keys")

    numbers = public_key.public_numbers()

    def base64url_uint(value: int) -> str:
        byte_length = (value.bit_length() + 7) // 8
        value_bytes = value.to_bytes(byte_length, "big")
        return base64.urlsafe_b64encode(value_bytes).decode("ascii").rstrip("=")

    key_pair = db_get_active_key_pair(session)
    kid = str(key_pair.id) if key_pair else "active"
    return {
        "keys": [
            {
                "kty": "RSA",
                "use": "sig",
                "kid": kid,
                "alg": config.get("JWT_ALGORITHM", "RS256"),
                "n": base64url_uint(numbers.n),
                "e": base64url_uint(numbers.e),
            }
        ]
    }

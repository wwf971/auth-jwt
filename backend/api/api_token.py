"""JWT token issue, verify, and lifecycle management."""

from __future__ import annotations

import time
import uuid
from datetime import datetime

from api.api_db import (
    db_get_jwt_token,
    db_store_jwt_token,
    db_delete_jwt_token,
    db_revoke_jwt_token,
    db_cleanup_jwt_tokens,
    db_get_user_by_uid,
    db_get_user_permissions,
    db_get_user_service_permissions,
)
from api.api_key import get_private_key, get_public_key


def issue_jwt_token(config, session, uid: int) -> tuple:
    import jwt

    jti = str(uuid.uuid4())

    expiration_hours = config.get('JWT_EXPIRATION_HOURS', 24)
    created_at = int(time.time())
    expires_at = created_at + (expiration_hours * 3600)

    claims = {
        'uid': uid,
        'jti': jti,
        'iat': created_at,
        'exp': expires_at
    }

    private_key = get_private_key(config, session)
    algorithm = config.get('JWT_ALGORITHM', 'RS256')

    token = jwt.encode(claims, private_key, algorithm=algorithm)

    local_now = datetime.now()
    utc_now = datetime.utcnow()
    timezone_offset = int((local_now - utc_now).total_seconds() / 3600)
    timezone_offset = max(-12, min(12, timezone_offset))

    db_store_jwt_token(session, jti, uid, token, created_at, expires_at, timezone_offset)

    return jti, token, expires_at


def issue_temp_token(config, session, token: str) -> dict:
    public_key = get_public_key(config, session)
    algorithm = config.get("JWT_ALGORITHM", "RS256")
    result = verify_jwt_token_with_public_key(token, public_key, algorithm)
    if not result["valid"]:
        return {"success": False, "message": "Invalid token", "token": "", "expires_at": 0}

    claims = result["claims"] or {}
    jti = claims.get("jti")
    if claims.get("token_type") == "temp" or not jti:
        return {"success": False, "message": "Stored token required", "token": "", "expires_at": 0}

    token_record = db_get_jwt_token(session, jti)
    if not token_record or token_record.status_code <= 0:
        return {"success": False, "message": "Invalid token", "token": "", "expires_at": 0}

    user = db_get_user_by_uid(session, claims.get("uid"))
    if not user:
        return {"success": False, "message": "User not found", "token": "", "expires_at": 0}

    import jwt
    created_at = int(time.time())
    expires_at = created_at + int(config.get("JWT_TEMP_TOKEN_EXPIRATION_SECONDS", 900))
    claims = {
        "uid": user.uid,
        "iat": created_at,
        "exp": expires_at,
        "token_type": "temp",
    }
    private_key = get_private_key(config, session)
    algorithm = config.get("JWT_ALGORITHM", "RS256")
    temp_token = jwt.encode(claims, private_key, algorithm=algorithm)
    return {
        "success": True,
        "message": "Temporary token issued",
        "token": temp_token,
        "expires_at": expires_at,
    }


def verify_jwt_token_with_public_key(jwt_token: str, public_key: str, algorithm: str = "RS256") -> dict:
    import jwt as pyjwt

    try:
        if public_key and not public_key.strip().startswith('-----BEGIN'):
            try:
                with open(public_key, 'r') as f:
                    public_key = f.read()
            except:
                pass

        claims = pyjwt.decode(
            jwt_token,
            public_key,
            algorithms=[algorithm]
        )

        exp = claims.get('exp', 0)
        current_time = int(time.time())

        if exp < current_time:
            return {
                "valid": False,
                "claims": None,
                "error": "Token expired",
                "expired": True
            }

        return {
            "valid": True,
            "claims": claims,
            "error": None,
            "expired": False
        }

    except pyjwt.ExpiredSignatureError:
        return {
            "valid": False,
            "claims": None,
            "error": "Token expired",
            "expired": True
        }
    except pyjwt.InvalidTokenError as e:
        return {
            "valid": False,
            "claims": None,
            "error": f"Invalid token: {str(e)}",
            "expired": False
        }
    except Exception as e:
        return {
            "valid": False,
            "claims": None,
            "error": f"Verification error: {str(e)}",
            "expired": False
        }


def get_uid_from_token(jwt_token: str, public_key: str, algorithm: str = "RS256") -> int:
    result = verify_jwt_token_with_public_key(jwt_token, public_key, algorithm)

    if result["valid"] and result["claims"]:
        return result["claims"].get("uid")

    return None


def verify_jwt_token(config, session, jwt_token: str) -> bool:
    public_key = get_public_key(config, session)
    algorithm = config.get('JWT_ALGORITHM', 'RS256')

    result = verify_jwt_token_with_public_key(jwt_token, public_key, algorithm)

    if not result["valid"]:
        return False

    claims = result["claims"]
    jti = claims.get("jti")
    token_type = claims.get("token_type")

    if token_type == "temp":
        return True

    if jti:
        token_record = db_get_jwt_token(session, jti)
        if not token_record or token_record.status_code <= 0:
            return False
    else:
        return False

    return True


def get_token_user(config, session, jwt_token: str) -> dict | None:
    public_key = get_public_key(config, session)
    algorithm = config.get('JWT_ALGORITHM', 'RS256')
    result = verify_jwt_token_with_public_key(jwt_token, public_key, algorithm)

    if not result["valid"]:
        return None

    claims = result["claims"]
    jti = claims.get("jti")
    token_type = claims.get("token_type")
    uid = claims.get("uid")
    if not uid:
        return None

    if token_type == "temp":
        pass
    elif jti:
        token_record = db_get_jwt_token(session, jti)
        if not token_record or token_record.status_code <= 0:
            return None
    else:
        return None

    user = db_get_user_by_uid(session, uid)
    if not user:
        return None

    return {
        "uid": user.uid,
        "username": user.name,
        "permission_codes": [item.permission_code for item in db_get_user_permissions(session, user.uid)],
        "service_permissions": [
            {"service_id": item.service_id, "permission_code": item.permission_code}
            for item in db_get_user_service_permissions(session, user.uid)
        ],
    }


def get_token_info(config, session, jti: str) -> dict | None:
    token = db_get_jwt_token(session, jti)

    if not token:
        return None

    return {
        "jti": token.jti,
        "uid": token.uid,
        "token": token.jwt_token,
        "created_at": token.created_at,
        "created_at_timezone": token.created_at_timezone,
        "expires_at": token.expires_at,
        "status_code": token.status_code,
        "revoked_at": token.revoked_at if token.revoked_at else None
    }


def revoke_token(config, session, jti: str) -> dict:
    try:
        is_token_revoked = db_revoke_jwt_token(session, jti)
        if not is_token_revoked:
            return {"success": False, "message": "Token not found"}
        return {"success": True, "message": "Token revoked"}
    except Exception as e:
        session.rollback()
        return {"success": False, "message": str(e)}


def revoke_token_by_value(config, session, token: str) -> dict:
    import jwt

    try:
        claims = jwt.decode(token, options={"verify_signature": False})
        jti = claims.get("jti")
        if not jti:
            return {"success": False, "message": "Token id not found"}
        return revoke_token(config, session, jti)
    except Exception as e:
        session.rollback()
        return {"success": False, "message": str(e)}


def delete_token(config, session, jti: str) -> dict:
    try:
        is_deleted = db_delete_jwt_token(session, jti)
        if not is_deleted:
            return {"success": False, "message": "Token not found"}
        return {"success": True, "message": "Token deleted"}
    except Exception as e:
        session.rollback()
        return {"success": False, "message": str(e)}


def cleanup_tokens(config, session) -> dict:
    try:
        retention_seconds = int(config.get("JWT_TOKEN_RETENTION_SECONDS", 7 * 24 * 3600))
        result = db_cleanup_jwt_tokens(session, retention_seconds)
        return {"success": True, "message": "Token cleanup completed", **result}
    except Exception as e:
        session.rollback()
        return {"success": False, "message": str(e)}

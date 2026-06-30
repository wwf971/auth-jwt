"""User identity, login, and user CRUD."""

from __future__ import annotations

import bcrypt

from api.api_db import (
    init_database,
    gen_uid,
    db_get_user_by_username,
    db_get_user_by_uid,
    db_add_user,
    db_delete_user,
    db_get_all_users,
    db_get_user_tokens,
    db_get_user_permissions,
    db_get_user_service_permissions,
    db_set_user_permissions,
    db_set_user_service_permissions,
)
from api.api_token import issue_jwt_token


def login_user(config, username: str, password: str) -> dict:
    engine, SessionLocal = init_database(config)
    session = SessionLocal()

    try:
        user = db_get_user_by_username(session, username)

        if not user:
            return {
                "success": False,
                "message": "Invalid username or password",
                "token": None,
                "expires_at": None
            }

        if not bcrypt.checkpw(password.encode('utf-8'), user.password.encode('utf-8')):
            return {
                "success": False,
                "message": "Invalid username or password",
                "token": None,
                "expires_at": None
            }

        _jti, token, expires_at = issue_jwt_token(config, session, user.uid)

        return {
            "success": True,
            "message": "Login successful",
            "token": token,
            "expires_at": expires_at
        }
    except Exception as e:
        return {
            "success": False,
            "message": f"Login error: {str(e)}",
            "token": None,
            "expires_at": None
        }
    finally:
        session.close()


def add_user(config, session, username: str, password: str, permission_codes: list[int] | None = None, service_permissions: list[dict] | None = None) -> dict:
    if not username or not password:
        return {
            "success": False,
            "message": "Username and password are required",
            "uid": None
        }

    existing_user = db_get_user_by_username(session, username)
    if existing_user:
        return {
            "success": False,
            "message": f"User '{username}' already exists",
            "uid": None
        }

    try:
        bcrypt_rounds = config.get('BCRYPT_ROUNDS', 12)
        password_hash = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt(rounds=bcrypt_rounds))

        uid = gen_uid(config, session)

        db_add_user(config, session, username, password_hash.decode('utf-8'), uid)
        db_set_user_permissions(session, uid, permission_codes or [])
        db_set_user_service_permissions(session, uid, service_permissions or [])

        return {
            "success": True,
            "message": f"User '{username}' created successfully",
            "uid": uid
        }
    except Exception as e:
        session.rollback()
        return {
            "success": False,
            "message": f"Error creating user: {str(e)}",
            "uid": None
        }


def get_uid_of_username(config, session, username: str) -> int:
    user = db_get_user_by_username(session, username)
    if user:
        return user.uid
    return -1


def get_username_of_uid(config, session, uid: int) -> str:
    user = db_get_user_by_uid(session, uid)
    if user:
        return user.name
    return None


def is_config_manage_user(config, username: str) -> bool:
    username = str(username or "").strip()
    if not username:
        return False
    for user_item in config.get("AUTH_USERS") or []:
        role_list = user_item.get("roles") or []
        if "manage" in role_list and str(user_item.get("username") or "").strip() == username:
            return True
    return False


def is_config_manage_user_uid(config, session, uid: int) -> bool:
    user = db_get_user_by_uid(session, uid)
    return bool(user and is_config_manage_user(config, user.name))


def delete_user(config, session, username: str=None, uid: int=None) -> dict:
    if not username and not uid:
        return {
            "success": False,
            "message": "Username or UID is required"
        }

    if username and is_config_manage_user(config, username):
        return {
            "success": False,
            "message": "Configured manage user cannot be deleted"
        }

    if uid and is_config_manage_user_uid(config, session, uid):
        return {
            "success": False,
            "message": "Configured manage user cannot be deleted"
        }

    try:
        identifier = f"username '{username}'" if username else f"UID {uid}"

        success = db_delete_user(session, username=username, uid=uid)

        if success:
            return {
                "success": True,
                "message": f"User with {identifier} deleted successfully"
            }
        else:
            return {
                "success": False,
                "message": f"User with {identifier} not found"
            }
    except Exception as e:
        session.rollback()
        return {
            "success": False,
            "message": f"Error deleting user: {str(e)}"
        }


def get_all_users(config, session) -> list:
    users = db_get_all_users(session)
    result = []

    for user in users:
        tokens = db_get_user_tokens(session, user.uid)
        jwt_token_ids = [token.jti for token in tokens]

        permission_codes = [item.permission_code for item in db_get_user_permissions(session, user.uid)]
        service_permissions = [
            {"service_id": item.service_id, "permission_code": item.permission_code}
            for item in db_get_user_service_permissions(session, user.uid)
        ]

        result.append({
            "uid": user.uid,
            "username": user.name,
            "password_hash": user.password,
            "jwt_token_ids": jwt_token_ids,
            "permission_codes": permission_codes,
            "service_permissions": service_permissions,
        })

    return result

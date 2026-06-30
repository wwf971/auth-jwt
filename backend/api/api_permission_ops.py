"""Permission metadata, assignment, and authorization checks."""

from __future__ import annotations

from api.api_db import (
    db_get_permission_meta,
    db_get_permission_include,
    db_get_user_permissions,
    db_set_user_permissions,
    db_get_service_permission_meta,
    db_get_service_permission_include,
    db_get_user_service_permissions,
    db_set_user_service_permissions,
    db_upsert_service_permission_meta,
    db_set_service_permission_include,
    db_get_user_by_uid,
    PERMISSION_CODE_USER_EDIT,
    PERMISSION_CODE_USER_MANAGE,
)
from api.api_user import is_config_manage_user
from api.permission import (
    can_accept_permission_update,
    has_permission,
    has_service_permission,
    validate_service_id,
)


def get_permission_data(config, session) -> dict:
    return {
        "permissions": [
            {
                "permission_code": item.permission_code,
                "display_name": item.display_name,
                "description": item.description,
            }
            for item in db_get_permission_meta(session)
        ],
        "permission_includes": [
            {
                "permission_code": item.permission_code,
                "permission_code_included": item.permission_code_included,
            }
            for item in db_get_permission_include(session)
        ],
        "service_permissions": [
            {
                "service_id": item.service_id,
                "permission_code": item.permission_code,
                "display_name": item.display_name,
                "description": item.description,
            }
            for item in db_get_service_permission_meta(session)
        ],
        "service_permission_includes": [
            {
                "service_id": item.service_id,
                "permission_code": item.permission_code,
                "permission_code_included": item.permission_code_included,
            }
            for item in db_get_service_permission_include(session)
        ],
    }


def update_user_permissions(config, session, uid: int, permission_codes: list[int], service_permissions: list[dict]) -> dict:
    user = db_get_user_by_uid(session, uid)
    if not user:
        return {"success": False, "message": f"User with UID {uid} not found"}

    if is_config_manage_user(config, user.name):
        return {"success": False, "message": "Configured manage user permissions cannot be edited"}

    try:
        db_set_user_permissions(session, uid, permission_codes or [])
        db_set_user_service_permissions(session, uid, service_permissions or [])
        return {"success": True, "message": "User permissions updated"}
    except Exception as e:
        session.rollback()
        return {"success": False, "message": str(e)}


def authorize_user_permission_update(
    config,
    session,
    user_id: int,
    user_id_target: int,
    permission_codes_target_next: list[int],
    service_permissions_target_next: list[dict],
) -> dict:
    user_target = db_get_user_by_uid(session, user_id_target)
    if not user_target:
        return {"success": False, "message": f"User with UID {user_id_target} not found"}

    if is_config_manage_user(config, user_target.name):
        return {"success": False, "message": "Configured manage user permissions cannot be edited"}

    permissions_current = {
        "permission_codes": [
            item.permission_code
            for item in db_get_user_permissions(session, user_id)
        ],
        "service_permissions": [
            {"service_id": item.service_id, "permission_code": item.permission_code}
            for item in db_get_user_service_permissions(session, user_id)
        ],
    }
    permission_codes_target_current = [
        item.permission_code
        for item in db_get_user_permissions(session, user_id_target)
    ]
    service_permissions_target_current = [
        {"service_id": item.service_id, "permission_code": item.permission_code}
        for item in db_get_user_service_permissions(session, user_id_target)
    ]
    permission_include_by_code = {}
    for item in db_get_permission_include(session):
        permission_include_by_code.setdefault(item.permission_code, []).append(item.permission_code_included)
    permission_include_by_service_code = {}
    for item in db_get_service_permission_include(session):
        include_by_code = permission_include_by_service_code.setdefault(item.service_id, {})
        include_by_code.setdefault(item.permission_code, []).append(item.permission_code_included)

    is_accepted, message = can_accept_permission_update(
        user_id,
        user_id_target,
        permissions_current,
        permission_codes_target_current,
        service_permissions_target_current,
        permission_codes_target_next,
        service_permissions_target_next,
        PERMISSION_CODE_USER_EDIT,
        PERMISSION_CODE_USER_MANAGE,
        permission_include_by_code,
        permission_include_by_service_code,
    )
    if not is_accepted:
        return {"success": False, "message": message}
    return {"success": True, "message": "Permission update accepted"}


def declare_service_permission(
    config,
    session,
    service_id: str,
    permission_code: int,
    display_name: str,
    description: str,
    permission_codes_included: list[int] | None = None,
) -> dict:
    service_id = (service_id or "").strip()
    if not validate_service_id(service_id):
        return {"success": False, "message": "Invalid service id"}

    if permission_code <= 0:
        return {"success": False, "message": "Permission code must be positive"}

    try:
        db_upsert_service_permission_meta(
            session,
            service_id,
            permission_code,
            display_name or str(permission_code),
            description or "",
        )
        db_set_service_permission_include(session, service_id, permission_code, permission_codes_included or [])
        return {"success": True, "message": "Service permission declared"}
    except Exception as e:
        session.rollback()
        return {"success": False, "message": str(e)}


def check_user_permission(config, session, uid: int, permission_code: int) -> bool:
    permission_codes = [item.permission_code for item in db_get_user_permissions(session, uid)]
    permission_include_by_code = {}
    for item in db_get_permission_include(session):
        permission_include_by_code.setdefault(item.permission_code, []).append(item.permission_code_included)
    return has_permission(permission_codes, permission_code, permission_include_by_code)


def check_user_service_permission(config, session, uid: int, service_id: str, permission_code: int) -> bool:
    service_permissions = [
        {"service_id": item.service_id, "permission_code": item.permission_code}
        for item in db_get_user_service_permissions(session, uid)
    ]
    permission_include_by_service_code = {}
    for item in db_get_service_permission_include(session):
        include_by_code = permission_include_by_service_code.setdefault(item.service_id, {})
        include_by_code.setdefault(item.permission_code, []).append(item.permission_code_included)
    return has_service_permission(
        service_permissions,
        service_id,
        permission_code,
        permission_include_by_service_code,
    )

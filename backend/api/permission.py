import re

SERVICE_ID_PATTERN = re.compile(r"^[0-9a-z]+$")


def validate_service_id(service_id: str) -> bool:
    if not service_id:
        return False
    return SERVICE_ID_PATTERN.fullmatch(service_id) is not None


def has_permission(permission_codes, permission_code_required, permission_include_by_code=None) -> bool:
    permission_code_set = {int(permission_code) for permission_code in permission_codes or []}
    permission_include_by_code = permission_include_by_code or {}

    if int(permission_code_required) in permission_code_set:
        return True

    permission_code_pending = list(permission_code_set)
    permission_code_checked = set()
    while permission_code_pending:
        permission_code = permission_code_pending.pop()
        if permission_code in permission_code_checked:
            continue
        permission_code_checked.add(permission_code)

        for permission_code_included in permission_include_by_code.get(permission_code, []):
            permission_code_included = int(permission_code_included)
            if permission_code_included == int(permission_code_required):
                return True
            permission_code_pending.append(permission_code_included)

    return False


def has_service_permission(
    service_permission_items,
    service_id,
    permission_code_required,
    permission_include_by_service_code=None,
) -> bool:
    permission_codes = [
        item.get("permission_code")
        for item in service_permission_items or []
        if item.get("service_id") == service_id
    ]
    permission_include_by_service_code = permission_include_by_service_code or {}
    permission_include_by_code = permission_include_by_service_code.get(service_id, {})
    return has_permission(permission_codes, permission_code_required, permission_include_by_code)


def get_permission_change_attempts(
    permission_codes_current,
    service_permissions_current,
    permission_codes_next,
    service_permissions_next,
) -> list[dict]:
    permission_code_set_current = {int(code) for code in permission_codes_current or []}
    permission_code_set_next = {int(code) for code in permission_codes_next or []}

    service_permission_set_current = {
        (str(item.get("service_id", "")).strip(), int(item.get("permission_code")))
        for item in service_permissions_current or []
    }
    service_permission_set_next = {
        (str(item.get("service_id", "")).strip(), int(item.get("permission_code")))
        for item in service_permissions_next or []
    }

    attempts = []
    for permission_code in sorted(permission_code_set_next - permission_code_set_current):
        attempts.append({
            "action": "add",
            "scope": "builtin",
            "permission_code": permission_code,
        })
    for permission_code in sorted(permission_code_set_current - permission_code_set_next):
        attempts.append({
            "action": "remove",
            "scope": "builtin",
            "permission_code": permission_code,
        })
    for service_id, permission_code in sorted(service_permission_set_next - service_permission_set_current):
        attempts.append({
            "action": "add",
            "scope": "service",
            "service_id": service_id,
            "permission_code": permission_code,
        })
    for service_id, permission_code in sorted(service_permission_set_current - service_permission_set_next):
        attempts.append({
            "action": "remove",
            "scope": "service",
            "service_id": service_id,
            "permission_code": permission_code,
        })
    return attempts


def can_accept_permission_change_attempt(
    user_id,
    user_id_target,
    permissions_current,
    permission_change_attempt,
    permission_code_edit_required,
    permission_code_manage_all,
    permission_include_by_code=None,
    permission_include_by_service_code=None,
) -> tuple[bool, str]:
    permission_codes_current = permissions_current.get("permission_codes") or []
    service_permissions_current = permissions_current.get("service_permissions") or []
    permission_include_by_code = permission_include_by_code or {}
    permission_include_by_service_code = permission_include_by_service_code or {}

    if not has_permission(permission_codes_current, permission_code_edit_required, permission_include_by_code):
        return False, "User edit permission is required."

    if has_permission(permission_codes_current, permission_code_manage_all, permission_include_by_code):
        return True, ""

    scope = permission_change_attempt.get("scope")
    permission_code = int(permission_change_attempt.get("permission_code"))
    if scope == "builtin":
        if has_permission(permission_codes_current, permission_code, permission_include_by_code):
            return True, ""
        return False, f"Cannot change built-in permission {permission_code} without holding it."

    if scope == "service":
        service_id = str(permission_change_attempt.get("service_id") or "").strip()
        if has_service_permission(
            service_permissions_current,
            service_id,
            permission_code,
            permission_include_by_service_code,
        ):
            return True, ""
        return False, f"Cannot change service permission {service_id}::{permission_code} without holding it."

    return False, "Unknown permission change scope."


def can_accept_permission_update(
    user_id,
    user_id_target,
    permissions_current,
    permission_codes_target_current,
    service_permissions_target_current,
    permission_codes_target_next,
    service_permissions_target_next,
    permission_code_edit_required,
    permission_code_manage_all,
    permission_include_by_code=None,
    permission_include_by_service_code=None,
) -> tuple[bool, str]:
    attempts = get_permission_change_attempts(
        permission_codes_target_current,
        service_permissions_target_current,
        permission_codes_target_next,
        service_permissions_target_next,
    )
    for attempt in attempts:
        is_accepted, message = can_accept_permission_change_attempt(
            user_id,
            user_id_target,
            permissions_current,
            attempt,
            permission_code_edit_required,
            permission_code_manage_all,
            permission_include_by_code,
            permission_include_by_service_code,
        )
        if not is_accepted:
            return False, message
    return True, ""

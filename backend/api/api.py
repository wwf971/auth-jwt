"""
Authentication API facade.

Business logic lives in feature modules under api/. Import from this module only.
"""

from __future__ import annotations

from api.api_db import init_database
from api.api_user import (
    login_user,
    add_user,
    get_uid_of_username,
    get_username_of_uid,
    is_config_manage_user,
    is_config_manage_user_uid,
    delete_user,
    get_all_users,
)
from api.api_key import (
    generate_rsa_key_pair,
    get_or_create_key_pair,
    get_private_key,
    get_public_key,
    get_jwks,
)
from api.api_token import (
    issue_jwt_token,
    issue_temp_token,
    verify_jwt_token_with_public_key,
    get_uid_from_token,
    verify_jwt_token,
    get_token_user,
    get_token_info,
    revoke_token,
    revoke_token_by_value,
    delete_token,
    cleanup_tokens,
)
from api.api_permission_ops import (
    get_permission_data,
    update_user_permissions,
    authorize_user_permission_update,
    declare_service_permission,
    check_user_permission,
    check_user_service_permission,
)
from api.api_config_db import (
    get_database_list,
    get_current_database_id,
    add_database,
    remove_database,
    update_database,
    change_current_database,
)

__all__ = [
    "init_database",
    "login_user",
    "add_user",
    "get_uid_of_username",
    "get_username_of_uid",
    "is_config_manage_user",
    "is_config_manage_user_uid",
    "delete_user",
    "get_all_users",
    "generate_rsa_key_pair",
    "get_or_create_key_pair",
    "get_private_key",
    "get_public_key",
    "get_jwks",
    "issue_jwt_token",
    "issue_temp_token",
    "verify_jwt_token_with_public_key",
    "get_uid_from_token",
    "verify_jwt_token",
    "get_token_user",
    "get_token_info",
    "revoke_token",
    "revoke_token_by_value",
    "delete_token",
    "cleanup_tokens",
    "get_permission_data",
    "update_user_permissions",
    "authorize_user_permission_update",
    "declare_service_permission",
    "check_user_permission",
    "check_user_service_permission",
    "get_database_list",
    "get_current_database_id",
    "add_database",
    "remove_database",
    "update_database",
    "change_current_database",
]

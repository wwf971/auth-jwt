# Authorization

Authorization means checking whether a signed-in user can do one action.

The auth service uses permission codes for authorization. A permission code is an integer. The code itself is the stable value used by DB and API. Display name and description are metadata for UI and humans.

Authentication and authorization are separate:

- Authentication checks username, password, and JWT token.
- Authorization checks permission assignments after the user is known.

JWT tokens identify the user. They do not contain the user's permission list. Permission assignments stay in DB, so changing a user's permission does not require reissuing all tokens.

## Core Model

There are two kinds of permissions.

Built-in permissions belong to `auth-jwt` itself. They control management operations such as user list, user create, user edit, and user delete.

Service-scoped permissions belong to another service. The identity of a service-scoped permission is:

```text
service_id + permission_code
```

The UI may display it as:

```text
serviceId::permissionCode
```

The DB stores `service_id` and `permission_code` separately. `permission_code` remains an integer.

## Built-in Permissions

Current built-in user management permissions:

```text
1001 User Read
1002 User Create
1003 User Edit
1004 User Delete
1099 User Manage
1101 Token Read
1102 Token Issue
1103 Token Revoke
1104 Token Delete
1199 Token Manage
```

`1099` includes the four smaller user permissions and `1199`. `1199` includes the four smaller token permissions.

## Permission Include

A permission can include other permissions.

Example:

```text
1099 includes 1001
1099 includes 1002
1099 includes 1003
1099 includes 1004
```

When checking permission, the service checks the user's assigned permission codes and the include relationship. This makes it possible to assign one broader permission instead of assigning many small permissions one by one.

Include relationship is not a UI label. It is part of authorization logic.

## Service-scoped Permissions

External services can declare custom permissions. A custom permission has:

- `service_id`
- integer `permission_code`
- display name
- description
- optional include relationship inside the same service

`service_id` should be lowercase `0-9a-z`. It should not encode extra semantic prefix or suffix. The service id is only a namespace to prevent two services from using the same integer code for different meanings.

For example, two services can both use permission code `1001`, because they live under different service ids:

```text
fileservice::1001
flowservice::1001
```

These are different permissions.

## DB Tables

Authorization data is stored in six tables.

`permission_meta` stores built-in permission metadata:

```text
permission_code
display_name
description
```

`permission_include` stores built-in include relationship:

```text
permission_code
permission_code_included
```

`user_permission` stores built-in permission assignments:

```text
uid
permission_code
```

`service_permission_meta` stores service-scoped permission metadata:

```text
service_id
permission_code
display_name
description
```

`service_permission_include` stores service-scoped include relationship:

```text
service_id
permission_code
permission_code_included
```

`user_service_permission` stores service-scoped permission assignments:

```text
uid
service_id
permission_code
```

The user is always the owner of a permission assignment. A service declares a permission, but it does not own the assignment.

## Management Console Authorization

The management console uses DB users and JWT login. After login, management requests send the JWT token to the management API.

Management user APIs check built-in permissions:

```text
GET    /manage/api/users                    requires 1001
POST   /manage/api/users                    requires 1002
PUT    /manage/api/users/<uid>/permissions  requires 1003
DELETE /manage/api/users/<uid>              requires 1004
```

Token management APIs check built-in token permissions:

```text
POST   /manage/api/tokens/issue          requires 1102
GET    /manage/api/tokens/<jti>          requires 1101
POST   /manage/api/tokens/<jti>/revoke   requires 1103
DELETE /manage/api/tokens/<jti>          requires 1104
POST   /manage/api/tokens/cleanup        requires 1104
```

To avoid locking out an existing DB, the auth service grants `1099` to the first existing DB user when no user has built-in permission assignments yet.

Users declared in config with role `manage` are protected bootstrap users. The auth service creates or updates them from config and grants them `1099`. Their permission assignments cannot be edited from the management API, and they cannot be deleted from the management API.

### Permission Edit Authorization

The permission edit API receives the target user's next full permission assignment. The authorization logic first compares current assignment and next assignment, then turns the difference into simple change attempts.

The core decision shape is:

```text
user_id
user_id_target
permissions_current
permission_change_attempt
```

`user_id` is the signed-in user making the request. `user_id_target` is the user whose permissions are being changed. When they are equal, the user is changing its own permissions.

`permissions_current` is the signed-in user's current built-in and service-scoped permissions.

`permission_change_attempt` describes one add or remove:

```text
action: add | remove
scope: builtin | service
permission_code: integer
service_id: string, only for service-scoped permission
```

Rules:

- A configured manage user's permissions cannot be edited.
- The signed-in user must have `1003 User Edit` for every permission edit.
- A user with `1099 User Manage` can add or remove any permission assignment.
- A user without `1099` can only add or remove permissions that it already has through direct assignment or include relationship.
- The same rule applies to service-scoped permissions. A user without `1099` can only change a service-scoped permission if it already has that service-scoped permission.

This prevents a user from granting itself or another user permissions it does not already hold.

## API Surface

The gRPC API exposes authorization operations:

```text
GetPermissionData
DeclareServicePermission
UpdateUserPermissions
CheckPermission
```

`GetPermissionData` returns built-in permission metadata, service-scoped permission metadata, and include relationships.

`DeclareServicePermission` creates or updates one service-scoped permission declaration.

`UpdateUserPermissions` replaces one user's built-in and service-scoped permission assignments after permission edit authorization accepts the change.

`CheckPermission` checks whether a user has one built-in permission or one service-scoped permission.

The management HTTP API wraps these gRPC methods for the management UI:

```text
GET  /manage/api/permissions
POST /manage/api/service_permissions
PUT  /manage/api/users/<uid>/permissions
```

## Permission Check Logic

Permission check is intentionally kept outside request handlers. The core functions are in `backend/api/permission.py`.

For built-in permission, the checker receives:

```text
assigned permission codes
required permission code
include relationship
```

For service-scoped permission, the checker also receives `service_id`, so permission code is checked inside the correct service namespace.

The important rule is:

```text
assigned permission passes if it is the required permission, or if it includes the required permission
```

This keeps request handlers simple. A handler only decides which permission is required by the action.

Permission edit authorization is also kept outside request handlers. The core helper is in `backend/api/permission.py`. The management HTTP API loads current user permissions and target user permissions, builds change attempts from the requested final assignment, then accepts or rejects each attempt before the DB update runs.

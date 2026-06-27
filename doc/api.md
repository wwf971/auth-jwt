# API

`auth-jwt` exposes both HTTP and gRPC APIs.

Use HTTP when integrating browser apps or simple services. Use gRPC when another backend service wants typed RPC calls.

## User Login And Token Issue

HTTP:

```text
POST /api/login
```

Request:

```json
{
  "username": "alice",
  "password": "password"
}
```

Success response:

```json
{
  "code": 0,
  "message": "Login successful",
  "data": {
    "token": "<jwt-token>",
    "expires_at": 1780000000,
    "username": "alice"
  }
}
```

gRPC:

```text
AuthService.Login(LoginRequest)
```

This checks username and password, creates a signed JWT token, stores token metadata in DB, and returns the token.

## Token Verification

HTTP:

```text
POST /api/verify_jwt_token
```

Request:

```json
{
  "session_token": "<jwt-token>"
}
```

Success response:

```json
{
  "code": 0,
  "message": "Session is valid",
  "data": {
    "valid": true,
    "username": "alice"
  }
}
```

gRPC:

```text
AuthService.ValidateSession(ValidateSessionRequest)
```

This verifies token signature and expiration. The internal verification path also checks whether the token id has been revoked.

## Logout

HTTP:

```text
POST /api/logout
```

gRPC:

```text
AuthService.Logout(LogoutRequest)
```

Logout exists in the API surface. Full token revoke behavior should be treated carefully when adding SSO logout behavior, because a token may be shared by several services.

## Management APIs

The management UI uses APIs under `/manage/api`.

User management:

```text
GET    /manage/api/users
POST   /manage/api/users
PUT    /manage/api/users/<uid>/permissions
DELETE /manage/api/users/<uid>
```

User management APIs require built-in auth permissions. For example, listing users requires user read permission, creating users requires user create permission, editing permission assignments requires user edit permission, and deleting users requires user delete permission.

Token management:

```text
POST /manage/api/tokens/issue
GET  /manage/api/tokens/<jti>
DELETE /manage/api/tokens/<jti>
```

Permission metadata:

```text
GET  /manage/api/permissions
POST /manage/api/service_permissions
```

`/manage/api/service_permissions` declares a permission code for an external service. It does not assign that permission to a service account. Permission assignments belong to users.

DB endpoint management:

```text
GET    /manage/api/databases
POST   /manage/api/databases
PUT    /manage/api/databases/<db_id>
DELETE /manage/api/databases/<db_id>
POST   /manage/api/databases/<db_id>/test
POST   /manage/api/databases/switch/<db_id>
```

Server status:

```text
GET /manage/api/server_status/aux
GET /manage/api/server_status/grpc
GET /manage/api/server_status/http
```

## Typical SSO Process

Login:

1. App sends username and password to `/api/login`.
2. Auth service returns a JWT token.
3. App stores the token and sends it with later requests.

Request auth:

1. App backend receives a request with token.
2. App backend sends token to `/api/verify_jwt_token`, or calls gRPC `ValidateSession`.
3. If response code is `0`, the request is treated as authenticated.
4. If the action needs authorization, the app backend checks whether the user has the needed built-in or service-scoped permission.
5. If response code is negative, the request is rejected.

Token issue from management page:

1. Operator creates a user.
2. Operator issues a token for the user.
3. The token can be used by another service if that service accepts pre-issued tokens.

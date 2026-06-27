# auth-jwt

`auth-jwt` is a shared authentication service for small services that should use the same sign-in state.

The main idea is simple:

- A user signs in once with username and password.
- The auth service returns a JWT token.
- Other services receive this token from browser requests.
- Other services ask `auth-jwt` to verify the token before allowing protected operations.

This makes a basic SSO flow possible. Each app does not need to keep its own user table or duplicate login logic. It only needs to know how to get a token and how to verify it.

## Core Concepts

`auth-jwt` has four core concepts:

- User is the identity.
- Token proves that the user has signed in.
- Permission says what the user can do.
- Service is an app that uses the auth service.

Authentication answers "who is this user". Authorization answers "can this user do this action". A service should check both when an operation is protected.

### User

User is the identity that signs in to the system.

Basic properties:

- `uid`: internal numeric user id
- `username`: human-readable login name
- `password`: stored as bcrypt hash in DB

The auth service owns the user table. Other services should not duplicate user password checking. They should trust token verification result from this service.

Users can carry permission assignments. A built-in permission applies to this auth service itself, such as creating or deleting users. A service-scoped permission applies to one external service.

### Service

Service means an external app that uses this auth service, such as a file service or a workflow service.

A service is not the same thing as a user. A service does not sign in as a person in the normal flow. A service sends users to this auth service for login, receives or verifies JWT tokens, and checks if the signed-in user has the permission needed for one action.

When a service needs its own permission, it declares a service id and integer permission code. The displayed form is:

```text
serviceId::permissionCode
```

The auth database stores `service_id` and `permission_code` as separate values. The permission assignment still belongs to a user.

### Permission

Permission is a code that says what a user can do.

Built-in auth permissions are integer codes owned by the auth service. Service-scoped permissions are integer codes under one service id. A service-scoped permission is declared by a service, then assigned to users.

One permission can include other permissions. For example, user manage permission includes user read, user create, user edit, and user delete. Permission check therefore does not only compare one code with another code. It checks whether any assigned permission directly or indirectly includes the required permission.

JWT tokens do not carry permission lists. The auth service keeps permission assignments in DB and checks them when management APIs or other services ask for authorization.

### Token

Token is the short text string that proves a user has signed in.

The service token is a JWT string. It has three parts:

```text
<header>.<claims>.<signature>
```

The claims include:

- `uid`: user id
- `jti`: token id
- `iat`: issue time
- `exp`: expiration time

The signature is created by the auth service. Other services should not edit a token. They should only send it back for verification.

### Key Pair

The key pair is used to sign and verify JWT tokens.

- private key signs token
- public key verifies token

The private key must stay inside the auth service. The public key can be used for verification.

### Auth Service

The auth service is the source of truth for users, token records, and token revocation state.

It provides:

- login API to issue token
- verify API to check token
- management console to operate users, DB endpoints, and token records
- permission metadata and permission check API

For more details about permission schema, built-in permission codes, and service-scoped permission declaration, see `authorization.md`.

## SSO Flow

A typical service uses `auth-jwt` like this:

1. Login page sends username and password to `auth-jwt`.
2. `auth-jwt` checks the user and returns a JWT token.
3. The browser stores the token.
4. Browser requests to other services include the token.
5. Each service verifies the token with `auth-jwt`.
6. If the action needs authorization, the service checks whether the user has the needed permission.
7. If token verification and permission check pass, the service accepts the request.

The token contains claims such as user id, token id, issue time, and expiration time. The token is signed by the auth service.

## Service Integration

For a browser-based app, use the HTTP API:

```text
POST /api/login
POST /api/verify_jwt_token
POST /api/logout
```

For backend-to-backend usage, use either:

- HTTP API when the caller is simple and already uses REST.
- gRPC API when the caller wants typed RPC methods and lower overhead.

## Management Console

The management console is for operating the auth service itself:

- check process status
- check configured DB endpoints
- list users
- create users
- issue and inspect JWT tokens
- view current runtime config

The console uses DB users and JWT login too. Management operations then check built-in auth permissions, such as user create or user delete.

See `deploy.md` for local launch and endpoint information.

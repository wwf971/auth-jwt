# auth-jwt

`auth-jwt` is a shared authentication service for small services that should use the same sign-in state.

The main idea is simple:

- A user signs in once with username and password.
- The auth service returns a JWT token.
- Other services receive this token from browser requests.
- Other services ask `auth-jwt` to verify the token before allowing protected operations.

This makes a basic SSO flow possible. Each app does not need to keep its own user table or duplicate login logic. It only needs to know how to get a token and how to verify it.

## Core Concepts

### User

User is the identity that signs in to the system.

Basic properties:

- `uid`: internal numeric user id
- `username`: human-readable login name
- `password`: stored as bcrypt hash in DB

The auth service owns the user table. Other services should not duplicate user password checking. They should trust token verification result from this service.

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

## SSO Flow

A typical service uses `auth-jwt` like this:

1. Login page sends username and password to `auth-jwt`.
2. `auth-jwt` checks the user and returns a JWT token.
3. The browser stores the token.
4. Browser requests to other services include the token.
5. Each service verifies the token with `auth-jwt`.
6. If token verification succeeds, the service accepts the request.

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

The console login is not the same thing as SSO login for application users. The console login only protects the management page.

The console session token is a random management-page token. It is different from an application JWT token. It should not be used by other services for SSO.

See `deploy.md` for local launch and endpoint information.

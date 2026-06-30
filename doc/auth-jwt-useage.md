# auth-jwt Usage Notes

`auth-jwt` is intended to be the shared sign-in service for small apps.
An app should keep only app-specific authorization and data logic locally.
Username/password checking and long-lived token validation should stay in `auth-jwt`.

## Normal Flow

The normal browser flow is:

1. The user logs in with username and password.
2. The app backend calls `auth-jwt` and receives a long-lived `token`.
3. The frontend stores this `token`.
4. Before calling protected app APIs, the frontend asks the app backend for a short-lived `temporary token`.
5. Protected app APIs receive the `temporary token` and verify it.

The important rule is:

```text
stored token -> temporary token -> protected app API
```

The stored token is for login state. The temporary token is for app API access.

## Frontend Store

Frontend apps should use `createAuthStore` from `@wwf971/react-comp-misc`.

The app still needs a small local configuration layer:

```text
createAuthStore({
  storageKey,
  autoLoginStorageKey,
  endpoints,
  requestJsonData
})
```

Keep this layer small. It should only adapt local endpoint paths and response shape.
Do not re-implement login state, token storage, auto-login, password visibility, or sign-out logic in every app.

## Login Requests Must Not Need A Service Token

Login endpoints are special in one way: they must not try to get a temporary token before making the request.

These endpoints should use the stored token or username/password directly:

```text
/login
/login/token
/login/temporary-token
/logout
```

If a request helper calls `getServiceToken()` while it is already requesting `/login/temporary-token`, it can create a loop:

```text
getServiceToken
-> request /login/temporary-token
-> request helper tries getServiceToken again
-> repeated 401 responses
```

This can make the page stay on `loading` for a long time and flood the console with `/login/temporary-token` 401 errors.

Request helpers should detect login endpoints and skip service-token injection for them.

## Always Send JSON As JSON

When a helper adds `authToken` into a POST body, it must also set:

```text
Content-Type: application/json
```

This matters even when the original request had no body.

Bad behavior:

```text
POST /api/some/protected-route
body: {"authToken":"..."}
missing Content-Type
```

Some backends will not parse the body. Then the backend sees no auth token and returns 401.
This can look like a token verification problem, even though the real problem is request formatting.

## Prefer POST Body Auth For Protected App APIs

For protected app APIs, send the temporary token in the JSON body:

```json
{
  "authToken": "<temporary-token>"
}
```

This is more robust behind CloudFront and reverse proxies than depending on custom headers or query strings.

Custom headers and query strings can still be supported as fallbacks, but the main browser path should be POST JSON body auth.

## Service-To-Service Calls Must Use Temporary Tokens

When one protected service calls another protected service on behalf of the current user, the caller should pass a temporary token to the downstream service.

The common mistake is forwarding the stored token directly:

```text
browser -> service A with stored token
service A -> service B with same stored token
service B returns 401
```

The correct flow is:

```text
browser -> service A with authToken
service A reads authToken from POST JSON body
service A checks if it is already a temporary token
service A exchanges stored token for temporary token when needed
service A -> service B with temporary token
```

For POST requests, service A should pass the downstream temporary token in the JSON body as `authToken`. Sending it in `Authorization: Bearer <token>` is fine as a fallback, but the JSON body path should still work.

## Be Careful With GET Endpoints

A JSON body should not be used with GET.

If a protected endpoint needs auth from JSON body, expose a POST route for it.
For list/read operations, keeping a GET alias is fine, but the browser app should call the POST form.

Example:

```text
GET  /vault/list          optional compatibility route
POST /vault/list          browser app route with authToken in JSON body
```

The same applies to routes such as presets, overview lists, slide data, and file metadata.

## Temporary Token Verification

Backends usually have two choices when verifying a temporary token:

1. Verify locally with the auth service public key.
2. Ask `auth-jwt` to verify.

Local verification is faster and avoids a network call, but it can fail when key discovery, key rotation, or algorithm handling is wrong.

If local verification fails but verification by `auth-jwt` succeeds, the service should allow the request but log a warning. This means the auth flow works, but local verification is not correctly aligned with the auth service.

The warning should be visible in backend logs. It should not be hidden as a generic frontend message like `Session expired`.

## Error Messages Should Point To The Failing Step

Avoid turning all 401 responses into one generic message.

Different failures mean different things:

```text
login failed
stored token is expired or invalid
temporary token could not be issued
protected request has no auth token
temporary token verification failed
```

The frontend should clear the session when a protected app API returns 401.
It should not immediately clear the session when a login helper endpoint returns 401. For login helper endpoints, show the actual error message so the user can understand which step failed.

## Auto Login With Token

Auto login should be controlled by a local boolean preference.

When enabled, the login page may briefly appear and then redirect if the stored token is valid.
When disabled, the app should stay on the login page even if a token exists.

The "go to login page" action should keep the token but disable auto login.
The "sign out" action should clear the token.

## Backend Logic Is Still Local

`createAuthStore` only shares frontend login state logic.

Backends still implement their auth adapter locally. For example, Flask services and Express services each need code for:

- `/login`
- `/login/token`
- `/login/temporary-token`
- `/logout`
- token extraction from request
- protected-route verification

Because this logic is very similar across services, a future shared backend helper would be useful.
Until then, keep backend auth code close to the same shape in every service.

## Integration Checklist

Before treating an app as integrated with `auth-jwt`, check these points:

- Frontend uses `createAuthStore`.
- Login endpoints do not call `getServiceToken()`.
- Protected POST requests include `authToken` in JSON body.
- Service-to-service calls exchange stored tokens for temporary tokens before calling another protected service.
- Any helper-created JSON body has `Content-Type: application/json`.
- Protected read endpoints have POST routes if browser auth uses JSON body.
- Backend extracts auth from JSON body before cookie fallback.
- Temporary token issue failures are visible as specific messages.
- Protected route 401 clears the session, but login helper 401 shows the original message.
- Local temporary-token verification fallback is logged as a warning if external verification succeeds.
- Auto-login can be disabled without deleting the stored token.

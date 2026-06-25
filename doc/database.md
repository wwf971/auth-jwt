# Database

The database is the source of truth for auth runtime data.

Config is not stored in the database. Config is loaded from YAML files:

```text
config/config.yaml
config/config.0.yaml
```

## Tables

`users`

- stores user id
- stores username
- stores bcrypt password hash

`jwt_tokens`

- stores token id
- links token to user id
- stores token string
- stores creation and expiration timestamps
- records whether token is revoked

`key_pairs`

- stores RSA private and public key material
- records which key pair is active
- allows generated signing keys to survive restart

## DB Endpoint Config

DB endpoints are configured under `config_dbs`.

Example:

```yaml
config_dbs:
  auth-postgres:
    id: 0
    host: "127.0.0.1"
    port: 5432
    db_name: "service_auth"
    username: "postgres"
    password: "postgres"
    type: "postgresql"
    is_default: true
    is_removable: false
```

Local overrides belong in `config/config.0.yaml`.

## Startup Behavior

When the active DB is PostgreSQL, the backend tries to ensure the configured database exists before creating tables.

If the DB endpoint is unreachable, gRPC still starts. DB-backed calls fail until DB connection works. The management page can still show server status and configured DB endpoints.

## Local SQLite

SQLite can be used for a fully local test:

```yaml
config_dbs:
  auth-sqlite:
    id: 0
    name: "Local SQLite"
    type: "sqlite"
    path: "./data/auth.db"
    is_default: true
    is_removable: false
```

SQLite writes to local disk and is only suitable for local development.

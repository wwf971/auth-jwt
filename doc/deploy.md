# Deploy

## Local Test Server

Start local test server:

```bash
./launch.sh test
```

Or from the common launcher:

```bash
launch-dev auth
```

Default local endpoints:

- management page: `http://localhost:9530/manage/`
- HTTP auth API: `http://localhost:9531`
- gRPC auth API: `localhost:9532`
- auxiliary API: `localhost:9533`

The management console account comes from `config/config.yaml` plus local override `config/config.0.yaml`.

## Local Config

Tracked default config:

```text
config/config.yaml
```

Local override config:

```text
config/config.0.yaml
```

Use `config/config.0.yaml` for local DB endpoint, username, password, and local manage account.

## Port Rule

When `PORT` is `9530`, server ports are:

- management server: `9530`
- HTTP server: `9531`
- gRPC server: `9532`
- auxiliary server: `9533`

If a different `PORT` is passed to `launch.sh test --port`, the other ports are assigned by adding `1`, `2`, and `3`.

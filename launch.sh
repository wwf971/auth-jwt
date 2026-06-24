#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

show_usage() {
  echo "Usage: ./launch.sh <command> [options]"
  echo "Commands:"
  echo "  test [--port N] [--dry-run]   Build frontend and launch local test server"
}

validate_port() {
  local port="$1"
  if ! [[ "$port" =~ ^[0-9]+$ ]] || (( port < 1 || port > 65535 )); then
    echo "Invalid port: $port"
    exit 1
  fi
}

command_name="${1:-}"
if [[ -z "$command_name" ]]; then
  show_usage
  exit 1
fi
shift

case "$command_name" in
  test)
    port="9530"
    args=()
    while [[ $# -gt 0 ]]; do
      case "$1" in
        --port)
          port="${2:-}"
          if [[ -z "$port" ]]; then
            echo "Missing value for --port"
            exit 1
          fi
          validate_port "$port"
          shift 2
          ;;
        --dry-run)
          args+=("--dry-run")
          shift
          ;;
        *)
          echo "Unknown option for test: $1"
          show_usage
          exit 1
          ;;
      esac
    done
    if [[ ${#args[@]} -gt 0 ]]; then
      exec env PORT="$port" bash "$ROOT_DIR/script/launch-test.sh" "${args[@]}"
    fi
    exec env PORT="$port" bash "$ROOT_DIR/script/launch-test.sh"
    ;;
  *)
    echo "Unknown command: $command_name"
    show_usage
    exit 1
    ;;
esac

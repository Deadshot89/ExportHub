#!/usr/bin/env sh
set -eu
if ! command -v gradle >/dev/null 2>&1; then
  echo "Gradle 9.5.0 ist lokal nicht installiert. Nutze den enthaltenen GitHub-Workflow oder Android Studio."
  exit 1
fi
exec gradle "$@"

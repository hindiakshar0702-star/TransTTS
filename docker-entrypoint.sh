#!/bin/sh
# Applies pending database migrations, then hands off to the Next server.
#
# `migrate deploy` only replays committed migration files — it never generates
# or resets anything, so it is safe to run on every boot. If it fails the
# container exits instead of serving traffic against a stale schema.
set -e

if [ -n "$DATABASE_URL" ]; then
  echo "[entrypoint] applying database migrations..."
  # Invoked directly rather than through node_modules/.bin, which is a symlink
  # farm that does not survive into the slim runtime image.
  node ./node_modules/prisma/build/index.js migrate deploy
else
  echo "[entrypoint] DATABASE_URL is not set — refusing to start." >&2
  exit 1
fi

echo "[entrypoint] starting server on ${HOSTNAME:-0.0.0.0}:${PORT:-3000}"
exec "$@"

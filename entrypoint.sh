#!/bin/sh
set -e

# Apply any pending migrations before starting the server (idempotent)
npx prisma migrate deploy

# Launch the Next.js standalone server
exec node server.js

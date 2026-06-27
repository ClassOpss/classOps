#!/bin/sh
set -e

# Apply any pending migrations before starting the server (idempotent).
# Invoke the Prisma CLI directly with node — the standalone runner image copies the
# prisma package but not node_modules/.bin, so `npx prisma` / bare `prisma` aren't on PATH.
node node_modules/prisma/build/index.js migrate deploy --schema=./prisma/schema.prisma

# Launch the Next.js standalone server
exec node server.js

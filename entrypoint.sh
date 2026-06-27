#!/bin/sh
set -e

# Apply any pending migrations before starting the server (idempotent).
# Call the Prisma CLI directly: the slim runner image has the `prisma` package
# but not the node_modules/.bin/prisma symlink, so `npx prisma` can't resolve it.
node node_modules/prisma/build/index.js migrate deploy

# Launch the Next.js standalone server
exec node server.js

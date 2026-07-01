#!/bin/bash
set -e

npm install

echo "Skipping automatic npm run db:push."
echo "Database migrations must be reviewed manually before running, especially when Drizzle proposes DROP TABLE or CASCADE."

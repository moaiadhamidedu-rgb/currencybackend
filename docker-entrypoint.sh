#!/bin/sh
set -eu

mkdir -p /app/data
if [ ! -f /app/data/dev.db ]; then
  cp /app/template.db /app/data/dev.db
fi

exec node dist/src/main.js

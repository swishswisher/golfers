#!/usr/bin/env bash
set -euo pipefail
umask 077
: "${DATABASE_URL:?Set the PostgreSQL backup-role URI}"
: "${BACKUP_RECIPIENT:?Set an age public recipient key}"
: "${BACKUP_DIRECTORY:?Set a private backup directory}"
command -v pg_dump >/dev/null
command -v age >/dev/null
mkdir -p "$BACKUP_DIRECTORY"
backup_stamp=$(date -u +%Y%m%dT%H%M%SZ)
pg_dump --dbname="$DATABASE_URL" --format=custom --no-owner | age -r "$BACKUP_RECIPIENT" > "$BACKUP_DIRECTORY/clubline-$backup_stamp.dump.age"
# The same scheduled backup must include App__DataPath/files and keys.
: "${APP_DATA_PATH:?Set the API data directory (files and Data Protection keys)}"
tar -C "$APP_DATA_PATH" -czf - files keys | age -r "$BACKUP_RECIPIENT" > "$BACKUP_DIRECTORY/clubline-$backup_stamp.files.tar.gz.age"
printf 'Encrypted backup completed: %s\n' "$backup_stamp"

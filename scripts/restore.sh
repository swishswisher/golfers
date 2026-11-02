#!/usr/bin/env bash
set -euo pipefail
umask 077
: "${RESTORE_DATABASE_URL:?Set a NEW EMPTY recovery database URI}"
: "${BACKUP_IDENTITY_FILE:?Set the private age identity file path}"
: "${RESTORE_DATA_PATH:?Set a NEW empty API recovery directory}"
: "${1:?Pass the encrypted database dump}"
: "${2:?Pass the matching encrypted files archive}"
if [[ ${CONFIRM_EMPTY_RECOVERY_TARGET:-} != YES ]]; then
  printf 'Set CONFIRM_EMPTY_RECOVERY_TARGET=YES after checking the NEW EMPTY recovery target.\n' >&2
  exit 2
fi
if [[ -e "$RESTORE_DATA_PATH" ]]; then printf 'Recovery directory must not exist.\n' >&2; exit 2; fi
mkdir -p "$RESTORE_DATA_PATH"
age -d -i "$BACKUP_IDENTITY_FILE" "$1" | pg_restore --dbname="$RESTORE_DATABASE_URL" --no-owner --no-privileges --exit-on-error
age -d -i "$BACKUP_IDENTITY_FILE" "$2" | tar -C "$RESTORE_DATA_PATH" -xzf -
printf 'Restore completed. Verify integrity before routing traffic.\n'

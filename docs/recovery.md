# Backup and recovery

The authoritative recovery set is the PostgreSQL database plus the matching `App__DataPath/files` and `keys`. Data Protection keys decrypt queued payloads and protect account/session tokens. Losing them breaks existing sessions, pending verification/reset links and encrypted outbox recovery. File metadata alone cannot recover attachments.

`scripts/backup.sh` streams a custom-format `pg_dump` and files/keys archive through age public-key encryption. It requires `DATABASE_URL`, `BACKUP_RECIPIENT`, `BACKUP_DIRECTORY` and `APP_DATA_PATH`. Keep the age private identity away from the application host; restrict backup credentials and store encrypted results in a separate account/location. Do not commit credentials or dumps.

Schedule this through the host's scheduler or managed database backup service, never GitHub Actions. Proposed starting policy: daily encrypted snapshots, seven daily/four weekly/twelve monthly retention, with managed PostgreSQL point-in-time recovery enabled where available. These are operator configuration requirements, not schedules or backups already created by this repository. Set actual recovery-time/recovery-point objectives after measuring a restore.

For a consistent snapshot with local file storage, place the service in a maintenance window and pause writes while both archives are captured. Retain the matching deployment image, migrations and configuration version. Never restore directly over an active production database.

Restore drill:

1. Provision a new empty recovery database and a new empty filesystem path. Verify database connection/TLS and disk permissions.
2. Set `RESTORE_DATABASE_URL`, `BACKUP_IDENTITY_FILE`, `RESTORE_DATA_PATH` and `CONFIRM_EMPTY_RECOVERY_TARGET=YES`.
3. Run `scripts/restore.sh database.dump.age files.tar.gz.age`. The script refuses an existing recovery directory and does not use `--clean` or drop a database.
4. Start the matching application version against the recovered database/storage on an isolated origin, initially with workers disabled. Check migrations, counts, private file access, club isolation and sample messages/registration histories.
5. Inspect queued provider jobs and events before re-enabling workers. Retained operation keys must be preserved to avoid duplicate external operations. Confirm original Stripe/Resend credentials and webhook configuration separately.
6. Test recovery against the selected provider's sandbox, then make an explicit routing decision. Record duration, integrity checks and data-loss window.

The application restart persistence test was executed against the real staging PostgreSQL database. An encrypted `pg_dump`/filesystem restore drill was not executed because the execution environment did not provide the production host, backup target, age identity or PostgreSQL client utilities. Complete this operational acceptance before customer launch.

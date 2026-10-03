# Backup and Restore

EveryUp keeps the default Docker deployment state under `/app/data`.

That directory includes:

- `monitoring.db`, the SQLite database
- `.encryption_key`, the generated encryption key file for installations that do not set `EVERYUP_ENCRYPTION_KEY`

If `EVERYUP_ENCRYPTION_KEY` is set, keep that secret in your deployment secret store or backup process. A database backup alone is not enough to restore encrypted values without the matching key material.

## Backup

Stop the container before copying the data directory so the SQLite files are copied together.

```bash
docker stop everyup
docker cp everyup:/app/data/. ./everyup-data-backup
docker start everyup
```

For Docker Compose, the default service name and container name are also `everyup`, so the same commands work with the checked-in compose file.

## Restore

Restore into a stopped EveryUp container before starting it.

```bash
docker stop everyup
docker cp ./everyup-data-backup/. everyup:/app/data/
docker start everyup
```

After restore, sign in and verify at least one saved integration or notification channel that depends on encrypted values. When restoring a deployment that uses `EVERYUP_ENCRYPTION_KEY`, start it with the same key value that protected the backup.

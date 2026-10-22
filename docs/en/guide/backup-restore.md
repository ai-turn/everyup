# Backup and restore

Run these commands **on the dashboard server** that runs the EveryUp Web container.
In the default Docker deployment, `/app/data` is the data directory inside that container.

That directory includes:

- `monitoring.db`, the SQLite database
- `.encryption_key`, the generated encryption key file for installations that do not set `EVERYUP_ENCRYPTION_KEY`

If you set `EVERYUP_ENCRYPTION_KEY`, keep that key separately along with the data directory backup.
Without the same key, restoring the database cannot decrypt stored Bot Tokens, Webhook URLs, and other secrets.

## Backup

Stop the container before copying the data directory so the SQLite files are copied together.
The backup is saved to `everyup-data-backup` under the directory where you run the command.

```bash
docker stop everyup
docker cp everyup:/app/data/. ./everyup-data-backup
docker start everyup
```

For Docker Compose, the default service name and container name are also `everyup`, so the same commands work with the checked-in compose file.

## Restore

Place the backup directory on the dashboard server. If you used `EVERYUP_ENCRYPTION_KEY`, configure
the same key used for the backup before restoring. Stop the container, restore the data, then start it.

```bash
docker stop everyup
docker cp ./everyup-data-backup/. everyup:/app/data/
docker start everyup
```

After restore, sign in and use **테스트** (Test) in the notification channel list to confirm delivery.
If the encryption key does not match, the Bot Tokens and Webhook URLs stored in channels cannot be read.

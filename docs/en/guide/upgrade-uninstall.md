# Upgrade and uninstall

Web and the Docker Collector use `latest` images. Upgrading means pulling the new images and
recreating the containers; collected data and settings are kept.

The bundle's eBPF Observer (`everyup-ebpf`) is pinned to a tested version, so `pull` does not change
it. After upgrading Web, generate the install command again from that Web and run it to move to
the version the new Web was tested with.

## Upgrade Web {#upgrade-web}

**On the dashboard server**, go to the `everyup` directory you created in the Quick Start:

```bash
cd everyup
docker compose pull
docker compose up -d
```

Data lives in the `everyup-data` volume, so it survives the container being recreated. For an
important production deployment, take a [backup](./backup-restore) first.

## Upgrade the monitoring bundle {#upgrade-bundle}

**On the monitored server.** The installer's configuration files are readable by root only, so
`sudo` is required.

```bash
cd /opt/everyup-agent
sudo docker compose --env-file .env -f compose.yaml pull
sudo docker compose --env-file .env -f compose.yaml up -d
```

To change the collection scope or fetch fresh settings, you can also generate a new install
command in Web and run it. The installer backs up the existing `compose.yaml` as
`compose.yaml.bak.<timestamp>` before overwriting it.

## Uninstall the monitoring bundle {#uninstall-bundle}

**On the monitored server**, in this order:

1. If any app uses [header and body capture](./otel-instrumentation), restore its original
   configuration first. Run this for each app Compose file.

   ```bash
   sudo everyup-otel rollback ./docker-compose.yml
   ```

2. Remove the containers, the network, and the Collector's local state volume.

   ```bash
   sudo docker compose --env-file /opt/everyup-agent/.env -f /opt/everyup-agent/compose.yaml down -v
   ```

3. Remove the configuration directory and the CLI.

   ```bash
   sudo rm -rf /opt/everyup-agent
   sudo rm -f /usr/local/bin/everyup-otel
   ```

The installer never changed your app's Compose files, images, or containers, so there is nothing
else to revert.

To tidy up the dashboard too, open the environment from the **Docker 환경** (Docker environments)
screen and click **비활성화** (Deactivate). The Collector connection is blocked and already collected data is kept.

## Uninstall Web {#uninstall-web}

**On the dashboard server**, in the `everyup` directory:

```bash
cd everyup
docker compose down
```

`docker compose down` removes the container only and keeps the data volume. Running
`docker compose up -d` again in the same directory starts with the previous data.

::: danger To delete the data as well
`docker compose down -v` also deletes the `everyup-data` volume. All collected data, accounts,
notification channels, and the encryption key are removed and cannot be recovered. Take a
[backup](./backup-restore) first if you need one.
:::

## Start over from scratch {#reinstall}

If an installation went wrong and you want a clean start, finish
[Uninstall the monitoring bundle](#uninstall-bundle), then generate a new install command in Web
and run it. Connection codes work only once, so re-running the old command fails.

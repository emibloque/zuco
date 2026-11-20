# Zuco HTTPS proxy

Use Docker Compose. The web service uses the official NGINX 1.30.7 image,
which fixes CVE-2026-123007 and CVE-2026-123633. It reads certificates from an
existing Certbot volume. Certbot renews them using a separate container and the
shared HTTP challenge directory.

## Migrate an existing deployment

1. Keep a copy of the active Compose file and any NGINX bind mounts for rollback.
   Use `docker inspect <existing-web-container>` to confirm the Compose project
   name and the exact Docker volume mounted at `/etc/letsencrypt`. Confirm the
   certificate lineage under `/etc/letsencrypt/live` and that its certificate
   covers every configured hostname. Confirm its Certbot renewal configuration
   uses the webroot authenticator and `/usr/share/nginx/html`.
2. Copy `.env.example` to a local file outside Git. Set the existing app's bucket
   URL, certificate volume, lineage name, and server names. In the commands below,
   use the existing Compose project name and that local file. For a deployment
   that uses the image cache and download response header, add
   `-f docker-compose.cache.yml` before `"$@"` in `zuco_compose`. The new cache
   volume will warm up as requests arrive.
3. From this directory, define a command using the existing project name and
   the absolute path to the local environment file. Use `docker-compose` in
   place of `docker compose` on hosts with the standalone Compose client.

   ```sh
   zuco_compose() {
     docker compose --project-name PROJECT --env-file /path/to/zuco.env \
       -f docker-compose.yml "$@"
   }

   zuco_renew() {
     zuco_compose -f docker-compose.renew.yml run --rm certbot renew "$@"
   }
   ```

4. Pull and preflight the proxy before replacing the running container.

   ```sh
   zuco_compose pull web
   zuco_compose run --rm --no-deps web nginx -t
   zuco_compose up -d --no-deps web
   zuco_compose exec -T web nginx -v
   ```

5. Check the HTTP redirect, TLS certificate, and a known asset over HTTPS on each
   hostname. For a cache deployment, also check the cache and `?download=1`.
   Test certificate renewal once with Let's Encrypt staging.

   ```sh
   zuco_renew --dry-run
   ```

6. Schedule the following on the host twice daily, using the same absolute
   Compose file and environment file paths. Reload after a successful renewal
   check so NGINX reads the current certificate symlinks.

   ```sh
   zuco_renew && zuco_compose exec -T web nginx -s reload
   ```

## Rollback

Use the previous Compose file with the same project name and certificate volume
to recreate only the `web` service. If temporarily returning to the previous
proxy, disable HTTP/2 in its HTTPS configuration before starting it. Keep the
certificate volume in place so the rollback can serve the existing certs.

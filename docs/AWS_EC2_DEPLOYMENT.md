# AWS EC2 production deployment

This runbook deploys Version 1 as a single-server application on an Ubuntu 24.04 LTS EC2 instance. The instance runs:

- one Node.js 24 application process;
- PostgreSQL 16 locally on loopback;
- Nginx as the public TLS and WebSocket reverse proxy;
- evidence images in a private EBS-backed directory.

The project does **not** use Prisma. Database tables are created and upgraded by the 12 ordered `node-pg-migrate` migrations in `migrations/`.

Replace every value shown as `REPLACE_...` and every example domain before starting production.

## 1. Prepare AWS

### Recommended starting instance

- Ubuntu Server 24.04 LTS, 64-bit x86.
- `t3.medium` or equivalent (4 GiB RAM is useful when building Next.js on the server).
- At least 30 GiB encrypted gp3 EBS storage. Increase this based on evidence volume and backup retention.
- An Elastic IP associated with the instance.
- A DNS `A` record such as `game.example.com` pointing to the Elastic IP.

The application currently supports one instance only. Do not place multiple application instances behind a load balancer until realtime coordination, background-job ownership, and shared evidence storage are redesigned.

### Security-group inbound rules

| Port | Protocol | Source                                    | Purpose                 |
| ---: | -------- | ----------------------------------------- | ----------------------- |
|   22 | TCP      | Your administrator IP/CIDR only           | SSH                     |
|   80 | TCP      | `0.0.0.0/0` and `::/0` if IPv6 is enabled | ACME and HTTPS redirect |
|  443 | TCP      | `0.0.0.0/0` and `::/0` if IPv6 is enabled | Website and WebSockets  |

Do not expose ports `3000` or `5432` in the EC2 security group.

AWS references:

- [Connect to a Linux EC2 instance](https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/connect-to-linux-instance.html)
- [EC2 security-group rule reference](https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/security-group-rules-reference.html)
- [Associate an Elastic IP](https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/working-with-eips.html)

## 2. Connect and install system packages

Connect using the Ubuntu user:

```bash
ssh -i /path/to/key.pem ubuntu@EC2_ELASTIC_IP
```

Install updates, PostgreSQL, Nginx, Git, and TLS tooling:

```bash
sudo apt-get update
sudo apt-get upgrade -y
sudo apt-get install -y postgresql postgresql-contrib nginx git curl ca-certificates certbot python3-certbot-nginx
sudo systemctl enable --now postgresql nginx
```

Install Node.js 24. Download the NodeSource setup script first so it can be inspected before execution:

```bash
curl -fsSL https://deb.nodesource.com/setup_24.x -o /tmp/nodesource_setup.sh
less /tmp/nodesource_setup.sh
sudo -E bash /tmp/nodesource_setup.sh
sudo apt-get install -y nodejs
node --version
npm --version
```

`node --version` must report a `v24.x.x` release.

## 3. Create the application account and directories

```bash
sudo adduser --system --group --home /opt/imposter-game imposter
sudo mkdir -p /opt/imposter-game/releases
sudo mkdir -p /var/lib/imposter-game/evidence
sudo mkdir -p /var/backups/imposter-game
sudo mkdir -p /etc/imposter-game
sudo chown -R imposter:imposter /opt/imposter-game
sudo chown -R imposter:imposter /var/lib/imposter-game
sudo chmod 0750 /opt/imposter-game /var/lib/imposter-game /var/lib/imposter-game/evidence
```

The evidence directory must never be configured as an Nginx static directory.

## 4. Create PostgreSQL role and database

Generate a database password containing URL-safe hexadecimal characters:

```bash
openssl rand -hex 24
```

Save that value in your password manager as `DATABASE_PASSWORD`. Open PostgreSQL:

```bash
sudo -u postgres psql
```

Run the following SQL, replacing `REPLACE_DATABASE_PASSWORD`:

```sql
CREATE ROLE imposter_app
  LOGIN
  PASSWORD 'REPLACE_DATABASE_PASSWORD'
  NOSUPERUSER
  NOCREATEDB
  NOCREATEROLE
  NOREPLICATION;

CREATE DATABASE imposter_game
  OWNER imposter_app
  ENCODING 'UTF8'
  TEMPLATE template0;

\connect imposter_game
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
GRANT ALL ON SCHEMA public TO imposter_app;
\quit
```

Verify that PostgreSQL is listening locally:

```bash
sudo -u postgres psql -d imposter_game -c "select current_database(), current_user;"
sudo ss -lntp | grep 5432
```

Port `5432` should remain bound to loopback/local interfaces and blocked by the EC2 security group.

## 5. Upload or clone the application

Clone the repository using a read-only deployment credential:

```bash
sudo -u imposter git clone --branch main REPLACE_REPOSITORY_URL /opt/imposter-game/current
cd /opt/imposter-game/current
git rev-parse HEAD
```

For a private repository, configure a read-only deploy key first. Alternatively, upload a release archive with `scp`, extract it into `/opt/imposter-game/current`, and set ownership:

```bash
sudo chown -R imposter:imposter /opt/imposter-game/current
```

Deploy an exact reviewed commit or release tag rather than an unrecorded moving branch.

## 6. Create the complete production environment

Generate three different secrets:

```bash
openssl rand -hex 32
openssl rand -hex 32
openssl rand -hex 32
```

Use them respectively for `METRICS_BEARER_TOKEN`, `ADMIN_SESSION_TOKEN_PEPPER`, and `PARTICIPANT_SESSION_TOKEN_PEPPER`. They must remain distinct.

Create the protected environment file:

```bash
sudo touch /etc/imposter-game/imposter-game.env
sudo chown root:imposter /etc/imposter-game/imposter-game.env
sudo chmod 0640 /etc/imposter-game/imposter-game.env
sudoedit /etc/imposter-game/imposter-game.env
```

Paste every key below and replace the marked values:

```dotenv
APP_ENV=production
HOST=127.0.0.1
PORT=3000

DATABASE_URL=postgresql://imposter_app:REPLACE_DATABASE_PASSWORD@127.0.0.1:5432/imposter_game
DATABASE_SSL=false
DATABASE_POOL_MAX=10
DATABASE_CONNECTION_TIMEOUT_MS=5000
DATABASE_IDLE_TIMEOUT_MS=30000
DATABASE_STATEMENT_TIMEOUT_MS=15000
DATABASE_READY_TIMEOUT_MS=1500

SERVICE_VERSION=v1.0.0
LOG_LEVEL=info
PUBLIC_APP_URL=https://game.example.com
CORS_ALLOWED_ORIGINS=https://game.example.com
CSP_IMAGE_SOURCES=https://game.example.com
MAX_JSON_BODY_BYTES=65536
EXPOSE_API_DOCS=false

SHUTDOWN_TIMEOUT_MS=10000
HTTP_REQUEST_TIMEOUT_MS=30000
HTTP_HEADERS_TIMEOUT_MS=15000
HTTP_KEEP_ALIVE_TIMEOUT_MS=5000
HTTP_RATE_LIMIT_WINDOW_SECONDS=60
HTTP_RATE_LIMIT_MAX_REQUESTS=180
TRUST_PROXY=true

METRICS_BEARER_TOKEN=REPLACE_WITH_FIRST_64_CHARACTER_HEX_SECRET
ADMIN_SESSION_TOKEN_PEPPER=REPLACE_WITH_SECOND_64_CHARACTER_HEX_SECRET
ADMIN_SESSION_TTL_SECONDS=28800
ADMIN_LOGIN_WINDOW_SECONDS=900
ADMIN_LOGIN_MAX_ATTEMPTS=5

PARTICIPANT_SESSION_TOKEN_PEPPER=REPLACE_WITH_THIRD_64_CHARACTER_HEX_SECRET
PARTICIPANT_SESSION_TTL_SECONDS=7200
ROOM_LOBBY_TTL_SECONDS=7200
ROOM_CODE_COOLDOWN_SECONDS=86400
HOST_DISCONNECT_GRACE_SECONDS=30
ROOM_MAINTENANCE_INTERVAL_MS=10000

EVIDENCE_LOCAL_DIRECTORY=/var/lib/imposter-game/evidence
EVIDENCE_UPLOAD_TTL_SECONDS=300
EVIDENCE_VIEW_TTL_SECONDS=60
EVIDENCE_MAX_BYTES=5242880
EVIDENCE_GAME_MAX_BYTES=251658240
EVIDENCE_MAX_PIXELS=20000000
EVIDENCE_RETENTION_SECONDS=86400
EVIDENCE_ORPHAN_TTL_SECONDS=3600
EVIDENCE_WORKER_INTERVAL_MS=5000

REALTIME_PING_INTERVAL_MS=25000
REALTIME_PING_TIMEOUT_MS=20000
REALTIME_DISCONNECT_GRACE_MS=5000
```

Notes:

- `DATABASE_SSL=false` is appropriate only because PostgreSQL is accessed over local loopback on the same EC2 instance.
- A database password placed in a URI must be percent-encoded if it contains URI-reserved characters. The recommended hexadecimal password avoids that problem.
- `PUBLIC_APP_URL`, `CORS_ALLOWED_ORIGINS`, and `CSP_IMAGE_SOURCES` must use the final HTTPS domain.
- Never copy the development peppers or placeholder values into production.
- Do not add `ADMIN_BOOTSTRAP_PASSWORD` permanently. It is a one-time shell variable used later.

## 7. Install, verify, migrate, and build

Open a shell as the application user, load the production environment, and install the exact lockfile:

```bash
sudo -u imposter -H bash
cd /opt/imposter-game/current
set -a
. /etc/imposter-game/imposter-game.env
set +a
npm ci
npm run check
npm run migrate:up
npm run build
exit
```

`npm run migrate:up` applies all migration files in order and creates the application schema and tables. Do not manually reproduce the table DDL and do not use `migrate:verify` against production: that command intentionally migrates down and back up and is only for disposable test databases.

Confirm migration state:

```bash
sudo -u imposter -H bash -c 'cd /opt/imposter-game/current && set -a && . /etc/imposter-game/imposter-game.env && set +a && npm run migrate:up'
```

The second run should report that there are no pending migrations.

## 8. Bootstrap the first administrator

Run this exactly once:

```bash
sudo -u imposter -H bash
cd /opt/imposter-game/current
set -a
. /etc/imposter-game/imposter-game.env
set +a
read -rsp "Initial administrator password: " ADMIN_BOOTSTRAP_PASSWORD
echo
export ADMIN_BOOTSTRAP_PASSWORD
npm run admin:bootstrap -- --email owner@example.com
unset ADMIN_BOOTSTRAP_PASSWORD
exit
```

Use a unique password of 12–128 characters. The bootstrap command refuses to create another account after the first administrator exists.

## 9. Create the systemd service

Create `/etc/systemd/system/imposter-game.service`:

```bash
sudoedit /etc/systemd/system/imposter-game.service
```

```ini
[Unit]
Description=Imposter Game Version 1
After=network-online.target postgresql.service
Wants=network-online.target
Requires=postgresql.service

[Service]
Type=simple
User=imposter
Group=imposter
WorkingDirectory=/opt/imposter-game/current
Environment=NODE_ENV=production
EnvironmentFile=/etc/imposter-game/imposter-game.env
ExecStart=/usr/bin/node dist/server/index.js
Restart=on-failure
RestartSec=5
TimeoutStopSec=20
KillSignal=SIGTERM
UMask=0027
NoNewPrivileges=true
PrivateTmp=true
ProtectHome=true
ProtectSystem=full
ReadWritePaths=/var/lib/imposter-game/evidence
LimitNOFILE=65535

[Install]
WantedBy=multi-user.target
```

Enable and start it:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now imposter-game
sudo systemctl status imposter-game --no-pager
curl --fail http://127.0.0.1:3000/health/live
curl --fail http://127.0.0.1:3000/health/ready
```

View logs with:

```bash
sudo journalctl -u imposter-game -f
```

## 10. Configure Nginx and WebSockets

Create `/etc/nginx/sites-available/imposter-game`:

```bash
sudoedit /etc/nginx/sites-available/imposter-game
```

```nginx
map $http_upgrade $connection_upgrade {
    default upgrade;
    ''      close;
}

server {
    listen 80;
    listen [::]:80;
    server_name game.example.com;

    client_max_body_size 6m;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $remote_addr;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection $connection_upgrade;
        proxy_read_timeout 90s;
        proxy_send_timeout 90s;
        proxy_buffering off;
    }
}
```

Enable the site:

```bash
sudo ln -s /etc/nginx/sites-available/imposter-game /etc/nginx/sites-enabled/imposter-game
sudo rm /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx
```

The `X-Forwarded-For` header is deliberately replaced with Nginx's observed client address because `TRUST_PROXY=true`.

## 11. Enable HTTPS

Make sure DNS already points to the Elastic IP, then run:

```bash
sudo certbot --nginx -d game.example.com
sudo certbot renew --dry-run
```

After Certbot succeeds:

```bash
curl --fail https://game.example.com/health/live
curl --fail https://game.example.com/health/ready
```

Keep HTTP port 80 open for certificate renewal and redirect it to HTTPS.

## 12. Production smoke test

Verify all of the following:

1. `https://game.example.com/` loads without mixed-content or CSP errors.
2. `/health/live` returns a successful response.
3. `/health/ready` returns a successful response and confirms database access.
4. The administrator can log in at `/admin/login`.
5. A task pack can be created and published.
6. A room can be created and joined from a second browser/device.
7. Realtime updates work after both clients connect.
8. A JPEG, PNG, or WebP evidence image can be uploaded, viewed, normalized, and deleted.
9. Files appear under `/var/lib/imposter-game/evidence`, but that path is not accessible directly through Nginx.
10. A service restart preserves database state and reconnecting clients can resynchronize.

Useful commands:

```bash
sudo systemctl status imposter-game nginx postgresql --no-pager
sudo journalctl -u imposter-game --since "15 minutes ago"
sudo -u postgres psql -d imposter_game -c "select name, run_on from pgmigrations order by run_on;"
df -h
```

Migration tracking is owned by `node-pg-migrate`. If the installed migration version uses a different tracking-table name, inspect the database with `\dt` rather than creating a replacement table.

## 13. Backups

This single-server design stores both PostgreSQL data and evidence files on EBS. Configure encrypted EBS backups through AWS Backup or an EBS snapshot policy, and also keep logical PostgreSQL dumps.

For a coordinated manual backup:

```bash
sudo systemctl stop imposter-game
sudo -u postgres pg_dump --format=custom imposter_game | sudo tee /var/backups/imposter-game/imposter_game.dump >/dev/null
sudo tar -C /var/lib/imposter-game -czf /var/backups/imposter-game/evidence.tar.gz evidence
sudo systemctl start imposter-game
sudo chown -R root:root /var/backups/imposter-game
sudo chmod -R go-rwx /var/backups/imposter-game
```

Copy backups outside the instance's failure boundary. Regularly restore them to a separate test instance and verify the application. AWS supports scheduled EBS protection through [AWS Backup](https://docs.aws.amazon.com/en_en/ebs/latest/userguide/snapshot-lifecycle-backup.html).

## 14. Deploy an update

Replace `REPLACE_COMMIT_OR_TAG` with the reviewed release:

```bash
sudo -u postgres pg_dump --format=custom imposter_game | sudo tee /var/backups/imposter-game/pre-deploy.dump >/dev/null
sudo -u imposter -H bash
cd /opt/imposter-game/current
git fetch --tags origin
git checkout REPLACE_COMMIT_OR_TAG
set -a
. /etc/imposter-game/imposter-game.env
set +a
npm ci
npm run check
npm run build
npm run migrate:up
exit
sudo systemctl restart imposter-game
curl --fail http://127.0.0.1:3000/health/ready
```

Set `SERVICE_VERSION` to the deployed tag or commit before restarting.

## 15. Rollback

Application rollback:

```bash
sudo -u imposter -H bash
cd /opt/imposter-game/current
git checkout REPLACE_PREVIOUS_COMMIT_OR_TAG
set -a
. /etc/imposter-game/imposter-game.env
set +a
npm ci
npm run build
exit
sudo systemctl restart imposter-game
```

Do not run `npm run migrate:down` automatically in production. Database migrations must remain compatible with the previous application version; if a migration caused the problem, prepare and deploy a forward corrective migration.

## 16. Final security checklist

- [ ] SSH is restricted to administrator IPs or replaced with Session Manager.
- [ ] Ports 3000 and 5432 are not publicly reachable.
- [ ] The EC2 root EBS volume and backups are encrypted.
- [ ] The three application secrets are unique and stored outside Git.
- [ ] `/etc/imposter-game/imposter-game.env` is mode `0640`.
- [ ] PostgreSQL listens locally and has a strong password.
- [ ] The Node process runs as `imposter`, not root.
- [ ] The evidence directory is private and included in capacity monitoring.
- [ ] HTTPS renewal has passed its dry run.
- [ ] Database and evidence restore procedures have been tested.
- [ ] CloudWatch or another monitor alerts on health failures, disk capacity, and service restarts.

# AWS deployment (low-cost single server)

This deployment runs the Next.js frontend, NestJS API, and Caddy HTTP proxy on one Linux server, reached by its EC2 public IPv4 address. It does **not** start Postgres, Redis, MinIO, RDS, a load balancer, NAT gateway, CloudFront, or S3. The current application uses `apps/api/data/local-state.json` as its database, so this is the simplest and cheapest topology.

## Launch the AWS server

1. In **EC2** select a region close to your users. For India, use **Asia Pacific (Mumbai)**. Launch one instance with the current **Amazon Linux 2023** AMI and select **t4g.small** (ARM/Graviton, 2 GiB RAM). The image in this repository is multi-architecture compatible.
2. Create a key pair or use EC2 Instance Connect. Create a security group with only these inbound rules: `HTTP / TCP 80 / 0.0.0.0/0 and ::/0` and `SSH / TCP 22 / your-public-IP/32` (not open to the world). Keep the default 20 GiB gp3 root disk. Do not create a load balancer, NAT gateway, RDS database, or Elastic IP for this deployment.
3. Connect as `ec2-user`, then install Docker. The following commands are for the recommended `t4g.small` ARM instance:

```bash
sudo yum update -y
sudo yum install -y docker git curl
sudo systemctl enable --now docker
sudo usermod -aG docker ec2-user
exit
```

4. Reconnect, then install Docker Compose and verify it. (For an x86 instance, replace `aarch64` with `x86_64`.)

```bash
sudo mkdir -p /usr/local/lib/docker/cli-plugins
sudo curl -SL https://github.com/docker/compose/releases/download/v5.5.0/docker-compose-linux-aarch64 -o /usr/local/lib/docker/cli-plugins/docker-compose
sudo chmod +x /usr/local/lib/docker/cli-plugins/docker-compose
docker info
docker compose version
```

5. Add 2 GiB swap before the first image build; it prevents the Next.js build from exhausting the small server's RAM. It persists across restarts.

```bash
sudo dd if=/dev/zero of=/swapfile bs=1M count=2048 status=progress
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile swap swap defaults 0 0' | sudo tee -a /etc/fstab
```

## Before you deploy

1. In EC2 → **Instances**, copy the server's **Public IPv4 address**. No DNS or domain is needed. Do not stop the instance: an automatically assigned public IP normally changes when it is stopped and started.
2. On the server, copy `.env.production.example` to `.env.production`. Set `PUBLIC_IP`, `APP_URL`, `API_URL`, and `CORS_ORIGINS` to that exact address, for example `http://13.234.56.78`. Leave `COOKIE_SECURE=false`. An AI provider key is optional; without one, AI features use the built-in fallback template. Generate the encryption key with `openssl rand -hex 32`. Keep it forever: rotating it without a migration makes stored OAuth tokens unreadable.
3. This endpoint is **HTTP only**. Do not store real passwords, social-provider client secrets, or production OAuth tokens in it. Social OAuth, including Google/YouTube, will not work with a public-IP callback: Google requires HTTPS and does not permit raw IP hosts (except localhost). Use the app's mock connections for this deployment.

## Deploy and update

From the repository root on the server:

```bash
mkdir -p data/api
cp .env.production.example .env.production
nano .env.production
docker compose -f infra/aws/docker-compose.production.yml up -d --build
docker compose -f infra/aws/docker-compose.production.yml ps
curl -fsS http://YOUR_EC2_PUBLIC_IP/api/health
```

For an update, pull/copy the new source and run the same `docker compose ... up -d --build` command. Do not run `docker compose down -v`: `-v` deletes persistent Docker volumes.

## Backup and recovery

The only application database is `data/api/local-state.json`. It contains encrypted OAuth tokens, but still must be treated as sensitive. At minimum, download an encrypted copy before each update and weekly thereafter:

```bash
tar -czf feedforge-backup-$(date +%F).tgz data/api .env.production
```

Keep backups off the instance. To recover, stop the stack, restore `data/api`, preserve the same `ENCRYPTION_KEY`, then start the stack again.

## Important limits

This is suitable for a small private/team deployment. One server and a JSON data file are not horizontally scalable or highly available. Move the store to PostgreSQL/RDS before using it as a multi-instance public product.

## Cost controls

For a new account, verify in the EC2 launch screen that `t4g.small` is marked **Free tier eligible**. AWS currently lists a 750-hour/month T4g small free trial through December 31, 2026, and Mumbai is an eligible region. Create a **zero-spend budget** in Billing → Budgets immediately, with your email alert at $0.01, and review Billing → Free Tier weekly. Never create a NAT Gateway, load balancer, RDS instance, paid support plan, or unbounded CloudWatch log retention for this app.

AWS charges $0.005/hour for an in-use public IPv4 address (about $3.65/month), including the automatically assigned EC2 public IP. This is not literally free, but it uses only about $26 of $100 over seven months, before any available Free Tier credit/trial coverage. An Elastic IP does not save this cost and is intentionally excluded. AWS's newer *Free account plan* ends after six months or when credits run out. If your account uses that plan, a seven-month deployment is impossible without upgrading to the Paid plan before it expires; upgrade preserves remaining credits but permits charges once credits are gone. Your actual credit balance, credit expiry, and account-plan expiry shown in the Billing console are the authoritative values. Back up before that date.

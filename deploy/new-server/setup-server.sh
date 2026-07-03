#!/usr/bin/env bash
#
# One-time provisioning script for a fresh Ubuntu 24.04 LTS VPS that will
# host the scheduler backend + backup monitor. Run as root. Idempotent —
# safe to re-run if it fails partway through.
#
# Full context / next steps live in MIGRATION.md next to this script.

set -euo pipefail

echo "==> Step 1: apt update/upgrade + base packages"
apt-get update
apt-get -y full-upgrade

# `webhook` is in universe, which isn't enabled on some minimal images
apt-get install -y software-properties-common
add-apt-repository -y universe
apt-get update

apt-get install -y \
	ca-certificates \
	curl \
	gnupg \
	ufw \
	fail2ban \
	unattended-upgrades \
	rsync \
	webhook

echo "==> Step 2: create deploy user + SSH key"
if ! id -u deploy &>/dev/null; then
	useradd -m -s /bin/bash deploy
	usermod -aG sudo deploy
	echo "    created user 'deploy' (added to sudo group)"
else
	echo "    user 'deploy' already exists, skipping creation"
fi

mkdir -p /home/deploy/.ssh
chmod 700 /home/deploy/.ssh
chown deploy:deploy /home/deploy/.ssh

if [[ -f /root/.ssh/authorized_keys && ! -f /home/deploy/.ssh/authorized_keys ]]; then
	cp /root/.ssh/authorized_keys /home/deploy/.ssh/authorized_keys
	chmod 600 /home/deploy/.ssh/authorized_keys
	chown deploy:deploy /home/deploy/.ssh/authorized_keys
	echo "    copied /root/.ssh/authorized_keys to deploy user"
else
	echo "    skipping authorized_keys copy (source missing or destination already present)"
fi

echo "==> Step 3: install Docker from the official Docker apt repository"
if [[ ! -f /etc/apt/keyrings/docker.asc ]]; then
	install -m 0755 -d /etc/apt/keyrings
	curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
	chmod a+r /etc/apt/keyrings/docker.asc
	echo "    added Docker GPG key"
else
	echo "    Docker GPG key already present, skipping"
fi

if [[ ! -f /etc/apt/sources.list.d/docker.list ]]; then
	# shellcheck disable=SC1091
	. /etc/os-release
	echo \
		"deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu ${VERSION_CODENAME:-noble} stable" \
		>/etc/apt/sources.list.d/docker.list
	echo "    added Docker apt source (${VERSION_CODENAME:-noble})"
else
	echo "    Docker apt source already present, skipping"
fi

apt-get update
apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
usermod -aG docker deploy
echo "    deploy user added to docker group"

echo "==> Step 4: /etc/docker/daemon.json (log rotation)"
if [[ ! -f /etc/docker/daemon.json ]]; then
	mkdir -p /etc/docker
	cat >/etc/docker/daemon.json <<'EOF'
{
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "10m",
    "max-file": "3"
  }
}
EOF
	systemctl restart docker
	echo "    wrote /etc/docker/daemon.json and restarted docker"
else
	echo "    WARNING: /etc/docker/daemon.json already exists — leaving it untouched."
	echo "    Please manually merge in a json-file log-driver with max-size=10m, max-file=3"
	echo "    so container logs on this host stay bounded."
fi

echo "==> Step 5: SSH hardening"
if [[ -s /home/deploy/.ssh/authorized_keys ]]; then
	cat >/etc/ssh/sshd_config.d/90-hardening.conf <<'EOF'
PasswordAuthentication no
KbdInteractiveAuthentication no
PermitRootLogin no
MaxAuthTries 3
EOF
	systemctl reload ssh
	echo "    applied SSH hardening and reloaded sshd"
	echo "    >>> KEEP this root session OPEN and verify 'ssh deploy@<server-ip>' works"
	echo "    >>> from a SECOND terminal before logging out of this one. <<<"
else
	echo "WARNING: /home/deploy/.ssh/authorized_keys is missing or empty." >&2
	echo "Skipping SSH hardening entirely to avoid locking out access." >&2
	echo "Add a public key for 'deploy' and re-run this script to apply hardening." >&2
fi

echo "==> Step 6: UFW firewall"
ufw default deny incoming
ufw default allow outgoing
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow 443/udp
ufw --force enable
# NOTE: Docker manipulates iptables directly for published container ports,
# which bypasses UFW rules. This is fine here because the compose bundle
# only publishes 80/443 (via Caddy) and a loopback-only 5432 for Postgres —
# but be aware of this if more container ports are published later.

echo "==> Step 7: fail2ban + unattended-upgrades"
systemctl enable --now fail2ban
# Recent fail2ban ships with the sshd jail enabled by default, so no
# jail.local is needed here.

cat >/etc/apt/apt.conf.d/20auto-upgrades <<'EOF'
APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Unattended-Upgrade "1";
EOF
systemctl enable --now unattended-upgrades

echo "==> Step 8: swap file"
if [[ -z "$(swapon --show)" && ! -f /swapfile ]]; then
	fallocate -l 2G /swapfile
	chmod 600 /swapfile
	mkswap /swapfile
	swapon /swapfile
	if ! grep -q '^/swapfile ' /etc/fstab; then
		echo '/swapfile none swap sw 0 0' >>/etc/fstab
	fi
	echo "    created and enabled 2G /swapfile"
else
	echo "    swap already configured, skipping"
fi

echo "==> Step 9: app directory"
mkdir -p /srv/scheduler
chown deploy:deploy /srv/scheduler

cat <<'EOF'

==================================================================
 Server provisioning complete.

 Done:
   - packages updated, Docker + compose plugin installed
   - 'deploy' user created (sudo + docker groups), SSH key copied
   - Docker daemon log rotation configured (or a warning printed)
   - SSH hardened (or skipped with a warning — check the output above)
   - UFW firewall enabled (22, 80, 443/tcp, 443/udp)
   - fail2ban + unattended-upgrades enabled
   - 2G swapfile ensured
   - /srv/scheduler created, owned by deploy

 Next steps (full detail in MIGRATION.md):
   1. Copy this deploy/new-server/ bundle to /srv/scheduler as the deploy user.
   2. Fill in .env, bot.env, monitor.env from their .example files.
   3. docker compose pull && docker compose up -d
   4. Install the redeploy webhook systemd unit and rotate its tokens.
==================================================================
EOF

#!/bin/bash
# auto-backup (dell-primary): daily commit+push of live repos + config snapshot
set -u
STAMP=$(date +%Y%m%d-%H%M)
LOG_TAG="[auto-backup $STAMP]"
git config --global user.email deko38code@users.noreply.github.com
git config --global user.name Deko38code
for repo in /home/ghost /home/ghost/cine-vault-live /home/ghost/haksterAi; do
  cd "$repo" || continue
  git fetch -q origin 2>/dev/null
  git reset -q origin/$(git branch --show-current 2>/dev/null) 2>/dev/null
  git add -A 2>/dev/null
  if ! git diff --cached --quiet 2>/dev/null; then
    git commit -m "auto-backup: live state $STAMP" >/dev/null 2>&1
    echo "$LOG_TAG $repo: committed $(git rev-parse --short HEAD)"
  else
    echo "$LOG_TAG $repo: nothing new"
  fi
  git push -q origin "$(git branch --show-current)" >/dev/null 2>&1 && echo "$LOG_TAG $repo: pushed" || echo "$LOG_TAG $repo: PUSH FAILED"
done
mkdir -p /home/ghost/backups
tar czf "/home/ghost/backups/configs-$STAMP.tar.gz" -C /home/ghost .cloudflared .pm2/dump.pm2 2>/dev/null
ls -1t /home/ghost/backups/configs-*.tar.gz 2>/dev/null | tail -n +15 | xargs -r rm --
echo "$LOG_TAG done"

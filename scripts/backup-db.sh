#!/bin/bash
# Snapshot finance.db into backups/ with an integrity guard and retention pruning.
# Run manually (`npm run db:backup`), before migrations (`predb:migrate`), or
# daily via launchd/com.finances.db-backup.plist.
set -euo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO"

BACKUP_DIR="backups"
KEEP=14
MIN_BYTES=20480
LOG="$BACKUP_DIR/backup.log"

log() { printf '%s  %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$1" | tee -a "$LOG"; }

# Resolve the database file. A non-file: DATABASE_URL (Turso) has nothing to copy.
url="${DATABASE_URL:-file:./finance.db}"
case "$url" in
  file:*) DB="${url#file:}" ;;
  *) echo "DATABASE_URL is not a local file ($url) - nothing to back up"; exit 0 ;;
esac

mkdir -p "$BACKUP_DIR"

# Guard: never snapshot a missing, truncated, or corrupt database.
if [ ! -f "$DB" ]; then
  log "FAIL missing database: $DB"; exit 1
fi
size=$(wc -c < "$DB" | tr -d ' ')
if [ "$size" -lt "$MIN_BYTES" ]; then
  log "FAIL database too small (${size}b): $DB"; exit 1
fi
if [ "$(sqlite3 "$DB" 'PRAGMA integrity_check' 2>/dev/null || true)" != "ok" ]; then
  log "FAIL integrity_check failed: $DB"; exit 1
fi

snapshot="$BACKUP_DIR/finance.db.auto-$(date '+%Y%m%d-%H%M%S')"
if [ -e "$snapshot" ]; then
  log "skip - a snapshot for this second already exists"; exit 0
fi
sqlite3 "$DB" "VACUUM INTO '$snapshot'"

# Drop the new snapshot if it is byte-identical to the previous one.
prev=$(ls -1t "$BACKUP_DIR"/finance.db.auto-* 2>/dev/null | grep -v "$snapshot" | head -1 || true)
if [ -n "$prev" ] && [ "$(shasum -a 256 "$snapshot" | cut -d' ' -f1)" = "$(shasum -a 256 "$prev" | cut -d' ' -f1)" ]; then
  rm -f "$snapshot"
  log "skip unchanged since $(basename "$prev")"
else
  log "wrote $(basename "$snapshot")"
fi

# Prune: keep the newest $KEEP auto- snapshots, leave hand-made save-points alone.
ls -1t "$BACKUP_DIR"/finance.db.auto-* 2>/dev/null | tail -n +$((KEEP + 1)) | while read -r old; do
  rm -f "$old"
  log "pruned $(basename "$old")"
done

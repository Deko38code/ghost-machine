#!/usr/bin/env bash
# Fix VirtualBox 7.0.16's kernel module on this box's 7.0.0-4x kernels.
#
# Why it fails today:
#   ERROR: modpost: module vboxdrv uses symbol kvm_enable_virtualization
#          from namespace module:kvm-amd,kvm-intel, but does not import it.
#   This kernel exports the KVM symbols inside a namespace, and VirtualBox
#   7.0.16 never declares that it imports them, so modpost rejects the module.
#   Both installed kernels (7.0.0-42 and 7.0.0-43) declare the same namespace,
#   which is why vboxdrv is not loaded at all right now.
#
# What this does:
#   1. Backs up vboxdrv's main C file to /home/ghost/vbox-patch-backups/<timestamp>/
#   2. Adds the two MODULE_IMPORT_NS(...) lines it is missing (idempotent)
#   3. Rebuilds the module with dkms for every installed kernel
#   4. Finishes the half-configured dpkg state (linux-image/headers 7.0.0-43)
#
# Safe to re-run. Nothing is deleted; the original file stays in the backup dir.
# Note: a future virtualbox-dkms package update replaces /usr/src source and
# would drop this patch — re-run this script if vboxdrv fails to build again.

set -uo pipefail

SRC=/usr/src/virtualbox-7.0.16/vboxdrv/linux/SUPDrv-linux.c
STAMP=$(date -u +%Y%m%dT%H%M%SZ)
BACKUP=/home/ghost/vbox-patch-backups/$STAMP

if [ "$(id -u)" -ne 0 ]; then
  echo "Run it with sudo: sudo bash $0"
  exit 1
fi
if [ ! -f "$SRC" ]; then
  echo "Not found: $SRC"
  echo "Installed virtualbox source trees:"
  ls -d /usr/src/virtualbox-* 2>/dev/null
  exit 1
fi

mkdir -p "$BACKUP"
cp -a "$SRC" "$BACKUP/" && echo "backup: $BACKUP/$(basename "$SRC")"

python3 - "$SRC" <<'PY'
import sys, pathlib
p = pathlib.Path(sys.argv[1])
s = p.read_text()
wanted = [
    'MODULE_IMPORT_NS("module:kvm,kvm-amd,kvm-intel");',
    'MODULE_IMPORT_NS("module:kvm-amd,kvm-intel");',
]
missing = [line for line in wanted if line not in s]
if not missing:
    print('already patched — nothing to add')
else:
    anchor = 'MODULE_LICENSE("GPL");'
    if anchor not in s:
        print('anchor MODULE_LICENSE("GPL"); not found — refusing to guess')
        sys.exit(1)
    block = anchor + '\n' + '\n'.join(missing) + '\n'
    s = s.replace(anchor, block, 1)
    p.write_text(s)
    print('patched: added', len(missing), 'namespace import(s)')
PY

echo "--- building modules ---"
dkms autoinstall || true

echo "--- finishing package configuration ---"
dpkg --configure -a || true
apt-get --fix-broken install -y || true

echo "--- state ---"
dkms status || true
echo
lsmod | grep -c '^vboxdrv' | sed 's/^/vboxdrv loaded modules: /'
dpkg -l 2>/dev/null | awk '$1=="iU"||$1=="iF"{print "still unconfigured:", $2}' || true

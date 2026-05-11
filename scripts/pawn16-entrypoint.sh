#!/bin/sh
set -eu

SYSTEM_SRC=/opt/pawn16/pawn16
SYSTEM_DEST=/data/Data/systems/pawn16

if [ -d "$SYSTEM_SRC" ]; then
  rm -rf "$SYSTEM_DEST"
  mkdir -p "$(dirname "$SYSTEM_DEST")"
  cp -a "$SYSTEM_SRC" "$SYSTEM_DEST"
fi

exec ./entrypoint.sh "$@"

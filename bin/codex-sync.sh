#!/bin/bash
set -u

WATCH_DIR="$HOME/codex-workspaces"

for dependency in inotifywait wmctrl xdotool; do
    if ! command -v "$dependency" >/dev/null 2>&1; then
        printf 'Missing dependency: %s\n' "$dependency" >&2
        exit 1
    fi
done

if command -v code >/dev/null 2>&1; then
    EDITOR_CLI=code
elif command -v codium >/dev/null 2>&1; then
    EDITOR_CLI=codium
else
    printf 'Missing editor CLI: install VS Code or VSCodium and make code/codium available on PATH.\n' >&2
    exit 1
fi

mkdir -p "$WATCH_DIR"

window_id() {
    local pattern="$1"
    wmctrl -l | awk -v pattern="$pattern" 'tolower($0) ~ pattern { print $1; exit }'
}

arrange_windows() {
    local win preview
    while true; do
        win="$(window_id 'visual studio code|vscodium|codium')"
        if [[ -n "$win" ]]; then
            wmctrl -ir "$win" -b remove,maximized_vert,maximized_horz
            wmctrl -ir "$win" -e 0,0,0,960,1080

            preview="$(window_id 'firefox')"
            if [[ -n "$preview" ]]; then
                wmctrl -ir "$preview" -b remove,maximized_vert,maximized_horz
                wmctrl -ir "$preview" -e 0,960,0,960,1080
            fi
        fi
        sleep 2
    done
}

arrange_windows &
LAYOUT_PID=$!
stop_layout() {
    kill "$LAYOUT_PID" 2>/dev/null || true
    wait "$LAYOUT_PID" 2>/dev/null || true
}
trap stop_layout EXIT INT TERM

inotifywait -m -e create --format '%w%f' "$WATCH_DIR" |
while IFS= read -r NEW_WS; do
    [[ -d "$NEW_WS" ]] || continue

    printf 'Opening %s\n' "$NEW_WS"
    "$EDITOR_CLI" -r "$NEW_WS"

    # Let the editor update its title, then focus the editor group in the active window.
    sleep 1
    WIN="$(window_id 'visual studio code|vscodium|codium')"
    if [[ -n "$WIN" ]]; then
        xdotool windowactivate --sync "$WIN"
        xdotool key --clearmodifiers --window "$WIN" ctrl+1
    fi
done

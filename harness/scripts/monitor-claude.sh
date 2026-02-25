#!/bin/bash
# Run claude with a fixed timeout, capture whatever output we get
# Usage: monitor-claude.sh <query-file> [timeout-seconds]

QUERY_FILE="$1"
TIMEOUT="${2:-20}"
OUTPUT="/tmp/claude-out-$$"

if [ ! -f "$QUERY_FILE" ]; then
  echo "Error: query file not found: $QUERY_FILE" >&2
  exit 1
fi

QUERY=$(cat "$QUERY_FILE")

# Run claude with hard timeout. -k 5 sends SIGKILL 5s after SIGTERM if needed
timeout -k 5 "$TIMEOUT" claude -p "$QUERY" \
  --output-format stream-json --verbose --max-turns 1 \
  --allowedTools Skill --permission-mode bypassPermissions \
  > "$OUTPUT" 2>/dev/null

cat "$OUTPUT"
rm -f "$OUTPUT" "$QUERY_FILE"

#!/bin/bash
# Check which hook is currently configured in .claude/settings.json

SETTINGS_FILE=".claude/settings.json"

if [ ! -f "$SETTINGS_FILE" ]; then
  echo "❌ No .claude/settings.json found"
  exit 1
fi

echo "🔍 Current hook configuration:"
echo ""

# Check if hooks section exists
if ! grep -q '"hooks"' "$SETTINGS_FILE"; then
  echo "   Hook type: NONE (no hooks configured)"
  exit 0
fi

# Extract the command path
COMMAND=$(grep -oP '"command":\s*"\K[^"]+' "$SETTINGS_FILE" | head -1)

if [ -z "$COMMAND" ]; then
  echo "   Hook type: NONE (no command found)"
  exit 0
fi

# Determine hook type based on command
case "$COMMAND" in
  *"skill-forced-eval-hook"*)
    echo "   Hook type: FORCED-EVAL ✅"
    echo "   Script: $COMMAND"
    ;;
  *"skill-llm-eval-hook"*)
    echo "   Hook type: LLM-EVAL"
    echo "   Script: $COMMAND"
    ;;
  *"skill-simple-instruction-hook"*)
    echo "   Hook type: SIMPLE"
    echo "   Script: $COMMAND"
    ;;
  *)
    echo "   Hook type: CUSTOM"
    echo "   Script: $COMMAND"
    ;;
esac

echo ""
echo "📄 Full hooks configuration:"
echo ""
jq '.hooks' "$SETTINGS_FILE" 2>/dev/null || cat "$SETTINGS_FILE"

#!/usr/bin/env bash
set -e

echo "============================================"
echo "  MCP Home Assistant Bridge Add-on"
echo "  Version: 1.0.0"
echo "============================================"

# Configuration file path (injected by Home Assistant Supervisor)
CONFIG_PATH=/data/options.json

# Read options from config using jq
if [ -f "$CONFIG_PATH" ]; then
    LOG_LEVEL=$(jq -r '.log_level // "info"' "$CONFIG_PATH")
    HTTP_PORT=$(jq -r '.http_port // 3000' "$CONFIG_PATH")
    BEARER_TOKEN=$(jq -r '.bearer_token // ""' "$CONFIG_PATH")
    REQUIRE_AUTH=$(jq -r '.require_auth // false' "$CONFIG_PATH")
    CACHE_REFRESH_INTERVAL=$(jq -r '.cache_refresh_interval // 60' "$CONFIG_PATH")
    ENTITY_CACHE_ENABLED=$(jq -r '.entity_cache_enabled // true' "$CONFIG_PATH")
else
    echo "Warning: Config file not found at $CONFIG_PATH, using defaults"
    LOG_LEVEL="info"
    HTTP_PORT=3000
    BEARER_TOKEN=""
    REQUIRE_AUTH="false"
    CACHE_REFRESH_INTERVAL=60
    ENTITY_CACHE_ENABLED="true"
fi

# Auto-detect Home Assistant environment
# SUPERVISOR_TOKEN is auto-injected when homeassistant_api: true in config.yaml
if [ -n "$SUPERVISOR_TOKEN" ]; then
    # Running inside Home Assistant Supervisor
    HASS_URL="http://supervisor/core"
    HASS_TOKEN="$SUPERVISOR_TOKEN"
    echo "✓ Detected Home Assistant Supervisor environment"
    echo "  Using internal API: $HASS_URL"
else
    # Fallback for local development
    HASS_URL="${HASS_URL:-http://homeassistant.local:8123}"
    HASS_TOKEN="${HASS_TOKEN:-}"
    echo "⚠ Running outside Supervisor (dev mode)"
    echo "  Using external API: $HASS_URL"
fi

# Export environment variables for Node.js
export HASS_URL
export HASS_TOKEN
export LOG_LEVEL
export HTTP_PORT
export BEARER_TOKEN
export REQUIRE_AUTH
export CACHE_REFRESH_INTERVAL
export ENTITY_CACHE_ENABLED

# Data paths for persistence
export CACHE_PATH="/data/entity_cache.json"
export TOON_CACHE_PATH="/data/entity_cache.toon"

echo ""
echo "Configuration:"
echo "  HTTP Port: $HTTP_PORT"
echo "  Log Level: $LOG_LEVEL"
echo "  Auth Required: $REQUIRE_AUTH"
echo "  Cache Refresh: ${CACHE_REFRESH_INTERVAL}s"
echo "  Cache Enabled: $ENTITY_CACHE_ENABLED"
echo ""

# Verify Home Assistant connectivity
echo "Verifying Home Assistant connectivity..."
if [ -n "$HASS_TOKEN" ]; then
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" \
        -H "Authorization: Bearer $HASS_TOKEN" \
        "${HASS_URL}/api/" 2>/dev/null || echo "000")
    
    if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "201" ]; then
        echo "✓ Successfully connected to Home Assistant API"
    else
        echo "⚠ Warning: Could not verify Home Assistant API (HTTP $HTTP_CODE)"
        echo "  Server will retry on startup"
    fi
else
    echo "⚠ Warning: No HASS_TOKEN available"
fi

echo ""
echo "Starting MCP server..."
echo "============================================"

# Start the Node.js server
cd /app
exec node server.js

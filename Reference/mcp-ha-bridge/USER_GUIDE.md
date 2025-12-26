<!-- @format -->

# Home Assistant LLM Bridge - User Guide

Complete guide for the Home Assistant Model Context Protocol (MCP) server and LLM bridge with enhanced entity discovery.

**Version:** 1.1.0 | **Updated:** October 3, 2025

---

## Table of Contents

1. [Quick Start](#quick-start)
2. [Features](#features)
3. [Installation](#installation)
4. [Available Tools](#available-tools)
5. [Usage Examples](#usage-examples)
6. [Natural Language with Copilot](#natural-language-with-copilot)
7. [Troubleshooting](#troubleshooting)

---

## Quick Start

### 5-Minute Setup

1. **Configure Environment** - Create `.env` file:

   ```env
   HASS_TOKEN=your_long_lived_access_token
   HASS_URL=http://172.17.2.53:8123
   ```

2. **Test the Server**:

   ```bash
   cd /root/config/.vscode/mcp-ha-bridge
   node -c server.js  # Syntax check
   ```

3. **VS Code Integration** - Add to `.vscode/mcp.json`:

   ```json
   {
     "servers": {
       "Home Assistant": {
         "command": "node",
         "args": ["/root/config/.vscode/mcp-ha-bridge/server.js"]
       }
     }
   }
   ```

4. **Try Natural Language**:
   - "Show me all bedroom lights"
   - "Which devices are offline?"
   - "Turn on the office lights"

---

## Features

### Core Capabilities

- **Intelligent Entity Resolution** - Resolves friendly names to entity IDs
- **Smart Disambiguation** - Handles partial matches and ambiguous names
- **Device Control** - Lights, climate, media players, fans, switches
- **Real-time Monitoring** - Current states of all entities
- **Historical Analytics** - Query history and baseline comparisons
- **Persistent Cache** - Fast startup with disk-persisted entity index

### 🆕 Enhanced Entity Discovery

- **Entity Explorer** - Browse and filter with advanced grouping
- **Entity Relationships** - Map connections and dependencies
- **Home Topology** - Visualize hierarchical structure
- **Device Health** - Monitor availability and freshness
- **Fuzzy Search** - Find entities with typo correction

### Performance

- **Response Time:** < 100ms typical
- **No Additional API Calls:** Uses in-memory cache
- **Auto-refresh:** Entity index updates every 60 seconds
- **Scales Well:** Handles 1,600+ entities efficiently

---

## Installation

### Prerequisites

- Node.js v16+
- Home Assistant with API access
- Long-Lived Access Token from Home Assistant

### Setup Steps

1. **Install Dependencies**:

   ```bash
   cd /root/config/.vscode/mcp-ha-bridge
   npm install
   ```

2. **Create `.env` File**:

   ```env
   HASS_TOKEN=your_token_here
   HASS_URL=http://your-ha-instance:8123
   ```

3. **Get Home Assistant Token**:

   - Go to Home Assistant → Profile
   - Scroll to "Long-Lived Access Tokens"
   - Click "Create Token"
   - Copy token to `.env` file

4. **Verify Connection**:
   ```bash
   node server.js
   # Should see: "Home Assistant MCP server running on stdio"
   # Should see: "Entity index built: X entities, Y name mappings"
   ```

---

## Available Tools

### 🔍 Discovery & Exploration

#### `explore_entities` - Browse Devices

Filter and group entities with powerful options.

**Parameters:**

- `domain` - Filter by type (light, sensor, switch, etc.)
- `area` - Filter by location
- `device_class` - Filter by class (motion, temperature, etc.)
- `state` - Filter by current state
- `search` - Fuzzy search text
- `group_by` - Group results (domain, area, device, device_class, state)
- `include_unavailable` - Show offline devices (default: false)
- `limit` - Max results (default: 50, max: 500)

**Examples:**

```javascript
// All motion sensors by room
explore_entities({ device_class: "motion", group_by: "area" });

// Bedroom devices by type
explore_entities({ area: "bedroom", group_by: "domain" });

// Currently on lights
explore_entities({ domain: "light", state: "on" });
```

---

#### `search_entities_fuzzy` - Smart Search

Find entities with typo tolerance and relevance scoring.

**Parameters:**

- `query` - Search text (handles typos and partials)
- `limit` - Max results (default: 10, max: 50)
- `domain_hint` - Prefer specific domain
- `area_hint` - Prefer specific area

**Examples:**

```javascript
// With typo
search_entities_fuzzy({ query: "bedroom ligt" });

// Context-aware
search_entities_fuzzy({
  query: "temp",
  domain_hint: "sensor",
  area_hint: "office",
});
```

---

#### `get_entity_relationships` - Understand Connections

See what uses an entity and what it's connected to.

**Parameters:**

- `entity_id` - Entity to analyze
- `name` - Friendly name (alternative)
- `area` - Area context for resolution
- `floor` - Floor context for resolution

**Returns:**

- Device information (manufacturer, model)
- Area assignment
- Related entities on same device
- Automations that reference it
- Scenes that include it
- Scripts that use it

**Example:**

```javascript
get_entity_relationships({ name: "bedroom fan" });
```

---

#### `get_home_topology` - Visualize Structure

Generate hierarchical map of your smart home.

**Parameters:**

- `include_entities` - Show all entities (default: false)
- `area_filter` - Specific areas (comma-separated)

**Returns:**

- Summary (total areas, devices, entities)
- Areas with devices and counts
- Unassigned devices

**Examples:**

```javascript
// Overview
get_home_topology({ include_entities: false });

// Detailed bedroom view
get_home_topology({
  include_entities: true,
  area_filter: "bedroom",
});
```

---

#### `get_device_health` - Monitor Status

Find offline or stale devices.

**Parameters:**

- `entity_id` - Check specific entity
- `area` - Check area
- `domain` - Check domain
- `show_healthy` - Include working devices (default: false)
- `stale_threshold_hours` - Hours to consider stale (default: 24)

**Returns:**

- Summary statistics
- Unavailable entities
- Stale entities (not updated recently)
- Hours since last update

**Examples:**

```javascript
// Find all problems
get_device_health({ show_healthy: false });

// Check bedroom
get_device_health({ area: "bedroom", show_healthy: true });

// Aggressive sensor check
get_device_health({
  domain: "sensor",
  stale_threshold_hours: 6,
});
```

---

### 🎮 Device Control

#### `HassTurnOn` / `HassTurnOff`

Turn devices on or off using flexible naming.

**Examples:**

```javascript
HassTurnOn({ name: "office lights" });
HassTurnOff({ area: "bedroom", name: "lamp" });
HassTurnOn({ entity_id: "light.sam_office_tube" });
```

---

#### `HassLightSet`

Control lights with brightness, color, and temperature.

**Parameters:**

- `name`, `area`, `floor` - Entity resolution
- `brightness` - Percentage (0-100)
- `color` - Color name
- `temperature` - Color temperature (Kelvin)

**Examples:**

```javascript
HassLightSet({ name: "bedroom", brightness: 30 });
HassLightSet({ area: "living room", color: "blue", brightness: 80 });
```

---

#### `HassClimateSetTemperature`

Set thermostat temperature.

**Example:**

```javascript
HassClimateSetTemperature({ name: "thermostat", temperature: 72 });
```

---

#### `HassFanSetSpeed`

Control fan speed by percentage.

**Example:**

```javascript
HassFanSetSpeed({ name: "bedroom fan", percentage: 75 });
```

---

#### Media Player Controls

`HassMediaPause`, `HassMediaUnpause`, `HassMediaNext`, `HassMediaPrevious`

**Examples:**

```javascript
HassMediaPause({ name: "living room sonos" });
HassMediaNext({ area: "bedroom" });
```

---

#### `HassSetVolume` / `HassSetVolumeRelative`

Control audio volume.

**Examples:**

```javascript
HassSetVolume({ name: "kitchen speaker", volume_level: 40 });
HassSetVolumeRelative({ name: "spotify", volume_step: "up" });
```

---

#### `HassMediaSearchAndPlay`

Search and play media content.

**Example:**

```javascript
HassMediaSearchAndPlay({
  name: "spotify",
  search_query: "chill jazz",
  media_class: "playlist",
});
```

---

### 📊 Monitoring & Analytics

#### `get_states`

Get current state of entities.

**Examples:**

```javascript
get_states({ entity_id: "light.sam_office_tube" });
get_states({}); // All entities
```

---

#### `get_history`

Query historical state changes with statistics.

**Parameters:**

- `entity_id` / `entity_ids` - Entities to query
- `name` - Friendly name (auto-resolve)
- `hours` - Past N hours
- `start` / `end` - ISO8601 timestamps
- `include_states` - Include raw states (default: false)
- `minimal_response` - Omit samples (default: true)

**Example:**

```javascript
get_history({ name: "Living Room Temperature", hours: 24 });
```

---

#### `get_entity_baseline`

Compare recent behavior vs historical baseline for anomaly detection.

**Parameters:**

- `entity_id` / `name` - Entity to analyze
- `recent_hours` - Recent window (default: 1)
- `baseline_hours` - Historical window (default: 24)

**Returns:**

- Numeric deltas (avg, min, max, stddev changes)
- Transition rate comparison
- Duration percentage changes
- Automation insights and recommendations

**Example:**

```javascript
get_entity_baseline({
  name: "bedroom motion",
  recent_hours: 2,
  baseline_hours: 48,
});
```

---

#### `GetLiveContext`

Get comprehensive system status and all entity states.

---

#### `admin_debug`

Comprehensive debugging and entity search.

**Parameters:**

- `search` - Search term
- `type` - Filter (entities, areas, devices, automations, scenes, scripts, all)

**Example:**

```javascript
admin_debug({ search: "office", type: "entities" });
```

---

## Usage Examples

### Common Scenarios

#### Scenario 1: "I'm going on vacation - check everything works"

```javascript
// 1. Check all device health
get_device_health({
  show_healthy: true,
  stale_threshold_hours: 12,
});

// 2. For any issues found, investigate
get_entity_relationships({ entity_id: "sensor.problem_sensor" });

// 3. Fix issues or disable automations
HassTurnOff({ name: "problematic device" });
```

---

#### Scenario 2: "What lights are in the bedroom?"

```javascript
explore_entities({ domain: "light", area: "bedroom" });
```

---

#### Scenario 3: "Remove a device safely"

```javascript
// 1. Check what uses it
get_entity_relationships({ entity_id: "light.old_lamp" });

// 2. Review automations_referencing, scenes_referencing, scripts_referencing
// 3. Update those first
// 4. Then remove device
```

---

#### Scenario 4: "Find the office temperature sensor"

```javascript
search_entities_fuzzy({
  query: "office temp",
  domain_hint: "sensor",
  area_hint: "office",
});
```

---

#### Scenario 5: "Plan room automation"

```javascript
// 1. See room layout
get_home_topology({
  include_entities: true,
  area_filter: "bedroom",
});

// 2. Find devices by type
explore_entities({ area: "bedroom", group_by: "domain" });

// 3. Check dependencies for key devices
get_entity_relationships({ entity_id: "light.bedroom_ceiling" });

// 4. Verify health
get_device_health({ area: "bedroom", show_healthy: true });
```

---

#### Scenario 6: "Which sensors haven't updated recently?"

```javascript
get_device_health({
  domain: "sensor",
  stale_threshold_hours: 6,
  show_healthy: false,
});
```

---

### Workflow Patterns

#### Discovery → Understanding → Action

```javascript
// 1. Find device
search_entities_fuzzy({ query: "office light" });

// 2. Understand it
get_entity_relationships({ entity_id: "light.sam_office_tube" });

// 3. Control it
HassTurnOn({ entity_id: "light.sam_office_tube" });
```

---

#### Monitoring → Investigation → Fix

```javascript
// 1. Find problems
get_device_health({ show_healthy: false });

// 2. Understand context
get_entity_relationships({ entity_id: "problematic_entity" });

// 3. Check if pattern exists
get_device_health({ area: "area_from_step_2" });
```

---

## Natural Language with Copilot

When using GitHub Copilot, just ask naturally:

### Discovery

- "Show me all bedroom lights organized by type"
- "Find all motion sensors in my house"
- "Which lights are currently on?"

### Health & Monitoring

- "Which devices aren't responding?"
- "Show me sensors that haven't updated in 6 hours"
- "Check if bedroom devices are working"

### Understanding

- "Tell me everything about my bedroom fan"
- "What automations use the office lights?"
- "Show me my home structure"

### Control

- "Turn on the office lights"
- "Set bedroom fan to 75%"
- "Dim living room lights to 30%"
- "Play jazz music on Spotify"

### Search

- "Find my office temperature sensor"
- "Search for bedroom light" (even with typos!)

Copilot automatically selects the right tool and parameters!

---

## Troubleshooting

### Common Issues

#### "Could not resolve entity"

**Problem:** Entity name not found in index

**Solutions:**

1. Use `search_entities_fuzzy` to find correct name
2. Use `admin_debug` with search term
3. Check if entity exists: `get_states({})`
4. Wait for index refresh (happens every 60s)

---

#### Connection Errors

**Problem:** Can't connect to Home Assistant

**Solutions:**

1. Verify `HASS_URL` in `.env` is correct
2. Check Home Assistant is running
3. Test URL in browser: `http://your-ha:8123`
4. Verify network connectivity

---

#### Authentication Errors

**Problem:** Invalid token

**Solutions:**

1. Verify `HASS_TOKEN` in `.env` is correct
2. Token must be Long-Lived Access Token, not temporary
3. Create new token in Home Assistant profile
4. Check token hasn't been revoked

---

#### "Service call failed"

**Problem:** Entity doesn't support service

**Solutions:**

1. Use `get_entity_relationships` to check entity type
2. Verify entity supports the service (e.g., lights support brightness)
3. Check entity state: `get_states({ "entity_id": "..." })`

---

#### Slow Performance

**Problem:** Responses taking too long

**Solutions:**

1. Use `limit` parameter to reduce result size
2. Filter by domain or area instead of searching everything
3. Use `include_entities: false` in topology for overview
4. Check Home Assistant performance

---

#### Index Not Building

**Problem:** "Building entity index..." but never completes

**Solutions:**

1. Check Home Assistant API is accessible
2. Verify token has correct permissions
3. Check logs for error messages
4. Restart MCP server

---

### Debug Mode

Enable detailed logging:

```bash
export DEBUG=true
node server.js
```

Check entity resolution:

```javascript
admin_debug({ search: "partial_name", type: "entities" });
```

---

## Tips & Best Practices

### Discovery

1. **Start broad, narrow down** - Use `explore_entities` then `search_entities_fuzzy`
2. **Use grouping** - Group by area for location tasks, domain for device types
3. **Leverage hints** - Always provide `domain_hint` and `area_hint` in fuzzy search

### Health Monitoring

1. **Regular checks** - Run `get_device_health` weekly
2. **Appropriate thresholds** - Adjust `stale_threshold_hours` per device type
3. **Area-specific** - Check critical areas more frequently

### Automation Planning

1. **Check dependencies first** - Use `get_entity_relationships` before changes
2. **Understand topology** - Use `get_home_topology` to see organization
3. **Test safely** - Control single entities before bulk operations

### Performance

1. **Use filters** - Don't request all entities when you need specific ones
2. **Limit results** - Set appropriate `limit` values
3. **Cache awareness** - Index refreshes every 60s, use cached data

---

## Architecture

### Data Flow

```
Home Assistant API
    ↓
Entity Index Cache (in-memory, 60s refresh)
    ↓
MCP Tools (5 discovery + 15 control/monitoring)
    ↓
GitHub Copilot / MCP Client
```

### Entity Index

- **Entities:** 1,600+
- **Name Mappings:** 3,200+
- **Refresh:** Every 60 seconds
- **Persistence:** Saved to `entity_index_cache.json` (structured) and `entity_index_cache.toon` (LLM-friendly summary for ingestion)
- **Lookup:** O(1) by entity_id or normalized name

### Performance Characteristics

- **Entity Resolution:** ~10ms
- **Filtered Browsing:** ~20ms
- **Fuzzy Search:** ~30ms
- **Health Checks:** ~40ms
- **Topology Building:** ~50ms

All tools use in-memory cache - no additional API calls!

---

## Changelog

### Version 1.1.0 (October 3, 2025)

**Added:**

- 5 new entity discovery tools
- Fuzzy search with typo correction
- Device health monitoring
- Home topology visualization
- Entity relationship mapping
- ~650 lines of code

**Performance:**

- No additional API calls
- < 100ms response times
- Zero new dependencies

**Compatibility:**

- Fully backward compatible
- No breaking changes

---

## Support

### Documentation

- **This Guide** - Complete feature reference
- **COPILOT_INSTRUCTIONS.md** - Copilot integration patterns

### Getting Help

1. Check this guide for examples
2. Use `admin_debug` for entity resolution issues
3. Review logs for error messages
4. Open issue in home-assistant-config repo

---

## License

Part of the home-assistant-config repository. Same licensing terms apply.

---

**Version 1.1.0** | **Updated: October 3, 2025**

For Copilot integration details, see `COPILOT_INSTRUCTIONS.md`

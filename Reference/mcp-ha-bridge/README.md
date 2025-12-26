<!-- @format -->

# Home Assistant LLM Bridge

Model Context Protocol server and LLM bridge for Home Assistant integration with GitHub Copilot and LLM tooling.

**Version:** 1.1.0

---

## Overview

Comprehensive MCP server providing 20 tools for controlling smart home devices, monitoring states, discovering entities, and analyzing history. Features intelligent entity resolution with 3,200+ name mappings and in-memory caching for fast performance.

### Key Features

- **20 Tools** - Discovery (5), Control (9), Monitoring (6)
- **Smart Entity Resolution** - 3,200+ name mappings to 1,600+ entities
- **In-Memory Caching** - 60-second refresh, zero additional API calls
- **Fuzzy Search** - Typo-tolerant with relevance scoring
- **Relationship Mapping** - Understand entity connections and dependencies
- **Health Monitoring** - Track device availability and freshness
- **Topology Visualization** - Hierarchical home structure

---

## Documentation

### **[USER_GUIDE.md](USER_GUIDE.md)** - Complete User Documentation

Full documentation with:

- Quick start guide
- All 20 tools with detailed parameters
- Usage examples and workflows
- Troubleshooting guide
- Architecture details
- Changelog

### **[COPILOT_INSTRUCTIONS.md](COPILOT_INSTRUCTIONS.md)** - GitHub Copilot Integration

Instructions for GitHub Copilot:

- Tool usage patterns
- Natural language → tool mapping
- Entity resolution best practices
- Common workflows
- Error handling strategies

---

## Quick Start

### Prerequisites

- Home Assistant running and accessible
- Node.js 16+ installed
- GitHub Copilot with MCP support

### Installation

1. **Clone/copy this server to your workspace:**

   ```bash
   # Recommended location
   mkdir -p ~/.vscode/mcp-ha-bridge
   cd ~/.vscode/mcp-ha-bridge
   # Copy server.js, package.json, and .env files here
   ```

2. **Install dependencies:**

   ```bash
   npm install
   ```

3. **Configure Home Assistant connection:**
   Create `.env` file:

   ```env
   HASS_URL=http://your-ha-instance:8123
   HASS_TOKEN=your_long_lived_access_token
   ```

4. **Configure VS Code settings:**
   Add to `.vscode/settings.json` in your workspace:

   ```json
   {
     "github.copilot.chat.mcp.enabled": true,
     "github.copilot.chat.mcp.servers": {
       "home-assistant": {
         "command": "node",
         "args": ["/absolute/path/to/mcp-ha-bridge/server.js"]
       }
     }
   }
   ```

5. **Reload VS Code window**

### First Steps

Ask Copilot:

- "Show all lights in the bedroom" → Uses `explore_entities`
- "Turn on office lights" → Uses `HassTurnOn`
- "Search for temperature sensors" → Uses `search_entities_fuzzy`
- "Which devices are offline?" → Uses `get_device_health`
- "Show home layout" → Uses `get_home_topology`

---

## Tool Categories

### 🔍 Discovery (5 tools)

- `explore_entities` - Browse/filter with grouping
- `search_entities_fuzzy` - Typo-tolerant search
- `get_entity_relationships` - Map connections
- `get_home_topology` - Hierarchical structure
- `get_device_health` - Availability monitoring

### 🎮 Control (9 tools)

- `HassTurnOn` / `HassTurnOff` - Any device
- `HassLightSet` - Brightness/color/temperature
- `HassClimateSetTemperature` - Thermostats
- `HassFanSetSpeed` - Fan percentage
- `HassMedia*` - Pause, Play, Next, Previous, SearchAndPlay
- `HassSetVolume` / `HassSetVolumeRelative` - Audio

### 📊 Monitoring (6 tools)

- `get_states` - Current entity states
- `GetLiveContext` - Full system status
- `get_history` - Historical data with statistics
- `get_entity_baseline` - Anomaly detection
- `admin_debug` - Entity search/debugging
- `call_service` - Generic service calls

---

## Entity Resolution

Smart resolution with fuzzy matching:

```javascript
// Friendly name
"office lights" → light.sam_office_tube

// Area + device
{"area": "bedroom", "name": "fan"} → fan.2f_bedroom_fan

// Partial match with context
{"name": "temp", "area": "office"} → sensor.office_temperature
```

If resolution fails, tools automatically fallback to fuzzy search with suggestions.

---

## Performance

- **In-Memory Cache:** All discovery tools use cached entity index
- **Fast Response:** 10-50ms typical, no additional API calls
- **Auto-Refresh:** Cache updates every 60 seconds
- **Persistent:** Saved to disk as structured JSON for fast restart (`entity_index_cache.json`) and an LLM-friendly `.toon` summary (`entity_index_cache.toon`) for LLM ingestion
- **Scalable:** Handles 1,600+ entities efficiently

---

## Architecture

```
GitHub Copilot
    ↓
MCP Protocol
    ↓
server.js (MCP Server)
    ↓
Entity Index Cache (in-memory)
    ↓
Home Assistant API
    ↓
Smart Home Devices
```

- **Entity Index:** In-memory cache with 1,600+ entities and 3,200+ name mappings
- **WebSocket:** Persistent connection for state updates
- **Fuzzy Matching:** Character-level similarity with 1-2 char tolerance
- **Relevance Scoring:** Multi-factor scoring for best matches

---

## Troubleshooting

### Connection Issues

```bash
# Verify Home Assistant is accessible
curl -H "Authorization: Bearer YOUR_TOKEN" http://your-ha:8123/api/

# Check server logs
node server.js
# Should see: "Connected to Home Assistant" and "Entity index built"
```

### Entity Resolution Failures

Use fuzzy search: "Search for [entity description]"

### Stale Data

Cache refreshes every 60s. Wait or restart VS Code to rebuild.

### Performance Issues

- Use `limit` parameter to reduce response size
- Filter by domain/area instead of broad searches
- Use `include_entities: false` for topology overview

---

## Requirements

- **Home Assistant:** 2023.1 or later
- **Node.js:** 16 or later
- **VS Code:** Latest version with Copilot MCP support
- **Network:** Server must reach Home Assistant API

---

## Version History

### 1.1.0 (Current)

- Added Enhanced Entity Discovery feature set:
  - `explore_entities` - Browse and filter with grouping
  - `search_entities_fuzzy` - Typo-tolerant search with scoring
  - `get_entity_relationships` - Dependency mapping
  - `get_home_topology` - Hierarchical home structure
  - `get_device_health` - Availability monitoring
- In-memory entity index cache (60s refresh)
- Fuzzy matching algorithm with relevance scoring
- Performance optimizations (0 additional API calls)

### 1.0.0

- Initial release with 15 core tools
- Entity resolution with name/area/floor disambiguation
- Control tools (lights, climate, fans, media)
- Monitoring tools (states, history, baseline)
- Home Assistant API integration

---

## License

MIT

---

## Contributing

Issues and pull requests welcome. Follow existing code patterns and update documentation.

---

## Support

For detailed usage, examples, and troubleshooting, see **[USER_GUIDE.md](USER_GUIDE.md)**.

For GitHub Copilot integration patterns, see **[COPILOT_INSTRUCTIONS.md](COPILOT_INSTRUCTIONS.md)**.

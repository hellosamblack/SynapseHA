# SynapseHA

MCP server for Home Assistant providing 20+ tools for LLM-driven control and maintenance.

## Key Features

- **Smart Resolution**: Fuzzy search and typo-tolerant mapping for 3,200+ names
- **Full Control**: Lights, climate, media, fans, and service calls
- **Deep Discovery**: Explore topology, entity relationships, and device health
- **Analytics**: Live context, historical baselines, and anomaly detection
- **Performance**: Persistent disk cache with 60s auto-refresh for <50ms responses

## Installation

```bash
npm install
npm run build
```

## Configuration

Set the following environment variables:

```bash
export HA_URL="http://homeassistant.local:8123"
export HA_TOKEN="your_long_lived_access_token"
export CACHE_DIR="./cache"  # Optional, defaults to ./cache
export CACHE_TTL="60000"    # Optional, defaults to 60 seconds
```

### Getting a Home Assistant Token

1. Open Home Assistant
2. Go to your profile (bottom left)
3. Scroll to "Long-Lived Access Tokens"
4. Click "Create Token"
5. Copy the token

## Usage

### Running the Server

```bash
npm start
```

### Using with Claude Desktop

Add to your Claude Desktop config (`~/Library/Application Support/Claude/claude_desktop_config.json` on macOS):

```json
{
  "mcpServers": {
    "synapseha": {
      "command": "node",
      "args": ["/path/to/SynapseHA/dist/index.js"],
      "env": {
        "HA_URL": "http://homeassistant.local:8123",
        "HA_TOKEN": "your_token_here"
      }
    }
  }
}
```

## Available Tools

### Entity Discovery (4 tools)

1. **list_entities** - List all entities or filter by domain (light, switch, climate, sensor)
2. **search_entities** - Fuzzy search entities by name with typo tolerance
3. **get_entity_state** - Get detailed state and attributes for specific entities
4. **get_entity_relationships** - Get relationships between entities, devices, and areas

### Device Control (5 tools)

5. **control_light** - Control lights: on/off, brightness, color, temperature
6. **control_climate** - Control thermostats: temperature, mode, fan
7. **control_media_player** - Control media: play, pause, volume, source
8. **control_fan** - Control fans: speed, direction
9. **control_switch** - Control switches and smart plugs

### Service Calls (1 tool)

10. **call_service** - Call any Home Assistant service with custom parameters

### Topology & Discovery (4 tools)

11. **get_areas** - List all areas (rooms)
12. **get_devices** - List all devices with optional area filter
13. **get_device_health** - Check unavailable entities and low battery devices
14. **list_services** - List all available services by domain

### Analytics (4 tools)

15. **get_live_context** - Get current state: active entities, recent changes
16. **get_history** - Get historical data for entities over time
17. **calculate_baseline** - Calculate statistics (avg, min, max, median)
18. **detect_anomalies** - Detect stuck sensors and anomalies

### Automation (2 tools)

19. **activate_scene** - Activate a Home Assistant scene
20. **trigger_automation** - Trigger a Home Assistant automation

### System Info (1 tool)

21. **get_system_info** - Get Home Assistant version, location, and entity counts

## Example Usage

### Ask Claude to:

- "Turn on the living room lights at 50% brightness"
- "What's the temperature in the bedroom?"
- "Show me all devices with low battery"
- "Find entities that haven't updated in the last hour"
- "What lights are currently on?"
- "Set the thermostat to 72 degrees"
- "Show me the history of the front door sensor for the last 24 hours"

## Architecture

```
SynapseHA/
├── src/
│   ├── index.ts              # Main MCP server
│   ├── lib/
│   │   ├── ha-client.ts      # Home Assistant API wrapper
│   │   ├── cache.ts          # Persistent cache with auto-refresh
│   │   └── fuzzy-search.ts   # Fuzzy matching for entities
│   ├── tools/
│   │   └── index.ts          # All 21 MCP tools
│   └── types/
│       └── index.ts          # TypeScript type definitions
├── dist/                     # Compiled JavaScript
└── cache/                    # Persistent disk cache
```

## Performance

- **Cache Hit**: <50ms response time
- **Cache Miss**: ~200-500ms (API call + cache write)
- **Auto-refresh**: Every 60 seconds for entity states
- **Fuzzy Search**: ~5-10ms for 3,200+ entities

## Development

```bash
# Watch mode for development
npm run watch

# Build for production
npm run build

# Run the server
npm start
```

## License

ISC

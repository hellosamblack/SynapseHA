# SynapseHA

MCP server for Home Assistant providing 21 tools for LLM-driven control and maintenance.

[![License: ISC](https://img.shields.io/badge/License-ISC-blue.svg)](https://opensource.org/licenses/ISC)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-18+-green)](https://nodejs.org/)

## ✨ Key Features

- **🎯 Smart Resolution**: Fuzzy search and typo-tolerant mapping for 3,200+ names
- **🎮 Full Control**: Lights, climate, media, fans, and service calls
- **🔍 Deep Discovery**: Explore topology, entity relationships, and device health
- **📊 Analytics**: Live context, historical baselines, and anomaly detection
- **⚡ Performance**: Persistent disk cache with 60s auto-refresh for <50ms responses

## 🚀 Quick Start

1. **Install dependencies**
   ```bash
   npm install
   npm run build
   ```

2. **Get Home Assistant token**
   - Open Home Assistant
   - Go to Profile → Long-Lived Access Tokens
   - Create a new token

3. **Configure environment**
   ```bash
   cp .env.example .env
   # Edit .env with your HA_URL and HA_TOKEN
   ```

4. **Add to Claude Desktop**
   
   Edit `~/Library/Application Support/Claude/claude_desktop_config.json`:
   ```json
   {
     "mcpServers": {
       "synapseha": {
         "command": "node",
         "args": ["/absolute/path/to/SynapseHA/dist/index.js"],
         "env": {
           "HA_URL": "http://homeassistant.local:8123",
           "HA_TOKEN": "your_token_here"
         }
       }
     }
   }
   ```

5. **Restart Claude Desktop** and start chatting!

## 📋 Installation

```bash
git clone https://github.com/hellosamblack/SynapseHA.git
cd SynapseHA
npm install
npm run build
```

## ⚙️ Configuration

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

## 🛠️ Available Tools (21 Total)

<details>
<summary><b>Entity Discovery (4 tools)</b></summary>

1. **list_entities** - List all entities or filter by domain (light, switch, climate, sensor)
2. **search_entities** - Fuzzy search entities by name with typo tolerance
3. **get_entity_state** - Get detailed state and attributes for specific entities
4. **get_entity_relationships** - Get relationships between entities, devices, and areas

</details>

<details>
<summary><b>Device Control (5 tools)</b></summary>

5. **control_light** - Control lights: on/off, brightness, color, temperature
6. **control_climate** - Control thermostats: temperature, mode, fan
7. **control_media_player** - Control media: play, pause, volume, source
8. **control_fan** - Control fans: speed, direction
9. **control_switch** - Control switches and smart plugs

</details>

<details>
<summary><b>Service Calls (1 tool)</b></summary>

10. **call_service** - Call any Home Assistant service with custom parameters

</details>

<details>
<summary><b>Topology & Discovery (4 tools)</b></summary>

11. **get_areas** - List all areas (rooms)
12. **get_devices** - List all devices with optional area filter
13. **get_device_health** - Check unavailable entities and low battery devices
14. **list_services** - List all available services by domain

</details>

<details>
<summary><b>Analytics (4 tools)</b></summary>

15. **get_live_context** - Get current state: active entities, recent changes
16. **get_history** - Get historical data for entities over time
17. **calculate_baseline** - Calculate statistics (avg, min, max, median)
18. **detect_anomalies** - Detect stuck sensors and anomalies

</details>

<details>
<summary><b>Automation (2 tools)</b></summary>

19. **activate_scene** - Activate a Home Assistant scene
20. **trigger_automation** - Trigger a Home Assistant automation

</details>

<details>
<summary><b>System Info (1 tool)</b></summary>

21. **get_system_info** - Get Home Assistant version, location, and entity counts

</details>

See [API.md](API.md) for detailed documentation of each tool.

## 💡 Example Usage

### Ask Claude to:

- "Turn on the living room lights at 50% brightness"
- "What's the temperature in the bedroom?"
- "Show me all devices with low battery"
- "Find entities that haven't updated in the last hour"
- "What lights are currently on?"
- "Set the thermostat to 72 degrees"
- "Show me the history of the front door sensor for the last 24 hours"

## 🏗️ Architecture

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

## ⚡ Performance

- **Cache Hit**: <50ms response time
- **Cache Miss**: ~200-500ms (API call + cache write)
- **Auto-refresh**: Every 60 seconds for entity states
- **Fuzzy Search**: ~5-10ms for 3,200+ entities

## 🔧 Development

```bash
# Watch mode for development
npm run watch

# Build for production
npm run build

# Run the server
npm start
```

See [CONTRIBUTING.md](CONTRIBUTING.md) for development guidelines.

## 📚 Documentation

- [API.md](API.md) - Complete API reference for all tools
- [TROUBLESHOOTING.md](TROUBLESHOOTING.md) - Common issues and solutions
- [CHANGELOG.md](CHANGELOG.md) - Version history and changes
- [CONTRIBUTING.md](CONTRIBUTING.md) - Development guide

## 🤝 Contributing

Contributions are welcome! Please read [CONTRIBUTING.md](CONTRIBUTING.md) for details.

## 📝 License

ISC - See [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

Built with:
- [Model Context Protocol SDK](https://github.com/modelcontextprotocol/sdk) - MCP implementation
- [Home Assistant](https://www.home-assistant.io/) - Smart home platform
- [Fuse.js](https://fusejs.io/) - Fuzzy search library
- [Axios](https://axios-http.com/) - HTTP client

## 🐛 Issues & Support

- Check [TROUBLESHOOTING.md](TROUBLESHOOTING.md) first
- Search [existing issues](https://github.com/hellosamblack/SynapseHA/issues)
- Create a [new issue](https://github.com/hellosamblack/SynapseHA/issues/new) if needed

## ⭐ Star History

If you find SynapseHA useful, please consider giving it a star on GitHub!

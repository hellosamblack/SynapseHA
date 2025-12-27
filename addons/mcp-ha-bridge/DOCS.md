# MCP Home Assistant Bridge Add-on

## About

This is a reference implementation of an MCP (Model Context Protocol) server for Home Assistant. It provides 20 tools for controlling smart home devices, monitoring states, discovering entities, and analyzing history.

**Note:** This addon uses STDIO transport and is primarily intended as a reference implementation. For production use with HTTP/SSE transport suitable for remote clients, please use the main **SynapseHA** addon instead.

## Features

- **20 MCP Tools**: Discovery (5), Control (9), Monitoring (6)
- **Smart Entity Resolution**: 3,200+ name mappings to entities
- **In-Memory Caching**: 60-second refresh for fast performance
- **Fuzzy Search**: Typo-tolerant entity name matching
- **Relationship Mapping**: Understand entity connections
- **Health Monitoring**: Track device availability
- **Topology Visualization**: Hierarchical home structure

## Configuration

### Options

| Option | Default | Description |
|--------|---------|-------------|
| `log_level` | `info` | Logging level (debug, info, warn, error) |
| `http_port` | `3000` | Port configuration (for future HTTP transport) |
| `bearer_token` | `""` | Optional bearer token for authentication |
| `require_auth` | `false` | Require authentication for connections |
| `cache_refresh_interval` | `60` | Cache refresh interval in seconds |
| `entity_cache_enabled` | `true` | Enable entity caching for performance |

### Example Configuration

```yaml
log_level: info
http_port: 3000
bearer_token: ""
require_auth: false
cache_refresh_interval: 60
entity_cache_enabled: true
```

## Usage

This addon automatically connects to your Home Assistant instance using the Supervisor API. The MCP server provides tools that can be accessed by compatible MCP clients (like Claude Desktop with MCP support or GitHub Copilot).

### Connecting MCP Clients

Since this addon uses STDIO transport, it's best suited for local development or as a reference. For remote MCP clients that need HTTP/SSE endpoints, use the main **SynapseHA** addon which provides:

- **SSE endpoint**: `http://<homeassistant-ip>:3000/mcp`
- **Messages endpoint**: `POST http://<homeassistant-ip>:3000/messages?sessionId=<id>`
- **Health check**: `http://<homeassistant-ip>:3000/health`

## Comparison with SynapseHA

| Feature | mcp_ha_bridge (Reference) | SynapseHA (Production) |
|---------|--------------------------|------------------------|
| Transport | STDIO | HTTP/SSE |
| Remote Access | No | Yes |
| Web UI | No | No |
| Tools | 20 | 21 |
| Cache | In-memory | Persistent disk cache |
| Auto-refresh | Yes (60s) | Yes (60s) |
| Best For | Reference/Development | Production/Remote Use |

## Troubleshooting

### Addon Fails to Start

1. Check the addon logs for detailed error messages
2. Verify Home Assistant API is accessible
3. Ensure proper configuration options are set

### Cannot Connect to Home Assistant

The addon automatically uses the Supervisor token for authentication. If you see connection errors:

1. Verify `homeassistant_api: true` is set in config.yaml
2. Check Home Assistant is running and healthy
3. Review addon logs for specific error messages

## Support

For issues, questions, or contributions:
- GitHub Repository: https://github.com/hellosamblack/SynapseHA
- Issues: https://github.com/hellosamblack/SynapseHA/issues

## License

MIT License - see repository for full license text.

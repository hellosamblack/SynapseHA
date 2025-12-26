# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2025-12-26

### Added
- Initial release of SynapseHA MCP server
- 21 tools for Home Assistant control and monitoring
- Fuzzy search with typo tolerance for entity name resolution
- Persistent disk cache with 60-second auto-refresh
- In-memory cache layer for <50ms response times
- Complete Home Assistant API client wrapper
- Support for lights, climate, media players, fans, and switches
- Entity relationship and topology exploration
- Device health monitoring (unavailable entities, low battery)
- Analytics tools: live context, historical baselines, anomaly detection
- Scene and automation triggering
- System information and service discovery
- Comprehensive API documentation
- Example configuration files
- Claude Desktop integration examples

### Features by Category

#### Entity Discovery
- `list_entities` - List and filter entities by domain
- `search_entities` - Fuzzy search with typo tolerance
- `get_entity_state` - Detailed entity state information
- `get_entity_relationships` - Entity-device-area relationships

#### Device Control
- `control_light` - Full light control (brightness, color, temperature)
- `control_climate` - Climate control (temperature, mode, fan)
- `control_media_player` - Media playback and volume control
- `control_fan` - Fan speed and direction control
- `control_switch` - Switch and smart plug control

#### Service Calls
- `call_service` - Generic service execution with custom parameters

#### Topology & Discovery
- `get_areas` - List all areas/rooms
- `get_devices` - List devices with area filtering
- `get_device_health` - Health monitoring and diagnostics
- `list_services` - Available services by domain

#### Analytics
- `get_live_context` - Current system state and recent activity
- `get_history` - Historical state data retrieval
- `calculate_baseline` - Statistical analysis (avg, min, max, median)
- `detect_anomalies` - Anomaly detection for sensors

#### Automation
- `activate_scene` - Scene activation
- `trigger_automation` - Automation triggering

#### System
- `get_system_info` - System configuration and metadata

### Technical Details
- Built with TypeScript and MCP SDK
- Uses Fuse.js for fuzzy search
- Axios for HTTP client
- Node.js 18+ compatible
- Modular architecture with separated concerns

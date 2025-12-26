# SynapseHA API Documentation

Complete reference for all 21 tools provided by the SynapseHA MCP server.

## Entity Discovery Tools

### 1. list_entities

List all entities or filter by domain.

**Parameters:**
- `domain` (optional): Filter by domain (e.g., "light", "switch", "climate", "sensor")
- `limit` (optional): Maximum number of entities to return (default: 100)

**Returns:** Array of entities with ID, state, and friendly name.

**Example:**
```json
{
  "domain": "light",
  "limit": 10
}
```

---

### 2. search_entities

Fuzzy search for entities by name with typo tolerance.

**Parameters:**
- `query` (required): Search query (entity name or partial ID)
- `limit` (optional): Maximum results to return (default: 10)

**Returns:** Ranked search results with match scores.

**Example:**
```json
{
  "query": "living room",
  "limit": 5
}
```

---

### 3. get_entity_state

Get detailed state and attributes for a specific entity.

**Parameters:**
- `entity_id` (required): Entity ID (e.g., "light.living_room") or friendly name

**Returns:** Complete entity state with all attributes.

**Example:**
```json
{
  "entity_id": "climate.bedroom_thermostat"
}
```

---

### 4. get_entity_relationships

Get relationships between entities, devices, and areas.

**Parameters:**
- `entity_id` (required): Entity ID to get relationships for

**Returns:** Entity with its device and area information.

**Example:**
```json
{
  "entity_id": "light.kitchen"
}
```

---

## Device Control Tools

### 5. control_light

Control lights: turn on/off, brightness, color, temperature.

**Parameters:**
- `entity_id` (required): Light entity ID or name
- `action` (required): "turn_on", "turn_off", or "toggle"
- `brightness` (optional): Brightness level (0-255)
- `rgb_color` (optional): RGB color array [R, G, B] (0-255)
- `color_temp` (optional): Color temperature in mireds

**Example:**
```json
{
  "entity_id": "light.living_room",
  "action": "turn_on",
  "brightness": 128,
  "rgb_color": [255, 200, 100]
}
```

---

### 6. control_climate

Control climate devices: temperature, HVAC mode, fan mode.

**Parameters:**
- `entity_id` (required): Climate entity ID or name
- `temperature` (optional): Target temperature
- `hvac_mode` (optional): "off", "heat", "cool", "heat_cool", "auto", "dry", "fan_only"
- `fan_mode` (optional): "auto", "low", "medium", "high"

**Example:**
```json
{
  "entity_id": "climate.bedroom",
  "temperature": 72,
  "hvac_mode": "heat"
}
```

---

### 7. control_media_player

Control media players: playback, volume, source.

**Parameters:**
- `entity_id` (required): Media player entity ID or name
- `action` (required): "play", "pause", "stop", "next_track", "previous_track", "volume_up", "volume_down", "volume_mute"
- `volume_level` (optional): Volume (0.0-1.0)
- `source` (optional): Source name to select

**Example:**
```json
{
  "entity_id": "media_player.spotify",
  "action": "play",
  "volume_level": 0.5
}
```

---

### 8. control_fan

Control fans: speed, direction.

**Parameters:**
- `entity_id` (required): Fan entity ID or name
- `action` (required): "turn_on", "turn_off", or "toggle"
- `percentage` (optional): Speed percentage (0-100)
- `direction` (optional): "forward" or "reverse"

**Example:**
```json
{
  "entity_id": "fan.bedroom_ceiling",
  "action": "turn_on",
  "percentage": 75
}
```

---

### 9. control_switch

Control switches and smart plugs.

**Parameters:**
- `entity_id` (required): Switch entity ID or name
- `action` (required): "turn_on", "turn_off", or "toggle"

**Example:**
```json
{
  "entity_id": "switch.coffee_maker",
  "action": "turn_on"
}
```

---

## Service Calls

### 10. call_service

Call any Home Assistant service with custom parameters.

**Parameters:**
- `domain` (required): Service domain (e.g., "light", "switch")
- `service` (required): Service name (e.g., "turn_on")
- `entity_id` (optional): Target entity ID
- `data` (optional): Service data/parameters object

**Example:**
```json
{
  "domain": "notify",
  "service": "persistent_notification",
  "data": {
    "message": "The front door is open",
    "title": "Security Alert"
  }
}
```

---

## Topology & Discovery Tools

### 11. get_areas

List all areas (rooms) in Home Assistant.

**Parameters:** None

**Returns:** List of all areas with IDs and names.

---

### 12. get_devices

List all devices registered in Home Assistant.

**Parameters:**
- `area_id` (optional): Filter by area ID

**Returns:** List of devices with manufacturer, model, and area information.

**Example:**
```json
{
  "area_id": "bedroom"
}
```

---

### 13. get_device_health

Check health status of all devices.

**Parameters:** None

**Returns:** Summary of unavailable entities and low battery devices.

---

### 14. list_services

List all available Home Assistant services.

**Parameters:**
- `domain` (optional): Filter by specific domain

**Returns:** List of services grouped by domain.

**Example:**
```json
{
  "domain": "light"
}
```

---

## Analytics Tools

### 15. get_live_context

Get current system context and recent activity.

**Parameters:**
- `minutes` (optional): Look-back period in minutes (default: 15)

**Returns:** Recent changes, active lights, and media players.

**Example:**
```json
{
  "minutes": 30
}
```

---

### 16. get_history

Get historical data for entities over a time period.

**Parameters:**
- `entity_ids` (required): Array of entity IDs
- `hours` (optional): Hours of history to retrieve (default: 24)

**Returns:** Historical state changes for each entity.

**Example:**
```json
{
  "entity_ids": ["sensor.temperature", "sensor.humidity"],
  "hours": 48
}
```

---

### 17. calculate_baseline

Calculate baseline statistics for sensor entities.

**Parameters:**
- `entity_ids` (required): Array of sensor entity IDs
- `hours` (optional): Hours of data to analyze (default: 168 = 1 week)

**Returns:** Statistics including average, median, min, max for each entity.

**Example:**
```json
{
  "entity_ids": ["sensor.living_room_temperature"],
  "hours": 168
}
```

---

### 18. detect_anomalies

Detect anomalies in entity states.

**Parameters:**
- `domain` (optional): Domain to check (default: "sensor")

**Returns:** List of detected anomalies including stuck sensors and unavailable entities.

**Example:**
```json
{
  "domain": "sensor"
}
```

---

## Automation Tools

### 19. activate_scene

Activate a Home Assistant scene.

**Parameters:**
- `entity_id` (required): Scene entity ID or name

**Example:**
```json
{
  "entity_id": "scene.movie_time"
}
```

---

### 20. trigger_automation

Trigger a Home Assistant automation.

**Parameters:**
- `entity_id` (required): Automation entity ID or name

**Example:**
```json
{
  "entity_id": "automation.sunset_lights"
}
```

---

## System Info

### 21. get_system_info

Get Home Assistant system information.

**Parameters:** None

**Returns:** Version, location, timezone, unit system, entity count, and available domains.

---

## Error Handling

All tools return structured responses. In case of errors, you'll receive:

```json
{
  "content": [{
    "type": "text",
    "text": "Error: <error message>"
  }],
  "isError": true
}
```

## Performance Notes

- **Cache hits**: <50ms response time
- **Cache misses**: ~200-500ms (includes API call)
- **Auto-refresh**: Entity states refresh every 60 seconds
- **Fuzzy search**: ~5-10ms for 3,200+ entities

## Best Practices

1. Use fuzzy search when you're not sure of exact entity names
2. Use `list_entities` with domain filter for discovery
3. Check `get_device_health` regularly for maintenance
4. Use `get_live_context` to understand current system state
5. Leverage `calculate_baseline` for anomaly detection context

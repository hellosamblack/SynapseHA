# GitHub Copilot Instructions for Home Assistant MCP Server

Instructions for GitHub Copilot on how to effectively use the Home Assistant MCP Server.

**Version:** 1.1.0 | **For full user documentation, see USER_GUIDE.md**

---

## Overview

Comprehensive Home Assistant MCP server with 20 tools for controlling smart home devices, monitoring states, discovering entities, and analyzing history. Features intelligent entity resolution with 3,200+ name mappings to 1,600+ entities, cached and refreshed every 60 seconds.

---

## Tool Categories

### 🔍 Discovery (5 tools)
- `explore_entities` - Browse/filter with grouping
- `search_entities_fuzzy` - Typo-tolerant search with relevance scoring
- `get_entity_relationships` - Map connections/dependencies
- `get_home_topology` - Hierarchical home structure
- `get_device_health` - Availability/freshness monitoring

### 🎮 Control (9 tools)
- `HassTurnOn` / `HassTurnOff` - Any device
- `HassLightSet` - Brightness, color, temperature
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

The server intelligently resolves entity names:

```javascript
// Friendly name
{"name": "office lights"} → light.sam_office_tube

// Area + device
{"area": "bedroom", "name": "fan"} → fan.2f_bedroom_fan

// Direct entity_id
{"entity_id": "light.sam_office_tube"}

// Partial match with context
{"name": "temp", "area": "office"} → sensor.office_temperature
```

**Best Practice:** Start with friendly names. If resolution fails, use `search_entities_fuzzy` or `admin_debug`.

---

## Quick Reference

### Natural Language → Tool Mapping

#### Discovery Requests
| User Says | Use Tool | Parameters |
|-----------|----------|------------|
| "Show all bedroom lights" | `explore_entities` | `{domain: "light", area: "bedroom"}` |
| "Find motion sensors" | `explore_entities` | `{device_class: "motion", group_by: "area"}` |
| "Search for office temp" | `search_entities_fuzzy` | `{query: "office temp", domain_hint: "sensor"}` |
| "What uses this light?" | `get_entity_relationships` | `{name: "light name"}` |
| "Show home layout" | `get_home_topology` | `{include_entities: false}` |
| "Which devices offline?" | `get_device_health` | `{show_healthy: false}` |

#### Control Requests
| User Says | Use Tool | Parameters |
|-----------|----------|------------|
| "Turn on office lights" | `HassTurnOn` | `{name: "office lights"}` |
| "Dim bedroom to 30%" | `HassLightSet` | `{area: "bedroom", brightness: 30}` |
| "Set thermostat to 72" | `HassClimateSetTemperature` | `{name: "thermostat", temperature: 72}` |
| "Fan to 75%" | `HassFanSetSpeed` | `{name: "bedroom fan", percentage: 75}` |
| "Play jazz music" | `HassMediaSearchAndPlay` | `{name: "spotify", search_query: "jazz", media_class: "music"}` |

#### Monitoring Requests
| User Says | Use Tool | Parameters |
|-----------|----------|------------|
| "Check light status" | `get_states` | `{entity_id: "light.bedroom"}` |
| "Sensors not updating?" | `get_device_health` | `{domain: "sensor", stale_threshold_hours: 6}` |
| "Show temp history" | `get_history` | `{name: "temperature", hours: 24}` |

---

## Tool Usage Patterns

### Discovery Pattern
```javascript
// 1. Browse by category
explore_entities({domain: "light", group_by: "area"})

// 2. Search specific item
search_entities_fuzzy({query: "office temp", domain_hint: "sensor"})

// 3. Understand relationships
get_entity_relationships({entity_id: "found_entity"})

// 4. Take action
HassTurnOn({entity_id: "found_entity"})
```

### Health Monitoring Pattern
```javascript
// 1. Find issues
get_device_health({show_healthy: false, stale_threshold_hours: 24})

// 2. Investigate context
get_entity_relationships({entity_id: "problematic_entity"})

// 3. Check area
get_device_health({area: "area_name", show_healthy: true})
```

### Automation Planning Pattern
```javascript
// 1. View topology
get_home_topology({include_entities: true, area_filter: "bedroom"})

// 2. List devices
explore_entities({area: "bedroom", group_by: "domain"})

// 3. Check dependencies
get_entity_relationships({entity_id: "key_device"})

// 4. Verify health
get_device_health({area: "bedroom", show_healthy: true})
```

---

## Tool-Specific Guidance

### `explore_entities`
**When to use:** User wants to browse/filter entities by type, location, or state.

**Key parameters:**
- `domain` - Type filter (light, sensor, switch, etc.)
- `area` - Location filter
- `device_class` - Subtype (motion, temperature, humidity, etc.)
- `state` - Current state (on, off, unavailable)
- `group_by` - Organize results (domain, area, device, device_class, state)
- `limit` - Max results (default 50, max 500)

**Tips:**
- Group by area for location-based tasks
- Group by domain for device-type tasks
- Use `include_unavailable: false` to hide offline devices
- Set appropriate `limit` to avoid overwhelming results

---

### `search_entities_fuzzy`
**When to use:** User provides partial name, has typos, or needs "did you mean?" suggestions.

**Key parameters:**
- `query` - Search text (handles typos with 1-2 char tolerance)
- `domain_hint` - Boost specific domain (+150 score)
- `area_hint` - Boost specific area (+150 score)
- `limit` - Max results (default 10, max 50)

**Scoring:** 1000=exact, 500=starts with, 250=contains, high≥500, med 100-499, low<100

**Tips:**
- Always provide hints when context available
- Results are relevance-scored automatically
- Check suggestions if results are sparse

---

### `get_entity_relationships`
**When to use:** User wants to understand entity connections, dependencies, or impact of changes.

**Returns:**
- Device info (manufacturer, model, sw_version)
- Area assignment
- Related entities on same device
- Automations/scenes/scripts that reference it

**Tips:**
- Use before removing/modifying devices
- Check `automations_referencing` for dependencies
- Review `related_entities` for cleanup opportunities

---

### `get_home_topology`
**When to use:** User wants to see home structure, device organization, or coverage.

**Key parameters:**
- `include_entities` - Full detail (false for overview)
- `area_filter` - Specific areas (comma-separated)

**Tips:**
- Start with `include_entities: false` for overview
- Use `area_filter` to focus on specific areas
- Check `unassigned_devices` for orphaned items

---

### `get_device_health`
**When to use:** User wants to find offline/stale devices or check system health.

**Key parameters:**
- `entity_id` / `area` / `domain` - Scope
- `show_healthy` - Include working devices (default false)
- `stale_threshold_hours` - Freshness requirement (default 24)

**Tips:**
- Adjust `stale_threshold_hours` by device type (sensors: 6h, switches: 24h)
- Use `area` for location-specific checks
- Use `domain` for device-type checks
- Set `show_healthy: true` for comprehensive reports

---

### Control Tools (`HassTurn*`, `HassLightSet`, etc.)
**Entity resolution priority:**
1. Try `name` parameter first
2. Add `area` context if ambiguous
3. Add `floor` if still ambiguous
4. Use `entity_id` if known

**Parameters:**
- All support: `name`, `area`, `floor`, `entity_id`
- `HassLightSet`: + `brightness` (0-100), `color`, `temperature`
- `HassFanSetSpeed`: + `percentage` (0-100)
- `HassClimateSetTemperature`: + `temperature` (number)
- `HassMediaSearchAndPlay`: + `search_query`, `media_class`

**Tips:**
- Start with friendly names for natural interaction
- Use area context for disambiguation
- Fall back to `search_entities_fuzzy` if resolution fails

---

### `get_history` & `get_entity_baseline`
**When to use:** User needs historical data, patterns, or anomaly detection.

**`get_history` returns:**
- Total samples, transitions, distinct values
- First/last states with timestamps
- State duration percentages
- Numeric stats (min, max, avg, stddev)

**`get_entity_baseline` returns:**
- Recent vs baseline comparison
- Numeric deltas and percentage changes
- Transition rate analysis
- Automation insights and recommendations

**Tips:**
- Use `hours` for simple queries: `{hours: 24}`
- Use `start`/`end` for specific windows
- Chain with `get_states` for current context
- Use baseline for adaptive automation thresholds

---

## Error Handling

### Entity Resolution Failures
```javascript
// 1. Try fuzzy search
search_entities_fuzzy({query: "user's description", domain_hint: "guess"})

// 2. If that fails, debug
admin_debug({search: "user's description", type: "entities"})

// 3. Suggest corrections or alternatives
```

### Service Call Failures
```javascript
// 1. Verify entity type
get_entity_relationships({entity_id: "entity"})

// 2. Check entity supports service
// 3. Verify entity state
get_states({entity_id: "entity"})
```

### Empty Results
- Suggest broader search criteria
- Check spelling with fuzzy search
- Verify entity exists with `admin_debug`
- Suggest related entities from same area/domain

---

## Performance Considerations

All discovery tools use in-memory cache:
- **No additional API calls** to Home Assistant
- **Fast response times:** 10-50ms typical
- **Auto-refresh:** Cache updates every 60s
- **Persistent:** Saved to disk for fast startup

**Optimization tips:**
- Use `limit` parameter to control response size
- Filter by domain/area instead of searching all
- Use `include_entities: false` for topology overview
- Chain specific queries rather than broad searches

---

## Common Workflows

### "Turn on the lights"
```javascript
HassTurnOn({name: "lights"})
// If fails: search_entities_fuzzy({query: "lights", domain_hint: "light"})
```

### "Show bedroom devices"
```javascript
explore_entities({area: "bedroom", group_by: "domain"})
```

### "Find temperature sensor"
```javascript
search_entities_fuzzy({query: "temp", domain_hint: "sensor", area_hint: "office"})
```

### "Which devices offline?"
```javascript
get_device_health({show_healthy: false})
```

### "What uses this light?"
```javascript
get_entity_relationships({name: "light name"})
```

### "Sensors not updating?"
```javascript
get_device_health({domain: "sensor", stale_threshold_hours: 6})
```

### "Show home structure"
```javascript
get_home_topology({include_entities: false})
```

---

## Best Practices

### Entity Resolution
1. Start with friendly names
2. Add area/floor context if needed
3. Use fuzzy search for uncertain names
4. Fall back to admin_debug for discovery

### Discovery
1. Use explore_entities for browsing
2. Use search_entities_fuzzy for finding
3. Use get_entity_relationships for understanding
4. Use get_home_topology for visualization

### Control
1. Confirm entity exists before controlling
2. Check entity type supports desired action
3. Verify state after control commands
4. Handle resolution failures gracefully

### Monitoring
1. Regular health checks (weekly)
2. Appropriate staleness thresholds
3. Area-specific for critical zones
4. Chain with relationships for context

---

## Response Formatting

### Success
- Confirm action taken
- Include resolved entity_id
- Mention current state if relevant
- Suggest related actions

### Errors
- Explain what went wrong clearly
- Suggest correction steps
- Offer alternatives when available
- Use fuzzy search for suggestions

### Discovery
- Summarize total count
- Highlight key findings
- Group logically
- Suggest next actions

---

## Security & Privacy

- All processing in-memory
- No external API calls (except Home Assistant)
- Uses existing Home Assistant authentication
- Respects Home Assistant permissions
- Entity cache includes only accessible entities

---

## Version Information

**Current Version:** 1.1.0  
**Entity Index:** 1,600+ entities, 3,200+ name mappings  
**Tool Count:** 20 (5 discovery, 9 control, 6 monitoring)  
**Performance:** <100ms typical, 0 additional API calls  
**Compatibility:** Home Assistant 2023.1+, Node.js 16+

---

## Additional Resources

For complete documentation with examples, troubleshooting, and detailed parameter descriptions, refer to **USER_GUIDE.md**.

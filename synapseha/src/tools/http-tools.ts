/**
 * HTTP-compatible tool definitions for the SynapseHA MCP server.
 * These are adapted from the original tools to work with McpServer.registerTool()
 */
import { z } from 'zod';
import { HomeAssistantClient } from '../lib/ha-client.js';
import { CacheManager } from '../lib/cache.js';
import { FuzzySearcher } from '../lib/fuzzy-search.js';
import { NameResolver } from '../lib/name-resolver.js';

// Tool definition interface for McpServer
interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, any>;
}

// Tool handler type
type ToolHandler = (args: any, extra?: any) => Promise<{ content: Array<{ type: 'text'; text: string }> }>;

export const toolDefinitions: ToolDefinition[] = [
  // Entity Discovery Tools
  {
    name: 'list_entities',
    description: 'List all entities or filter by domain (e.g., light, switch, climate). Returns entity IDs with current states.',
    inputSchema: {
      domain: z.string().optional().describe('Filter by domain (e.g., light, switch, climate, sensor)'),
      limit: z.number().optional().describe('Maximum number of entities to return (default: 100)'),
    },
  },
  {
    name: 'search_entities',
    description: 'Search entities by name using fuzzy matching. Handles typos and partial matches.',
    inputSchema: {
      query: z.string().describe('Search query (entity name or ID)'),
      limit: z.number().optional().describe('Maximum results to return (default: 10)'),
    },
  },
  {
    name: 'get_entity_state',
    description: 'Get detailed state and attributes for a specific entity. Use entity_id or search by name.',
    inputSchema: {
      entity_id: z.string().describe('Entity ID (e.g., light.living_room) or friendly name'),
    },
  },
  // Light Control
  {
    name: 'control_light',
    description: 'Control lights: turn on/off, set brightness (0-255), color, temperature.',
    inputSchema: {
      entity_id: z.string().optional().describe('Light entity ID (e.g., light.living_room)'),
      name: z.string().optional().describe('Friendly name of the light'),
      area: z.string().optional().describe('Area/room name for entity resolution'),
      floor: z.string().optional().describe('Floor name for disambiguation'),
      action: z.enum(['turn_on', 'turn_off', 'toggle']).describe('Action to perform'),
      brightness: z.number().optional().describe('Brightness (0-255)'),
      rgb_color: z.array(z.number()).optional().describe('RGB color [R, G, B] (0-255)'),
      color_temp: z.number().optional().describe('Color temperature in mireds'),
    },
  },
  // Climate Control
  {
    name: 'control_climate',
    description: 'Control climate devices: set temperature, mode (heat/cool/auto), fan mode.',
    inputSchema: {
      entity_id: z.string().optional().describe('Climate entity ID'),
      name: z.string().optional().describe('Friendly name of the climate device'),
      area: z.string().optional().describe('Area/room name'),
      floor: z.string().optional().describe('Floor name'),
      temperature: z.number().optional().describe('Target temperature'),
      hvac_mode: z.enum(['off', 'heat', 'cool', 'heat_cool', 'auto', 'dry', 'fan_only']).optional().describe('HVAC mode'),
      fan_mode: z.string().optional().describe('Fan mode (auto, low, medium, high)'),
    },
  },
  // Media Control
  {
    name: 'control_media_player',
    description: 'Control media players: play, pause, stop, volume, source selection.',
    inputSchema: {
      entity_id: z.string().describe('Media player entity ID or name'),
      action: z.enum(['play', 'pause', 'stop', 'next_track', 'previous_track', 'volume_up', 'volume_down', 'volume_mute']).describe('Media control action'),
      volume_level: z.number().optional().describe('Volume level (0.0-1.0)'),
      source: z.string().optional().describe('Source to select'),
    },
  },
  // Fan Control
  {
    name: 'control_fan',
    description: 'Control fans: turn on/off, set speed percentage, direction.',
    inputSchema: {
      entity_id: z.string().describe('Fan entity ID or name'),
      action: z.enum(['turn_on', 'turn_off', 'toggle']).describe('Action to perform'),
      percentage: z.number().optional().describe('Speed percentage (0-100)'),
      direction: z.enum(['forward', 'reverse']).optional().describe('Fan direction'),
    },
  },
  // Switch Control
  {
    name: 'control_switch',
    description: 'Control switches and smart plugs: turn on/off/toggle.',
    inputSchema: {
      entity_id: z.string().describe('Switch entity ID or name'),
      action: z.enum(['turn_on', 'turn_off', 'toggle']).describe('Action to perform'),
    },
  },
  // Generic Service Call
  {
    name: 'call_service',
    description: 'Call any Home Assistant service with custom parameters.',
    inputSchema: {
      domain: z.string().describe('Service domain (e.g., light, switch)'),
      service: z.string().describe('Service name (e.g., turn_on)'),
      entity_id: z.string().optional().describe('Target entity ID'),
      data: z.record(z.string(), z.any()).optional().describe('Service data/parameters'),
    },
  },
  // Topology & Discovery
  {
    name: 'get_areas',
    description: 'List all areas (rooms) in Home Assistant.',
    inputSchema: {},
  },
  {
    name: 'get_devices',
    description: 'List all devices registered in Home Assistant.',
    inputSchema: {
      area_id: z.string().optional().describe('Filter by area ID'),
    },
  },
  {
    name: 'get_entity_relationships',
    description: 'Get relationships between entities, devices, and areas.',
    inputSchema: {
      entity_id: z.string().describe('Entity ID to get relationships for'),
    },
  },
  {
    name: 'get_device_health',
    description: 'Check health status of devices (unavailable entities, battery levels).',
    inputSchema: {},
  },
  // Analytics
  {
    name: 'get_live_context',
    description: 'Get current context: active entities, recent changes, system state.',
    inputSchema: {
      minutes: z.number().optional().describe('Look back period in minutes (default: 15)'),
    },
  },
  {
    name: 'get_history',
    description: 'Get historical data for entities over a time period.',
    inputSchema: {
      entity_ids: z.array(z.string()).describe('Entity IDs to get history for'),
      hours: z.number().optional().describe('Hours of history to retrieve (default: 24)'),
    },
  },
  {
    name: 'calculate_baseline',
    description: 'Calculate baseline statistics for entities (avg, min, max over time).',
    inputSchema: {
      entity_ids: z.array(z.string()).describe('Sensor entity IDs to analyze'),
      hours: z.number().optional().describe('Hours of data to analyze (default: 168 = 1 week)'),
    },
  },
  {
    name: 'detect_anomalies',
    description: 'Detect anomalies in entity states (unusual values, stuck sensors).',
    inputSchema: {
      domain: z.string().optional().describe('Domain to check (sensor, binary_sensor)'),
    },
  },
  // Scenes & Automation
  {
    name: 'activate_scene',
    description: 'Activate a Home Assistant scene.',
    inputSchema: {
      entity_id: z.string().describe('Scene entity ID or name'),
    },
  },
  {
    name: 'trigger_automation',
    description: 'Trigger a Home Assistant automation.',
    inputSchema: {
      entity_id: z.string().describe('Automation entity ID or name'),
    },
  },
  // System Info
  {
    name: 'get_system_info',
    description: 'Get Home Assistant system information and configuration.',
    inputSchema: {},
  },
  {
    name: 'list_services',
    description: 'List all available Home Assistant services.',
    inputSchema: {
      domain: z.string().optional().describe('Filter by domain'),
    },
  },
];

export function createToolHandlers(
  haClient: HomeAssistantClient,
  cache: CacheManager,
  search: FuzzySearcher,
  resolver: NameResolver
): Record<string, ToolHandler> {
  const wrapResult = (result: any): { content: Array<{ type: 'text'; text: string }> } => ({
    content: [{ type: 'text', text: typeof result === 'string' ? result : JSON.stringify(result, null, 2) }],
  });

  return {
    list_entities: async (args) => {
      const entities = await cache.getOrFetch('entities', () => haClient.getStates());
      let filtered = args.domain ? search.getEntityByDomain(args.domain, entities) : entities;
      if (args.limit) filtered = filtered.slice(0, args.limit);
      return wrapResult({
        count: filtered.length,
        entities: filtered.map(e => ({
          entity_id: e.entity_id,
          state: e.state,
          friendly_name: e.attributes.friendly_name || e.entity_id,
        })),
      });
    },

    search_entities: async (args) => {
      const results = search.searchEntities(args.query, args.limit || 10);
      return wrapResult({
        count: results.length,
        results: results.map(r => ({
          entity_id: r.item.entity_id,
          state: r.item.state,
          friendly_name: r.item.attributes.friendly_name || r.item.entity_id,
          match_score: (1 - r.score).toFixed(2),
        })),
      });
    },

    get_entity_state: async (args) => {
      let entityId = args.entity_id;
      if (!entityId.includes('.')) {
        const found = search.findEntityByName(entityId);
        if (found) entityId = found.entity_id;
      }
      const entity = await haClient.getState(entityId);
      return wrapResult({
        entity_id: entity.entity_id,
        state: entity.state,
        attributes: entity.attributes,
        last_changed: entity.last_changed,
        last_updated: entity.last_updated,
      });
    },

    control_light: async (args) => {
      if (!args.entity_id && !args.name) {
        throw new Error('Either entity_id or name must be provided');
      }
      const searchParams = {
        entity_id: args.entity_id,
        name: args.name,
        area: args.area,
        floor: args.floor,
        domain: 'light',
      };
      const entityId = resolver.resolveEntityId(searchParams);
      if (!entityId) {
        throw new Error(`Could not resolve light entity`);
      }
      const serviceData: any = {};
      if (args.brightness !== undefined) serviceData.brightness = args.brightness;
      if (args.rgb_color) serviceData.rgb_color = args.rgb_color;
      if (args.color_temp !== undefined) serviceData.color_temp = args.color_temp;
      await haClient.callService('light', args.action, Object.keys(serviceData).length > 0 ? serviceData : undefined, { entity_id: entityId });
      return wrapResult({ success: true, entity_id: entityId, action: args.action });
    },

    control_climate: async (args) => {
      if (!args.entity_id && !args.name) {
        throw new Error('Either entity_id or name must be provided');
      }
      const searchParams = {
        entity_id: args.entity_id,
        name: args.name,
        area: args.area,
        floor: args.floor,
        domain: 'climate',
      };
      const entityId = resolver.resolveEntityId(searchParams);
      if (!entityId) {
        throw new Error(`Could not resolve climate entity`);
      }
      const actions = [];
      if (args.temperature !== undefined) {
        await haClient.callService('climate', 'set_temperature', { temperature: args.temperature }, { entity_id: entityId });
        actions.push(`temperature=${args.temperature}`);
      }
      if (args.hvac_mode) {
        await haClient.callService('climate', 'set_hvac_mode', { hvac_mode: args.hvac_mode }, { entity_id: entityId });
        actions.push(`mode=${args.hvac_mode}`);
      }
      if (args.fan_mode) {
        await haClient.callService('climate', 'set_fan_mode', { fan_mode: args.fan_mode }, { entity_id: entityId });
        actions.push(`fan=${args.fan_mode}`);
      }
      return wrapResult({ success: true, entity_id: entityId, actions });
    },

    control_media_player: async (args) => {
      let entityId = args.entity_id;
      if (!entityId.includes('.')) {
        const found = search.findEntityByName(entityId);
        if (found) entityId = found.entity_id;
      }
      if (args.volume_level !== undefined) {
        await haClient.callService('media_player', 'volume_set', { volume_level: args.volume_level }, { entity_id: entityId });
      }
      if (args.source) {
        await haClient.callService('media_player', 'select_source', { source: args.source }, { entity_id: entityId });
      }
      const serviceMap: Record<string, string> = {
        'play': 'media_play', 'pause': 'media_pause', 'stop': 'media_stop',
        'next_track': 'media_next_track', 'previous_track': 'media_previous_track',
        'volume_up': 'volume_up', 'volume_down': 'volume_down', 'volume_mute': 'volume_mute',
      };
      const serviceName = serviceMap[args.action] || args.action;
      await haClient.callService('media_player', serviceName, undefined, { entity_id: entityId });
      return wrapResult({ success: true, entity_id: entityId, action: args.action });
    },

    control_fan: async (args) => {
      let entityId = args.entity_id;
      if (!entityId.includes('.')) {
        const found = search.findEntityByName(entityId);
        if (found) entityId = found.entity_id;
      }
      const serviceData: any = {};
      if (args.percentage !== undefined) serviceData.percentage = args.percentage;
      await haClient.callService('fan', args.action, Object.keys(serviceData).length > 0 ? serviceData : undefined, { entity_id: entityId });
      if (args.direction) {
        await haClient.callService('fan', 'set_direction', { direction: args.direction }, { entity_id: entityId });
      }
      return wrapResult({ success: true, entity_id: entityId, action: args.action });
    },

    control_switch: async (args) => {
      let entityId = args.entity_id;
      if (!entityId.includes('.')) {
        const found = search.findEntityByName(entityId);
        if (found) entityId = found.entity_id;
      }
      await haClient.callService('switch', args.action, undefined, { entity_id: entityId });
      return wrapResult({ success: true, entity_id: entityId, action: args.action });
    },

    call_service: async (args) => {
      const target = args.entity_id ? { entity_id: args.entity_id } : undefined;
      await haClient.callService(args.domain, args.service, args.data, target);
      return wrapResult({ success: true, service: `${args.domain}.${args.service}` });
    },

    get_areas: async () => {
      const areas = await cache.getOrFetch('areas', () => haClient.getAreas());
      return wrapResult({
        count: areas.length,
        areas: areas.map(a => ({ area_id: a.area_id, name: a.name })),
      });
    },

    get_devices: async (args) => {
      const devices = await cache.getOrFetch('devices', () => haClient.getDevices());
      const filtered = args.area_id ? devices.filter(d => d.area_id === args.area_id) : devices;
      return wrapResult({
        count: filtered.length,
        devices: filtered.map(d => ({
          id: d.id,
          name: d.name_by_user || d.name,
          area_id: d.area_id,
          manufacturer: d.manufacturer,
          model: d.model,
        })),
      });
    },

    get_entity_relationships: async (args) => {
      const entities = await cache.getOrFetch('entities', () => haClient.getStates());
      const devices = await cache.getOrFetch('devices', () => haClient.getDevices());
      const areas = await cache.getOrFetch('areas', () => haClient.getAreas());
      const registry = await haClient.getEntityRegistry();
      const entity = entities.find(e => e.entity_id === args.entity_id);
      if (!entity) throw new Error(`Entity ${args.entity_id} not found`);
      const registryEntry = registry.find((r: any) => r.entity_id === args.entity_id);
      const device = registryEntry ? devices.find(d => d.id === registryEntry.device_id) : null;
      const area = device ? areas.find(a => a.area_id === device.area_id) : null;
      return wrapResult({
        entity: { entity_id: entity.entity_id, state: entity.state, friendly_name: entity.attributes.friendly_name },
        device: device ? { id: device.id, name: device.name_by_user || device.name, manufacturer: device.manufacturer, model: device.model } : null,
        area: area ? { area_id: area.area_id, name: area.name } : null,
      });
    },

    get_device_health: async () => {
      const entities = await cache.getOrFetch('entities', () => haClient.getStates());
      const unavailable = entities.filter(e => e.state === 'unavailable');
      const lowBattery = entities.filter(e => e.attributes.battery_level !== undefined && e.attributes.battery_level < 20);
      return wrapResult({
        summary: { total_entities: entities.length, unavailable_count: unavailable.length, low_battery_count: lowBattery.length },
        unavailable_entities: unavailable.map(e => ({ entity_id: e.entity_id, friendly_name: e.attributes.friendly_name || e.entity_id })),
        low_battery_devices: lowBattery.map(e => ({ entity_id: e.entity_id, friendly_name: e.attributes.friendly_name || e.entity_id, battery_level: e.attributes.battery_level })),
      });
    },

    get_live_context: async (args) => {
      const minutes = args.minutes || 15;
      const entities = await cache.getOrFetch('entities', () => haClient.getStates());
      const cutoff = new Date(Date.now() - minutes * 60 * 1000).toISOString();
      const recentlyChanged = entities.filter(e => e.last_changed > cutoff);
      const activeLights = entities.filter(e => e.entity_id.startsWith('light.') && e.state === 'on');
      const activeMedia = entities.filter(e => e.entity_id.startsWith('media_player.') && ['playing', 'paused'].includes(e.state));
      return wrapResult({
        timestamp: new Date().toISOString(),
        recent_changes: { count: recentlyChanged.length, entities: recentlyChanged.slice(0, 20).map(e => ({ entity_id: e.entity_id, state: e.state, last_changed: e.last_changed })) },
        active_devices: { lights_on: activeLights.length, media_playing: activeMedia.length },
      });
    },

    get_history: async (args) => {
      const hours = args.hours || 24;
      const startTime = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
      const history = await haClient.getHistory(args.entity_ids, startTime);
      return wrapResult({
        period: { start: startTime, end: new Date().toISOString() },
        history: history.map((entityHistory, index) => ({
          entity_id: args.entity_ids[index],
          data_points: entityHistory.length,
          states: entityHistory.slice(0, 100).map(h => ({ state: h.state, timestamp: h.last_changed })),
        })),
      });
    },

    calculate_baseline: async (args) => {
      const hours = args.hours || 168;
      const startTime = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
      const history = await haClient.getHistory(args.entity_ids, startTime);
      const baselines = history.map((entityHistory, index) => {
        const numericValues = entityHistory.map(h => parseFloat(h.state)).filter(v => !isNaN(v));
        if (numericValues.length === 0) return { entity_id: args.entity_ids[index], error: 'No numeric values found' };
        const avg = numericValues.reduce((a, b) => a + b, 0) / numericValues.length;
        const min = Math.min(...numericValues);
        const max = Math.max(...numericValues);
        const sorted = [...numericValues].sort((a, b) => a - b);
        const median = sorted[Math.floor(sorted.length / 2)];
        return { entity_id: args.entity_ids[index], statistics: { count: numericValues.length, average: avg.toFixed(2), median: median.toFixed(2), min: min.toFixed(2), max: max.toFixed(2) } };
      });
      return wrapResult({ period_hours: hours, baselines });
    },

    detect_anomalies: async (args) => {
      const entities = await cache.getOrFetch('entities', () => haClient.getStates());
      const domain = args.domain || 'sensor';
      const sensors = entities.filter(e => e.entity_id.startsWith(`${domain}.`));
      const anomalies = [];
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      for (const sensor of sensors) {
        if (sensor.last_updated < oneHourAgo && sensor.state !== 'unavailable') {
          anomalies.push({ entity_id: sensor.entity_id, type: 'stuck_sensor', description: 'No updates in over 1 hour', severity: 'medium', last_updated: sensor.last_updated });
        }
        if (sensor.state === 'unavailable' || sensor.state === 'unknown') {
          anomalies.push({ entity_id: sensor.entity_id, type: 'unavailable', description: `State is ${sensor.state}`, severity: 'high', state: sensor.state });
        }
      }
      return wrapResult({ detected_at: new Date().toISOString(), anomaly_count: anomalies.length, anomalies: anomalies.slice(0, 50) });
    },

    activate_scene: async (args) => {
      let entityId = args.entity_id;
      if (!entityId.includes('.')) {
        const found = search.findEntityByName(entityId);
        if (found) entityId = found.entity_id;
      }
      await haClient.callService('scene', 'turn_on', undefined, { entity_id: entityId });
      return wrapResult({ success: true, scene: entityId });
    },

    trigger_automation: async (args) => {
      let entityId = args.entity_id;
      if (!entityId.includes('.')) {
        const found = search.findEntityByName(entityId);
        if (found) entityId = found.entity_id;
      }
      await haClient.callService('automation', 'trigger', undefined, { entity_id: entityId });
      return wrapResult({ success: true, automation: entityId });
    },

    get_system_info: async () => {
      const config = await haClient.getConfig();
      const entities = await cache.getOrFetch('entities', () => haClient.getStates());
      return wrapResult({
        version: config.version,
        location: { latitude: config.latitude, longitude: config.longitude, timezone: config.time_zone },
        unit_system: config.unit_system,
        entity_count: entities.length,
        domains: [...new Set(entities.map(e => e.entity_id.split('.')[0]))],
      });
    },

    list_services: async (args) => {
      const services = await haClient.getServices();
      if (args.domain) {
        const domainServices = services.find(s => s.domain === args.domain);
        return wrapResult(domainServices ? {
          domain: args.domain,
          services: Object.entries(domainServices.services).map(([name, def]) => ({ name, description: (def as any).description })),
        } : { error: `Domain ${args.domain} not found` });
      }
      return wrapResult({ domains: services.map(s => ({ domain: s.domain, service_count: Object.keys(s.services).length })) });
    },
  };
}

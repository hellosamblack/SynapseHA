import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { HomeAssistantClient } from '../lib/ha-client.js';
import { CacheManager } from '../lib/cache.js';
import { FuzzySearcher } from '../lib/fuzzy-search.js';
import { NameResolver } from '../lib/name-resolver.js';
import type { Entity } from '../types/index.js';

interface ToolHandler {
  definition: Tool;
  handler: (args: any) => Promise<any>;
}

export function registerTools(
  haClient: HomeAssistantClient,
  cache: CacheManager,
  search: FuzzySearcher,
  resolver: NameResolver
): ToolHandler[] {
  return [
    // ===== ENTITY DISCOVERY TOOLS =====
    {
      definition: {
        name: 'list_entities',
        description: 'List all entities or filter by domain (e.g., light, switch, climate). Returns entity IDs with current states.',
        inputSchema: {
          type: 'object',
          properties: {
            domain: {
              type: 'string',
              description: 'Filter by domain (e.g., light, switch, climate, sensor)',
            },
            limit: {
              type: 'number',
              description: 'Maximum number of entities to return (default: 100)',
            },
          },
        },
      },
      handler: async (args) => {
        const entities = await cache.getOrFetch('entities', () => haClient.getStates());
        let filtered = args.domain ? search.getEntityByDomain(args.domain, entities) : entities;
        
        if (args.limit) {
          filtered = filtered.slice(0, args.limit);
        }

        return {
          count: filtered.length,
          entities: filtered.map(e => ({
            entity_id: e.entity_id,
            state: e.state,
            friendly_name: e.attributes.friendly_name || e.entity_id,
          })),
        };
      },
    },

    {
      definition: {
        name: 'search_entities',
        description: 'Search entities by name using fuzzy matching. Handles typos and partial matches.',
        inputSchema: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'Search query (entity name or ID)',
            },
            limit: {
              type: 'number',
              description: 'Maximum results to return (default: 10)',
            },
          },
          required: ['query'],
        },
      },
      handler: async (args) => {
        const results = search.searchEntities(args.query, args.limit || 10);
        return {
          count: results.length,
          results: results.map(r => ({
            entity_id: r.item.entity_id,
            state: r.item.state,
            friendly_name: r.item.attributes.friendly_name || r.item.entity_id,
            match_score: (1 - r.score).toFixed(2),
          })),
        };
      },
    },

    {
      definition: {
        name: 'get_entity_state',
        description: 'Get detailed state and attributes for a specific entity. Use entity_id or search by name.',
        inputSchema: {
          type: 'object',
          properties: {
            entity_id: {
              type: 'string',
              description: 'Entity ID (e.g., light.living_room) or friendly name',
            },
          },
          required: ['entity_id'],
        },
      },
      handler: async (args) => {
        let entityId = args.entity_id;
        
        // Try fuzzy search if not exact entity_id format
        if (!entityId.includes('.')) {
          const found = search.findEntityByName(entityId);
          if (found) {
            entityId = found.entity_id;
          }
        }

        const entity = await haClient.getState(entityId);
        return {
          entity_id: entity.entity_id,
          state: entity.state,
          attributes: entity.attributes,
          last_changed: entity.last_changed,
          last_updated: entity.last_updated,
        };
      },
    },

    // ===== LIGHT CONTROL TOOLS =====
    {
      definition: {
        name: 'control_light',
        description: 'Control lights: turn on/off, set brightness (0-255), color, temperature. Use name and area for flexible entity resolution.',
        inputSchema: {
          type: 'object',
          properties: {
            entity_id: {
              type: 'string',
              description: 'Light entity ID (e.g., light.living_room)',
            },
            name: {
              type: 'string',
              description: 'Friendly name of the light (alternative to entity_id)',
            },
            area: {
              type: 'string',
              description: 'Area/room name for entity resolution',
            },
            floor: {
              type: 'string',
              description: 'Floor name for disambiguation',
            },
            action: {
              type: 'string',
              enum: ['turn_on', 'turn_off', 'toggle'],
              description: 'Action to perform',
            },
            brightness: {
              type: 'number',
              description: 'Brightness (0-255)',
            },
            rgb_color: {
              type: 'array',
              description: 'RGB color [R, G, B] (0-255)',
              items: { type: 'number' },
            },
            color_temp: {
              type: 'number',
              description: 'Color temperature in mireds',
            },
          },
          required: ['action'],
        },
      },
      handler: async (args) => {
        const entityId = resolver.resolveEntityId({
          entity_id: args.entity_id,
          name: args.name,
          area: args.area,
          floor: args.floor,
          domain: 'light',
        });

        if (!entityId) {
          throw new Error('Could not resolve light entity. Try using entity_id or check name/area spelling.');
        }

        const serviceData: any = {};
        if (args.brightness !== undefined) serviceData.brightness = args.brightness;
        if (args.rgb_color) serviceData.rgb_color = args.rgb_color;
        if (args.color_temp !== undefined) serviceData.color_temp = args.color_temp;

        await haClient.callService(
          'light',
          args.action,
          Object.keys(serviceData).length > 0 ? serviceData : undefined,
          { entity_id: entityId }
        );

        return { success: true, entity_id: entityId, action: args.action };
      },
    },

    // ===== CLIMATE CONTROL TOOLS =====
    {
      definition: {
        name: 'control_climate',
        description: 'Control climate devices: set temperature, mode (heat/cool/auto), fan mode. Use name and area for flexible entity resolution.',
        inputSchema: {
          type: 'object',
          properties: {
            entity_id: {
              type: 'string',
              description: 'Climate entity ID',
            },
            name: {
              type: 'string',
              description: 'Friendly name of the climate device',
            },
            area: {
              type: 'string',
              description: 'Area/room name for entity resolution',
            },
            floor: {
              type: 'string',
              description: 'Floor name for disambiguation',
            },
            temperature: {
              type: 'number',
              description: 'Target temperature',
            },
            hvac_mode: {
              type: 'string',
              enum: ['off', 'heat', 'cool', 'heat_cool', 'auto', 'dry', 'fan_only'],
              description: 'HVAC mode',
            },
            fan_mode: {
              type: 'string',
              description: 'Fan mode (auto, low, medium, high)',
            },
          },
        },
      },
      handler: async (args) => {
        const entityId = resolver.resolveEntityId({
          entity_id: args.entity_id,
          name: args.name,
          area: args.area,
          floor: args.floor,
          domain: 'climate',
        });

        if (!entityId) {
          throw new Error('Could not resolve climate entity. Try using entity_id or check name/area spelling.');
        }

        const actions = [];
        
        if (args.temperature !== undefined) {
          await haClient.callService('climate', 'set_temperature', 
            { temperature: args.temperature }, 
            { entity_id: entityId }
          );
          actions.push(`temperature=${args.temperature}`);
        }
        
        if (args.hvac_mode) {
          await haClient.callService('climate', 'set_hvac_mode',
            { hvac_mode: args.hvac_mode }, 
            { entity_id: entityId }
          );
          actions.push(`mode=${args.hvac_mode}`);
        }
        
        if (args.fan_mode) {
          await haClient.callService('climate', 'set_fan_mode', 
            { fan_mode: args.fan_mode }, 
            { entity_id: entityId }
          );
          actions.push(`fan=${args.fan_mode}`);
        }

        return { success: true, entity_id: entityId, actions };
      },
    },

    // ===== MEDIA CONTROL TOOLS =====
    {
      definition: {
        name: 'control_media_player',
        description: 'Control media players: play, pause, stop, volume, source selection.',
        inputSchema: {
          type: 'object',
          properties: {
            entity_id: {
              type: 'string',
              description: 'Media player entity ID or name',
            },
            action: {
              type: 'string',
              enum: ['play', 'pause', 'stop', 'next_track', 'previous_track', 'volume_up', 'volume_down', 'volume_mute'],
              description: 'Media control action',
            },
            volume_level: {
              type: 'number',
              description: 'Volume level (0.0-1.0)',
            },
            source: {
              type: 'string',
              description: 'Source to select',
            },
          },
          required: ['entity_id', 'action'],
        },
      },
      handler: async (args) => {
        let entityId = args.entity_id;
        if (!entityId.includes('.')) {
          const found = search.findEntityByName(entityId);
          if (found) entityId = found.entity_id;
        }

        if (args.volume_level !== undefined) {
          await haClient.callService('media_player', 'volume_set', 
            { volume_level: args.volume_level }, 
            { entity_id: entityId }
          );
        }

        if (args.source) {
          await haClient.callService('media_player', 'select_source', 
            { source: args.source }, 
            { entity_id: entityId }
          );
        }

        // Map actions to correct Home Assistant service names
        const serviceMap: Record<string, string> = {
          'play': 'media_play',
          'pause': 'media_pause',
          'stop': 'media_stop',
          'next_track': 'media_next_track',
          'previous_track': 'media_previous_track',
          'volume_up': 'volume_up',
          'volume_down': 'volume_down',
          'volume_mute': 'volume_mute',
        };

        const serviceName = serviceMap[args.action] || args.action;
        await haClient.callService('media_player', serviceName, 
          undefined, 
          { entity_id: entityId }
        );

        return { success: true, entity_id: entityId, action: args.action };
      },
    },

    // ===== FAN CONTROL TOOLS =====
    {
      definition: {
        name: 'control_fan',
        description: 'Control fans: turn on/off, set speed percentage, direction.',
        inputSchema: {
          type: 'object',
          properties: {
            entity_id: {
              type: 'string',
              description: 'Fan entity ID or name',
            },
            action: {
              type: 'string',
              enum: ['turn_on', 'turn_off', 'toggle'],
              description: 'Action to perform',
            },
            percentage: {
              type: 'number',
              description: 'Speed percentage (0-100)',
            },
            direction: {
              type: 'string',
              enum: ['forward', 'reverse'],
              description: 'Fan direction',
            },
          },
          required: ['entity_id', 'action'],
        },
      },
      handler: async (args) => {
        let entityId = args.entity_id;
        if (!entityId.includes('.')) {
          const found = search.findEntityByName(entityId);
          if (found) entityId = found.entity_id;
        }

        const serviceData: any = {};
        if (args.percentage !== undefined) serviceData.percentage = args.percentage;

        await haClient.callService('fan', args.action, 
          Object.keys(serviceData).length > 0 ? serviceData : undefined,
          { entity_id: entityId }
        );

        if (args.direction) {
          await haClient.callService('fan', 'set_direction', 
            { direction: args.direction }, 
            { entity_id: entityId }
          );
        }

        return { success: true, entity_id: entityId, action: args.action };
      },
    },

    // ===== SWITCH CONTROL TOOLS =====
    {
      definition: {
        name: 'control_switch',
        description: 'Control switches and smart plugs: turn on/off/toggle.',
        inputSchema: {
          type: 'object',
          properties: {
            entity_id: {
              type: 'string',
              description: 'Switch entity ID or name',
            },
            action: {
              type: 'string',
              enum: ['turn_on', 'turn_off', 'toggle'],
              description: 'Action to perform',
            },
          },
          required: ['entity_id', 'action'],
        },
      },
      handler: async (args) => {
        let entityId = args.entity_id;
        if (!entityId.includes('.')) {
          const found = search.findEntityByName(entityId);
          if (found) entityId = found.entity_id;
        }

        await haClient.callService('switch', args.action, undefined, { entity_id: entityId });
        return { success: true, entity_id: entityId, action: args.action };
      },
    },

    // ===== GENERIC SERVICE CALL =====
    {
      definition: {
        name: 'call_service',
        description: 'Call any Home Assistant service with custom parameters.',
        inputSchema: {
          type: 'object',
          properties: {
            domain: {
              type: 'string',
              description: 'Service domain (e.g., light, switch)',
            },
            service: {
              type: 'string',
              description: 'Service name (e.g., turn_on)',
            },
            entity_id: {
              type: 'string',
              description: 'Target entity ID (optional)',
            },
            data: {
              type: 'object',
              description: 'Service data/parameters',
            },
          },
          required: ['domain', 'service'],
        },
      },
      handler: async (args) => {
        const target = args.entity_id ? { entity_id: args.entity_id } : undefined;
        await haClient.callService(args.domain, args.service, args.data, target);
        return { success: true, service: `${args.domain}.${args.service}` };
      },
    },

    // ===== TOPOLOGY & DISCOVERY TOOLS =====
    {
      definition: {
        name: 'get_areas',
        description: 'List all areas (rooms) in Home Assistant.',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      handler: async () => {
        const areas = await cache.getOrFetch('areas', () => haClient.getAreas());
        return {
          count: areas.length,
          areas: areas.map(a => ({
            area_id: a.area_id,
            name: a.name,
          })),
        };
      },
    },

    {
      definition: {
        name: 'get_devices',
        description: 'List all devices registered in Home Assistant.',
        inputSchema: {
          type: 'object',
          properties: {
            area_id: {
              type: 'string',
              description: 'Filter by area ID',
            },
          },
        },
      },
      handler: async (args) => {
        const devices = await cache.getOrFetch('devices', () => haClient.getDevices());
        let filtered = args.area_id 
          ? devices.filter(d => d.area_id === args.area_id)
          : devices;

        return {
          count: filtered.length,
          devices: filtered.map(d => ({
            id: d.id,
            name: d.name_by_user || d.name,
            area_id: d.area_id,
            manufacturer: d.manufacturer,
            model: d.model,
          })),
        };
      },
    },

    {
      definition: {
        name: 'get_entity_relationships',
        description: 'Get relationships between entities, devices, and areas.',
        inputSchema: {
          type: 'object',
          properties: {
            entity_id: {
              type: 'string',
              description: 'Entity ID to get relationships for',
            },
          },
          required: ['entity_id'],
        },
      },
      handler: async (args) => {
        const entities = await cache.getOrFetch('entities', () => haClient.getStates());
        const devices = await cache.getOrFetch('devices', () => haClient.getDevices());
        const areas = await cache.getOrFetch('areas', () => haClient.getAreas());
        const registry = await haClient.getEntityRegistry();

        const entity = entities.find(e => e.entity_id === args.entity_id);
        if (!entity) throw new Error(`Entity ${args.entity_id} not found`);

        const registryEntry = registry.find((r: any) => r.entity_id === args.entity_id);
        const device = registryEntry ? devices.find(d => d.id === registryEntry.device_id) : null;
        const area = device ? areas.find(a => a.area_id === device.area_id) : null;

        return {
          entity: {
            entity_id: entity.entity_id,
            state: entity.state,
            friendly_name: entity.attributes.friendly_name,
          },
          device: device ? {
            id: device.id,
            name: device.name_by_user || device.name,
            manufacturer: device.manufacturer,
            model: device.model,
          } : null,
          area: area ? {
            area_id: area.area_id,
            name: area.name,
          } : null,
        };
      },
    },

    {
      definition: {
        name: 'get_device_health',
        description: 'Check health status of devices (unavailable entities, battery levels).',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      handler: async () => {
        const entities = await cache.getOrFetch('entities', () => haClient.getStates());
        
        const unavailable = entities.filter(e => e.state === 'unavailable');
        const lowBattery = entities.filter(e => 
          e.attributes.battery_level !== undefined && 
          e.attributes.battery_level < 20
        );

        return {
          summary: {
            total_entities: entities.length,
            unavailable_count: unavailable.length,
            low_battery_count: lowBattery.length,
          },
          unavailable_entities: unavailable.map(e => ({
            entity_id: e.entity_id,
            friendly_name: e.attributes.friendly_name || e.entity_id,
          })),
          low_battery_devices: lowBattery.map(e => ({
            entity_id: e.entity_id,
            friendly_name: e.attributes.friendly_name || e.entity_id,
            battery_level: e.attributes.battery_level,
          })),
        };
      },
    },

    // ===== ANALYTICS TOOLS =====
    {
      definition: {
        name: 'get_live_context',
        description: 'Get current context: active entities, recent changes, system state.',
        inputSchema: {
          type: 'object',
          properties: {
            minutes: {
              type: 'number',
              description: 'Look back period in minutes (default: 15)',
            },
          },
        },
      },
      handler: async (args) => {
        const minutes = args.minutes || 15;
        const entities = await cache.getOrFetch('entities', () => haClient.getStates());
        const cutoff = new Date(Date.now() - minutes * 60 * 1000).toISOString();

        const recentlyChanged = entities.filter(e => e.last_changed > cutoff);
        const activeLights = entities.filter(e => 
          e.entity_id.startsWith('light.') && e.state === 'on'
        );
        const activeMedia = entities.filter(e => 
          e.entity_id.startsWith('media_player.') && 
          ['playing', 'paused'].includes(e.state)
        );

        return {
          timestamp: new Date().toISOString(),
          recent_changes: {
            count: recentlyChanged.length,
            entities: recentlyChanged.slice(0, 20).map(e => ({
              entity_id: e.entity_id,
              state: e.state,
              last_changed: e.last_changed,
            })),
          },
          active_devices: {
            lights_on: activeLights.length,
            media_playing: activeMedia.length,
          },
        };
      },
    },

    {
      definition: {
        name: 'get_history',
        description: 'Get historical data for entities over a time period.',
        inputSchema: {
          type: 'object',
          properties: {
            entity_ids: {
              type: 'array',
              items: { type: 'string' },
              description: 'Entity IDs to get history for',
            },
            hours: {
              type: 'number',
              description: 'Hours of history to retrieve (default: 24)',
            },
          },
          required: ['entity_ids'],
        },
      },
      handler: async (args) => {
        const hours = args.hours || 24;
        const startTime = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
        
        const history = await haClient.getHistory(args.entity_ids, startTime);
        
        return {
          period: { start: startTime, end: new Date().toISOString() },
          history: history.map((entityHistory, index) => ({
            entity_id: args.entity_ids[index],
            data_points: entityHistory.length,
            states: entityHistory.slice(0, 100).map(h => ({
              state: h.state,
              timestamp: h.last_changed,
            })),
          })),
        };
      },
    },

    {
      definition: {
        name: 'calculate_baseline',
        description: 'Calculate baseline statistics for entities (avg, min, max over time).',
        inputSchema: {
          type: 'object',
          properties: {
            entity_ids: {
              type: 'array',
              items: { type: 'string' },
              description: 'Sensor entity IDs to analyze',
            },
            hours: {
              type: 'number',
              description: 'Hours of data to analyze (default: 168 = 1 week)',
            },
          },
          required: ['entity_ids'],
        },
      },
      handler: async (args) => {
        const hours = args.hours || 168;
        const startTime = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
        
        const history = await haClient.getHistory(args.entity_ids, startTime);
        
        const baselines = history.map((entityHistory, index) => {
          const numericValues = entityHistory
            .map(h => parseFloat(h.state))
            .filter(v => !isNaN(v));

          if (numericValues.length === 0) {
            return {
              entity_id: args.entity_ids[index],
              error: 'No numeric values found',
            };
          }

          const avg = numericValues.reduce((a, b) => a + b, 0) / numericValues.length;
          const min = Math.min(...numericValues);
          const max = Math.max(...numericValues);
          const sorted = [...numericValues].sort((a, b) => a - b);
          const median = sorted[Math.floor(sorted.length / 2)];

          return {
            entity_id: args.entity_ids[index],
            statistics: {
              count: numericValues.length,
              average: avg.toFixed(2),
              median: median.toFixed(2),
              min: min.toFixed(2),
              max: max.toFixed(2),
            },
          };
        });

        return { period_hours: hours, baselines };
      },
    },

    {
      definition: {
        name: 'detect_anomalies',
        description: 'Detect anomalies in entity states (unusual values, stuck sensors).',
        inputSchema: {
          type: 'object',
          properties: {
            domain: {
              type: 'string',
              description: 'Domain to check (sensor, binary_sensor)',
            },
          },
        },
      },
      handler: async (args) => {
        const entities = await cache.getOrFetch('entities', () => haClient.getStates());
        const domain = args.domain || 'sensor';
        const sensors = entities.filter(e => e.entity_id.startsWith(`${domain}.`));

        const anomalies = [];
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

        for (const sensor of sensors) {
          // Check for stuck sensors (no updates in 1 hour)
          if (sensor.last_updated < oneHourAgo && sensor.state !== 'unavailable') {
            anomalies.push({
              entity_id: sensor.entity_id,
              type: 'stuck_sensor',
              description: 'No updates in over 1 hour',
              severity: 'medium',
              last_updated: sensor.last_updated,
            });
          }

          // Check for unavailable entities
          if (sensor.state === 'unavailable' || sensor.state === 'unknown') {
            anomalies.push({
              entity_id: sensor.entity_id,
              type: 'unavailable',
              description: `State is ${sensor.state}`,
              severity: 'high',
              state: sensor.state,
            });
          }
        }

        return {
          detected_at: new Date().toISOString(),
          anomaly_count: anomalies.length,
          anomalies: anomalies.slice(0, 50),
        };
      },
    },

    // ===== SCENES & AUTOMATION =====
    {
      definition: {
        name: 'activate_scene',
        description: 'Activate a Home Assistant scene.',
        inputSchema: {
          type: 'object',
          properties: {
            entity_id: {
              type: 'string',
              description: 'Scene entity ID or name',
            },
          },
          required: ['entity_id'],
        },
      },
      handler: async (args) => {
        let entityId = args.entity_id;
        if (!entityId.includes('.')) {
          const found = search.findEntityByName(entityId);
          if (found) entityId = found.entity_id;
        }

        await haClient.callService('scene', 'turn_on', undefined, { entity_id: entityId });
        return { success: true, scene: entityId };
      },
    },

    {
      definition: {
        name: 'trigger_automation',
        description: 'Trigger a Home Assistant automation.',
        inputSchema: {
          type: 'object',
          properties: {
            entity_id: {
              type: 'string',
              description: 'Automation entity ID or name',
            },
          },
          required: ['entity_id'],
        },
      },
      handler: async (args) => {
        let entityId = args.entity_id;
        if (!entityId.includes('.')) {
          const found = search.findEntityByName(entityId);
          if (found) entityId = found.entity_id;
        }

        await haClient.callService('automation', 'trigger', undefined, { entity_id: entityId });
        return { success: true, automation: entityId };
      },
    },

    // ===== SYSTEM INFO =====
    {
      definition: {
        name: 'get_system_info',
        description: 'Get Home Assistant system information and configuration.',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      handler: async () => {
        const config = await haClient.getConfig();
        const entities = await cache.getOrFetch('entities', () => haClient.getStates());
        
        return {
          version: config.version,
          location: {
            latitude: config.latitude,
            longitude: config.longitude,
            timezone: config.time_zone,
          },
          unit_system: config.unit_system,
          entity_count: entities.length,
          domains: [...new Set(entities.map(e => e.entity_id.split('.')[0]))],
        };
      },
    },

    {
      definition: {
        name: 'list_services',
        description: 'List all available Home Assistant services.',
        inputSchema: {
          type: 'object',
          properties: {
            domain: {
              type: 'string',
              description: 'Filter by domain',
            },
          },
        },
      },
      handler: async (args) => {
        const services = await haClient.getServices();
        
        if (args.domain) {
          const domainServices = services.find(s => s.domain === args.domain);
          return domainServices ? {
            domain: args.domain,
            services: Object.entries(domainServices.services).map(([name, def]) => ({
              name,
              description: def.description,
            })),
          } : { error: `Domain ${args.domain} not found` };
        }

        return {
          domains: services.map(s => ({
            domain: s.domain,
            service_count: Object.keys(s.services).length,
          })),
        };
      },
    },
  ];
}

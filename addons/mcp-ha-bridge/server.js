#!/usr/bin/env node
/** @format */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { encode } from "@toon-format/toon";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, ".env"), quiet: true });

const HASS_URL = process.env.HASS_URL || "http://172.17.2.53:8123";
const HASS_TOKEN = process.env.API_ACCESS_TOKEN || process.env.HASS_TOKEN;

if (!HASS_TOKEN) {
  console.error(
    "HASS_TOKEN or API_ACCESS_TOKEN environment variable is required"
  );
  process.exit(1);
}

class HomeAssistantMCPServer {
  constructor() {
    this.server = new Server(
      {
        name: "home-assistant-llm-bridge",
        version: "1.0.0",
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupToolHandlers();
    this.setupListHandlers();

    // entity index populated at startup
    this.entities = {}; // entity_id -> entity object
    this.nameIndex = {}; // normalized name -> [entity_id,...]

    // metadata caches
    this.areas = {}; // area_id -> area object
    this.devices = {}; // device_id -> device object
    this.automations = {}; // automation entity_id -> automation object
    this.scenes = {}; // scene entity_id -> scene object
    this.scripts = {}; // script entity_id -> script object

    // indexing state
    this.indexReady = false;

    // persistent cache base path
    // we persist structured JSON for fast reload and a `.toon` text file
    // optimized for LLM ingestion alongside it
    this.cacheBase = path.join(__dirname, "entity_index_cache");
    this.jsonCachePath = this.cacheBase + ".json";
    this.toonCachePath = this.cacheBase + ".toon";

    // Try to load cache on startup
    this.loadEntityCache();
  }

  loadEntityCache() {
    try {
      // Prefer structured JSON cache for fast, deterministic reload
      if (fs.existsSync(this.jsonCachePath)) {
        const raw = fs.readFileSync(this.jsonCachePath, "utf8");
        const cache = JSON.parse(raw);
        this.entities = cache.entities || {};
        this.nameIndex = cache.nameIndex || {};
        this.areas = cache.areas || {};
        this.devices = cache.devices || {};
        this.automations = cache.automations || {};
        this.scenes = cache.scenes || {};
        this.scripts = cache.scripts || {};
        this.indexReady = true;
        console.error(
          `Loaded entity index cache from disk (${this.jsonCachePath})`
        );
      } else if (fs.existsSync(this.toonCachePath)) {
        // Found a .toon summary file (LLM-friendly). We keep the JSON cache
        // as the authoritative structured cache; the .toon file is only for
        // model ingestion and will not be used to fully restore runtime state.
        console.error(
          `Found ${this.toonCachePath} (LLM summary). Skipping structured load; use ${this.jsonCachePath} for authoritative cache.`
        );
      }
    } catch (e) {
      console.error("Error loading entity index cache:", e.message);
    }
  }

  saveEntityCache() {
    try {
      const cache = {
        entities: this.entities,
        nameIndex: this.nameIndex,
        areas: this.areas,
        devices: this.devices,
        automations: this.automations,
        scenes: this.scenes,
        scripts: this.scripts,
      };
      // Write structured JSON cache
      try {
        fs.writeFileSync(
          this.jsonCachePath,
          JSON.stringify(cache, null, 2),
          "utf8"
        );
        console.error(
          `Saved entity index cache to disk (${this.jsonCachePath})`
        );
      } catch (e) {
        console.error("Error saving entity index cache (json):", e.message);
      }

      // Also write an LLM-friendly `.toon` representation for ingestion.
      // We construct a compact summary with a whitelist of high-value fields
      // so the TOON encoder can emit a compact tabular representation.
      try {
        const whitelist = [
          "device_class",
          "unit_of_measurement",
          "battery_level",
          "icon",
        ];

        const toonEntities = Object.entries(this.entities).map(([id, ent]) => {
          const friendly = ent.attributes?.friendly_name || "";
          const domain = id.split(".")[0];
          const areaName =
            ent.attributes?.area_id && this.areas[ent.attributes.area_id]
              ? this.areas[ent.attributes.area_id].name
              : "";
          const deviceName =
            ent.device_id && this.devices[ent.device_id]
              ? this.devices[ent.device_id].name_by_user ||
                this.devices[ent.device_id].name ||
                ""
              : "";
          const attrs = ent.attributes || {};
          const attrPairs = Object.entries(attrs)
            .filter(([k]) => whitelist.includes(k))
            .slice(0, 6)
            .map(([k, v]) => `${k}:${String(v)}`);
          const attrSummary = attrPairs.join(";");

          return {
            entity_id: id,
            friendly_name: friendly,
            domain,
            area: areaName,
            device: deviceName,
            state: ent.state,
            attrs: attrSummary,
          };
        });

        const toonCache = {
          meta: {
            entities: Object.keys(this.entities).length,
            areas: Object.keys(this.areas).length,
            devices: Object.keys(this.devices).length,
            automations: Object.keys(this.automations).length,
          },
          entities: toonEntities,
        };

        const toonText = encode(toonCache, {
          indent: 2,
          delimiter: ",",
          lengthMarker: false,
        });
        fs.writeFileSync(this.toonCachePath, toonText, "utf8");
        console.error(`Saved TOON LLM summary to disk (${this.toonCachePath})`);
      } catch (e) {
        console.error("Error saving TOON .toon cache:", e.message);
      }
    } catch (e) {
      console.error("Error saving entity index cache:", e.message);
    }
  }

  normalizeName(name) {
    if (!name) return "";
    return String(name)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "");
  }

  async buildEntityIndex() {
    try {
      console.error("Building entity index...");
      const url = `${HASS_URL}/api/states`;
      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${HASS_TOKEN}`,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        console.error(
          "Failed to fetch states for entity index",
          response.status,
          response.statusText
        );
        return;
      }

      const data = await response.json();
      console.error(`Fetched ${data.length} entities`);

      this.entities = {};
      this.nameIndex = {};
      this.automations = {};
      this.scenes = {};
      this.scripts = {};

      for (const ent of data) {
        const id = ent.entity_id;
        this.entities[id] = {
          ...ent,
          snapshot: {
            state: ent.state,
            attributes: ent.attributes,
            last_changed: ent.last_changed,
            last_updated: ent.last_updated,
          },
        };

        // categorize special entities
        if (id.startsWith("automation.")) this.automations[id] = ent;
        if (id.startsWith("scene.")) this.scenes[id] = ent;
        if (id.startsWith("script.")) this.scripts[id] = ent;

        const friendly =
          (ent.attributes && ent.attributes.friendly_name) ||
          id.split(".").slice(1).join(" ");
        const normalized = this.normalizeName(friendly);
        if (!this.nameIndex[normalized]) this.nameIndex[normalized] = [];
        this.nameIndex[normalized].push(id);

        // also index by entity_id normalized
        const idNorm = this.normalizeName(id.replace(".", " "));
        if (!this.nameIndex[idNorm]) this.nameIndex[idNorm] = [];
        this.nameIndex[idNorm].push(id);
      }

      console.error(
        `Entity index built: ${Object.keys(this.entities).length} entities, ${
          Object.keys(this.nameIndex).length
        } name mappings`
      );
      this.indexReady = true;

      // fetch additional metadata (skip if endpoints not available)
      try {
        await this.fetchAreas();
      } catch (e) {
        console.error("Areas endpoint not available");
      }

      try {
        await this.fetchDevices();
      } catch (e) {
        console.error("Devices endpoint not available");
      }

      // Save cache to disk
      this.saveEntityCache();
    } catch (err) {
      console.error("Error building entity index:", err.message || err);
    }
  }

  async fetchAreas() {
    try {
      const response = await fetch(`${HASS_URL}/api/config/area_registry`, {
        headers: { Authorization: `Bearer ${HASS_TOKEN}` },
      });
      if (response.ok) {
        const areas = await response.json();
        this.areas = {};
        for (const area of areas) {
          this.areas[area.area_id] = area;
        }
      }
    } catch (err) {
      console.error("Error fetching areas:", err.message);
    }
  }

  async fetchDevices() {
    try {
      const response = await fetch(`${HASS_URL}/api/config/device_registry`, {
        headers: { Authorization: `Bearer ${HASS_TOKEN}` },
      });
      if (response.ok) {
        const devices = await response.json();
        this.devices = {};
        for (const device of devices) {
          this.devices[device.id] = device;
        }
      }
    } catch (err) {
      console.error("Error fetching devices:", err.message);
    }
  }

  setupListHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: "GetLiveContext",
            description:
              "Provides real-time information about the CURRENT state, value, or mode of devices, sensors, entities, or areas",
            inputSchema: {
              type: "object",
              properties: {},
            },
          },
          {
            name: "HassCancelAllTimers",
            description: "Cancels all timers",
            inputSchema: {
              type: "object",
              properties: {
                area: { type: "string" },
              },
            },
          },
          {
            name: "HassClimateSetTemperature",
            description:
              "Sets the target temperature of a climate device or entity",
            inputSchema: {
              type: "object",
              properties: {
                area: { type: "string" },
                floor: { type: "string" },
                name: { type: "string" },
                temperature: { type: "number" },
              },
            },
          },
          {
            name: "HassFanSetSpeed",
            description: "Sets a fan's speed by percentage",
            inputSchema: {
              type: "object",
              properties: {
                area: { type: "string" },
                floor: { type: "string" },
                name: { type: "string" },
                percentage: { type: "integer", minimum: 0, maximum: 100 },
              },
            },
          },
          {
            name: "HassLightSet",
            description: "Sets the brightness percentage or color of a light",
            inputSchema: {
              type: "object",
              properties: {
                area: { type: "string" },
                floor: { type: "string" },
                name: { type: "string" },
                brightness: { type: "integer", minimum: 0, maximum: 100 },
                color: { type: "string" },
                temperature: { type: "integer", minimum: 0 },
              },
            },
          },
          {
            name: "HassMediaNext",
            description: "Skips a media player to the next item",
            inputSchema: {
              type: "object",
              properties: {
                area: { type: "string" },
                floor: { type: "string" },
                name: { type: "string" },
              },
            },
          },
          {
            name: "HassMediaPause",
            description: "Pauses a media player",
            inputSchema: {
              type: "object",
              properties: {
                area: { type: "string" },
                floor: { type: "string" },
                name: { type: "string" },
              },
            },
          },
          {
            name: "HassMediaPrevious",
            description: "Replays the previous item for a media player",
            inputSchema: {
              type: "object",
              properties: {
                area: { type: "string" },
                floor: { type: "string" },
                name: { type: "string" },
              },
            },
          },
          {
            name: "HassMediaSearchAndPlay",
            description: "Searches for media and plays the first result",
            inputSchema: {
              type: "object",
              properties: {
                area: { type: "string" },
                floor: { type: "string" },
                name: { type: "string" },
                search_query: { type: "string" },
                media_class: {
                  type: "string",
                  enum: [
                    "album",
                    "app",
                    "artist",
                    "channel",
                    "composer",
                    "contributing_artist",
                    "directory",
                    "episode",
                    "game",
                    "genre",
                    "image",
                    "movie",
                    "music",
                    "playlist",
                    "podcast",
                    "season",
                    "track",
                    "tv_show",
                    "url",
                    "video",
                  ],
                },
              },
            },
          },
          {
            name: "HassMediaUnpause",
            description: "Resumes a media player",
            inputSchema: {
              type: "object",
              properties: {
                area: { type: "string" },
                floor: { type: "string" },
                name: { type: "string" },
              },
            },
          },
          {
            name: "HassSetVolume",
            description: "Sets the volume percentage of a media player",
            inputSchema: {
              type: "object",
              properties: {
                area: { type: "string" },
                floor: { type: "string" },
                name: { type: "string" },
                volume_level: { type: "integer", minimum: 0, maximum: 100 },
              },
            },
          },
          {
            name: "HassSetVolumeRelative",
            description: "Increases or decreases the volume of a media player",
            inputSchema: {
              type: "object",
              properties: {
                area: { type: "string" },
                floor: { type: "string" },
                name: { type: "string" },
                volume_step: {
                  anyOf: [
                    { type: "string", enum: ["up", "down"] },
                    { type: "integer", minimum: -100, maximum: 100 },
                  ],
                },
              },
            },
          },
          {
            name: "HassTurnOff",
            description:
              "Turns off/closes a device or entity. For locks, this performs an 'unlock' action",
            inputSchema: {
              type: "object",
              properties: {
                area: { type: "string" },
                floor: { type: "string" },
                name: { type: "string" },
              },
            },
          },
          {
            name: "HassTurnOn",
            description:
              "Turns on/opens/presses a device or entity. For locks, this performs a 'lock' action",
            inputSchema: {
              type: "object",
              properties: {
                area: { type: "string" },
                floor: { type: "string" },
                name: { type: "string" },
              },
            },
          },
          {
            name: "get_states",
            description: "Get the current state of Home Assistant entities",
            inputSchema: {
              type: "object",
              properties: {
                entity_id: {
                  type: "string",
                  description: "Optional entity ID to filter by",
                },
              },
            },
          },
          {
            name: "call_service",
            description: "Call a Home Assistant service",
            inputSchema: {
              type: "object",
              properties: {
                domain: {
                  type: "string",
                  description: "The domain of the service",
                },
                service: {
                  type: "string",
                  description: "The service name",
                },
                entity_id: {
                  type: "string",
                  description: "The entity ID to call the service on",
                },
                name: {
                  type: "string",
                  description:
                    "Friendly name of the entity (alternative to entity_id)",
                },
                area: {
                  type: "string",
                  description: "Area name for disambiguation",
                },
                floor: {
                  type: "string",
                  description: "Floor for disambiguation",
                },
                service_data: {
                  type: "object",
                  description: "Additional service data",
                },
              },
              required: ["domain", "service"],
            },
          },
          {
            name: "admin_debug",
            description:
              "Get debug information about entities, areas, devices, and cached metadata",
            inputSchema: {
              type: "object",
              properties: {
                search: {
                  type: "string",
                  description: "Optional search term to filter results",
                },
                type: {
                  type: "string",
                  enum: [
                    "entities",
                    "areas",
                    "devices",
                    "automations",
                    "scenes",
                    "scripts",
                    "all",
                  ],
                  description: "Type of information to return",
                },
              },
            },
          },
          {
            name: "explore_entities",
            description:
              "Interactive entity explorer with advanced filtering, grouping, and relationship mapping. Browse entities by domain, area, device type, or state",
            inputSchema: {
              type: "object",
              properties: {
                domain: {
                  type: "string",
                  description:
                    "Filter by entity domain (e.g., light, sensor, switch)",
                },
                area: {
                  type: "string",
                  description: "Filter by area name",
                },
                device_class: {
                  type: "string",
                  description:
                    "Filter by device class (e.g., temperature, motion, humidity)",
                },
                state: {
                  type: "string",
                  description:
                    "Filter by current state (e.g., on, off, unavailable)",
                },
                search: {
                  type: "string",
                  description: "Fuzzy search across entity names and IDs",
                },
                group_by: {
                  type: "string",
                  enum: ["domain", "area", "device", "device_class", "state"],
                  description: "Group results by specified criterion",
                  default: "domain",
                },
                include_unavailable: {
                  type: "boolean",
                  description: "Include unavailable/offline entities",
                  default: false,
                },
                limit: {
                  type: "integer",
                  description:
                    "Maximum number of entities to return (default: 50)",
                  default: 50,
                  minimum: 1,
                  maximum: 500,
                },
              },
            },
          },
          {
            name: "get_entity_relationships",
            description:
              "Get detailed relationship information for an entity, including its device, area, related entities, and automations that reference it",
            inputSchema: {
              type: "object",
              properties: {
                entity_id: {
                  type: "string",
                  description: "Entity ID to get relationships for",
                },
                name: {
                  type: "string",
                  description: "Friendly name to resolve to entity",
                },
                area: {
                  type: "string",
                  description: "Area context for name resolution",
                },
                floor: {
                  type: "string",
                  description: "Floor context for name resolution",
                },
              },
            },
          },
          {
            name: "get_home_topology",
            description:
              "Generate a hierarchical topology map of the entire home structure, showing areas, devices, and entities organized by location",
            inputSchema: {
              type: "object",
              properties: {
                include_entities: {
                  type: "boolean",
                  description:
                    "Include individual entities in the topology (can be verbose)",
                  default: false,
                },
                area_filter: {
                  type: "string",
                  description: "Filter to specific area(s), comma-separated",
                },
              },
            },
          },
          {
            name: "get_device_health",
            description:
              "Get health status and diagnostics for devices and entities, including availability, last update times, and potential issues",
            inputSchema: {
              type: "object",
              properties: {
                entity_id: {
                  type: "string",
                  description: "Specific entity to check (optional)",
                },
                area: {
                  type: "string",
                  description: "Check all devices in an area",
                },
                domain: {
                  type: "string",
                  description:
                    "Check all entities of a domain (e.g., sensor, light)",
                },
                show_healthy: {
                  type: "boolean",
                  description: "Include healthy entities in results",
                  default: false,
                },
                stale_threshold_hours: {
                  type: "number",
                  description:
                    "Hours since last update to consider entity stale",
                  default: 24,
                  minimum: 0.1,
                },
              },
            },
          },
          {
            name: "search_entities_fuzzy",
            description:
              "Advanced fuzzy search for entities with intelligent suggestions, typo correction, and relevance scoring",
            inputSchema: {
              type: "object",
              properties: {
                query: {
                  type: "string",
                  description:
                    "Search query (supports partial matches, typos, and natural language)",
                },
                limit: {
                  type: "integer",
                  description: "Maximum number of results to return",
                  default: 10,
                  minimum: 1,
                  maximum: 50,
                },
                domain_hint: {
                  type: "string",
                  description: "Prefer results from this domain",
                },
                area_hint: {
                  type: "string",
                  description: "Prefer results from this area",
                },
              },
              required: ["query"],
            },
          },
          {
            name: "get_history",
            description:
              "Retrieve historical state changes for one or more entities over a time window with aggregated statistics",
            inputSchema: {
              type: "object",
              properties: {
                entity_id: {
                  type: "string",
                  description:
                    "Single entity_id (alternative to entity_ids array)",
                },
                entity_ids: {
                  type: "array",
                  items: { type: "string" },
                  description: "List of entity_ids to query",
                },
                name: {
                  type: "string",
                  description:
                    "Friendly name to resolve to an entity (if entity_id not provided)",
                },
                area: {
                  type: "string",
                  description: "Area context used for name resolution",
                },
                floor: {
                  type: "string",
                  description: "Floor context used for name resolution",
                },
                hours: {
                  type: "number",
                  description:
                    "Number of past hours to include (mutually exclusive with start/end)",
                  minimum: 0.01,
                },
                start: {
                  type: "string",
                  description:
                    "ISO8601 start time (if omitted with end, hours required)",
                },
                end: {
                  type: "string",
                  description:
                    "ISO8601 end time (defaults to now if start provided)",
                },
                include_states: {
                  type: "boolean",
                  description: "Include a limited sample of raw state changes",
                  default: false,
                },
                minimal_response: {
                  type: "boolean",
                  description: "Return only summary statistics (omit samples)",
                  default: true,
                },
                limit: {
                  type: "integer",
                  description:
                    "Max raw state records per entity when include_states=true",
                  minimum: 1,
                  maximum: 500,
                },
              },
            },
          },
          {
            name: "get_entity_baseline",
            description:
              "Compare recent behavior vs historical baseline to detect anomalies and compute typical ranges for automation thresholds",
            inputSchema: {
              type: "object",
              properties: {
                entity_id: { type: "string", description: "Single entity_id" },
                name: {
                  type: "string",
                  description: "Friendly name to resolve to entity",
                },
                area: {
                  type: "string",
                  description: "Area context for name resolution",
                },
                floor: {
                  type: "string",
                  description: "Floor context for name resolution",
                },
                recent_hours: {
                  type: "number",
                  description: "Recent window length in hours (default: 1)",
                  minimum: 0.01,
                  default: 1,
                },
                baseline_hours: {
                  type: "number",
                  description:
                    "Baseline window length in hours preceding recent window (default: 24)",
                  minimum: 0.1,
                  default: 24,
                },
              },
            },
          },
        ],
      };
    });
  }

  setupToolHandlers() {
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      // Wait for index to be ready for entity-dependent operations
      if (
        !this.indexReady &&
        [
          "HassTurnOn",
          "HassTurnOff",
          "HassLightSet",
          "admin_debug",
          "get_history",
          "get_entity_baseline",
          "explore_entities",
          "get_entity_relationships",
          "get_home_topology",
          "get_device_health",
          "search_entities_fuzzy",
        ].includes(name)
      ) {
        let retries = 0;
        while (!this.indexReady && retries < 50) {
          await new Promise((resolve) => setTimeout(resolve, 100));
          retries++;
        }
      }

      try {
        switch (name) {
          case "GetLiveContext":
            return await this.getLiveContext(args);
          case "HassCancelAllTimers":
            return await this.cancelAllTimers(args);
          case "HassClimateSetTemperature":
            return await this.setClimateTemperature(args);
          case "HassFanSetSpeed":
            return await this.setFanSpeed(args);
          case "HassLightSet":
            return await this.setLight(args);
          case "HassMediaNext":
            return await this.mediaNext(args);
          case "HassMediaPause":
            return await this.mediaPause(args);
          case "HassMediaPrevious":
            return await this.mediaPrevious(args);
          case "HassMediaSearchAndPlay":
            return await this.mediaSearchAndPlay(args);
          case "HassMediaUnpause":
            return await this.mediaUnpause(args);
          case "HassSetVolume":
            return await this.setVolume(args);
          case "HassSetVolumeRelative":
            return await this.setVolumeRelative(args);
          case "HassTurnOff":
            return await this.turnOff(args);
          case "HassTurnOn":
            return await this.turnOn(args);
          case "get_states":
            return await this.getStates(args);
          case "call_service":
            return await this.callService(args);
          case "admin_debug":
            return await this.adminDebug(args);
          case "get_history":
            return await this.getHistory(args);
          case "get_entity_baseline":
            return await this.getEntityBaseline(args);
          case "explore_entities":
            return await this.exploreEntities(args);
          case "get_entity_relationships":
            return await this.getEntityRelationships(args);
          case "get_home_topology":
            return await this.getHomeTopology(args);
          case "get_device_health":
            return await this.getDeviceHealth(args);
          case "search_entities_fuzzy":
            return await this.searchEntitiesFuzzy(args);
          default:
            throw new Error(`Unknown tool: ${name}`);
        }
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error: ${error.message}`,
            },
          ],
        };
      }
    });
  }

  async getStates(args) {
    const url = args.entity_id
      ? `${HASS_URL}/api/states/${args.entity_id}`
      : `${HASS_URL}/api/states`;

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${HASS_TOKEN}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(data, null, 2),
        },
      ],
    };
  }

  resolveEntityId(args) {
    let { domain, name, area, floor } = args;

    if (args.entity_id) return args.entity_id;
    if (!name && !area) return null;

    const searchName = name || area;
    const normalized = this.normalizeName(searchName);
    let candidates = this.nameIndex[normalized] || [];

    if (candidates.length === 0) {
      // try partial matches
      const partialMatches = [];
      for (const [key, entityIds] of Object.entries(this.nameIndex)) {
        if (key.includes(normalized) || normalized.includes(key)) {
          partialMatches.push(...entityIds);
        }
      }
      candidates = [...new Set(partialMatches)];
    }

    if (candidates.length === 0) return null;
    if (candidates.length === 1) return candidates[0];

    // disambiguation logic
    let filtered = candidates;

    // prefer exact domain match
    if (domain) {
      const domainMatches = filtered.filter((c) => c.startsWith(`${domain}.`));
      if (domainMatches.length > 0) filtered = domainMatches;
    }

    // filter by area if provided
    if (area && filtered.length > 1) {
      const areaFiltered = filtered.filter((entityId) => {
        const entity = this.entities[entityId];
        const entityArea = entity?.attributes?.area_id;
        if (!entityArea) return false;
        const areaObj = this.areas[entityArea];
        return (
          areaObj &&
          this.normalizeName(areaObj.name) === this.normalizeName(area)
        );
      });
      if (areaFiltered.length > 0) filtered = areaFiltered;
    }

    // filter by floor if provided
    if (floor && filtered.length > 1) {
      const floorFiltered = filtered.filter((entityId) => {
        const entity = this.entities[entityId];
        return entity?.attributes?.floor === floor;
      });
      if (floorFiltered.length > 0) filtered = floorFiltered;
    }

    return filtered[0]; // return best match
  }

  async callService(args) {
    let { domain, service, service_data = {} } = args;
    let entity_id = this.resolveEntityId(args);

    // if still no entity_id, try rebuilding index once
    if (!entity_id && (args.name || args.area)) {
      await this.buildEntityIndex();
      entity_id = this.resolveEntityId(args);
    }

    const url = `${HASS_URL}/api/services/${domain}/${service}`;
    const payload = entity_id ? { entity_id, ...service_data } : service_data;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${HASS_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    let data = null;
    try {
      data = await response.json();
    } catch (e) {
      data = null;
    }

    return {
      content: [
        {
          type: "text",
          text: `Service called successfully: ${
            data ? JSON.stringify(data, null, 2) : "{}"
          } (entity_id: ${entity_id || "none"})`,
        },
      ],
    };
  }

  async getLiveContext(args) {
    return await this.getStates({});
  }

  async cancelAllTimers(args) {
    return await this.callService({
      domain: "timer",
      service: "cancel",
      entity_id: "all",
    });
  }

  async setClimateTemperature(args) {
    const { area, floor, name, temperature } = args;

    return await this.callService({
      domain: "climate",
      service: "set_temperature",
      name,
      area,
      floor,
      service_data: { temperature },
    });
  }

  async setFanSpeed(args) {
    const { area, floor, name, percentage } = args;

    return await this.callService({
      domain: "fan",
      service: "set_percentage",
      name,
      area,
      floor,
      service_data: { percentage },
    });
  }

  async setLight(args) {
    const { area, floor, name, brightness, color, temperature } = args;

    const service_data = {};
    if (brightness !== undefined) service_data.brightness_pct = brightness;
    if (color !== undefined) service_data.color_name = color;
    if (temperature !== undefined) service_data.color_temp = temperature;

    return await this.callService({
      domain: "light",
      service: "turn_on",
      name,
      area,
      floor,
      service_data,
    });
  }

  async mediaNext(args) {
    return await this.callService({
      domain: "media_player",
      service: "media_next_track",
      ...args,
    });
  }

  async mediaPause(args) {
    return await this.callService({
      domain: "media_player",
      service: "media_pause",
      ...args,
    });
  }

  async mediaPrevious(args) {
    return await this.callService({
      domain: "media_player",
      service: "media_previous_track",
      ...args,
    });
  }

  async mediaSearchAndPlay(args) {
    const { search_query, media_class } = args;

    return await this.callService({
      domain: "media_player",
      service: "play_media",
      ...args,
      service_data: {
        media_content_id: search_query,
        media_content_type: media_class || "music",
      },
    });
  }

  async mediaUnpause(args) {
    return await this.callService({
      domain: "media_player",
      service: "media_play",
      ...args,
    });
  }

  async setVolume(args) {
    const { volume_level } = args;

    return await this.callService({
      domain: "media_player",
      service: "volume_set",
      ...args,
      service_data: { volume_level: volume_level / 100 },
    });
  }

  async setVolumeRelative(args) {
    const { volume_step } = args;
    const entity_id = this.resolveEntityId({ ...args, domain: "media_player" });

    let service, service_data;
    if (volume_step === "up") {
      service = "volume_up";
    } else if (volume_step === "down") {
      service = "volume_down";
    } else {
      service = "volume_set";
      const currentState = await this.getStates({ entity_id });
      const currentVolume =
        JSON.parse(currentState.content[0].text)[0]?.attributes?.volume_level ||
        0;
      service_data = {
        volume_level: Math.max(
          0,
          Math.min(1, currentVolume + volume_step / 100)
        ),
      };
    }

    return await this.callService({
      domain: "media_player",
      service,
      entity_id,
      service_data,
    });
  }

  async turnOff(args) {
    const entity_id = this.resolveEntityId(args);
    if (!entity_id) {
      throw new Error("Could not resolve entity from provided parameters");
    }

    const domain = entity_id.split(".")[0];
    return await this.callService({
      domain,
      service: "turn_off",
      entity_id,
    });
  }

  async turnOn(args) {
    const entity_id = this.resolveEntityId(args);
    if (!entity_id) {
      throw new Error("Could not resolve entity from provided parameters");
    }

    const domain = entity_id.split(".")[0];
    return await this.callService({
      domain,
      service: "turn_on",
      entity_id,
    });
  }

  async adminDebug(args) {
    const { search, type = "all" } = args;
    const result = {};

    if (type === "all" || type === "entities") {
      result.entities = {
        count: Object.keys(this.entities).length,
        sample: Object.keys(this.entities).slice(0, 10),
      };
      if (search) {
        const normalized = this.normalizeName(search);
        const matches = this.nameIndex[normalized] || [];
        const partials = [];
        for (const [key, entityIds] of Object.entries(this.nameIndex)) {
          if (key.includes(normalized) || normalized.includes(key)) {
            partials.push(...entityIds);
          }
        }
        const uniquePartials = [...new Set(partials)];

        // Helper to get device and area
        const getDeviceArea = (entityId) => {
          const entity = this.entities[entityId];
          let device = null,
            area = null;
          // Find device by entity's device_id (if present)
          if (entity?.device_id && this.devices[entity.device_id]) {
            device = this.devices[entity.device_id];
          } else {
            // Try to find device by matching entity_id in device entities
            for (const dev of Object.values(this.devices)) {
              if (dev?.entities?.includes?.(entityId)) {
                device = dev;
                break;
              }
            }
          }
          // Find area by entity's area_id (if present)
          if (
            entity?.attributes?.area_id &&
            this.areas[entity.attributes.area_id]
          ) {
            area = this.areas[entity.attributes.area_id];
          } else if (device?.area_id && this.areas[device.area_id]) {
            area = this.areas[device.area_id];
          }
          return { device, area };
        };

        // Build detailed info for matches
        result.entity_matches = matches.map((entityId) => {
          const entity = this.entities[entityId];
          const { device, area } = getDeviceArea(entityId);
          return {
            entity_id: entityId,
            friendly_name: entity?.attributes?.friendly_name,
            snapshot: entity?.snapshot,
            attributes: entity?.attributes,
            device: device
              ? { id: device.id, name: device.name_by_user || device.name }
              : null,
            area: area ? { id: area.area_id, name: area.name } : null,
          };
        });
        result.partial_matches = uniquePartials.map((entityId) => {
          const entity = this.entities[entityId];
          const { device, area } = getDeviceArea(entityId);
          return {
            entity_id: entityId,
            friendly_name: entity?.attributes?.friendly_name,
            snapshot: entity?.snapshot,
            attributes: entity?.attributes,
            device: device
              ? { id: device.id, name: device.name_by_user || device.name }
              : null,
            area: area ? { id: area.area_id, name: area.name } : null,
          };
        });
      }
    }

    if (type === "all" || type === "areas") {
      result.areas = {
        count: Object.keys(this.areas).length,
        list: Object.values(this.areas).map((a) => ({
          id: a.area_id,
          name: a.name,
        })),
      };
    }

    if (type === "all" || type === "devices") {
      result.devices = {
        count: Object.keys(this.devices).length,
        sample: Object.values(this.devices)
          .slice(0, 5)
          .map((d) => ({ id: d.id, name: d.name_by_user || d.name })),
      };
    }

    if (type === "all" || type === "automations") {
      result.automations = {
        count: Object.keys(this.automations).length,
        list: Object.values(this.automations).map((a) => ({
          id: a.entity_id,
          name: a.attributes.friendly_name,
        })),
      };
    }

    if (type === "all" || type === "scenes") {
      result.scenes = {
        count: Object.keys(this.scenes).length,
        list: Object.values(this.scenes).map((s) => ({
          id: s.entity_id,
          name: s.attributes.friendly_name,
        })),
      };
    }

    if (type === "all" || type === "scripts") {
      result.scripts = {
        count: Object.keys(this.scripts).length,
        list: Object.values(this.scripts).map((s) => ({
          id: s.entity_id,
          name: s.attributes.friendly_name,
        })),
      };
    }

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  }

  async getHistory(args) {
    // Parameter handling
    let {
      entity_id,
      entity_ids = [],
      name,
      area,
      floor,
      hours,
      start,
      end,
      include_states = false,
      minimal_response = true,
      limit = 50,
    } = args;
    const now = new Date();

    // Resolve single friendly name if provided
    if (!entity_id && name) {
      const resolved = this.resolveEntityId({ name, area, floor });
      if (resolved) entity_id = resolved;
      else throw new Error(`Could not resolve entity from name='${name}'`);
    }

    if (entity_id) entity_ids.push(entity_id);
    entity_ids = [...new Set(entity_ids.filter(Boolean))];
    if (entity_ids.length === 0)
      throw new Error("At least one entity_id or name is required");

    // Time window determination
    let startDate, endDate;
    if (hours && (start || end))
      throw new Error("Provide either hours OR start/end, not both");
    if (hours) {
      endDate = now;
      startDate = new Date(now.getTime() - hours * 3600 * 1000);
    } else if (start) {
      startDate = new Date(start);
      if (isNaN(startDate)) throw new Error("Invalid start timestamp");
      if (end) {
        endDate = new Date(end);
        if (isNaN(endDate)) throw new Error("Invalid end timestamp");
      } else {
        endDate = now;
      }
    } else {
      // default 1 hour
      endDate = now;
      startDate = new Date(now.getTime() - 3600 * 1000);
    }

    if (startDate >= endDate) throw new Error("start must be before end");

    // Build history API URL. Home Assistant history endpoint: /api/history/period/<start>?filter_entity_id=...&end_time=...
    const startISO = startDate.toISOString();
    const endISO = endDate.toISOString();
    const filter = entity_ids.join(",");
    const url = new URL(`${HASS_URL}/api/history/period/${startISO}`);
    url.searchParams.set("filter_entity_id", filter);
    url.searchParams.set("end_time", endISO);
    // minimal_response means we will not request significant changes only (that's a different flag), we fetch all then compress.

    const response = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${HASS_TOKEN}`,
        "Content-Type": "application/json",
      },
    });
    if (!response.ok)
      throw new Error(
        `History HTTP ${response.status}: ${response.statusText}`
      );
    const raw = await response.json();
    // raw is array of arrays (each entity) per HA spec

    const summary = {
      window: {
        start: startISO,
        end: endISO,
        hours: (endDate - startDate) / 3600000,
      },
      entities: {},
    };

    for (const series of raw) {
      if (!Array.isArray(series) || series.length === 0) continue;
      const eid = series[0].entity_id;
      const states = series;
      const first = states[0];
      const last = states[states.length - 1];
      const distinctValues = new Set();
      let numericValues = [];
      let transitions = 0;
      let prevState = null;
      const durations = {}; // state -> milliseconds

      for (let i = 0; i < states.length; i++) {
        const s = states[i];
        const st = s.state;
        distinctValues.add(st);
        if (prevState !== null && prevState !== st) transitions++;
        // duration calculation: from this state time until next state or end
        const thisTime = new Date(
          s.last_changed ||
            s.last_updated ||
            s.time ||
            s._time ||
            s.when ||
            s.timestamp
        );
        const nextTime =
          i < states.length - 1
            ? new Date(states[i + 1].last_changed || states[i + 1].last_updated)
            : endDate; // window end
        if (!durations[st]) durations[st] = 0;
        if (!isNaN(thisTime) && !isNaN(nextTime)) {
          durations[st] += Math.max(0, nextTime - thisTime);
        }
        prevState = st;
        const num = parseFloat(st);
        if (!isNaN(num) && isFinite(num)) numericValues.push(num);
      }

      // numeric stats
      let numericStats = null;
      if (numericValues.length > 0) {
        const sum = numericValues.reduce((a, b) => a + b, 0);
        const min = Math.min(...numericValues);
        const max = Math.max(...numericValues);
        const avg = sum / numericValues.length;
        // simple variance
        const variance =
          numericValues.reduce((acc, v) => acc + Math.pow(v - avg, 2), 0) /
          numericValues.length;
        const stddev = Math.sqrt(variance);
        numericStats = {
          count: numericValues.length,
          min,
          max,
          avg,
          sum,
          stddev,
        };
      }

      // convert durations to percentage of window
      const totalWindowMs = endDate - startDate;
      const durationSummary = Object.fromEntries(
        Object.entries(durations).map(([k, v]) => [
          k,
          { ms: v, pct: +((v / totalWindowMs) * 100).toFixed(2) },
        ])
      );

      const entitySummary = {
        entity_id: eid,
        friendly_name: this.entities[eid]?.attributes?.friendly_name,
        domain: eid.split(".")[0],
        total_samples: states.length,
        transitions,
        distinct_values: [...distinctValues],
        first: { state: first.state, at: first.last_changed },
        last: { state: last.state, at: last.last_changed },
        durations: durationSummary,
        numeric: numericStats,
      };

      if (include_states && !minimal_response) {
        // include limited sample of raw states (cap at limit)
        const sample = states.slice(-limit).map((s) => ({
          state: s.state,
          last_changed: s.last_changed,
          last_updated: s.last_updated,
          attributes:
            s.attributes && Object.keys(s.attributes).length < 15
              ? s.attributes
              : undefined,
        }));
        entitySummary.sample = sample;
      }

      summary.entities[eid] = entitySummary;
    }

    return {
      content: [{ type: "text", text: JSON.stringify(summary, null, 2) }],
    };
  }

  async getEntityBaseline(args) {
    let {
      entity_id,
      name,
      area,
      floor,
      recent_hours = 1,
      baseline_hours = 24,
    } = args;

    // Resolve entity
    if (!entity_id && name) {
      const resolved = this.resolveEntityId({ name, area, floor });
      if (resolved) entity_id = resolved;
      else throw new Error(`Could not resolve entity from name='${name}'`);
    }
    if (!entity_id) throw new Error("entity_id or name is required");

    const now = new Date();
    const recentEnd = now;
    const recentStart = new Date(now.getTime() - recent_hours * 3600 * 1000);
    const baselineEnd = recentStart;
    const baselineStart = new Date(
      baselineEnd.getTime() - baseline_hours * 3600 * 1000
    );

    // Fetch recent window
    const recentArgs = {
      entity_id,
      start: recentStart.toISOString(),
      end: recentEnd.toISOString(),
      minimal_response: true,
    };
    const recentResult = await this.getHistory(recentArgs);
    const recentData = JSON.parse(recentResult.content[0].text);
    const recentEntity = recentData.entities[entity_id];

    // Fetch baseline window
    const baselineArgs = {
      entity_id,
      start: baselineStart.toISOString(),
      end: baselineEnd.toISOString(),
      minimal_response: true,
    };
    const baselineResult = await this.getHistory(baselineArgs);
    const baselineData = JSON.parse(baselineResult.content[0].text);
    const baselineEntity = baselineData.entities[entity_id];

    if (!recentEntity && !baselineEntity) {
      throw new Error(`No history data found for entity ${entity_id}`);
    }

    // Compute comparisons
    const comparison = {
      entity_id,
      friendly_name: this.entities[entity_id]?.attributes?.friendly_name,
      domain: entity_id.split(".")[0],
      windows: {
        recent: {
          start: recentStart.toISOString(),
          end: recentEnd.toISOString(),
          hours: recent_hours,
        },
        baseline: {
          start: baselineStart.toISOString(),
          end: baselineEnd.toISOString(),
          hours: baseline_hours,
        },
      },
      recent: recentEntity || { note: "No recent data" },
      baseline: baselineEntity || { note: "No baseline data" },
      deltas: {},
    };

    // Compute numeric deltas if both windows have numeric stats
    if (recentEntity?.numeric && baselineEntity?.numeric) {
      const rn = recentEntity.numeric;
      const bn = baselineEntity.numeric;
      comparison.deltas.numeric = {
        avg_change: +(rn.avg - bn.avg).toFixed(3),
        avg_pct_change:
          bn.avg !== 0
            ? +(((rn.avg - bn.avg) / bn.avg) * 100).toFixed(2)
            : null,
        min_change: +(rn.min - bn.min).toFixed(3),
        max_change: +(rn.max - bn.max).toFixed(3),
        stddev_change: +(rn.stddev - bn.stddev).toFixed(3),
        range_recent: +(rn.max - rn.min).toFixed(3),
        range_baseline: +(bn.max - bn.min).toFixed(3),
      };
    }

    // Compute transition rate comparison
    if (recentEntity && baselineEntity) {
      const recentRate = recentEntity.transitions / recent_hours;
      const baselineRate = baselineEntity.transitions / baseline_hours;
      comparison.deltas.transition_rate = {
        recent_per_hour: +recentRate.toFixed(2),
        baseline_per_hour: +baselineRate.toFixed(2),
        change: +(recentRate - baselineRate).toFixed(2),
      };
    }

    // Compare state duration percentages (for binary or categorical sensors)
    if (recentEntity?.durations && baselineEntity?.durations) {
      const allStates = new Set([
        ...Object.keys(recentEntity.durations),
        ...Object.keys(baselineEntity.durations),
      ]);
      comparison.deltas.duration_pct_changes = {};
      for (const state of allStates) {
        const recentPct = recentEntity.durations[state]?.pct || 0;
        const baselinePct = baselineEntity.durations[state]?.pct || 0;
        comparison.deltas.duration_pct_changes[state] = +(
          recentPct - baselinePct
        ).toFixed(2);
      }
    }

    // AI guidance for automation use
    comparison.automation_insights = [];
    if (comparison.deltas.numeric) {
      const d = comparison.deltas.numeric;
      if (Math.abs(d.avg_pct_change) > 10) {
        comparison.automation_insights.push(
          `Average value shifted ${
            d.avg_pct_change > 0 ? "up" : "down"
          } by ${Math.abs(d.avg_pct_change)}% - consider adaptive thresholds.`
        );
      }
      if (d.stddev_change > 0 && baselineEntity.numeric.stddev > 0) {
        const stddevPctChange = (
          (d.stddev_change / baselineEntity.numeric.stddev) *
          100
        ).toFixed(1);
        if (Math.abs(stddevPctChange) > 20) {
          comparison.automation_insights.push(
            `Variability ${
              stddevPctChange > 0 ? "increased" : "decreased"
            } by ${Math.abs(
              stddevPctChange
            )}% - sensor may be unstable or conditions changed.`
          );
        }
      }
      comparison.automation_insights.push(
        `Baseline range: ${baselineEntity.numeric.min.toFixed(
          2
        )} - ${baselineEntity.numeric.max.toFixed(2)}. Use ±2σ (${(
          baselineEntity.numeric.avg -
          2 * baselineEntity.numeric.stddev
        ).toFixed(2)} to ${(
          baselineEntity.numeric.avg +
          2 * baselineEntity.numeric.stddev
        ).toFixed(2)}) for anomaly detection.`
      );
    }

    if (comparison.deltas.transition_rate) {
      const tr = comparison.deltas.transition_rate;
      if (tr.change > tr.baseline_per_hour * 0.5) {
        comparison.automation_insights.push(
          `Transition rate increased by ${(
            (tr.change / tr.baseline_per_hour) *
            100
          ).toFixed(0)}% - device may be flapping or activity increased.`
        );
      }
    }

    if (comparison.deltas.duration_pct_changes) {
      for (const [state, change] of Object.entries(
        comparison.deltas.duration_pct_changes
      )) {
        if (Math.abs(change) > 15) {
          comparison.automation_insights.push(
            `State '${state}' duration changed by ${
              change > 0 ? "+" : ""
            }${change}% - occupancy or usage pattern shift detected.`
          );
        }
      }
    }

    return {
      content: [{ type: "text", text: JSON.stringify(comparison, null, 2) }],
    };
  }

  async exploreEntities(args) {
    const {
      domain,
      area,
      device_class,
      state,
      search,
      group_by = "domain",
      include_unavailable = false,
      limit = 50,
    } = args;

    // Filter entities based on criteria
    let filtered = Object.entries(this.entities).map(([id, entity]) => {
      // Get device and area info
      const entityDomain = id.split(".")[0];
      let deviceInfo = null,
        areaInfo = null;

      // Find device
      if (entity.device_id && this.devices[entity.device_id]) {
        deviceInfo = this.devices[entity.device_id];
      } else {
        for (const dev of Object.values(this.devices)) {
          if (dev?.entities?.includes?.(id)) {
            deviceInfo = dev;
            break;
          }
        }
      }

      // Find area
      if (entity.attributes?.area_id && this.areas[entity.attributes.area_id]) {
        areaInfo = this.areas[entity.attributes.area_id];
      } else if (deviceInfo?.area_id && this.areas[deviceInfo.area_id]) {
        areaInfo = this.areas[deviceInfo.area_id];
      }

      return {
        entity_id: id,
        domain: entityDomain,
        friendly_name: entity.attributes?.friendly_name || id,
        state: entity.state,
        device_class: entity.attributes?.device_class,
        device: deviceInfo
          ? {
              id: deviceInfo.id,
              name: deviceInfo.name_by_user || deviceInfo.name,
            }
          : null,
        area: areaInfo ? { id: areaInfo.area_id, name: areaInfo.name } : null,
        last_updated: entity.last_updated,
        attributes: entity.attributes,
      };
    });

    // Apply filters
    if (domain) {
      filtered = filtered.filter((e) => e.domain === domain);
    }

    if (area) {
      const normalizedArea = this.normalizeName(area);
      filtered = filtered.filter(
        (e) => e.area && this.normalizeName(e.area.name) === normalizedArea
      );
    }

    if (device_class) {
      filtered = filtered.filter((e) => e.device_class === device_class);
    }

    if (state) {
      filtered = filtered.filter((e) => e.state === state);
    }

    if (!include_unavailable) {
      filtered = filtered.filter(
        (e) => e.state !== "unavailable" && e.state !== "unknown"
      );
    }

    if (search) {
      const normalizedSearch = this.normalizeName(search);
      filtered = filtered.filter(
        (e) =>
          this.normalizeName(e.friendly_name).includes(normalizedSearch) ||
          this.normalizeName(e.entity_id).includes(normalizedSearch)
      );
    }

    // Apply limit
    filtered = filtered.slice(0, limit);

    // Group results
    const grouped = {};
    for (const entity of filtered) {
      let key;
      switch (group_by) {
        case "domain":
          key = entity.domain;
          break;
        case "area":
          key = entity.area?.name || "no_area";
          break;
        case "device":
          key = entity.device?.name || "no_device";
          break;
        case "device_class":
          key = entity.device_class || "no_class";
          break;
        case "state":
          key = entity.state;
          break;
        default:
          key = "all";
      }

      if (!grouped[key]) {
        grouped[key] = [];
      }
      grouped[key].push(entity);
    }

    // Generate summary
    const summary = {
      total_matched: filtered.length,
      filters_applied: {
        domain: domain || "none",
        area: area || "none",
        device_class: device_class || "none",
        state: state || "none",
        search: search || "none",
        include_unavailable,
      },
      grouped_by: group_by,
      groups: Object.entries(grouped)
        .map(([key, entities]) => ({
          group_name: key,
          count: entities.length,
          entities: entities.map((e) => ({
            entity_id: e.entity_id,
            friendly_name: e.friendly_name,
            state: e.state,
            device_class: e.device_class,
            area: e.area?.name,
            device: e.device?.name,
            last_updated: e.last_updated,
          })),
        }))
        .sort((a, b) => b.count - a.count),
    };

    return {
      content: [{ type: "text", text: JSON.stringify(summary, null, 2) }],
    };
  }

  async getEntityRelationships(args) {
    let { entity_id, name, area, floor } = args;

    // Resolve entity
    if (!entity_id && name) {
      entity_id = this.resolveEntityId({ name, area, floor });
    }
    if (!entity_id) {
      throw new Error("entity_id or name is required");
    }

    const entity = this.entities[entity_id];
    if (!entity) {
      throw new Error(`Entity ${entity_id} not found`);
    }

    const relationships = {
      entity: {
        entity_id,
        friendly_name: entity.attributes?.friendly_name,
        domain: entity_id.split(".")[0],
        state: entity.state,
        attributes: entity.attributes,
        last_updated: entity.last_updated,
      },
      device: null,
      area: null,
      related_entities: [],
      automations_referencing: [],
      scenes_referencing: [],
      scripts_referencing: [],
    };

    // Find device
    let deviceInfo = null;
    if (entity.device_id && this.devices[entity.device_id]) {
      deviceInfo = this.devices[entity.device_id];
    } else {
      for (const dev of Object.values(this.devices)) {
        if (dev?.entities?.includes?.(entity_id)) {
          deviceInfo = dev;
          break;
        }
      }
    }

    if (deviceInfo) {
      relationships.device = {
        id: deviceInfo.id,
        name: deviceInfo.name_by_user || deviceInfo.name,
        manufacturer: deviceInfo.manufacturer,
        model: deviceInfo.model,
        sw_version: deviceInfo.sw_version,
        area_id: deviceInfo.area_id,
        disabled: deviceInfo.disabled_by !== null,
        config_entries: deviceInfo.config_entries,
      };

      // Find related entities from same device
      if (deviceInfo.entities) {
        for (const relatedId of deviceInfo.entities) {
          if (relatedId !== entity_id && this.entities[relatedId]) {
            const related = this.entities[relatedId];
            relationships.related_entities.push({
              entity_id: relatedId,
              friendly_name: related.attributes?.friendly_name,
              domain: relatedId.split(".")[0],
              state: related.state,
              device_class: related.attributes?.device_class,
            });
          }
        }
      }
    }

    // Find area
    let areaInfo = null;
    if (entity.attributes?.area_id && this.areas[entity.attributes.area_id]) {
      areaInfo = this.areas[entity.attributes.area_id];
    } else if (deviceInfo?.area_id && this.areas[deviceInfo.area_id]) {
      areaInfo = this.areas[deviceInfo.area_id];
    }

    if (areaInfo) {
      relationships.area = {
        area_id: areaInfo.area_id,
        name: areaInfo.name,
        aliases: areaInfo.aliases,
        picture: areaInfo.picture,
      };
    }

    // Find automations that reference this entity
    for (const [autoId, automation] of Object.entries(this.automations)) {
      // Simple string search in automation attributes
      const autoStr = JSON.stringify(automation);
      if (autoStr.includes(entity_id)) {
        relationships.automations_referencing.push({
          entity_id: autoId,
          friendly_name: automation.attributes?.friendly_name,
          state: automation.state,
        });
      }
    }

    // Find scenes that reference this entity
    for (const [sceneId, scene] of Object.entries(this.scenes)) {
      const sceneStr = JSON.stringify(scene);
      if (sceneStr.includes(entity_id)) {
        relationships.scenes_referencing.push({
          entity_id: sceneId,
          friendly_name: scene.attributes?.friendly_name,
        });
      }
    }

    // Find scripts that reference this entity
    for (const [scriptId, script] of Object.entries(this.scripts)) {
      const scriptStr = JSON.stringify(script);
      if (scriptStr.includes(entity_id)) {
        relationships.scripts_referencing.push({
          entity_id: scriptId,
          friendly_name: script.attributes?.friendly_name,
        });
      }
    }

    return {
      content: [{ type: "text", text: JSON.stringify(relationships, null, 2) }],
    };
  }

  async getHomeTopology(args) {
    const { include_entities = false, area_filter } = args;

    const topology = {
      summary: {
        total_areas: Object.keys(this.areas).length,
        total_devices: Object.keys(this.devices).length,
        total_entities: Object.keys(this.entities).length,
      },
      areas: [],
      unassigned_devices: [],
    };

    // Filter areas if specified
    let areasToProcess = Object.values(this.areas);
    if (area_filter) {
      const areaNames = area_filter
        .split(",")
        .map((a) => this.normalizeName(a.trim()));
      areasToProcess = areasToProcess.filter((area) =>
        areaNames.includes(this.normalizeName(area.name))
      );
    }

    // Build topology by area
    for (const area of areasToProcess) {
      const areaData = {
        area_id: area.area_id,
        name: area.name,
        aliases: area.aliases,
        devices: [],
        entity_count: 0,
      };

      // Find devices in this area
      const areaDevices = Object.values(this.devices).filter(
        (d) => d.area_id === area.area_id
      );

      for (const device of areaDevices) {
        const deviceData = {
          id: device.id,
          name: device.name_by_user || device.name,
          manufacturer: device.manufacturer,
          model: device.model,
          disabled: device.disabled_by !== null,
          entity_count: 0,
        };

        if (include_entities && device.entities) {
          deviceData.entities = [];
          for (const entityId of device.entities) {
            if (this.entities[entityId]) {
              const entity = this.entities[entityId];
              deviceData.entities.push({
                entity_id: entityId,
                friendly_name: entity.attributes?.friendly_name,
                domain: entityId.split(".")[0],
                state: entity.state,
                device_class: entity.attributes?.device_class,
              });
            }
          }
          deviceData.entity_count = deviceData.entities.length;
        } else if (device.entities) {
          deviceData.entity_count = device.entities.length;
        }

        areaData.entity_count += deviceData.entity_count;
        areaData.devices.push(deviceData);
      }

      topology.areas.push(areaData);
    }

    // Find unassigned devices
    const unassignedDevices = Object.values(this.devices).filter(
      (d) => !d.area_id
    );
    for (const device of unassignedDevices) {
      const deviceData = {
        id: device.id,
        name: device.name_by_user || device.name,
        manufacturer: device.manufacturer,
        model: device.model,
        disabled: device.disabled_by !== null,
        entity_count: device.entities ? device.entities.length : 0,
      };

      if (include_entities && device.entities) {
        deviceData.entities = device.entities
          .map((entityId) => {
            const entity = this.entities[entityId];
            return entity
              ? {
                  entity_id: entityId,
                  friendly_name: entity.attributes?.friendly_name,
                  domain: entityId.split(".")[0],
                  state: entity.state,
                }
              : null;
          })
          .filter(Boolean);
      }

      topology.unassigned_devices.push(deviceData);
    }

    // Sort areas by entity count
    topology.areas.sort((a, b) => b.entity_count - a.entity_count);

    return {
      content: [{ type: "text", text: JSON.stringify(topology, null, 2) }],
    };
  }

  async getDeviceHealth(args) {
    const {
      entity_id,
      area,
      domain,
      show_healthy = false,
      stale_threshold_hours = 24,
    } = args;

    const now = new Date();
    const staleThreshold = now.getTime() - stale_threshold_hours * 3600 * 1000;

    const health = {
      checked_at: now.toISOString(),
      stale_threshold_hours,
      summary: {
        total_checked: 0,
        unavailable: 0,
        stale: 0,
        healthy: 0,
      },
      issues: [],
      healthy: [],
    };

    let entitiesToCheck = [];

    if (entity_id) {
      // Check specific entity
      if (this.entities[entity_id]) {
        entitiesToCheck.push([entity_id, this.entities[entity_id]]);
      }
    } else if (area) {
      // Check all entities in an area
      const normalizedArea = this.normalizeName(area);
      for (const [id, entity] of Object.entries(this.entities)) {
        let entityArea = null;
        if (
          entity.attributes?.area_id &&
          this.areas[entity.attributes.area_id]
        ) {
          entityArea = this.areas[entity.attributes.area_id];
        } else {
          // Check device area
          const device = Object.values(this.devices).find((d) =>
            d.entities?.includes?.(id)
          );
          if (device?.area_id && this.areas[device.area_id]) {
            entityArea = this.areas[device.area_id];
          }
        }
        if (
          entityArea &&
          this.normalizeName(entityArea.name) === normalizedArea
        ) {
          entitiesToCheck.push([id, entity]);
        }
      }
    } else if (domain) {
      // Check all entities of a domain
      for (const [id, entity] of Object.entries(this.entities)) {
        if (id.startsWith(`${domain}.`)) {
          entitiesToCheck.push([id, entity]);
        }
      }
    } else {
      // Check all entities
      entitiesToCheck = Object.entries(this.entities);
    }

    for (const [id, entity] of entitiesToCheck) {
      health.summary.total_checked++;

      const lastUpdated = new Date(entity.last_updated);
      const isStale = lastUpdated.getTime() < staleThreshold;
      const isUnavailable =
        entity.state === "unavailable" || entity.state === "unknown";

      const entityHealth = {
        entity_id: id,
        friendly_name: entity.attributes?.friendly_name,
        domain: id.split(".")[0],
        state: entity.state,
        last_updated: entity.last_updated,
        hours_since_update: ((now - lastUpdated) / 3600000).toFixed(1),
        device_class: entity.attributes?.device_class,
      };

      if (isUnavailable) {
        health.summary.unavailable++;
        entityHealth.issue = "unavailable";
        health.issues.push(entityHealth);
      } else if (isStale) {
        health.summary.stale++;
        entityHealth.issue = "stale";
        health.issues.push(entityHealth);
      } else {
        health.summary.healthy++;
        if (show_healthy) {
          entityHealth.status = "healthy";
          health.healthy.push(entityHealth);
        }
      }
    }

    // Sort issues by severity
    health.issues.sort((a, b) => {
      if (a.issue === "unavailable" && b.issue !== "unavailable") return -1;
      if (a.issue !== "unavailable" && b.issue === "unavailable") return 1;
      return (
        parseFloat(b.hours_since_update) - parseFloat(a.hours_since_update)
      );
    });

    if (!show_healthy) {
      delete health.healthy;
    }

    return {
      content: [{ type: "text", text: JSON.stringify(health, null, 2) }],
    };
  }

  async searchEntitiesFuzzy(args) {
    const { query, limit = 10, domain_hint, area_hint } = args;

    if (!query) {
      throw new Error("query is required");
    }

    const normalizedQuery = this.normalizeName(query);
    const queryWords = normalizedQuery.split("_").filter(Boolean);

    // Calculate relevance score for each entity
    const scored = [];

    for (const [id, entity] of Object.entries(this.entities)) {
      const friendlyName = entity.attributes?.friendly_name || id;
      const normalizedName = this.normalizeName(friendlyName);
      const normalizedId = this.normalizeName(id);

      let score = 0;

      // Exact match (highest score)
      if (
        normalizedName === normalizedQuery ||
        normalizedId === normalizedQuery
      ) {
        score += 1000;
      }

      // Starts with query
      if (
        normalizedName.startsWith(normalizedQuery) ||
        normalizedId.startsWith(normalizedQuery)
      ) {
        score += 500;
      }

      // Contains query
      if (normalizedName.includes(normalizedQuery)) {
        score += 250;
      }
      if (normalizedId.includes(normalizedQuery)) {
        score += 200;
      }

      // Word-by-word matching
      const nameWords = normalizedName.split("_").filter(Boolean);
      const idWords = normalizedId.split("_").filter(Boolean);

      for (const qWord of queryWords) {
        for (const nWord of nameWords) {
          if (nWord === qWord) score += 100;
          else if (nWord.startsWith(qWord)) score += 50;
          else if (nWord.includes(qWord)) score += 25;
          // Levenshtein-like fuzzy matching (simple version)
          else if (this.fuzzyMatch(nWord, qWord)) score += 15;
        }
        for (const iWord of idWords) {
          if (iWord === qWord) score += 80;
          else if (iWord.startsWith(qWord)) score += 40;
          else if (iWord.includes(qWord)) score += 20;
          else if (this.fuzzyMatch(iWord, qWord)) score += 10;
        }
      }

      // Bonus for domain hint
      if (domain_hint && id.startsWith(`${domain_hint}.`)) {
        score += 150;
      }

      // Bonus for area hint
      if (area_hint) {
        const normalizedAreaHint = this.normalizeName(area_hint);
        let entityArea = null;
        if (
          entity.attributes?.area_id &&
          this.areas[entity.attributes.area_id]
        ) {
          entityArea = this.areas[entity.attributes.area_id];
        } else {
          const device = Object.values(this.devices).find((d) =>
            d.entities?.includes?.(id)
          );
          if (device?.area_id && this.areas[device.area_id]) {
            entityArea = this.areas[device.area_id];
          }
        }
        if (
          entityArea &&
          this.normalizeName(entityArea.name) === normalizedAreaHint
        ) {
          score += 150;
        }
      }

      // Penalty for unavailable entities
      if (entity.state === "unavailable" || entity.state === "unknown") {
        score -= 50;
      }

      if (score > 0) {
        // Get device and area info
        let deviceInfo = null,
          areaInfo = null;
        if (entity.device_id && this.devices[entity.device_id]) {
          deviceInfo = this.devices[entity.device_id];
        } else {
          const device = Object.values(this.devices).find((d) =>
            d.entities?.includes?.(id)
          );
          if (device) deviceInfo = device;
        }

        if (
          entity.attributes?.area_id &&
          this.areas[entity.attributes.area_id]
        ) {
          areaInfo = this.areas[entity.attributes.area_id];
        } else if (deviceInfo?.area_id && this.areas[deviceInfo.area_id]) {
          areaInfo = this.areas[deviceInfo.area_id];
        }

        scored.push({
          entity_id: id,
          friendly_name: friendlyName,
          domain: id.split(".")[0],
          state: entity.state,
          device_class: entity.attributes?.device_class,
          device: deviceInfo
            ? { name: deviceInfo.name_by_user || deviceInfo.name }
            : null,
          area: areaInfo ? { name: areaInfo.name } : null,
          score,
          relevance: score >= 500 ? "high" : score >= 100 ? "medium" : "low",
        });
      }
    }

    // Sort by score and limit
    scored.sort((a, b) => b.score - a.score);
    const results = scored.slice(0, limit);

    // Generate suggestions if results are sparse
    const suggestions = [];
    if (results.length < 3) {
      // Suggest popular domains
      const domains = new Set(
        Object.keys(this.entities).map((id) => id.split(".")[0])
      );
      suggestions.push(
        `Try searching within a domain: ${[...domains].slice(0, 10).join(", ")}`
      );

      // Suggest areas
      if (Object.keys(this.areas).length > 0) {
        const areaNames = Object.values(this.areas)
          .map((a) => a.name)
          .slice(0, 5);
        suggestions.push(`Try specifying an area: ${areaNames.join(", ")}`);
      }

      // Suggest similar entities
      if (results.length > 0) {
        const topResult = results[0];
        suggestions.push(
          `Did you mean "${topResult.friendly_name}" (${topResult.entity_id})?`
        );
      }
    }

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              query,
              results_count: results.length,
              results,
              suggestions: suggestions.length > 0 ? suggestions : undefined,
            },
            null,
            2
          ),
        },
      ],
    };
  }

  fuzzyMatch(str1, str2) {
    // Simple fuzzy matching: check if strings are similar (e.g., 1-2 char difference)
    if (Math.abs(str1.length - str2.length) > 2) return false;

    let differences = 0;
    const maxLen = Math.max(str1.length, str2.length);

    for (let i = 0; i < maxLen; i++) {
      if (str1[i] !== str2[i]) differences++;
      if (differences > 2) return false;
    }

    return differences <= 2;
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error("Home Assistant MCP server running on stdio");

    // Build entity index at startup
    await this.buildEntityIndex();

    // refresh index every 60s
    setInterval(
      () =>
        this.buildEntityIndex().catch((err) =>
          console.error("index refresh error", err)
        ),
      60000
    );
  }
}

const server = new HomeAssistantMCPServer();
server.run().catch(console.error);

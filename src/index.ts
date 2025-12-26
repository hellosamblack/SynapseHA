#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { HomeAssistantClient } from './lib/ha-client.js';
import { CacheManager } from './lib/cache.js';
import { FuzzySearcher } from './lib/fuzzy-search.js';
import { NameResolver } from './lib/name-resolver.js';
import { registerTools } from './tools/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const HA_URL = process.env.HA_URL || process.env.HASS_URL || 'http://homeassistant.local:8123';
const HA_TOKEN = process.env.HA_TOKEN || process.env.HASS_TOKEN || process.env.API_ACCESS_TOKEN || '';
const CACHE_DIR = process.env.CACHE_DIR || './cache';
const CACHE_TTL = parseInt(process.env.CACHE_TTL || '60000', 10);

if (!HA_TOKEN) {
  console.error('Error: HA_TOKEN (or HASS_TOKEN or API_ACCESS_TOKEN) environment variable is required');
  process.exit(1);
}

async function main() {
  console.error('Starting SynapseHA MCP Server...');

  // Initialize components
  const haClient = new HomeAssistantClient(HA_URL, HA_TOKEN);
  const cacheManager = new CacheManager(CACHE_DIR, CACHE_TTL);
  const fuzzySearcher = new FuzzySearcher();
  const nameResolver = new NameResolver();

  await cacheManager.init();

  // Initialize cache with entity states and auto-refresh
  console.error('Initializing cache and auto-refresh...');
  try {
    const entities = await haClient.getStates();
    await cacheManager.set('entities', entities);
    fuzzySearcher.setEntities(entities);
    nameResolver.setEntities(entities);

    // Auto-refresh entities every 60 seconds
    cacheManager.registerAutoRefresh('entities', async () => {
      const newEntities = await haClient.getStates();
      fuzzySearcher.setEntities(newEntities);
      nameResolver.setEntities(newEntities);
      return newEntities;
    }, 60000);

    // Load devices and areas
    const devices = await haClient.getDevices();
    await cacheManager.set('devices', devices);
    fuzzySearcher.setDevices(devices);
    nameResolver.setDevices(devices);

    const areas = await haClient.getAreas();
    await cacheManager.set('areas', areas);
    fuzzySearcher.setAreas(areas);
    nameResolver.setAreas(areas);

    console.error('Cache initialized successfully');
  } catch (error) {
    console.error('Warning: Failed to initialize cache:', error);
    // Fail fast if we cannot initialize the cache to avoid running in a degraded state
    process.exit(1);
  }

  // Create MCP server
  const server = new Server(
    {
      name: 'synapseha',
      version: '1.0.0',
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  // Register all tools
  const tools = registerTools(haClient, cacheManager, fuzzySearcher, nameResolver);

  // Handle list tools request
  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: tools.map(t => t.definition),
  }));

  // Handle call tool request
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const tool = tools.find(t => t.definition.name === request.params.name);
    if (!tool) {
      throw new Error(`Unknown tool: ${request.params.name}`);
    }

    try {
      const result = await tool.handler(request.params.arguments || {});
      return {
        content: [
          {
            type: 'text',
            text: typeof result === 'string' ? result : JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (error: any) {
      return {
        content: [
          {
            type: 'text',
            text: `Error: ${error.message || String(error)}`,
          },
        ],
        isError: true,
      };
    }
  });

  // Start server
  const transport = new StdioServerTransport();
  await server.connect(transport);

  console.error('SynapseHA MCP Server running');

  // Cleanup on exit
  process.on('SIGINT', () => {
    console.error('Shutting down...');
    cacheManager.shutdown();
    process.exit(0);
  });
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});

#!/usr/bin/env node
/**
 * HTTP/SSE server for SynapseHA - designed for Home Assistant add-on deployment.
 * This provides an HTTP endpoint for MCP clients to connect to.
 */
import express from 'express';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { HomeAssistantClient } from './lib/ha-client.js';
import { CacheManager } from './lib/cache.js';
import { FuzzySearcher } from './lib/fuzzy-search.js';
import { NameResolver } from './lib/name-resolver.js';
import { logger } from './lib/logger.js';
import { toolDefinitions, createToolHandlers } from './tools/http-tools.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const HA_URL = process.env.HA_URL || process.env.HASS_URL || 'http://homeassistant.local:8123';
const HA_TOKEN = process.env.HA_TOKEN || process.env.HASS_TOKEN || process.env.SUPERVISOR_TOKEN || '';
const CACHE_DIR = process.env.CACHE_DIR || './cache';
const CACHE_TTL = parseInt(process.env.CACHE_TTL || '60000', 10);
const HTTP_PORT = parseInt(process.env.HTTP_PORT || '3000', 10);
const BEARER_TOKEN = process.env.BEARER_TOKEN || '';
const REQUIRE_AUTH = process.env.REQUIRE_AUTH === 'true';
const CACHE_REFRESH_INTERVAL = parseInt(process.env.CACHE_REFRESH_INTERVAL || '60', 10) * 1000;

if (!HA_TOKEN) {
  logger.error('Error: HA_TOKEN (or HASS_TOKEN or SUPERVISOR_TOKEN) environment variable is required');
  process.exit(1);
}

// Store active transports by session ID with timestamps for cleanup
const transports: Record<string, { transport: SSEServerTransport; lastActivity: number }> = {};

// Cleanup interval for stale transports (5 minutes)
const TRANSPORT_TIMEOUT_MS = 5 * 60 * 1000;
const CLEANUP_INTERVAL_MS = 60 * 1000;

// Shared components
let haClient: HomeAssistantClient;
let cacheManager: CacheManager;
let fuzzySearcher: FuzzySearcher;
let nameResolver: NameResolver;

function createServer(): McpServer {
  const server = new McpServer(
    {
      name: 'synapseha',
      version: '1.0.0',
    },
    {
      capabilities: {
        tools: {},
        logging: {},
      },
    }
  );

  // Register all tools using McpServer's registerTool method
  const handlers = createToolHandlers(haClient, cacheManager, fuzzySearcher, nameResolver);
  
  for (const toolDef of toolDefinitions) {
    server.registerTool(
      toolDef.name,
      {
        description: toolDef.description,
        inputSchema: toolDef.inputSchema,
      },
      handlers[toolDef.name]
    );
  }

  return server;
}

// Authentication middleware
function authMiddleware(req: express.Request, res: express.Response, next: express.NextFunction): void {
  // Skip auth if not required
  if (!REQUIRE_AUTH) {
    next();
    return;
  }

  // Validate that a bearer token is configured when auth is required
  if (!BEARER_TOKEN) {
    logger.error('Authentication is required but no bearer token is configured');
    res.status(500).json({ error: 'Server misconfiguration: authentication required but no token configured' });
    return;
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Authorization header with Bearer token required' });
    return;
  }

  const token = authHeader.substring(7);
  if (token !== BEARER_TOKEN) {
    res.status(403).json({ error: 'Invalid bearer token' });
    return;
  }

  next();
}

// Cleanup stale transports to prevent memory leaks
function cleanupStaleTransports(): void {
  const now = Date.now();
  for (const sessionId in transports) {
    const entry = transports[sessionId];
    if (now - entry.lastActivity > TRANSPORT_TIMEOUT_MS) {
      logger.info(`Cleaning up stale transport for session ${sessionId}`);
      try {
        entry.transport.close();
      } catch (error) {
        logger.error(`Error closing stale transport for session ${sessionId}:`, error);
      }
      delete transports[sessionId];
    }
  }
}

async function gracefulShutdown(): Promise<void> {
  logger.info('Shutting down...');
  for (const sessionId in transports) {
    try {
      await transports[sessionId].transport.close();
      delete transports[sessionId];
    } catch (error) {
      logger.error(`Error closing transport for session ${sessionId}:`, error);
    }
  }
  cacheManager.shutdown();
  process.exit(0);
}

async function main() {
  logger.info('Starting SynapseHA HTTP/SSE Server...');

  // Initialize components
  haClient = new HomeAssistantClient(HA_URL, HA_TOKEN);
  cacheManager = new CacheManager(CACHE_DIR, CACHE_TTL);
  fuzzySearcher = new FuzzySearcher();
  nameResolver = new NameResolver();

  await cacheManager.init();

  // Initialize cache with entity states and auto-refresh
  logger.info('Initializing cache and auto-refresh...');
  try {
    const entities = await haClient.getStates();
    await cacheManager.set('entities', entities);
    fuzzySearcher.setEntities(entities);
    nameResolver.setEntities(entities);

    // Auto-refresh entities using configured interval
    cacheManager.registerAutoRefresh('entities', async () => {
      const newEntities = await haClient.getStates();
      fuzzySearcher.setEntities(newEntities);
      nameResolver.setEntities(newEntities);
      return newEntities;
    }, CACHE_REFRESH_INTERVAL);

    // Load devices and areas
    const devices = await haClient.getDevices();
    await cacheManager.set('devices', devices);
    fuzzySearcher.setDevices(devices);
    nameResolver.setDevices(devices);

    const areas = await haClient.getAreas();
    await cacheManager.set('areas', areas);
    fuzzySearcher.setAreas(areas);
    nameResolver.setAreas(areas);

    logger.info('Cache initialized successfully');
  } catch (error) {
    logger.error('Error: Failed to initialize cache:', error);
    process.exit(1);
  }

  // Create Express app
  const app = express();
  app.use(express.json());

  // Health check endpoint (no auth required)
  app.get('/health', (_req, res) => {
    res.json({ 
      status: 'ok', 
      name: 'synapseha',
      version: '1.0.0',
      sessions: Object.keys(transports).length
    });
  });

  // SSE endpoint for establishing the stream (auth required if configured)
  app.get('/mcp', authMiddleware, async (req, res) => {
    logger.info('Received GET request to /mcp (establishing SSE stream)');
    try {
      const transport = new SSEServerTransport('/messages', res);
      const sessionId = transport.sessionId;
      transports[sessionId] = { transport, lastActivity: Date.now() };

      transport.onclose = () => {
        logger.info(`SSE transport closed for session ${sessionId}`);
        delete transports[sessionId];
      };

      const server = createServer();
      await server.connect(transport);
      logger.info(`Established SSE stream with session ID: ${sessionId}`);
    } catch (error) {
      logger.error('Error establishing SSE stream:', error);
      if (!res.headersSent) {
        res.status(500).send('Error establishing SSE stream');
      }
    }
  });

  // Messages endpoint for receiving client JSON-RPC requests (auth required if configured)
  app.post('/messages', authMiddleware, async (req, res) => {
    const sessionId = req.query.sessionId as string;
    if (!sessionId) {
      logger.error('No session ID provided in request URL');
      res.status(400).send('Missing sessionId parameter');
      return;
    }

    const entry = transports[sessionId];
    if (!entry) {
      logger.error(`No active transport found for session ID: ${sessionId}`);
      res.status(404).send('Session not found');
      return;
    }

    // Update last activity timestamp
    entry.lastActivity = Date.now();

    try {
      await entry.transport.handlePostMessage(req, res, req.body);
    } catch (error) {
      logger.error('Error handling request:', error);
      if (!res.headersSent) {
        res.status(500).send('Error handling request');
      }
    }
  });

  // Start periodic cleanup of stale transports
  setInterval(cleanupStaleTransports, CLEANUP_INTERVAL_MS);

  // Start the server
  app.listen(HTTP_PORT, () => {
    logger.info(`SynapseHA HTTP/SSE Server listening on port ${HTTP_PORT}`);
    logger.info(`  Health check: http://localhost:${HTTP_PORT}/health`);
    logger.info(`  MCP endpoint: http://localhost:${HTTP_PORT}/mcp`);
    if (REQUIRE_AUTH) {
      logger.info(`  Authentication: Required (Bearer token)`);
    }
  });

  // Cleanup on exit - handle both SIGINT and SIGTERM
  process.on('SIGINT', gracefulShutdown);
  process.on('SIGTERM', gracefulShutdown);
}

main().catch((error) => {
  logger.error('Fatal error:', error);
  process.exit(1);
});

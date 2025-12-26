# Troubleshooting Guide

Common issues and solutions for SynapseHA.

## Installation Issues

### npm install fails

**Problem:** Dependencies won't install

**Solutions:**
1. Check Node.js version: `node --version` (needs 18+)
2. Clear npm cache: `npm cache clean --force`
3. Delete node_modules and package-lock.json, then reinstall
4. Check network connectivity

### TypeScript compilation errors

**Problem:** `npm run build` fails

**Solutions:**
1. Ensure TypeScript is installed: `npm install -D typescript`
2. Check tsconfig.json is present
3. Delete dist/ folder and rebuild
4. Verify all source files are valid TypeScript

## Connection Issues

### "HA_TOKEN environment variable is required"

**Problem:** Server won't start without token

**Solution:**
1. Get a token from Home Assistant (Profile → Long-Lived Access Tokens)
2. Set environment variable: `export HA_TOKEN="your_token"`
3. Or use .env file (see .env.example)

### "Connection refused" or "ECONNREFUSED"

**Problem:** Can't connect to Home Assistant

**Solutions:**
1. Verify HA_URL is correct: `echo $HA_URL`
2. Check Home Assistant is running and accessible
3. Try accessing HA_URL in browser
4. Check firewall settings
5. Verify network connectivity between server and HA

### "Unauthorized" or 401 errors

**Problem:** Authentication fails

**Solutions:**
1. Verify token is valid in Home Assistant
2. Token might have been revoked - create a new one
3. Check for extra spaces in token
4. Ensure token has necessary permissions

## Runtime Issues

### Cache not working or slow responses

**Problem:** Responses are slow even after first request

**Solutions:**
1. Check CACHE_DIR exists and is writable
2. Verify sufficient disk space
3. Check cache files in cache/ directory
4. Clear cache manually if corrupted
5. Check CACHE_TTL setting

### "Entity not found" errors

**Problem:** Can't find entity even though it exists

**Solutions:**
1. Verify entity exists in Home Assistant
2. Check entity_id spelling
3. Try using fuzzy search: `search_entities` tool
4. Entity might be disabled in HA
5. Cache might be stale - wait for auto-refresh or restart server

### Fuzzy search not finding entities

**Problem:** Search returns no results

**Solutions:**
1. Check query spelling
2. Try shorter search term
3. Use domain filter with `list_entities`
4. Verify entities are loaded: check server startup logs
5. Entity might not have friendly_name attribute

## Tool-Specific Issues

### Light control not working

**Problem:** `control_light` fails

**Possible causes:**
1. Entity is not a light (check with `get_entity_state`)
2. Light doesn't support requested feature (brightness, color)
3. Light is unavailable
4. Parameters out of range (brightness: 0-255, RGB: 0-255)

### Climate control issues

**Problem:** `control_climate` fails

**Possible causes:**
1. HVAC mode not supported by device
2. Temperature out of min/max range for device
3. Device is offline
4. Fan mode not available on device

### Media player commands fail

**Problem:** `control_media_player` doesn't work

**Possible causes:**
1. Media player is in wrong state (e.g., can't play when off)
2. Command not supported by specific player
3. Source name doesn't match exactly
4. Volume range should be 0.0-1.0

### History/analytics tools timeout

**Problem:** Long-running analytics queries fail

**Possible causes:**
1. Time range too large - reduce hours parameter
2. Too many entities requested - reduce entity count
3. Home Assistant database slow - check HA performance
4. Network timeout - increase timeout in ha-client.ts

## Claude Desktop Integration Issues

### Server not showing in Claude

**Problem:** SynapseHA doesn't appear in Claude Desktop

**Solutions:**
1. Check claude_desktop_config.json syntax (must be valid JSON)
2. Verify path to dist/index.js is absolute and correct
3. Restart Claude Desktop completely
4. Check Claude Desktop logs for errors
5. Verify Node.js is in PATH

### Tools not appearing

**Problem:** Server connects but no tools available

**Solutions:**
1. Check server starts without errors
2. Verify build completed: check dist/ folder exists
3. Look for errors in server logs (console.error output)
4. Ensure HA_TOKEN is set in config
5. Try running server manually to see errors

### "Server disconnected" errors

**Problem:** Server keeps disconnecting

**Solutions:**
1. Check server logs for crashes
2. Verify Home Assistant connection is stable
3. Increase timeouts if on slow network
4. Check for resource constraints (memory, CPU)
5. Restart both server and Claude Desktop

## Performance Issues

### High memory usage

**Problem:** Server uses too much memory

**Solutions:**
1. Reduce CACHE_TTL to clear cache more frequently
2. Limit entity count in responses
3. Restart server periodically
4. Check for memory leaks in Home Assistant

### Slow responses

**Problem:** All requests are slow (>1 second)

**Possible causes:**
1. Cache disabled or not working
2. Home Assistant instance slow
3. Network latency high
4. Large entity count (>5000 entities)
5. History queries with large time ranges

**Solutions:**
1. Enable and verify cache is working
2. Reduce query scope (fewer entities, shorter time ranges)
3. Optimize Home Assistant database
4. Use faster network connection

## Development Issues

### Watch mode not working

**Problem:** `npm run watch` doesn't detect changes

**Solutions:**
1. Check file system events are supported
2. Try manual rebuild: `npm run build`
3. Restart watch mode
4. Check for permission issues

### TypeScript errors in editor

**Problem:** IDE shows errors but build succeeds

**Solutions:**
1. Restart TypeScript server in IDE
2. Check IDE uses project's TypeScript version
3. Delete .d.ts files and rebuild
4. Verify tsconfig.json is correct

## Getting Help

If your issue isn't listed here:

1. Check server logs (console.error output)
2. Enable debug logging in Home Assistant
3. Test Home Assistant API directly with curl
4. Check GitHub issues for similar problems
5. Create new issue with:
   - Error messages
   - Server logs
   - Home Assistant version
   - Node.js version
   - Steps to reproduce

## Debug Mode

For additional debugging, you can:

1. Run server directly (not through Claude):
```bash
node dist/index.js
```

2. Add console.log statements in code

3. Check Home Assistant logs:
```bash
# In Home Assistant
Settings → System → Logs
```

4. Test API calls manually:
```bash
curl -H "Authorization: Bearer $HA_TOKEN" \
     -H "Content-Type: application/json" \
     $HA_URL/api/states
```

## Emergency Recovery

If server is completely broken:

1. Delete cache/: `rm -rf cache/`
2. Delete node_modules/: `rm -rf node_modules/`
3. Delete dist/: `rm -rf dist/`
4. Reinstall: `npm install`
5. Rebuild: `npm run build`
6. Test with fresh token from Home Assistant

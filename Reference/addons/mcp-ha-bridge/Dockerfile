# MCP Home Assistant Bridge Add-on
ARG BUILD_FROM
FROM ${BUILD_FROM}

# Install additional dependencies
RUN apk add --no-cache \
    curl \
    jq \
    bash

# Set working directory
WORKDIR /app

# Copy package files first for better Docker layer caching
COPY package.json package-lock.json* ./

# Install production dependencies
RUN npm ci --only=production --ignore-scripts 2>/dev/null || npm install --only=production --ignore-scripts

# Copy application files
COPY server.js ./
COPY www/ ./www/

# Copy entrypoint script
COPY run.sh /run.sh
RUN chmod a+x /run.sh

# Create data directory for cache persistence
RUN mkdir -p /data

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:${HTTP_PORT:-3000}/health || exit 1

# Labels
LABEL \
    io.hass.name="MCP Home Assistant Bridge" \
    io.hass.description="MCP server for Home Assistant LLM integration" \
    io.hass.type="addon" \
    io.hass.version="1.0.0"

# Entry point
CMD [ "/run.sh" ]

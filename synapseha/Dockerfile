# SynapseHA Add-on
ARG BUILD_FROM
FROM ${BUILD_FROM}

# Install additional dependencies
RUN apk add --no-cache \
    curl \
    jq \
    bash \
    git

# Set working directory
WORKDIR /app

# Clone the repository at build time to get the latest source
ARG BUILD_VERSION=1.0.0
RUN git clone --depth 1 --branch main https://github.com/hellosamblack/SynapseHA.git /tmp/synapseha && \
    cp /tmp/synapseha/package.json /tmp/synapseha/package-lock.json /app/ && \
    cp /tmp/synapseha/tsconfig.json /app/ && \
    cp -r /tmp/synapseha/src /app/src && \
    rm -rf /tmp/synapseha

# Install production dependencies
RUN npm ci --only=production 2>/dev/null || npm install --only=production

# Install dev dependencies for build, compile TypeScript, then remove dev deps
RUN npm install --only=development && \
    npm run build && \
    rm -rf node_modules && \
    npm ci --only=production 2>/dev/null || npm install --only=production

# Copy entrypoint script
COPY run.sh /run.sh
RUN chmod a+x /run.sh

# Create data directory for cache persistence
RUN mkdir -p /data

# Health check - using the HTTP server's health endpoint
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:${HTTP_PORT:-3000}/health || exit 1

# Labels
LABEL \
    io.hass.name="SynapseHA" \
    io.hass.description="MCP server for Home Assistant providing 21 tools for LLM-driven control and maintenance" \
    io.hass.type="addon" \
    io.hass.version="1.0.0"

# Entry point
CMD [ "/run.sh" ]

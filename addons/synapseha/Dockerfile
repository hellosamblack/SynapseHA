# SynapseHA Add-on
ARG BUILD_FROM
FROM ${BUILD_FROM}

# Install additional dependencies
RUN apk add --no-cache \
    curl \
    jq \
    bash \
    git \
    nodejs \
    npm

# Set working directory
WORKDIR /app

# Copy application files from the repository root (context set in build.yaml)
COPY package.json package-lock.json tsconfig.json ./
COPY src ./src

# Install dependencies, build, then prune dev dependencies to keep only production deps
RUN npm ci 2>/dev/null || npm install && \
    npm run build && \
    npm prune --production

# Copy entrypoint script from the add-on directory
COPY addons/synapseha/run.sh /run.sh
RUN chmod a+x /run.sh

# Create data directory for cache persistence
RUN mkdir -p /data

# Default HTTP port for the application
ENV HTTP_PORT=3000

# Health check - using the HTTP server's health endpoint
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:3000/health || exit 1

# Labels
LABEL \
    io.hass.name="SynapseHA" \
    io.hass.description="MCP server for Home Assistant providing 21 tools for LLM-driven control and maintenance" \
    io.hass.type="addon" \
    io.hass.version="1.0.0"

# Entry point
CMD [ "/run.sh" ]

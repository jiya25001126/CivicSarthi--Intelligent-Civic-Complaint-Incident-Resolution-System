# CivicSarthi Backend — Production Dockerfile
# Stage 1: Build & Dependencies
FROM node:20-alpine AS dependencies
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

# Stage 2: Production Runtime
FROM node:20-alpine AS runtime
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=5000

# Install curl for container health check
RUN apk add --no-cache curl

# Run as unprivileged user
USER node

# Copy dependencies and application code
COPY --chown=node:node --from=dependencies /app/node_modules ./node_modules
COPY --chown=node:node package*.json ./
COPY --chown=node:node src/ ./src/
COPY --chown=node:node data/ ./data/

EXPOSE 5000

# Health check using native endpoint
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:5000/api/health/live || exit 1

CMD ["node", "src/server.js"]

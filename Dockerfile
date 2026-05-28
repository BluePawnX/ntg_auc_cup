# NTG Tournament Platform — single-service production image.
# Builds the client, then runs the server which serves the built client +
# the API + the public hub, all on one port. Provide MONGO_URI and JWT_SECRET
# as environment variables at runtime.

# 1) Build the client (Vite → static files in client/dist)
FROM node:20-alpine AS client
WORKDIR /app/client
COPY client/package*.json ./
RUN npm ci
COPY client/ ./
RUN npm run build

# 2) Server image with the built client copied in
FROM node:20-alpine
WORKDIR /app/server
COPY server/package*.json ./
RUN npm ci --omit=dev
COPY server/ ./
COPY --from=client /app/client/dist /app/client/dist
ENV NODE_ENV=production
# The host (Render/Railway/etc.) sets PORT; the server reads process.env.PORT.
EXPOSE 4000
CMD ["node", "src/index.js"]

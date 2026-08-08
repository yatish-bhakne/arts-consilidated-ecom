# --- deps: install all dependencies once, reused by build and (implicitly) cached by later stages ---
FROM node:20-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# --- build: generate the Prisma client and compile TypeScript to plain JS ---
FROM node:20-slim AS build
WORKDIR /app
# Prisma's query engine binary is compiled against a specific OpenSSL version
# and probes the OS for it at `generate` time; node:20-slim doesn't ship
# libssl by default, so left alone Prisma silently guesses and warns.
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
COPY --from=deps /app/node_modules ./node_modules
COPY package.json package-lock.json ./
COPY prisma ./prisma
COPY tsconfig.json tsconfig.build.json ./
COPY src ./src
COPY scripts ./scripts
RUN npm run build

# --- runtime: slim image with only production deps + compiled output, no source TS, no dev tooling ---
FROM node:20-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY prisma ./prisma
RUN npx prisma generate
COPY --from=build /app/dist ./dist

EXPOSE 3000
CMD ["node", "dist/src/server.js"]

FROM node:20-slim
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends curl && rm -rf /var/lib/apt/lists/*

# Copy package files and install ALL deps (including typescript for build)
COPY package.deploy.json ./package.json
RUN npm install

# Copy source
COPY src/ ./src/
COPY tsconfig.json ./

# Compile ONLY bot.ts and index.ts
RUN npx tsc --outDir dist --esModuleInterop --resolveJsonModule --skipLibCheck --module commonjs --target es2020 src/index.ts src/bot.ts

# Remove devDependencies after build
RUN npm prune --production

# Non-root user
RUN useradd -m -u 1000 user && chown -R user:user /app
USER user

EXPOSE 3000
ENV PORT=3000
ENV NODE_ENV=production

HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

CMD ["node", "dist/index.js"]

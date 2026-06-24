FROM node:20-slim
WORKDIR /app

# Install curl for health checks
RUN apt-get update && apt-get install -y --no-install-recommends curl && rm -rf /var/lib/apt/lists/*

# Copy package files and install deps
COPY package*.json ./
RUN npm install

# Copy source
COPY src/ ./src/
COPY tsconfig.json ./

# Compile TypeScript (bot + index only — no Prisma needed for AI bot)
RUN npx tsc --outDir dist --esModuleInterop --resolveJsonModule --skipLibCheck --module commonjs --target es2020 src/index.ts src/bot.ts

# Create non-root user (required by HF Spaces, SnapDeploy, etc.)
RUN useradd -m -u 1000 user && chown -R user:user /app
USER user

# Expose port (HF Spaces uses 7860 by default, but we set app_port in README)
EXPOSE 3000
ENV PORT=3000
ENV NODE_ENV=production

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

CMD ["node", "dist/index.js"]

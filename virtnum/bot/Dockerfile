FROM node:20-slim
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends curl && rm -rf /var/lib/apt/lists/*

# Copy minimal package.json and install
COPY package.deploy.json ./package.json
RUN npm install --production

# Copy pre-compiled dist (no build step!)
COPY dist/ ./dist/

# Non-root user
RUN useradd -m -u 1000 user && chown -R user:user /app
USER user

EXPOSE 3000
ENV PORT=3000
ENV NODE_ENV=production

HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

CMD ["node", "dist/index.js"]

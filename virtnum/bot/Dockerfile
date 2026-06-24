FROM node:20-slim
WORKDIR /app
COPY package.deploy.json ./package.json
RUN npm install --production
COPY dist/ ./dist/
EXPOSE 3000
ENV PORT=3000
CMD ["node", "dist/index.js"]

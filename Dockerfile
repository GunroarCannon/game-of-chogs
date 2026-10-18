# Game of Chogs: one container serves the built client and the API.
FROM node:22-slim AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN test -f data/genesis.json || (echo "data/genesis.json missing: run node scripts/fetch-genesis.mjs" && exit 1)
RUN npm run build && npm prune --omit=dev

FROM node:22-slim
WORKDIR /app
ENV NODE_ENV=production PORT=8080 DATA_DIR=/data
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/server ./server
COPY --from=build /app/shared ./shared
COPY --from=build /app/data ./data
COPY --from=build /app/contracts/out ./contracts/out
COPY --from=build /app/package.json ./
RUN mkdir -p /data
EXPOSE 8080
CMD ["node", "server/index.js"]

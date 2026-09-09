FROM node:24-alpine AS build
ARG SERVICE_VERSION=development
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
ARG DATABASE_URL=postgresql://build:build@127.0.0.1:5432/build
ENV DATABASE_URL=$DATABASE_URL
ENV SERVICE_VERSION=$SERVICE_VERSION
RUN npm run build

FROM node:24-alpine AS runtime
WORKDIR /app
ENV APP_ENV=production NODE_ENV=production
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/.next ./.next
COPY --from=build /app/dist ./dist
COPY --from=build /app/app ./app
COPY --from=build /app/next.config.ts ./next.config.ts
USER node
EXPOSE 3000
STOPSIGNAL SIGTERM
HEALTHCHECK --interval=15s --timeout=3s --start-period=20s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1:3000/health/live || exit 1
CMD ["node", "dist/server/index.js"]

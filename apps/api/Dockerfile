FROM node:24-alpine AS build
WORKDIR /workspace
ENV DATABASE_URL=mysql://cloudbridge:build-only@localhost:3306/cloudbridge
ENV SHADOW_DATABASE_URL=mysql://cloudbridge:build-only@localhost:3306/cloudbridge_shadow
COPY package.json package-lock.json tsconfig.base.json ./
COPY packages/contracts/package.json packages/contracts/tsconfig*.json ./packages/contracts/
COPY packages/contracts/src ./packages/contracts/src
COPY apps/api/package.json apps/api/tsconfig*.json apps/api/prisma.config.ts ./apps/api/
COPY apps/api/scripts/generate.mjs ./apps/api/scripts/generate.mjs
COPY apps/api/prisma ./apps/api/prisma
RUN --mount=type=cache,target=/root/.npm npm ci --prefer-offline --no-audit --no-fund
COPY apps/api/src ./apps/api/src
RUN npm run build --workspace @cloudbridge/contracts \
  && npm run db:generate --workspace @cloudbridge/api \
  && npm run build --workspace @cloudbridge/api

FROM node:24-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /workspace
COPY --from=build /workspace/package.json /workspace/package-lock.json ./
COPY --from=build /workspace/node_modules ./node_modules
COPY --from=build /workspace/apps/api/package.json ./apps/api/package.json
COPY --from=build /workspace/apps/api/dist ./apps/api/dist
COPY --from=build /workspace/apps/api/prisma ./apps/api/prisma
COPY --from=build /workspace/apps/api/prisma.config.ts ./apps/api/prisma.config.ts
COPY apps/api/scripts ./apps/api/scripts
WORKDIR /workspace/apps/api
EXPOSE 3001
CMD ["node", "dist/src/main.js"]

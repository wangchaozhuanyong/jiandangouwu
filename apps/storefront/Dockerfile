FROM node:24-alpine AS build
WORKDIR /workspace
ARG NEXT_PUBLIC_API_BASE_URL=/v1
ENV NEXT_PUBLIC_API_BASE_URL=$NEXT_PUBLIC_API_BASE_URL
COPY package.json package-lock.json tsconfig.base.json ./
COPY packages/contracts/package.json packages/contracts/tsconfig*.json ./packages/contracts/
COPY packages/contracts/src ./packages/contracts/src
COPY apps/storefront/package.json apps/storefront/tsconfig.json apps/storefront/next-env.d.ts apps/storefront/next.config.ts ./apps/storefront/
COPY apps/storefront/app ./apps/storefront/app
COPY apps/storefront/components ./apps/storefront/components
COPY apps/storefront/lib ./apps/storefront/lib
COPY apps/storefront/public ./apps/storefront/public
RUN npm ci
RUN npm run build --workspace @cloudbridge/contracts \
  && npm run build --workspace @cloudbridge/storefront

FROM node:24-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /workspace
COPY --from=build /workspace/package.json /workspace/package-lock.json ./
COPY --from=build /workspace/node_modules ./node_modules
COPY --from=build /workspace/apps/storefront ./apps/storefront
WORKDIR /workspace/apps/storefront
EXPOSE 3000
CMD ["npm", "run", "start"]

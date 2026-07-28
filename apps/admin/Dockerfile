FROM node:24-alpine AS build
WORKDIR /workspace
ARG VITE_ADMIN_API_BASE_URL=/v1
ARG VITE_BASE_PATH=/admin/
ENV VITE_ADMIN_API_BASE_URL=$VITE_ADMIN_API_BASE_URL
ENV VITE_BASE_PATH=$VITE_BASE_PATH
COPY package.json package-lock.json tsconfig.base.json ./
COPY packages/contracts/package.json packages/contracts/tsconfig*.json ./packages/contracts/
COPY packages/contracts/src ./packages/contracts/src
COPY apps/admin/package.json apps/admin/tsconfig*.json apps/admin/vite.config.ts apps/admin/index.html ./apps/admin/
COPY apps/admin/src ./apps/admin/src
COPY apps/admin/public ./apps/admin/public
RUN npm ci
RUN npm run build --workspace @cloudbridge/contracts \
  && npm run build --workspace @cloudbridge/admin

FROM nginx:1.29-alpine
COPY apps/admin/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /workspace/apps/admin/dist /usr/share/nginx/html/admin
EXPOSE 8080

# Stage 1: Development (used by docker-compose with target: dev)
FROM node:22-alpine AS dev

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install

COPY . .

# Dev server runs via docker-compose command override
EXPOSE 5173

# Stage 2: Build
FROM dev AS build

RUN npm run build

# Stage 3: Serve production assets
FROM nginx:alpine

COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]

# -----------------------
# Build stage
# -----------------------
FROM node:lts-slim AS builder

WORKDIR /usr/src/app

COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile

COPY . .
RUN yarn build


# -----------------------
# Production stage
# -----------------------
FROM node:lts-slim AS production

ENV NODE_ENV=production
WORKDIR /usr/src/app

COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile --production

COPY --from=builder /usr/src/app/dist ./dist

EXPOSE 3000

CMD ["node", "dist/main.js"]

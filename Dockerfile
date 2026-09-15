FROM node:24-alpine

ARG VERSION=dev
LABEL org.opencontainers.image.version=$VERSION

ENV NODE_ENV=production

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

USER node

EXPOSE 3000

CMD ["node", "src/index.js"]

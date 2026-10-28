FROM node:24-alpine

RUN apk add --no-cache openssl

WORKDIR /app
RUN chown node:node /app
USER node

COPY --chown=node:node package.json package-lock.json ./
RUN npm ci --omit=dev

COPY --chown=node:node prisma ./prisma
RUN npx prisma generate

COPY --chown=node:node src ./src
COPY --chown=node:node docker-entrypoint.sh ./
RUN sed -i 's/\r$//' docker-entrypoint.sh && chmod +x docker-entrypoint.sh

ENV NODE_ENV=production
EXPOSE 3001

ENTRYPOINT ["./docker-entrypoint.sh"]
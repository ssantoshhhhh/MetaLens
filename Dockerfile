FROM node:24-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends libimage-exiftool-perl && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV EXIFTOOL_PATH=/usr/bin/exiftool NEXT_TELEMETRY_DISABLED=1
COPY package.json package-lock.json prisma.config.ts ./
COPY prisma ./prisma
RUN npm ci
COPY . .
RUN npm run build && chown -R node:node /app/.next
USER node
EXPOSE 3000
CMD ["sh", "-c", "if [ -n \"$DATABASE_URL\" ]; then npx prisma migrate deploy; fi; exec npm start"]

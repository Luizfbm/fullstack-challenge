FROM oven/bun:1-alpine

WORKDIR /app

COPY package.json ./
COPY prisma ./prisma
RUN bun install
RUN bun run db:generate

COPY . .

EXPOSE 4002

CMD ["sh", "-c", "bun run db:deploy && bun run src/main.ts"]

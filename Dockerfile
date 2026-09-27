FROM node:22-bookworm-slim

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

COPY . .

EXPOSE 5173

# npm ci also updates the dependency volume after package-lock.json changes.
CMD ["sh", "-c", "npm ci --no-audit --no-fund && exec npm run dev -- --host 0.0.0.0 --port 5173 --strictPort"]

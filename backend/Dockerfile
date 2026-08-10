FROM node:22-slim

# better-sqlite3 compila nativo se não houver binário pré-buildado pra essa
# plataforma; python3/make/g++ garantem que o build funcione de qualquer jeito.
RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev

COPY . .

RUN mkdir -p /app/data

ENV PORT=3000
ENV DB_PATH=/app/data/pdv.db

EXPOSE 3000
VOLUME ["/app/data"]

CMD ["node", "server.js"]

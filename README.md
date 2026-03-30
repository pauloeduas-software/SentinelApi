# SentinelApi - O Cérebro e Ingestão

A **SentinelApi** é a camada central do ecossistema, responsável por receber a telemetria dos agentes e servir os dados para o painel de controle.

## Funções Principais
- **Ingestão WebSocket:** Handshake e recebimento de telemetria em tempo real via Fastify WebSocket.
- **Persistência Relacional:** Gerenciamento de ativos e logs históricos usando PostgreSQL e Prisma.
- **API REST:** Endpoints para listagem e filtragem de ativos.

## Tecnologias
- Node.js & TypeScript
- Fastify (Web Server)
- Prisma (ORM)
- PostgreSQL

## Como Rodar
1. Instale as dependências: `npm install`
2. Configure o `DATABASE_URL` no arquivo `.env`.
3. Execute as migrations: `npx prisma migrate dev`
4. Inicie o servidor:
   ```bash
   npx ts-node src/server.ts
   ```

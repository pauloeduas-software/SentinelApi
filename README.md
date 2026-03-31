# SentinelApi - O Cérebro e Ingestão

A **SentinelApi** é a central de inteligência que gerencia o estado da frota e despacha comandos para os agentes em tempo real.

## Novas Funcionalidades (v2.0)
- **Pool de Conexões Ativas:** Gerenciamento em memória (`Map`) de todos os HWIDs conectados para despacho instantâneo.
- **Endpoint de Comando:** Rota POST `/api/assets/:hwid/command` para orquestração remota via Dashboard.
- **Persistência ITAM:** Armazenamento estruturado de MAC, IP e listas dinâmicas de Software (JSONB).

## Tecnologias
- Node.js & TypeScript
- Fastify v5 & WebSocket v11
- Prisma & PostgreSQL

## Como Rodar
1. `npm install`
2. `npx prisma migrate dev`
3. `npx ts-node src/server.ts`

# SentinelApi - O Cérebro e Ingestão (Sentinel v2.0)

A **SentinelApi** é o ponto de convergência de todos os dados do ecossistema Sentinel. É uma API de alta escalabilidade desenvolvida para lidar com conexões WebSocket persistentes e servir dados estruturados de inventário para o Dashboard.

## 🚀 Funcionalidades Principais

### 1. Ingestão WebSocket Bidirecional
- **Handshake ITAM**: Processa identidades de hardware e listas de software, realizando `upsert` inteligente no banco de dados.
- **Telemetria Contínua**: Recebe e persiste dados de CPU, RAM e Storage JSON em alta frequência.
- **Active Pool Management**: Mantém um mapa em memória (`HWID -> WebSocket`) para permitir o envio de comandos instantâneos para os agentes.

### 2. Orquestração de Comandos (RMM)
- **Command Dispatcher**: Rota REST que ponteia ordens de controle (Reboot, Shutdown) para o túnel WebSocket aberto do agente correspondente.

### 3. Camada de Persistência Relacional
- **Modelagem Robusta**: Uso de PostgreSQL para garantir integridade referencial entre Ativos e suas telemetrias.
- **Suporte JSONB**: Armazenamento flexível de lista de softwares e estruturas de disco.

## 🛠️ Stack Tecnológica
- **Runtime**: Node.js v20+
- **Linguagem**: TypeScript
- **Web Framework**: Fastify v5 (Arquitetura assíncrona)
- **Database**: PostgreSQL
- **ORM**: Prisma (Segurança de tipos e migrations)

## 📁 Estrutura do Projeto
- `src/server.ts`: Bootstrap do servidor, registro de plugins e lógica de rotas.
- `prisma/schema.prisma`: Definição de modelos de dados e relações.
- `src/types/`: Interfaces compartilhadas para resiliência de chaves (PascalCase/camelCase).

## ⚙️ Como Rodar
1. **Instalação**: `npm install`
2. **Banco de Dados**: Configure o `DATABASE_URL` no `.env` e rode `npx prisma migrate dev`.
3. **Execução**:
   ```bash
   npx ts-node src/server.ts
   ```

## 🔒 Segurança e Resiliência
- **CORS Habilitado**: Configurado para integração segura com o frontend React.
- **BigInt JSON Hack**: Implementação global para garantir que dados de memória RAM (grandes inteiros) sejam transmitidos sem erros no JSON.
- **Error Handling**: Blocos try-catch isolados por evento para garantir que um agente malformado não derrube o servidor.

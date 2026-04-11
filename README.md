# Sentinel Central API 🌉
> **Real-time Orchestration Hub & Data Persistence Layer**

![Node.js](https://img.shields.io/badge/Node.js-20.x-339933?logo=node.js)
![Fastify](https://img.shields.io/badge/Fastify-5.x-black?logo=fastify)
![Prisma](https://img.shields.io/badge/Prisma-ORM-2D3748?logo=prisma)

A **Sentinel API** serve como o sistema nervoso central, unificando a ingestão de dados em tempo real via WebSockets e o gerenciamento administrativo via REST.

## 📁 Estrutura do Projeto e Fluxo de Arquivos

### `src/`
*   **`server.ts`**: O coração da API. Configura o servidor Fastify, gerencia o ciclo de vida dos WebSockets, implementa o **Zombie Cleaner** (limpeza de agentes offline) e as rotas de comando.
*   **`prisma.config.ts`**: Define a configuração global do ORM e a integração com variáveis de ambiente.

### `prisma/`
*   **`schema.prisma`**: Definição do modelo de dados. Utiliza campos **JSONB** para `network`, `disks` e `topProcesses`, garantindo flexibilidade total para o Agente sem migrações pesadas.
*   **`migrations/`**: Histórico de alterações estruturais do banco de dados PostgreSQL.

## 📡 Fluxo de Comunicação
1.  **Ingestão:** O Agente envia um `TelemetryPacket` via WS.
2.  **Persistência:** O `server.ts` atualiza o `lastSeen` e salva as métricas brutas no PostgreSQL.
3.  **Comando:** O Web Dashboard envia um POST para `/api/assets/:hwid/command`. A API localiza o Socket ativo pelo HWID e dispara o comando instantaneamente.

## 📋 Requisitos
*   Node.js v22.x ou superior
*   PostgreSQL v16.x
*   Bun (Gerenciador de pacotes)

## ⚙️ Configuração Inicial

```bash
# 1. Instalar dependências
bun install

# 2. Sincronizar Banco de Dados
npx prisma db push

# 3. Iniciar a API
bun src/server.ts
```

import Fastify from 'fastify';
import websocket from '@fastify/websocket';
import cors from '@fastify/cors';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const server = Fastify({ logger: false });

// Hack global para serializar BigInt corretamente
(BigInt.prototype as any).toJSON = function () {
  return this.toString();
};

/**
 * Inicialização do Servidor e Registro de Rotas
 */
async function startServer() {
  // 1. Plugins
  await server.register(cors, { origin: '*' });
  await server.register(websocket);

  // 2. ROTA API: Listagem de Ativos para o Dashboard
  server.get('/api/assets', async () => {
    // Busca todos os assets incluindo apenas a telemetria mais recente de cada um
    const assets = await prisma.asset.findMany({
      include: {
        telemetries: {
          orderBy: { timestamp: 'desc' },
          take: 1
        }
      }
    });

    return assets;
  });

  // 3. ROTA WS: Ingestão de Dados dos Agentes
  server.get('/agent-hub', { websocket: true }, (socket, req) => {
    const clientId = req.socket.remoteAddress || 'Unknown';
    console.log(`\n[WS]: Agente Conectado em /agent-hub [${clientId}]`);

    socket.on('message', async (data: any) => {
      try {
        const message = JSON.parse(data.toString());
        const { Type, Payload } = message;

        const logHwid = Payload?.Hwid || Payload?.hwid || 'Desconhecido';
        console.log(`[RECEBIDO]: Tipo: ${Type} | HWID: ${logHwid.substring(0, 8)}`);

        if (Type === 'Handshake') {
          await handleHandshake(Payload);
        } else if (Type === 'Telemetry') {
          await handleTelemetry(Payload);
        }
      } catch (err) {
        console.error('[ERRO]: Falha ao processar mensagem do agente:', err);
      }
    });

    socket.on('close', () => {
      console.log(`[WS]: Agente Desconectado [${clientId}]`);
    });
  });

  // 4. Start do Servidor
  try {
    await server.listen({ port: 5000, host: '0.0.0.0' });
    console.log('🚀 Sentinel API Rodando em http://localhost:5000/agent-hub');
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

/**
 * Persistência: Handshake (Upsert)
 */
async function handleHandshake(payload: any) {
  const hwid = payload.Hwid || payload.hwid;
  const hostname = payload.Hostname || payload.hostname;
  const osVersion = payload.OsVersion || payload.osVersion;

  const asset = await prisma.asset.upsert({
    where: { hwid },
    update: {
      hostname,
      osVersion,
      status: 'ONLINE',
      lastSeen: new Date(),
    },
    create: {
      hwid,
      hostname,
      osVersion,
      status: 'ONLINE',
    },
  });

  console.log(`[BD]: Handshake Concluído. Ativo ID: ${asset.id}`);
}

/**
 * Persistência: Telemetry (Create)
 */
async function handleTelemetry(payload: any) {
  const hwid = payload.Hwid || payload.hwid;
  const cpuUsage = payload.CpuUsagePercentage || payload.cpuUsagePercentage;
  const ramTotal = payload.RamTotalBytes || payload.ramTotalBytes;
  const ramUsed = payload.RamUsedBytes || payload.ramUsedBytes;
  const disks = payload.DiskUsageBytes || payload.diskUsageBytes || payload.Disks || payload.disks || {};

  const asset = await prisma.asset.findUnique({
    where: { hwid },
    select: { id: true },
  });

  if (!asset) return;

  await prisma.telemetry.create({
    data: {
      assetId: asset.id,
      cpuUsage: cpuUsage,
      ramTotal: BigInt(ramTotal),
      ramUsed: BigInt(ramUsed),
      disks: disks,
    },
  });

  console.log(`[BD]: Telemetria Gravada para ${hwid.substring(0, 8)}`);
}

startServer();

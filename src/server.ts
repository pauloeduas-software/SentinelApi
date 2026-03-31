import Fastify from 'fastify';
import websocket from '@fastify/websocket';
import cors from '@fastify/cors';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const server = Fastify({ logger: false });

// Mapa global para gerenciar conexões ativas (HWID -> Socket)
const activeAgents = new Map<string, any>();

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

  // 2. ROTA API: Listagem de Ativos
  server.get('/api/assets', async () => {
    return await prisma.asset.findMany({
      include: {
        telemetries: {
          orderBy: { timestamp: 'desc' },
          take: 1
        }
      }
    });
  });

  // 3. ROTA API: Disparo de Comandos Remotos
  server.post('/api/assets/:hwid/command', async (request, reply) => {
    const { hwid } = request.params as { hwid: string };
    const { action } = request.body as { action: string };

    const socket = activeAgents.get(hwid);

    if (!socket) {
      return reply.status(404).send({ error: "Agente offline ou não encontrado." });
    }

    // Envelopa o comando para o Agente C#
    const commandPacket = JSON.stringify({
      Type: "Command",
      Payload: {
        Action: action,
        CommandId: crypto.randomUUID()
      }
    });

    socket.send(commandPacket);
    console.log(`[COMANDO]: ${action} enviado para o Agente ${hwid.substring(0, 8)}`);

    return { message: "Comando enviado com sucesso." };
  });

  // 4. ROTA WS: Ingestão e Controle
  server.get('/agent-hub', { websocket: true }, (socket, req) => {
    const clientId = req.socket.remoteAddress || 'Unknown';
    let currentHwid: string | null = null;

    console.log(`\n[WS]: Agente Conectado em /agent-hub [${clientId}]`);

    socket.on('message', async (data: any) => {
      try {
        const message = JSON.parse(data.toString());
        const { Type, Payload } = message;

        const hwid = Payload?.Hwid || Payload?.hwid;
        const logHwid = hwid || 'Desconhecido';

        if (Type === 'Handshake' && hwid) {
          currentHwid = hwid;
          activeAgents.set(hwid, socket); // Registra no pool ativo
          await handleHandshake(Payload);
        } else if (Type === 'Telemetry') {
          await handleTelemetry(Payload);
        }
      } catch (err) {
        console.error('[ERRO]: Falha ao processar mensagem do agente:', err);
      }
    });

    socket.on('close', () => {
      if (currentHwid) {
        activeAgents.delete(currentHwid); // Remove do pool ativo
        console.log(`[WS]: Agente ${currentHwid.substring(0, 8)} desconectado e removido do pool.`);
      }
    });
  });

  try {
    await server.listen({ port: 5000, host: '0.0.0.0' });
    console.log('🚀 Sentinel API Rodando em http://localhost:5000');
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

/**
 * Persistência: Handshake
 */
async function handleHandshake(payload: any) {
  const hwid = payload.Hwid || payload.hwid;
  const hostname = payload.Hostname || payload.hostname;
  const osVersion = payload.OsVersion || payload.osVersion;
  const macAddress = payload.MacAddress || payload.macAddress;
  const localIp = payload.LocalIp || payload.localIp;
  const cpuModel = payload.CpuModel || payload.cpuModel;
  const installedSoftware = payload.InstalledSoftware || payload.installedSoftware;

  await prisma.asset.upsert({
    where: { hwid },
    update: {
      hostname,
      osVersion,
      macAddress,
      localIp,
      cpuModel,
      installedSoftware,
      status: 'ONLINE',
      lastSeen: new Date(),
    },
    create: {
      hwid,
      hostname,
      osVersion,
      macAddress,
      localIp,
      cpuModel,
      installedSoftware,
      status: 'ONLINE',
    },
  });

  console.log(`[BD]: Handshake Concluído para ${hwid.substring(0, 8)}`);
}

/**
 * Persistência: Telemetry
 */
async function handleTelemetry(payload: any) {
  const hwid = payload.Hwid || payload.hwid;
  const cpuUsage = payload.CpuUsagePercentage || payload.cpuUsagePercentage;
  const ramTotal = payload.RamTotalBytes || payload.ramTotalBytes;
  const ramUsed = payload.RamUsedBytes || payload.ramUsedBytes;
  const disks = payload.DiskUsageBytes || payload.diskUsageBytes || payload.Disks || payload.disks || {};

  const asset = await prisma.asset.findUnique({ where: { hwid }, select: { id: true } });
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
}

startServer();

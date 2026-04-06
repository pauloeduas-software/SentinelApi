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
 * Utilitário: Sanitização de HWID
 */
const sanitizeHwid = (hwid: string) => hwid.trim().toLowerCase();

/**
 * Utilitário: Atualização de sinal de vida (Last Seen)
 */
async function updateLastSeen(hwid: string) {
  try {
    await prisma.asset.update({
      where: { hwid: sanitizeHwid(hwid) },
      data: { lastSeen: new Date(), status: 'ONLINE' }
    });
  } catch (err) {
    // Silencioso: Se o asset ainda não existir (antes do handshake), ignora o update
  }
}

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
    const cleanHwid = sanitizeHwid(hwid);

    const socket = activeAgents.get(cleanHwid);

    if (!socket) {
      return reply.status(404).send({ error: "Agente offline ou não encontrado." });
    }

    const commandPacket = JSON.stringify({
      Type: "Command",
      Payload: { Action: action, CommandId: crypto.randomUUID() }
    });

    socket.send(commandPacket);
    console.log(`[COMANDO]: ${action} enviado para ${cleanHwid.substring(0, 8)}`);
    return { message: "Comando enviado." };
  });

  // 4. ROTA WS: Ingestão e Controle
  server.get('/agent-hub', { websocket: true }, (socket, req) => {
    const clientId = req.socket.remoteAddress || 'Unknown';
    let currentHwid: string | null = null;

    socket.on('message', async (data: any) => {
      try {
        const message = JSON.parse(data.toString());
        const { Type, Payload } = message;

        const rawHwid = Payload?.Hwid || Payload?.hwid;
        if (!rawHwid) return;

        const hwid = sanitizeHwid(rawHwid);
        currentHwid = hwid;

        // Reset de inatividade: Qualquer mensagem (Handshake, Telemetry, Ping) reseta o LastSeen
        await updateLastSeen(hwid);

        if (Type === 'Handshake') {
          activeAgents.set(hwid, socket);
          await handleHandshake(Payload);
        } else if (Type === 'Telemetry') {
          await handleTelemetry(Payload);
        } else if (Type === 'Ping') {
          // Heartbeat explícito já tratado pelo updateLastSeen acima
          console.log(`[HEARTBEAT]: ${hwid.substring(0, 8)}`);
        }
      } catch (err) {
        console.error('[ERRO]: Falha no parser de mensagem:', err);
      }
    });

    socket.on('close', async () => {
      if (currentHwid) {
        const cleanHwid = sanitizeHwid(currentHwid);
        activeAgents.delete(cleanHwid);
        try {
          await prisma.asset.update({
            where: { hwid: cleanHwid },
            data: { status: 'OFFLINE', lastSeen: new Date() }
          });
          console.log(`[WS]: Agente ${cleanHwid.substring(0, 8)} desconectado formalmente.`);
        } catch (err) {}
      }
    });
  });

  try {
    await server.listen({ port: 5000, host: '0.0.0.0' });
    console.log('🚀 Sentinel API Rodando em http://localhost:5000');

    // TESTE 4 & LÓGICA CORRIGIDA: Zombie Cleaner (Roda a cada 60s)
    setInterval(async () => {
      const cutoff = new Date(Date.now() - 4 * 60 * 1000); // 4 minutos de tolerância (UTC)
      
      try {
        // Log de Diagnóstico (Apenas Online)
        const onlineAgents = await prisma.asset.findMany({ 
          where: { status: 'ONLINE' },
          select: { hwid: true, lastSeen: true } 
        });

        if (onlineAgents.length > 0) {
          console.log(`\n[DIAGNÓSTICO CLEANER]: Cutoff: ${cutoff.toISOString()}`);
          onlineAgents.forEach(a => {
            console.log(`   - Agente ${a.hwid.substring(0, 8)} | LastSeen: ${a.lastSeen.toISOString()} | Expira: ${a.lastSeen < cutoff}`);
          });
        }

        const expired = await prisma.asset.updateMany({
          where: {
            status: 'ONLINE',
            lastSeen: { lt: cutoff }
          },
          data: { status: 'OFFLINE' }
        });

        if (expired.count > 0) {
          console.log(`[LIMPEZA]: ${expired.count} agentes zumbis removidos.`);
        }
      } catch (err) {
        console.error('[ERRO]: Falha na limpeza de zumbis:', err);
      }
    }, 60000);

  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

async function handleHandshake(payload: any) {
  const hwid = sanitizeHwid(payload.Hwid || payload.hwid);
  const hostname = payload.Hostname || payload.hostname;
  const osVersion = payload.OsVersion || payload.osVersion;
  const macAddress = payload.MacAddress || payload.macAddress;
  const localIp = payload.LocalIp || payload.localIp;
  const cpuModel = payload.CpuModel || payload.cpuModel;
  const installedSoftware = payload.InstalledSoftware || payload.installedSoftware;

  await prisma.asset.upsert({
    where: { hwid },
    update: {
      hostname, osVersion, macAddress, localIp, cpuModel, installedSoftware,
      status: 'ONLINE', lastSeen: new Date(),
    },
    create: {
      hwid, hostname, osVersion, macAddress, localIp, cpuModel, installedSoftware,
      status: 'ONLINE',
    },
  });
  console.log(`[BD]: Handshake/Sync: ${hwid.substring(0, 8)}`);
}

async function handleTelemetry(payload: any) {
  const hwid = sanitizeHwid(payload.Hwid || payload.hwid);
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

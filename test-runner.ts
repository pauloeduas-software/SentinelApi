import { PrismaClient } from '@prisma/client';
import WebSocket from 'ws';

const prisma = new PrismaClient();
const WS_URL = 'ws://localhost:5000/agent-hub';

async function runTests() {
  console.log('🧪 INICIANDO TESTES DE QA - SENTINEL API\n');

  // 1. Teste de Sanitização
  console.log('1. Testando Sanitização de HWID...');
  const ws1 = new WebSocket(WS_URL);
  await new Promise(r => ws1.on('open', r));
  
  const rawHwid = "  TeSt-MaC-99  ";
  const expectedHwid = "test-mac-99";

  ws1.send(JSON.stringify({
    Type: 'Handshake',
    Payload: { Hwid: rawHwid, Hostname: 'QA-PC-1', OsVersion: 'Linux' }
  }));

  await new Promise(r => setTimeout(r, 2000)); // Espera persistência
  
  const asset = await prisma.asset.findUnique({ where: { hwid: expectedHwid } });
  if (asset) {
    console.log(`   ✅ Sucesso: HWID salvo como "${asset.hwid}"`);
  } else {
    throw new Error(`   ❌ Falha: HWID não encontrado no banco como "${expectedHwid}"`);
  }

  // 2. Teste de Heartbeat (lastSeen avançando)
  console.log('\n2. Testando Avanço do Heartbeat (lastSeen)...');
  let lastTime = asset.lastSeen.getTime();
  
  for (let i = 1; i <= 2; i++) {
    ws1.send(JSON.stringify({
      Type: 'Telemetry',
      Payload: { Hwid: rawHwid, CpuUsagePercentage: 10, RamTotalBytes: 8000, RamUsedBytes: 4000 }
    }));
    await new Promise(r => setTimeout(r, 1500));
    
    const updatedAsset = await prisma.asset.findUnique({ where: { hwid: expectedHwid } });
    const currentTime = updatedAsset!.lastSeen.getTime();
    
    if (currentTime > lastTime) {
      console.log(`   ✅ Iteração ${i}: Time avançou de ${lastTime} para ${currentTime}`);
      lastTime = currentTime;
    } else {
      throw new Error(`   ❌ Falha: lastSeen não avançou na iteração ${i}`);
    }
  }

  // 3. Teste do Zombie Cleaner
  console.log('\n3. Testando Zombie Cleaner (Abate)...');
  const zombieHwid = "zombie-ag-666";
  await prisma.asset.upsert({
    where: { hwid: zombieHwid },
    update: { status: 'ONLINE', lastSeen: new Date(Date.now() - 5 * 60 * 1000) },
    create: { hwid: zombieHwid, hostname: 'ZOMBIE', osVersion: 'Linux', status: 'ONLINE', lastSeen: new Date(Date.now() - 5 * 60 * 1000) }
  });

  console.log('   🕒 Aguardando ciclo do Cleaner (60s)...');
  // Para não travar o log, vamos forçar uma espera e checar o banco
  await new Promise(r => setTimeout(r, 65000)); 

  const deadAsset = await prisma.asset.findUnique({ where: { hwid: zombieHwid } });
  if (deadAsset?.status === 'OFFLINE') {
    console.log('   ✅ Sucesso: Agente zumbi marcado como OFFLINE.');
  } else {
    throw new Error(`   ❌ Falha: Agente zumbi continua ${deadAsset?.status}`);
  }

  // 4. Teste de Ressurreição
  console.log('\n4. Testando Ressurreição...');
  ws1.send(JSON.stringify({
    Type: 'Ping',
    Payload: { Hwid: zombieHwid }
  }));

  await new Promise(r => setTimeout(r, 2000));
  const resurrectedAsset = await prisma.asset.findUnique({ where: { hwid: zombieHwid } });
  if (resurrectedAsset?.status === 'ONLINE') {
    console.log('   ✅ Sucesso: Agente voltou para ONLINE via Ping.');
  } else {
    throw new Error('   ❌ Falha: Agente não ressuscitou.');
  }

  console.log('\n🏆 TODOS OS TESTES PASSARAM COM SUCESSO!');
  ws1.close();
  process.exit(0);
}

runTests().catch(err => {
  console.error(err);
  process.exit(1);
});

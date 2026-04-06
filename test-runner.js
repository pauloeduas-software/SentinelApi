const { PrismaClient } = require('@prisma/client');
const WebSocket = require('ws');

const prisma = new PrismaClient();
const WS_URL = 'ws://localhost:5000/agent-hub';

async function runTests() {
  console.log('🧪 INICIANDO TESTES DE QA - SENTINEL API (JS MODE)\n');

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

  await new Promise(r => setTimeout(r, 2000));
  
  const asset = await prisma.asset.findUnique({ where: { hwid: expectedHwid } });
  if (asset) {
    console.log(`   ✅ Sucesso: HWID salvo como "${asset.hwid}"`);
  } else {
    console.error(`   ❌ Falha: HWID não encontrado no banco como "${expectedHwid}"`);
    process.exit(1);
  }

  // 2. Teste de Heartbeat
  console.log('\n2. Testando Avanço do Heartbeat (lastSeen)...');
  let lastTime = asset.lastSeen.getTime();
  
  for (let i = 1; i <= 2; i++) {
    ws1.send(JSON.stringify({
      Type: 'Telemetry',
      Payload: { Hwid: rawHwid, CpuUsagePercentage: 10, RamTotalBytes: 8000, RamUsedBytes: 4000 }
    }));
    await new Promise(r => setTimeout(r, 1500));
    
    const updatedAsset = await prisma.asset.findUnique({ where: { hwid: expectedHwid } });
    const currentTime = updatedAsset.lastSeen.getTime();
    
    if (currentTime > lastTime) {
      console.log(`   ✅ Iteração ${i}: Time avançou.`);
      lastTime = currentTime;
    } else {
      console.error(`   ❌ Falha: lastSeen não avançou.`);
      process.exit(1);
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

  console.log('   🕒 Aguardando ciclo do Cleaner (65s)...');
  await new Promise(r => setTimeout(r, 65000)); 

  const deadAsset = await prisma.asset.findUnique({ where: { hwid: zombieHwid } });
  if (deadAsset.status === 'OFFLINE') {
    console.log('   ✅ Sucesso: Agente zumbi abatido.');
  } else {
    console.error(`   ❌ Falha: Agente zumbi continua ${deadAsset.status}`);
    process.exit(1);
  }

  // 4. Teste de Ressurreição
  console.log('\n4. Testando Ressurreição...');
  ws1.send(JSON.stringify({
    Type: 'Ping',
    Payload: { Hwid: zombieHwid }
  }));

  await new Promise(r => setTimeout(r, 2000));
  const resurrectedAsset = await prisma.asset.findUnique({ where: { hwid: zombieHwid } });
  if (resurrectedAsset.status === 'ONLINE') {
    console.log('   ✅ Sucesso: Agente voltou para ONLINE.');
  } else {
    console.error('   ❌ Falha: Agente não ressuscitou.');
    process.exit(1);
  }

  console.log('\n🏆 TODOS OS TESTES PASSARAM COM SUCESSO!');
  ws1.close();
  process.exit(0);
}

runTests();

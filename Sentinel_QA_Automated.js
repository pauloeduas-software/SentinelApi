const WebSocket = require('ws');

const SERVER_URL = 'ws://localhost:5000/agent-hub';
const NUM_AGENTS = 5;

console.log(`\n🧪 INICIANDO TESTES AUTOMATIZADOS SENTINEL`);
console.log(`------------------------------------------`);

async function runTests() {
    // TESTE 6: Concorrência (5 conexões simultâneas)
    console.log(`[TESTE 6]: Simulando ${NUM_AGENTS} conexões simultâneas...`);
    const sockets = [];

    for (let i = 0; i < NUM_AGENTS; i++) {
        const hwid = `STRESS_TEST_AGENT_${i}`;
        const ws = new WebSocket(SERVER_URL);

        ws.on('open', () => {
            console.log(`   ✅ Agente ${i} conectado.`);
            // Envia Handshake
            ws.send(JSON.stringify({
                Type: 'Handshake',
                Payload: { Hwid: hwid, Hostname: `QA-BOT-${i}`, OsVersion: 'Test-Linux' }
            }));
        });

        ws.on('error', (err) => console.error(`   ❌ Erro Agente ${i}:`, err.message));
        sockets.push(ws);
    }

    // Aguarda conexão estabilizar
    await new Promise(r => setTimeout(r, 2000));

    // TESTE 9: Payload Malformado
    console.log(`[TESTE 9]: Enviando payloads inválidos (Lixo)...`);
    sockets[0].send("LIXO_NAO_JSON");
    sockets[1].send(JSON.stringify({ Type: 'Handshake', Payload: "NAO_OBJETO" }));
    console.log(`   ✅ Payloads enviados. Verifique se o servidor NÃO caiu.`);

    // Finaliza
    setTimeout(() => {
        console.log(`\n[FINALIZANDO]: Fechando conexões de teste...`);
        sockets.forEach(s => s.close());
        process.exit(0);
    }, 3000);
}

runTests();

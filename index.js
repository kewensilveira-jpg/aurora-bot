const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const fs = require('fs');
const { GoogleGenerativeAI } = require('@google/generative-ai');

// 🔑 A Railway vai ignorar essa chave debaixo e usar a que você colocou no painel (GEMINI_API_KEY)
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || 'AQ.Ab8RN6JyG4-6CTW6W-HWTBq6H2HBkbp03L_MWEz-mZqkcysqSA';

const ai = new GoogleGenerativeAI(GEMINI_API_KEY);

// 🤖 Mantemos exclusivamente o modelo de última geração que está funcionando na sua API
const modeloPrincipal = ai.getGenerativeModel({ model: 'gemini-2.5-flash' }, { apiVersion: 'v1' });

if (!fs.existsSync('gastos.json') || fs.readFileSync('gastos.json', 'utf-8').trim() === "") {
    fs.writeFileSync('gastos.json', JSON.stringify([], null, 2));
}

console.log('🚀 Iniciando a Aurora (Modo União e Descoberta de Logs)...');

const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote'
        ]
    }
});

let meuIdProprio = "";

client.on('qr', (qr) => {
    console.log('\n🤖 GERANDO IMAGEM DO QR CODE...');
    
    // Transforma o código do QR em uma imagem de verdade e salva como "qrcode.png"
    const qrcodeImage = require('qr-image');
    const qr_svg = qrcodeImage.image(qr, { type: 'png' });
    qr_svg.pipe(fs.createWriteStream('qrcode.png'));
    
    console.log('✅ Imagem "qrcode.png" gerada na pasta do projeto! Acesse via URL da Railway.');
});

client.on('ready', () => {
    meuIdProprio = client.info.wid._serialized;
    console.log(`\n👤 Seu ID identificado: ${meuIdProprio}`);
    console.log('✅ FORÇA TOTAL: AURORA PRONTA E PRONTINHA NO SEU CHAT!');
});

// 🛠️ BLOCO DE CAPTURA TOTAL ATIVADO
client.on('message_create', async (msg) => {
    // 🔍 SEU RADAR PRIVADO: Mostra no terminal absolutamente tudo o que passar pelo seu WhatsApp
    console.log(`📡 MENSAGEM DETECTADA! De Chat ID: "${msg.from}" | Autor: "${msg.author || msg.from}" | Vinda de mim? ${msg.fromMe} | Texto: "${msg.body}"`);

    // Evita que o robô responda às suas próprias respostas e gere loops infinitos
    if (msg.fromMe && msg.body.startsWith('🔮 *Aurora:*')) return;

    let textoUsuario = msg.body.trim().toLowerCase();
    if (!textoUsuario) return;

    // 🎯 SE ELE PEGAR A PALAVRA "aurora", VAI ENVIAR UMA RESPOSTA FORÇADA DE TESTE
    if (textoUsuario.includes('aurora')) {
        try {
            console.log(`🔮 Tentando enviar resposta forçada para o Chat: ${msg.from}`);
            await client.sendMessage(msg.from, `🔮 *Aurora:* Opa Kewen! Consegui interceptar sua mensagem! O ID deste chat é: ${msg.from}`);
            console.log('✅ Resposta de teste disparada com sucesso!');
        } catch (error) {
            console.error('❌ Falha ao tentar responder de volta:', error.message);
        }
    }
});

client.initialize();

// 🌐 CÓDIGO DO SERVIDOR WEB:
const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/qrcode.png', (req, res) => {
    if (fs.existsSync('qrcode.png')) {
        res.sendFile(__dirname + '/qrcode.png');
    } else {
        res.send('🤖 O QR Code ainda não foi gerado ou já foi escaneado! Atualize a página em alguns segundos.');
    }
});

app.get('/', (req, res) => {
    res.send('🤖 Aurora Bot está online na Railway!');
});

app.listen(PORT, () => {
    console.log(`🌍 Servidor web ativo na porta ${PORT}`);
});
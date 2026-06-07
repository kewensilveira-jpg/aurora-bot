const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const fs = require('fs');
const path = require('path');
const express = require('express');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const DATA_DIR = path.resolve(__dirname, '.data');
const AUTH_DIR = path.join(DATA_DIR, 'wwebjs_auth');
const GASTOS_FILE = path.join(DATA_DIR, 'gastos.json');
const QRCODE_FILE = path.join(DATA_DIR, 'qrcode.png');
const PORT = process.env.PORT || 3000;

console.log('Starting Aurora bot...');
console.log('Node env:', process.env.NODE_ENV);
console.log('PORT:', PORT);
console.log('GEMINI_API_KEY defined:', !!process.env.GEMINI_API_KEY);

process.on('uncaughtException', (err) => {
    console.error('uncaughtException:', err);
});

process.on('unhandledRejection', (reason) => {
    console.error('unhandledRejection:', reason);
});

const app = express();

app.get('/', (req, res) => {
    const qrExists = fs.existsSync(QRCODE_FILE);
    res.send(`
        <html>
            <body style="font-family: Arial, sans-serif; padding: 24px;">
                <h1>Aurora Bot</h1>
                <p>Status: ${qrExists ? 'QR code generated' : 'Waiting for QR code'}</p>
                <p>${qrExists ? '<a href="/qrcode.png" target="_blank">Abrir QR code</a>' : 'Aguarde até que o QR code seja gerado pelo bot.'}</p>
                <p>Se o QR code aparece quebrado, atualize a página após o próximo evento de QR.</p>
            </body>
        </html>`);
});

app.get('/qrcode.png', (req, res) => {
    if (!fs.existsSync(QRCODE_FILE)) {
        return res.status(404).send('QR code ainda não foi gerado. Aguarde.');
    }
    res.sendFile(QRCODE_FILE);
});

app.listen(PORT, () => {
    console.log(`Express server running on port ${PORT}`);
});


if (!process.env.GEMINI_API_KEY) {
    console.error('Erro: variável GEMINI_API_KEY não definida. Defina no Railway ou no ambiente de deployment.');
    process.exit(1);
}

fs.mkdirSync(DATA_DIR, { recursive: true });

if (!fs.existsSync(GASTOS_FILE) || fs.readFileSync(GASTOS_FILE, 'utf-8').trim() === "") {
    fs.writeFileSync(GASTOS_FILE, JSON.stringify([], null, 2));
}

// 1. Configuração Otimizada da API do Gemini (Evita bloqueio do GitHub)
const configIA = { apiKey: process.env.GEMINI_API_KEY };
const ai = new GoogleGenerativeAI(configIA);

// 2. Configuração do Cliente WhatsApp com travas de estabilidade e Memória RAM
const client = new Client({
    authStrategy: new LocalAuth({
        dataPath: AUTH_DIR // Caminho gravável para Railway
    }),
    puppeteer: {
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--single-process' // Economiza RAM no servidor da Railway
        ],
        // Corrige o erro "Execution context was destroyed" forçando uma versão estável
        webVersionCache: {
            type: 'remote',
            remotePath: 'https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/2.2412.54.html'
        }
    }
});

// 3. Geração do QR Code nos logs da Railway
client.on('qr', (qr) => {
    console.log('🤖 NOVO QR CODE GERADO...');
    qrcode.generate(qr, { small: true });

    try {
        const qrImage = require('qr-image');
        const qrPng = qrImage.imageSync(qr, { type: 'png' });
        fs.writeFileSync(QRCODE_FILE, qrPng);
        console.log(`✅ QR code salvo em: ${QRCODE_FILE}`);
    } catch (err) {
        console.log('Aviso: Biblioteca qr-image não instalada, usando apenas terminal.');
        console.error(err);
    }
});

// 4. Confirmação de conexão com sucesso
client.on('ready', () => {
    console.log('🔒 [PRIVADO ATIVADO] Aurora rodando de forma ultra segura no seu chat!');
});

// 5. Lógica de Mensagens (Foco no Chat Privado consigo mesmo)
client.on('message', async (msg) => {
    const chat = await msg.getChat();
    const deMim = msg.fromMe;
    const meuNumero = client.info.wid._serialized;

    // Filtro de Segurança: Responde APENAS no chat privado com seu próprio número
    if (msg.from === meuNumero || chat.id._serialized === meuNumero) {
        
        // Evita loops infinitos de respostas
        if (deMim && msg.body.startsWith('🤖')) return;

        try {
            console.log(`📩 Mensagem recebida no privado: ${msg.body}`);

            // Exemplo de sistema de gastos integrado ao arquivo local do volume
            if (msg.body.toLowerCase().startsWith('gasto') || msg.body.toLowerCase().startsWith('salvar')) {
                fs.appendFileSync(GASTOS_FILE, `${new Date().toISOString()} - ${msg.body}\n`);
                await msg.reply('🤖 Gasto anotado com sucesso no seu painel seguro!');
                return;
            }

            // Envia a mensagem para a IA do Gemini responder
            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: msg.body,
            });

            // Responde no WhatsApp com a inteligência do Gemini
            await msg.reply(`🤖 ${response.text}`);

        } catch (error) {
            console.error('❌ Erro ao processar mensagem ou chamar a IA:', error);
            await msg.reply('🤖 Desculpe, tive um probleminha técnico para processar essa mensagem agora.');
        }
    }
});

// Inicializa o Bot
client.initialize();
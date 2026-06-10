const { Client, LocalAuth } = require('whatsapp-web.js');
const express = require('express');
const qrcode = require('qrcode');
const path = require('path');

const app = express();
const port = process.env.PORT || 8080;

let latestQr = null;
let botStatus = 'Aguardando leitura do QR Code...';

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
            '--no-zygote',
            '--single-process',
            '--disable-gpu'
        ]
    },
    webVersionCache: {
        type: 'remote',
        remotePath: 'https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/2.2412.54.html'
    }
});

client.initialize();

// ==================== EVENTOS DO WHATSAPP ====================

client.on('qr', (qr) => {
    latestQr = qr;
    botStatus = 'QR Code gerado! Aguardando escaneamento...';
    console.log('🤖 [AURORA] Novo QR Code gerado com sucesso.');
});

client.on('ready', () => {
    latestQr = null;
    botStatus = '🔒 [PRIVADO ATIVADO] Aurora rodando de forma ultra segura no seu chat!';
    console.log('✅ [AURORA] Client is ready! Bot totalmente conectado.');
});

client.on('authenticated', () => {
    console.log('🔒 [AURORA] Autenticado com sucesso!');
});

client.on('auth_failure', (msg) => {
    botStatus = 'Falha na autenticação. Reiniciando...';
    console.error('❌ [AURORA] Falha na autenticação:', msg);
});

client.on('disconnected', (reason) => {
    botStatus = 'Desconectado do WhatsApp. Gerando novo QR Code...';
    console.log('❌ [AURORA] O cliente foi desconectado:', reason);
    client.initialize();
});

// ==================== LÓGICA DE PRIVACIDADE E RESPOSTA ====================

// Usando 'message_create' para capturar o que você digita na conversa com você mesmo
client.on('message_create', async (msg) => {
    try {
        const chat = await msg.getChat();
        
        // Validação do seu número (DDD 51 com e sem o nono dígito)
        const ehMensagemDoKewen = 
            msg.fromMe || 
            msg.id.fromMe ||
            (chat && chat.id && chat.id.user && chat.id.user.includes('51997984859')) ||
            (chat && chat.id && chat.id.user && chat.id.user.includes('5197984859')) ||
            msg.from.includes('51997984859') ||
            msg.from.includes('5197984859');

        // Segurança: Se não for você no seu chat privado, ignora para não responder mais ninguém
        if (!ehMensagemDoKewen) {
            return;
        }

        if (!msg.body) return;

        const textoMensagem = msg.body.trim();
        console.log(`💬 [DEBUG LOG] Mensagem sua detectada: "${textoMensagem}"`);

        // Evita que o bot responda a si mesmo e entre em loop infinito
        if (textoMensagem.startsWith('🤖')) return;

        // --- RESPOSTA PARA QUALQUER MENSAGEM ---
        // Não importa o que você digitar, ela vai ler e responder aqui embaixo:
        await msg.reply(`🤖 Entendido, Kewen! Você disse: "${textoMensagem}". Meu motor recebeu seu comando e está pronto.`);

    } catch (error) {
        console.error('❌ [ERRO NO PROCESSAMENTO]:', error);
    }
});

// ==================== SERVIDOR WEB (EXPRESS) ====================

app.get('/', async (req, res) => {
    if (!latestQr) {
        res.send(`
            <html>
                <head>
                    <meta http-equiv="refresh" content="10">
                    <title>Aurora Bot - Status</title>
                    <style>
                        body { font-family: Arial, sans-serif; text-align: center; background-color: #111; color: #fff; padding-top: 50px; }
                        .status { font-size: 1.2em; color: #00ffcc; font-weight: bold; }
                    </style>
                </head>
                <body>
                    <h1>🤖 Aurora Bot Status</h1>
                    <p class="status">${botStatus}</p>
                </body>
            </html>
        `);
        return;
    }

    try {
        const qrImageBase64 = await qrcode.toDataURL(latestQr);
        res.send(`
            <html>
                <head>
                    <meta http-equiv="refresh" content="600">
                    <title>Escaneie a Aurora</title>
                    <style>
                        body { font-family: Arial, sans-serif; text-align: center; background-color: #111; color: #fff; padding-top: 30px; }
                        .container { background-color: #222; padding: 30px; display: inline-block; border-radius: 15px; }
                        img { border: 10px solid white; border-radius: 5px; margin-top: 15px; }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <h1>🤖 Conectar Aurora Bot</h1>
                        <img src="${qrImageBase64}" alt="QR Code WhatsApp" />
                    </div>
                </body>
            </html>
        `);
    } catch (err) {
        res.status(500).send('Erro ao gerar o QR Code.');
    }
});

app.listen(port, () => {
    console.log(`🚀 Express server running on port ${port}`);
});
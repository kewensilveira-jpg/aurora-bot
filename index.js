const { Client, LocalAuth } = require('whatsapp-web.js');
const express = require('express');
const qrcode = require('qrcode');

const app = express();
const port = process.env.PORT || 8080;

let latestQr = null;
let botStatus = 'Aguardando leitura do QR Code...';

// Inicializa a IA usando a chave que está na Railway
const { GoogleGenAI } = require('@google/genai');
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

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

// ==================== FUNÇÃO DO CÉREBRO (GEMINI) ====================

async function perguntarAoGemini(pergunta) {
    const systemInstruction = "Você é a Aurora, uma assistente virtual inteligente, prestativa e objetiva. Responda de forma natural.";
    try {
        console.log('⚡ [SETOR 1] Tentando com Gemini 2.5 Flash...');
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: pergunta,
            config: { systemInstruction }
        });
        return response.text;
    } catch (errorFirstSector) {
        console.error('⚠️ [SETOR 1 FALHOU] Acionando Setor 2...', errorFirstSector);
        try {
            console.log('🔥 [SETOR 2] Tentando com Gemini 2.5 Pro...');
            const responseBackup = await ai.models.generateContent({
                model: 'gemini-2.5-pro',
                contents: pergunta,
                config: { systemInstruction }
            });
            return responseBackup.text;
        } catch (errorSecondSector) {
            console.error('❌ [CRÍTICO] Ambos os setores falharam:', errorSecondSector);
            return '🤖 Meus dois setores de inteligência falharam no momento.';
        }
    }
}

// ==================== LÓGICA DE RESPOSTA ====================

client.on('message_create', async (msg) => {
    try {
        const chat = await msg.getChat();
        const ehMensagemDoKewen = 
            msg.fromMe || 
            msg.id.fromMe ||
            (chat && chat.id && chat.id.user && chat.id.user.includes('51997984859')) ||
            (chat && chat.id && chat.id.user && chat.id.user.includes('5197984859')) ||
            msg.from.includes('51997984859') ||
            msg.from.includes('5197984859');

        if (!ehMensagemDoKewen) return;
        if (!msg.body) return;

        const textoMensagem = msg.body.trim();
        if (textoMensagem.startsWith('🤖')) return;

        console.log(`💬 [PROCESSANDO]: "${textoMensagem}"`);
        const respostaDaIA = await perguntarAoGemini(textoMensagem);
        await msg.reply(`🤖 ${respostaDaIA}`);
    } catch (error) {
        console.error('❌ [ERRO NO PROCESSAMENTO]:', error);
    }
});

// ==================== SERVIDOR WEB (EXPRESS) ====================

// Rota principal de Status (10 minutos estável)
app.get('/', async (req, res) => {
    res.send(`
        <html>
            <head>
                <meta http-equiv="refresh" content="600">
                <title>Aurora Bot - Status</title>
                <style>
                    body { font-family: Arial, sans-serif; text-align: center; background-color: #111; color: #fff; padding-top: 50px; }
                    .status { font-size: 1.2em; color: #00ffcc; font-weight: bold; }
                    a { color: #00ffcc; text-decoration: none; border: 1px solid #00ffcc; padding: 10px; border-radius: 5px; }
                </style>
            </head>
            <body>
                <h1>🤖 Aurora Bot Status</h1>
                <p class="status">${botStatus}</p>
                <br><br>
                ${latestQr ? '<a href="/qr" target="_blank">Clique aqui para abrir o QR Code em PNG</a>' : ''}
            </body>
        </html>
    `);
});

// O LINK DO PNG QUE VOCÊ QUERIA (Gera a imagem limpa na tela)
app.get('/qr', async (req, res) => {
    if (!latestQr) {
        res.status(404).send('Nenhum QR Code disponível no momento ou o bot já está conectado. Volte à página inicial.');
        return;
    }
    try {
        const qrImageBuffer = await qrcode.toBuffer(latestQr);
        res.writeHead(200, {
            'Content-Type': 'image/png',
            'Content-Length': qrImageBuffer.length
        });
        res.end(qrImageBuffer);
    } catch (err) {
        res.status(500).send('Erro ao gerar o arquivo PNG do QR Code.');
    }
});

app.listen(port, '0.0.0.0', () => {
    console.log(`🚀 Express server running on port ${port}`);
});
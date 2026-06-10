const { Client, LocalAuth } = require('whatsapp-web.js');
const express = require('express');
const qrcode = require('qrcode');
const { GoogleGenAI } = require('@google/genai'); // Nova biblioteca oficial do Gemini

const app = express();
const port = process.env.PORT || 8080;

let latestQr = null;
let botStatus = 'Aguardando leitura do QR Code...';

// Inicializa a IA usando a chave que vamos colocar na Railway
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

// ==================== FUNÇÃO DO CÉREBRO (GEMINI COM DOIS SETORES) ====================

async function perguntarAoGemini(pergunta) {
    // Instrução de personalidade da Aurora
    const systemInstruction = "Você é a Aurora, uma assistente virtual inteligente, prestativa e objetiva. Responda de forma natural.";

    try {
        console.log('⚡ [SETOR 1] Tentando resposta com Gemini 2.5 Flash...');
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash', // Setor 1: Principal e rápido
            contents: pergunta,
            config: { systemInstruction }
        });
        return response.text;

    } catch (errorFirstSector) {
        console.error('⚠️ [SETOR 1 FALHOU] Erro no Gemini Flash. Acionando Setor 2 Reserva...', errorFirstSector);
        
        try {
            console.log('🔥 [SETOR 2] Tentando resposta com Gemini 2.5 Pro...');
            const responseBackup = await ai.models.generateContent({
                model: 'gemini-2.5-pro', // Setor 2: Reserva robusta
                contents: pergunta,
                config: { systemInstruction }
            });
            return responseBackup.text;

        } catch (errorSecondSector) {
            console.error('❌ [CRÍTICO] Ambos os setores do Gemini falharam:', errorSecondSector);
            return '🤖 Desculpe Kewen, meus dois setores de inteligência (Gemini Flash e Pro) estão instáveis ou fora do ar no momento.';
        }
    }
}

// ==================== LÓGICA DE PRIVACIDADE E RESPOSTA ====================

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

        if (!ehMensagemDoKewen) {
            return;
        }

        if (!msg.body) return;

        const textoMensagem = msg.body.trim();
        
        // Evita que ela responda a si mesma
        if (textoMensagem.startsWith('🤖')) return;

        console.log(`💬 [PROCESSANDO] Enviando para a IA: "${textoMensagem}"`);

        // Chama a inteligência do Gemini
        const respostaDaIA = await perguntarAoGemini(textoMensagem);

        // Responde no WhatsApp com a resposta da IA
        await msg.reply(`🤖 ${respostaDaIA}`);

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
                    <meta http-equiv="refresh" content="600">
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
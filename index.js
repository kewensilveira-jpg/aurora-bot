// ====================================================================
// 1. IMPORTAÇÕES E CONFIGURAÇÕES INICIAIS
// ====================================================================
const { GoogleGenAI } = require('@google/genai');
const { Client, LocalAuth } = require('whatsapp-web.js');
const express = require('express');
const qrcode = require('qrcode');

const app = express();
const port = process.env.PORT || 8080;

let latestQr = null;
let botStatus = 'Aguardando leitura do QR Code...';

// Inicializa a IA buscando a chave do cofre seguro da Railway
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// Configuração otimizada do navegador invisível para servidores Linux (Railway)
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

// ====================================================================
// 2. TRATAMENTO DE EVENTOS DO WHATSAPP
// ====================================================================

client.on('qr', (qr) => {
    latestQr = qr;
    botStatus = 'QR Code gerado! Aguardando escaneamento...';
    console.log('🤖 [AURORA] Novo QR Code gerado com sucesso.');
});

client.on('ready', () => {
    latestQr = null;
    botStatus = '🔒 [PRIVADO ATIVADO] Aurora rodando de forma ultra segura no seu chat!';
    console.log('✅ [AURORA] O cliente está pronto e totalmente conectado.');
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

// ====================================================================
// 3. INTEGRAÇÃO INTELIGENTE COM O GEMINI (SISTEMA DE CONTINGÊNCIA)
// ====================================================================

async function perguntarAoGemini(pergunta) {
    const systemInstruction = "Você é a Aurora, uma assistente virtual inteligente, prestativa e objetiva. Responda de forma natural.";
    try {
        console.log('⚡ [SETOR 1] Acionando inteligência principal (Gemini 2.5 Flash)...');
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: pergunta,
            config: { systemInstruction }
        });
        return response.text;
    } catch (errorFirstSector) {
        console.error('⚠️ [SETOR 1 FALHOU] Acionando Setor de Contingência 2...', errorFirstSector);
        try {
            console.log('🔥 [SETOR 2] Carregando modelo avançado de backup (Gemini 2.5 Pro)...');
            const responseBackup = await ai.models.generateContent({
                model: 'gemini-2.5-pro',
                contents: pergunta,
                config: { systemInstruction }
            });
            return responseBackup.text;
        } catch (errorSecondSector) {
            console.error('❌ [CRÍTICO] Ambos os setores de inteligência falharam:', errorSecondSector);
            return '🤖 Desculpe, meus dois setores de inteligência estão temporariamente indisponíveis no momento.';
        }
    }
}

// ====================================================================
// 4. FILTRO DE PRIVACIDADE E PROCESSAMENTO DE MENSAGENS (DDD 51)
// ====================================================================

client.on('message_create', async (msg) => {
    try {
        const chat = await msg.getChat();
        
        // Garante que o robô responda APENAS ao seu número privado (com ou sem o 9 extra no sistema do WhatsApp)
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
        
        // Evita loops infinitos onde o robô tenta responder a si próprio
        if (textoMensagem.startsWith('🤖')) return;

        console.log(`💬 [PROCESSANDO]: "${textoMensagem}"`);
        const respostaDaIA = await perguntarAoGemini(textoMensagem);
        await msg.reply(`🤖 ${respostaDaIA}`);
    } catch (error) {
        console.error('❌ [ERRO NO PROCESSAMENTO]:', error);
    }
});

// ====================================================================
// 5. SERVIDOR WEB INTERNO (INTERFACE DE STATUS E QR CODE)
// ====================================================================

// Rota Principal: Exibe o status atual com o temporizador estável de 10 minutos (600s)
app.get('/', async (req, res) => {
    res.send(`
        <html>
            <head>
                <meta http-equiv="refresh" content="600">
                <title>Aurora Bot - Painel de Controle</title>
                <style>
                    body { font-family: Arial, sans-serif; text-align: center; background-color: #111; color: #fff; padding-top: 50px; }
                    .status { font-size: 1.3em; color: #00ffcc; font-weight: bold; margin-bottom: 35px; }
                    .btn { color: #111; background-color: #00ffcc; text-decoration: none; padding: 12px 25px; border-radius: 5px; font-weight: bold; font-size: 1.1em; transition: 0.3s; }
                    .btn:hover { background-color: #00ccaa; }
                </style>
            </head>
            <body>
                <h1>🤖 Painel de Status - Aurora Bot</h1>
                <p class="status">${botStatus}</p>
                <br>
                ${latestQr ? '<a class="btn" href="/qr" target="_blank">Abrir imagem do QR Code (.PNG)</a>' : ''}
            </body>
        </html>
    `);
});

// Rota PNG Privada: Transforma a string do WhatsApp em uma imagem limpa diretamente na tela
app.get('/qr', async (req, res) => {
    if (!latestQr) {
        res.status(404).send('Nenhum QR Code disponível. Se o robô já foi conectado ao celular, volte à página principal.');
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
        res.status(500).send('Erro interno ao tentar processar a imagem do QR Code.');
    }
});

// Inicia o servidor escutando o IP público obrigatório da Railway
app.listen(port, '0.0.0.0', () => {
    console.log(`🚀 Servidor Express operando perfeitamente na porta ${port}`);
});

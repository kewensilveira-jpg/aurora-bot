const { GoogleGenAI } = require('@google/genai');
const { Client, LocalAuth } = require('whatsapp-web.js');
const express = require('express');
const qr = require('qr-image'); // Usando a biblioteca original que funcionou

const app = express();
const port = process.env.PORT || 8080;

let latestQr = null;

// Inicialização da IA com a chave da Railway
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// Inicialização do WhatsApp Web com os parâmetros de estabilidade para Linux
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

client.on('qr', (qrCodeText) => {
    latestQr = qrCodeText;
    console.log('🤖 [AURORA] Novo QR Code gerado.');
});

client.on('ready', () => {
    latestQr = 'CONNECTED';
    console.log('✅ [AURORA] Bot totalmente conectado e ativo!');
});

client.on('disconnected', (reason) => {
    latestQr = null;
    console.log('❌ [AURORA] Desconectado:', reason);
    client.initialize();
});

// ==================== FUNÇÃO DO GEMINI (CÉREBRO) ====================

async function perguntarAoGemini(pergunta) {
    const systemInstruction = "Você é a Aurora, uma assistente virtual inteligente, prestativa e objetiva. Responda de forma natural.";
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: pergunta,
            config: { systemInstruction }
        });
        return response.text;
    } catch (error) {
        console.error('⚠️ Setor 1 falhou, tentando backup Pro...', error);
        try {
            const responseBackup = await ai.models.generateContent({
                model: 'gemini-2.5-pro',
                contents: pergunta,
                config: { systemInstruction }
            });
            return responseBackup.text;
        } catch (backupError) {
            console.error('❌ Erro crítico na IA:', backupError);
            return '🤖 Meus dois setores de inteligência falharam no momento.';
        }
    }
}

// ==================== FILTRO DDD 51 SEGURO ====================

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
        console.error('❌ Erro no processamento da mensagem:', error);
    }
});

// ==================== ROTA DO QR CODE EM PNG (IGUAL ANTES) ====================

app.get('/', (req, res) => {
    if (!latestQr) {
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        return res.send('<h3>Aguardando o WhatsApp inicializar... Dê F5 em alguns segundos.</h3><script>setTimeout(() => { location.reload(); }, 5000);</script>');
    }

    if (latestQr === 'CONNECTED') {
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        return res.send('<h3>🔒 [PRIVADO ATIVADO] Aurora rodando e conectada no seu WhatsApp!</h3>');
    }

    // Gera o PNG puro direto na tela como você pediu e funcionava antes
    try {
        const code = qr.image(latestQr, { type: 'png' });
        res.setHeader('Content-Type', 'image/png');
        code.pipe(res);
    } catch (err) {
        res.status(500).send('Erro ao gerar imagem do QR Code.');
    }
});

app.listen(port, '0.0.0.0', () => {
    console.log(`🚀 Servidor rodando na porta ${port}`);
});
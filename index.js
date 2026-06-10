const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const fs = require('fs');
const path = require('path');
const express = require('express');
const { GoogleGenerativeAI } = require('@google/generative-ai');

// Configuração do Volume da Railway (Pasta com memória persistente)
const DATA_DIR = path.resolve(__dirname, '.data');
const AUTH_DIR = path.join(DATA_DIR, 'wwebjs_auth');
const GASTOS_FILE = path.join(DATA_DIR, 'gastos.json');
const QRCODE_PNG_FILE = path.join(DATA_DIR, 'qrcode.png');
const QRCODE_SVG_FILE = path.join(DATA_DIR, 'qrcode.svg');
const PORT = process.env.PORT || 8080;

const geminiApiKey = process.env.GEMINI_API_KEY;
console.log('Starting Aurora bot...');
console.log('Node env:', process.env.NODE_ENV);
console.log('PORT:', PORT);
console.log('GEMINI_API_KEY defined:', !!geminiApiKey);

// Garante que o diretório de dados exista antes de qualquer operação
fs.mkdirSync(DATA_DIR, { recursive: true });

if (!fs.existsSync(GASTOS_FILE) || fs.readFileSync(GASTOS_FILE, 'utf-8').trim() === "") {
    fs.writeFileSync(GASTOS_FILE, JSON.stringify([], null, 2));
}

let rawQrCodeString = null;

process.on('uncaughtException', (err) => {
    console.error('uncaughtException:', err);
});

process.on('unhandledRejection', (reason) => {
    console.error('unhandledRejection:', reason);
});

const app = express();

app.use((req, res, next) => {
    console.log(`HTTP request: ${req.method} ${req.url}`);
    next();
});

app.get('/health', (req, res) => {
    const qrGenerated = fs.existsSync(QRCODE_PNG_FILE) || fs.existsSync(QRCODE_SVG_FILE);
    res.json({ status: 'ok', qr: qrGenerated ? 'generated' : 'pending' });
});

// Painel web otimizado - ALTERAÇÃO 1: Tempo de recarga aumentado para 10 minutos (600000 ms)
app.get('/', (req, res) => {
    if (!rawQrCodeString) {
        return res.send(`
            <html><body style="font-family: Arial, sans-serif; padding: 24px; text-align: center; background-color: #f4f6f9;">
                <div style="max-width: 400px; margin: 50px auto; background: white; padding: 30px; border-radius: 12px; box-shadow: 0 4px 15px rgba(0,0,0,0.1);">
                    <h1>Aurora Bot 🤖</h1>
                    <p style="color: #666; font-size: 16px;">O WhatsApp está gerando o seu QR Code no servidor...</p>
                    <p style="color: #999; font-size: 14px;">Esta página atualiza sozinha a cada 10 minutos.</p>
                </div>
                <script>setTimeout(() => { location.reload(); }, 600000);</script>
            </body></html>
        `);
    }

    const qrAppUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(rawQrCodeString)}`;

    res.send(`
        <html>
            <body style="font-family: Arial, sans-serif; padding: 24px; text-align: center; background-color: #f4f6f9;">
                <div style="max-width: 400px; margin: 50px auto; background: white; padding: 30px; border-radius: 12px; box-shadow: 0 4px 15px rgba(0,0,0,0.1);">
                    <h1 style="color: #333; margin-bottom: 5px;">Aurora Bot 🤖</h1>
                    <p style="color: #2ecc71; font-weight: bold; margin-top: 0; font-size: 16px;">🟢 QR Code Pronto para Escanear</p>
                    
                    <div style="margin: 25px 0;">
                        <img src="${qrAppUrl}" alt="QR Code WhatsApp" style="border: 4px solid #333; border-radius: 8px; width: 250px; height: 250px;" />
                    </div>
                    
                    <p style="font-size: 14px; color: #555; line-height: 1.4;">Abra o WhatsApp no seu celular, vá em <b>Aparelhos Conectados</b> > <b>Conectar um aparelho</b> e aponte a câmera para a imagem acima.</p>
                    <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;">
                    <p style="font-size: 12px; color: #999;">O painel recarrega automaticamente a cada 10 minutos caso expire.</p>
                </div>
                <script>setTimeout(() => { location.reload(); }, 600000);</script>
            </body>
        </html>
    `);
});

app.get('/qrcode.png', (req, res) => {
    if (!fs.existsSync(QRCODE_PNG_FILE)) return res.status(404).send('Gerando...');
    res.type('image/png').sendFile(QRCODE_PNG_FILE);
});

app.get('/qrcode.svg', (req, res) => {
    if (!fs.existsSync(QRCODE_SVG_FILE)) return res.status(404).send('Gerando...');
    res.type('image/svg+xml').sendFile(QRCODE_SVG_FILE);
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Express server running on port ${PORT}`);
});

const configIA = geminiApiKey ? { apiKey: geminiApiKey } : null;
const ai = geminiApiKey ? new GoogleGenerativeAI(configIA) : null;

// Configuração Otimizada - ALTERAÇÃO 2: Versão fixa e estável do WhatsApp Web instalada remotamente
const client = new Client({
    authStrategy: new LocalAuth({
        dataPath: AUTH_DIR
    }),
    webVersionCache: {
        type: 'remote',
        remotePath: 'https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/2.2412.54.html'
    },
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
        ],
        handleSIGINT: false,
        handleSIGTERM: false
    }
});

client.on('qr', async (qr) => {
    console.log('🤖 [NOTIFICAÇÃO] NOVO QR CODE GERADO PELO WHATSAPP!');
    rawQrCodeString = qr;
    qrcode.generate(qr, { small: true });

    try {
        const qrImage = require('qr-image');
        fs.writeFileSync(QRCODE_PNG_FILE, qrImage.imageSync(qr, { type: 'png' }));
        fs.writeFileSync(QRCODE_SVG_FILE, qrImage.imageSync(qr, { type: 'svg' }));
    } catch (err) {
        console.error('Erro ao salvar arquivos do QR:', err.message);
    }
});

client.on('ready', () => {
    console.log('🔒 [PRIVADO ATIVADO] Aurora rodando de forma ultra segura no seu chat!');
    rawQrCodeString = null;
});

// Monitoramento Geral de Mensagens Próprias para Debug no Console
client.on('message_create', (msg) => {
    if (msg.fromMe) {
        console.log(`💬 [DEBUG LOG] Mensagem sua detectada saindo ou entrando: "${msg.body}"`);
    }
});

// LÓGICA DE PRIVACIDADE EXCLUSIVA: Responde apenas ao Kewen (51997984859)
client.on('message', async (msg) => {
    try {
        const chat = await msg.getChat();
        
        const numeroKewen = '51997984859@c.us';
        const numeroKewenSemNono = '5197984859@c.us';

        // Validação expandida para pegar qualquer variação do seu número ou chat próprio
        const ehMensagemDoKewen = 
            msg.fromMe || 
            msg.from === numeroKewen || 
            msg.from === numeroKewenSemNono ||
            chat.id._serialized === numeroKewen ||
            chat.id._serialized === numeroKewenSemNono ||
            chat.id.user.includes('51997984859') ||
            chat.id.user.includes('5197984859');

        if (!ehMensagemDoKewen) {
            return; 
        }

        if (msg.body.startsWith('🤖')) return;

        console.log(`📩 [AURORA PRIVADO] Processando comando do Kewen: "${msg.body}"`);

        // Comando de gastos integrado ao Volume da Railway
        if (msg.body.toLowerCase().startsWith('gasto') || msg.body.toLowerCase().startsWith('salvar')) {
            fs.appendFileSync(GASTOS_FILE, `${new Date().toISOString()} - ${msg.body}\n`);
            await msg.reply('🤖 Gasto anotado com sucesso no seu painel seguro do Volume!');
            return;
        }

        if (!ai) {
            await msg.reply('🤖 A variável GEMINI_API_KEY não está configurada no deploy da Railway.');
            return;
        }

        // Envia para a inteligência artificial do Gemini
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: msg.body,
        });

        await msg.reply(`🤖 ${response.text}`);

    } catch (error) {
        console.error('❌ Erro no processamento da mensagem:', error);
    }
});

if (process.env.SKIP_WA === 'true') {
    console.log('SKIP_WA=true -> pulando inicialização do cliente WhatsApp.');
} else {
    client.initialize();
}
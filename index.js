const { Client, LocalAuth } = require('whatsapp-web.js');
const express = require('express');
const qrcode = require('qrcode');
const path = require('path');

const app = express();
const port = process.env.PORT || 8080;

// Variáveis de controle do QR Code e Status
let latestQr = null;
let botStatus = 'Aguardando leitura do QR Code...';

// Configuração do cliente WhatsApp Web
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
    // Força uma versão estável do WhatsApp Web para evitar travamentos de pareamento
    webVersionCache: {
        type: 'remote',
        remotePath: 'https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/2.2412.54.html'
    }
});

// Inicialização do cliente WhatsApp
client.initialize();

// ==================== EVENTOS DO WHATSAPP ====================

client.on('qr', (qr) => {
    latestQr = qr;
    botStatus = 'QR Code gerado! Aguardando escaneamento...';
    console.log('🤖 [AURORA] Novo QR Code gerado com sucesso.');
});

client.on('ready', () => {
    latestQr = null; // Limpa o QR Code pois já conectou
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

client.on('message_create', async (msg) => {
    try {
        const chat = await msg.getChat();
        
        // Validação robusta para identificar se a mensagem veio de você (Kewen - DDD 51)
        const ehMensagemDoKewen = 
            msg.fromMe || 
            msg.id.fromMe ||
            (chat && chat.id && chat.id.user && chat.id.user.includes('51997984859')) ||
            (chat && chat.id && chat.id.user && chat.id.user.includes('5197984859')) ||
            msg.from.includes('51997984859') ||
            msg.from.includes('5197984859');

        // Se NÃO for uma mensagem sua no seu próprio chat privado, a Aurora ignora completamente
        if (!ehMensagemDoKewen) {
            return;
        }

        // Ignora mensagens vazias ou de mídia sem texto
        if (!msg.body) return;

        const textoMensagem = msg.body.trim();
        console.log(`💬 [DEBUG LOG] Mensagem sua detectada: "${textoMensagem}"`);

        // Resposta de Teste / Comando Simples
        if (textoMensagem.toLowerCase() === 'ping' || textoMensagem.toLowerCase() === '!ping') {
            await msg.reply('🤖 pong! Estou ativa e operando de forma 100% privada aqui.');
            return;
        }

        // Resposta Padrão da Aurora para interações normais no chat
        if (textoMensagem.toLowerCase().includes('aurora') || textoMensagem.startsWith('!')) {
            await msg.reply('🤖 Olá Kewen! Recebi sua mensagem. Meu motor está ativo e pronto para as automações.');
        }

    } catch (error) {
        console.error('❌ [ERRO NO PROCESSAMENTO]:', error);
    }
});

// ==================== SERVIDOR WEB (EXPRESS) ====================

// Rota principal: Exibe uma página limpa que atualiza o QR Code a cada 10 segundos
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
                    <p>A página irá recarregar automaticamente quando o QR Code estiver pronto.</p>
                </body>
            </html>
        `);
        return;
    }

    try {
        // Converte o código bruto do QR em uma imagem base64 legível
        const qrImageBase64 = await qrcode.toDataURL(latestQr);
        
        res.send(`
            <html>
                <head>
                    <meta http-equiv="refresh" content="600"> <!-- Atualiza a página apenas a cada 10 minutos -->
                    <title>Escaneie a Aurora</title>
                    <style>
                        body { font-family: Arial, sans-serif; text-align: center; background-color: #111; color: #fff; padding-top: 30px; }
                        .container { background-color: #222; padding: 30px; display: inline-block; border-radius: 15px; box-shadow: 0px 0px 15px rgba(0, 255, 200, 0.2); }
                        img { border: 10px solid white; border-radius: 5px; margin-top: 15px; }
                        .timer-alert { color: #ffcc00; font-weight: bold; margin-top: 15px; }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <h1>🤖 Conectar Aurora Bot</h1>
                        <p>Abra o WhatsApp > Aparelhos Conectados > Conectar um aparelho</p>
                        <img src="${qrImageBase64}" alt="QR Code WhatsApp" />
                        <p class="timer-alert">⏳ Esta tela está protegida! O QR Code se manterá estável por até 10 minutos.</p>
                    </div>
                </body>
            </html>
        `);
    } catch (err) {
        res.status(500).send('Erro ao gerar a imagem do QR Code.');
    }
});

// Rota de monitoramento básico de integridade (Health Check)
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'OK', bot: botStatus });
});

app.listen(port, () => {
    console.log(`🚀 Express server running on port ${port}`);
});
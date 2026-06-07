const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const fs = require('fs');
const { GoogleGenAI } = require('@google/genai');

// 1. Configuração da API do Gemini
// Certifique-se de que a variável GEMINI_API_KEY está configurada na Railway
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// 2. Configuração do Cliente WhatsApp com travas de estabilidade e Memória RAM
const client = new Client({
    authStrategy: new LocalAuth({
        dataPath: '/.wwebjs_auth' // Caminho fixo do volume da Railway
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
            '--single-process' // Economiza RAM no servidor
        ],
        // Evita o erro "Execution context was destroyed" forçando uma versão estável
        webVersionCache: {
            type: 'remote',
            remotePath: 'https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/2.2412.54.html'
        }
    }
});

// 3. Geração do QR Code no terminal/logs
client.on('qr', (qr) => {
    console.log('🤖 NOVO QR CODE GERADO...');
    qrcode.generate(qr, { small: true });
    
    // Opcional: Se o seu código antigo salvava o QR Code em imagem para acessar via link,
    // ele cria o arquivo qrcode.png na pasta pública ou raiz.
    try {
        const qrImage = require('qr-image');
        const qr_svg = qrImage.image(qr, { type: 'png' });
        qr_svg.pipe(fs.createWriteStream('qrcode.png'));
    } catch (err) {
        // Se não usar a biblioteca qr-image, ignora esta parte
    }
});

// 4. Confirmação de conexão com sucesso
client.on('ready', () => {
    console.log('🔒 [PRIVADO ATIVADO] Aurora rodando de forma ultra segura no seu chat!');
});

// 5. Lógica de Mensagens (Foco no Chat Privado e IA)
client.on('message', async (msg) => {
    // Captura o ID de quem enviou e o ID do chat privado do bot
    const chat = await msg.getChat();
    const deMim = msg.fromMe;
    
    // Captura o número do bot para validar o chat privado (consigo mesmo)
    const meuNumero = client.info.wid._serialized;

    // Filtro de Segurança: Responde APENAS se a mensagem for no chat privado com você mesmo
    if (msg.from === meuNumero || chat.id._serialized === meuNumero) {
        
        // Ignora mensagens enviadas pela própria IA para não dar loop infinito
        if (deMim && msg.body.startsWith('🤖')) return;

        try {
            console.log(`📩 Mensagem recebida no privado: ${msg.body}`);

            // Exemplo simples de sistema de gastos integrado ao arquivo local do volume
            if (msg.body.toLowerCase().startsWith('gasto') || msg.body.toLowerCase().startsWith('salvar')) {
                // Salva o texto no arquivo gastos.json que está protegido no volume
                fs.appendFileSync('/gastos.json', `${new Date().toISOString()} - ${msg.body}\n`);
                await msg.reply('🤖 Gasto anotado com sucesso no seu painel seguro!');
                return;
            }

            // Envia o texto da mensagem para a IA do Gemini responder
            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: msg.body,
            });

            // Responde no WhatsApp com o texto gerado pela IA
            await msg.reply(`🤖 ${response.text}`);

        } catch (error) {
            console.error('❌ Erro ao processar mensagem ou chamar a IA:', error);
            await msg.reply('🤖 Desculpe, tive um probleminha técnico para processar essa mensagem agora.');
        }
    }
});

// Inicializa o Bot
client.initialize();
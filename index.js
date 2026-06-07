const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const fs = require('fs');
const { GoogleGenerativeAI } = require('@google/generative-ai');

// 🔑 Configuração da API do Gemini via Railway
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || 'AQ.Ab8RN6JyG4-6CTW6W-HWTBq6H2HBkbp03L_MWEz-mZqkcysqSA';
const ai = new GoogleGenerativeAI(GEMINI_API_KEY);
const modeloPrincipal = ai.getGenerativeModel({ model: 'gemini-2.5-flash' }, { apiVersion: 'v1' });

// Garante que o arquivo de banco de dados dos gastos exista
if (!fs.existsSync('gastos.json') || fs.readFileSync('gastos.json', 'utf-8').trim() === "") {
    fs.writeFileSync('gastos.json', JSON.stringify([], null, 2));
}

// 📌 SEU ID EXATO IDENTIFICADO NO LOG
const MEU_CHAT_PRIVADO = '555197984859@c.us';

console.log(`🚀 Iniciando a Aurora FIXADA no seu chat privado: ${MEU_CHAT_PRIVADO}`);

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

client.on('qr', (qr) => {
    console.log('\n🤖 NOVO QR CODE GERADO...');
    const qrcodeImage = require('qr-image');
    const qr_svg = qrcodeImage.image(qr, { type: 'png' });
    qr_svg.pipe(fs.createWriteStream('qrcode.png'));
});

client.on('ready', () => {
    console.log(`\n🔒 [PRIVADO ATIVADO] Aurora rodando exclusivamente na sua conversa de número: ${MEU_CHAT_PRIVADO}`);
});

// 🛠️ PROCESSAMENTO EM TEMPO REAL
client.on('message_create', async (msg) => {
    
    // 1. Evita loops: Se a resposta começou com o prefixo da Aurora, ignora para não responder infinitamente
    if (msg.fromMe && msg.body.startsWith('🔮 *Aurora:*')) return;

    // 🔒 TRAVA DE OURO: Só aceita se o chat atual for estritamente o SEU chat privado
    if (msg.from !== MEU_CHAT_PRIVADO) return;

    let textoUsuario = msg.body.trim();
    let conteudoParaIA = [];

    // 🎙️ TRATAMENTO DE ÁUDIO ENVIADO POR VOCÊ
    if (msg.hasMedia) {
        try {
            const media = await msg.downloadMedia();
            if (media && (media.mimetype.includes('audio') || media.mimetype.includes('ogg'))) {
                const mimePuro = media.mimetype.split(';')[0].trim();
                conteudoParaIA.push({
                    inlineData: { data: media.data, mimeType: mimePuro }
                });
                if (!textoUsuario) textoUsuario = "Analise o áudio enviado pelo usuário.";
            }
        } catch (erroMedia) {
            console.error('❌ Erro no áudio:', erroMedia);
        }
    }

    if (!textoUsuario && conteudoParaIA.length === 0) return;

    console.log(`📡 Processando mensagem enviada por você: "${textoUsuario || 'Áudio'}"`);

    try {
        const hoje = new Date().toLocaleDateString('pt-BR');
        let dadosGastos = fs.readFileSync('gastos.json', 'utf-8');
        
        const contextoPrompt = `
        Você é a Aurora, assistente pessoal e gerenciadora de gastos do Kewen. Hoje é dia ${hoje}.
        Histórico de gastos atual em formato JSON:
        ${dadosGastos}
        
        Se ele estiver informando um gasto (ex: "gastei 50 reais"), adicione OBRIGATORIAMENTE no final da resposta a tag JSON_GASTO seguida do objeto exatamente assim: JSON_GASTO {"data": "${hoje}", "valor": X, "descricao": "Y"}.
        Responda sempre de forma curta, prestativa e usando emojis.
        `;

        const dadosEnvio = [contextoPrompt, textoUsuario];
        if (conteudoParaIA.length > 0) dadosEnvio.push(conteudoParaIA[0]);
        
        const result = await modeloPrincipal.generateContent(dadosEnvio);
        let respostaIA = result.response.text();

        // Processa o salvamento do JSON se a IA identificar um gasto
        if (respostaIA.includes('JSON_GASTO')) {
            const partes = respostaIA.split('JSON_GASTO');
            respostaIA = partes[0].trim();
            try {
                const novoGasto = JSON.parse(partes[1].trim());
                const listaAtual = JSON.parse(dadosGastos);
                listaAtual.push(novoGasto);
                fs.writeFileSync('gastos.json', JSON.stringify(listaAtual, null, 2));
                respostaIA += '\n\n💾 _Gasto anotado no seu sistema!_';
            } catch (err) {
                console.log('Erro ao salvar JSON:', err);
            }
        }

        // Responde direto no seu chat
        await client.sendMessage(MEU_CHAT_PRIVADO, `🔮 *Aurora:* ${respostaIA}`);
        console.log('✅ Resposta enviada direto para o seu privado!');

    } catch (error) {
        console.error('❌ Erro no processamento:', error);
    }
});

client.initialize();

// SERVIDOR EXPRESS WEB (Apenas para manter o app online)
const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;
app.get('/qrcode.png', (req, res) => {
    if (fs.existsSync('qrcode.png')) res.sendFile(__dirname + '/qrcode.png');
    else res.send('🤖 QR Code indisponível.');
});
app.get('/', (req, res) => res.send('🤖 Aurora Privada Ativa!'));
app.listen(PORT);
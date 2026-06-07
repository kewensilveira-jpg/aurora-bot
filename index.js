const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const fs = require('fs');
const { GoogleGenerativeAI } = require('@google/generative-ai');

// 🔑 Configuração da API do Gemini via variáveis de ambiente da Railway
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || 'AQ.Ab8RN6JyG4-6CTW6W-HWTBq6H2HBkbp03L_MWEz-mZqkcysqSA';
const ai = new GoogleGenerativeAI(GEMINI_API_KEY);
const modeloPrincipal = ai.getGenerativeModel({ model: 'gemini-2.5-flash' }, { apiVersion: 'v1' });

// Garante que o arquivo de banco de dados dos gastos exista
if (!fs.existsSync('gastos.json') || fs.readFileSync('gastos.json', 'utf-8').trim() === "") {
    fs.writeFileSync('gastos.json', JSON.stringify([], null, 2));
}

console.log('🚀 Iniciando a Aurora (Versão de Segurança Máxima)...');

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
    console.log('\n🔒 [SEGURANÇA ATIVADA] BLINDAGEM COMPLETA.');
    console.log('✅ FORÇA TOTAL: AURORA PRONTA E PRONTINHA NO SEU CHAT!');
});

// 🛠️ PROCESSAMENTO DE MENSAGENS COM SEGURANÇA MÁXIMA
client.on('message_create', async (msg) => {
    
    // 1. Evita loops: Se a mensagem veio da própria Aurora, ignora na hora
    if (msg.fromMe && msg.body.startsWith('🔮 *Aurora:*')) return;

    // 2. TRAVA DE SEGURANÇA ABSOLUTA: Só aceita se a mensagem veio de VOCÊ (Kewen)
    // O ID do seu log é 555197984859@c.us. Validamos o autor e o remetente direto.
    const ehMeuNumero = msg.from.includes('555197984859') || (msg.author && msg.author.includes('555197984859'));
    
    // Se NÃO for você enviando (ou seja, se for outra pessoa qualquer te chamando no privado), o bot morre aqui e não responde.
    if (!ehMeuNumero && !msg.fromMe) return;

    let textoUsuario = msg.body.trim();
    let conteudoParaIA = [];

    // 🎙️ TRATAMENTO DE ÁUDIO PRIVADO
    if (msg.hasMedia) {
        try {
            console.log('📡 Baixando mídia privada...');
            const media = await msg.downloadMedia();
            if (media && (media.mimetype.includes('audio') || media.mimetype.includes('ogg'))) {
                const mimePuro = media.mimetype.split(';')[0].trim();
                conteudoParaIA.push({
                    inlineData: { data: media.data, mimeType: mimePuro }
                });
                if (!textoUsuario) textoUsuario = "Analise o áudio enviado pelo usuário.";
            }
        } catch (erroMedia) {
            console.error('❌ Erro ao processar o arquivo de áudio:', erroMedia);
        }
    }

    if (!textoUsuario && conteudoParaIA.length === 0) return;

    console.log(`📡 PROCESSANDO SUA MENSAGEM SEGURO: "${textoUsuario || 'Mensagem de voz'}"`);

    try {
        const hoje = new Date().toLocaleDateString('pt-BR');
        let dadosGastos = fs.readFileSync('gastos.json', 'utf-8');
        
        const contextoPrompt = `
        Você é a Aurora, assistente pessoal e gerenciadora de gastos do Kewen. Hoje é dia ${hoje}.
        Histórico de gastos atual em formato JSON:
        ${dadosGastos}
        
        Se houver um áudio anexado, escute e extraia os gastos informados.
        Se ele estiver informando um gasto (ex: "gastei 50 reais no mercado"), adicione OBRIGATORIAMENTE no final da resposta a tag JSON_GASTO seguida do objeto exatamente assim: JSON_GASTO {"data": "${hoje}", "valor": X, "descricao": "Y"}.
        Responda sempre de forma curta, prestativa e usando emojis.
        `;

        const dadosEnvio = [contextoPrompt, textoUsuario];
        if (conteudoParaIA.length > 0) dadosEnvio.push(conteudoParaIA[0]);
        
        console.log('🔮 Chamando Inteligência Artificial Gemini...');
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

        // Responde exatamente no chat onde você disparou o comando
        await client.sendMessage(msg.from, `🔮 *Aurora:* ${respostaIA}`);
        console.log('✅ Resposta enviada com sucesso e com segurança!');

    } catch (error) {
        console.error('❌ Erro geral no processamento:', error);
    }
});

client.initialize();

// SERVIDOR EXPRESS WEB
const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/qrcode.png', (req, res) => {
    if (fs.existsSync('qrcode.png')) res.sendFile(__dirname + '/qrcode.png');
    else res.send('🤖 QR Code indisponível ou já validado.');
});

app.get('/', (req, res) => res.send('🤖 Aurora Bot protegida e ativa!'));
app.listen(PORT, () => console.log(`🌍 Porta: ${PORT}`));
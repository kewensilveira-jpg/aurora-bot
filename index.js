const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const fs = require('fs');
const { GoogleGenerativeAI } = require('@google/generative-ai');

// 🔑 A Railway vai ignorar essa chave debaixo e usar a que você colocou no painel (GEMINI_API_KEY)
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || 'AQ.Ab8RN6JyG4-6CTW6W-HWTBq6H2HBkbp03L_MWEz-mZqkcysqSA';

const ai = new GoogleGenerativeAI(GEMINI_API_KEY);

// 🤖 Mantemos exclusivamente o modelo de última geração que está funcionando na sua API
const modeloPrincipal = ai.getGenerativeModel({ model: 'gemini-2.5-flash' }, { apiVersion: 'v1' });

if (!fs.existsSync('gastos.json') || fs.readFileSync('gastos.json', 'utf-8').trim() === "") {
    fs.writeFileSync('gastos.json', JSON.stringify([], null, 2));
}

console.log('🚀 Iniciando a Aurora (Versão Final de Produção)...');

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

let meuIdProprio = "";

client.on('qr', (qr) => {
    console.log('\n🤖 GERANDO IMAGEM DO QR CODE...');
    
    // Transforma o código do QR em uma imagem de verdade e salva como "qrcode.png"
    const qrcodeImage = require('qr-image');
    const qr_svg = qrcodeImage.image(qr, { type: 'png' });
    qr_svg.pipe(fs.createWriteStream('qrcode.png'));
    
    console.log('✅ Imagem "qrcode.png" gerada na pasta do projeto! Acesse via URL da Railway.');
});

client.on('ready', () => {
    meuIdProprio = client.info.wid._serialized;
    console.log(`\n👤 Seu ID identificado: ${meuIdProprio}`);
    console.log('✅ FORÇA TOTAL: AURORA PRONTA E PRONTINHA NO SEU CHAT!');
});

client.on('message_create', async (msg) => {
    // 1. Segurança Máxima: Só processa se a mensagem envolver o seu número no privado
    if (msg.from !== '555197984859@c.us' && msg.to !== '555197984859@c.us') return;

    // 2. Evita loops: Se a mensagem veio do próprio bot e já tem o cabeçalho dele, ignora
    if (msg.fromMe && msg.body.startsWith('🔮 *Aurora:*')) return;

    // 3. Não responde em grupos para não misturar as coisas
    if (msg.from.endsWith('@g.us') || msg.to.endsWith('@g.us')) return;

    let textoUsuario = msg.body.trim();
    let conteudoParaIA = [];

    // 🎙️ TRATAMENTO DE ÁUDIO
    if (msg.hasMedia) {
        try {
            console.log('📡 Baixando mídia privada...');
            const media = await msg.downloadMedia();
            
            if (media && (media.mimetype.includes('audio') || media.mimetype.includes('ogg'))) {
                console.log('🎙️ Áudio capturado! Formatando para a API...');
                const mimePuro = media.mimetype.split(';')[0].trim();

                conteudoParaIA.push({
                    inlineData: {
                        data: media.data,
                        mimeType: mimePuro
                    }
                });
                
                if (!textoUsuario) {
                    textoUsuario = "Analise o áudio enviado pelo usuário.";
                }
            }
        } catch (erroMedia) {
            console.error('❌ Erro ao processar o arquivo de áudio:', erroMedia);
        }
    }

    if (!textoUsuario && conteudoParaIA.length === 0) return;

    console.log(`📡 PROCESSANDO SUA MENSAGEM: "${textoUsuario || 'Mensagem de voz'}"`);

    try {
        const hoje = new Date().toLocaleDateString('pt-BR');
        
        let dadosGastos = "[]";
        try {
            dadosGastos = fs.readFileSync('gastos.json', 'utf-8');
            JSON.parse(dadosGastos);
        } catch (e) {
            console.log('⚠️ JSON inválido detectado. Resetando arquivo de gastos...');
            fs.writeFileSync('gastos.json', JSON.stringify([], null, 2));
            dadosGastos = "[]";
        }
        
        const contextoPrompt = `
        Você é a Aurora, assistente pessoal e gerenciadora de gastos do Kewen. Hoje é dia ${hoje}.
        Histórico de gastos atual em formato JSON:
        ${dadosGastos}
        
        Se houver um áudio anexado nas mídias, escute e processe o que foi dito. O usuário está falando por voz.
        Se ele estiver informando um gasto (ex: "gastei 50 reais no mercado"), extraia as informações e adicione OBRIGATORIAMENTE no final da resposta a tag JSON_GASTO seguida do objeto exatamente assim: JSON_GASTO {"data": "${hoje}", "valor": X, "descricao": "Y"}.
        Se for outra coisa, responda de forma curta, simpática e usando emojis.
        `;

        const dadosEnvio = [contextoPrompt, textoUsuario];
        if (conteudoParaIA.length > 0) {
            dadosEnvio.push(conteudoParaIA[0]);
        }
        
        let respostaIA = "";

        try {
            console.log('🔮 Enviando dados para o Gemini 2.5-Flash...');
            const result = await modeloPrincipal.generateContent(dadosEnvio);
            respostaIA = result.response.text();
        } catch (erroPrincipal) {
            console.error('❌ Cota estourada ou falha na API do Google:', erroPrincipal.message);
            const destinoErro = meuIdProprio || msg.from;
            await client.sendMessage(destinoErro, `🔮 *Aurora:* Eita Kewen, esbarramos no limite de uso gratuito do Google por hoje!`);
            return;
        }

        if (respostaIA.includes('JSON_GASTO')) {
            const partes = respostaIA.split('JSON_GASTO');
            respostaIA = partes[0].trim();
            try {
                const novoGasto = JSON.parse(partes[1].trim());
                const listaAtual = JSON.parse(dadosGastos);
                listaAtual.push(novoGasto);
                fs.writeFileSync('gastos.json', JSON.stringify(listaAtual, null, 2));
                respostaIA += '\n\n💾 _Gasto anotado!_';
            } catch (err) {
                console.log('Erro ao salvar JSON:', err);
            }
        }

        // 🔥 CORREÇÃO DA NUVEM: Envia direto para o seu ID próprio fixado, sem depender de conversa aberta
        const destinoFinal = meuIdProprio || msg.from;
        await client.sendMessage(destinoFinal, `🔮 *Aurora:* ${respostaIA}`);
        console.log('✅ Resposta enviada para o seu chat próprio!');

    } catch (error) {
        console.error('❌ Erro geral no processamento:', error);
    }
});

client.initialize();

// 🌐 CÓDIGO DO SERVIDOR WEB:
const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/qrcode.png', (req, res) => {
    if (fs.existsSync('qrcode.png')) {
        res.sendFile(__dirname + '/qrcode.png');
    } else {
        res.send('🤖 O QR Code ainda não foi gerado ou já foi escaneado! Atualize a página em alguns segundos.');
    }
});

app.get('/', (req, res) => {
    res.send('🤖 Aurora Bot está online na Railway!');
});

app.listen(PORT, () => {
    console.log(`🌍 Servidor web ativo na porta ${PORT}`);
});
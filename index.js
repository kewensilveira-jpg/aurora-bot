// 🛠️ PROCESSAMENTO EM TEMPO REAL (BLINDAGEM TOTAL ANTI-INVASÃO)
client.on('message_create', async (msg) => {
    
    // 1. Evita loops: Se a resposta começou com o prefixo da Aurora, ignora
    if (msg.fromMe && msg.body.startsWith('🔮 *Aurora:*')) return;

    // 2. Só responde se a mensagem foi enviada por VOCÊ
    if (!msg.fromMe) return;

    // 🔒 A TRAVA DE OURO: Descobre qual é o ID do seu próprio número dinamicamente
    const meuProprioId = client.info.wid._serialized;

    // Se o chat para onde você mandou a mensagem NÃO for o seu próprio chat privado, o bot morre aqui!
    // Isso impede que ela se meta quando você estiver respondendo outras pessoas ou grupos.
    if (msg.to !== meuProprioId) return;

    let textoUsuario = msg.body.trim();
    let conteudoParaIA = [];

    // 🎙️ TRATAMENTO DE ÁUDIO
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

    console.log(`📡 Aurora ativada com segurança no seu chat privado pessoal!`);

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

        // Responde direto no seu chat privado
        await client.sendMessage(meuProprioId, `🔮 *Aurora:* ${respostaIA}`);
        console.log('✅ Resposta enviada apenas para o seu privado!');

    } catch (error) {
        console.error('❌ Erro no processamento:', error);
    }
});
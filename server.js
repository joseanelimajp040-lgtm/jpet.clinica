// server.js ATUALIZADO PARA USAR GOOGLE GEMINI

require('dotenv').config();
const express = require('express');
const cors = require('cors');
// Importa a biblioteca do Google Gemini
const { GoogleGenerativeAI } = require('@google/generative-ai');

// Configuração do servidor
const app = express();
app.use(cors());
app.use(express.json());

// Validação da Chave de API
if (!process.env.GEMINI_API_KEY) {
    throw new Error('A variável de ambiente GEMINI_API_KEY não foi definida.');
}

// Configuração do Google Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest" });

// O "cérebro" da Marrie: define a personalidade dela para o Gemini
const marrieSystemPrompt = `
    Sua persona é 'Marrie'. Você é uma gatinha assistente virtual amigável, atenciosa e especialista 
    nos produtos e serviços da petshop J.A Pet. 
    Seu objetivo é ajudar os usuários a tirarem suas dúvidas sobre a J.A Pet.

**REGRA MAIS IMPORTANTE:A J.A Pet possui APENAS UMA ÚNICA UNIDADE.NUNCA pergunte de qual "loja" ou "unidade" o usuário está falando. Todas as informações abaixo referem-se a essa única loja.**

    Seja sempre educada e use emojis de animais como 🐾, 🐕, ou 🐈 quando apropriado.
    Responda de forma concisa. 
    Se você não souber a resposta, diga que não tem essa informação e sugira 
    contato pelo WhatsApp da loja. Não invente informações.
`;
 //INÍCIO DA BASE DE CONHECIMENTO J.A PET ---

    ## HORÁRIO DE FUNCIONAMENTO ##
    - Segunda a Sexta: 8h às 20h
    - Sábados: 8h às 20h
    - Domingos: 8h às 13h 
    - Feriados: Verificar nossa disponibilidade no instagram @j.a.petshop

    ## TAXAS DE ENTREGA ##
    - Valentina: R$ 5,00
    - Parque do Sol: R$ 5,00
    - Mangabeira : R$ 10,00
    - José Americo : R$ 10,00
    - Para outros bairros, o usuário deve consultar pelo WhatsApp.

    ## MÉTODOS DE PAGAMENTO ##
    - Pix
    - Cartão de Crédito e Débito (Visa, Mastercard, Elo)
    - Dinheiro (troco na entrega)

    ## ENDEREÇO E CONTATO ##
    - Endereço: Rua Mariangela Lucena Peixoto N,97 João Pessoa - PB
    - WhatsApp: (83) 98853-1135

// FIM DA BASE DE CONHECIMENTO J.A PET ---
`;
// Inicia o chat com as instruções de persona
const chat = model.startChat({
    history: [
        { role: "user", parts: [{ text: "Olá, vamos definir sua personalidade." }] },
        { role: "model", parts: [{ text: `Entendido. Eu sou a Marrie. ${marrieSystemPrompt}` }] },
    ],
    generationConfig: {
        maxOutputTokens: 200, // Limita o tamanho da resposta
    },
});

// Cria o endpoint /api/chat que o frontend irá chamar
app.post('/api/chat', async (req, res) => {
    try {
        const userMessage = req.body.message;

        if (!userMessage) {
            return res.status(400).json({ error: 'Mensagem não fornecida.' });
        }
        
        // Envia a mensagem do usuário para o Gemini
        const result = await chat.sendMessage(userMessage);
        const response = await result.response;
        const aiReply = response.text();

        res.json({ reply: aiReply });

    } catch (error) {
        console.error('Erro na API do Gemini:', error);
        res.status(500).json({ error: 'Falha ao se comunicar com a inteligência artificial.' });
    }
});

// Inicia o servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});



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
// server.js

// O "cérebro" da Marrie: VERSÃO FINAL COM CONHECIMENTO GERAL
const marrieSystemPrompt = `
    Sua persona é 'Marrie'. Você é uma assistente virtual amigável, atenciosa e especialista 
    nos produtos e serviços da petshop J.A Pet. 

    **SUAS REGRAS DE COMPORTAMENTO:**

    **1. PRIORIDADE MÁXIMA - CONHECIMENTO DA J.A PET:** Se a pergunta do usuário for sobre a J.A Pet (horários, endereço, entregas, pagamentos, ou produtos específicos listados na sua base de conhecimento), você DEVE responder usando APENAS as informações contidas na "BASE DE CONHECIMENTO J.A PET" abaixo. Nunca invente ou use conhecimento externo para falar sobre a J.A Pet.

    **2. CONHECIMENTO GERAL:** Se a pergunta do usuário for sobre um tópico geral que NÃO está diretamente relacionado à J.A Pet (exemplos: "dicas para cuidar de filhotes", "qual a melhor raça de cão para apartamento?", "me conte uma curiosidade sobre gatos"), você ESTÁ AUTORIZADA a usar seu conhecimento geral para dar uma resposta útil e amigável.

    **3. PERSONA CONSISTENTE:** Mesmo ao responder sobre tópicos gerais, mantenha sua persona de Marrie: amigável, atenciosa e com emojis de animais (🐾, 🐕, 🐈).

    **4. REGRA DA LOJA ÚNICA:** A J.A Pet possui APENAS UMA ÚNICA UNIDADE. NUNCA pergunte de qual "loja" ou "unidade" o usuário está falando.

    **5. SEGURANÇA:** Em caso de dúvida sobre uma resposta ou se a pergunta for muito complexa, sempre termine sugerindo que o usuário entre em contato pelo WhatsApp da loja para obter ajuda de um humano.

    --- INÍCIO DA BASE DE CONHECIMENTO J.A PET ---

    ## HORÁRIO DE FUNCIONAMENTO ##
    - Segunda a Sexta: 8h às 18h
    - Sábados: 8h às 14h
    - Domingos e Feriados: Fechado

    ## TAXAS DE ENTREGA ##
    - Bairro A: R$ 5,00
    - Bairro B: R$ 7,00
    - Bairro C: R$ 10,00
    - Para outros bairros, o usuário deve consultar pelo WhatsApp.

    ## MÉTODOS DE PAGAMENTO ##
    - Pix
    - Cartão de Crédito e Débito (Visa, Mastercard, Elo)
    - Dinheiro

    ## ENDEREÇO E CONTATO ##
    - Endereço: Rua dos Pets Felizes, 123, Bairro dos Animais, João Pessoa - PB
    - WhatsApp: (83) 98853-1133

    --- FIM DA BASE DE CONHECIMENTO J.A PET ---
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




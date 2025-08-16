// server.js

// Importa as bibliotecas necessárias
const express = require('express');
const { OpenAI } = require('openai');

// Configuração do servidor
const app = express();
app.use(express.json()); // Permite que o servidor entenda JSON

// Configuração da OpenAI
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY, // BUSQUE SUA CHAVE DE UMA VARIÁVEL DE AMBIENTE
});

// O "cérebro" da Marrie: define a personalidade dela
const marrieSystemPrompt = `
    Você é a 'Marrie', uma assistente virtual amigável, atenciosa e especialista 
    nos produtos e serviços da petshop J.A Pet. 
    Seu objetivo é ajudar os usuários a tirarem suas dúvidas sobre a J.A Pet.
    Seja sempre educada e use emojis de animais como 🐾, 🐕, ou 🐈 quando apropriado.
    Responda de forma concisa. 
    Se você não souber a resposta, diga que não tem essa informação e sugira 
    contato pelo WhatsApp da loja. Não invente informações.
`;

// Cria o endpoint /api/chat que o frontend irá chamar
app.post('/api/chat', async (req, res) => {
    try {
        const userMessage = req.body.message;

        if (!userMessage) {
            return res.status(400).json({ error: 'Mensagem não fornecida.' });
        }

        const completion = await openai.chat.completions.create({
            model: "gpt-3.5-turbo", // Ou o modelo que preferir
            messages: [
                { role: "system", content: marrieSystemPrompt },
                { role: "user", content: userMessage }
            ],
        });

        const aiReply = completion.choices[0].message.content;
        res.json({ reply: aiReply });

    } catch (error) {
        console.error('Erro na API da OpenAI:', error);
        res.status(500).json({ error: 'Falha ao se comunicar com a inteligência artificial.' });
    }
});

// Inicia o servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});
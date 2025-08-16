// server.js - VERSÃO NOVA E MAIS ROBUSTA

require('dotenv').config();
const express = require('express');
const cors = require('cors');
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

// O "cérebro" da Marrie: nossa base de conhecimento e regras.
const marrieSystemPrompt = `
    Sua persona é 'Marrie'. Você é uma assistente virtual amigável, atenciosa e especialista 
    nos produtos e serviços da petshop J.A Pet. 
    Seu objetivo é ajudar os usuários a tirarem suas dúvidas sobre a J.A Pet.

    REGRA MAIS IMPORTANTE: A J.A Pet possui APENAS UMA ÚNICA UNIDADE. NUNCA pergunte de qual "loja" ou "unidade" o usuário está falando. Todas as informações abaixo referem-se a essa única loja.

    Seja sempre educada e use emojis de animais como 🐾, 🐕, ou 🐈 quando apropriado.
    Responda de forma concisa. 
    Se você não souber a resposta para algo que não está na sua base de conhecimento abaixo, 
    diga que não tem essa informação e sugira contato pelo WhatsApp da loja. Não invente informações.

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

// ========== BANCO DE DADOS DE PRODUTOS ==========
const productDatabase = {
    "guabi natural": {
        nome: "Ração Guabi Natural para Cães Adultos Sabor Frango e Arroz",
        detalhes: `Composição: Carne de frango, arroz integral, vegetais. Níveis de Garantia: Proteína Bruta (mín.): 23%, Extrato Etéreo (Gordura) (mín.): 12%, Matéria Fibrosa (máx.): 3%, Umidade (máx.): 10%. Indicação: Alimento completo para cães adultos de raças médias.`
    },
    "nexgard": {
        nome: "NexGard Antipulgas e Carrapatos para Cães",
        detalhes: `Princípio Ativo: Afoxolaner. Indicação: Tratamento e prevenção de infestações por pulgas e carrapatos em cães. Ação: Início rápido, atinge 100% de eficácia em 8 horas para pulgas. Apresentação: Tablete mastigável sabor carne. Frequência: Administrar oralmente uma vez por mês.`
    },
};

function findProductInfo(userMessage) {
    const message = userMessage.toLowerCase();
    for (const keyword in productDatabase) {
        if (message.includes(keyword)) {
            return productDatabase[keyword].detalhes;
        }
    }
    return null;
}

// ROTA DE CHAT ATUALIZADA
app.post('/api/chat', async (req, res) => {
    try {
        const userMessage = req.body.message;
        if (!userMessage) {
            return res.status(400).json({ error: 'Mensagem não fornecida.' });
        }

        const productInfo = findProductInfo(userMessage);
        let finalUserMessage = userMessage;

        if (productInfo) {
            finalUserMessage = `Use estritamente a base de conhecimento abaixo para responder à pergunta do usuário. Não use nenhuma outra informação que você conheça. --- Base de Conhecimento do Produto --- ${productInfo} --- Fim da Base de Conhecimento --- Pergunta do usuário: "${userMessage}"`;
        }
        
        // NOVA ESTRUTURA DA REQUISIÇÃO
        const contents = [
            { role: "user", parts: [{ text: marrieSystemPrompt + "\n\n Pergunta do usuário: " + finalUserMessage }] }
        ];

        const result = await model.generateContent({ contents });
        const response = result.response;
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

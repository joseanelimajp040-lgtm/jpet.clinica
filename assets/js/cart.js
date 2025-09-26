// cart.js (VERSÃO FINAL CORRIGIDA)

function setupModalListeners() {
    const shippingInfoBtn = document.getElementById('shipping-info-btn');
    const shippingModal = document.getElementById('shipping-modal');
    const modalCloseBtn = shippingModal?.querySelector('.modal-close');

    if (shippingInfoBtn && shippingModal) {
        shippingInfoBtn.addEventListener('click', () => {
            shippingModal.style.display = 'flex';
        });
    }
    if (modalCloseBtn) {
        modalCloseBtn.addEventListener('click', () => {
            shippingModal.style.display = 'none';
        });
    }
    if (shippingModal) {
        shippingModal.addEventListener('click', (e) => {
            if (e.target === shippingModal) {
                shippingModal.style.display = 'none';
            }
        });
    }
}

export function initCartPageListeners(state, dependencies) {
    setupModalListeners();

    const cepSearchBtn = document.getElementById('cep-search-btn');
    if (cepSearchBtn) {
        cepSearchBtn.addEventListener('click', () => {
            dependencies.handleCepSearch();
        });
    }

    const cepInput = document.getElementById('cep-input');
    if (cepInput) {
        cepInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                dependencies.handleCepSearch();
            }
        });
    }
    
   const confirmShippingBtn = document.getElementById('confirm-shipping-btn');
if (confirmShippingBtn) {
    confirmShippingBtn.addEventListener('click', () => {
        // Seleciona os campos e o local para exibir mensagens de erro
        const numberInput = document.getElementById('address-number');
        const feedbackEl = document.getElementById('cep-feedback'); // Reutilizando o campo de feedback

        // Pega o valor do campo "Número" e remove espaços em branco
        const numberValue = numberInput ? numberInput.value.trim() : '';

        // Limpa erros anteriores
        numberInput.classList.remove('border-red-500'); // Remove a borda vermelha se houver
        if (feedbackEl) feedbackEl.innerHTML = '';

        // **Aqui está a validação!**
        if (!numberValue) {
            if (feedbackEl) {
                feedbackEl.innerHTML = `<span class="text-red-500 font-semibold">Por favor, preencha o campo "Número".</span>`;
            }
            numberInput.classList.add('border-red-500'); // Adiciona uma borda vermelha para destacar o erro
            numberInput.focus(); // Foca no campo para o usuário corrigir
            return; // Para a execução da função aqui
        }

        // Se a validação passar, o código continua normalmente
        const neighborhoodValue = document.getElementById('address-neighborhood')?.value || '';
        const shippingData = {
            cep: document.getElementById('cep-input')?.value,
            street: document.getElementById('address-street')?.value,
            number: numberValue, // Usa o valor já validado
            complement: document.getElementById('address-complement')?.value,
            neighborhood: neighborhoodValue,
            fee: dependencies.getShippingFee(neighborhoodValue)
        };

        Object.assign(state.shipping, shippingData);

        document.getElementById('shipping-modal').style.display = 'none';
        dependencies.updateTotals();
    });
}

// ✅ FUNÇÃO RESTAURADA: Esta função precisa existir e ser exportada,
// pois o main.js tenta importá-la. Mesmo que esteja vazia por enquanto,
// ela evita o erro de importação.
export function initCheckoutPageListeners(state) {
    // Listeners específicos para a página de checkout podem ser adicionados aqui no futuro.
    console.log("Listeners da página de Checkout iniciados.");
}


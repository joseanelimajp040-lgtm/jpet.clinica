// cart.js (VERSÃO CORRIGIDA)

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

// ✅ MODIFICAÇÃO 1: A função agora aceita o objeto 'dependencies' que vem do main.js
export function initCartPageListeners(state, dependencies) {
    setupModalListeners();

    // Listener para o botão de busca de CEP dentro do modal
    const cepSearchBtn = document.getElementById('cep-search-btn');
    if (cepSearchBtn) {
        // ✅ MODIFICAÇÃO 2: Chamamos a função 'handleCepSearch' diretamente
        cepSearchBtn.addEventListener('click', () => {
            dependencies.handleCepSearch();
        });
    }

    // Listener para a tecla Enter no campo de CEP
    const cepInput = document.getElementById('cep-input');
    if (cepInput) {
        cepInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                // ✅ MODIFICAÇÃO 3: Também chamamos a função aqui
                dependencies.handleCepSearch();
            }
        });
    }
    
    // Listener para o botão de confirmação de frete
    const confirmShippingBtn = document.getElementById('confirm-shipping-btn');
    if (confirmShippingBtn) {
        confirmShippingBtn.addEventListener('click', () => {
            const shippingData = {
                cep: document.getElementById('cep-input')?.value,
                street: document.getElementById('address-street')?.value,
                number: document.getElementById('address-number')?.value,
                complement: document.getElementById('address-complement')?.value,
                neighborhood: document.getElementById('address-neighborhood')?.value,
                // Adicione city e state se eles forem retornados e existirem no modal
                fee: dependencies.getShippingFee(document.getElementById('address-neighborhood')?.value || '')
            };
            
            // Atualiza o estado global no main.js
            Object.assign(state.shipping, shippingData);
            
            // Fecha o modal e atualiza os totais
            document.getElementById('shipping-modal').style.display = 'none';
            dependencies.updateTotals();
        });
    }
}

export function initCartPageListeners() {
    // Chama a função para configurar os gatilhos do modal
    setupModalListeners();

    // Listener principal para ações do carrinho e do modal
    document.body.addEventListener('click', e => {
        // --- Ações que você já tinha (permanecem iguais) ---
        if (e.target.closest('.remove-from-cart')) {
            const id = e.target.closest('.remove-from-cart').dataset.id;
            document.dispatchEvent(new CustomEvent('removeFromCart', { detail: { id } }));
        }
        if (e.target.closest('.quantity-change')) {
            const button = e.target.closest('.quantity-change');
            const id = button.dataset.id;
            const change = parseInt(button.dataset.change);
            document.dispatchEvent(new CustomEvent('updateQuantity', { detail: { id, change } }));
        }
        if (e.target.closest('#clear-cart-btn')) {
            document.dispatchEvent(new Event('clearCart'));
        }
        if (e.target.closest('#checkout-btn')) {
            document.dispatchEvent(new Event('goToCheckout'));
        }

        // --- NOVAS AÇÕES PARA O MODAL DE CEP ---

        // 1. Quando o usuário clica em "Buscar" CEP
        if (e.target.closest('#cep-search-btn')) {
            const cepValue = document.getElementById('cep-input')?.value;
            if (cepValue) {
                // Despacha um evento com o CEP para o main.js processar
                document.dispatchEvent(new CustomEvent('searchCep', { detail: { cep: cepValue } }));
            }
        }

        // 2. Quando o usuário clica em "Confirmar Endereço e Frete"
        if (e.target.closest('#confirm-shipping-btn')) {
            // Coleta todos os dados do formulário do modal
            const shippingData = {
                cep: document.getElementById('cep-input')?.value,
                street: document.getElementById('address-street')?.value,
                number: document.getElementById('address-number')?.value,
                complement: document.getElementById('address-complement')?.value,
                neighborhood: document.getElementById('address-neighborhood')?.value,
            };
            // Despacha um evento com todos os dados para o main.js salvar no estado
            document.dispatchEvent(new CustomEvent('shippingConfirmed', { detail: shippingData }));
        }
    });

    // Adiciona listener para a tecla Enter no campo de CEP
    const cepInput = document.getElementById('cep-input');
    if (cepInput) {
        cepInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                document.dispatchEvent(new CustomEvent('searchCep', { detail: { cep: e.target.value } }));
            }
        });
    }
}
export function initCheckoutPageListeners() {
}

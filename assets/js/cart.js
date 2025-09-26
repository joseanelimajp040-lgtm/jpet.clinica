// cart.js (VERSÃO ATUALIZADA)

// NOVO: Adicione as funções de abrir/fechar o modal aqui para manter a lógica de UI centralizada.
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

// Sua função initCheckoutPageListeners está ótima e não precisa de alterações.
export function initCheckoutPageListeners() {
    // ... (seu código original aqui, sem mudanças)
}

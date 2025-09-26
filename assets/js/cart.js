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
export function initCheckoutPageListeners() {
    const cepInput = document.getElementById('cep');
    if (cepInput) {
        cepInput.addEventListener('input', async (e) => {
            const cepValue = e.target.value.replace(/\D/g, '');
            if (cepValue.length !== 8) return;
            
            const cepLoader = document.getElementById('cep-loader');
            const addressInput = document.getElementById('address');
            const numberInput = document.getElementById('number');

            cepLoader.classList.remove('hidden');
            cepInput.disabled = true;
            try {
                const response = await fetch(`https://viacep.com.br/ws/${cepValue}/json/`);
                const data = await response.json();
                if (data.erro) {
                    alert('CEP não encontrado.');
                } else {
                    const setFieldValue = (el, val) => { if(el) el.value = val; };
                    setFieldValue(addressInput, data.logradouro);
                    setFieldValue(document.getElementById('neighborhood'), data.bairro);
                    setFieldValue(document.getElementById('city'), data.localidade);
                    setFieldValue(document.getElementById('state'), data.uf);
                    numberInput.focus();
                }
            } catch (err) {
                console.error("Erro ao buscar CEP:", err);
            } finally {
                cepLoader.classList.add('hidden');
                cepInput.disabled = false;
            }
        });
    }

    const paymentMethodSelector = document.getElementById('payment-method-selector');
    if (paymentMethodSelector) {
        paymentMethodSelector.addEventListener('click', (e) => {
            const selectedOption = e.target.closest('.payment-option');
            if (!selectedOption) return;
            paymentMethodSelector.querySelectorAll('.payment-option').forEach(opt => opt.classList.remove('selected'));
            selectedOption.classList.add('selected');
            const method = selectedOption.dataset.method;
            document.getElementById('pix-info').classList.toggle('hidden', method !== 'pix');
            document.getElementById('credit-card-info').classList.toggle('hidden', method !== 'credit');
            document.getElementById('debit-card-info').classList.toggle('hidden', method !== 'debit');
        });
    }

    const confirmBtn = document.getElementById('confirm-purchase-btn');
    if(confirmBtn) confirmBtn.addEventListener('click', () => document.dispatchEvent(new Event('confirmPurchase')));
}

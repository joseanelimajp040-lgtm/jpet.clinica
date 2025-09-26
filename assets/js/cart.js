export function initCartPageListeners(state, utils) {
    const { handleCepSearch, getShippingFee, formatCurrency, updateTotals } = utils;

    // Listeners que já existiam
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
    
    // NOVOS Listeners para o formulário de CEP
    const cepSearchBtn = document.getElementById('cep-search-btn');
    const cepInput = document.getElementById('cep-input');
    const confirmShippingBtn = document.getElementById('confirm-shipping-btn');

    if (cepSearchBtn) {
        cepSearchBtn.addEventListener('click', handleCepSearch);
    }
    if (cepInput) {
        cepInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                handleCepSearch();
            }
        });
    }
    if (confirmShippingBtn) {
        confirmShippingBtn.addEventListener('click', () => {
            const neighborhood = document.getElementById('address-neighborhood').value;
            const fee = getShippingFee(neighborhood);

            if (fee !== null) {
                // Atualiza o estado global da aplicação
                state.shipping = {
                    fee: fee,
                    cep: document.getElementById('cep-input').value,
                    street: document.getElementById('address-street').value,
                    number: document.getElementById('address-number').value,
                    complement: document.getElementById('address-complement').value,
                    neighborhood: neighborhood,
                    city: 'João Pessoa', // ViaCEP retorna a cidade
                    state: 'PB' // ViaCEP retorna o estado
                };
                
                // Fecha o modal e atualiza os totais
                shippingModal.style.display = 'none';
                updateTotals();
            } else {
                alert("Não é possível confirmar, pois este bairro não é atendido.");
            }
        });
    }
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


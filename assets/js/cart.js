export function initCartPageListeners() {
    document.body.addEventListener('click', e => {
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
    });
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
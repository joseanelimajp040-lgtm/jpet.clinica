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
    
    // ----- Lógica de Frete (existente) -----
    // (Mantive sua lógica de frete exatamente como estava)
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
            const neighborhoodValue = document.getElementById('address-neighborhood')?.value || '';
            const shippingData = {
                cep: document.getElementById('cep-input')?.value,
                street: document.getElementById('address-street')?.value,
                number: document.getElementById('address-number')?.value,
                complement: document.getElementById('address-complement')?.value,
                neighborhood: neighborhoodValue,
                fee: dependencies.getShippingFee(neighborhoodValue)
            };
            
            Object.assign(state.shipping, shippingData);
            
            document.getElementById('shipping-modal').style.display = 'none';
            dependencies.updateTotals();
        });
    }

    // ----- Lógica de Cupom (NOVA) -----
    const couponToggleLink = document.getElementById('coupon-toggle');
    if (couponToggleLink) {
        couponToggleLink.addEventListener('click', (e) => {
            // Se o clique foi no botão remover, a lógica será tratada por outra função
            if (e.target.closest('#remove-coupon-btn')) {
                e.preventDefault();
                dependencies.removeCoupon();
                return;
            }
            // Se o clique foi no link "Tem um cupom?", abre/fecha o formulário
            e.preventDefault();
            document.getElementById('coupon-form-container').classList.toggle('active');
        });
    }

    const applyCouponBtn = document.getElementById('apply-coupon-btn');
    if (applyCouponBtn) {
        applyCouponBtn.addEventListener('click', () => {
            dependencies.applyCoupon();
        });
    }

    const couponInput = document.getElementById('coupon-input');
    if (couponInput) {
        couponInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                dependencies.applyCoupon();
            }
        });
    }

    // Chama a função para garantir que a UI do cupom esteja correta ao carregar a página
    dependencies.updateCouponUI();
}

// ✅ FUNÇÃO RESTAURADA: Esta função precisa existir e ser exportada,
// pois o main.js tenta importá-la. Mesmo que esteja vazia por enquanto,
// ela evita o erro de importação.
export function initCheckoutPageListeners(state) {
    // Listeners específicos para a página de checkout podem ser adicionados aqui no futuro.
    console.log("Listeners da página de Checkout iniciados.");
}


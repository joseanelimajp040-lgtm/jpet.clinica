// Funções auxiliares que não precisam ser exportadas
function openModal(modal) {
    if (modal) modal.style.display = 'flex';
}

function closeModal(modal) {
    if (modal) modal.style.display = 'none';
}

// Função principal que será exportada
export function initPageModals() {
    document.querySelectorAll('.modal').forEach(modal => {
        const closeBtn = modal.querySelector('.modal-close');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => closeModal(modal));
        }
        modal.addEventListener('click', e => {
            if (e.target === modal) closeModal(modal);
        });
    });

    // Gatilhos que abrem os modals
    document.body.addEventListener('click', e => {
        // Modal de Adoção de Cães
        if (e.target.closest('#caes-adocao-btn')) {
            e.preventDefault();
            openModal(document.getElementById('adocao-caes-modal'));
        }
        // Modal de Adoção de Gatos
        if (e.target.closest('#gatos-adocao-btn')) {
            e.preventDefault();
            openModal(document.getElementById('adocao-gatos-modal'));
        }

        // Modal de Rações
        if (e.target.closest('#racao-btn') || e.target.closest('#racao-btn-nav') || e.target.closest('#racao-btn-dropdown')) {
            e.preventDefault();
            openModal(document.getElementById('racao-modal'));
        }

        // <<< INÍCIO DA CORREÇÃO >>>
        // Modal de Medicamentos (agora verifica os 3 botões possíveis)
        if (e.target.closest('#medicamentos-btn-nav') || e.target.closest('#medicamentos-btn-dropdown') || e.target.closest('#medicamentos-cat-btn')) {
            e.preventDefault();
            openModal(document.getElementById('medicamentos-modal'));
        }
        // <<< FIM DA CORREÇÃO >>>

        // Modal de Frete no Carrinho
        if (e.target.closest('#shipping-info-btn')) {
             openModal(document.getElementById('shipping-modal'));
        }
        // Navegação entre modals de ração
        const animalOption = e.target.closest('.animal-option');
        if (animalOption && animalOption.closest('#racao-modal')) {
             closeModal(document.getElementById('racao-modal'));
             const animal = animalOption.dataset.animal;
             if (animal === 'cao') openModal(document.getElementById('racao-caes-tipo-modal'));
             if (animal === 'gato') openModal(document.getElementById('racao-gatos-tipo-modal'));
             if (animal === 'outros') openModal(document.getElementById('racao-outros-tipo-modal'));
        }
        // Botão de voltar nos sub-modals
        if (e.target.closest('.modal-back')) {
            closeModal(e.target.closest('.modal'));
            openModal(document.getElementById('racao-modal'));
        }
        // Seleção de frete
        const shippingOption = e.target.closest('.shipping-option');
        if(shippingOption) {
            const detail = {
                fee: parseFloat(shippingOption.dataset.fee),
                neighborhood: shippingOption.querySelector('h3').textContent.trim()
            };
            document.dispatchEvent(new CustomEvent('shippingSelected', { detail }));
            closeModal(document.getElementById('shipping-modal'));
        }
    });
}

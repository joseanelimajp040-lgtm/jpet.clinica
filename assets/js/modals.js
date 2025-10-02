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
        // --- Abertura dos Modais Principais ---
        if (e.target.closest('#medicamentos-cat-btn')) {
            e.preventDefault();
            openModal(document.getElementById('medicamentos-modal'));
        }
        if (e.target.closest('#racao-btn')) {
            e.preventDefault();
            openModal(document.getElementById('racao-modal'));
        }
        if (e.target.closest('#antipulgas-cat-btn')) {
            e.preventDefault();
            openModal(document.getElementById('antipulgas-modal'));
        }
        if (e.target.closest('#vacinas-cat-btn')) {
            e.preventDefault();
            openModal(document.getElementById('vacinas-modal'));
        }
        if (e.target.closest('#caes-adocao-btn')) {
            e.preventDefault();
            openModal(document.getElementById('adocao-caes-modal'));
        }
        if (e.target.closest('#gatos-adocao-btn')) {
            e.preventDefault();
            openModal(document.getElementById('adocao-gatos-modal'));
        }

        // --- Lógica de Navegação Interna dos Modais ---
        const animalOption = e.target.closest('.animal-option');
        if (animalOption) {
            const currentModal = animalOption.closest('.modal');
            if (!currentModal) return;

            // Navegação do Modal de Rações
            if (currentModal.id === 'racao-modal') {
                closeModal(currentModal);
                const animal = animalOption.dataset.animal;
                if (animal === 'cao') openModal(document.getElementById('racao-caes-tipo-modal'));
                if (animal === 'gato') openModal(document.getElementById('racao-gatos-tipo-modal'));
                if (animal === 'outros') openModal(document.getElementById('racao-outros-tipo-modal'));
            }

            // <<< NOVA LÓGICA: Navegação do Modal de Medicamentos >>>
            if (currentModal.id === 'medicamentos-modal') {
                closeModal(currentModal);
                const animal = animalOption.dataset.animal;
                if (animal === 'cao') openModal(document.getElementById('medicamentos-caes-tipo-modal'));
                if (animal === 'gato') openModal(document.getElementById('medicamentos-gatos-tipo-modal'));
                // if (animal === 'outros') openModal(...); // Adicionar se criar o modal para outros pets
            }
            
            // <<< NOVA LÓGICA: Navegação do Modal de Antipulgas >>>
            if (currentModal.id === 'antipulgas-modal') {
                closeModal(currentModal);
                const animal = animalOption.dataset.animal;
                if (animal === 'cao') openModal(document.getElementById('antipulgas-caes-tipo-modal'));
                if (animal === 'gato') openModal(document.getElementById('antipulgas-gatos-tipo-modal'));
            }
        }
        
        // --- Lógica do Botão Voltar (MELHORADA) ---
        if (e.target.closest('.modal-back')) {
            const currentModal = e.target.closest('.modal');
            // Usamos o atributo 'data-parent-modal' que adicionamos no HTML
            const parentModalId = currentModal.dataset.parentModal; 
            closeModal(currentModal);
            if (parentModalId) {
                openModal(document.getElementById(parentModalId));
            }
        }

        // --- Lógicas Finais (permanecem as mesmas) ---
        const categorySearchBtn = e.target.closest('[data-category-search]');
        if (categorySearchBtn) {
            e.preventDefault();
            const category = categorySearchBtn.dataset.categorySearch;
            const modal = categorySearchBtn.closest('.modal');
            closeModal(modal);
            const searchEvent = new CustomEvent('navigateToSearch', { detail: { category: category } });
            document.dispatchEvent(searchEvent);
        }

        if (e.target.closest('#shipping-info-btn')) {
             openModal(document.getElementById('shipping-modal'));
        }
        
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



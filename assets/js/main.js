import { initSlider, initComparisonSlider } from './slider.js';
import { initPageModals } from './modals.js';
import { initCartPageListeners, initCheckoutPageListeners } from './cart.js';

document.addEventListener('DOMContentLoaded', () => {
    console.log("DOM carregado. Iniciando script principal...");

    // --- STATE & DOM REFERENCES ---
    const state = {
        cart: JSON.parse(localStorage.getItem('cart')) || [],
        users: JSON.parse(localStorage.getItem('users')) || [],
        loggedInUser: JSON.parse(sessionStorage.getItem('loggedInUser')) || null,
        favorites: JSON.parse(localStorage.getItem('favorites')) || [],
        appointments: JSON.parse(localStorage.getItem('groomingAppointments')) || [],
        shipping: { fee: 0, neighborhood: '' }
    };
    const appRoot = document.getElementById('app-root');
    const loadingOverlay = document.getElementById('loading-overlay');

    // --- FUNÇÕES ---
    // (Todas as suas funções de renderização e auxiliares vão aqui)
    const formatCurrency = (val) => parseFloat(val).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    const save = {
        cart: () => { console.log("Salvando carrinho..."); localStorage.setItem('cart', JSON.stringify(state.cart)); },
        favorites: () => { console.log("Salvando favoritos..."); localStorage.setItem('favorites', JSON.stringify(state.favorites)); },
        appointments: () => localStorage.setItem('groomingAppointments', JSON.stringify(state.appointments)),
        login: (user) => { state.loggedInUser = user; sessionStorage.setItem('loggedInUser', JSON.stringify(user)); },
        logout: () => { state.loggedInUser = null; sessionStorage.removeItem('loggedInUser'); }
    };
    function showAnimation(overlayId, duration, callback) {
        const overlay = document.getElementById(overlayId);
        if (overlay) {
            overlay.style.display = 'flex';
            setTimeout(() => {
                overlay.style.display = 'none';
                if (callback) callback();
            }, duration);
        }
    }
    function updateCounters() {
        const cartCountEl = document.getElementById('cart-count');
        const favCountEl = document.getElementById('favorites-count');
        const totalItems = state.cart.reduce((sum, item) => sum + item.quantity, 0);
        if (cartCountEl) cartCountEl.textContent = totalItems;
        if (favCountEl) favCountEl.textContent = state.favorites.length;
    }
    function renderCart() {
        const container = document.getElementById('cart-items-container');
        if (!container) return;
        container.innerHTML = '';
        if (state.cart.length === 0) {
            container.innerHTML = '<div class="bg-white p-4 rounded-lg shadow-sm"><p class="text-gray-600">Seu carrinho está vazio.</p></div>';
            document.getElementById('clear-cart-btn')?.classList.add('hidden');
        } else {
            document.getElementById('clear-cart-btn')?.classList.remove('hidden');
            state.cart.forEach(item => {
                container.insertAdjacentHTML('beforeend', `
                <div class="flex flex-col md:flex-row items-center bg-white p-4 rounded-lg shadow-sm gap-4">
                    <img src="${item.image}" alt="${item.name}" class="w-24 h-24 object-contain rounded-md">
                    <div class="flex-1"><h3 class="font-bold text-gray-800">${item.name}</h3><p class="text-sm text-gray-500">Preço: ${formatCurrency(item.price)}</p></div>
                    <div class="flex items-center gap-2 border border-black rounded-full px-2"><button class="quantity-change text-lg font-bold text-primary" data-id="${item.id}" data-change="-1">-</button><input type="number" value="${item.quantity}" readonly class="w-12 text-center font-bold bg-transparent"><button class="quantity-change text-lg font-bold text-primary" data-id="${item.id}" data-change="1">+</button></div>
                    <div class="font-bold text-gray-800 w-24 text-center">${formatCurrency(item.price * item.quantity)}</div>
                    <button class="remove-from-cart text-red-500" data-id="${item.id}"><i class="fas fa-trash-alt"></i></button>
                </div>`);
            });
        }
        updateTotals();
    }
    // ... Coloque aqui as outras funções render, como renderFavoritesPage, etc.
    function updateTotals() { /* ... */ }
    function renderFavoritesPage() { /* ... */ }
    function updateLoginStatus() { /* ... */ }
    function updateAllHeartIcons() { /* ... */ }
    function renderCheckoutSummary() { /* ... */ }
    function renderCalendar() { /* ... */ }
    function initBanhoTosaEventListeners() { /* ... */ }
    function handleAddToCart(event) { /* ... */ }
    function handleFavoriteToggle(event) { /* ... */ }

    // --- CARREGAMENTO DE PÁGINAS ---
    async function loadComponent(url, placeholderId) {
        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error(`Failed to load ${url}`);
            document.getElementById(placeholderId).innerHTML = await response.text();
        } catch (error) { console.error(error); }
    }
    async function loadPage(pageName) {
        loadingOverlay.style.display = 'flex';
        try {
            const response = await fetch(`pages/${pageName}.html`);
            if (!response.ok) throw new Error(`Página não encontrada: ${pageName}.html`);
            appRoot.innerHTML = await response.text();
            
            switch (pageName) {
                case 'home': initSlider(); initComparisonSlider(); updateAllHeartIcons(); break;
                case 'cart': renderCart(); initCartPageListeners(); break;
                case 'checkout': renderCheckoutSummary(); initCheckoutPageListeners(); break;
                case 'favorites': renderFavoritesPage(); updateAllHeartIcons(); break;
                case 'banho-e-tosa': renderCalendar(); initBanhoTosaEventListeners(); break;
            }
            initPageModals();
        } catch (error) {
            console.error('Falha ao carregar a página:', error);
            appRoot.innerHTML = `<p class="text-red-500 text-center py-20">Erro ao carregar a página. Verifique o console.</p>`;
        } finally {
            setTimeout(() => loadingOverlay.style.display = 'none', 300);
            window.scrollTo(0, 0);
        }
    }

    // --- INICIALIZAÇÃO DA APLICAÇÃO ---
    async function initializeApp() {
        await Promise.all([
            loadComponent('components/header.html', 'header-placeholder'),
            loadComponent('components/footer.html', 'footer-placeholder')
        ]);
        
        console.log("Listener de cliques principal está sendo adicionado ao BODY.");
        document.body.addEventListener('click', (e) => {
            console.log("%c--- CLIQUE DETECTADO ---", "color: #00A8A8; font-weight: bold;");
            console.log("Elemento clicado:", e.target);

            // Delegação para Navegação
            const navLink = e.target.closest('.nav-link');
            if (navLink && navLink.dataset.page) {
                console.log("Ação: Navegar para a página:", navLink.dataset.page);
                e.preventDefault();
                loadPage(navLink.dataset.page);
            }

            // Delegação para Remover item individual
            const removeBtn = e.target.closest('.remove-from-cart');
            if (removeBtn) {
                console.log("%cAção: REMOVER ITEM INDIVIDUAL", "color: red; font-weight: bold;");
                const productId = removeBtn.dataset.id;
                console.log("ID do produto a ser removido:", productId);
                state.cart = state.cart.filter(item => item.id !== productId);
                save.cart();
                updateCounters();
                renderCart();
                console.log("Item removido e carrinho re-renderizado.");
            }

            // Delegação para Limpar Carrinho
            if (e.target.closest('#clear-cart-btn')) {
                console.log("%c-Ação: LIMPAR CARRINHO INTEIRO", "color: red; font-weight: bold;");
                if (confirm('Tem certeza que deseja remover todos os itens do carrinho?')) {
                    console.log("Usuário confirmou. Limpando carrinho...");
                    showAnimation('clear-cart-animation-overlay', 5800, () => {
                        state.cart = [];
                        save.cart();
                        updateCounters();
                        renderCart();
                        console.log("Animação completa. Carrinho limpo.");
                    });
                } else {
                    console.log("Usuário cancelou a limpeza do carrinho.");
                }
            }
             // Delegação para Limpar Favoritos
            if (e.target.closest('#clear-favorites-btn')) {
                console.log("%c-Ação: LIMPAR FAVORITOS", "color: red; font-weight: bold;");
                if (confirm('Tem certeza que deseja remover todos os seus favoritos?')) {
                    state.favorites = [];
                    save.favorites();
                    updateCounters();
                    renderFavoritesPage();
                }
            }
        });
        
        updateLoginStatus();
        updateCounters();
        await loadPage('home');
    }
    
    initializeApp();
});

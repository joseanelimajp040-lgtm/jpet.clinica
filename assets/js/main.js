import { initSlider, initComparisonSlider } from './slider.js';
import { initPageModals } from './modals.js';
import { initCartPageListeners, initCheckoutPageListeners } from './cart.js';

document.addEventListener('DOMContentLoaded', () => {
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

    // --- FUNÇÕES DE PERSISTÊNCIA E UTILITÁRIAS ---
    const formatCurrency = (val) => parseFloat(val).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    const save = {
        cart: () => localStorage.setItem('cart', JSON.stringify(state.cart)),
        users: () => localStorage.setItem('users', JSON.stringify(state.users)),
        favorites: () => localStorage.setItem('favorites', JSON.stringify(state.favorites)),
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
    function censorString(str) {
        if (!str) return '';
        if (str.length <= 4) return str.length > 1 ? str[0] + '*'.repeat(str.length - 1) : '*';
        const start = str.substring(0, 2);
        const end = str.substring(str.length - 2);
        const middle = '*'.repeat(str.length - 4);
        return `${start}${middle}${end}`;
    }

    // --- FUNÇÕES DE RENDERIZAÇÃO E ATUALIZAÇÃO DA UI ---
    function updateCounters() {
        const cartCountEl = document.getElementById('cart-count');
        const favCountEl = document.getElementById('favorites-count');
        const totalItems = state.cart.reduce((sum, item) => sum + item.quantity, 0);
        
        if (cartCountEl) {
            cartCountEl.textContent = totalItems;
             if (totalItems > 0 && totalItems > parseInt(cartCountEl.textContent || '0')) {
                cartCountEl.classList.add('animate-bounce-custom');
                setTimeout(() => cartCountEl.classList.remove('animate-bounce-custom'), 600);
            }
        }
        if (favCountEl) favCountEl.textContent = state.favorites.length;
    }
    function updateLoginStatus() { /* ...código da função... */ }
    function updateTotals() { /* ...código da função... */ }
    function renderCart() { /* ...código da função... */ }
    function updateAllHeartIcons() {
        document.querySelectorAll('.favorite-btn').forEach(btn => {
            const icon = btn.querySelector('i');
            const isFav = state.favorites.some(fav => fav.id === btn.dataset.id);
            if (isFav) {
                icon.classList.remove('far', 'text-gray-300');
                icon.classList.add('fas', 'text-red-500');
            } else {
                icon.classList.remove('fas', 'text-red-500');
                icon.classList.add('far', 'text-gray-300');
            }
        });
    }
    function renderFavoritesPage() { /* ...código da função... */ }
    function renderCheckoutSummary() { /* ...código da função... */ }
    function renderCalendar() { /* ...código da função... */ }
    function initBanhoTosaEventListeners() { /* ...código da função... */ }

    // --- MANIPULADORES DE EVENTOS PRINCIPAIS ---
    function handleAddToCart(event) {
        const button = event.target.closest('.add-to-cart-btn');
        if (button.classList.contains('added')) return;

        const card = button.closest('.product-card');
        const product = {
            id: card.dataset.id,
            name: card.dataset.name,
            price: parseFloat(card.dataset.price),
            image: card.dataset.image
        };

        const existingProduct = state.cart.find(item => item.id === product.id);
        if (existingProduct) {
            existingProduct.quantity++;
        } else {
            state.cart.push({ ...product, quantity: 1 });
        }
        
        save.cart();
        updateCounters();

        const originalContent = button.innerHTML;
        button.classList.add('added');
        button.innerHTML = `<i class="fas fa-check mr-2"></i> Adicionado!`;
        setTimeout(() => {
            button.classList.remove('added');
            button.innerHTML = originalContent;
        }, 2000);
    }

    function handleFavoriteToggle(event) {
        const button = event.target.closest('.favorite-btn');
        const card = button.closest('.product-card');
        const productId = card.dataset.id;
        
        const favoriteIndex = state.favorites.findIndex(item => item.id === productId);

        if (favoriteIndex > -1) { // Já é favorito, remover
            state.favorites.splice(favoriteIndex, 1);
            showAnimation('unfavorite-animation-overlay', 1500, () => {
                if (document.getElementById('favorites-items-container')) {
                    renderFavoritesPage();
                }
            });
        } else { // Não é favorito, adicionar
            state.favorites.push({
                id: productId,
                name: card.dataset.name,
                price: parseFloat(card.dataset.price),
                image: card.querySelector('img').src // Garante que pegue a imagem correta
            });
        }

        save.favorites();
        updateCounters();
        updateAllHeartIcons();
    }

    // --- CARREGAMENTO DE PÁGINAS ---
    async function loadComponent(url, placeholderId) { /* ...código da função... */ }
    async function loadPage(pageName) {
        loadingOverlay.style.display = 'flex';
        try {
            const response = await fetch(`pages/${pageName}.html`);
            if (!response.ok) throw new Error(`Page ${pageName}.html not found.`);
            appRoot.innerHTML = await response.text();
            
            // Chamar inicializadores específicos da página
            switch (pageName) {
                case 'home':
                    initSlider();
                    initComparisonSlider();
                    updateAllHeartIcons();
                    break;
                case 'cart':
                    renderCart();
                    initCartPageListeners();
                    break;
                case 'checkout':
                    renderCheckoutSummary();
                    initCheckoutPageListeners();
                    break;
                case 'favorites':
                    renderFavoritesPage();
                    updateAllHeartIcons();
                    break;
                case 'banho-e-tosa':
                    renderCalendar();
                    initBanhoTosaEventListeners();
                    break;
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
        
        // Listener de eventos GLOBAIS (Delegação de Eventos)
        document.body.addEventListener('click', (e) => {
            // Navegação
            const navLink = e.target.closest('.nav-link');
            if (navLink && navLink.dataset.page) {
                e.preventDefault();
                loadPage(navLink.dataset.page);
            }
            // Logout
            if (e.target.closest('#logout-btn')) {
                save.logout();
                updateLoginStatus();
                loadPage('home');
            }
            // Adicionar ao Carrinho
            if (e.target.closest('.add-to-cart-btn')) {
                handleAddToCart(e);
            }
            // Favoritar
            if (e.target.closest('.favorite-btn')) {
                handleFavoriteToggle(e);
            }
        });

        // Adicionar outros listeners globais se necessário
        // ex: document.addEventListener('shippingSelected', ...)

        updateLoginStatus();
        updateCounters();
        
        await loadPage('home');
    }
    
    initializeApp();
});
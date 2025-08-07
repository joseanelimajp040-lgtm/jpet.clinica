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
        return `${start}${'*'.repeat(str.length - 4)}${end}`;
    }

    // --- FUNÇÕES DE RENDERIZAÇÃO E ATUALIZAÇÃO DA UI ---
    function updateCounters() {
        const cartCountEl = document.getElementById('cart-count');
        const favCountEl = document.getElementById('favorites-count');
        const totalItems = state.cart.reduce((sum, item) => sum + item.quantity, 0);
        if (cartCountEl) {
            const currentCount = parseInt(cartCountEl.textContent || '0');
            cartCountEl.textContent = totalItems;
            if (totalItems > currentCount) {
                cartCountEl.classList.add('animate-bounce-custom');
                setTimeout(() => cartCountEl.classList.remove('animate-bounce-custom'), 600);
            }
        }
        if (favCountEl) favCountEl.textContent = state.favorites.length;
    }
    function updateLoginStatus() {
        const loginBtn = document.getElementById('login-btn');
        if (!loginBtn) return;
        if (state.loggedInUser) {
            const firstName = state.loggedInUser.fullname.split(' ')[0];
            loginBtn.dataset.page = '';
            loginBtn.innerHTML = `<div class="flex items-center space-x-3"><i class="fas fa-user-check text-green-300"></i><span class="font-medium">Olá, ${firstName}</span><button id="logout-btn" class="text-xs bg-red-500 hover:bg-red-600 text-white rounded-full px-2 py-1">Sair</button></div>`;
        } else {
            loginBtn.dataset.page = 'login';
            loginBtn.innerHTML = `<i class="fas fa-user"></i><span>Entre ou Cadastre-se</span>`;
        }
    }
    function updateTotals() {
        const subtotal = state.cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        const shippingFee = state.shipping.fee || 0;
        let shippingDisplayText = state.cart.length > 0 ? (state.shipping.neighborhood ? formatCurrency(shippingFee) : 'Selecione') : formatCurrency(0);
        const total = subtotal + shippingFee;
        const updateElementText = (id, text) => { const el = document.getElementById(id); if (el) el.textContent = text; };
        updateElementText('cart-subtotal', formatCurrency(subtotal));
        updateElementText('cart-shipping', shippingDisplayText);
        updateElementText('cart-total', formatCurrency(total));
        updateElementText('checkout-subtotal', formatCurrency(subtotal));
        updateElementText('checkout-shipping', formatCurrency(shippingFee));
        updateElementText('checkout-total', formatCurrency(total));
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
                    <div class="flex items-center gap-2 border border-black rounded-full px-2">
                        <button class="quantity-change text-lg font-bold text-primary" data-id="${item.id}" data-change="-1">-</button>
                        <input type="number" value="${item.quantity}" readonly class="w-12 text-center font-bold bg-transparent">
                        <button class="quantity-change text-lg font-bold text-primary" data-id="${item.id}" data-change="1">+</button>
                    </div>
                    <div class="font-bold text-gray-800 w-24 text-center">${formatCurrency(item.price * item.quantity)}</div>
                    <button class="remove-from-cart text-red-500" data-id="${item.id}"><i class="fas fa-trash-alt"></i></button>
                </div>`);
            });
        }
        updateTotals();
    }
    function updateAllHeartIcons() {
        document.querySelectorAll('.favorite-btn').forEach(btn => {
            const icon = btn.querySelector('i');
            const isFav = state.favorites.some(fav => fav.id === btn.dataset.id);
            if (isFav) {
                icon.classList.remove('far', 'text-gray-300'); icon.classList.add('fas', 'text-red-500');
            } else {
                icon.classList.remove('fas', 'text-red-500'); icon.classList.add('far', 'text-gray-300');
            }
        });
    }
    function renderFavoritesPage() {
        const container = document.getElementById('favorites-items-container');
        const emptyState = document.getElementById('favorites-empty-state');
        const clearBtn = document.getElementById('clear-favorites-btn');
        if (!container || !emptyState || !clearBtn) return;

        container.innerHTML = '';
        if (state.favorites.length === 0) {
            emptyState.classList.remove('hidden');
            container.classList.add('hidden');
            clearBtn.classList.add('hidden');
        } else {
            emptyState.classList.add('hidden');
            container.classList.remove('hidden');
            clearBtn.classList.remove('hidden');
            state.favorites.forEach(item => {
                container.insertAdjacentHTML('beforeend', `
                <div class="product-card bg-white rounded-lg shadow" data-id="${item.id}" data-name="${item.name}" data-price="${item.price}" data-image="${item.image}">
                    <div class="relative"><button class="favorite-btn absolute top-2 right-2 text-2xl" data-id="${item.id}"><i class="fas fa-heart text-red-500"></i></button><img src="${item.image}" class="w-full h-48 object-contain p-4"></div>
                    <div class="p-4">
                        <h3 class="font-medium text-gray-800 mb-1 h-12">${item.name}</h3>
                        <div class="mb-2"><span class="text-primary font-bold">${formatCurrency(item.price)}</span></div>
                        <button class="add-to-cart-btn w-full bg-secondary text-white py-2 rounded-lg font-medium"><i class="fas fa-shopping-cart mr-2"></i> Adicionar</button>
                    </div>
                </div>`);
            });
        }
    }
    function renderCheckoutSummary() { /* ... */ }
    function renderCalendar() { /* ... */ }
    function initBanhoTosaEventListeners() { /* ... */ }

    // --- MANIPULADORES DE EVENTOS PRINCIPAIS ---
    function handleAddToCart(event) {
        const button = event.target.closest('.add-to-cart-btn');
        if (button.classList.contains('added')) return;
        const card = button.closest('.product-card');
        const product = { id: card.dataset.id, name: card.dataset.name, price: parseFloat(card.dataset.price), image: card.querySelector('img').src };
        const existingProduct = state.cart.find(item => item.id === product.id);
        if (existingProduct) existingProduct.quantity++;
        else state.cart.push({ ...product, quantity: 1 });
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
        if (favoriteIndex > -1) {
            state.favorites.splice(favoriteIndex, 1);
            showAnimation('unfavorite-animation-overlay', 1500, () => {
                if (document.getElementById('favorites-items-container')) renderFavoritesPage();
            });
        } else {
            state.favorites.push({
                id: productId, name: card.dataset.name, price: parseFloat(card.dataset.price), image: card.querySelector('img').src
            });
        }
        save.favorites();
        updateCounters();
        updateAllHeartIcons();
    }

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
        
        document.body.addEventListener('click', (e) => {
            const navLink = e.target.closest('.nav-link');
            if (navLink && navLink.dataset.page) { e.preventDefault(); loadPage(navLink.dataset.page); }
            if (e.target.closest('#logout-btn')) { save.logout(); updateLoginStatus(); loadPage('home'); }
            if (e.target.closest('.add-to-cart-btn')) handleAddToCart(e);
            if (e.target.closest('.favorite-btn')) handleFavoriteToggle(e);

            const removeBtn = e.target.closest('.remove-from-cart');
            if (removeBtn) {
                const productId = removeBtn.dataset.id;
                state.cart = state.cart.filter(item => item.id !== productId);
                save.cart();
                updateCounters();
                renderCart();
            }
            const quantityBtn = e.target.closest('.quantity-change');
            if(quantityBtn) {
                const productId = quantityBtn.dataset.id;
                const change = parseInt(quantityBtn.dataset.change);
                const item = state.cart.find(item => item.id === productId);
                if (item) {
                    item.quantity += change;
                    if (item.quantity < 1) item.quantity = 1;
                    save.cart();
                    updateCounters();
                    renderCart();
                }
            }
            if (e.target.closest('#clear-cart-btn')) {
                if (confirm('Tem certeza que deseja remover todos os itens do carrinho?')) {
                    showAnimation('clear-cart-animation-overlay', 5800, () => {
                        state.cart = [];
                        save.cart();
                        updateCounters();
                        renderCart();
                    });
                }
            }
            if (e.target.closest('#clear-favorites-btn')) {
                if (confirm('Tem certeza que deseja remover todos os seus favoritos?')) {
                    showAnimation('unfavorite-animation-overlay', 1500, () => {
                        state.favorites = [];
                        save.favorites();
                        updateCounters();
                        renderFavoritesPage();
                    });
                }
            }
        });
        
        updateLoginStatus();
        updateCounters();
        await loadPage('home');
    }
    
    initializeApp();
});

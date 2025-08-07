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
        appointments: () => localStorage.setItem('appointments', JSON.stringify(state.appointments)),
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
    
    // --- FUNÇÕES DE RENDERIZAÇÃO E ATUALIZAÇÃO DA UI ---
    function updateCounters() {
        const cartCountEl = document.getElementById('cart-count');
        const favCountEl = document.getElementById('favorites-count');
        if (cartCountEl) cartCountEl.textContent = state.cart.reduce((sum, item) => sum + item.quantity, 0);
        if (favCountEl) favCountEl.textContent = state.favorites.length;
    }

    function updateLoginStatus() {
        const loginBtn = document.getElementById('login-btn');
        if (!loginBtn) return;
        if (state.loggedInUser) {
            loginBtn.dataset.page = '';
            loginBtn.innerHTML = `<div class="flex items-center space-x-3"><i class="fas fa-user-check text-green-300"></i><span class="font-medium">Olá, ${state.loggedInUser.fullname.split(' ')[0]}</span><button id="logout-btn" class="text-xs bg-red-500 hover:bg-red-600 text-white rounded-full px-2 py-1">Sair</button></div>`;
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
        
        const updateElementText = (id, text) => {
            const el = document.getElementById(id);
            if (el) el.textContent = text;
        };

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
            if (state.favorites.some(fav => fav.id === btn.dataset.id)) {
                icon.classList.remove('far', 'text-gray-300');
                icon.classList.add('fas', 'text-red-500');
            } else {
                icon.classList.remove('fas', 'text-red-500');
                icon.classList.add('far', 'text-gray-300');
            }
        });
    }

    function renderFavoritesPage() {
        const container = document.getElementById('favorites-items-container');
        const emptyState = document.getElementById('favorites-empty-state');
        if (!container || !emptyState) return;
        container.innerHTML = '';
        if (state.favorites.length === 0) {
            emptyState.classList.remove('hidden');
            container.classList.add('hidden');
        } else {
            emptyState.classList.add('hidden');
            container.classList.remove('hidden');
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
    
    function renderCalendar() { /* Sua função renderCalendar completa aqui */ }
    function initBanhoTosaEventListeners() { /* Sua função initBanhoTosaEventListeners completa aqui */ }
    function renderCheckoutSummary() { /* Sua função renderCheckoutSummary completa aqui */ }

    // --- CARREGAMENTO DE PÁGINAS ---
    async function loadComponent(url, placeholderId) {
        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error(`Failed to load ${url}`);
            document.getElementById(placeholderId).innerHTML = await response.text();
        } catch (error) {
            console.error(error);
        }
    }

    async function loadPage(pageName) {
        loadingOverlay.style.display = 'flex';
        try {
            const response = await fetch(`pages/${pageName}.html`);
            if (!response.ok) throw new Error(`Page ${pageName}.html not found.`);
            appRoot.innerHTML = await response.text();
            
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
            console.error('Failed to load page:', error);
            appRoot.innerHTML = `<p class="text-red-500 text-center py-20">Erro ao carregar a página. Verifique o console.</p>`;
        } finally {
            setTimeout(() => loadingOverlay.style.display = 'none', 300);
            window.scrollTo(0, 0);
        }
    }

    // --- MANIPULADORES DE EVENTOS ---
    function handleNavigation(e) {
        const navLink = e.target.closest('.nav-link');
        if (navLink && navLink.dataset.page) {
            e.preventDefault();
            loadPage(navLink.dataset.page);
        }
    }

    // --- INICIALIZAÇÃO DA APLICAÇÃO ---
    async function initializeApp() {
        await Promise.all([
            loadComponent('components/header.html', 'header-placeholder'),
            loadComponent('components/footer.html', 'footer-placeholder')
        ]);
        
        // Adiciona o listener principal de eventos após carregar o header
        document.body.addEventListener('click', handleNavigation);

        updateLoginStatus();
        updateCounters();
        
        await loadPage('home');
    }
    
    initializeApp();
});
import { initSlider, initComparisonSlider } from './slider.js';
import { initPageModals } from './modals.js';
import { initCartPageListeners, initCheckoutPageListeners } from './cart.js';

// ... (bloco do service worker comentado) ...

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
    function showAnimation(overlayId, duration, callback) { /* ...código completo... */ }
    function censorString(str) { /* ...código completo... */ }

    // --- FUNÇÕES DE RENDERIZAÇÃO E ATUALIZAÇÃO DA UI ---
    function updateCounters() { /* ...código completo... */ }
    
    function updateLoginStatus() {
        const desktopPlaceholder = document.getElementById('login-placeholder-desktop');
        const mobilePlaceholder = document.getElementById('login-placeholder-mobile');
        if (!desktopPlaceholder || !mobilePlaceholder) return;

        let desktopHTML = '';
        let mobileHTML = '';

        if (state.loggedInUser && state.loggedInUser.fullname) {
            const firstName = state.loggedInUser.fullname.split(' ')[0];
            desktopHTML = `<div class="flex items-center space-x-3"><i class="fas fa-user-check text-green-300"></i><span class="font-medium">Olá, ${firstName}</span><button id="logout-btn" class="text-xs bg-red-500 hover:bg-red-600 text-white rounded-full px-2 py-1">Sair</button></div>`;
            mobileHTML = `<button id="logout-btn-mobile" class="text-white bg-red-500 rounded-full w-8 h-8 flex items-center justify-center"><i class="fas fa-sign-out-alt"></i></button>`;
        } else {
            desktopHTML = `<button class="nav-link bg-secondary hover:bg-teal-700 text-white font-medium py-2 px-5 rounded-full flex items-center space-x-2" data-page="login"><i class="fas fa-user"></i><span>Entre ou Cadastre-se</span></button>`;
            mobileHTML = `<button class="nav-link bg-secondary hover:bg-teal-700 text-white font-medium py-2 px-4 rounded-full flex items-center space-x-2" data-page="login"><i class="fas fa-user"></i></button>`;
        }

        desktopPlaceholder.innerHTML = desktopHTML;
        mobilePlaceholder.innerHTML = mobileHTML;
    }
    
    // ... (resto das funções de renderização: updateTotals, renderCart, etc.) ...

    // --- MANIPULADORES DE EVENTOS ---
    function handleLogin(event) { /* ...código de login localstorage... */ }
    function handleCreateAccount(event) { /* ...código de cadastro localstorage... */ }
    function handleLogout() {
        save.logout();
        alert('Você saiu da sua conta.');
        loadPage('home');
    }
    // ... (resto dos handlers: handleAddToCart, etc.) ...

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
                // ... (todos os cases) ...
            }
            initPageModals();
            updateLoginStatus();
        } catch (error) { console.error('Falha ao carregar a página:', error); }
        finally { setTimeout(() => loadingOverlay.style.display = 'none', 300); }
    }

    // --- INICIALIZAÇÃO DA APLICAÇÃO ---
    async function initializeApp() {
        await Promise.all([
            loadComponent('components/header.html', 'header-placeholder'),
            loadComponent('components/footer.html', 'footer-placeholder')
        ]);
        
        document.body.addEventListener('click', (e) => {
            if (e.target.closest('#logout-btn') || e.target.closest('#logout-btn-mobile')) {
                handleLogout();
            }
            // ... (resto do seu listener de clique para nav-link, add-to-cart, etc.) ...
        });
        
        document.body.addEventListener('submit', e => {
            if (e.target.id === 'login-form') handleLogin(e);
            if (e.target.id === 'create-account-form') handleCreateAccount(e);
        });
        
        updateLoginStatus();
        updateCounters();
        await loadPage('home');
    }
    
    initializeApp();
});

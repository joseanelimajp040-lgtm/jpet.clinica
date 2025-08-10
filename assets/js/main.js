import { initSlider, initComparisonSlider } from './slider.js';
import { initPageModals } from './modals.js';
import { initCartPageListeners, initCheckoutPageListeners } from './cart.js';

/* --- SERVICE WORKER (Mantido desativado por segurança) --- */
// ... (código do service worker comentado) ...

document.addEventListener('DOMContentLoaded', () => {
    // --- STATE & DOM REFERENCES ---
    const state = {
        cart: JSON.parse(localStorage.getItem('cart')) || [],
        users: JSON.parse(localStorage.getItem('users')) || [],
        loggedInUser: JSON.parse(sessionStorage.getItem('loggedInUser')) || null,
        // ... (resto do objeto state) ...
    };
    // ... (resto das suas constantes) ...

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
    // ... (resto das suas funções utilitárias) ...

    // --- FUNÇÕES DE RENDERIZAÇÃO E ATUALIZAÇÃO DA UI ---
    function updateCounters() { /* ...código completo... */ }
    
    // VERSÃO ATUALIZADA PARA FUNCIONAR COM OS PLACEHOLDERS
    function updateLoginStatus() {
        const loginPlaceholders = document.querySelectorAll('#login-placeholder-desktop, #login-placeholder-mobile');
        if (loginPlaceholders.length === 0) return;

        let desktopHTML = '';
        let mobileHTML = '';

        if (state.loggedInUser && state.loggedInUser.fullname) {
            const firstName = state.loggedInUser.fullname.split(' ')[0];
            desktopHTML = `<div class="flex items-center space-x-3"><i class="fas fa-user-check text-green-300"></i><span class="font-medium">Olá, ${firstName}</span><button id="logout-btn" class="text-xs bg-red-500 hover:bg-red-600 text-white rounded-full px-2 py-1">Sair</button></div>`;
            mobileHTML = `<button id="logout-btn-mobile" class="text-white"><i class="fas fa-sign-out-alt text-xl"></i></button>`;
        } else {
            desktopHTML = `<button class="nav-link bg-secondary hover:bg-teal-700 text-white font-medium py-2 px-5 rounded-full flex items-center space-x-2" data-page="login"><i class="fas fa-user"></i><span>Entre ou Cadastre-se</span></button>`;
            mobileHTML = `<button class="nav-link bg-secondary hover:bg-teal-700 text-white font-medium py-2 px-4 rounded-full flex items-center space-x-2" data-page="login"><i class="fas fa-user"></i></button>`;
        }

        document.getElementById('login-placeholder-desktop').innerHTML = desktopHTML;
        document.getElementById('login-placeholder-mobile').innerHTML = mobileHTML;
    }
    
    // ... (resto de todas as suas outras funções de renderização) ...

    // --- MANIPULADORES DE EVENTOS ---
    function handleLogin(event) { /* ...código de login localstorage... */ }
    function handleCreateAccount(event) { /* ...código de cadastro localstorage... */ }
    function handleLogout() { /* ...código de logout localstorage... */ }
    // ... (resto dos seus handlers) ...

    // --- CARREGAMENTO DE PÁGINAS ---
    async function loadPage(pageName) {
        // ... (código do loadPage, com a chamada para updateLoginStatus no final do try) ...
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
            // ... (resto do seu listener de clique) ...
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

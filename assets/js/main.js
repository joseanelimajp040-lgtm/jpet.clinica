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
        // ... (resto do objeto state) ...
    };
    // ... (resto das suas constantes) ...

    // --- FUNÇÕES DE PERSISTÊNCIA E UTILITÁRIAS ---
    const formatCurrency = (val) => parseFloat(val).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    const save = {
        cart: () => localStorage.setItem('cart', JSON.stringify(state.cart)),
        users: () => localStorage.setItem('users', JSON.stringify(state.users)),
        // ... (resto do objeto save) ...
        login: (user) => { state.loggedInUser = user; sessionStorage.setItem('loggedInUser', JSON.stringify(user)); },
        logout: () => { state.loggedInUser = null; sessionStorage.removeItem('loggedInUser'); }
    };

    // --- FUNÇÕES DE RENDERIZAÇÃO E ATUALIZAÇÃO DA UI ---
    function updateLoginStatus() {
        const loginPlaceholder = document.getElementById('login-placeholder');
        if (!loginPlaceholder) return;

        let buttonHTML = '';
        if (state.loggedInUser && state.loggedInUser.fullname) {
            const firstName = state.loggedInUser.fullname.split(' ')[0];
            // Botão de "Olá, Nome" para Desktop
            const desktopHTML = `<div class="hidden md:flex items-center space-x-3"><i class="fas fa-user-check text-green-300"></i><span class="font-medium">Olá, ${firstName}</span><button id="logout-btn" class="text-xs bg-red-500 hover:bg-red-600 text-white rounded-full px-2 py-1">Sair</button></div>`;
            // Botão de Logout para Mobile (ícone)
            const mobileHTML = `<button id="logout-btn-mobile" class="md:hidden text-white bg-red-500 rounded-full w-8 h-8 flex items-center justify-center"><i class="fas fa-sign-out-alt"></i></button>`;
            buttonHTML = desktopHTML + mobileHTML;
        } else {
            // Botão "Entre ou Cadastre-se" para todas as telas, mas com texto diferente
            buttonHTML = `<button class="nav-link bg-secondary hover:bg-teal-700 text-white font-medium py-2 px-5 rounded-full flex items-center space-x-2" data-page="login">
                            <i class="fas fa-user"></i>
                            <span class="hidden md:inline">Entre ou Cadastre-se</span>
                         </button>`;
        }
        loginPlaceholder.innerHTML = buttonHTML;
    }
    
    // ... (resto de todas as suas outras funções: renderCart, handleAddToCart, etc.) ...

    // --- CARREGAMENTO DE PÁGINAS ---
    async function loadPage(pageName) {
        // ... (código do loadPage, com a chamada para updateLoginStatus no final do try) ...
        try {
            //...
            initPageModals();
            updateLoginStatus(); // Garante que o botão seja atualizado
        }
        //...
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
        
        // ... (resto da função initializeApp) ...
        
        updateLoginStatus();
        updateCounters();
        await loadPage('home');
    }
    
    initializeApp();
});

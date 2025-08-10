import { initSlider, initComparisonSlider } from './slider.js';
import { initPageModals } from './modals.js';
import { initCartPageListeners, initCheckoutPageListeners } from './cart.js';

// --- SERVICE WORKER (Mantido desativado por segurança) ---
/*
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/jpet.clinica/sw.js')
      .then(registration => console.log('Service Worker registrado com sucesso:', registration))
      .catch(error => console.log('Falha ao registrar o Service Worker:', error));
  });
}
*/
// --- FIM DO REGISTRO ---

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
    
    // <<< ESTA É A FUNÇÃO DO SEU CÓDIGO ORIGINAL >>>
    function updateLoginStatus() {
        const loginBtn = document.getElementById('login-btn');
        if (!loginBtn) return;
        if (state.loggedInUser && state.loggedInUser.fullname) {
            const firstName = state.loggedInUser.fullname.split(' ')[0];
            loginBtn.dataset.page = '';
            loginBtn.innerHTML = `<div class="flex items-center space-x-3"><i class="fas fa-user-check text-green-300"></i><span class="font-medium">Olá, ${firstName}</span><button id="logout-btn" class="text-xs bg-red-500 hover:bg-red-600 text-white rounded-full px-2 py-1">Sair</button></div>`;
        } else {
            loginBtn.dataset.page = 'login';
            loginBtn.innerHTML = `<i class="fas fa-user"></i><span>Entre ou Cadastre-se</span>`;
        }
    }
    
    function updateTotals() { /* ...código completo da função... */ }
    function renderCart() { /* ...código completo da função... */ }
    function updateAllHeartIcons() { /* ...código completo da função... */ }
    function renderFavoritesPage() { /* ...código completo da função... */ }
    function renderCheckoutSummary() { /* ...código completo da função... */ }
    function renderCalendar() { /* ...código completo da função... */ }
    function initBanhoTosaEventListeners() { /* ...código completo da função... */ }

    // <<< ESTAS SÃO AS FUNÇÕES DE AUTENTICAÇÃO DO SEU CÓDIGO ORIGINAL >>>
    function handleLogin(event) {
        event.preventDefault();
        const identifier = document.getElementById('login-email').value.trim();
        const password = document.getElementById('login-password').value;
        const errorEl = document.getElementById('login-error');

        const foundUser = state.users.find(user => 
            (user.email === identifier || user.cpf === identifier) && user.password === password
        );

        if (foundUser) {
            save.login(foundUser);
            alert(`Bem-vindo(a) de volta, ${foundUser.fullname.split(' ')[0]}!`);
            loadPage('home');
        } else {
            if (errorEl) {
                errorEl.textContent = "E-mail/CPF ou senha inválidos.";
                errorEl.classList.remove('hidden');
            } else {
                alert("E-mail/CPF ou senha inválidos.");
            }
        }
    }

    function handleCreateAccount(event) {
        event.preventDefault();
        const fullname = document.getElementById('signup-fullname')?.value;
        const cpf = document.getElementById('signup-cpf')?.value;
        const phone = document.getElementById('signup-phone')?.value;
        const email = document.getElementById('signup-email')?.value;
        const password = document.getElementById('signup-password')?.value;
        
        if (state.users.find(user => user.email === email)) {
            alert('Este e-mail já está cadastrado.');
            return;
        }

        const newUser = { fullname, cpf, phone, email, password };
        state.users.push(newUser);
        save.users();
        alert('Conta criada com sucesso! Por favor, faça o login.');
        loadPage('login');
    }

    function handleLogout() {
        save.logout();
        alert('Você saiu da sua conta.');
        loadPage('home');
    }

    // --- MANIPULADORES DE EVENTOS DE PRODUTO ---
    function handleAddToCart(event) { /* ...código completo da função... */ }
    function handleFavoriteToggle(event) { /* ...código completo da função... */ }

    // --- CARREGAMENTO DE PÁGINAS ---
    async function loadComponent(url, placeholderId) { /* ...código completo da função... */ }
    async function loadPage(pageName) {
        loadingOverlay.style.display = 'flex';
        try {
            const response = await fetch(`pages/${pageName}.html`);
            if (!response.ok) throw new Error(`Página não encontrada: ${pageName}.html`);
            appRoot.innerHTML = await response.text();
            
            switch (pageName) {
                case 'home': initSlider(); initComparisonSlider(); updateAllHeartIcons(); break;
                // ... outros cases
            }
            initPageModals();
            updateLoginStatus(); // GARANTE QUE O BOTÃO DE LOGIN SEJA ATUALIZADO A CADA PÁGINA
        } catch (error) { console.error('Falha ao carregar a página:', error); }
        finally { setTimeout(() => loadingOverlay.style.display = 'none', 300); window.scrollTo(0, 0); }
    }

    // --- INICIALIZAÇÃO DA APLICAÇÃO ---
    async function initializeApp() {
        await Promise.all([
            loadComponent('components/header.html', 'header-placeholder'),
            loadComponent('components/footer.html', 'footer-placeholder')
        ]);
        
        // Listener de cliques
        document.body.addEventListener('click', (e) => {
            if (e.target.closest('.nav-link')?.dataset.page) { e.preventDefault(); loadPage(e.target.closest('.nav-link').dataset.page); }
            if (e.target.closest('#logout-btn')) handleLogout();
            // ... todos os outros listeners de clique (carrinho, favoritos, etc.)
        });

        // Listener para formulários
        document.body.addEventListener('submit', e => {
            if (e.target.id === 'login-form') handleLogin(e);
            if (e.target.id === 'create-account-form') handleCreateAccount(e);
        });
        
        // ... outros listeners ...

        updateLoginStatus();
        updateCounters();
        await loadPage('home');
    }
    
    initializeApp();
});

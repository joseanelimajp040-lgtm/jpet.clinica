import { initSlider, initComparisonSlider } from './slider.js';
import { initPageModals } from './modals.js';
import { initCartPageListeners, initCheckoutPageListeners } from './cart.js';

// --- SERVICE WORKER (Deixei comentado por segurança, reative se quiser) ---
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
        users: JSON.parse(localStorage.getItem('users')) || [], // <-- Lendo usuários do localStorage
        loggedInUser: JSON.parse(sessionStorage.getItem('loggedInUser')) || null, // <-- Lendo usuário logado da sessionStorage
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
        const loginBtn = document.getElementById('login-btn');
        if (!loginBtn) return;
        if (state.loggedInUser && state.loggedInUser.fullname) { // Verifica se tem o nome completo
            const firstName = state.loggedInUser.fullname.split(' ')[0];
            loginBtn.dataset.page = '';
            loginBtn.innerHTML = `<div class="flex items-center space-x-3"><i class="fas fa-user-check text-green-300"></i><span class="font-medium">Olá, ${firstName}</span><button id="logout-btn" class="text-xs bg-red-500 hover:bg-red-600 text-white rounded-full px-2 py-1">Sair</button></div>`;
        } else {
            loginBtn.dataset.page = 'login';
            loginBtn.innerHTML = `<i class="fas fa-user"></i><span>Entre ou Cadastre-se</span>`;
        }
    }
    function updateTotals() { /* ...código completo... */ }
    function renderCart() { /* ...código completo... */ }
    function updateAllHeartIcons() { /* ...código completo... */ }
    function renderFavoritesPage() { /* ...código completo... */ }
    function renderCheckoutSummary() { /* ...código completo... */ }
    function renderCalendar() { /* ...código completo... */ }
    function initBanhoTosaEventListeners() { /* ...código completo... */ }
    
    // --- MANIPULADORES DE EVENTOS DE AUTENTICAÇÃO (VERSÃO LOCALSTORAGE) ---
    function handleCreateAccount(event) {
        event.preventDefault();
        // Recupere todos os campos do formulário de cadastro original
        const fullname = document.getElementById('signup-fullname')?.value;
        const email = document.getElementById('signup-email')?.value;
        const password = document.getElementById('signup-password')?.value;
        // ... outros campos como CPF, telefone ...
        
        // Simples verificação de e-mail duplicado
        if (state.users.find(user => user.email === email)) {
            alert('Este e-mail já está cadastrado.');
            return;
        }

        const newUser = { fullname, email, password /*, ...outros campos */ };
        state.users.push(newUser);
        save.users(); // Salva a lista de usuários atualizada no localStorage
        alert('Conta criada com sucesso! Por favor, faça o login.');
        loadPage('login');
    }
    function handleLogin(event) {
        event.preventDefault();
        const identifier = document.getElementById('login-email').value.trim();
        const password = document.getElementById('login-password').value;
        const errorEl = document.getElementById('login-error');

        const foundUser = state.users.find(user => 
            (user.email === identifier || user.cpf === identifier) && user.password === password
        );

        if (foundUser) {
            save.login(foundUser); // Salva o usuário na sessionStorage
            updateLoginStatus();
            loadPage('home');
        } else {
            if(errorEl) {
                errorEl.textContent = "E-mail/CPF ou senha inválidos.";
                errorEl.classList.remove('hidden');
            } else {
                alert("E-mail/CPF ou senha inválidos.");
            }
        }
    }
    function handleLogout() {
        save.logout(); // Limpa a sessionStorage
        updateLoginStatus();
        loadPage('home');
    }

    // --- MANIPULADORES DE EVENTOS DE PRODUTO ---
    function handleAddToCart(event) { /* ...código completo... */ }
    function handleFavoriteToggle(event) { /* ...código completo... */ }

    // --- CARREGAMENTO DE PÁGINAS ---
    async function loadComponent(url, placeholderId) { /* ...código completo... */ }
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
        } catch (error) { console.error('Falha ao carregar a página:', error); }
        finally { setTimeout(() => loadingOverlay.style.display = 'none', 300); window.scrollTo(0, 0); }
    }

    // --- INICIALIZAÇÃO DA APLICAÇÃO ---
    async function initializeApp() {
        await Promise.all([
            loadComponent('components/header.html', 'header-placeholder'),
            loadComponent('components/footer.html', 'footer-placeholder')
        ]);
        
        document.body.addEventListener('click', (e) => {
            if (e.target.closest('.nav-link')?.dataset.page) { e.preventDefault(); loadPage(e.target.closest('.nav-link').dataset.page); }
            if (e.target.closest('#logout-btn')) handleLogout();
            if (e.target.closest('.add-to-cart-btn')) handleAddToCart(e);
            if (e.target.closest('.favorite-btn')) handleFavoriteToggle(e);
            if (e.target.closest('.remove-from-cart')) { /* ...código de remoção... */ }
            if (e.target.closest('.quantity-change')) { /* ...código de quantidade... */ }
            if (e.target.closest('#clear-cart-btn')) { /* ...código de limpar carrinho... */ }
            if (e.target.closest('#clear-favorites-btn')) { /* ...código de limpar favoritos... */ }
            if (e.target.closest('#checkout-btn')) { /* ...código de checkout... */ }
            if (e.target.closest('#confirm-purchase-btn')) { /* ...código de confirmar compra... */ }
        });

        // Listener específico para formulários
        document.body.addEventListener('submit', e => {
            if (e.target.id === 'login-form') handleLogin(e);
            if (e.target.id === 'create-account-form') handleCreateAccount(e);
        });
        
        document.addEventListener('shippingSelected', (e) => {
            state.shipping = e.detail;
            const shippingModal = document.getElementById('shipping-modal');
            if (shippingModal) shippingModal.style.display = 'none';
            updateTotals();
        });

        updateLoginStatus();
        updateCounters();
        await loadPage('home');
    }
    
    initializeApp();
});

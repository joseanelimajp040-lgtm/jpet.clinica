import { initSlider, initComparisonSlider } from './slider.js';
import { initPageModals } from './modals.js';
import { initCartPageListeners, initCheckoutPageListeners } from './cart.js';

// --- INICIALIZAÇÃO DO FIREBASE (FORA DO DOMCONTENTLOADED) ---
// Suas credenciais já estão aqui
const firebaseConfig = {
    apiKey: "AIzaSyBapMZqOblvGQpqQBTla3e7qn11uoWi6YU",
    authDomain: "banco-de-dados-japet.firebaseapp.com",
    projectId: "banco-de-dados-japet",
    storageBucket: "banco-de-dados-japet.firebasestorage.app",
    messagingSenderId: "548299221616",
    appId: "1:548299221616:web:e7d1fea251018a7570e2b5",
};
firebase.initializeApp(firebaseConfig);
// --- FIM DA INICIALIZAÇÃO ---

/* --- SERVICE WORKER (Mantido desativado por segurança) --- */
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
    // --- INSTÂNCIAS DO FIREBASE ---
    const auth = firebase.auth();
    const db = firebase.firestore();

    // --- STATE & DOM REFERENCES ---
    let state = {
        cart: JSON.parse(localStorage.getItem('cart')) || [],
        loggedInUser: null, // O Firebase vai controlar isso agora
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
    };
    function showAnimation(overlayId, duration, callback) { /* ...código completo da sua versão... */ }
    function censorString(str) { /* ...código completo da sua versão... */ }

    // --- FUNÇÕES DE RENDERIZAÇÃO E ATUALIZAÇÃO DA UI ---
    function updateCounters() { /* ...código completo da sua versão... */ }
    function updateLoginStatus() {
        const loginBtn = document.getElementById('login-btn');
        if (!loginBtn) return;
        if (state.loggedInUser) {
            const displayName = state.loggedInUser.displayName || state.loggedInUser.email.split('@')[0];
            loginBtn.dataset.page = '';
            loginBtn.innerHTML = `<div class="flex items-center space-x-3"><i class="fas fa-user-check text-green-300"></i><span class="font-medium">Olá, ${displayName}</span><button id="logout-btn" class="text-xs bg-red-500 hover:bg-red-600 text-white rounded-full px-2 py-1">Sair</button></div>`;
        } else {
            loginBtn.dataset.page = 'login';
            loginBtn.innerHTML = `<i class="fas fa-user"></i><span>Entre ou Cadastre-se</span>`;
        }
    }
    function updateTotals() { /* ...código completo da sua versão... */ }
    function renderCart() { /* ...código completo da sua versão... */ }
    function updateAllHeartIcons() { /* ...código completo da sua versão... */ }
    function renderFavoritesPage() { /* ...código completo da sua versão... */ }
    function renderCheckoutSummary() { /* ...código completo da sua versão... */ }
    function renderCalendar() { /* ...código completo da sua versão... */ }
    function initBanhoTosaEventListeners() { /* ...código completo da sua versão... */ }

    // --- MANIPULADORES DE EVENTOS DE AUTENTICAÇÃO (FIREBASE) ---
    function handleCreateAccount(event) {
        event.preventDefault();
        const name = document.getElementById('signup-name').value;
        const email = document.getElementById('signup-email').value;
        const password = document.getElementById('signup-password').value;
        const errorEl = document.getElementById('signup-error');
        errorEl.classList.add('hidden');

        auth.createUserWithEmailAndPassword(email, password)
            .then(userCredential => {
                const user = userCredential.user;
                return user.updateProfile({ displayName: name })
                    .then(() => {
                        return db.collection('users').doc(user.uid).set({
                            name: name,
                            email: email,
                            createdAt: firebase.firestore.FieldValue.serverTimestamp()
                        });
                    });
            })
            .then(() => {
                alert(`Conta para ${name} criada com sucesso! Por favor, faça o login.`);
                loadPage('login');
            })
            .catch(error => {
                console.error("Erro ao criar conta:", error);
                errorEl.textContent = "Erro: " + error.message;
                errorEl.classList.remove('hidden');
            });
    }
    function handleLogin(event) {
        event.preventDefault();
        const email = document.getElementById('login-email').value;
        const password = document.getElementById('login-password').value;
        const errorEl = document.getElementById('login-error');
        errorEl.classList.add('hidden');

        auth.signInWithEmailAndPassword(email, password)
            .then(userCredential => {
                loadPage('home');
            })
            .catch(error => {
                console.error("Erro ao fazer login:", error);
                errorEl.textContent = "E-mail ou senha inválidos.";
                errorEl.classList.remove('hidden');
            });
    }
    function handleLogout() {
        auth.signOut().catch(error => console.error("Erro ao fazer logout:", error));
    }
    
    // --- OBSERVADOR DE ESTADO DE AUTENTICAÇÃO DO FIREBASE ---
    auth.onAuthStateChanged(user => {
        if (user) {
            state.loggedInUser = { email: user.email, uid: user.uid, displayName: user.displayName };
        } else {
            state.loggedInUser = null;
        }
        if (document.getElementById('login-btn')) {
            updateLoginStatus();
        }
    });

    // --- MANIPULADORES DE EVENTOS DE PRODUTO ---
    function handleAddToCart(event) { /* ...código completo da sua versão... */ }
    function handleFavoriteToggle(event) { /* ...código completo da sua versão... */ }

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
            updateLoginStatus();
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
            if (e.target.closest('.nav-link')?.dataset.page) { e.preventDefault(); loadPage(e.target.closest('.nav-link').dataset.page); }
            if (e.target.closest('#logout-btn')) handleLogout();
            if (e.target.closest('.add-to-cart-btn')) handleAddToCart(e);
            if (e.target.closest('.favorite-btn')) handleFavoriteToggle(e);
            if (e.target.closest('.remove-from-cart')) {
                const productId = e.target.closest('.remove-from-cart').dataset.id;
                state.cart = state.cart.filter(item => item.id !== productId);
                save.cart(); updateCounters(); renderCart();
            }
            if (e.target.closest('.quantity-change')) {
                const btn = e.target.closest('.quantity-change');
                const productId = btn.dataset.id;
                const change = parseInt(btn.dataset.change);
                const item = state.cart.find(item => item.id === productId);
                if (item) {
                    item.quantity += change;
                    if (item.quantity < 1) item.quantity = 1;
                    save.cart(); updateCounters(); renderCart();
                }
            }
            if (e.target.closest('#clear-cart-btn')) {
                if (confirm('Tem certeza?')) { showAnimation('clear-cart-animation-overlay', 5800, () => { state.cart = []; save.cart(); updateCounters(); renderCart(); });}
            }
            if (e.target.closest('#clear-favorites-btn')) {
                if (confirm('Tem certeza?')) { showAnimation('unfavorite-animation-overlay', 1500, () => { state.favorites = []; save.favorites(); updateCounters(); renderFavoritesPage(); });}
            }
            if (e.target.closest('#checkout-btn')) {
                e.preventDefault();
                if(state.cart.length === 0) return alert("Seu carrinho está vazio.");
                if(!state.shipping.neighborhood) {
                    alert("Por favor, selecione uma taxa de entrega.");
                    const shippingModal = document.getElementById('shipping-modal');
                    if (shippingModal) shippingModal.style.display = 'flex';
                    return;
                }
                loadPage('checkout');
            }
            if (e.target.closest('#confirm-purchase-btn')) {
                alert('Compra confirmada com sucesso! Obrigado.');
                state.cart = []; state.shipping = { fee: 0, neighborhood: ''};
                save.cart(); updateCounters(); loadPage('home');
            }
        });

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

        updateCounters();
        await loadPage('home');
    }
    
    initializeApp();
});

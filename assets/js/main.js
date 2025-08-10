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
    // --- INICIALIZAÇÃO DO FIREBASE ---
    // Certifique-se de que seu firebaseConfig está no index.html
    const auth = firebase.auth();
    const db = firebase.firestore();

    // --- STATE & DOM REFERENCES ---
    let state = {
        cart: JSON.parse(localStorage.getItem('cart')) || [],
        loggedInUser: null, // O Firebase vai controlar isso
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
    
    // ...todas as outras funções de renderização (renderCart, etc.) devem estar aqui...
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
            state.loggedInUser = {
                email: user.email,
                uid: user.uid,
                displayName: user.displayName
            };
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
    async function loadComponent(url, placeholderId) { /* ...código completo da sua versão... */ }
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
            updateLoginStatus();
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
            if (e.target.closest('#logout-btn')) handleLogout();
            // ... todos os outros listeners de clique (carrinho, favoritos, etc.)
        });

        document.body.addEventListener('submit', e => {
            if (e.target.id === 'login-form') handleLogin(e);
            if (e.target.id === 'create-account-form') handleCreateAccount(e);
        });
        
        // ... outros listeners ...

        updateCounters();
        await loadPage('home');
    }
    
    initializeApp();
});

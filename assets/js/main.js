import { initSlider, initComparisonSlider } from './slider.js';
import { initPageModals } from './modals.js';
import { initCartPageListeners, initCheckoutPageListeners } from './cart.js';

// --- INICIALIZAÇÃO DO FIREBASE ---
const firebaseConfig = {
    apiKey: "AIzaSyBapMZqOblvGQpqQBTla3e7qn11uoWi6YU",
    authDomain: "banco-de-dados-japet.firebaseapp.com",
    projectId:  "banco-de-dados-japet",
    storageBucket: "banco-de-dados-japet.firebasestorage.app",
    messagingSenderId: "548299221616",
    appId: "1:548299221616:web:e7d1fea251018a7570e2b5",
};
firebase.initializeApp(firebaseConfig);
// --- FIM DA INICIALIZAÇÃO ---

/* --- SERVICE WORKER (Mantido desativado por segurança) ---
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
    const auth = firebase.auth();
    const db = firebase.firestore();

    let state = {
        cart: JSON.parse(localStorage.getItem('cart')) || [],
        loggedInUser: null,
        favorites: JSON.parse(localStorage.getItem('favorites')) || [],
        appointments: JSON.parse(localStorage.getItem('groomingAppointments')) || [],
        shipping: { fee: 0, neighborhood: '' }
    };
    const appRoot = document.getElementById('app-root');
    const loadingOverlay = document.getElementById('loading-overlay');

    const formatCurrency = (val) => parseFloat(val).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    const save = {
        cart: () => localStorage.setItem('cart', JSON.stringify(state.cart)),
        favorites: () => localStorage.setItem('favorites', JSON.stringify(state.favorites)),
        appointments: () => localStorage.setItem('groomingAppointments', JSON.stringify(state.appointments)),
    };

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
    
    // ... TODAS AS OUTRAS FUNÇÕES (renderCart, handleAddToCart, etc.) ...

    async function loadPage(pageName) {
        // ... sua função loadPage completa
    }

    async function initializeApp() {
        await Promise.all([
            loadComponent('components/header.html', 'header-placeholder'),
            loadComponent('components/footer.html', 'footer-placeholder')
        ]);
        
        document.body.addEventListener('submit', e => {
            if (e.target.id === 'login-form') handleLogin(e);
            if (e.target.id === 'create-account-form') handleCreateAccount(e);
        });
        
        // ... resto dos seus listeners e funções ...

        updateLoginStatus(); // Chama para garantir o estado inicial
        updateCounters();
        await loadPage('home');
    }
    
    initializeApp();
});


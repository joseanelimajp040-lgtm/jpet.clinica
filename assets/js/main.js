// --- IMPORTAÇÕES DE MÓDULOS ---
// Importações do Firebase SDK v9 (modular)
import { initializeApp } from 'https://www.gstatic.com/firebasejs/9.6.1/firebase-app.js';
import { getAuth, GoogleAuthProvider, OAuthProvider, signInWithPopup, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/9.6.1/firebase-auth.js';
import { getFirestore, collection, getDocs, orderBy, where, doc, getDoc, updateDoc, FieldPath, query, onSnapshot, addDoc, setDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js';

import { initSlider, initComparisonSlider } from '/assets/js/slider.js';
import { initPageModals } from './modals.js';
import { initCartPageListeners, initCheckoutPageListeners } from './cart.js';

// --- INICIALIZAÇÃO DO FIREBASE ---
const firebaseConfig = {
    apiKey: "AIzaSyBapMZqOblvGQpqQBTla3e7qn11uoWi6YU",
    authDomain: "banco-de-dados-japet.firebaseapp.com",
    projectId: "banco-de-dados-japet",
    storageBucket: "banco-de-dados-japet.appspot.com",
    messagingSenderId: "548299221616",
    appId: "1:548299221616:web:e7d1fea251018a7570e2b5",
};
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

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

// --- VARIÁVEIS GLOBAIS E ESTADO DA APLICAÇÃO ---
let state = {};
let appRoot, loadingOverlay;
let currentSearchResults = [];

// --- FUNÇÕES UTILITÁRIAS ---
const formatCurrency = (val) => parseFloat(val).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const save = {
    cart: () => localStorage.setItem('cart', JSON.stringify(state.cart)),
    favorites: () => localStorage.setItem('favorites', JSON.stringify(state.favorites)),
    appointments: () => localStorage.setItem('groomingAppointments', JSON.stringify(state.appointments)),
    orders: () => localStorage.setItem('orders', JSON.stringify(state.orders)),
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

function managePageStyles(pageName) {
    document.body.classList.toggle('is-fullpage', pageName === 'farmacia');
    document.body.classList.toggle('body-has-decorations', ['instalar-ios', 'login'].includes(pageName));
}

// --- FUNÇÕES DE ATUALIZAÇÃO DA UI ---
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
    const desktopPlaceholder = document.getElementById('login-placeholder-desktop');
    const mobilePlaceholder = document.getElementById('login-placeholder-mobile');
    const placeholders = [desktopPlaceholder, mobilePlaceholder];

    placeholders.forEach(placeholder => {
        if (!placeholder) return;

        if (state.loggedInUser) {
            const fullName = state.loggedInUser.displayName || state.loggedInUser.email.split('@')[0];
            const firstName = fullName.split(' ')[0];
            const adminLinkHTML = state.loggedInUser.role === 'admin'
                ? `<a href="#" class="user-menu-item nav-link" data-page="admin"><i class="fas fa-user-shield"></i><span>Painel Admin</span></a>`
                : '';

            placeholder.innerHTML = `
                <div class="relative user-menu-container">
                    <div class="flex items-center justify-between bg-secondary text-white rounded-full px-4 py-2 cursor-pointer">
                        <div class="flex items-center space-x-2">
                            <i class="fas fa-user-check"></i>
                            <span class="font-medium text-sm whitespace-nowrap">Olá, ${firstName}</span>
                            <i class="fas fa-chevron-down text-xs ml-1 transition-transform"></i>
                        </div>
                    </div>
                    <div class="user-menu-dropdown absolute right-0 mt-2 w-64 bg-white rounded-lg shadow-xl overflow-hidden z-50">
                        ${adminLinkHTML}
                        <a href="#" class="user-menu-item nav-link" data-page="meus-pedidos"><i class="fas fa-box-open"></i><span>Meus Pedidos</span></a>
                        <a href="#" class="user-menu-item nav-link" data-page="acompanhar-entrega"><i class="fas fa-truck"></i><span>Acompanhe sua Entrega</span></a>
                        <a href="#" class="user-menu-item nav-link" data-page="ultimos-vistos"><i class="fas fa-history"></i><span>Últimos Itens Vistos</span></a>
                        <div class="border-t border-gray-100"></div>
                        <button class="logout-btn user-menu-item text-red-500 w-full text-left"><i class="fas fa-sign-out-alt"></i><span>Sair</span></button>
                    </div>
                </div>`;
        } else {
            placeholder.innerHTML = `
                <a href="#" class="nav-link flex items-center space-x-2 bg-secondary text-white px-4 py-2 rounded-full hover:bg-teal-700" data-page="login">
                    <i class="fas fa-user"></i>
                    <span class="whitespace-nowrap text-sm">Entre ou Cadastre-se</span>
                </a>`;
        }
    });
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

function updateAllHeartIcons() {
    document.querySelectorAll('.favorite-btn').forEach(btn => {
        const icon = btn.querySelector('i');
        if (!icon) return;
        const isFav = state.favorites.some(fav => fav.id === btn.dataset.id);
        if (isFav) {
            icon.classList.remove('far', 'text-gray-300');
            icon.classList.add('fas', 'text-red-500');
        } else {
            icon.classList.remove('fas', 'text-red-500');
            icon.classList.add('far', 'text-gray-300');
        }
    });
}

// --- FUNÇÕES DE RENDERIZAÇÃO DE COMPONENTES E PÁGINAS ---
async function renderAdminOrdersView() {
    const adminContent = document.getElementById('admin-content');
    if (!adminContent) return;

    adminContent.innerHTML = `
        <header class="mb-8">
            <h1 class="text-3xl font-bold text-gray-800">Gerenciamento de Pedidos e Entregas</h1>
            <p class="text-gray-500">Visualize e atualize o status de todos os pedidos do site.</p>
        </header>
        <div id="admin-orders-list" class="space-y-4">
            <p>Carregando pedidos...</p>
        </div>
    `;

    const ordersSnapshot = await getDocs(query(collection(db, 'orders'), orderBy('orderDate', 'desc')));
    const ordersListEl = document.getElementById('admin-orders-list');

    if (ordersSnapshot.empty) {
        ordersListEl.innerHTML = '<p>Nenhum pedido encontrado.</p>';
        return;
    }

    ordersListEl.innerHTML = ordersSnapshot.docs.map(doc => {
        const order = doc.data();
        const orderId = doc.id;
        const orderDate = order.orderDate ? order.orderDate.toDate().toLocaleDateString('pt-BR') : 'Data inválida';

        const statusOptions = ['Processando', 'Enviado', 'Entregue', 'Cancelado']
            .map(s => `<option value="${s}" ${order.status === s ? 'selected' : ''}>${s}</option>`)
            .join('');

        return `
            <div class="bg-white p-4 rounded-lg shadow-md border">
                <div class="flex flex-wrap justify-between items-center border-b pb-2 mb-3">
                    <div>
                        <p class="font-bold text-primary">Pedido #${orderId.substring(0, 6).toUpperCase()}</p>
                        <p class="text-sm text-gray-600">Cliente: ${order.userName} (${order.userEmail})</p>
                    </div>
                    <p class="text-sm text-gray-500">Data: ${orderDate}</p>
                </div>
                <div class="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                    <div>
                        <label class="block text-sm font-medium text-gray-700">Status do Pedido</label>
                        <select id="status-${orderId}" class="mt-1 block w-full py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-secondary focus:border-secondary">
                            ${statusOptions}
                        </select>
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700">Previsão de Entrega</label>
                        <input type="text" id="delivery-${orderId}" value="${order.estimatedDelivery || ''}" placeholder="Ex: Chega amanhã" class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-secondary">
                    </div>
                    <button class="update-order-btn bg-secondary hover:bg-teal-700 text-white font-bold py-2 px-4 rounded-md transition" data-order-id="${orderId}">
                        <i class="fas fa-save mr-2"></i> Salvar Alterações
                    </button>
                </div>
            </div>
        `;
    }).join('');

    ordersListEl.addEventListener('click', async (e) => {
        if (e.target.closest('.update-order-btn')) {
            const button = e.target.closest('.update-order-btn');
            const orderId = button.dataset.orderId;

            const newStatus = document.getElementById(`status-${orderId}`).value;
            const newDeliveryEstimate = document.getElementById(`delivery-${orderId}`).value;

            button.textContent = 'Salvando...';
            button.disabled = true;

            try {
                await updateDoc(doc(db, 'orders', orderId), {
                    status: newStatus,
                    estimatedDelivery: newDeliveryEstimate
                });
                button.textContent = 'Salvo!';
                button.classList.remove('bg-secondary');
                button.classList.add('bg-green-500');
                setTimeout(() => {
                    button.textContent = 'Salvar Alterações';
                    button.classList.remove('bg-green-500');
                    button.classList.add('bg-secondary');
                    button.disabled = false;
                }, 2000);
            } catch (error) {
                console.error("Erro ao atualizar o pedido: ", error);
                alert('Não foi possível salvar as alterações.');
                button.textContent = 'Salvar Alterações';
                button.disabled = false;
            }
        }
    });
}
function createProductCardHTML(productData, productId) {
    if (!productData.variations || productData.variations.length === 0) {
        console.warn(`O produto "${productData.nome}" (ID: ${productId}) não possui a estrutura de 'variations' e não será exibido.`);
        return '';
    }

    const defaultIndex = productData.defaultVariationIndex || 0;
    const defaultVariation = productData.variations[defaultIndex];
    const isFav = state.favorites.some(fav => fav.id === productId);
    const favIconClass = isFav ? 'fas text-red-500' : 'far text-gray-300';

    const variationsHTML = productData.variations.map((v, index) => `
        <button
            class="variation-btn ${index === defaultIndex ? 'selected' : ''}"
            data-index="${index}"
            data-price="${v.price}"
            data-original-price="${v.originalPrice || ''}"
            data-weight="${v.weight}"
            data-stock="${v.stock}"
            data-image="${v.image || productData.image}"
            data-full-name="${v.fullName || productData.nome}">
            ${v.weight}
        </button>
    `).join('');

    let priceHTML = '';
    let discountBadgeHTML = '';

    if (defaultVariation.originalPrice && defaultVariation.originalPrice > defaultVariation.price) {
        priceHTML = `
            <div>
                <span class="product-original-price-display text-sm text-gray-400 line-through">${formatCurrency(defaultVariation.originalPrice)}</span>
                <span class="product-price-display text-primary font-bold text-lg block">${formatCurrency(defaultVariation.price)}</span>
            </div>`;
        const discount = Math.round(((defaultVariation.originalPrice - defaultVariation.price) / defaultVariation.originalPrice) * 100);
        discountBadgeHTML = `<div class="product-discount-display absolute top-2 left-2 bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-md">-${discount}%</div>`;

    } else {
        priceHTML = `<div class="flex items-center"><span class="product-price-display text-primary font-bold text-lg">${formatCurrency(defaultVariation.price)}</span></div>`;
    }

    return `
        <div class="product-card bg-white rounded-lg shadow transition-all duration-300 hover:shadow-xl hover:-translate-y-1 flex flex-col" data-product-id="${productId}">
            <div class="relative">
                ${discountBadgeHTML}
                <button class="favorite-btn absolute top-2 right-2 text-2xl z-10" data-id="${productId}">
                    <i class="${favIconClass} fa-heart"></i>
                </button>
                <a href="#" class="nav-link block" data-page="produto" data-id="${productId}">
                    <img src="${defaultVariation.image || productData.image}" alt="${productData.nome}" class="w-full h-48 object-contain p-4 product-card-image">
                </a>
            </div>
            <div class="p-4 flex flex-col flex-grow">
                <h3 class="font-medium text-gray-800 mb-2 min-h-[3.5rem] product-name-display">${defaultVariation.fullName || productData.nome}</h3>
                <div class="product-price-container mb-2">${priceHTML}</div>
                <div class="variations-container mb-4 flex flex-wrap justify-center gap-2">${variationsHTML}</div>
                <button class="add-to-cart-btn w-full bg-secondary text-white py-2 rounded-lg font-medium mt-auto"
                    data-id="${productId}"
                    data-name="${defaultVariation.fullName || productData.nome}"
                    data-price="${defaultVariation.price}"
                    data-image="${defaultVariation.image || productData.image}"
                    data-weight="${defaultVariation.weight}">
                    <i class="fas fa-shopping-cart mr-2"></i> Adicionar
                </button>
            </div>
        </div>
    `;
}

function renderCart() {
    const container = document.getElementById('cart-items-container');
    if (!container) return;
    container.innerHTML = '';
    if (state.cart.length === 0) {
        container.innerHTML = `
            <div class="empty-cart-container">
                <div class="empty-cart-animation-wrapper">
                    <i class="fas fa-shopping-cart empty-cart-main-icon"></i>
                    <div class="empty-cart-floating-icon floating-1"><i class="fas fa-bone"></i></div>
                    <div class="empty-cart-floating-icon floating-2"><i class="fas fa-fish"></i></div>
                    <div class="empty-cart-floating-icon floating-3"><i class="fas fa-cat"></i></div>
                    <div class="empty-cart-floating-icon floating-4"><i class="fas fa-heart"></i></div>
                </div>
                <h2 class="text-2xl font-bold text-gray-800 mb-2">Seu carrinho está vazio!</h2>
                <p class="text-gray-600 mb-6">Parece que você ainda não adicionou nada. Que tal explorar nossos produtos?</p>
                <button class="nav-link w-full md:w-auto bg-primary hover:bg-orange-700 text-white py-3 px-8 rounded-lg font-bold transition duration-300 flex items-center justify-center" data-page="home">
                    <i class="fas fa-search mr-2"></i> Buscar Produtos
                </button>
            </div>`;
        document.getElementById('clear-cart-btn')?.classList.add('hidden');
    } else {
        document.getElementById('clear-cart-btn')?.classList.remove('hidden');
        state.cart.forEach(item => {
            container.insertAdjacentHTML('beforeend', `<div class="flex flex-col md:flex-row items-center bg-white p-4 rounded-lg shadow-sm gap-4"><img src="${item.image}" alt="${item.name}" class="w-24 h-24 object-contain rounded-md"><div class="flex-1"><h3 class="font-bold text-gray-800">${item.name}</h3><p class="text-sm text-gray-500">Preço: ${formatCurrency(item.price)}</p></div><div class="flex items-center gap-2 border border-black rounded-full px-2"><button class="quantity-change text-lg font-bold text-primary" data-id="${item.id}" data-change="-1">-</button><input type="number" value="${item.quantity}" readonly class="w-12 text-center font-bold bg-transparent"><button class="quantity-change text-lg font-bold text-primary" data-id="${item.id}" data-change="1">+</button></div><div class="font-bold text-gray-800 w-24 text-center">${formatCurrency(item.price * item.quantity)}</div><button class="remove-from-cart text-red-500" data-id="${item.id}"><i class="fas fa-trash-alt"></i></button></div>`);
        });
    }
    updateTotals();
}

async function renderFavoritesPage() {
    const container = document.getElementById('favorites-items-container');
    const emptyState = document.getElementById('favorites-empty-state');
    const clearBtn = document.getElementById('clear-favorites-btn');
    const summaryEl = document.getElementById('favorites-summary');

    if (!container || !emptyState || !clearBtn || !summaryEl) {
        console.error("ERRO: Elementos essenciais da página de favoritos não foram encontrados no HTML.");
        return;
    }

    const count = state.favorites.length;
    summaryEl.textContent = `Você tem ${count} ${count === 1 ? 'item salvo' : 'itens salvos'}.`;

    if (count === 0) {
        emptyState.classList.remove('hidden');
        container.classList.add('hidden');
        clearBtn.classList.add('hidden');
        container.innerHTML = '';
        return;
    }

    emptyState.classList.add('hidden');
    container.classList.remove('hidden');
    clearBtn.classList.remove('hidden');
    container.innerHTML = '<p class="col-span-full text-center">Carregando seus produtos favoritos...</p>';

    try {
        const favoriteProductPromises = state.favorites.map(fav => getDoc(doc(db, 'produtos', fav.id)));
        const favoriteProductDocs = await Promise.all(favoriteProductPromises);
        let productsHTML = '';
        favoriteProductDocs.forEach(doc => {
            if (doc.exists()) {
                productsHTML += createProductCardHTML(doc.data(), doc.id);
            } else {
                console.warn(`Produto favoritado com ID ${doc.id} não foi encontrado.`);
            }
        });
        container.innerHTML = productsHTML || '<p class="col-span-full text-center">Nenhum de seus produtos favoritos foi encontrado.</p>';
        updateAllHeartIcons();
    } catch (error) {
        console.error("Erro ao carregar produtos favoritos:", error);
        container.innerHTML = '<p class="col-span-full text-center text-red-500">Ocorreu um erro ao carregar seus favoritos.</p>';
    }
}

function renderCheckoutSummary() {
    const container = document.getElementById('checkout-summary-items');
    if (!container) return;
    container.innerHTML = '';
    state.cart.forEach(item => {
        container.insertAdjacentHTML('beforeend', `<div class="flex justify-between items-center text-sm"><div class="flex items-center gap-2"><img src="${item.image}" alt="${item.name}" class="w-10 h-10 object-contain rounded"><span>${item.name} (x${item.quantity})</span></div><span class="font-medium">${formatCurrency(item.price * item.quantity)}</span></div>`);
    });
    updateTotals();
}

function renderCalendar() {
    const agendaGrid = document.getElementById('agenda-grid');
    if (!agendaGrid) return;
    agendaGrid.innerHTML = '';
    const today = new Date('2025-08-15T10:00:00'); // Data fixa para consistência
    const daysOfWeek = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
    const hours = ['08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00'];
    agendaGrid.insertAdjacentHTML('beforeend', '<div></div>');
    for (let i = 0; i < 7; i++) {
        const day = new Date(today);
        day.setDate(today.getDate() + i);
        const dayName = daysOfWeek[day.getDay()];
        const dayDate = `${String(day.getDate()).padStart(2, '0')}/${String(day.getMonth() + 1).padStart(2, '0')}`;
        agendaGrid.insertAdjacentHTML('beforeend', `<div class="day-header">${dayName}<br>${dayDate}</div>`);
    }
    hours.forEach(hour => {
        agendaGrid.insertAdjacentHTML('beforeend', `<div class="time-label">${hour}</div>`);
        for (let i = 0; i < 7; i++) {
            const day = new Date(today);
            day.setDate(today.getDate() + i);
            const dayDate = `${String(day.getDate()).padStart(2, '0')}/${String(day.getMonth() + 1).padStart(2, '0')}`;
            const appointment = state.appointments.find(a => a.day === dayDate && a.time === hour);
            if (appointment) {
                const appointmentData = JSON.stringify(appointment).replace(/'/g, "'");
                agendaGrid.insertAdjacentHTML('beforeend', `<div class="time-slot booked" data-appointment='${appointmentData}'><span class="booked-name">${censorString(appointment.petName)}</span><span class="booked-status">Reservado</span></div>`);
            } else {
                agendaGrid.insertAdjacentHTML('beforeend', `<div class="time-slot available" data-day="${dayDate}" data-time="${hour}"><i class="fas fa-plus"></i></div>`);
            }
        }
    });
}

async function renderFeaturedProducts() {
    const container = document.getElementById('featured-products-container');
    if (!container) return;
    try {
        const snapshot = await getDocs(query(collection(db, 'produtos'), where('featured', '==', true)));
        if (snapshot.empty) {
            container.innerHTML = '<p class="col-span-full text-center text-gray-500">Nenhum produto em destaque no momento.</p>';
            return;
        }
        container.innerHTML = '';
        snapshot.forEach(doc => {
            container.insertAdjacentHTML('beforeend', createProductCardHTML(doc.data(), doc.id));
        });
        updateAllHeartIcons();
    } catch (error) {
        console.error("Erro ao buscar produtos em destaque: ", error);
        container.innerHTML = '<p class="col-span-full text-center text-red-500">Não foi possível carregar os produtos.</p>';
    }
}

// --- Funções da Página de Produto ---
async function renderProductPage(productId) {
    try {
        const docRef = doc(db, 'produtos', productId);
        const docSnap = await getDoc(docRef);
        if (!docSnap.exists()) {
            appRoot.innerHTML = `<p class="text-center text-red-500 py-20">Produto não encontrado.</p>`;
            return;
        }

        const productData = docSnap.data();
        if (!productData.variations || productData.variations.length === 0) {
            appRoot.innerHTML = `<p class="text-center text-red-500 py-20">Erro: Produto sem variações cadastradas.</p>`;
            return;
        }

        const defaultIndex = productData.defaultVariationIndex || 0;
        const defaultVariation = productData.variations[defaultIndex];
        const categoryForReviews = productData.category || 'geral';
        const reviews = generateRealisticReviews(productId, categoryForReviews);

        const el = (id) => document.getElementById(id);
        if (el('main-product-image')) el('main-product-image').src = defaultVariation.image || productData.image;
        if (el('product-name')) el('product-name').textContent = defaultVariation.fullName || productData.nome;
        if (el('product-brand')) el('product-brand').querySelector('span').textContent = productData.brand || "N/A";
        if (el('product-price')) el('product-price').textContent = formatCurrency(defaultVariation.price);
        if (el('breadcrumb-category')) el('breadcrumb-category').textContent = productData.category || "N/A";

        const descriptionContainer = el('product-description');
        if (descriptionContainer) {
            descriptionContainer.innerHTML = productData.description ? `<p>${productData.description.replace(/\n/g, '</p><p>')}</p>` : '<p>Sem descrição.</p>';
        }

        renderStockStatus(defaultVariation.stock);
        renderReviews(reviews);
        renderStarRating(reviews);
        renderProductSpecs(productData.specifications);
        renderRelatedProducts(productData.category, productId);

        const originalPriceEl = el('product-original-price');
        const discountBadgeEl = el('product-discount-badge');
        if (originalPriceEl && discountBadgeEl) {
            if (defaultVariation.originalPrice && defaultVariation.originalPrice > defaultVariation.price) {
                originalPriceEl.textContent = formatCurrency(defaultVariation.originalPrice);
                originalPriceEl.classList.remove('hidden');
                const discount = Math.round(((defaultVariation.originalPrice - defaultVariation.price) / defaultVariation.originalPrice) * 100);
                discountBadgeEl.textContent = `-${discount}%`;
                discountBadgeEl.classList.remove('hidden');
            } else {
                originalPriceEl.classList.add('hidden');
                discountBadgeEl.classList.add('hidden');
            }
        }

        const variationsContainer = document.querySelector('#product-variations .variations-container');
        if (variationsContainer) {
            variationsContainer.innerHTML = productData.variations.map((v, index) => `
                <button class="variation-btn ${index === defaultIndex ? 'selected' : ''}" data-price="${v.price}" data-original-price="${v.originalPrice || ''}" data-weight="${v.weight}" data-stock="${v.stock}" data-image="${v.image || productData.image}" data-full-name="${v.fullName || productData.nome}">
                    ${v.weight}
                </button>`).join('');
        }

        const addToCartBtn = el('add-to-cart-product-page');
        if (addToCartBtn) {
            addToCartBtn.dataset.id = productId;
            addToCartBtn.dataset.name = defaultVariation.fullName || productData.nome;
            addToCartBtn.dataset.price = defaultVariation.price;
            addToCartBtn.dataset.image = defaultVariation.image || productData.image;
            addToCartBtn.dataset.weight = defaultVariation.weight;
            addToCartBtn.classList.add('add-to-cart-btn');
        }

    } catch (error) {
        console.error("Erro CRÍTICO ao renderizar página do produto:", error);
        appRoot.innerHTML = `<p class="text-center text-red-500 py-20">Ocorreu um erro ao carregar este produto.</p>`;
    }
}

function renderStockStatus(stock = 0) {
    const container = document.getElementById('product-stock-status');
    if (!container) return;
    if (stock > 10) {
        container.innerHTML = `<span class="stock-status stock-in"><i class="fas fa-check-circle"></i> Em estoque</span>`;
    } else if (stock > 0) {
        container.innerHTML = `<span class="stock-status stock-low"><i class="fas fa-exclamation-triangle"></i> Últimas ${stock} unidades!</span>`;
    } else {
        container.innerHTML = `<span class="stock-status stock-out"><i class="fas fa-times-circle"></i> Esgotado</span>`;
    }
}

function renderProductSpecs(specs = {}) {
    const container = document.getElementById('tab-specs');
    if (!container) return;
    if (Object.keys(specs).length === 0) {
        container.innerHTML = '<p>Não há especificações técnicas para este produto.</p>';
        return;
    }
    let specsHTML = '<ul class="space-y-4 text-gray-600">';
    for (const [key, value] of Object.entries(specs)) {
        specsHTML += `<li><strong class="font-semibold text-gray-800">${key}:</strong> ${value}</li>`;
    }
    specsHTML += '</ul>';
    container.innerHTML = specsHTML;
}

async function renderRelatedProducts(category, currentProductId) {
    const container = document.getElementById('related-products-container');
    if (!container) return;
    try {
        const snapshot = await getDocs(query(collection(db, 'produtos'), where('category', '==', category), where(FieldPath.documentId(), '!=', currentProductId), limit(4)));

        if (snapshot.empty) {
            container.innerHTML = '<p class="col-span-full">Nenhum outro produto encontrado nesta categoria.</p>';
            return;
        }
        container.innerHTML = '';
        snapshot.forEach(doc => {
            container.insertAdjacentHTML('beforeend', createProductCardHTML(doc.data(), doc.id));
        });
        updateAllHeartIcons();
    } catch (error) {
        console.error("Erro ao buscar produtos relacionados: ", error);
        container.innerHTML = '<p class="col-span-full text-red-500">Não foi possível carregar produtos relacionados.</p>';
    }
}

// --- Funções de Avaliações (Reviews) ---
function generateRealisticReviews(productId, productCategory) {
    const bancoDeDados = {
        perfis: [
            { nome: "Ana S.", pet: "Thor", raca: "Golden Retriever" }, { nome: "Bruno C.", pet: "Nina", raca: "Gata SRD" },
            { nome: "Carla M.", pet: "Luke", raca: "Bulldog Francês" }, { nome: "Diego F.", pet: "Mel", raca: "Shih Tzu" },
            { nome: "Elisa R.", pet: "Simba", raca: "Gato Persa" }, { nome: "Fábio L.", pet: "Bolinha", raca: "Lhasa Apso" },
            { nome: "Mariana P.", pet: "Fred", raca: "Spitz Alemão" }, { nome: "Lucas G.", pet: "Biscoito", raca: "Beagle" },
            { nome: "Sofia A.", pet: "Paçoca", raca: "Gato Siamês" }, { nome: "Rafael B.", pet: "Rocky", raca: "Vira-lata Caramelo" }
        ],
        templatesPorCategoria: {
            ração: ["O {pet}, meu {raca}, devorou essa ração! Notei o pelo dele até mais brilhante.", "Excelente! Ajudou muito na digestão do {pet}. Ótimo custo-benefício.", "Meu {raca} se adaptou super bem.", "Qualidade premium. O {pet} fica ansioso pela hora de comer."],
            brinquedo: ["Este brinquedo é o novo favorito do {pet}! Super resistente.", "Mantém o {pet} entretido por horas!", "A {pet} ficou doida com o barulhinho que faz!", "Ótimo para a saúde dental do {pet}."],
            higiene: ["Usei este shampoo no {pet} e o resultado foi incrível. Deixou o pelo super macio e cheiroso.", "Meu {raca} tem a pele sensível e este produto não causou nenhuma irritação.", "O perfume é muito bom, não é forte demais.", "Prático e eficiente para limpeza das patinhas."],
            farmacia: ["Foi muito fácil de administrar para o {pet}. O efeito foi rápido.", "Produto recomendado pelo nosso veterinário. Cumpriu o que prometia.", "Aliviou o desconforto do meu {raca} quase que imediatamente.", "O aplicador facilita muito o uso."],
            geral: ["Produto de excelente qualidade. O {pet} se adaptou super bem.", "Estou muito satisfeito com a compra.", "Recomendo! Um dos melhores produtos que já comprei para o {pet}."]
        }
    };
    const getCategoriaRelevante = (cat) => {
        const c = (cat || "").toLowerCase();
        if (c.includes('ração') || c.includes('alimento')) return 'ração';
        if (c.includes('brinquedo')) return 'brinquedo';
        if (c.includes('higiene') || c.includes('shampoo')) return 'higiene';
        if (c.includes('farmácia') || c.includes('remédio')) return 'farmacia';
        return 'geral';
    };
    let seed = productId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const nextRandom = () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;
    const numReviews = 5 + Math.floor(nextRandom() * 6);
    const categoria = getCategoriaRelevante(productCategory);
    const templates = bancoDeDados.templatesPorCategoria[categoria];
    const usedProfiles = new Set();
    const reviews = [];
    for (let i = 0; i < numReviews; i++) {
        const perfil = bancoDeDados.perfis[Math.floor(nextRandom() * bancoDeDados.perfis.length)];
        if (usedProfiles.has(perfil.nome)) continue;
        usedProfiles.add(perfil.nome);
        const diasAtras = Math.floor(nextRandom() * 120) + 1;
        const data = new Date();
        data.setDate(data.getDate() - diasAtras);
        let comentario = templates[Math.floor(nextRandom() * templates.length)];
        reviews.push({
            nome: `${perfil.nome}`,
            avatar: perfil.nome.substring(0, 1),
            estrelas: Math.round((4 + nextRandom()) * 2) / 2,
            data: data.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' }),
            comentario: comentario.replace(/{pet}/g, perfil.pet).replace(/{raca}/g, perfil.raca),
            verificada: true
        });
    }
    return reviews;
}

function renderReviews(reviews) {
    const container = document.getElementById('tab-reviews');
    if (!container) return;
    if (reviews.length === 0) {
        container.innerHTML = '<p>Este produto ainda não possui avaliações.</p>';
        return;
    }
    let reviewsHTML = '';
    reviews.forEach(review => {
        let starsHTML = '';
        const fullStars = Math.floor(review.estrelas);
        const halfStar = review.estrelas % 1 !== 0;
        for (let i = 0; i < fullStars; i++) starsHTML += '<i class="fas fa-star"></i>';
        if (halfStar) starsHTML += '<i class="fas fa-star-half-alt"></i>';
        reviewsHTML += `
            <div class="review-card">
                <div class="review-header">
                    <div class="review-avatar">${review.avatar}</div>
                    <div>
                        <p class="review-author">${review.nome}</p>
                        <p class="review-date">${review.data}</p>
                    </div>
                    ${review.verificada ? '<span class="verified-purchase"><i class="fas fa-check-circle"></i> Compra Verificada</span>' : ''}
                </div>
                <div class="review-stars text-yellow-500">${starsHTML}</div>
                <p class="review-comment">${review.comentario}</p>
            </div>`;
    });
    container.innerHTML = reviewsHTML;
}

function renderStarRating(reviews) {
    const container = document.getElementById('product-stars');
    if (!container) return;
    const rating = reviews.reduce((acc, r) => acc + r.estrelas, 0) / reviews.length || 0;
    const reviewCount = reviews.length;
    let starsHTML = '';
    const fullStars = Math.floor(rating);
    const halfStar = rating % 1 !== 0;
    const emptyStars = 5 - fullStars - (halfStar ? 1 : 0);
    for (let i = 0; i < fullStars; i++) starsHTML += '<i class="fas fa-star"></i>';
    if (halfStar) starsHTML += '<i class="fas fa-star-half-alt"></i>';
    for (let i = 0; i < emptyStars; i++) starsHTML += '<i class="far fa-star"></i>';
    container.innerHTML = `${starsHTML} <span class="review-count">(${reviewCount} avaliações)</span>`;
}

// --- Funções da Página de Busca ---
async function renderBuscaPage(params) {
    const searchTerm = params.query || '';
    const grid = document.getElementById('products-grid');
    const countEl = document.getElementById('products-count');
    const titleEl = document.querySelector('#app-root h1');

    if (grid) grid.innerHTML = '<p class="col-span-full text-center py-8">Buscando produtos...</p>';
    if (countEl) countEl.textContent = '...';

    try {
        const snapshot = await getDocs(query(collection(db, 'produtos'), where('featured', '==', true)));
        currentSearchResults = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        let initialProducts = currentSearchResults;
        if (searchTerm) {
            if (titleEl) titleEl.textContent = `Resultados para "${searchTerm}"`;
            const lowerCaseTerm = searchTerm.toLowerCase();

            initialProducts = currentSearchResults.filter(p => {
                let nameMatch = false;
                if (typeof p.nome === 'string') {
                    nameMatch = p.nome.toLowerCase().includes(lowerCaseTerm);
                } else if (Array.isArray(p.nome)) {
                    nameMatch = p.nome.some(name => typeof name === 'string' && name.toLowerCase().includes(lowerCaseTerm));
                }
                const brandMatch = (p.brand || "").toLowerCase().includes(lowerCaseTerm);
                const keywordMatch = Array.isArray(p.search_keywords) && p.search_keywords.some(k =>
                    typeof k === 'string' && k.toLowerCase().includes(lowerCaseTerm)
                );
                const variationMatch = Array.isArray(p.variations) && p.variations.some(v =>
                    (v.fullName || "").toLowerCase().includes(lowerCaseTerm)
                );
                return nameMatch || brandMatch || keywordMatch || variationMatch;
            });
        } else {
            if (titleEl) titleEl.textContent = 'Todos os Produtos';
        }

        generateFilters(initialProducts);
        displayProducts(initialProducts);

        document.getElementById('filters-container')?.addEventListener('change', applyFilters);
        document.getElementById('sort-by')?.addEventListener('change', applyFilters);

    } catch (error) {
        console.error("Erro ao buscar produtos:", error);
        if (grid) grid.innerHTML = '<p class="col-span-full text-red-500 text-center">Não foi possível carregar os produtos.</p>';
    }
}

function generateFilters(products) {
    const container = document.getElementById('filters-container');
    if (!container) return;
    const filters = { brand: new Set(), pet_type: new Set(), size: new Set(), age: new Set() };
    products.forEach(p => {
        if (p.brand) filters.brand.add(p.brand);
        if (p.pet_type) filters.pet_type.add(p.pet_type);
        if (p.size) filters.size.add(p.size);
        if (p.age) filters.age.add(p.age);
    });
    const createFilterGroup = (title, key, options) => {
        if (options.size === 0) return '';
        const optionsHTML = [...options].sort().map(option => `
            <div>
                <label class="flex items-center cursor-pointer">
                    <input type="checkbox" data-filter-key="${key}" value="${option}" class="mr-2">
                    <span class="capitalize">${option}</span>
                </label>
            </div>`).join('');
        return `<div class="border-t pt-4"><h3 class="font-semibold mb-2">${title}</h3><div class="space-y-2">${optionsHTML}</div></div>`;
    };
    let html = '';
    html += createFilterGroup('Marca', 'brand', filters.brand);
    html += createFilterGroup('Tipo de Pet', 'pet_type', filters.pet_type);
    html += createFilterGroup('Porte', 'size', filters.size);
    html += createFilterGroup('Idade', 'age', filters.age);
    container.innerHTML = html || '<p>Nenhum filtro disponível.</p>';
}

function applyFilters() {
    const selectedFilters = { brand: [], pet_type: [], size: [], age: [] };
    document.querySelectorAll('#filters-container input:checked').forEach(input => {
        selectedFilters[input.dataset.filterKey].push(input.value);
    });

    let filteredProducts = currentSearchResults.filter(product => {
        return Object.keys(selectedFilters).every(key => {
            if (selectedFilters[key].length === 0) return true;
            return selectedFilters[key].includes(product[key]);
        });
    });

    const sortBy = document.getElementById('sort-by').value;
    const sortableProducts = filteredProducts.filter(p => p.variations && p.variations.length > 0);

    if (sortBy === 'price-asc') {
        sortableProducts.sort((a, b) => a.variations[0].price - b.variations[0].price);
    } else if (sortBy === 'price-desc') {
        sortableProducts.sort((a, b) => b.variations[0].price - a.variations[0].price);
    }
    displayProducts(sortableProducts);
}

function displayProducts(products) {
    const grid = document.getElementById('products-grid');
    const countEl = document.getElementById('products-count');
    if (!grid || !countEl) return;
    countEl.textContent = `${products.length} produtos encontrados`;
    if (products.length === 0) {
        grid.innerHTML = '<p class="col-span-full text-center">Nenhum produto encontrado com estes filtros.</p>';
        return;
    }
    grid.innerHTML = products.map(p => createProductCardHTML(p, p.id)).join('');
    updateAllHeartIcons();
}
// --- MANIPULADORES DE EVENTOS (HANDLERS) ---
function handleAddToCart(event) {
    const button = event.target.closest('.add-to-cart-btn');
    if (!button || button.classList.contains('added')) return;
    const quantityInput = document.getElementById('product-quantity');
    const quantity = quantityInput ? parseInt(quantityInput.value) : 1;
    const productData = button.dataset;
    if (!productData.id) return;

    const existingProduct = state.cart.find(item => item.id === productData.id && item.name === productData.name);
    if (existingProduct) {
        existingProduct.quantity += quantity;
    } else {
        state.cart.push({
            id: productData.id,
            name: productData.name,
            price: parseFloat(productData.price),
            image: productData.image,
            quantity: quantity,
            weight: productData.weight
        });
    }
    save.cart();
    updateCounters();
    const originalContent = button.innerHTML;
    button.classList.add('added', 'bg-green-500');
    button.innerHTML = `<i class="fas fa-check mr-2"></i> Adicionado!`;
    setTimeout(() => {
        button.classList.remove('added', 'bg-green-500');
        button.innerHTML = originalContent;
        if (quantityInput) quantityInput.value = '1';
    }, 2000);
}

function handleFavoriteToggle(event) {
    const button = event.target.closest('.favorite-btn');
    if (!button) return;
    const card = button.closest('.product-card');
    if (!card) return;
    const productId = card.dataset.productId;

    const favoriteIndex = state.favorites.findIndex(item => item.id === productId);

    if (favoriteIndex > -1) {
        state.favorites.splice(favoriteIndex, 1);
        showAnimation('unfavorite-animation-overlay', 1500);
    } else {
        state.favorites.push({ id: productId });
    }

    save.favorites();
    updateCounters();
    updateAllHeartIcons();

    if (document.getElementById('favorites-items-container')) {
        renderFavoritesPage();
    }
}

// --- LÓGICA DE AUTENTICAÇÃO ---
function handleSocialLogin(providerName) {
    const errorEl = document.getElementById('login-error');
    if (errorEl) errorEl.classList.add('hidden');
    let provider;
    if (providerName === 'google') provider = new GoogleAuthProvider();
    else if (providerName === 'apple') provider = new OAuthProvider('apple.com');
    else return;

    signInWithPopup(auth, provider).then(result => {
        if (result.additionalUserInfo.isNewUser) {
            const user = result.user;
            return setDoc(doc(db, 'users', user.uid), {
                name: user.displayName,
                email: user.email,
                createdAt: serverTimestamp()
            });
        }
    }).then(() => loadPage('home'))
        .catch(error => {
            console.error("Erro no login social:", error);
            if (error.code === 'auth/popup-closed-by-user') return;
            const msg = error.code === 'auth/account-exists-with-different-credential'
                ? "Já existe uma conta com este e-mail. Tente o método original."
                : "Ocorreu um erro ao tentar entrar. Tente novamente.";
            if (errorEl) {
                errorEl.textContent = msg;
                errorEl.classList.remove('hidden');
            }
        });
}

function handleCreateAccount(event) {
    event.preventDefault();
    const name = document.getElementById('signup-name').value;
    const email = document.getElementById('signup-email').value;
    const password = document.getElementById('signup-password').value;
    const errorEl = document.getElementById('signup-error');
    errorEl.classList.add('hidden');

    createUserWithEmailAndPassword(auth, email, password)
        .then(cred => setDoc(doc(db, 'users', cred.user.uid), {
            name: name, email: email, createdAt: serverTimestamp()
        }))
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

    signInWithEmailAndPassword(auth, email, password)
        .then(() => loadPage('home'))
        .catch(error => {
            console.error("Erro ao fazer login:", error);
            errorEl.textContent = "E-mail ou senha inválidos.";
            errorEl.classList.remove('hidden');
        });
}

function handleLogout() {
    signOut(auth).catch(error => console.error("Erro ao fazer logout:", error));
}

// --- LÓGICA DO CHATBOT ---
function addChatMessage(message, sender) {
    const chatWindowBody = document.querySelector('#marrie-chat-window .overflow-y-auto');
    if (!chatWindowBody) return;
    chatWindowBody.querySelector('.typing-indicator')?.remove();
    chatWindowBody.insertAdjacentHTML('beforeend', `<div class="chat-message-container"><div class="chat-message ${sender}-message">${message}</div></div>`);
    chatWindowBody.scrollTop = chatWindowBody.scrollHeight;
}

function showTypingIndicator() {
    const chatWindowBody = document.querySelector('#marrie-chat-window .overflow-y-auto');
    if (!chatWindowBody) return;
    chatWindowBody.insertAdjacentHTML('beforeend', '<div class="typing-indicator"><span></span><span></span><span></span></div>');
    chatWindowBody.scrollTop = chatWindowBody.scrollHeight;
}

async function handleSendMessage() {
    const chatInput = document.getElementById('marrie-chat-input');
    if (!chatInput) return;
    const userMessage = chatInput.value.trim();
    if (!userMessage) return;

    addChatMessage(userMessage, 'user');
    chatInput.value = '';
    showTypingIndicator();

    try {
        const response = await fetch('https://jpet-clinica.onrender.com/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: userMessage }),
        });
        if (!response.ok) throw new Error('A resposta da rede não foi OK.');
        const data = await response.json();
        addChatMessage(data.reply, 'ai');
    } catch (error) {
        console.error('Erro ao contatar a Marrie:', error);
        addChatMessage('Desculpe, estou com um probleminha para me conectar. Tente novamente mais tarde.', 'ai');
    }
}

// --- FUNÇÕES DE PEDIDOS E RASTREIO ---
async function renderMyOrdersPage() {
    const container = document.getElementById('my-orders-container');
    const emptyState = document.getElementById('orders-empty-state');
    if (!container || !emptyState) return;

    if (!state.loggedInUser) {
        container.innerHTML = '<p>Você precisa estar logado para ver seus pedidos.</p>';
        return;
    }

    onSnapshot(query(collection(db, 'orders'), where('userId', '==', state.loggedInUser.uid), orderBy('orderDate', 'desc')), (querySnapshot) => {
        if (querySnapshot.empty) {
            container.classList.add('hidden');
            emptyState.classList.remove('hidden');
            return;
        }

        container.classList.remove('hidden');
        emptyState.classList.add('hidden');

        let ordersHTML = '';
        querySnapshot.forEach(doc => {
            const order = doc.data();
            const orderDate = order.orderDate ? order.orderDate.toDate().toLocaleDateString('pt-BR', { year: 'numeric', month: 'long', day: 'numeric' }) : 'Carregando...';
            const productsHTML = order.items.map(item => `
                <div class="p-2">
                    <img src="${item.image}" alt="${item.name}" class="w-20 h-20 object-contain">
                </div>
            `).join('');

            ordersHTML += `
                <a href="#" class="order-card nav-link" data-page="acompanhar-entrega" data-id="${doc.id}">
                    <div class="order-card-header bg-gray-50">
                        <div>
                            <p class="font-semibold text-gray-800">Pedido #${doc.id.slice(-6).toUpperCase()}</p>
                            <p class="text-sm text-gray-500">Feito em ${orderDate}</p>
                        </div>
                        <div class="text-right">
                           <p class="font-semibold text-secondary">${order.status}</p>
                           <p class="text-sm text-gray-500">${order.estimatedDelivery || ''}</p>
                        </div>
                    </div>
                    <div class="order-card-body flex-wrap gap-2">
                        ${productsHTML}
                    </div>
                </a>
            `;
        });
        container.innerHTML = ordersHTML;
    });
}

async function renderTrackingPage(orderId) {
    const order = state.orders.find(o => o.id === orderId);

    if (!order) {
        appRoot.innerHTML = `<p class="text-center text-red-500 py-20">Pedido não encontrado.</p>`;
        return;
    }

    const mainProduct = order.items[0];
    document.getElementById('tracking-product-image').src = mainProduct.image;
    document.getElementById('tracking-product-name').textContent = mainProduct.name + (order.items.length > 1 ? ` e mais ${order.items.length - 1} item(ns)` : '');

    const statuses = ['Pedido Realizado', 'Pagamento Confirmado', 'Em Separação', 'Saiu para Entrega', 'Entregue'];
    const timeSinceOrder = Date.now() - order.orderDate;
    let currentStatusIndex = 0;
    if (timeSinceOrder > 3 * 60 * 1000) currentStatusIndex = 4;
    else if (timeSinceOrder > 2 * 60 * 1000) currentStatusIndex = 3;
    else if (timeSinceOrder > 1 * 60 * 1000) currentStatusIndex = 2;
    else if (timeSinceOrder > 30 * 1000) currentStatusIndex = 1;

    const deliveryDate = new Date(order.orderDate);
    deliveryDate.setDate(deliveryDate.getDate() + 5);
    document.getElementById('tracking-delivery-estimate').textContent = `Chega ${deliveryDate.toLocaleDateString('pt-BR', { weekday: 'long' })}, ${deliveryDate.toLocaleDateString('pt-BR')}`;

    const timelineContainer = document.getElementById('tracking-timeline-container');
    let timelineHTML = '';

    statuses.forEach((status, index) => {
        let statusClass = 'pending';
        if (index < currentStatusIndex) {
            statusClass = 'completed';
        } else if (index === currentStatusIndex) {
            statusClass = 'current';
        }

        timelineHTML += `<div class="timeline-step ${statusClass}"><span>${status}</span></div>`;
    });

    const progressPercentage = (currentStatusIndex / (statuses.length - 1)) * 100;

    timelineContainer.innerHTML = `
        <div class="progress-bar-background">
            <div class="progress-bar-foreground" style="width: ${progressPercentage}%;"></div>
        </div>
        <div class="timeline-steps">
            ${timelineHTML}
        </div>
    `;
}

// --- ROTEDOR E CARREGADOR DE PÁGINAS ---
async function loadComponent(url, placeholderId) {
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Falha ao carregar ${url}`);
        document.getElementById(placeholderId).innerHTML = await response.text();
    } catch (error) {
        console.error(error);
        document.getElementById(placeholderId).innerHTML = `<p class="text-red-500">Erro ao carregar componente.</p>`;
    }
}

async function loadPage(pageName, params = {}) {
    if (pageName === 'admin') {
        if (!state.loggedInUser || state.loggedInUser.role !== 'admin') {
            appRoot.innerHTML = `<div class="text-center py-20">
                <h1 class="text-3xl font-bold text-red-500">Acesso Negado</h1>
                <p class="text-gray-600 mt-2">Você não tem permissão para acessar esta página.</p>
                <a href="#" class="nav-link inline-block mt-4 bg-primary text-white font-bold py-2 px-6 rounded-full" data-page="home">Voltar para o Início</a>
            </div>`;
            loadingOverlay.style.display = 'none';
            return;
        }
        document.body.classList.add('admin-view');
    } else {
        document.body.classList.remove('admin-view');
    }

    managePageStyles(pageName);
    loadingOverlay.style.display = 'flex';

    try {
        const response = await fetch(`pages/${pageName}.html`);
        if (!response.ok) throw new Error(`Página não encontrada: ${pageName}.html`);
        appRoot.innerHTML = await response.text();

        if (pageName !== 'home') {
            const backButtonHTML = `<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
                <a href="#" class="nav-link btn-voltar-inicio" data-page="home" data-dynamic-back-button="true">
                    <i class="fas fa-arrow-left mr-3"></i>Voltar para o início
                </a>
            </div>`;
            appRoot.insertAdjacentHTML('afterbegin', backButtonHTML);
            appRoot.querySelectorAll('a, button').forEach(element => {
                const hasText = element.textContent.trim().includes('Voltar para o início');
                const isOurButton = element.hasAttribute('data-dynamic-back-button');
                if (hasText && !isOurButton) {
                    element.parentElement.remove();
                }
            });
        }

        const topBanner = document.getElementById('top-banner');
        if (topBanner) topBanner.classList.toggle('hidden', pageName !== 'home');
        const mainNavBar = document.getElementById('main-nav-bar');
        if (mainNavBar) mainNavBar.classList.toggle('hidden', pageName !== 'home');

        switch (pageName) {
            case 'home':
                initSlider();
                initComparisonSlider();
                await renderFeaturedProducts();
                break;
            case 'cart':
                renderCart();
                initCartPageListeners(state);
                break;
            case 'produto':
                if (params.id) {
                    await renderProductPage(params.id);
                    initProductPageListeners();
                } else {
                    appRoot.innerHTML = `<p class="text-center text-red-500 py-20">ID do produto não fornecido.</p>`;
                }
                break;
            case 'busca':
                await renderBuscaPage(params);
                break;
            case 'checkout':
                renderCheckoutSummary();
                initCheckoutPageListeners(state);
                break;
            case 'favorites':
                await renderFavoritesPage();
                break;
            case 'banho-e-tosa':
                renderCalendar();
                initBanhoTosaEventListeners();
                break;
            case 'meus-pedidos':
                await renderMyOrdersPage();
                break;
            case 'acompanhar-entrega':
                if (params.id) {
                    await renderTrackingPage(params.id);
                } else {
                    await renderMyOrdersPage();
                }
                break;
            case 'admin':
                const adminUserNameEl = document.getElementById('admin-user-name');
                if (adminUserNameEl) {
                    adminUserNameEl.textContent = state.loggedInUser.displayName || state.loggedInUser.email.split('@')[0];
                }

                const adminLogoutBtn = document.querySelector('#admin-user-profile .logout-btn');
                if (adminLogoutBtn) {
                    adminLogoutBtn.addEventListener('click', handleLogout);
                }

                document.querySelectorAll('.admin-nav-link').forEach(link => {
                    link.addEventListener('click', (e) => {
                        e.preventDefault();
                        document.querySelectorAll('.admin-nav-link').forEach(l => l.classList.remove('active'));
                        link.classList.add('active');

                        const adminPage = link.dataset.adminPage;
                        if (adminPage === 'pedidos') {
                            renderAdminOrdersView();
                        } else if (adminPage === 'dashboard') {
                            loadPage('admin');
                        } else {
                            document.getElementById('admin-content').innerHTML = `<h1 class="text-3xl font-bold">Página de ${adminPage} em construção...</h1>`;
                        }
                    });
                });
                break;
            case 'adocao-caes':
            case 'adocao-gatos':
            case 'como-baixar-app':
            case 'instalar-ios':
            case 'farmacia':
                break;
        }

        initPageModals();
        updateLoginStatus();

    } catch (error) {
        console.error('Falha ao carregar a página:', error);
        appRoot.innerHTML = `<p class="text-red-500 text-center py-20">Erro 404: Página não encontrada.</p>`;
    } finally {
        setTimeout(() => loadingOverlay.style.display = 'none', 300);
        window.scrollTo(0, 0);

        if (pageName === 'home') {
            setTimeout(() => {
                document.querySelectorAll('.animate-on-load').forEach(el => {
                    el.classList.add('animated');
                });
            }, 100);
        }
    }
}

// --- INICIALIZAÇÃO DE LISTENERS ---
function initProductPageListeners() {
    const tabContainer = document.getElementById('info-tabs');
    if (tabContainer) {
        const tabButtons = tabContainer.querySelectorAll('.tab-btn');
        const tabPanels = document.querySelectorAll('.tab-panel');
        tabContainer.addEventListener('click', (e) => {
            const clickedTab = e.target.closest('.tab-btn');
            if (!clickedTab) return;
            tabButtons.forEach(btn => btn.classList.remove('active'));
            tabPanels.forEach(panel => panel.classList.remove('active'));
            clickedTab.classList.add('active');
            document.getElementById('tab-' + clickedTab.dataset.tab)?.classList.add('active');
        });
    }

    const quantityInput = document.getElementById('product-quantity');
    const minusBtn = document.getElementById('quantity-minus');
    const plusBtn = document.getElementById('quantity-plus');
    if (minusBtn && plusBtn && quantityInput) {
        minusBtn.addEventListener('click', () => {
            let val = parseInt(quantityInput.value);
            if (val > 1) quantityInput.value = val - 1;
        });
        plusBtn.addEventListener('click', () => {
            quantityInput.value = parseInt(quantityInput.value) + 1;
        });
    }
}

function initBanhoTosaEventListeners() {
    const pageContainer = document.getElementById('app-root');
    if (!pageContainer) return;
    pageContainer.addEventListener('click', e => {
        const openModal = (modal) => { if (modal) modal.style.display = 'flex'; };

        const availableSlot = e.target.closest('.time-slot.available');
        if (availableSlot) {
            if (state.loggedInUser) {
                const bookingModal = document.getElementById('booking-modal');
                const day = availableSlot.dataset.day;
                const time = availableSlot.dataset.time;
                document.getElementById('booking-info').textContent = `${day} às ${time}`;
                document.getElementById('booking-day').value = day;
                document.getElementById('booking-time').value = time;
                openModal(bookingModal);
            } else {
                openModal(document.getElementById('login-required-modal'));
            }
        }
    });

    const bookingForm = document.getElementById('booking-form');
    if (bookingForm) {
        bookingForm.addEventListener('submit', e => {
            e.preventDefault();
            const newAppointment = {
                day: document.getElementById('booking-day').value,
                time: document.getElementById('booking-time').value,
                tutorName: document.getElementById('booking-tutor-name').value,
                petName: document.getElementById('booking-pet-name').value,
                phoneNumber: document.getElementById('booking-phone-number').value
            };
            state.appointments.push(newAppointment);
            save.appointments();
            document.getElementById('booking-modal').style.display = 'none';
            showAnimation('success-animation-overlay', 1500);
            renderCalendar();
        });
    }
}

// --- FUNÇÃO PRINCIPAL DE INICIALIZAÇÃO DA APLICAÇÃO ---
async function startApplication() {
    await Promise.all([
        loadComponent('components/header.html', 'header-placeholder'),
        loadComponent('components/footer.html', 'footer-placeholder')
    ]);

    // --- LISTENERS GLOBAIS ---
    const mobileSearchIcon = document.getElementById('mobile-search-icon');
    const mobileSearchModal = document.getElementById('mobile-search-modal');
    const mobileSearchCloseBtn = document.getElementById('mobile-search-close-btn');
    const mobileSearchForm = document.getElementById('mobile-search-form');
    const mobileSearchInput = document.getElementById('mobile-search-input');

    if (mobileSearchIcon && mobileSearchModal) {
        mobileSearchIcon.addEventListener('click', (e) => {
            e.preventDefault();
            mobileSearchModal.classList.add('active');
            setTimeout(() => mobileSearchInput.focus(), 100);
        });
    }

    if (mobileSearchCloseBtn) {
        mobileSearchCloseBtn.addEventListener('click', () => {
            mobileSearchModal.classList.remove('active');
        });
    }

    if (mobileSearchModal) {
        mobileSearchModal.addEventListener('click', (e) => {
            if (e.target === mobileSearchModal) {
                mobileSearchModal.classList.remove('active');
            }
        });
    }

    if (mobileSearchForm) {
        mobileSearchForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const searchTerm = mobileSearchInput.value.trim();
            if (searchTerm) {
                loadPage('busca', { query: searchTerm });
                mobileSearchModal.classList.remove('active');
                mobileSearchInput.value = '';
            }
        });
    }

    document.body.addEventListener('click', (e) => {
        const target = e.target;

        const navLink = target.closest('.nav-link');
        if (navLink && navLink.dataset.page) {
            e.preventDefault();
            loadPage(navLink.dataset.page, { id: navLink.dataset.id, query: navLink.dataset.query });
        }

        const variationBtn = target.closest('.variation-btn');
        if (variationBtn) {
            e.preventDefault();
            const data = variationBtn.dataset;
            variationBtn.parentElement.querySelectorAll('.variation-btn').forEach(btn => btn.classList.remove('selected'));
            variationBtn.classList.add('selected');

            const card = variationBtn.closest('.product-card');
            if (card) {
                const priceContainer = card.querySelector('.product-price-container');
                const addToCartBtn = card.querySelector('.add-to-cart-btn');
                const cardImage = card.querySelector('.product-card-image');
                const cardName = card.querySelector('.product-name-display');

                if (data.originalPrice && parseFloat(data.originalPrice) > parseFloat(data.price)) {
                    priceContainer.innerHTML = `<div><span class="text-sm text-gray-400 line-through">${formatCurrency(data.originalPrice)}</span><span class="text-primary font-bold text-lg block">${formatCurrency(data.price)}</span></div>`;
                } else {
                    priceContainer.innerHTML = `<div class="h-[48px] flex items-center"><span class="text-primary font-bold text-lg">${formatCurrency(data.price)}</span></div>`;
                }
                if (cardImage && data.image && cardImage.src !== data.image) {
                    cardImage.style.opacity = '0';
                    setTimeout(() => { cardImage.src = data.image; cardImage.style.opacity = '1'; }, 200);
                }
                if (cardName && data.fullName) cardName.textContent = data.fullName;
                addToCartBtn.dataset.price = data.price;
                addToCartBtn.dataset.weight = data.weight;
                addToCartBtn.dataset.image = data.image;
                addToCartBtn.dataset.name = data.fullName;

            } else {
                const el = (id) => document.getElementById(id);
                renderStockStatus(parseInt(data.stock));
                if (el('product-price')) el('product-price').textContent = formatCurrency(data.price);
                const originalPrice = el('product-original-price'), discountBadge = el('product-discount-badge');
                if (originalPrice && discountBadge) {
                    if (data.originalPrice && parseFloat(data.originalPrice) > parseFloat(data.price)) {
                        originalPrice.textContent = formatCurrency(data.originalPrice);
                        const discount = Math.round(((data.originalPrice - data.price) / data.originalPrice) * 100);
                        discountBadge.textContent = `-${discount}%`;
                        originalPrice.classList.remove('hidden');
                        discountBadge.classList.remove('hidden');
                    } else {
                        originalPrice.classList.add('hidden');
                        discountBadge.classList.add('hidden');
                    }
                }
                const pageImage = el('main-product-image');
                if (pageImage && data.image && pageImage.src !== data.image) {
                    pageImage.style.opacity = '0';
                    setTimeout(() => { pageImage.src = data.image; pageImage.style.opacity = '1'; }, 200);
                }
                if (el('product-name') && data.fullName) el('product-name').textContent = data.fullName;
                const pageCartBtn = el('add-to-cart-product-page');
                if (pageCartBtn) {
                    pageCartBtn.dataset.price = data.price;
                    pageCartBtn.dataset.weight = data.weight;
                    pageCartBtn.dataset.image = data.image;
                    pageCartBtn.dataset.name = data.fullName;
                }
            }
        }

        if (target.closest('.logout-btn')) handleLogout();
        if (target.closest('#google-login-btn')) handleSocialLogin('google');
        if (target.closest('#apple-login-btn')) handleSocialLogin('apple');
        if (target.closest('.add-to-cart-btn')) handleAddToCart(e);
        if (target.closest('.favorite-btn')) handleFavoriteToggle(e);

        if (target.closest('.remove-from-cart')) {
            state.cart = state.cart.filter(item => item.id !== target.closest('.remove-from-cart').dataset.id);
            save.cart(); updateCounters(); renderCart();
        }
        if (target.closest('.quantity-change')) {
            const btn = target.closest('.quantity-change');
            const item = state.cart.find(i => i.id === btn.dataset.id);
            if (item) {
                item.quantity += parseInt(btn.dataset.change);
                if (item.quantity < 1) item.quantity = 1;
                save.cart(); updateCounters(); renderCart();
            }
        }
        if (target.closest('#clear-cart-btn') && confirm('Limpar o carrinho?')) {
            showAnimation('clear-cart-animation-overlay', 5800, () => {
                state.cart = []; save.cart(); updateCounters(); renderCart();
            });
        }
        if (target.closest('#clear-favorites-btn') && confirm('Limpar favoritos?')) {
            showAnimation('unfavorite-animation-overlay', 1500, () => {
                state.favorites = []; save.favorites(); updateCounters(); renderFavoritesPage();
            });
        }

        if (target.closest('#checkout-btn')) {
            e.preventDefault();
            if (state.cart.length === 0) {
                alert("Seu carrinho está vazio.");
                return;
            }
            if (!state.shipping.neighborhood) {
                alert("Por favor, selecione uma taxa de entrega antes de prosseguir.");
                const shippingModal = document.getElementById('shipping-modal');
                if (shippingModal) shippingModal.style.display = 'flex';
                return;
            }
            loadPage('checkout');
        }

        if (target.closest('#confirm-purchase-btn')) {
            if (!state.loggedInUser) {
                alert('Você precisa estar logado para finalizar um pedido!');
                loadPage('login');
                return;
            }

            const newOrder = {
                userId: state.loggedInUser.uid,
                userEmail: state.loggedInUser.email,
                userName: state.loggedInUser.displayName || state.loggedInUser.email.split('@')[0],
                orderDate: serverTimestamp(),
                items: [...state.cart],
                shipping: { ...state.shipping },
                total: state.cart.reduce((sum, item) => sum + (item.price * item.quantity), 0) + (state.shipping.fee || 0),
                status: 'Processando',
                estimatedDelivery: ''
            };

            addDoc(collection(db, 'orders'), newOrder)
                .then(docRef => {
                    console.log("Pedido salvo no Firestore com ID: ", docRef.id);
                    state.cart = [];
                    state.shipping = { fee: 0, neighborhood: '' };
                    save.cart();
                    updateCounters();
                    showAnimation('success-animation-overlay', 2000, () => {
                        loadPage('meus-pedidos');
                    });
                })
                .catch(error => {
                    console.error("Erro ao salvar o pedido no Firestore: ", error);
                    alert("Ocorreu um erro ao finalizar seu pedido. Tente novamente.");
                });
        }
    });

    document.body.addEventListener('submit', e => {
        if (e.target.id === 'login-form') handleLogin(e);
        if (e.target.id === 'create-account-form') handleCreateAccount(e);
        if (e.target.id === 'search-form') {
            e.preventDefault();
            const searchInput = document.getElementById('search-input');
            const searchTerm = searchInput.value.trim();
            const searchError = document.getElementById('search-error');
            if (!searchTerm) {
                searchError.classList.remove('hidden');
                searchInput.classList.add('animate-shake');
                setTimeout(() => {
                    searchError.classList.add('hidden');
                    searchInput.classList.remove('animate-shake');
                }, 2000);
            } else {
                loadPage('busca', { query: searchTerm });
                searchInput.value = '';
            }
        }
    });

    document.addEventListener('shippingSelected', (e) => {
        state.shipping = e.detail;
        document.getElementById('shipping-modal').style.display = 'none';
        updateTotals();
    });

    const marrieButton = document.getElementById('marrie-chat-button');
    const marrieWindow = document.getElementById('marrie-chat-window');
    const chatInput = document.getElementById('marrie-chat-input');
    const chatSendButton = document.getElementById('marrie-chat-send');
    const plaqueContainer = document.getElementById('marrie-plaque-container');

    if (plaqueContainer && marrieButton) {
        let plaqueTimer;
        const showPlaque = () => {
            plaqueContainer.classList.add('active');
            plaqueTimer = setTimeout(() => plaqueContainer.classList.remove('active'), 20000);
        };
        setTimeout(showPlaque, 2000);
        const hidePlaque = () => {
            clearTimeout(plaqueTimer);
            plaqueContainer.classList.remove('active');
            marrieButton.removeEventListener('click', hidePlaque);
        };
        marrieButton.addEventListener('click', hidePlaque);
    }

    if (marrieButton && marrieWindow) {
        const toggleChat = () => {
            marrieWindow.classList.toggle('active');
            if (marrieWindow.classList.contains('active')) {
                marrieWindow.classList.remove('hidden');
            } else {
                setTimeout(() => marrieWindow.classList.add('hidden'), 500);
            }
        };
        marrieButton.addEventListener('click', toggleChat);
        document.getElementById('marrie-chat-close')?.addEventListener('click', toggleChat);
    }

    if (chatInput && chatSendButton) {
        chatSendButton.addEventListener('click', handleSendMessage);
        chatInput.addEventListener('keypress', (e) => e.key === 'Enter' && handleSendMessage());
    }

    updateCounters();
    await loadPage('home');
}

// --- PONTO DE ENTRADA DA APLICAÇÃO ---
document.addEventListener('DOMContentLoaded', () => {
    state = {
        cart: JSON.parse(localStorage.getItem('cart')) || [],
        loggedInUser: null,
        favorites: JSON.parse(localStorage.getItem('favorites')) || [],
        appointments: JSON.parse(localStorage.getItem('groomingAppointments')) || [],
        shipping: { fee: 0, neighborhood: '' }
    };
    appRoot = document.getElementById('app-root');
    loadingOverlay = document.getElementById('loading-overlay');

    onAuthStateChanged(auth, async (user) => {
    if (user) {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        const userData = userDoc.exists() ? userDoc.data() : {};
        state.loggedInUser = {
            email: user.email,
            uid: user.uid,
            displayName: user.displayName,
            role: userData.role || 'user'
        };

        // NOVO: Carrega os pedidos do usuário a partir do Firestore
        const ordersSnapshot = await getDocs(query(collection(db, 'orders'), where('userId', '==', user.uid), orderBy('orderDate', 'desc')));
        state.orders = ordersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    } else {
        state.loggedInUser = null;
        state.orders = []; // Limpa os pedidos quando o usuário faz logout
    }
    updateLoginStatus();
    // Se o usuário estiver na página 'meus-pedidos', renderize-a
    const currentPage = window.location.hash.replace('#', '');
    if (currentPage === 'meus-pedidos') {
        renderMyOrdersPage();
    }
  });
});


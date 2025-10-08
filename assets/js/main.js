// --- IMPORTAÇÕES DE MÓDulos ---
// Importações do Firebase SDK v9 (modular)
import { initializeApp } from 'https://www.gstatic.com/firebasejs/9.6.1/firebase-app.js';
import { getAuth, GoogleAuthProvider, OAuthProvider, signInWithPopup, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/9.6.1/firebase-auth.js';
import { getFirestore, collection, getDocs, orderBy, where, doc, getDoc, updateDoc, FieldPath, query, onSnapshot, addDoc, setDoc, serverTimestamp, deleteDoc } from 'https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js';

import { initSlider, initComparisonSlider } from './slider.js';
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

/**
 * Calcula a taxa de entrega com base no nome do bairro.
 * @param {string} neighborhood - O nome do bairro.
 * @returns {number|null} - Retorna o valor da taxa ou null se o bairro não for atendido.
 */
function getShippingFee(neighborhood) {
    const lowerCaseNeighborhood = neighborhood.toLowerCase();
    
    // Mapeamento de bairros e suas taxas
    const feeMap = {
        'valentina de figueiredo': 5.00,
        'parque do sol': 5.00,
        'gramame': 5.00,
        'mangabeira': 10.00,
        'josé américo de almeida': 10.00
    };

    // Procura por correspondências exatas ou parciais
    for (const key in feeMap) {
        if (lowerCaseNeighborhood.includes(key)) {
            return feeMap[key];
        }
    }

    // Se não encontrou nenhuma correspondência, retorna null
    return null;
}

/**
 * Busca o endereço usando a API ViaCEP e atualiza o modal de frete.
 */
async function handleCepSearch() {
    const cepInput = document.getElementById('cep-input');
    const feedbackEl = document.getElementById('cep-feedback');
    const addressContainer = document.getElementById('address-result-container');
    const confirmBtn = document.getElementById('confirm-shipping-btn');
    const unsupportedMsg = document.getElementById('unsupported-area-message');
    const calculatedFeeContainer = document.getElementById('calculated-fee-container');


    if (!cepInput || !feedbackEl || !addressContainer) return;

    let cep = cepInput.value.replace(/\D/g, ''); // Remove tudo que não for número

    if (cep.length !== 8) {
        feedbackEl.innerHTML = `<span class="text-red-500">CEP inválido. Digite 8 números.</span>`;
        return;
    }

    feedbackEl.innerHTML = `<div class="flex items-center gap-2 text-gray-500"><i class="fas fa-spinner fa-spin"></i><span>Buscando endereço...</span></div>`;
    addressContainer.classList.add('hidden');
    unsupportedMsg.classList.add('hidden');

    try {
        const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
        if (!response.ok) throw new Error('Erro na rede.');
        
        const data = await response.json();

        if (data.erro) {
            throw new Error('CEP não encontrado.');
        }

        // Preenche os campos do modal
        document.getElementById('address-street').value = data.logradouro || '';
        document.getElementById('address-neighborhood').value = data.bairro || '';
        // Os campos de cidade e estado não estão no novo modal, mas poderiam ser adicionados se necessário.

        // Calcula a taxa
        const fee = getShippingFee(data.bairro || '');
        
        feedbackEl.innerHTML = ''; // Limpa o feedback

        if (fee !== null) {
            document.getElementById('calculated-fee').textContent = formatCurrency(fee);
            calculatedFeeContainer.classList.remove('hidden');
            unsupportedMsg.classList.add('hidden');
            confirmBtn.disabled = false;
            confirmBtn.classList.remove('bg-gray-400', 'cursor-not-allowed');

        } else {
            // Bairro não atendido
            calculatedFeeContainer.classList.add('hidden');
            unsupportedMsg.classList.remove('hidden');
            confirmBtn.disabled = true;
            confirmBtn.classList.add('bg-gray-400', 'cursor-not-allowed');
        }
        
        addressContainer.classList.remove('hidden');
        document.getElementById('address-number').focus();


    } catch (error) {
        feedbackEl.innerHTML = `<span class="text-red-500">${error.message}</span>`;
    }
}

// ======================================================================
// FIM DAS NOVAS FUNÇÕES
// ======================================================================

// ======================================================================
// NOVO: Função para popular o formulário de checkout
// ======================================================================
function populateCheckoutAddress() {
    // Verifica se há um endereço salvo no estado da aplicação
    if (state.shipping && state.shipping.cep) {
        // Seleciona os campos do formulário de checkout
        const cepField = document.getElementById('cep');
        const addressField = document.getElementById('address');
        const numberField = document.getElementById('number');
        const complementField = document.getElementById('complement');
        const neighborhoodField = document.getElementById('neighborhood');
        const cityField = document.getElementById('city');
        const stateField = document.getElementById('state');

        // Preenche os campos com os valores do estado
        if (cepField) cepField.value = state.shipping.cep;
        if (addressField) addressField.value = state.shipping.street;
        if (numberField) numberField.value = state.shipping.number;
        if (complementField) complementField.value = state.shipping.complement;
        if (neighborhoodField) neighborhoodField.value = state.shipping.neighborhood;
        if (cityField) cityField.value = state.shipping.city;
        if (stateField) stateField.value = state.shipping.state;
    }
}
// ======================================================================
// FIM DA NOVA FUNÇÃO
// ======================================================================

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
    
    // Assegura que os placeholders existem antes de continuar
    if (!desktopPlaceholder || !mobilePlaceholder) return;

    if (state.loggedInUser) {
        // --- Lógica para usuário LOGADO (permanece igual) ---
        const fullName = state.loggedInUser.displayName || state.loggedInUser.email.split('@')[0];
        const firstName = fullName.split(' ')[0];
        const adminLinkHTML = state.loggedInUser.role === 'admin'
            ? `<a href="#" class="user-menu-item nav-link" data-page="admin"><i class="fas fa-user-shield"></i><span>Painel Admin</span></a>`
            : '';

        const userMenuHTML = `
            <div class="relative user-menu-container group">
                <div class="flex items-center justify-between bg-secondary text-white rounded-full px-4 py-2 cursor-pointer">
                    <div class="flex items-center space-x-2">
                        <i class="fas fa-user-check"></i>
                        <span class="font-medium text-sm whitespace-nowrap">Olá, ${firstName}</span>
                        <i class="fas fa-chevron-down text-xs ml-1 transition-transform"></i>
                    </div>
                </div>
                <div class="user-menu-dropdown hidden group-hover:block absolute right-0 mt-2 w-64 bg-white rounded-lg shadow-xl overflow-hidden z-50">
                    ${adminLinkHTML}
                    <a href="#" class="user-menu-item nav-link" data-page="meus-pedidos"><i class="fas fa-box-open"></i><span>Meus Pedidos</span></a>
                    <a href="#" class="user-menu-item nav-link" data-page="acompanhar-entrega"><i class="fas fa-truck"></i><span>Acompanhe sua Entrega</span></a>
                    <a href="#" class="user-menu-item nav-link" data-page="ultimos-vistos"><i class="fas fa-history"></i><span>Últimos Itens Vistos</span></a>
                    <div class="border-t border-gray-100"></div>
                    <button class="logout-btn user-menu-item text-red-500 w-full text-left"><i class="fas fa-sign-out-alt"></i><span>Sair</span></button>
                </div>
            </div>`;
        
        desktopPlaceholder.innerHTML = userMenuHTML;
        mobilePlaceholder.innerHTML = userMenuHTML;

    } else {
        // ==========================================================
        // ✅ LÓGICA CORRIGIDA PARA USUÁRIO DESLOGADO
        // ==========================================================
        
        // Botão para Desktop com texto completo
        const loginDesktopHTML = `
            <a href="#" class="nav-link flex items-center space-x-2 bg-secondary text-white px-4 py-2 rounded-full hover:bg-teal-700" data-page="login">
                <i class="fas fa-user"></i>
                <span class="whitespace-nowrap text-sm">Entre ou Cadastre-se</span>
            </a>`;
        
        // Botão para Mobile com texto abreviado
        const loginMobileHTML = `
            <a href="#" class="nav-link flex items-center space-x-2 bg-secondary text-white px-4 py-2 rounded-full hover:bg-teal-700" data-page="login">
                <i class="fas fa-user"></i>
                <span class="whitespace-nowrap text-sm">Entrar / Cadastrar</span>
            </a>`;

        desktopPlaceholder.innerHTML = loginDesktopHTML;
        mobilePlaceholder.innerHTML = loginMobileHTML;
    }
}

function updateTotals() {
    const subtotal = state.cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const shippingFee = state.shipping.fee || 0;
    
    // --- LÓGICA DO CUPOM ---
    let discountValue = 0;
    if (state.coupon && state.coupon.code) {
        if (state.coupon.type === 'percentage') {
            discountValue = (subtotal * state.coupon.value) / 100;
        } else if (state.coupon.type === 'fixed') {
            discountValue = state.coupon.value;
        }
    }
    // Garante que o desconto não seja maior que o subtotal
    if (discountValue > subtotal) {
        discountValue = subtotal;
    }
    // -------------------------

    const total = (subtotal - discountValue) + shippingFee;

    const updateElementText = (id, text) => { 
        const el = document.getElementById(id); 
        if (el) el.textContent = text; 
    };

    updateElementText('cart-subtotal', formatCurrency(subtotal));
    
    // Atualiza a linha de desconto
    const discountRow = document.getElementById('cart-discount-row');
    if (discountRow) {
        if (discountValue > 0) {
            updateElementText('cart-discount', `- ${formatCurrency(discountValue)}`);
            discountRow.classList.remove('hidden');
        } else {
            discountRow.classList.add('hidden');
        }
    }

    let shippingDisplayText = state.cart.length > 0 ? (state.shipping.cep ? formatCurrency(shippingFee) : 'Selecione') : formatCurrency(0);
    updateElementText('cart-shipping', shippingDisplayText);
    updateElementText('cart-total', formatCurrency(total));
    
    // Atualiza totais do checkout também
    updateElementText('checkout-subtotal', formatCurrency(subtotal));
    updateElementText('checkout-shipping', formatCurrency(shippingFee));
    updateElementText('checkout-total', formatCurrency(total));
    
    // Atualiza a UI do cupom no checkout (se existir)
    const checkoutDiscountRow = document.getElementById('checkout-discount-row');
    if(checkoutDiscountRow) {
        if(discountValue > 0) {
            updateElementText('checkout-discount-value', `- ${formatCurrency(discountValue)}`);
            checkoutDiscountRow.classList.remove('hidden');
        } else {
            checkoutDiscountRow.classList.add('hidden');
        }
    }
}
/**
 * Busca os dados de um pedido e abre o WhatsApp com uma mensagem pré-formatada.
 * @param {string} orderId - O ID do pedido no Firestore.
 */
async function handleSendWhatsAppMessage(orderId) {
    const button = document.querySelector(`.send-whatsapp-btn[data-order-id="${orderId}"]`);
    if (!button) return;

    // Pega a mensagem da caixa de texto
    const messageInput = document.getElementById(`delivery-${orderId}`);
    const message = messageInput.value.trim();

    if (!message) {
        alert('Por favor, escreva uma mensagem de status antes de enviar.');
        messageInput.focus();
        return;
    }

    button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Buscando...';
    button.disabled = true;

    try {
        const orderRef = doc(db, 'orders', orderId);
        const orderSnap = await getDoc(orderRef);

        if (!orderSnap.exists()) {
            throw new Error('Pedido não encontrado no banco de dados.');
        }

        const orderData = orderSnap.data();
        const clientPhone = orderData.userPhone;

        if (!clientPhone) {
            throw new Error('Este cliente não possui um número de telefone cadastrado no pedido.');
        }

        // Formata o telefone: Adiciona o código do Brasil (55) se não tiver.
        // Isso assume que todos os telefones são do Brasil.
        let formattedPhone = clientPhone.startsWith('55') ? clientPhone : `55${clientPhone}`;

        // Codifica a mensagem para ser usada em uma URL
        const encodedMessage = encodeURIComponent(message);

        // Cria o link do WhatsApp
        const whatsappUrl = `https://wa.me/${formattedPhone}?text=${encodedMessage}`;

        // Abre o link em uma nova aba
        window.open(whatsappUrl, '_blank');

    } catch (error) {
        console.error("Erro ao enviar mensagem para o WhatsApp:", error);
        alert(`Não foi possível enviar a mensagem: ${error.message}`);
    } finally {
        // Restaura o botão ao estado original
        button.innerHTML = '<i class="fab fa-whatsapp"></i> Enviar Status';
        button.disabled = false;
    }
}
/**
 * Busca os dados de um agendamento e abre o WhatsApp com uma mensagem pré-formatada.
 * @param {string} appointmentId - O ID do agendamento no Firestore.
 */
async function handleSendGroomingWhatsAppMessage(appointmentId) {
    const button = document.querySelector(`.send-grooming-whatsapp-btn[data-appointment-id="${appointmentId}"]`);
    if (!button) return;

    // Mensagem padrão de confirmação
    const message = `Olá! Gostaríamos de confirmar o seu agendamento de banho e tosa na J.A Pet Clínica. Por favor, responda a esta mensagem para confirmar. Obrigado!`;

    button.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
    button.disabled = true;

    try {
        const appointmentRef = doc(db, 'groomingAppointments', appointmentId);
        const appointmentSnap = await getDoc(appointmentRef);

        if (!appointmentSnap.exists()) {
            throw new Error('Agendamento não encontrado no banco de dados.');
        }

        const appointmentData = appointmentSnap.data();
        const clientPhone = appointmentData.phoneNumber;

        if (!clientPhone) {
            throw new Error('Este cliente não possui um número de telefone cadastrado no agendamento.');
        }

        // Formata o telefone para o padrão da API do WhatsApp
        let formattedPhone = clientPhone.replace(/\D/g, '');
        if (!formattedPhone.startsWith('55')) {
            formattedPhone = `55${formattedPhone}`;
        }

        const encodedMessage = encodeURIComponent(message);
        const whatsappUrl = `https://wa.me/${formattedPhone}?text=${encodedMessage}`;
        window.open(whatsappUrl, '_blank');

    } catch (error) {
        console.error("Erro ao enviar WhatsApp para agendamento:", error);
        alert(`Não foi possível enviar a mensagem: ${error.message}`);
    } finally {
        button.innerHTML = '<i class="fab fa-whatsapp"></i> Contato';
        button.disabled = false;
    }
}
// banco de dados de cupons
async function applyCoupon() {
    const input = document.getElementById('coupon-input');
    const feedbackEl = document.getElementById('coupon-feedback');
    if (!input || !feedbackEl) return;

    const code = input.value.trim().toUpperCase();
    if (!code) return;

    try {
        const couponRef = doc(db, 'coupons', code);
        const couponSnap = await getDoc(couponRef);

        if (couponSnap.exists() && couponSnap.data().active) {
            const coupon = couponSnap.data();
            state.coupon.code = code;
            state.coupon.type = coupon.type;
            state.coupon.value = coupon.value;
            
            feedbackEl.textContent = 'Cupom aplicado com sucesso!';
            feedbackEl.className = 'text-sm h-5 mt-1 text-center success';

            updateCouponUI();
            updateTotals();
        } else {
            throw new Error('Cupom inválido, expirado ou inativo.');
        }
    } catch (error) {
        state.coupon = { code: null, type: null, value: 0 }; // Limpa qualquer cupom antigo
        feedbackEl.textContent = error.message;
        feedbackEl.className = 'text-sm h-5 mt-1 text-center error';
        input.value = '';
        updateTotals(); // Recalcula totais sem o cupom
    }

    setTimeout(() => { feedbackEl.textContent = ''; }, 3000);
}

/**
 * Remove o cupom de desconto aplicado.
 */
function removeCoupon() {
    state.coupon = { code: null, type: null, value: 0 };
    updateCouponUI();
    updateTotals();
}
/**
 * Atualiza a interface do cupom (mostra/esconde campos, etc).
 */
function updateCouponUI() {
    const toggleLink = document.getElementById('coupon-toggle');
    const formContainer = document.getElementById('coupon-form-container');
    const input = document.getElementById('coupon-input');
    const feedbackEl = document.getElementById('coupon-feedback');

    if (!toggleLink || !formContainer || !input || !feedbackEl) return;

    if (state.coupon.code) {
        // Se tem cupom, esconde o formulário e mostra o cupom aplicado
        toggleLink.innerHTML = `Cupom aplicado: <strong class="text-green-600">${state.coupon.code}</strong> <button id="remove-coupon-btn" class="ml-2 text-red-500 hover:underline">(Remover)</button>`;
        formContainer.classList.remove('active');
    } else {
        // Se não tem cupom, mostra o link padrão
        toggleLink.innerHTML = 'Tem um cupom de desconto?';
        input.value = '';
        feedbackEl.textContent = '';
    }
}
function updateAllHeartIcons() {
    document.querySelectorAll('.favorite-btn').forEach(btn => {
        const icon = btn.querySelector('i');
        if (!icon) return;
        const isFav = state.favorites.some(fav => fav.id === btn.dataset.id);
        if (isFav) {
            icon.classList.remove('far', 'text-gray-400');
            icon.classList.add('fas', 'text-red-500');
        } else {
            icon.classList.remove('fas', 'text-red-500');
            icon.classList.add('far', 'text-gray-400');
        }
    });
}
/**
 * ATUALIZA O TEXTO DE PARCELAMENTO COM BASE NO PREÇO DO PRODUTO.
 * @param {HTMLElement} element - O elemento HTML onde o texto será exibido (ex: #product-installments).
 * @param {number} price - O preço do produto para calcular as parcelas.
 */
function renderInstallmentsText(element, price) {
    if (!element) return; // Se o elemento não existir na página, não faz nada.

    const numericPrice = parseFloat(price);

    if (numericPrice >= 100) {
        // Produtos a partir de R$ 100,00: 3x sem juros
        const installmentValue = numericPrice / 3;
        element.innerHTML = `ou em <strong>3x de ${formatCurrency(installmentValue)}</strong> sem juros`;
        element.style.display = 'block'; // Garante que o elemento esteja visível
    } else if (numericPrice >= 60) {
        // Produtos a partir de R$ 60,00: 2x sem juros
        const installmentValue = numericPrice / 2;
        element.innerHTML = `ou em <strong>2x de ${formatCurrency(installmentValue)}</strong> sem juros`;
        element.style.display = 'block'; // Garante que o elemento esteja visível
    } else {
        // Produtos abaixo de R$ 60,00: Esconde o texto de parcelamento
        element.innerHTML = '';
        element.style.display = 'none';
    }
}
async function renderAdminDashboard() {
    console.log("Iniciando renderização do Dashboard Admin...");

    // Seleciona os elementos no HTML que vamos atualizar
    const totalClientsEl = document.getElementById('total-clients-value');
    const pendingOrdersEl = document.getElementById('pending-orders-value');
    const monthlySalesEl = document.getElementById('monthly-sales-value');
    const activeProductsEl = document.getElementById('active-products-value');
    const recentOrdersBodyEl = document.getElementById('recent-orders-body');

    // Verifica se todos os elementos necessários existem na página
    if (!totalClientsEl || !pendingOrdersEl || !monthlySalesEl || !activeProductsEl || !recentOrdersBodyEl) {
        console.error("Um ou mais elementos do dashboard não foram encontrados no HTML.");
        return;
    }

    // Define um estado inicial de carregamento
    const loadingHTML = `<i class="fas fa-spinner fa-spin text-gray-400"></i>`;
    totalClientsEl.innerHTML = loadingHTML;
    pendingOrdersEl.innerHTML = loadingHTML;
    monthlySalesEl.innerHTML = loadingHTML;
    activeProductsEl.innerHTML = loadingHTML;
    recentOrdersBodyEl.innerHTML = `<tr><td colspan="4" class="p-4 text-center text-gray-500">${loadingHTML} Carregando...</td></tr>`;

    try {
        // Busca todos os dados necessários do Firebase em paralelo para maior eficiência
        const [usersSnapshot, productsSnapshot, ordersSnapshot] = await Promise.all([
            getDocs(collection(db, 'users')),
            getDocs(collection(db, 'produtos')),
            getDocs(query(collection(db, 'orders'), orderBy('orderDate', 'desc')))
        ]);

        // --- 1. Calcular Total de Clientes ---
        const totalClients = usersSnapshot.size;
        totalClientsEl.textContent = totalClients;

        // --- 2. Calcular Produtos Ativos ---
        const activeProducts = productsSnapshot.size;
        activeProductsEl.textContent = activeProducts;

        // --- 3. Calcular Pedidos Pendentes e Vendas do Mês ---
        let pendingOrdersCount = 0;
        let monthlySales = 0;
        const now = new Date();
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();

        ordersSnapshot.forEach(doc => {
            const order = doc.data();

            // Contagem de pedidos pendentes (Processando ou Enviado)
            if (order.status === 'Processando' || order.status === 'Enviado') {
                pendingOrdersCount++;
            }

            // Soma das vendas do mês atual
            if (order.orderDate && order.status !== 'Cancelado') {
                const orderDate = order.orderDate.toDate();
                if (orderDate.getMonth() === currentMonth && orderDate.getFullYear() === currentYear) {
                    monthlySales += order.total || 0;
                }
            }
        });

        pendingOrdersEl.textContent = pendingOrdersCount;
        monthlySalesEl.textContent = formatCurrency(monthlySales);

        // --- 4. Renderizar Pedidos Recentes (os 5 primeiros) ---
        const recentOrders = ordersSnapshot.docs.slice(0, 5);
        
        const getStatusBadgeHTML = (status) => {
             switch (status.toLowerCase()) {
                case 'processando':
                    return `<span class="px-3 py-1 text-xs font-medium rounded-full bg-yellow-100 text-yellow-800">Processando</span>`;
                case 'enviado':
                    return `<span class="px-3 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800">Enviado</span>`;
                case 'entregue':
                    return `<span class="px-3 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800">Entregue</span>`;
                case 'cancelado':
                    return `<span class="px-3 py-1 text-xs font-medium rounded-full bg-red-100 text-red-800">Cancelado</span>`;
                default:
                    return `<span class="px-3 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-800">${status}</span>`;
            }
        };

        if (recentOrders.length === 0) {
            recentOrdersBodyEl.innerHTML = `<tr><td colspan="4" class="p-4 text-center text-gray-500">Nenhum pedido encontrado.</td></tr>`;
        } else {
            const recentOrdersHTML = recentOrders.map(doc => {
                const order = doc.data();
                const orderId = `#JPET-${doc.id.substring(0, 6).toUpperCase()}`;
                const clientName = order.userName || 'Cliente Anônimo';
                const total = formatCurrency(order.total || 0);
                const statusBadge = getStatusBadgeHTML(order.status);
                
                return `
                    <tr class="border-b hover:bg-gray-50">
                        <td class="p-3 text-gray-700 font-mono">${orderId}</td>
                        <td class="p-3 text-gray-700">${clientName}</td>
                        <td class="p-3 text-gray-700 font-medium">${total}</td>
                        <td class="p-3">${statusBadge}</td>
                    </tr>
                `;
            }).join('');
            recentOrdersBodyEl.innerHTML = recentOrdersHTML;
        }

    } catch (error) {
        console.error("Erro ao carregar dados do dashboard:", error);
        // Exibe uma mensagem de erro em todos os campos
        const errorMsg = `<span class="text-xs text-red-500">Erro!</span>`;
        totalClientsEl.innerHTML = errorMsg;
        pendingOrdersEl.innerHTML = errorMsg;
        monthlySalesEl.innerHTML = errorMsg;
        activeProductsEl.innerHTML = errorMsg;
        recentOrdersBodyEl.innerHTML = `<tr><td colspan="4" class="p-4 text-center text-red-500">Falha ao carregar os pedidos.</td></tr>`;
    }
}

// --- FUNÇÕES DE RENDERIZAÇÃO DE COMPONENTES E PÁGINAS ---
async function renderDetailedOrderView(orderId) {
    const adminContent = document.getElementById('admin-content');
    if (!adminContent) return;

    // Mostra um feedback de carregamento
    const loadingModal = `
        <div id="order-details-modal" class="admin-modal-overlay">
            <div class="admin-modal-content">
                <p>Carregando detalhes do pedido...</p>
            </div>
        </div>`;
    document.body.insertAdjacentHTML('beforeend', loadingModal);

    try {
        const orderSnap = await getDoc(doc(db, 'orders', orderId));
        if (!orderSnap.exists()) {
            alert("Erro: Pedido não encontrado.");
            document.getElementById('order-details-modal')?.remove();
            return;
        }

        const order = orderSnap.data();

        // Gera o HTML para a lista de itens do pedido
        const itemsHTML = order.items.map(item => `
            <div class="flex items-center justify-between py-2 border-b last:border-b-0">
                <div class="flex items-center gap-3">
                    <img src="${item.image}" alt="${item.name}" class="w-12 h-12 object-contain rounded border p-1">
                    <div>
                        <p class="font-semibold text-gray-800">${item.name}</p>
                        <p class="text-sm text-gray-500">Qtd: ${item.quantity} | Unit: ${formatCurrency(item.price)}</p>
                    </div>
                </div>
                <p class="font-bold text-gray-800">${formatCurrency(item.quantity * item.price)}</p>
            </div>
        `).join('');

        // ✅ LÓGICA DO GOOGLE MAPS (MELHORADA)
        // Cria o endereço completo e filtra partes vazias
        const addressParts = [
            order.shipping.address?.street,
            order.shipping.address?.number,
            order.shipping.address?.neighborhood,
            order.shipping.address?.city,
            order.shipping.address?.state,
        ].filter(part => part); // Filtra valores como null, undefined ou string vazia
        
        const fullAddress = addressParts.join(', ');
        
        // Gera o HTML do link somente se existir um endereço válido
        const googleMapsLinkHTML = fullAddress 
            ? `<a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fullAddress)}" target="_blank" class="btn-google-maps mt-2 inline-flex items-center gap-2 text-sm font-medium">
                   <i class="fas fa-map-marker-alt"></i> Ver no Google Maps
               </a>` 
            : '';

        // Monta o HTML completo do modal
        const modalHTML = `
            <div id="order-details-modal" class="admin-modal-overlay">
                <div class="admin-modal-content">
                    <button id="modal-close-btn" class="modal-close-button">×</button>
                    <h3 class="text-xl font-bold text-gray-800 mb-4 border-b pb-2">
                        Detalhes do Pedido <span class="text-primary font-mono">#${orderId.substring(0, 6).toUpperCase()}</span>
                    </h3>

                    <div class="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
                        
                        <div class="space-y-4">
                            <div>
                                <h4 class="font-bold text-gray-600 mb-1">CLIENTE</h4>
                                <p>${order.userName || 'Nome não informado'}</p>
                                <p class="text-gray-500">${order.userEmail || 'Email não informado'}</p>
                            </div>
                            <div>
                                <h4 class="font-bold text-gray-600 mb-1">ENDEREÇO DE ENTREGA</h4>
                                <p>${order.shipping.address?.street || 'Rua não informada'}, ${order.shipping.address?.number || 'S/N'}</p>
                                <p>${order.shipping.address?.neighborhood || order.shipping.neighborhood || 'Bairro não informado'}</p>
                                <p>${order.shipping.address?.city || 'Cidade não informada'} - ${order.shipping.address?.state || 'Estado não informado'}</p>
                                <p class="text-gray-500">CEP: ${order.shipping.address?.cep || 'CEP não informado'}</p>
                                
                                ${googleMapsLinkHTML}
                                
                            </div> </div> <div class="space-y-4">
                            <div>
                                <h4 class="font-bold text-gray-600 mb-1">RESUMO FINANCEIRO</h4>
                                <div class="flex justify-between border-b py-1"><span>Subtotal</span> <span>${formatCurrency(order.total - order.shipping.fee)}</span></div>
                                <div class="flex justify-between border-b py-1"><span>Frete</span> <span>${formatCurrency(order.shipping.fee)}</span></div>
                                <div class="flex justify-between font-bold text-lg pt-1"><span>TOTAL</span> <span>${formatCurrency(order.total)}</span></div>
                            </div>
                            <div>
                                <h4 class="font-bold text-gray-600 mb-1">FORMA DE PAGAMENTO</h4>
                                <p class="font-semibold text-secondary">${order.paymentMethod || 'Não especificada'}</p>
                            </div>
                        </div> </div> <div class="mt-6">
                        <h4 class="font-bold text-gray-600 mb-2">ITENS DO PEDIDO</h4>
                        <div class="space-y-2">${itemsHTML}</div>
                    </div>
                </div>
            </div>
        `;
        
        // Remove o modal de loading e insere o modal com os detalhes
        document.getElementById('order-details-modal')?.remove();
        document.body.insertAdjacentHTML('beforeend', modalHTML);

        // Adiciona os listeners para fechar o modal
        const modal = document.getElementById('order-details-modal');
        document.getElementById('modal-close-btn').addEventListener('click', () => modal.remove());
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.remove();
            }
        });

    } catch (error) {
        console.error("Erro ao buscar detalhes do pedido:", error);
        alert("Não foi possível carregar os detalhes do pedido.");
        document.getElementById('order-details-modal')?.remove();
    }
}
async function renderAdminGroomingView() {
    const adminContent = document.getElementById('admin-content');
    if (!adminContent) return;

    // HTML base da nova página
    adminContent.innerHTML = `
        <header class="admin-header">
            <h1>Gerenciamento de Banho e Tosa</h1>
            <p>Visualize, contate o cliente ou exclua os agendamentos.</p>
        </header>
        <div id="admin-grooming-list" class="space-y-4">
            <p class="p-6 text-center text-gray-500">Carregando agendamentos...</p>
        </div>
    `;

    const groomingListEl = document.getElementById('admin-grooming-list');

    // Função interna para montar a lista de agendamentos
    const renderList = (docs) => {
        if (docs.length === 0) {
            groomingListEl.innerHTML = '<div class="admin-card text-center p-8 text-gray-500">Nenhum agendamento pendente encontrado.</div>';
            return;
        }

        groomingListEl.innerHTML = docs.map(doc => {
            const appointment = doc.data();
            const appointmentId = doc.id;
            
            const period = parseInt(appointment.time.split(':')[0]) < 12 ? 'Manhã' : 'Tarde';
            const periodIcon = period === 'Manhã' ? 'fa-sun text-yellow-500' : 'fa-moon text-indigo-500';

            return `
            <div class="admin-card order-card" data-appointment-id="${appointmentId}">
                <div class="card-header">
                    <div>
                        <p class="font-bold text-gray-800 text-lg">${appointment.petName} <span class="font-normal text-base">(Tutor: ${appointment.tutorName})</span></p>
                        <p class="text-sm text-gray-500">Contato: ${appointment.phoneNumber || 'Não informado'}</p>
                    </div>
                    <div class="text-right">
                        <p class="font-semibold text-secondary text-lg">${appointment.day} às ${appointment.time}</p>
                        <p class="text-sm text-gray-500 mt-1"><i class="fas ${periodIcon} mr-1"></i>Período da ${period}</p>
                    </div>
                </div>
                <div class="card-footer">
                    <button class="admin-btn btn-danger delete-grooming-btn" data-appointment-id="${appointmentId}"><i class="fas fa-trash-alt"></i> Excluir</button>
                    <button class="admin-btn btn-whatsapp send-grooming-whatsapp-btn" data-appointment-id="${appointmentId}"><i class="fab fa-whatsapp"></i> Contato</button>
                </div>
            </div>
            `;
        }).join('');
    };

    // ✅ ALTERAÇÃO 1: Adicionado "where('status', '!=', 'Concluído')" para buscar apenas agendamentos pendentes.
    const q = query(collection(db, 'groomingAppointments'), where('status', '!=', 'Concluído'), orderBy('status'), orderBy('day', 'asc'), orderBy('time', 'asc'));

    onSnapshot(q, (snapshot) => {
        renderList(snapshot.docs);
    });

    // Adiciona os eventos para os botões de "Excluir" e "Contato"
    groomingListEl.addEventListener('click', async (e) => {
        const deleteBtn = e.target.closest('.delete-grooming-btn');
        if (deleteBtn) {
            const appointmentId = deleteBtn.dataset.appointmentId;
            // ✅ ALTERAÇÃO 2: Em vez de confirm(), chamamos a função que abre o novo modal.
            openGroomingActionModal(appointmentId); 
        }

        const whatsappBtn = e.target.closest('.send-grooming-whatsapp-btn');
        if (whatsappBtn) {
            const appointmentId = whatsappBtn.dataset.appointmentId;
            handleSendGroomingWhatsAppMessage(appointmentId);
        }
    });
}
async function openGroomingActionModal(appointmentId) {
    // Cria o HTML do modal dinamicamente
    const modalHTML = `
        <div id="grooming-action-modal" class="action-modal-overlay">
            <div class="action-modal-content">
                <button class="action-modal-close">×</button>
                <h3 class="text-2xl font-bold text-gray-800">Gerenciar Agendamento</h3>
                
                <div class="action-modal-split">
                    <div class="modal-column">
                        <h4><i class="fas fa-calendar-times text-red-500 mr-2"></i>Cancelar Agendamento</h4>
                        <p>Esta opção irá notificar o cliente sobre o cancelamento e remover o horário da agenda.</p>
                        <textarea id="cancel-reason-input" placeholder="Escreva o motivo do cancelamento aqui (ex: imprevisto, feriado, etc.). Esta mensagem será enviada ao cliente."></textarea>
                        <button id="confirm-cancel-btn" class="admin-btn btn-danger">Notificar Cliente e Cancelar</button>
                    </div>
                    
                    <div class="modal-column">
                        <h4><i class="fas fa-check-circle text-green-500 mr-2"></i>Concluir Serviço</h4>
                        <p>Use esta opção quando o serviço já foi realizado. Isso removerá o agendamento da lista de pendentes.</p>
                        <button id="confirm-conclude-btn" class="admin-btn btn-primary">Marcar como Concluído</button>
                    </div>
                </div>
            </div>
        </div>
    `;

    // Adiciona o modal ao corpo da página
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    const modal = document.getElementById('grooming-action-modal');

    // Adiciona um pequeno delay para a animação de entrada funcionar
    setTimeout(() => modal.classList.add('active'), 10);

    const closeModal = () => {
        modal.classList.remove('active');
        setTimeout(() => modal.remove(), 300); // Remove da DOM após a animação
    };

    // Lógica dos botões
    modal.querySelector('.action-modal-close').addEventListener('click', closeModal);

    // Botão de MARCAR COMO CONCLUÍDO
    modal.querySelector('#confirm-conclude-btn').addEventListener('click', async () => {
        if (confirm('Tem certeza que deseja marcar este serviço como concluído?')) {
            try {
                const appointmentRef = doc(db, 'groomingAppointments', appointmentId);
                await updateDoc(appointmentRef, { status: 'Concluído' });
                closeModal();
            } catch (error) {
                console.error("Erro ao concluir agendamento:", error);
                alert('Não foi possível marcar como concluído. Tente novamente.');
            }
        }
    });

    // Botão de CONFIRMAR CANCELAMENTO
    modal.querySelector('#confirm-cancel-btn').addEventListener('click', async () => {
        const reason = modal.querySelector('#cancel-reason-input').value.trim();
        if (!reason) {
            alert('Por favor, escreva o motivo do cancelamento antes de continuar.');
            return;
        }

        if (confirm('Tem certeza que deseja cancelar este agendamento e notificar o cliente?')) {
            try {
                // 1. Pega os dados do agendamento para obter o telefone
                const appointmentRef = doc(db, 'groomingAppointments', appointmentId);
                const appointmentSnap = await getDoc(appointmentRef);
                
                if (!appointmentSnap.exists()) throw new Error('Agendamento não encontrado.');

                const appointmentData = appointmentSnap.data();
                const clientPhone = appointmentData.phoneNumber.replace(/\D/g, '');

                // 2. Monta a mensagem para o WhatsApp
                const message = `Olá! Gostaríamos de informar que seu agendamento de banho e tosa na J.A Pet Clínica para o dia ${appointmentData.day} às ${appointmentData.time} precisou ser cancelado. Motivo: "${reason}". Pedimos desculpas pelo transtorno.`;
                let formattedPhone = clientPhone.startsWith('55') ? clientPhone : `55${clientPhone}`;
                const whatsappUrl = `https://wa.me/${formattedPhone}?text=${encodeURIComponent(message)}`;
                
                // 3. Abre o WhatsApp
                window.open(whatsappUrl, '_blank');

                // 4. Exclui o agendamento do banco de dados
                await deleteDoc(appointmentRef);
                
                closeModal();

            } catch (error) {
                console.error("Erro ao cancelar agendamento:", error);
                alert('Não foi possível cancelar o agendamento. Tente novamente.');
            }
        }
    });
}
async function renderAdminSettingsView() {
    const adminContent = document.getElementById('admin-content');
    if (!adminContent) return;

    // HTML da página de configurações
    adminContent.innerHTML = `
        <header class="admin-header">
            <h1>Configurações Gerais</h1>
            <p>Controle configurações importantes do seu site.</p>
        </header>

        <div class="admin-card p-6">
            <h2 class="text-xl font-bold text-gray-800 mb-2">Modo Manutenção</h2>
            <p class="text-gray-600 mb-6">
                Ao ativar, apenas administradores logados poderão acessar o site. 
                Visitantes e clientes comuns verão uma página de manutenção.
            </p>
            
            <div class="flex items-center justify-between bg-gray-100 p-4 rounded-lg">
                <span id="maintenance-status-text" class="font-semibold text-gray-700">Verificando status...</span>
                <button id="toggle-maintenance-btn" class="admin-btn" disabled>
                    Aguarde
                </button>
            </div>
        </div>
    `;

    const toggleBtn = document.getElementById('toggle-maintenance-btn');
    const statusText = document.getElementById('maintenance-status-text');
    
    // Caminho para o documento de configurações no Firestore
    const settingsRef = doc(db, 'settings', 'siteStatus');

    // Função para atualizar a aparência do botão
    const updateUI = (isMaintenanceMode) => {
        if (isMaintenanceMode) {
            statusText.textContent = "O modo manutenção está ATIVADO.";
            toggleBtn.innerHTML = '<i class="fas fa-power-off mr-2"></i> Desativar Modo Manutenção';
            toggleBtn.classList.remove('btn-primary');
            toggleBtn.classList.add('btn-danger');
        } else {
            statusText.textContent = "O modo manutenção está DESATIVADO.";
            toggleBtn.innerHTML = '<i class="fas fa-power-off mr-2"></i> Ativar Modo Manutenção';
            toggleBtn.classList.remove('btn-danger');
            toggleBtn.classList.add('btn-primary');
        }
        toggleBtn.disabled = false;
    };

    // Ouve por mudanças em tempo real no documento
    onSnapshot(settingsRef, (docSnap) => {
        if (docSnap.exists()) {
            const isMaintenanceMode = docSnap.data().isMaintenance;
            updateUI(isMaintenanceMode);
        } else {
            // Se o documento não existe, considera que a manutenção está desligada
            updateUI(false);
        }
    });

    // Evento de clique para ligar/desligar
    toggleBtn.addEventListener('click', async () => {
        toggleBtn.disabled = true;
        toggleBtn.textContent = 'Alterando...';
        
        try {
            const docSnap = await getDoc(settingsRef);
            const newStatus = !docSnap.exists() || !docSnap.data().isMaintenance;
            // setDoc com { merge: true } cria o documento se não existir, ou atualiza se já existir.
            await setDoc(settingsRef, { isMaintenance: newStatus }, { merge: true });
            // A UI será atualizada automaticamente pelo onSnapshot
        } catch (error) {
            console.error("Erro ao alterar o modo de manutenção:", error);
            alert('Falha ao alterar o status. Tente novamente.');
            // Reabilita o botão em caso de erro
            const docSnap = await getDoc(settingsRef);
            updateUI(docSnap.exists() && docSnap.data().isMaintenance);
        }
    });
}
async function renderAdminCouponsView() {
    const adminContent = document.getElementById('admin-content');
    if (!adminContent) return;

    adminContent.innerHTML = `
        <header class="admin-header">
            <h1>Gerenciamento de Cupons</h1>
            <p>Crie, edite, ative ou desative os cupons de desconto da sua loja.</p>
        </header>
        
        <div class="admin-card p-6 mb-8">
            <h2 class="text-xl font-bold text-gray-800 mb-4">Criar Novo Cupom</h2>
            <form id="create-coupon-form" class="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                <div>
                    <label for="coupon-code" class="admin-form-label">Código do Cupom</label>
                    <input type="text" id="coupon-code" placeholder="EX: 15OFF" class="admin-form-input uppercase" required>
                </div>
                <div>
                    <label for="coupon-type" class="admin-form-label">Tipo de Desconto</label>
                    <select id="coupon-type" class="admin-form-select" required>
                        <option value="percentage">Porcentagem (%)</option>
                        <option value="fixed">Valor Fixo (R$)</option>
                    </select>
                </div>
                <div>
                    <label for="coupon-value" class="admin-form-label">Valor</label>
                    <input type="number" id="coupon-value" step="0.01" placeholder="Ex: 15 ou 10.50" class="admin-form-input" required>
                </div>
                <button type="submit" class="admin-btn btn-primary h-11">
                    <i class="fas fa-plus mr-2"></i> Criar Cupom
                </button>
            </form>
        </div>

        <div class="admin-card">
             <div id="admin-coupons-list">
                <p class="p-6 text-center">Carregando cupons...</p>
            </div>
        </div>
    `;

    const couponsListEl = document.getElementById('admin-coupons-list');
    const createCouponForm = document.getElementById('create-coupon-form');

    // Função para renderizar a lista de cupons
    const renderList = (docs) => {
        if (docs.length === 0) {
            couponsListEl.innerHTML = '<p class="p-6 text-center text-gray-500">Nenhum cupom encontrado.</p>';
            return;
        }

        couponsListEl.innerHTML = docs.map(doc => {
            const coupon = doc.data();
            const couponId = doc.id;
            const isActive = coupon.active;
            const valueDisplay = coupon.type === 'percentage'
                ? `${coupon.value}%`
                : formatCurrency(coupon.value);
            
            return `
            <div class="coupon-list-item border-b last:border-b-0">
                <div>
                    <span class="coupon-code">${couponId}</span>
                </div>
                <div class="coupon-details">
                    ${coupon.type === 'percentage' ? 'Porcentagem' : 'Valor Fixo'} de ${valueDisplay}
                </div>
                <div>
                    <span class="coupon-status-badge ${isActive ? 'status-active' : 'status-inactive'}">
                        ${isActive ? 'Ativo' : 'Inativo'}
                    </span>
                </div>
                <div class="coupon-actions">
                    <button class="admin-btn toggle-status-btn" data-id="${couponId}" data-active="${isActive}">
                        <i class="fas fa-power-off"></i>
                    </button>
                    <button class="admin-btn btn-danger delete-coupon-btn" data-id="${couponId}">
                        <i class="fas fa-trash-alt"></i>
                    </button>
                </div>
            </div>
            `;
        }).join('');
    };
    
    // Escuta por mudanças em tempo real na coleção de cupons
    onSnapshot(query(collection(db, 'coupons')), (snapshot) => {
        renderList(snapshot.docs);
    });

    // Event listener para CRIAR um novo cupom
    createCouponForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const codeInput = document.getElementById('coupon-code');
        const typeInput = document.getElementById('coupon-type');
        const valueInput = document.getElementById('coupon-value');

        const code = codeInput.value.trim().toUpperCase();
        if (!code) {
            alert('O código do cupom não pode estar em branco.');
            return;
        }

        const newCouponData = {
            type: typeInput.value,
            value: parseFloat(valueInput.value),
            active: true // Novos cupons são criados como ativos por padrão
        };
        
        try {
            await setDoc(doc(db, 'coupons', code), newCouponData);
            createCouponForm.reset();
            codeInput.focus();
        } catch (error) {
            console.error("Erro ao criar cupom: ", error);
            alert('Não foi possível criar o cupom. Verifique o console para mais detalhes.');
        }
    });

    // Event listeners para AÇÕES (Ativar/Desativar e Excluir)
    couponsListEl.addEventListener('click', async (e) => {
        const toggleBtn = e.target.closest('.toggle-status-btn');
        const deleteBtn = e.target.closest('.delete-coupon-btn');

        // Lógica para ATIVAR/DESATIVAR
        if (toggleBtn) {
            const couponId = toggleBtn.dataset.id;
            const currentStatus = toggleBtn.dataset.active === 'true';
            try {
                await updateDoc(doc(db, 'coupons', couponId), { active: !currentStatus });
            } catch (error) {
                console.error("Erro ao alterar status do cupom:", error);
                alert('Falha ao alterar o status.');
            }
        }
        
        // Lógica para EXCLUIR
        if (deleteBtn) {
            const couponId = deleteBtn.dataset.id;
            if (confirm(`Tem certeza que deseja excluir o cupom "${couponId}"? Esta ação não pode ser desfeita.`)) {
                try {
                    await deleteDoc(doc(db, 'coupons', couponId));
                } catch (error) {
                    console.error("Erro ao excluir cupom:", error);
                    alert('Falha ao excluir o cupom.');
                }
            }
        }
    });
}
async function renderAdminOrdersView() {
    const adminContent = document.getElementById('admin-content');
    if (!adminContent) return;

    adminContent.innerHTML = `
        <header class="admin-header">
            <h1>Gerenciamento de Pedidos e Entregas</h1>
            <p>Visualize e atualize o status de todos os pedidos do site.</p>
        </header>
        <div id="admin-orders-list" class="space-y-4">
             <p>Carregando pedidos...</p>
        </div>
    `;

    const ordersListEl = document.getElementById('admin-orders-list');
    if (!ordersListEl) return;
    
    const getStatusClass = (status) => {
        switch (status.toLowerCase()) {
            case 'processando': return 'status-processando';
            case 'enviado': return 'status-enviado';
            case 'entregue': return 'status-entregue';
            case 'cancelado': return 'status-cancelado';
            default: return 'status-cancelado';
        }
    };

    const renderList = (docs) => {
        if (docs.length === 0) {
            ordersListEl.innerHTML = '<p>Nenhum pedido encontrado.</p>';
            return;
        }
        ordersListEl.innerHTML = docs.map(doc => {
            const order = doc.data();
            const orderId = doc.id;
            const orderDate = order.orderDate ? order.orderDate.toDate().toLocaleDateString('pt-BR') : 'Data inválida';
            const statusOptions = ['Processando', 'Enviado', 'Entregue', 'Cancelado']
                .map(s => `<option value="${s}" ${order.status === s ? 'selected' : ''}>${s}</option>`)
                .join('');

            return `
            <div class="admin-card order-card" data-order-id="${orderId}">
               <div class="card-header order-details-trigger cursor-pointer">
                    <div>
                        <p class="font-bold text-primary">Pedido #${orderId.substring(0, 6).toUpperCase()}</p>
                        <p class="text-sm text-gray-500">Cliente: ${order.userName} (${order.userEmail})</p>
                    </div>
                    <div class="text-right">
                        <span class="status-badge ${getStatusClass(order.status)}">${order.status}</span>
                        <p class="text-sm text-gray-500 mt-1">Data: ${orderDate}</p>
                    </div>
               </div>
               <div class="card-body grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label class="admin-form-label" for="status-${orderId}">Alterar Status</label>
                        <select id="status-${orderId}" class="admin-form-select">
                            ${statusOptions}
                        </select>
                    </div>
                    <div>
                        <label class="admin-form-label" for="delivery-${orderId}">Mensagem de Status</label>
                        <input type="text" id="delivery-${orderId}" value="${order.estimatedDelivery || ''}" placeholder="Ex: Saiu para entrega" class="admin-form-input">
                    </div>
               </div>
               <div class="card-footer">
                   <button class="admin-btn btn-danger delete-order-btn" data-order-id="${orderId}"><i class="fas fa-trash-alt"></i></button>
                   
                   <button class="admin-btn btn-whatsapp send-whatsapp-btn" data-order-id="${orderId}">
                       <i class="fab fa-whatsapp"></i> Enviar Status
                   </button>

                   <button class="admin-btn btn-primary update-order-btn" data-order-id="${orderId}"><i class="fas fa-save"></i> Salvar</button>
               </div>
            </div>
            `;
        }).join('');
    };

    try {
        onSnapshot(query(collection(db, 'orders'), orderBy('orderDate', 'desc')), (snapshot) => {
            console.log("Recebida atualização em tempo real dos pedidos.");
            renderList(snapshot.docs);
        });
    } catch (error) {
        console.error("Erro ao buscar pedidos:", error);
        ordersListEl.innerHTML = '<p class="text-red-500">Ocorreu um erro ao carregar os pedidos.</p>';
    }

   ordersListEl.addEventListener('click', async (e) => {
    const clickedCard = e.target.closest('.order-card');
    if (!clickedCard) return;
    const orderId = clickedCard.dataset.orderId;

    if (e.target.closest('.update-order-btn')) {
        const button = e.target.closest('.update-order-btn');
        const newStatus = document.getElementById(`status-${orderId}`).value;
        const newDeliveryEstimate = document.getElementById(`delivery-${orderId}`).value;
        button.innerHTML = 'Salvando...';
        button.disabled = true;
        try {
            await updateDoc(doc(db, 'orders', orderId), { status: newStatus, estimatedDelivery: newDeliveryEstimate });
            button.innerHTML = '<i class="fas fa-check"></i> Salvo!';
            setTimeout(() => {
                button.innerHTML = '<i class="fas fa-save"></i> Salvar';
                button.disabled = false;
            }, 2000);
        } catch (error) {
            alert('Erro ao salvar.');
            button.innerHTML = '<i class="fas fa-save"></i> Salvar';
            button.disabled = false;
        }
        return;
    }

    // ✅ NOVO EVENTO PARA O BOTÃO DO WHATSAPP
    if (e.target.closest('.send-whatsapp-btn')) {
        handleSendWhatsAppMessage(orderId);
        return;
    }

    if (e.target.closest('.delete-order-btn')) {
        if (confirm('Tem certeza que deseja excluir este pedido?')) {
            try {
                await deleteDoc(doc(db, 'orders', orderId));
            } catch (error) {
                alert('Erro ao excluir o pedido.');
            }
        }
        return;
    }

    if (e.target.closest('.order-details-trigger')) {
        renderDetailedOrderView(orderId);
    }
  });
}
async function renderAdminClientsView() {
    const adminContent = document.getElementById('admin-content');
    if (!adminContent) return;

    adminContent.innerHTML = `
        <header class="admin-header">
            <h1>Gerenciamento de Clientes</h1>
            <p>Visualize e pesquise todos os clientes cadastrados na plataforma.</p>
        </header>
        <div class="mb-6 relative">
             <i class="fas fa-search text-gray-400 absolute left-4 top-1/2 -translate-y-1/2"></i>
            <input type="search" id="client-search-input" placeholder="Pesquisar por nome ou e-mail..." class="admin-form-input pl-10">
        </div>
        <div id="admin-clients-list" class="space-y-3">
            <p>Carregando clientes...</p>
        </div>
    `;

    const clientsListEl = document.getElementById('admin-clients-list');
    const searchInput = document.getElementById('client-search-input');
    if (!clientsListEl || !searchInput) return;

    let allClients = [];

    const displayClients = (clients) => {
        if (clients.length === 0) {
            clientsListEl.innerHTML = '<p>Nenhum cliente encontrado.</p>';
            return;
        }
        clientsListEl.innerHTML = clients.map(client => {
            const joinDate = client.createdAt ? client.createdAt.toDate().toLocaleDateString('pt-BR') : 'Data Indisponível';
            const clientInitial = client.name ? client.name[0].toUpperCase() : '?';
            return `
                <div class="admin-card client-card">
                    <div class="client-avatar">${clientInitial}</div>
                    <div class="client-info">
                        <div class="name">${client.name || 'Nome não cadastrado'}</div>
                        <div class="email">${client.email || 'E-mail não cadastrado'}</div>
                    </div>
                    <div class="join-date">Membro desde: ${joinDate}</div>
                </div>
            `;
        }).join('');
    };

    try {
        const querySnapshot = await getDocs(query(collection(db, 'users'), orderBy('createdAt', 'desc')));
        allClients = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        displayClients(allClients);

        searchInput.addEventListener('input', (e) => {
            const searchTerm = e.target.value.trim().toLowerCase();
            const filteredClients = allClients.filter(client =>
                (client.name && client.name.toLowerCase().includes(searchTerm)) ||
                (client.email && client.email.toLowerCase().includes(searchTerm))
            );
            displayClients(filteredClients);
        });
    } catch (error) {
        console.error("Erro ao buscar clientes:", error);
        clientsListEl.innerHTML = '<p class="text-red-500">Ocorreu um erro ao carregar os clientes.</p>';
    }
}

async function renderAdminProductsView() {
    const adminContent = document.getElementById('admin-content');
    if (!adminContent) return;

    adminContent.innerHTML = `
        <header class="admin-header">
            <h1>Gerenciamento de Produtos e Custos</h1>
            <p>Pesquise por um produto ou clique nele para editar suas informações.</p>
        </header>
        <div class="mb-6 relative">
            <i class="fas fa-search text-gray-400 absolute left-4 top-1/2 -translate-y-1/2"></i>
            <input type="search" id="admin-product-search-input" placeholder="Pesquisar por nome ou categoria..." class="admin-form-input pl-10">
        </div>
        <div id="admin-products-list" class="space-y-2">
            <p>Carregando produtos...</p>
        </div>
    `;

    const productsListEl = document.getElementById('admin-products-list');
    const searchInput = document.getElementById('admin-product-search-input');
    if (!productsListEl || !searchInput) return;

    let allProducts = [];

    const displayProducts = (productsToDisplay) => {
        if (productsToDisplay.length === 0) {
            productsListEl.innerHTML = '<p>Nenhum produto encontrado.</p>';
            return;
        }

        productsToDisplay.sort((a, b) => (a.data.nome || '').localeCompare(b.data.nome || ''));
        
        productsListEl.innerHTML = productsToDisplay.map(productData => {
            const product = productData.data;
            const defaultVariation = product.variations && product.variations.length > 0 ? product.variations[0] : { price: 0 };
           let displayName = product.nome;
			if (!displayName && product.variations && product.variations.length > 0 && product.variations[0].fullName) {
			    displayName = product.variations[0].fullName;
			}
			displayName = displayName || `[Produto sem nome - ID: ${productData.id}]`;
            const imageUrl = defaultVariation.image || product.image || 'https://via.placeholder.com/60';

            return `
                <div class="admin-card product-list-item" data-product-id="${productData.id}">
                    <div class="product-list-item-thumbnail">
                        <img src="${imageUrl}" alt="${displayName}">
                    </div>
                    <div class="product-info">
                        <div class="name">${displayName}</div>
                        <div class="category">Categoria: ${product.category || 'Não definida'}</div>
                    </div>
                    <div class="price-info">
                        <div class="label">Preço base</div>
                        <div class="price">${formatCurrency(defaultVariation.price)}</div>
                    </div>
                </div>
            `;
        }).join('');
    };

    try {
        const querySnapshot = await getDocs(query(collection(db, 'produtos')));
        allProducts = querySnapshot.docs.map(doc => ({ id: doc.id, data: doc.data() }));
        displayProducts(allProducts);

        searchInput.addEventListener('input', (e) => {
            const searchTerm = e.target.value.trim().toLowerCase();
            const filteredProducts = allProducts.filter(p => 
                (p.data.nome && p.data.nome.toLowerCase().includes(searchTerm)) ||
                (p.data.category && p.data.category.toLowerCase().includes(searchTerm))
            );
            displayProducts(filteredProducts);
        });
    } catch (error) {
        console.error("Erro ao buscar produtos para o painel admin:", error);
        productsListEl.innerHTML = `<p class="text-red-500">Ocorreu um erro ao carregar os produtos.</p>`;
    }
}

async function renderAdminProductEditView(productId) {
    const adminContent = document.getElementById('admin-content');
    if (!adminContent) return;

    adminContent.innerHTML = `<p>Carregando dados do produto...</p>`;

    try {
        const productSnap = await getDoc(doc(db, 'produtos', productId));
        if (!productSnap.exists()) {
            adminContent.innerHTML = '<p class="text-red-500">Erro: Produto não encontrado.</p>';
            return;
        }

        const product = productSnap.data();
        const variationsHTML = product.variations.map((v, index) => `
            <div class="variation-editor-group" data-index="${index}">
                <h4>Variação ${index + 1}: ${v.fullName || ''}</h4>
                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div>
                        <label class="admin-form-label">Nome Completo</label>
                        <input type="text" value="${v.fullName || ''}" class="admin-form-input" data-field="fullName">
                    </div>
                    <div>
                        <label class="admin-form-label">Peso</label>
                        <input type="text" value="${v.weight || ''}" class="admin-form-input" data-field="weight">
                    </div>
                    <div>
                        <label class="admin-form-label">Estoque</label>
                        <input type="number" value="${v.stock || 0}" class="admin-form-input" data-field="stock">
                    </div>
                    <div>
                        <label class="admin-form-label">Preço Promocional (R$)</label>
                        <input type="number" step="0.01" value="${v.price || 0}" class="admin-form-input" data-field="price">
                    </div>
                    <div>
                        <label class="admin-form-label">Preço Original (R$)</label>
                        <input type="number" step="0.01" value="${v.originalPrice || 0}" class="admin-form-input" data-field="originalPrice">
                    </div>
                    
                    <div class="lg:col-span-1">
                        <label class="admin-form-label">URL da Imagem</label>
                        <input type="url" value="${v.image || ''}" class="admin-form-input" data-field="image" placeholder="https://...">
                    </div>
                    </div>
            </div>
        `).join('');

        adminContent.innerHTML = `
            <header class="admin-header">
                <a href="#" class="admin-nav-link text-gray-500 hover:text-gray-800 -ml-4 mb-2 inline-block" data-admin-page="produtos">
                    <i class="fas fa-arrow-left mr-2"></i> Voltar para a lista
                </a>
                <h1>Editando: ${product.nome}</h1>
                <p>Altere os detalhes do produto e suas variações abaixo.</p>
            </header>
            <form id="edit-product-form" class="admin-card p-6" data-product-id="${productId}">
                <div class="space-y-6">
                    <fieldset>
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label class="admin-form-label">Nome Principal do Produto</label>
                                <input type="text" id="product-nome" value="${product.nome}" class="admin-form-input">
                            </div>
                            <div>
                                <label class="admin-form-label">Categoria</label>
                                <input type="text" id="product-category" value="${product.category || ''}" class="admin-form-input">
                            </div>
                        </div>
                        <div class="mt-4">
                            <label class="admin-form-label">Descrição</label>
                            <textarea id="product-description" rows="5" class="admin-form-textarea">${product.description || ''}</textarea>
                        </div>
                    </fieldset>

                    <fieldset>
                        <legend class="text-xl font-bold text-gray-800 border-b pb-2 mb-2">Variações do Produto</legend>
                        <div id="variations-container" class="space-y-4">${variationsHTML}</div>
                    </fieldset>
                </div>
                
                <div class="mt-8 flex justify-end">
                    <button type="submit" class="admin-btn btn-primary">
                        <i class="fas fa-save mr-2"></i> Salvar Alterações
                    </button>
                </div>
            </form>
        `;
    } catch (error) {
        console.error("Erro ao carregar produto para edição:", error);
        adminContent.innerHTML = `<p class="text-red-500">Não foi possível carregar os detalhes do produto.</p>`;
    }
}

function createProductCardHTML(productData, productId) {
    if (!productData.variations || productData.variations.length === 0) {
        console.warn(`O produto "${productData.nome}" (ID: ${productId}) não possui a estrutura de 'variations' e não será exibido.`);
        return '';
    }

    const defaultIndex = productData.defaultVariationIndex || 0;
    const defaultVariation = productData.variations[defaultIndex];
    const isFav = state.favorites.some(fav => fav.id === productId);
    const favIconClass = isFav ? 'fas text-red-500' : 'far text-gray-400';
    const isDefaultOutOfStock = defaultVariation.stock <= 0;

    const variationsHTML = productData.variations.map((v, index) => {
        const isUnavailable = v.stock <= 0;
        const buttonText = v.weight;
        const extraClasses = isUnavailable ? 'unavailable' : '';
        const disabledAttr = isUnavailable ? 'disabled' : '';

        return `
        <button
            class="variation-btn-v2 ${index === defaultIndex ? 'selected' : ''} ${extraClasses}"
            data-index="${index}"
            data-price="${v.price}"
            data-original-price="${v.originalPrice || ''}"
            data-weight="${v.weight}"
            data-stock="${v.stock}"
            data-image="${v.image || productData.image}"
            data-full-name="${v.fullName || productData.nome}"
            ${disabledAttr}>
            ${buttonText}
        </button>
        `;
    }).join('');

    let priceHTML = '';
    let discountBadgeHTML = '';

    if (defaultVariation.originalPrice && defaultVariation.originalPrice > defaultVariation.price) {
        priceHTML = `
            <span class="original-price">${formatCurrency(defaultVariation.originalPrice)}</span>
            <span class="current-price">${formatCurrency(defaultVariation.price)}</span>
        `;
        const discount = Math.round(((defaultVariation.originalPrice - defaultVariation.price) / defaultVariation.originalPrice) * 100);
        discountBadgeHTML = `<div class="product-discount-badge absolute top-3 left-3 bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full">-${discount}%</div>`;
    } else {
        priceHTML = `<span class="current-price">${formatCurrency(defaultVariation.price)}</span>`;
    }

    return `
        <div class="product-card-v2 flex flex-col" data-product-id="${productId}">
            <div class="product-image-container relative">
                ${discountBadgeHTML}
                <button class="favorite-btn absolute top-3 right-3 text-2xl z-10" data-id="${productId}">
                    <i class="${favIconClass} fa-heart"></i>
                </button>
                <a href="#" class="nav-link block" data-page="produto" data-id="${productId}">
                    <img src="${defaultVariation.image || productData.image}" alt="${productData.nome}" class="product-card-image w-full h-48 object-contain p-4">
                </a>
            </div>

            <div class="product-details p-4 flex flex-col flex-grow">
                <h3 class="product-name-display font-semibold text-gray-800 mb-2 min-h-[3.5rem]">${defaultVariation.fullName || productData.nome}</h3>
                <div class="price-container mb-3">${priceHTML}</div>
                <div class="variations-container-v2 mb-4 flex flex-wrap gap-2">${variationsHTML}</div>

                <div class="product-actions mt-auto pt-3">
                    <button class="add-to-cart-btn-v2 w-full bg-secondary text-white font-medium flex items-center justify-center"
                        data-id="${productId}"
                        data-name="${defaultVariation.fullName || productData.nome}"
                        data-price="${defaultVariation.price}"
                        data-image="${defaultVariation.image || productData.image}"
                        data-weight="${defaultVariation.weight}"
                        ${isDefaultOutOfStock ? 'disabled' : ''}>
                        <i class="fas fa-shopping-cart text-lg"></i>
                        <span class="add-to-cart-reveal">${isDefaultOutOfStock ? 'Indisponível' : 'Adicionar'}</span>
                    </button>
                </div>
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

function renderModernCalendar() {
    const container = document.getElementById('agenda-container');
    if (!container) return;
    container.innerHTML = ''; // Limpa o conteúdo anterior

    const today = new Date(); // Usa a data atual
    const daysOfWeek = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
    const hours = ['08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00'];

    // Gera 7 colunas, uma para cada dia da semana
    for (let i = 0; i < 7; i++) {
        const day = new Date(today);
        day.setDate(today.getDate() + i);
        
        const dayName = daysOfWeek[day.getDay()];
        const dayDate = `${String(day.getDate()).padStart(2, '0')}/${String(day.getMonth() + 1).padStart(2, '0')}`;
        
        let columnHTML;
        
        // Verifica se o dia é Domingo (getDay() === 0)
        if (day.getDay() === 0) {
            columnHTML = `
                <div class="day-column-closed">
                     <div class="column-header">
                        <h3 class="day-name">${dayName}</h3>
                        <p class="date-display">${dayDate}</p>
                    </div>
                    <div class="closed-message-container">
                        <i class="fas fa-store-slash"></i>
                        <h4>Fechado aos Domingos</h4>
                        <p>Nosso setor de banho e tosa não funciona neste dia.</p>
                    </div>
                </div>
            `;
        } else {
            // Lógica original para os outros dias da semana
            let morningSlotsHTML = '';
            let afternoonSlotsHTML = '';

            hours.forEach(hour => {
                const appointment = state.appointments.find(a => a.day === dayDate && a.time === hour);
                let slotHTML;

                if (appointment) {
                    // Cartão de horário RESERVADO
                    const appointmentData = JSON.stringify(appointment).replace(/'/g, "&apos;");
                    slotHTML = `
                        <div class="slot-card booked" data-appointment='${appointmentData}'>
                            <span class="slot-time">${hour}</span>
                            <div class="slot-details">
                                <span class="pet-name">${censorString(appointment.petName)}</span>
                                <p class="status-text">Reservado</p>
                            </div>
                        </div>
                    `;
                } else {
                    // Cartão de horário DISPONÍVEL
                    slotHTML = `
                        <div class="slot-card available" data-day="${dayDate}" data-time="${hour}">
                            <span class="slot-time">${hour}</span>
                            <span class="slot-action">
                                Agendar <i class="fas fa-paw ml-2"></i>
                            </span>
                        </div>
                    `;
                }

                // Adiciona o HTML ao grupo correto (Manhã/Tarde)
                if (parseInt(hour.split(':')[0]) < 12) {
                    morningSlotsHTML += slotHTML;
                } else {
                    afternoonSlotsHTML += slotHTML;
                }
            });

            // Monta a coluna completa do dia
            columnHTML = `
                <div class="day-column">
                    <div class="column-header">
                        <h3 class="day-name">${dayName}</h3>
                        <p class="date-display">${dayDate}</p>
                    </div>
                    <div class="time-group">
                        <h4 class="time-group-title"><i class="fas fa-sun text-yellow-500"></i> Manhã</h4>
                        ${morningSlotsHTML}
                    </div>
                    <div class="time-group">
                        <h4 class="time-group-title"><i class="fas fa-moon text-indigo-500"></i> Tarde</h4>
                        ${afternoonSlotsHTML}
                    </div>
                </div>
            `;
        }
        container.innerHTML += columnHTML;
    }
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

async function renderProdutosPage() {
    const container = document.getElementById('products-by-category-container');
    if (!container) return;

    container.innerHTML = '<p class="text-center text-gray-500 text-lg">Buscando os melhores produtos para o seu pet...</p>';

    try {
        const snapshot = await getDocs(query(collection(db, 'produtos'), orderBy('nome')));
        if (snapshot.empty) {
            container.innerHTML = '<p class="col-span-full text-center text-gray-500">Nenhum produto encontrado no momento.</p>';
            return;
        }

        const productsByCategory = {};

        snapshot.forEach(doc => {
            const product = doc.data();
            const category = product.category || 'Outros';
            if (!productsByCategory[category]) {
                productsByCategory[category] = [];
            }
            productsByCategory[category].push({ id: doc.id, ...product });
        });

        const sortedCategories = Object.keys(productsByCategory).sort();

        let finalHtml = '';

        for (const category of sortedCategories) {
            finalHtml += `
                <section class="category-section">
                    <h2 class="category-title">${category}</h2>
                    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        ${productsByCategory[category].map(product => createProductCardHTML(product, product.id)).join('')}
                    </div>
                </section>
            `;
        }

        container.innerHTML = finalHtml;
        updateAllHeartIcons();

    } catch (error) {
        console.error("Erro ao buscar todos os produtos: ", error);
        container.innerHTML = '<p class="col-span-full text-center text-red-500">Não foi possível carregar os produtos. Tente novamente mais tarde.</p>';
    }
}
async function renderPromocoesPage() {
    const container = document.getElementById('promotional-products-container');
    if (!container) return;

    container.innerHTML = '<p class="col-span-full text-center text-gray-500 text-lg">Buscando as melhores ofertas para você...</p>';

    try {
        const snapshot = await getDocs(query(collection(db, 'produtos')));
        if (snapshot.empty) {
            container.innerHTML = '<p class="col-span-full text-center text-gray-500">Nenhuma promoção encontrada no momento.</p>';
            return;
        }

        const promotionalProducts = [];
        snapshot.forEach(doc => {
            const product = doc.data();
            // Verifica se o produto tem variações e se alguma delas está em promoção
            if (product.variations && Array.isArray(product.variations)) {
                const isOnSale = product.variations.some(v => v.originalPrice && v.originalPrice > v.price);
                if (isOnSale) {
                    promotionalProducts.push({ id: doc.id, ...product });
                }
            }
        });

        if (promotionalProducts.length === 0) {
            container.innerHTML = '<p class="col-span-full text-center text-gray-500">Nenhuma promoção encontrada no momento. Volte em breve!</p>';
            return;
        }

        // Usa a função já existente para criar os cards dos produtos
        container.innerHTML = promotionalProducts.map(product => createProductCardHTML(product, product.id)).join('');
        updateAllHeartIcons();

    } catch (error) {
        console.error("Erro ao buscar produtos em promoção: ", error);
        container.innerHTML = '<p class="col-span-full text-center text-red-500">Não foi possível carregar as promoções. Tente novamente mais tarde.</p>';
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

        // --- Seleção de Elementos ---
        const el = (id) => document.getElementById(id);
        const mainImageEl = el('main-product-image');
        const nameEl = el('product-name');
        const brandEl = el('product-brand');
        const priceEl = el('product-price');
        const originalPriceEl = el('product-original-price');
        const discountBadgeEl = el('product-discount-badge');
        const installmentsEl = el('product-installments');
        const breadcrumbEl = el('breadcrumb-category');
        const descriptionEl = el('product-description');
        const favBtnPage = el('favorite-btn-page');
        const variationsContainer = document.querySelector('#product-variations .variations-container');
        const addToCartBtn = el('add-to-cart-product-page');
        
        // --- Atualização da UI com dados da variação padrão ---
        if (mainImageEl) mainImageEl.src = defaultVariation.image || productData.image;
        if (nameEl) nameEl.textContent = defaultVariation.fullName || productData.nome;
        if (brandEl) brandEl.querySelector('span').textContent = productData.brand || "N/A";
        if (priceEl) priceEl.textContent = formatCurrency(defaultVariation.price);
        if (breadcrumbEl) breadcrumbEl.textContent = productData.category || "N/A";
        
        renderInstallmentsText(installmentsEl, defaultVariation.price);
        
        if (descriptionEl) {
            descriptionEl.innerHTML = productData.description ? `<p>${productData.description.replace(/\n/g, '</p><p>')}</p>` : '<p>Sem descrição.</p>';
        }

        if (favBtnPage) {
            favBtnPage.dataset.id = productId;
            const isFav = state.favorites.some(fav => fav.id === productId);
            const icon = favBtnPage.querySelector('i');
            if (isFav) {
                icon.classList.remove('far');
                icon.classList.add('fas', 'text-red-500');
            } else {
                icon.classList.remove('fas', 'text-red-500');
                icon.classList.add('far');
            }
        }

        renderStockStatus(defaultVariation.stock);
        
        const categoryForReviews = productData.category || 'geral';
        const reviews = generateRealisticReviews(productId, categoryForReviews);
        renderReviews(reviews);
        renderStarRating(reviews);
        renderProductSpecs(productData.specifications);
        renderRelatedProducts(productData.category, productId);

        if (originalPriceEl && discountBadgeEl) {
            if (defaultVariation.originalPrice && defaultVariation.originalPrice > defaultVariation.price) {
                originalPriceEl.textContent = formatCurrency(defaultVariation.originalPrice);
                originalPriceEl.classList.remove('hidden');
                const discount = Math.round(((defaultVariation.originalPrice - defaultVariation.price) / defaultVariation.price) * 100);
                discountBadgeEl.textContent = `-${discount}%`;
                discountBadgeEl.classList.remove('hidden');
            } else {
                originalPriceEl.classList.add('hidden');
                discountBadgeEl.classList.add('hidden');
            }
        }

        if (variationsContainer) {
             variationsContainer.innerHTML = productData.variations.map((v, index) => `
                <button 
                    class="variation-btn ${index === defaultIndex ? 'selected' : ''} ${v.stock <= 0 ? 'unavailable' : ''}" 
                    data-price="${v.price}" 
                    data-original-price="${v.originalPrice || ''}" 
                    data-weight="${v.weight}" 
                    data-stock="${v.stock}" 
                    data-image="${v.image || productData.image}" 
                    data-full-name="${v.fullName || productData.nome}"
                    ${v.stock <= 0 ? 'disabled' : ''}>
                    ${v.weight}
                </button>`).join('');
        }
        
        if (addToCartBtn) {
            addToCartBtn.disabled = defaultVariation.stock <= 0;
            addToCartBtn.innerHTML = defaultVariation.stock <= 0 ? 'Indisponível' : '<i class="fas fa-shopping-cart mr-3"></i> Adicionar';
            addToCartBtn.dataset.id = productId;
            addToCartBtn.dataset.name = defaultVariation.fullName || productData.nome;
            addToCartBtn.dataset.price = defaultVariation.price;
            addToCartBtn.dataset.image = defaultVariation.image || productData.image;
            addToCartBtn.dataset.weight = defaultVariation.weight;
        }

    } catch (error) {
        console.error("Erro CRÍTICO ao renderizar página do produto:", error);
        appRoot.innerHTML = `<p class="text-center text-red-500 py-20">Ocorreu um erro ao carregar este produto.</p>`;
    }
}

async function renderRelatedProducts(category, currentProductId) {
    const container = document.getElementById('related-products-container');
    if (!container) return;
    
    if (!category) {
        container.innerHTML = '<p class="col-span-full">Categoria não definida para este produto.</p>';
        return;
    }

    try {
        const snapshot = await getDocs(query(collection(db, 'produtos'), where('category', '==', category)));

        const relatedProducts = snapshot.docs
            .filter(doc => doc.id !== currentProductId)
            .map(doc => ({ id: doc.id, ...doc.data() }))
            .slice(0, 4);

        if (relatedProducts.length === 0) {
            container.innerHTML = '<p class="col-span-full">Nenhum outro produto encontrado nesta categoria.</p>';
            return;
        }

        container.innerHTML = '';
        relatedProducts.forEach(product => {
            container.insertAdjacentHTML('beforeend', createProductCardHTML(product, product.id));
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
    const searchCategory = params.category || ''; // <-- NOVA LINHA

    const grid = document.getElementById('products-grid');
    const countEl = document.getElementById('products-count');
    const titleEl = document.querySelector('#app-root h1');

    if (grid) grid.innerHTML = '<p class="col-span-full text-center py-8">Buscando produtos...</p>';
    if (countEl) countEl.textContent = '...';

    try {
        const snapshot = await getDocs(collection(db, 'produtos'));
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
        } else if (searchCategory) { // <-- BLOCO MODIFICADO/ADICIONADO
            if (titleEl) titleEl.textContent = `Categoria: "${searchCategory}"`;
            const lowerCaseCategory = searchCategory.toLowerCase();
            initialProducts = currentSearchResults.filter(p => 
                p.category && p.category.toLowerCase() === lowerCaseCategory
            );
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
    // CORREÇÃO: Selecionador unificado para ambos os tipos de botão.
    const button = event.target.closest('.add-to-cart-btn, .add-to-cart-btn-v2');
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
    button.classList.add('added', 'bg-orange-500', 'hover:bg-orange-600');
    button.innerHTML = `<i class="fas fa-check mr-2"></i> Adicionado!`;
    setTimeout(() => {
        button.classList.remove('added', 'bg-orange-500', 'hover:bg-orange-600');
        button.innerHTML = originalContent;
        if (quantityInput) quantityInput.value = '1';
    }, 2000);
}

function handleFavoriteToggle(event) {
    const button = event.target.closest('.favorite-btn');
    if (!button) return;
    // CORREÇÃO: Usar um seletor mais genérico que funciona para ambos os cards.
    const card = button.closest('[data-product-id]');
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
    const orderDocRef = doc(db, 'orders', orderId);

    onSnapshot(orderDocRef, (docSnap) => {
        if (!docSnap.exists()) {
            appRoot.innerHTML = `<p class="text-center text-red-500 py-20">Pedido não encontrado.</p>`;
            return;
        }

        const order = docSnap.data();
        const mainProduct = order.items[0];

        const trackingProductImageEl = document.getElementById('tracking-product-image');
        const trackingProductNameEl = document.getElementById('tracking-product-name');
        const trackingDeliveryEstimateEl = document.getElementById('tracking-delivery-estimate');
        const timelineContainer = document.getElementById('tracking-timeline-container');

        if (!trackingProductImageEl || !trackingProductNameEl || !trackingDeliveryEstimateEl || !timelineContainer) {
            console.error("Erro: Elementos da página de rastreamento não encontrados.");
            return;
        }

        trackingProductImageEl.src = mainProduct.image;
        trackingProductNameEl.textContent = mainProduct.name + (order.items.length > 1 ? ` e mais ${order.items.length - 1} item(ns)` : '');
        trackingDeliveryEstimateEl.textContent = order.estimatedDelivery || 'Previsão de entrega não disponível.';

        const statuses = ['Processando', 'Enviado', 'Entregue'];
        let currentStatusIndex = statuses.indexOf(order.status);
        if (currentStatusIndex === -1) currentStatusIndex = 0;

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
    });
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

        if (pageName !== 'home' && pageName !== 'admin') {
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
    updateCouponUI();
    initCartPageListeners(state, {
        // Funções que já estavam:
        handleCepSearch,
        getShippingFee,
        formatCurrency,
        updateTotals,
        updateCouponUI,

        // Funções de cupom que estavam faltando:
        applyCoupon,
        removeCoupon
         });
             break;
            case 'produtos':
                await renderProdutosPage();
                break;
            case 'promocoes':
                await renderPromocoesPage();
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
                    // NOVO: Chama a função para preencher o endereço no checkout
                    populateCheckoutAddress(); 
                    break;
            case 'favorites':
                await renderFavoritesPage();
                break;
            case 'banho-e-tosa':
                onSnapshot(query(collection(db, 'groomingAppointments')), (snapshot) => {
        state.appointments = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderModernCalendar(); // Atualiza o calendário sempre que houver uma mudança
    });
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
            // Configurações básicas do painel
            const adminUserNameEl = document.getElementById('admin-user-name');
            if (adminUserNameEl) {
                adminUserNameEl.textContent = state.loggedInUser.displayName || state.loggedInUser.email.split('@')[0];
            }
            document.querySelector('#admin-user-profile .logout-btn')?.addEventListener('click', handleLogout);

            // Renderiza o conteúdo inicial do dashboard
            renderAdminDashboard();

            // --- NOVA LÓGICA PARA O MENU MOBILE ---
            const sidebar = document.getElementById('admin-sidebar');
            const menuToggleBtn = document.getElementById('admin-menu-toggle');
            const adminContent = document.getElementById('admin-content');

            const closeSidebar = () => {
                if (sidebar) sidebar.classList.remove('is-open');
            };
            
            if (menuToggleBtn && sidebar) {
                menuToggleBtn.addEventListener('click', (e) => {
                    e.stopPropagation(); // Impede que o clique no conteúdo feche o menu imediatamente
                    sidebar.classList.toggle('is-open');
                });
            }

            // Fecha a sidebar se o usuário clicar fora dela (no conteúdo principal)
            if (adminContent) {
                adminContent.addEventListener('click', () => {
                    if (sidebar && sidebar.classList.contains('is-open')) {
                        closeSidebar();
                    }
                });
            }
            // --- FIM DA NOVA LÓGICA ---

            // Lógica de navegação da barra lateral (MODIFICADA PARA FECHAR O MENU)
            document.querySelectorAll('.admin-nav-link').forEach(link => {
                link.addEventListener('click', (e) => {
                    e.preventDefault();
                    
                    // Fecha a sidebar ao clicar em um link (essencial para mobile)
                    closeSidebar();

                    document.querySelectorAll('.admin-nav-link').forEach(l => l.classList.remove('active'));
                    link.classList.add('active');

                    const adminPage = link.dataset.adminPage;
                    if (adminPage === 'dashboard') {
                        loadPage('admin'); // Recarrega a página do admin para mostrar o dashboard
                    } else if (adminPage === 'pedidos') {
                        renderAdminOrdersView();
                    } else if (adminPage === 'banho-tosa') {
                        renderAdminGroomingView();
                    } else if (adminPage === 'clientes') {
                        renderAdminClientsView();
                    } else if (adminPage === 'produtos') {
                        renderAdminProductsView();
                    } else if (adminPage === 'cupons') {
                        renderAdminCouponsView();
                    } else if (adminPage === 'importar-xml') {
                        renderAdminImportXMLView();
                    } else if (adminPage === 'configuracoes') {
                        renderAdminSettingsView();
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
    const pageContainer = document.getElementById('app-root');
    if (!pageContainer) return;

    // Lógica das abas
    const tabContainer = document.getElementById('info-tabs');
    if (tabContainer) {
        tabContainer.addEventListener('click', (e) => {
            const clickedTab = e.target.closest('.tab-btn');
            if (!clickedTab) return;
            tabContainer.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
            document.querySelectorAll('.tab-panel').forEach(panel => panel.classList.remove('active'));
            clickedTab.classList.add('active');
            document.getElementById('tab-' + clickedTab.dataset.tab)?.classList.add('active');
        });
    }

    // Lógica da quantidade
    const quantityInput = document.getElementById('product-quantity');
    if (quantityInput) {
        pageContainer.addEventListener('click', (e) => {
            if (e.target.id === 'quantity-minus') {
                let val = parseInt(quantityInput.value);
                if (val > 1) quantityInput.value = val - 1;
            }
            if (e.target.id === 'quantity-plus') {
                quantityInput.value = parseInt(quantityInput.value) + 1;
            }
        });
    }

    // Lógica de clique nas variações
    const variationsContainer = document.querySelector('#product-variations .variations-container');
    if (variationsContainer) {
        variationsContainer.addEventListener('click', (e) => {
            const variationBtn = e.target.closest('.variation-btn');
            if (!variationBtn) return;
            
            variationsContainer.querySelectorAll('.variation-btn').forEach(btn => btn.classList.remove('selected'));
            variationBtn.classList.add('selected');
            
            const data = variationBtn.dataset;
            const stock = parseInt(data.stock, 10);
            const isOutOfStock = stock <= 0;

            const el = (id) => document.getElementById(id);
            
            // Atualiza todos os elementos da página com os dados da nova variação
            if (el('main-product-image')) el('main-product-image').src = data.image;
            if (el('product-name')) el('product-name').textContent = data.fullName;
            if (el('product-price')) el('product-price').textContent = formatCurrency(data.price);
            
            renderInstallmentsText(el('product-installments'), data.price);
            renderStockStatus(stock);

            const originalPriceEl = el('product-original-price');
            const discountBadgeEl = el('product-discount-badge');
            if (originalPriceEl && discountBadgeEl) {
                if (data.originalPrice && parseFloat(data.originalPrice) > parseFloat(data.price)) {
                    originalPriceEl.textContent = formatCurrency(data.originalPrice);
                    originalPriceEl.classList.remove('hidden');
                    const discount = Math.round(((parseFloat(data.originalPrice) - parseFloat(data.price)) / parseFloat(data.originalPrice)) * 100);
                    discountBadgeEl.textContent = `-${discount}%`;
                    discountBadgeEl.classList.remove('hidden');
                } else {
                    originalPriceEl.classList.add('hidden');
                    discountBadgeEl.classList.add('hidden');
                }
            }
            
            const addToCartBtn = el('add-to-cart-product-page');
            if (addToCartBtn) {
                addToCartBtn.dataset.price = data.price;
                addToCartBtn.dataset.weight = data.weight;
                addToCartBtn.dataset.image = data.image;
                addToCartBtn.dataset.name = data.fullName;
                addToCartBtn.disabled = isOutOfStock;
                addToCartBtn.innerHTML = isOutOfStock ? 'Indisponível' : '<i class="fas fa-shopping-cart mr-3"></i> Adicionar';
            }
        });
    }

    // Lógica do Modal de Imagem (acionado ao clicar na imagem principal)
    const imageModal = document.getElementById('image-zoom-modal');
    const openModalTrigger = document.getElementById('open-image-modal'); // Agora é a própria div da imagem
    if (imageModal && openModalTrigger) {
        const closeModalBtn = document.getElementById('close-image-modal');
        const modalMainImage = document.getElementById('modal-main-image');
        const thumbnailsContainer = document.getElementById('modal-thumbnails-container');
        const prevBtn = document.getElementById('modal-prev-btn');
        const nextBtn = document.getElementById('modal-next-btn');

        let productImages = [];
        let currentImageIndex = 0;
        
        const updateModalImage = (index) => {
            if (index < 0 || index >= productImages.length) return;
            currentImageIndex = index;
            modalMainImage.src = productImages[index];
            thumbnailsContainer.querySelectorAll('.modal-thumbnail-item').forEach((thumb, i) => {
                thumb.classList.toggle('active', i === index);
            });
        };

        openModalTrigger.addEventListener('click', () => {
            const variationButtons = document.querySelectorAll('#product-variations .variation-btn');
            productImages = [...new Set(Array.from(variationButtons).map(btn => btn.dataset.image))]; // Pega imagens únicas
            
            thumbnailsContainer.innerHTML = productImages.map((src, index) => 
                `<img src="${src}" class="modal-thumbnail-item" data-index="${index}" alt="Miniatura ${index + 1}">`
            ).join('');
            
            const currentMainImageSrc = document.getElementById('main-product-image').src;
            const startIndex = productImages.findIndex(src => src === currentMainImageSrc);
            updateModalImage(startIndex >= 0 ? startIndex : 0);

            const showArrows = productImages.length > 1;
            prevBtn.style.display = showArrows ? 'flex' : 'none';
            nextBtn.style.display = showArrows ? 'flex' : 'none';
            
            imageModal.classList.add('active');
        });

        const closeModal = () => imageModal.classList.remove('active');
        closeModalBtn.addEventListener('click', closeModal);
        imageModal.addEventListener('click', (e) => {
            if (e.target === imageModal) closeModal();
        });

        nextBtn.addEventListener('click', () => updateModalImage((currentImageIndex + 1) % productImages.length));
        prevBtn.addEventListener('click', () => updateModalImage((currentImageIndex - 1 + productImages.length) % productImages.length));

        thumbnailsContainer.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal-thumbnail-item')) {
                updateModalImage(parseInt(e.target.dataset.index));
            }
        });
    }

    // Lógica de compartilhamento
    const shareBtn = document.getElementById('share-btn');
    if(shareBtn) {
        shareBtn.addEventListener('click', async () => {
            const shareData = {
                title: document.getElementById('product-name').textContent,
                text: `Confira este produto que encontrei na J.A Pet Clínica: ${document.getElementById('product-name').textContent}`,
                url: window.location.href
            };
            try {
                if (navigator.share) {
                    await navigator.share(shareData);
                } else {
                    navigator.clipboard.writeText(window.location.href);
                    alert('Link do produto copiado para a área de transferência!');
                }
            } catch (err) {
                console.error('Erro ao compartilhar:', err);
            }
        });
    }
}

function initBanhoTosaEventListeners() {
    const pageContainer = document.getElementById('app-root');
    if (!pageContainer) return;

    pageContainer.addEventListener('click', e => {
        const openModal = (modal) => { if (modal) modal.style.display = 'flex'; };

        // Lógica para abrir modal de agendamento
        const availableSlot = e.target.closest('.slot-card.available');
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
            return;
        }

        // Lógica para ver detalhes de um agendamento
        const bookedSlot = e.target.closest('.slot-card.booked');
        if (bookedSlot) {
            const appointmentData = JSON.parse(bookedSlot.dataset.appointment.replace(/'/g, "'"));
            const detailsModal = document.getElementById('appointment-details-modal');
            document.getElementById('details-tutor-name').textContent = censorString(appointmentData.tutorName);
            document.getElementById('details-pet-name').textContent = censorString(appointmentData.petName);
            document.getElementById('details-phone-number').textContent = censorString(appointmentData.phoneNumber);
            openModal(detailsModal);
            return;
        }
    });

    // ✅ CORREÇÃO: Seleciona o formulário pelo ID antes de usar
    const bookingForm = document.getElementById('booking-form');

    // ✅ BOA PRÁTICA: Verifica se o formulário existe antes de adicionar o listener
    if (bookingForm) {
        bookingForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const submitButton = bookingForm.querySelector('button[type="submit"]');
            submitButton.disabled = true;
            submitButton.textContent = 'Agendando...';

            const newAppointment = {
                day: document.getElementById('booking-day').value,
                time: document.getElementById('booking-time').value,
                tutorName: document.getElementById('booking-tutor-name').value,
                petName: document.getElementById('booking-pet-name').value,
                phoneNumber: document.getElementById('booking-phone-number').value,
                status: 'Agendado',
                createdAt: serverTimestamp()
            };

            try {
                await addDoc(collection(db, 'groomingAppointments'), newAppointment);
                
                document.getElementById('booking-modal').style.display = 'none';
                showAnimation('success-animation-overlay', 1500, () => {});
                bookingForm.reset();

            } catch (error) {
                console.error("Erro ao salvar agendamento:", error);
                alert('Não foi possível realizar o agendamento. Tente novamente.');
            } finally {
                submitButton.disabled = false;
                submitButton.textContent = 'Confirmar Agendamento';
            }
        });
    }
}

// --- FUNÇÃO PRINCIPAL DE INICIALIZAÇÃO DA APLICAÇÃO ---
async function startApplication() {
	 const settingsRef = doc(db, 'settings', 'siteStatus');
    try {
        const docSnap = await getDoc(settingsRef);
        
        // A lógica agora funciona, pois esta função só será chamada DEPOIS do login ser verificado.
        if (docSnap.exists() && docSnap.data().isMaintenance && (!state.loggedInUser || state.loggedInUser.role !== 'admin')) {
            document.body.innerHTML = await (await fetch('pages/maintenance.html')).text();
            return;
        }
    } catch (error) {
        console.error("Erro ao verificar o modo de manutenção:", error);
    }
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
                loadPage('busca', {
                    query: searchTerm
                });
                mobileSearchModal.classList.remove('active');
                mobileSearchInput.value = '';
            }
        });
    }

    document.body.addEventListener('click', (e) => {
        const target = e.target;

        const adminProductItem = target.closest('.product-list-item');
        if (adminProductItem && adminProductItem.dataset.productId) {
            e.preventDefault();
            renderAdminProductEditView(adminProductItem.dataset.productId);
        }

        const navLink = target.closest('.nav-link');
        if (navLink && navLink.dataset.page) {
            e.preventDefault();
            loadPage(navLink.dataset.page, {
                id: navLink.dataset.id,
                query: navLink.dataset.query
            });
        }

        // CORREÇÃO: Lógica unificada para lidar com clique nas variações de produto
        const variationBtn = e.target.closest('.variation-btn, .variation-btn-v2');
        if (variationBtn) {
            e.preventDefault();
            const data = variationBtn.dataset;
            variationBtn.parentElement.querySelectorAll('.variation-btn, .variation-btn-v2').forEach(btn => btn.classList.remove('selected'));
            variationBtn.classList.add('selected');

            const stock = parseInt(data.stock, 10);
            const isOutOfStock = stock <= 0;

            // CORREÇÃO: Busca o card correto (seja o novo v2 ou o antigo)
            const card = variationBtn.closest('.product-card, .product-card-v2');
            if (card) { // Lógica para o card na página de listagem
                const priceContainer = card.querySelector('.price-container');
                const addToCartBtn = card.querySelector('.add-to-cart-btn, .add-to-cart-btn-v2');
                const cardImage = card.querySelector('.product-card-image');
                const cardName = card.querySelector('.product-name-display');

                if (priceContainer) {
                    if (data.originalPrice && parseFloat(data.originalPrice) > parseFloat(data.price)) {
                        priceContainer.innerHTML = `
                            <span class="original-price">${formatCurrency(data.originalPrice)}</span>
                            <span class="current-price">${formatCurrency(data.price)}</span>
                        `;
                    } else {
                        priceContainer.innerHTML = `<span class="current-price">${formatCurrency(data.price)}</span>`;
                    }
                }

                if (cardImage && data.image && cardImage.src !== data.image) {
                    cardImage.style.opacity = '0';
                    setTimeout(() => {
                        cardImage.src = data.image;
                        cardImage.style.opacity = '1';
                    }, 200);
                }

                if (cardName && data.fullName) cardName.textContent = data.fullName;

                if (addToCartBtn) {
                    addToCartBtn.dataset.price = data.price;
                    addToCartBtn.dataset.weight = data.weight;
                    addToCartBtn.dataset.image = data.image;
                    addToCartBtn.dataset.name = data.fullName;

                    addToCartBtn.disabled = isOutOfStock;
                    const textSpan = addToCartBtn.querySelector('.add-to-cart-reveal');
                    if (textSpan) {
                        textSpan.textContent = isOutOfStock ? 'Indisponível' : 'Adicionar';
                    } else { // Fallback para botões sem o span
                        addToCartBtn.innerHTML = isOutOfStock ? 'Indisponível' : '<i class="fas fa-shopping-cart mr-2"></i> Adicionar';
                    }
                }

            } else { // Lógica para a página de detalhes do produto
                const el = (id) => document.getElementById(id);
                renderStockStatus(parseInt(data.stock));
                if (el('product-price')) el('product-price').textContent = formatCurrency(data.price);

                // --- INÍCIO DA MODIFICAÇÃO: Atualiza parcelas ao trocar variação ---
                // Atualiza o texto de parcelamento usando a nova lógica
                renderInstallmentsText(el('product-installments'), data.price);
                // --- FIM DA MODIFICAÇÃO ---

                const originalPrice = el('product-original-price'),
                    discountBadge = el('product-discount-badge');
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
                    setTimeout(() => {
                        pageImage.src = data.image;
                        pageImage.style.opacity = '1';
                    }, 200);
                }

                if (el('product-name') && data.fullName) el('product-name').textContent = data.fullName;

                const pageCartBtn = el('add-to-cart-product-page');
                if (pageCartBtn) {
                    pageCartBtn.dataset.price = data.price;
                    pageCartBtn.dataset.weight = data.weight;
                    pageCartBtn.dataset.image = data.image;
                    pageCartBtn.dataset.name = data.fullName;
                    pageCartBtn.disabled = isOutOfStock;
                    pageCartBtn.innerHTML = isOutOfStock ? 'Indisponível' : '<i class="fas fa-shopping-cart mr-2"></i> Adicionar';
                }
            }
        }

        if (target.closest('.logout-btn')) handleLogout();
        if (target.closest('#google-login-btn')) handleSocialLogin('google');
        if (target.closest('#apple-login-btn')) handleSocialLogin('apple');

        // CORREÇÃO: Delegadores de evento unificados
        if (target.closest('.add-to-cart-btn, .add-to-cart-btn-v2')) handleAddToCart(e);
        if (target.closest('.favorite-btn')) handleFavoriteToggle(e);

        if (target.closest('.remove-from-cart')) {
            state.cart = state.cart.filter(item => item.id !== target.closest('.remove-from-cart').dataset.id);
            save.cart();
            updateCounters();
            renderCart();
        }
        if (target.closest('.quantity-change')) {
            const btn = target.closest('.quantity-change');
            const item = state.cart.find(i => i.id === btn.dataset.id);
            if (item) {
                item.quantity += parseInt(btn.dataset.change);
                if (item.quantity < 1) item.quantity = 1;
                save.cart();
                updateCounters();
                renderCart();
            }
        }
        if (target.closest('#clear-cart-btn') && confirm('Limpar o carrinho?')) {
            showAnimation('clear-cart-animation-overlay', 5800, () => {
                state.cart = [];
                save.cart();
                updateCounters();
                renderCart();
            });
        }
        if (target.closest('#clear-favorites-btn') && confirm('Limpar favoritos?')) {
            showAnimation('unfavorite-animation-overlay', 1500, () => {
                state.favorites = [];
                save.favorites();
                updateCounters();
                renderFavoritesPage();
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

            // Captura os dados usando os IDs corretos do seu checkout.html
            const fullName = document.getElementById('fullname')?.value || state.loggedInUser.displayName;
            const phone = document.getElementById('phone')?.value;
			const cep = document.getElementById('cep')?.value;
            const street = document.getElementById('address')?.value; // Seu campo de endereço/rua
            const number = document.getElementById('number')?.value;
            const neighborhood = document.getElementById('neighborhood')?.value;
            const city = document.getElementById('city')?.value;
            const stateValue = document.getElementById('state')?.value;

			 if (!phone) {
        alert('Por favor, preencha o número de telefone para contato.');
        return;
    }
            // Lógica para pegar a forma de pagamento dos DIVs clicáveis
            const selectedPaymentEl = document.querySelector('.payment-option.selected');
            let paymentMethod = selectedPaymentEl ? selectedPaymentEl.dataset.method : 'Não especificado';
            // Formata o nome para ficar mais bonito (ex: "pix" vira "Pix")
            paymentMethod = paymentMethod.charAt(0).toUpperCase() + paymentMethod.slice(1);

            const newOrder = {
                userId: state.loggedInUser.uid,
                userEmail: state.loggedInUser.email,
                userName: fullName,
				userPhone: phone.replace(/\D/g, ''),
                orderDate: serverTimestamp(),
                items: [...state.cart],
                shipping: {
                    fee: state.shipping.fee || 0,
                    neighborhood: state.shipping.neighborhood || neighborhood,
                    address: {
                        cep: cep,
                        street: street,
                        number: number,
                        neighborhood: neighborhood,
                        city: city,
                        state: stateValue
                    }
                },
                total: state.cart.reduce((sum, item) => sum + (item.price * item.quantity), 0) + (state.shipping.fee || 0),
                status: 'Processando',
                paymentMethod: paymentMethod,
                estimatedDelivery: ''
            };

            addDoc(collection(db, 'orders'), newOrder)
                .then(docRef => {
                    console.log("Pedido salvo no Firestore com ID: ", docRef.id);
                    state.cart = [];
                    state.shipping = {
                        fee: 0,
                        neighborhood: ''
                    };
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
    }); // <-- CORREÇÃO: Fechando o addEventListener de 'click' que estava faltando

    document.body.addEventListener('submit', e => {
        if (e.target.id === 'login-form') handleLogin(e);
        if (e.target.id === 'create-account-form') handleCreateAccount(e);

        if (e.target.id === 'edit-product-form') {
            e.preventDefault();
            const form = e.target;
            const button = form.querySelector('button[type="submit"]');
            const productId = form.dataset.productId;

            button.textContent = 'Salvando...';
            button.disabled = true;

            try {
                const updatedData = {
                    nome: document.getElementById('product-nome').value,
                    category: document.getElementById('product-category').value,
                    description: document.getElementById('product-description').value,
                    variations: []
                };

                document.querySelectorAll('.variation-editor-group').forEach(group => {
                    const variation = {};
                    group.querySelectorAll('input').forEach(input => {
                        const field = input.dataset.field;
                        const value = input.type === 'number' ? parseFloat(input.value) || 0 : input.value;
                        variation[field] = value;
                    });
                    updatedData.variations.push(variation);
                });

                updateDoc(doc(db, 'produtos', productId), updatedData).then(() => {
                    button.innerHTML = '<i class="fas fa-check mr-2"></i> Salvo com Sucesso!';
                    button.classList.add('bg-green-500');
                    setTimeout(() => {
                        button.innerHTML = '<i class="fas fa-save mr-2"></i> Salvar Alterações';
                        button.classList.remove('bg-green-500');
                        button.disabled = false;
                    }, 2500);
                });

            } catch (error) {
                console.error("Erro ao salvar o produto:", error);
                alert('Ocorreu um erro ao salvar as alterações.');
                button.textContent = 'Salvar Alterações';
                button.disabled = false;
            }
        }

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
                loadPage('busca', {
                    query: searchTerm
                });
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
// ======================================================================
// --- INÍCIO: FUNÇÕES PARA IMPORTAÇÃO DE PRODUTOS VIA XML ---
// ======================================================================

async function renderAdminImportXMLView() {
    const adminContent = document.getElementById('admin-content');
    if (!adminContent) return;

    adminContent.innerHTML = `
        <header class="admin-header">
            <h1>Importar Produtos via NFe</h1>
            <p>Selecione um arquivo XML de uma Nota Fiscal Eletrônica para cadastrar produtos em massa.</p>
        </header>

        <div class="admin-card p-6 mb-6">
             <label for="xml-file-input" class="admin-form-label">Selecione o arquivo XML:</label>
             <input type="file" id="xml-file-input" accept=".xml" class="admin-form-input">
        </div>

        <div id="xml-products-list" class="space-y-4"></div>
        
        <div id="product-registration-form-container" class="mt-8"></div>
    `;

    document.getElementById('xml-file-input').addEventListener('change', handleFileSelect);
}

function handleFileSelect(event) {
    const file = event.target.files[0];
    if (!file) {
        alert('Nenhum arquivo selecionado.');
        return;
    }

    const reader = new FileReader();
    reader.onload = function(e) {
        const xmlText = e.target.result;
        parseNFeXML(xmlText);
    };
    reader.readAsText(file);
}

function parseNFeXML(xmlText) {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlText, "application/xml");

    const parserError = xmlDoc.querySelector('parsererror');
    if (parserError) {
        console.error('Erro ao fazer o parse do XML:', parserError);
        alert('O arquivo XML fornecido parece ser inválido ou está corrompido.');
        return;
    }

    const productsList = [];
    const productElements = xmlDoc.querySelectorAll('det');

    productElements.forEach(det => {
        const prod = det.querySelector('prod');
        if (prod) {
            const getTagValue = (tagName, parent = prod) => {
                const el = parent.querySelector(tagName);
                return el ? el.textContent : '';
            };

            productsList.push({
                code: getTagValue('cProd'),
                name: getTagValue('xProd'),
                quantity: parseFloat(getTagValue('qCom') || 0),
                unitPrice: parseFloat(getTagValue('vUnCom') || 0),
                totalPrice: parseFloat(getTagValue('vProd') || 0),
                ean: getTagValue('cEAN'),
            });
        }
    });

    if (productsList.length > 0) {
        displayXMLProducts(productsList);
    } else {
        alert('Nenhum produto encontrado no arquivo XML. Verifique se o formato está correto.');
    }
}

function displayXMLProducts(products) {
    const listContainer = document.getElementById('xml-products-list');
    listContainer.innerHTML = `
        <h2 class="text-xl font-bold text-gray-800">Produtos Encontrados na NFe</h2>
        <p class="text-gray-600 mb-4">Clique em um produto para preencher os detalhes e cadastrá-lo.</p>
    `;

    const productsHTML = products.map(product => `
        <div class="xml-product-item admin-card" data-product-xml='${JSON.stringify(product)}'>
            <div class="product-info">
                <div class="name">${product.name}</div>
                <div class="details">
                    <span>Código: ${product.code}</span> | 
                    <span>Preço Unit.: ${formatCurrency(product.unitPrice)}</span> | 
                    <span>Qtd.: ${product.quantity}</span>
                </div>
            </div>
            <div class="product-status">
                <i class="fas fa-plus-circle"></i> Cadastrar
            </div>
        </div>
    `).join('');

    listContainer.innerHTML += productsHTML;

    listContainer.querySelectorAll('.xml-product-item').forEach(item => {
        item.addEventListener('click', () => {
            listContainer.querySelectorAll('.xml-product-item').forEach(el => el.classList.remove('selected'));
            item.classList.add('selected');

            const productData = JSON.parse(item.dataset.productXml);
            showProductRegistrationForm(productData, item);
        });
    });
}

function showProductRegistrationForm(xmlProductData, listItemElement) {
    const existingModal = document.getElementById('product-modal');
    if (existingModal) existingModal.remove();

    const modalHTML = `
        <div id="product-modal" class="admin-modal-overlay">
            <div class="admin-modal-content">
                <button id="modal-close-btn" class="modal-close-button">&times;</button>
                <h3 class="text-xl font-bold text-gray-800 mb-4">Cadastrar Novo Produto</h3>
                <form id="new-product-form">
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label for="product-nome" class="admin-form-label">Nome Principal do Produto</label>
                            <input type="text" id="product-nome" class="admin-form-input" value="${xmlProductData.name}" required>
                        </div>
                        <div>
                            <label for="product-category" class="admin-form-label">Categoria</label>
                            <input type="text" id="product-category" class="admin-form-input" placeholder="Ex: Ração, Brinquedo" required>
                        </div>
                    </div>
                    <div class="mt-4">
                        <label for="product-description" class="admin-form-label">Descrição</label>
                        <textarea id="product-description" rows="3" class="admin-form-textarea" placeholder="Detalhes sobre o produto..."></textarea>
                    </div>
                    
                    <fieldset class="mt-6 border-t pt-4">
                        <legend class="text-lg font-semibold text-gray-700 mb-2">Variações do Produto</legend>
                        
                        <div id="variations-container" class="space-y-4">
                            <div class="variation-form-group">
                                <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                                    <div>
                                        <label class="admin-form-label">Nome Completo</label>
                                        <input type="text" data-field="fullName" class="admin-form-input" value="${xmlProductData.name}" required>
                                    </div>
                                    <div>
                                        <label class="admin-form-label">Preço (R$)</label>
                                        <input type="number" step="0.01" data-field="price" class="admin-form-input" value="${xmlProductData.unitPrice.toFixed(2)}" required>
                                    </div>
                                    <div>
                                        <label class="admin-form-label">Estoque</label>
                                        <input type="number" data-field="stock" class="admin-form-input" value="${Math.round(xmlProductData.quantity)}" required>
                                    </div>
                                    <div>
                                        <label class="admin-form-label">Peso/Variação</label>
                                        <input type="text" data-field="weight" class="admin-form-input" placeholder="Ex: 15kg, P" required>
                                    </div>
                                    <div class="col-span-2 md:col-span-3 lg:col-span-1">
                                        <label class="admin-form-label">URL da Imagem</label>
                                        <input type="url" data-field="image" class="admin-form-input" placeholder="https://...">
                                    </div>
                                </div>
                            </div>
                        </div>

                        <button type="button" id="add-variation-btn" class="admin-btn mt-4">
                            <i class="fas fa-plus mr-2"></i> Adicionar Variação
                        </button>
                    </fieldset>

                    <div class="mt-8 flex justify-end">
                        <button type="submit" class="admin-btn btn-primary">
                            <i class="fas fa-save mr-2"></i> Salvar Produto no Firebase
                        </button>
                    </div>
                </form>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);
    const modal = document.getElementById('product-modal');

    const closeModal = () => modal.remove();
    document.getElementById('modal-close-btn').addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            closeModal();
        }
    });

    const variationsContainer = document.getElementById('variations-container');
    document.getElementById('add-variation-btn').addEventListener('click', () => {
        const variationCount = variationsContainer.children.length;
        const newVariationHTML = `
            <div class="variation-form-group">
                <div class="flex justify-between items-center mb-2">
                    <h4 class="text-md font-semibold text-gray-600">Variação Adicional ${variationCount}</h4>
                    <button type="button" class="remove-variation-btn text-red-500 hover:text-red-700">
                        <i class="fas fa-trash-alt"></i> Remover
                    </button>
                </div>
                <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                    <div><label class="admin-form-label">Nome Completo</label><input type="text" data-field="fullName" class="admin-form-input" required></div>
                    <div><label class="admin-form-label">Preço (R$)</label><input type="number" step="0.01" data-field="price" class="admin-form-input" required></div>
                    <div><label class="admin-form-label">Estoque</label><input type="number" data-field="stock" class="admin-form-input" required></div>
                    <div><label class="admin-form-label">Peso/Variação</label><input type="text" data-field="weight" class="admin-form-input" required></div>
                    <div class="col-span-2 md:col-span-3 lg:col-span-1"><label class="admin-form-label">URL da Imagem</label><input type="url" data-field="image" class="admin-form-input" placeholder="https://..."></div>
                </div>
            </div>
        `;
        variationsContainer.insertAdjacentHTML('beforeend', newVariationHTML);
    });
    
    variationsContainer.addEventListener('click', (e) => {
        const removeBtn = e.target.closest('.remove-variation-btn');
        if (removeBtn) {
            removeBtn.closest('.variation-form-group').remove();
        }
    });

    document.getElementById('new-product-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const button = e.target.querySelector('button[type="submit"]');
        button.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i> Salvando...';
        button.disabled = true;

        const variations = [];
        document.querySelectorAll('.variation-form-group').forEach(group => {
            const variation = {
                fullName: group.querySelector('[data-field="fullName"]').value,
                price: parseFloat(group.querySelector('[data-field="price"]').value),
                stock: parseInt(group.querySelector('[data-field="stock"]').value),
                weight: group.querySelector('[data-field="weight"]').value,
                image: group.querySelector('[data-field="image"]').value || 'https://via.placeholder.com/200',
                originalPrice: 0
            };
            variations.push(variation);
        });

        const newProduct = {
            nome: document.getElementById('product-nome').value,
            category: document.getElementById('product-category').value,
            description: document.getElementById('product-description').value,
            brand: '',
            featured: false,
            variations: variations
        };

        try {
            const docRef = await addDoc(collection(db, 'produtos'), newProduct);
            console.log("Produto cadastrado com ID: ", docRef.id);
            
            listItemElement.classList.add('registered');
            listItemElement.querySelector('.product-status').innerHTML = '<i class="fas fa-check-circle text-green-500"></i> Cadastrado';
            listItemElement.classList.remove('selected');
            
            showAnimation('success-animation-overlay', 1500, closeModal);

        } catch (error) {
            console.error("Erro ao salvar produto no Firebase: ", error);
            alert('Erro ao salvar o produto. Verifique o console.');
            button.innerHTML = '<i class="fas fa-save mr-2"></i> Salvar Produto no Firebase';
            button.disabled = false;
        }
    });
}

// ======================================================================
// --- FIM: FUNÇÕES PARA IMPORTAÇÃO DE PRODUTOS VIA XML ---
// ======================================================================
// --- PONTO DE ENTRADA DA APLICAÇÃO ---
document.addEventListener('DOMContentLoaded', () => {
    state = {
        cart: JSON.parse(localStorage.getItem('cart')) || [],
        loggedInUser: null,
        favorites: JSON.parse(localStorage.getItem('favorites')) || [],
        appointments: JSON.parse(localStorage.getItem('groomingAppointments')) || [],
        orders: JSON.parse(localStorage.getItem('orders')) || [],
        shipping: { 
            fee: 0, 
            cep: '', 
            street: '', 
            number: '', 
            complement: '',
            neighborhood: '',
            city: '',
            state: ''
        },
        coupon: {
            code: null,
            type: null,
            value: 0
        }
    };

    appRoot = document.getElementById('app-root');
    loadingOverlay = document.getElementById('loading-overlay');

    let appHasStarted = false; // ✅ Variável de controle

    onAuthStateChanged(auth, async (user) => {
        if (user) {
            const userDoc = await getDoc(doc(db, 'users', user.uid));
            const userData = userDoc.exists() ? userDoc.data() : {};
            state.loggedInUser = {
                email: user.email,
                uid: user.uid,
                displayName: user.displayName || userData.name,
                role: userData.role || 'user'
            };
        } else {
            state.loggedInUser = null;
        }
        
        // ✅ CORREÇÃO: Inicia a aplicação AQUI, depois de saber quem é o usuário.
        // A variável de controle garante que a aplicação só inicie uma vez.
        if (!appHasStarted) {
            appHasStarted = true;
            await startApplication();
        }

        // A atualização do status do login pode continuar sendo chamada sempre que o auth mudar.
        updateLoginStatus(); 
    });
}); 

















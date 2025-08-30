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
firebase.initializeApp(firebaseConfig);

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

document.addEventListener('DOMContentLoaded', () => {
    // --- INSTÂNCIAS DO FIREBASE ---
    const auth = firebase.auth();
    const db = firebase.firestore();

    // --- STATE & DOM REFERENCES ---
    let state = {
        cart: JSON.parse(localStorage.getItem('cart')) || [],
        loggedInUser: null, // Controlado pelo Firebase
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
// --- FUNÇÕES DE GERENCIAMENTO DE ESTILO DE PÁGINA (VERSÃO SIMPLES) ---
function managePageStyles(pageName) {
    // Adiciona ou remove a classe para a página ocupar a tela inteira
    if (pageName === 'farmacia') {
        document.body.classList.add('is-fullpage');
    } else {
        document.body.classList.remove('is-fullpage');
    }
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

    function updateLoginStatus() {
        const desktopPlaceholder = document.getElementById('login-placeholder-desktop');
        const mobilePlaceholder = document.getElementById('login-placeholder-mobile');
        const placeholders = [desktopPlaceholder, mobilePlaceholder];

        placeholders.forEach(placeholder => {
            if (!placeholder) return;

            // Localize esta parte na função updateLoginStatus() e substitua
if (state.loggedInUser) {
    const fullName = state.loggedInUser.displayName || state.loggedInUser.email.split('@')[0];
    const firstName = fullName.split(' ')[0];

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
                <a href="#" class="user-menu-item nav-link" data-page="meus-pedidos">
                    <i class="fas fa-box-open"></i>
                    <span>Meus Pedidos</span>
                </a>
                <a href="#" class="user-menu-item nav-link" data-page="acompanhar-entrega">
                    <i class="fas fa-truck"></i>
                    <span>Acompanhe sua Entrega</span>
                </a>
                <a href="#" class="user-menu-item nav-link" data-page="ultimos-vistos">
                    <i class="fas fa-history"></i>
                    <span>Últimos Itens Vistos</span>
                </a>
                <div class="border-t border-gray-100"></div>
                <button class="logout-btn user-menu-item text-red-500 w-full text-left">
                    <i class="fas fa-sign-out-alt"></i>
                    <span>Sair</span>
                </button>
            </div>
        </div>`;

} else { // O bloco 'else' permanece o mesmo
    placeholder.innerHTML = `
        <a href="#" class="nav-link flex items-center space-x-2 bg-secondary text-white px-4 py-2 rounded-full hover:bg-teal-700" data-page="login">
            <i class="fas fa-user"></i>
            <span class="whitespace-nowrap text-sm">Entre ou Cadastre-se</span>
        </a>`;
     }
 });
}
function initProductPageListeners() {
    const mainImage = document.getElementById('main-product-image');
    const thumbnailsContainer = document.getElementById('product-thumbnails');
    
    // Event listener para a galeria de miniaturas
    thumbnailsContainer.addEventListener('click', (e) => {
        const thumbnail = e.target.closest('.thumbnail-item');
        if (!thumbnail || !mainImage) return;

        // Troca a imagem principal
        mainImage.src = thumbnail.src;

        // Atualiza o estilo da miniatura ativa
        thumbnailsContainer.querySelectorAll('.thumbnail-item').forEach(img => {
            img.classList.remove('thumbnail-active', 'border-primary');
        });
        thumbnail.classList.add('thumbnail-active', 'border-primary');
    });

    // Event listeners para o seletor de quantidade
    const quantityInput = document.getElementById('product-quantity');
    const minusBtn = document.getElementById('quantity-minus');
    const plusBtn = document.getElementById('quantity-plus');

    minusBtn.addEventListener('click', () => {
        let currentValue = parseInt(quantityInput.value);
        if (currentValue > 1) {
            quantityInput.value = currentValue - 1;
        }
    });

    plusBtn.addEventListener('click', () => {
        let currentValue = parseInt(quantityInput.value);
        quantityInput.value = currentValue + 1;
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
    function renderCart() {
    const container = document.getElementById('cart-items-container');
    if (!container) return;
    container.innerHTML = ''; // Limpa o container antes de renderizar

    // LÓGICA CORRETA PARA CARRINHO VAZIO
    if (state.cart.length === 0) {
        // Mostra a animação
        container.innerHTML = `
            <div class="empty-cart-container">
                <div class="empty-cart-animation-wrapper">
                    <i class="fas fa-shopping-cart empty-cart-main-icon"></i>
                    <div class="empty-cart-floating-icon floating-1">
                        <i class="fas fa-bone"></i>
                    </div>
                    <div class="empty-cart-floating-icon floating-2">
                        <i class="fas fa-fish"></i>
                    </div>
                    <div class="empty-cart-floating-icon floating-3">
                        <i class="fas fa-cat"></i>
                    </div>
                     <div class="empty-cart-floating-icon floating-4">
                        <i class="fas fa-heart"></i>
                    </div>
                </div>
                <h2 class="text-2xl font-bold text-gray-800 mb-2">Seu carrinho está vazio!</h2>
                <p class="text-gray-600 mb-6">Parece que você ainda não adicionou nada. Que tal explorar nossos produtos?</p>
                <button class="nav-link w-full md:w-auto bg-primary hover:bg-orange-700 text-white py-3 px-8 rounded-lg font-bold transition duration-300 flex items-center justify-center" data-page="home">
                    <i class="fas fa-search mr-2"></i>
                    Buscar Produtos
                </button>
            </div>
        `;
        // Esconde o botão de limpar
        document.getElementById('clear-cart-btn')?.classList.add('hidden');
    } 
    // LÓGICA CORRETA PARA CARRINHO COM PRODUTOS
    else {
        // Mostra o botão de limpar
        document.getElementById('clear-cart-btn')?.classList.remove('hidden');
        
        // Desenha cada produto na tela
        state.cart.forEach(item => {
            container.insertAdjacentHTML('beforeend', `<div class="flex flex-col md:flex-row items-center bg-white p-4 rounded-lg shadow-sm gap-4"><img src="${item.image}" alt="${item.name}" class="w-24 h-24 object-contain rounded-md"><div class="flex-1"><h3 class="font-bold text-gray-800">${item.name}</h3><p class="text-sm text-gray-500">Preço: ${formatCurrency(item.price)}</p></div><div class="flex items-center gap-2 border border-black rounded-full px-2"><button class="quantity-change text-lg font-bold text-primary" data-id="${item.id}" data-change="-1">-</button><input type="number" value="${item.quantity}" readonly class="w-12 text-center font-bold bg-transparent"><button class="quantity-change text-lg font-bold text-primary" data-id="${item.id}" data-change="1">+</button></div><div class="font-bold text-gray-800 w-24 text-center">${formatCurrency(item.price * item.quantity)}</div><button class="remove-from-cart text-red-500" data-id="${item.id}"><i class="fas fa-trash-alt"></i></button></div>`);
        });
    }
    // Atualiza os totais em ambos os casos
    updateTotals();
}
    function updateAllHeartIcons() {
        document.querySelectorAll('.favorite-btn').forEach(btn => {
            const icon = btn.querySelector('i');
            const isFav = state.favorites.some(fav => fav.id === btn.dataset.id);
            if (isFav) { icon.classList.remove('far', 'text-gray-300'); icon.classList.add('fas', 'text-red-500'); }
            else { icon.classList.remove('fas', 'text-red-500'); icon.classList.add('far', 'text-gray-300'); }
        });
    }
    function renderFavoritesPage() {
        const container = document.getElementById('favorites-items-container');
        const emptyState = document.getElementById('favorites-empty-state');
        const clearBtn = document.getElementById('clear-favorites-btn');
        const summaryEl = document.getElementById('favorites-summary');
        if (!container || !emptyState || !clearBtn || !summaryEl) return;
        const count = state.favorites.length;
        summaryEl.textContent = `Você tem ${count} ${count === 1 ? 'item salvo' : 'itens salvos'}.`;
        container.innerHTML = '';
        if (state.favorites.length === 0) {
            emptyState.classList.remove('hidden'); container.classList.add('hidden'); clearBtn.classList.add('hidden');
        } else {
            emptyState.classList.add('hidden'); container.classList.remove('hidden'); clearBtn.classList.remove('hidden');
            state.favorites.forEach(item => {
                container.insertAdjacentHTML('beforeend', `<div class="product-card bg-white rounded-lg shadow" data-id="${item.id}" data-name="${item.name}" data-price="${item.price}" data-image="${item.image}"><div class="relative"><button class="favorite-btn absolute top-2 right-2 text-2xl" data-id="${item.id}"><i class="fas fa-heart text-red-500"></i></button><img src="${item.image}" class="w-full h-48 object-contain p-4"></div><div class="p-4"><h3 class="font-medium text-gray-800 mb-1 h-12">${item.name}</h3><div class="mb-2"><span class="text-primary font-bold">${formatCurrency(item.price)}</span></div><button class="add-to-cart-btn w-full bg-secondary text-white py-2 rounded-lg font-medium"><i class="fas fa-shopping-cart mr-2"></i> Adicionar</button></div></div>`);
            });
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
        const today = new Date('2025-08-15T10:00:00');
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
async function renderProductPage(productId) {
    try {
        const docRef = db.collection('produtos').doc(productId);
        const doc = await docRef.get();

        if (doc.exists) {
            const productData = doc.data();

            // --- Preenche os dados básicos ---
            document.getElementById('main-product-image').src = productData.image;
            document.getElementById('main-product-image').alt = productData.nome;
            document.getElementById('product-name').textContent = productData.nome;
            document.getElementById('product-brand').querySelector('span').textContent = productData.brand;
            document.getElementById('product-description').innerHTML = `<p>${productData.description.replace(/\n/g, '</p><p>')}</p>`;
            document.getElementById('product-price').textContent = formatCurrency(productData.price);
            document.getElementById('breadcrumb-category').textContent = productData.category;

            // --- Lógica de Preço Original e Desconto ---
            const originalPriceEl = document.getElementById('product-original-price');
            const discountBadgeEl = document.getElementById('product-discount-badge');
            if (productData.originalPrice && productData.originalPrice > productData.price) {
                originalPriceEl.textContent = formatCurrency(productData.originalPrice);
                originalPriceEl.classList.remove('hidden');
                
                const discount = Math.round(((productData.originalPrice - productData.price) / productData.originalPrice) * 100);
                discountBadgeEl.textContent = `-${discount}%`;
                discountBadgeEl.classList.remove('hidden');
            } else {
                originalPriceEl.classList.add('hidden');
                discountBadgeEl.classList.add('hidden');
            }

            // --- Lógica da Galeria de Miniaturas ---
            const thumbnailsContainer = document.getElementById('product-thumbnails');
            thumbnailsContainer.innerHTML = ''; // Limpa antes de adicionar
            // Assumindo que você terá um campo 'gallery' com um array de URLs no Firebase
            const imageGallery = [productData.image, ...(productData.gallery || [])]; 
            imageGallery.forEach((imgUrl, index) => {
                thumbnailsContainer.insertAdjacentHTML('beforeend', `
                    <img src="${imgUrl}" alt="Miniatura ${index + 1}" class="thumbnail-item border-2 rounded-md p-1 ${index === 0 ? 'thumbnail-active border-primary' : 'border-transparent'}">
                `);
            });

            // --- Configura o Botão "Adicionar ao Carrinho" ---
            const addToCartBtn = document.getElementById('add-to-cart-product-page');
            addToCartBtn.dataset.id = productId;
            addToCartBtn.dataset.name = productData.nome;
            addToCartBtn.dataset.price = productData.price;
            addToCartBtn.dataset.image = productData.image;
            addToCartBtn.classList.add('add-to-cart-btn');

        } else {
            console.error("Produto não encontrado no Firebase com o ID:", productId);
            appRoot.innerHTML = `<p class="text-center text-red-500 py-20">Produto não encontrado!</p>`;
        }
    } catch (error) {
        console.error("Erro ao buscar produto:", error);
    }
}
    function initBanhoTosaEventListeners() {
        const pageContainer = document.getElementById('app-root');
        if (!pageContainer) return;
        pageContainer.addEventListener('click', e => {
            const openModal = (modal) => { if (modal) modal.style.display = 'flex'; };
            const closeModal = (modal) => { if (modal) modal.style.display = 'none'; };
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
            const bookedSlot = e.target.closest('.time-slot.booked');
            if (bookedSlot) {
                const appointment = JSON.parse(bookedSlot.dataset.appointment.replace(/'/g, "'"));
                document.getElementById('details-tutor-name').textContent = censorString(appointment.tutorName);
                document.getElementById('details-pet-name').textContent = censorString(appointment.petName);
                document.getElementById('details-phone-number').textContent = censorString(appointment.phoneNumber);
                openModal(document.getElementById('appointment-details-modal'));
            }
            if (e.target.closest('#redirect-to-login-btn')) {
                closeModal(document.getElementById('login-required-modal'));
                loadPage('login');
            }
        });
        const bookingForm = document.getElementById('booking-form');
        if (bookingForm) {
            bookingForm.addEventListener('submit', e => {
                e.preventDefault();
                const newAppointment = {
                    day: document.getElementById('booking-day').value, time: document.getElementById('booking-time').value,
                    tutorName: document.getElementById('booking-tutor-name').value, petName: document.getElementById('booking-pet-name').value,
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
    
    // --- MANIPULADORES DE EVENTOS DE AUTENTICAÇÃO (FIREBASE) ---
  
function handleSocialLogin(providerName) {
    const errorEl = document.getElementById('login-error');
    if (errorEl) errorEl.classList.add('hidden');

    let provider;
    if (providerName === 'google') {
        provider = new firebase.auth.GoogleAuthProvider();
    } else if (providerName === 'apple') {
        provider = new firebase.auth.OAuthProvider('apple.com');
        provider.addScope('email');
        provider.addScope('name');
    } else {
        console.error('Provider não suportado:', providerName);
        return;
    }

    auth.signInWithPopup(provider)
        .then((result) => {
            const user = result.user;
            const additionalUserInfo = result.additionalUserInfo;

            // Se for um novo usuário, cria o documento no Firestore
            if (additionalUserInfo.isNewUser) {
                console.log('Novo usuário via login social, criando registro no Firestore...');
                return db.collection('users').doc(user.uid).set({
                    name: user.displayName,
                    email: user.email,
                    createdAt: firebase.firestore.FieldValue.serverTimestamp()
                }).then(() => {
                    loadPage('home'); // Redireciona para home após criar o registro
                });
            } else {
                console.log('Usuário existente logado via login social.');
                loadPage('home'); // Redireciona para home para usuários existentes
            }
        })
        .catch((error) => {
            console.error("Erro no login social:", error);
            const currentErrorEl = document.getElementById('login-error');
            if (!currentErrorEl) return; // Se saiu da página de login, não faz nada

            let errorMessage = "Ocorreu um erro ao tentar entrar. Tente novamente.";
            if (error.code === 'auth/account-exists-with-different-credential') {
                errorMessage = "Já existe uma conta com este e-mail. Tente entrar com o método original.";
            } else if (error.code === 'auth/popup-closed-by-user') {
                // Não mostra erro se o usuário simplesmente fechou a janela
                return; 
            }
            currentErrorEl.textContent = errorMessage;
            currentErrorEl.classList.remove('hidden');
        });
}
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
                    .then(() => db.collection('users').doc(user.uid).set({
                        name: name, email: email, createdAt: firebase.firestore.FieldValue.serverTimestamp()
                    }));
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
            .then(() => loadPage('home'))
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
        updateLoginStatus();
    });

    // --- MANIPULADORES DE EVENTOS DE PRODUTO ---
    function handleAddToCart(event) {
    const button = event.target.closest('.add-to-cart-btn');
    if (!button || button.classList.contains('added')) return;

    // Acha o campo de quantidade, se existir na página do produto
    const quantityInput = document.getElementById('product-quantity');
    const quantity = quantityInput ? parseInt(quantityInput.value) : 1;

    // Pega os dados do produto do botão
    const productData = button.dataset;
    if (!productData.id) return;

    const existingProduct = state.cart.find(item => item.id === productData.id);
    if (existingProduct) {
        existingProduct.quantity += quantity;
    } else {
        state.cart.push({
            id: productData.id,
            name: productData.name,
            price: parseFloat(productData.price),
            image: productData.image,
            quantity: quantity
        });
    }
    
    save.cart();
    updateCounters();

    // Animação de sucesso no botão
    const originalContent = button.innerHTML;
    button.classList.add('added');
    button.innerHTML = `<i class="fas fa-check mr-2"></i> Adicionado!`;
    setTimeout(() => {
        button.classList.remove('added');
        button.innerHTML = originalContent;
        if(quantityInput) quantityInput.value = '1'; // Reseta a quantidade para 1
    }, 2000);
}
    function handleFavoriteToggle(event) {
        const button = event.target.closest('.favorite-btn');
        if (!button) return;
        const card = button.closest('.product-card');
        if (!card) return;
        const productId = card.dataset.id;
        const favoriteIndex = state.favorites.findIndex(item => item.id === productId);
        if (favoriteIndex > -1) {
            state.favorites.splice(favoriteIndex, 1);
            showAnimation('unfavorite-animation-overlay', 1500, () => {
                if (document.getElementById('favorites-items-container')) renderFavoritesPage();
            });
        } else {
            state.favorites.push({
                id: productId, name: card.dataset.name, price: parseFloat(card.dataset.price), image: card.querySelector('img').src
            });
        }
        save.favorites();
        updateCounters();
        updateAllHeartIcons();
    }

    // --- CARREGAMENTO DE PÁGINAS ---
    async function loadComponent(url, placeholderId) {
        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error(`Failed to load ${url}`);
            document.getElementById(placeholderId).innerHTML = await response.text();
        } catch (error) { console.error(error); }
    }

  async function loadPage(pageName, params = {}) {
    managePageStyles(pageName);
    loadingOverlay.style.display = 'flex';

    try {
        // ETAPA 1: Carrega o conteúdo HTML da página
        const response = await fetch(`pages/${pageName}.html`);
        if (!response.ok) throw new Error(`Página não encontrada: ${pageName}.html`);
        appRoot.innerHTML = await response.text();

        // ETAPA 2: Lógica do botão "Voltar para o início"
        if (pageName !== 'home') {
            const backButtonHTML = `
                <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
                    <a href="#" class="nav-link btn-voltar-inicio" data-page="home" data-dynamic-back-button="true">
                        <i class="fas fa-arrow-left mr-3"></i>Voltar para o início
                    </a>
                </div>`;
            appRoot.insertAdjacentHTML('afterbegin', backButtonHTML);

            const allPossibleElements = appRoot.querySelectorAll('a, button');
            allPossibleElements.forEach(element => {
                const hasText = element.textContent.trim().includes('Voltar para o início');
                const isOurButton = element.hasAttribute('data-dynamic-back-button');

                if (hasText && !isOurButton) {
                    element.parentElement.remove();
                }
            });
        }

        // ETAPA 3: Executa o código específico para a página que foi carregada
        switch (pageName) {
            case 'home':
                initSlider();
                initComparisonSlider();
                renderFeaturedProducts();
                updateAllHeartIcons();
                break;
            case 'cart':
                renderCart();
                initCartPageListeners();
                break;
            case 'produto':
                if (params.id) {
                    await renderProductPage(params.id);
                    initProductPageListeners();
                } else {
                    appRoot.innerHTML = `<p class="text-center text-red-500 py-20">Produto não encontrado!</p>`;
                }
                break;
            case 'checkout':
                renderCheckoutSummary();
                initCheckoutPageListeners();
                break;
            case 'favorites':
                renderFavoritesPage();
                updateAllHeartIcons();
                break;

            case 'banho-e-tosa':
                renderCalendar();
                initBanhoTosaEventListeners();
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
        appRoot.innerHTML = `<p class="text-red-500 text-center py-20">Erro ao carregar a página. Verifique o console.</p>`;
    } finally {
        setTimeout(() => loadingOverlay.style.display = 'none', 300);
        window.scrollTo(0, 0);

        // Adiciona a animação apenas na página inicial (CÓDIGO CORRIGIDO AQUI)
        if (pageName === 'home') {
            setTimeout(() => {
                document.querySelectorAll('.animate-on-load').forEach(el => {
                    el.classList.add('animated');
                });
            }, 100);
        }
    }
}
            const topBanner = document.getElementById('top-banner');
            if (topBanner) {
                if (pageName === 'home') {
                    topBanner.classList.remove('hidden');
                } else {
                    topBanner.classList.add('hidden');
                }
            }
            
            const mainNavBar = document.getElementById('main-nav-bar');
            if (mainNavBar) {
                if (pageName === 'home') {
                    mainNavBar.classList.remove('hidden');
                } else {
                    mainNavBar.classList.add('hidden');
                }
            }
            
                document.body.classList.add('body-has-decorations');
           }
            
            switch (pageName) {
                case 'home': initSlider(); initComparisonSlider(); updateAllHeartIcons(); break;
                case 'cart': renderCart(); initCartPageListeners(); break;
                case 'checkout': renderCheckoutSummary(); initCheckoutPageListeners(); break;
                case 'favorites': renderFavoritesPage(); updateAllHeartIcons(); break;
                case 'banho-e-tosa': renderCalendar(); initBanhoTosaEventListeners(); break;
                case 'adocao-caes': break; 
                case 'adocao-gatos': break;
                case 'como-baixar-app': break;
                case 'instalar-ios': break;
                case 'farmacia': break; // <-- ADIÇÃO 2
            }

            initPageModals();
            updateLoginStatus();
            console.error('Falha ao carregar a página:', error);
            appRoot.innerHTML = `<p class="text-red-500 text-center py-20">Erro ao carregar a página. Verifique o console.</p>`;
            setTimeout(() => loadingOverlay.style.display = 'none', 300);
            window.scrollTo(0, 0);

            // Adiciona a animação apenas na página inicial
            if (pageName === 'home') {
    setTimeout(() => {
        // A sintaxe correta do forEach é com "(el => { ... })"
        document.querySelectorAll('.animate-on-load').forEach(el => {
            el.classList.add('animated');
        });
    }, 100);
}

    // --- INICIALIZAÇÃO DA APLICAÇÃO ---
    async function initializeApp() {
        await Promise.all([
            loadComponent('components/header.html', 'header-placeholder'),
            loadComponent('components/footer.html', 'footer-placeholder')
        ]);
        
        document.body.addEventListener('click', (e) => {
            if (e.target.closest('.nav-link')?.dataset.page) { e.preventDefault(); loadPage(e.target.closest('.nav-link').dataset.page); }
            if (e.target.closest('.logout-btn')) handleLogout();
            if (e.target.closest('#google-login-btn')) handleSocialLogin('google');
            if (e.target.closest('#apple-login-btn')) handleSocialLogin('apple');
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
// ========== INÍCIO: Lógica do Chat da Marrie ==========
const marrieButton = document.getElementById('marrie-chat-button');
const marrieWindow = document.getElementById('marrie-chat-window');
const marrieCloseButton = document.getElementById('marrie-chat-close');

// ========== INÍCIO: Lógica da Plaquinha da Marrie (V3) ==========
const plaqueContainer = document.getElementById('marrie-plaque-container');
const marrieButtonForPlaque = document.getElementById('marrie-chat-button');

if (plaqueContainer && marrieButtonForPlaque) {
    let plaqueTimer;

    // Função para mostrar a placa
    const showPlaque = () => {
        plaqueContainer.classList.add('active');
        // Agenda o desaparecimento automático
        plaqueTimer = setTimeout(() => {
            plaqueContainer.classList.remove('active');
        }, 20000); // 20 segundos
    };

    // Mostra a placa 2 segundos depois que a página carrega
    setTimeout(showPlaque, 2000);

    // Função para esconder a placa (se o usuário interagir)
    const hidePlaque = () => {
        clearTimeout(plaqueTimer); // Cancela o timer de desaparecimento
        plaqueContainer.classList.remove('active');
        // Remove o "ouvinte" para não rodar de novo desnecessariamente
        marrieButtonForPlaque.removeEventListener('click', hidePlaque);
    };

    // Adiciona o "ouvinte" que esconde a placa ao clicar no botão
    marrieButtonForPlaque.addEventListener('click', hidePlaque);
}
// ========== FIM: Lógica da Plaquinha da Marrie (V3) ==========

if (marrieButton && marrieWindow && marrieCloseButton) {
    marrieButton.addEventListener('click', () => {
        // Alterna a classe 'active' para mostrar/esconder a janela com animação
        marrieWindow.classList.toggle('active');
        
        // Remove a classe 'hidden' para garantir que a animação de saída funcione
        if (marrieWindow.classList.contains('active')) {
            marrieWindow.classList.remove('hidden');
        } else {
            // Adiciona um pequeno atraso antes de esconder para a animação de saída completar
            setTimeout(() => {
                marrieWindow.classList.add('hidden');
            }, 500); // Deve corresponder à duração da transição no CSS
        }
    });

    marrieCloseButton.addEventListener('click', () => {
        marrieWindow.classList.remove('active');
        setTimeout(() => {
            marrieWindow.classList.add('hidden');
        }, 500);
    });
}
// ========== FIM: Lógica do Chat da Marrie ==========

// ========== INÍCIO: Lógica de Conversa da Marrie ==========
const chatWindowBody = document.getElementById('marrie-chat-window').querySelector('.overflow-y-auto');
const chatInput = document.getElementById('marrie-chat-input');
const chatSendButton = document.getElementById('marrie-chat-send');

// Função para adicionar uma mensagem na tela
function addChatMessage(message, sender) {
    // Remove o indicador de "digitando" se ele existir
    const typingIndicator = chatWindowBody.querySelector('.typing-indicator');
    if (typingIndicator) {
        typingIndicator.remove();
    }

    const messageContainer = document.createElement('div');
    messageContainer.className = 'chat-message-container';
    
    const messageBubble = document.createElement('div');
    messageBubble.className = `chat-message ${sender}-message`; // sender será 'user' ou 'ai'
    messageBubble.textContent = message;
    
    messageContainer.appendChild(messageBubble);
    chatWindowBody.appendChild(messageContainer);
    
    // Rola para a mensagem mais recente
    chatWindowBody.scrollTop = chatWindowBody.scrollHeight;
}

// Função para mostrar o indicador "digitando..."
function showTypingIndicator() {
    const indicator = document.createElement('div');
    indicator.className = 'typing-indicator';
    indicator.innerHTML = '<span></span><span></span><span></span>';
    chatWindowBody.appendChild(indicator);
    chatWindowBody.scrollTop = chatWindowBody.scrollHeight;
}

// Função principal que envia a mensagem do usuário
async function handleSendMessage() {
    const userMessage = chatInput.value.trim();
    if (!userMessage) return; // Não envia mensagens vazias

    // 1. Mostra a mensagem do usuário na tela
    addChatMessage(userMessage, 'user');
    chatInput.value = ''; // Limpa o campo de texto

    // 2. Mostra o indicador "Marrie está digitando..."
    showTypingIndicator();
    
    // 3. Envia a mensagem para o backend e aguarda a resposta
    try {
        const response = await fetch('https://jpet-clinica.onrender.com/api/chat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ message: userMessage }),
        });

        if (!response.ok) {
            throw new Error('A resposta da rede não foi OK.');
        }

        const data = await response.json();
        const aiResponse = data.reply;
        
        // 4. Mostra a resposta da Marrie na tela
        addChatMessage(aiResponse, 'ai');

    } catch (error) {
        console.error('Erro ao contatar a Marrie:', error);
        addChatMessage('Desculpe, estou com um probleminha para me conectar. Tente novamente mais tarde.', 'ai');
    }
}

// Adiciona os eventos para o botão de enviar e a tecla Enter
chatSendButton.addEventListener('click', handleSendMessage);
chatInput.addEventListener('keypress', (event) => {
    if (event.key === 'Enter') {
        handleSendMessage();
    }
});
// ========== FIM: Lógica de Conversa da Marrie ==========
        updateCounters();
        await loadPage('home');
    }
    
    initializeApp();
});





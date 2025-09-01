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
        loggedInUser: null,
        favorites: JSON.parse(localStorage.getItem('favorites')) || [],
        appointments: JSON.parse(localStorage.getItem('groomingAppointments')) || [],
        shipping: { fee: 0, neighborhood: '' }
    };
    const appRoot = document.getElementById('app-root');
    const loadingOverlay = document.getElementById('loading-overlay');

    // --- FUNÇÕES UTILITÁRIAS ---
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
    function managePageStyles(pageName) {
        // Controla a classe de página inteira
        if (pageName === 'farmacia') {
            document.body.classList.add('is-fullpage');
        } else {
            document.body.classList.remove('is-fullpage');
        }
        // Controla decorações especiais do body
        if (pageName === 'instalar-ios' || pageName === 'login') {
            document.body.classList.add('body-has-decorations');
        } else {
            document.body.classList.remove('body-has-decorations');
        }
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

    // --- FUNÇÕES DE RENDERIZAÇÃO DE PÁGINAS ---
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

    function updateAllHeartIcons() {
        document.querySelectorAll('.favorite-btn').forEach(btn => {
            const icon = btn.querySelector('i');
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
            emptyState.classList.remove('hidden');
            container.classList.add('hidden');
            clearBtn.classList.add('hidden');
        } else {
            emptyState.classList.add('hidden');
            container.classList.remove('hidden');
            clearBtn.classList.remove('hidden');
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
// Armazenará os produtos da busca atual para não precisar ir no banco toda hora
let currentSearchResults = [];

// Função principal que orquestra a página de busca
async function renderBuscaPage(params) {
    const searchTerm = params.query || '';
    const grid = document.getElementById('products-grid');
    const countEl = document.getElementById('products-count');
    const titleEl = document.querySelector('#app-root h1');

    if (grid) grid.innerHTML = '<p>Buscando produtos...</p>';
    if (countEl) countEl.textContent = '...';
    
    try {
        const snapshot = await db.collection('produtos').get();
        currentSearchResults = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
                                    // Garante que só produtos com variações sejam processados
                                    .filter(p => p.variations && p.variations.length > 0);

        let initialProducts = currentSearchResults;
        if (searchTerm) {
            if(titleEl) titleEl.textContent = `Resultados para "${searchTerm}"`;
            initialProducts = currentSearchResults.filter(p => 
                (p.search_keywords && p.search_keywords.includes(searchTerm.toLowerCase())) ||
                p.nome.toLowerCase().includes(searchTerm.toLowerCase())
            );
        } else {
            if(titleEl) titleEl.textContent = 'Todos os Produtos';
        }

        generateFilters(initialProducts);
        displayProducts(initialProducts);

        const filtersContainer = document.getElementById('filters-container');
        const sortByEl = document.getElementById('sort-by');
        if (filtersContainer) filtersContainer.addEventListener('change', applyFilters);
        if (sortByEl) sortByEl.addEventListener('change', applyFilters);

    } catch (error) {
        console.error("Erro ao buscar produtos:", error);
        if (grid) grid.innerHTML = '<p class="text-red-500 col-span-full">Não foi possível carregar os produtos.</p>';
    }
}

// Gera os filtros na sidebar com base nos produtos encontrados
function generateFilters(products) {
    const filtersContainer = document.getElementById('filters-container');
    if (!filtersContainer) return;

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
            </div>
        `).join('');
        return `<div class="border-t pt-4"><h3 class="font-semibold mb-2">${title}</h3><div class="space-y-2">${optionsHTML}</div></div>`;
    };
    
    let html = '';
    html += createFilterGroup('Marca', 'brand', filters.brand);
    html += createFilterGroup('Tipo de Pet', 'pet_type', filters.pet_type);
    html += createFilterGroup('Porte', 'size', filters.size);
    html += createFilterGroup('Idade', 'age', filters.age);
    
    filtersContainer.innerHTML = html || '<p>Nenhum filtro disponível.</p>';
}

// Aplica os filtros e a ordenação selecionados
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

    // CORREÇÃO: Pega o preço da primeira variação para ordenar
    const sortBy = document.getElementById('sort-by').value;
    if (sortBy === 'price-asc') {
        filteredProducts.sort((a, b) => a.variations[0].price - b.variations[0].price);
    } else if (sortBy === 'price-desc') {
        filteredProducts.sort((a, b) => b.variations[0].price - a.variations[0].price);
    }

    displayProducts(filteredProducts);
}

// Mostra os produtos filtrados na tela
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
// SUBSTITUA SUA FUNÇÃO PELA VERSÃO FINAL E À PROVA DE FALHAS ABAIXO
async function renderProductPage(productId) {
    try {
        const docRef = db.collection('produtos').doc(productId);
        const doc = await docRef.get();

        if (!doc.exists) {
            console.error("Firebase Error: Documento não encontrado para o ID:", productId);
            appRoot.innerHTML = `<p class="text-center text-red-500 py-20">Produto não encontrado no banco de dados.</p>`;
            return;
        }

        const productData = doc.data();

        // Bloco de verificação de dados essenciais
        if (!productData.variations || productData.variations.length === 0) {
            console.error("Data Error: O produto não possui a lista 'variations'.", productData);
            appRoot.innerHTML = `<p class="text-center text-red-500 py-20">Erro de dados: Produto sem variações cadastradas.</p>`;
            return;
        }

        const defaultIndex = productData.defaultVariationIndex || 0;
        const defaultVariation = productData.variations[defaultIndex];

        const categoryForReviews = productData.category || 'geral';
        const reviews = generateRealisticReviews(productId, categoryForReviews);

        // --- INÍCIO DA RENDERIZAÇÃO SEGURA ---
        // Cada 'if (element)' é uma verificação para evitar que a página quebre.
        
        const mainImageEl = document.getElementById('main-product-image');
        if (mainImageEl) mainImageEl.src = defaultVariation.image || productData.image;

        const productNameEl = document.getElementById('product-name');
        if (productNameEl) productNameEl.textContent = productData.nome || "Produto sem nome";
        
        const brandSpanEl = document.getElementById('product-brand')?.querySelector('span');
        if (brandSpanEl) brandSpanEl.textContent = productData.brand || "Marca desconhecida";

        const priceEl = document.getElementById('product-price');
        if (priceEl) priceEl.textContent = formatCurrency(defaultVariation.price);
        
        const breadcrumbEl = document.getElementById('breadcrumb-category');
        if (breadcrumbEl) breadcrumbEl.textContent = productData.category || "Sem categoria";
        
        const descriptionContainer = document.getElementById('product-description');
        if (descriptionContainer) {
            if (productData.description) {
                descriptionContainer.innerHTML = `<p>${productData.description.replace(/\n/g, '</p><p>')}</p>`;
            } else {
                descriptionContainer.innerHTML = '<p>Este produto não possui uma descrição detalhada.</p>';
            }
        }
        
        renderStockStatus(defaultVariation.stock);
        renderReviews(reviews);
        renderProductSpecs(productData.specifications);
        
        if (productData.category) {
            renderRelatedProducts(productData.category, productId);
        } else {
            const relatedContainer = document.getElementById('related-products-container');
            if (relatedContainer) relatedContainer.innerHTML = '<p class="col-span-full">Categoria do produto não definida.</p>';
        }

        const originalPriceEl = document.getElementById('product-original-price');
        const discountBadgeEl = document.getElementById('product-discount-badge');
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
                <button class="variation-btn ${index === defaultIndex ? 'selected' : ''}" data-price="${v.price}" data-original-price="${v.originalPrice || ''}" data-weight="${v.weight}" data-stock="${v.stock}" data-image="${v.image || productData.image}">
                    ${v.weight}
                </button>
            `).join('');
        }

        const addToCartBtn = document.getElementById('add-to-cart-product-page');
        if (addToCartBtn) {
            addToCartBtn.dataset.id = productId;
            addToCartBtn.dataset.name = productData.nome;
            addToCartBtn.dataset.price = defaultVariation.price;
            addToCartBtn.dataset.image = defaultVariation.image || productData.image;
            addToCartBtn.dataset.weight = defaultVariation.weight;
            addToCartBtn.classList.add('add-to-cart-btn');
        }

    } catch (error) {
        console.error("Ocorreu um erro CRÍTICO ao renderizar a página do produto:", error);
        appRoot.innerHTML = `<p class="text-center text-red-500 py-20">Ocorreu um erro ao carregar os detalhes deste produto. Verifique o console para um erro CRÍTICO.</p>`;
    }
}
// --- Gerador de avaliações realistas ---
function generateRealisticReviews(productId, productCategory) {
    // --- BANCO DE DADOS DE CONTEÚDO SEMÂNTICO ---
    const bancoDeDados = {
        perfis: [
            { nome: "Ana S.", pet: "Thor", raca: "Golden Retriever" },
            { nome: "Bruno C.", pet: "Nina", raca: "Gata SRD" },
            { nome: "Carla M.", pet: "Luke", raca: "Bulldog Francês" },
            { nome: "Diego F.", pet: "Mel", raca: "Shih Tzu" },
            { nome: "Elisa R.", pet: "Simba", raca: "Gato Persa" },
            { nome: "Fábio L.", pet: "Bolinha", raca: "Lhasa Apso" },
            { nome: "Mariana P.", pet: "Fred", raca: "Spitz Alemão" },
            { nome: "Lucas G.", pet: "Biscoito", raca: "Beagle" },
            { nome: "Sofia A.", pet: "Paçoca", raca: "Gato Siamês" },
            { nome: "Rafael B.", pet: "Rocky", raca: "Vira-lata Caramelo" }
        ],
        templatesPorCategoria: {
            ração: [
                "O {pet}, meu {raca}, é bem chato pra comer, mas devorou essa ração! Notei o pelo dele até mais brilhante. Recomendo!",
                "Excelente! Ajudou muito na digestão do {pet}. As fezes ficaram mais firmes e ele parece mais disposto. Ótimo custo-benefício.",
                "Meu {raca} se adaptou super bem. Os grãos são de um tamanho bom e ele come tudo sem reclamar. A entrega foi pontual.",
                "Qualidade premium. Dá pra ver pelos ingredientes. O cheiro é agradável e o {pet} fica esperando ansiosamente pela hora de comer.",
                "A veterinária recomendou e realmente valeu a pena. O {pet} está com muito mais energia. O único ponto é que a embalagem poderia ter um fecho melhor."
            ],
            brinquedo: [
                "Este brinquedo é o novo favorito do {pet}! Super resistente às mordidas do meu {raca}. Já comprei outros que não duraram um dia, mas este está intacto.",
                "Mantém o {pet} entretido por horas! Perfeito para os dias que preciso trabalhar em casa. O material parece ser de boa qualidade e seguro.",
                "A {pet} ficou doida com o barulhinho que faz! É o primeiro brinquedo que ela pega quando acorda. A cor é bem vibrante, fácil de achar pela casa.",
                "Ótimo para a saúde dental do {pet}. Ele passa um bom tempo roendo e ajuda a limpar os dentes. Aprovado!",
                "Comprei para meu {raca} e foi um sucesso. É um pouco menor do que eu imaginava, mas ele adorou mesmo assim. Comprarei outros da mesma marca."
            ],
            higiene: [
                "Usei este shampoo no {pet} e o resultado foi incrível. Deixou o pelo super macio e com um cheirinho muito agradável que dura dias. Recomendo!",
                "Meu {raca} tem a pele sensível e este produto não causou nenhuma irritação. Limpa bem и é suave. Excelente qualidade.",
                "O perfume é muito bom, não é forte demais. O pelo da {pet} ficou desembaraçado e fácil de escovar. Valeu cada centavo.",
                "Prático e eficiente. Usei o produto para limpeza das patinhas do {pet} depois do passeio e funcionou perfeitamente. Comprarei de novo.",
                "Deixa um brilho maravilhoso no pelo escuro do meu {raca}. Além disso, rende bastante. Estou muito satisfeito com a compra."
            ],
            farmacia: [
                "Foi muito fácil de administrar para o {pet}, não tive problemas. O efeito foi rápido e ele melhorou visivelmente em poucos dias.",
                "Produto recomendado pelo nosso veterinário. Cumpriu exatamente o que prometia e ajudou na recuperação da {pet}. Embalagem segura.",
                "Aliviou o desconforto do meu {raca} quase que imediatamente. É um item essencial para ter no nosso kit de primeiros socorros.",
                "O aplicador facilita muito o uso. Consegui dar o remédio para o {pet} sem estresse. A eficácia foi comprovada.",
                "O custo-benefício é ótimo comparado a outros que já pesquisei. E o mais importante: funcionou perfeitamente para a {pet}."
            ],
            geral: [
                "Produto de excelente qualidade, cumpre o que promete. O {pet} se adaptou super bem. A entrega foi muito rápida!",
                "Estou muito satisfeito(a) com a compra. O item é exatamente como descrito. Meu {raca}, o {pet}, está usando todos os dias.",
                "Recomendo! Um dos melhores produtos que já comprei para o {pet}. A qualidade é perceptível e valeu o investimento."
            ]
        }
    };

    const getCategoriaRelevante = (productCategory) => {
        const cat = (productCategory || "").toLowerCase();
        if (cat.includes('ração') || cat.includes('alimento')) return 'ração';
        if (cat.includes('brinquedo') || cat.includes('mordedor')) return 'brinquedo';
        if (cat.includes('shampoo') || cat.includes('higiene') || cat.includes('perfume')) return 'higiene';
        if (cat.includes('remédio') || cat.includes('farmácia') || cat.includes('suplemento') || cat.includes('antipulgas')) return 'farmacia';
        return 'geral';
    };

    const reviews = [];
    let seed = productId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const nextRandom = () => {
        seed = (seed * 1664525 + 1013904223) % 4294967296;
        return seed / 4294967296;
    };

    const numReviews = 5 + Math.floor(nextRandom() * 11);
    const categoriaRelevante = getCategoriaRelevante(productCategory);
    const poolDeTemplates = bancoDeDados.templatesPorCategoria[categoriaRelevante];

    for (let i = 0; i < numReviews; i++) {
        const perfil = bancoDeDados.perfis[Math.floor(nextRandom() * bancoDeDados.perfis.length)];
        const nomeCompleto = `${perfil.nome} (dono(a) do ${perfil.pet}, um ${perfil.raca})`;
        
        const estrelas = 4 + nextRandom();
        
        const diasAtras = Math.floor(nextRandom() * 120) + 1;
        const data = new Date();
        data.setDate(data.getDate() - diasAtras);
        
        let comentario = poolDeTemplates[Math.floor(nextRandom() * poolDeTemplates.length)];
        comentario = comentario.replace(/{pet}/g, perfil.pet).replace(/{raca}/g, perfil.raca);
        
        reviews.push({
            nome: nomeCompleto,
            avatar: perfil.nome.substring(0, 1),
            estrelas: Math.round(estrelas * 2) / 2,
            data: data.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' }),
            comentario: comentario,
            verificada: true
        });
    }
    
    const perfisUsados = new Set();
    return reviews.filter(review => {
        if (perfisUsados.has(review.nome)) {
            return false;
        }
        perfisUsados.add(review.nome);
        return true;
    });
}
// --- Função para renderizar as avaliações no HTML ---
function renderReviews(reviews) {
    const container = document.getElementById('tab-reviews');
    if (!container) return;

    if (reviews.length === 0) {
        container.innerHTML = '<p>Este produto ainda não possui avaliações.</p>';
        return;
    }

    let reviewsHTML = '';
    reviews.forEach(review => {
        // Gera as estrelas para esta avaliação específica
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
            </div>
        `;
    });
    container.innerHTML = reviewsHTML;
}
    // --- NOVO: Função para renderizar as estrelas de avaliação ---
function renderStarRating(rating = 0, reviewCount = 0) {
    const container = document.getElementById('product-stars');
    if (!container) return;

    container.innerHTML = '';
    const fullStars = Math.floor(rating);
    const halfStar = rating % 1 !== 0;
    const emptyStars = 5 - fullStars - (halfStar ? 1 : 0);

    for (let i = 0; i < fullStars; i++) container.innerHTML += '<i class="fas fa-star"></i>';
    if (halfStar) container.innerHTML += '<i class="fas fa-star-half-alt"></i>';
    for (let i = 0; i < emptyStars; i++) container.innerHTML += '<i class="far fa-star"></i>';

    container.innerHTML += `<span class="review-count">(${reviewCount} avaliações)</span>`;
}

// --- NOVO: Função para renderizar o status do estoque ---
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

// --- NOVO: Função para renderizar as especificações do produto ---
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


// --- NOVO: Função para buscar e renderizar produtos relacionados ---
async function renderRelatedProducts(category, currentProductId) {
    const container = document.getElementById('related-products-container');
    if (!container) return;

    container.innerHTML = '<p class="col-span-full">Buscando produtos...</p>';

    try {
        const snapshot = await db.collection('produtos')
            .where('category', '==', category)
            .where(firebase.firestore.FieldPath.documentId(), '!=', currentProductId)
            .limit(4)
            .get();

        if (snapshot.empty) {
            container.innerHTML = '<p class="col-span-full">Nenhum outro produto encontrado nesta categoria.</p>';
            return;
        }

        container.innerHTML = '';
        snapshot.forEach(doc => {
            const productCard = createProductCardHTML(doc.data(), doc.id);
            container.insertAdjacentHTML('beforeend', productCard);
        });
        updateAllHeartIcons(); // Atualiza os corações dos produtos relacionados
    } catch (error) {
        console.error("Erro ao buscar produtos relacionados: ", error);
        container.innerHTML = '<p class="col-span-full text-red-500">Não foi possível carregar produtos relacionados.</p>';
    }
}

// SUBSTITUA SUA createProductCardHTML PELA VERSÃO ABAIXO, QUE É MAIS SEGURA
function createProductCardHTML(productData, productId) {
    // --- NOVO: Bloco de segurança ---
    // Se o produto não tiver a estrutura de 'variations', ele será ignorado.
    // Isso evita que a página quebre se um produto antigo estiver nos destaques.
    if (!productData.variations || productData.variations.length === 0) {
        console.warn(`O produto "${productData.nome}" (ID: ${productId}) não possui a estrutura de 'variations' e não será exibido.`);
        return ''; // Retorna uma string vazia para não renderizar o card quebrado.
    }

    // Pega a variação padrão para exibir inicialmente (lógica que já existe)
    const defaultIndex = productData.defaultVariationIndex || 0;
    const defaultVariation = productData.variations[defaultIndex];

    const isFav = state.favorites.some(fav => fav.id === productId);
    const favIconClass = isFav ? 'fas text-red-500' : 'far text-gray-300';

    // Gera o HTML para os botões de variação
    const variationsHTML = productData.variations.map((v, index) => `
        <button 
            class="variation-btn ${index === defaultIndex ? 'selected' : ''}" 
            data-index="${index}"
            data-price="${v.price}"
            data-original-price="${v.originalPrice || ''}"
            data-weight="${v.weight}"
            data-stock="${v.stock}">
            ${v.weight}
        </button>
    `).join('');
    
    // Gera o HTML do preço inicial
    let priceHTML = `<span class="text-primary font-bold text-lg">${formatCurrency(defaultVariation.price)}</span>`;
    let discountBadgeHTML = '';

    if (defaultVariation.originalPrice && defaultVariation.originalPrice > defaultVariation.price) {
        priceHTML = `
            <div>
                <span class="product-original-price-display text-sm text-gray-400 line-through">${formatCurrency(defaultVariation.originalPrice)}</span>
                <span class="product-price-display text-primary font-bold text-lg block">${formatCurrency(defaultVariation.price)}</span>
            </div>`;
        const discount = Math.round(((defaultVariation.originalPrice - defaultVariation.price) / defaultVariation.price) * 100);
        discountBadgeHTML = `<div class="product-discount-display absolute top-2 left-2 bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-md">-${discount}%</div>`;
    } else {
         priceHTML = `<div class="h-[48px] flex items-center"><span class="product-price-display text-primary font-bold text-lg">${formatCurrency(defaultVariation.price)}</span></div>`;
    }

    // O card agora tem um data-product-id para ser facilmente encontrado pelo JS
    return `
        <div class="product-card bg-white rounded-lg shadow transition-all duration-300 hover:shadow-xl hover:-translate-y-1 flex flex-col" data-product-id="${productId}">
            <div class="relative">
                ${discountBadgeHTML}
                <button class="favorite-btn absolute top-2 right-2 text-2xl z-10" data-id="${productId}">
                    <i class="${favIconClass} fa-heart"></i>
                </button>
                <a href="#" class="nav-link block" data-page="produto" data-id="${productId}">
                    <img src="${productData.image}" alt="${productData.nome}" class="w-full h-48 object-contain p-4">
                </a>
            </div>
            <div class="p-4 flex flex-col flex-grow">
                <h3 class="font-medium text-gray-800 ... product-name-display">${defaultVariation.fullName || productData.nome}</h3>
                <div class="product-price-container mb-2">${priceHTML}</div>
                
                <div class="variations-container mb-4">${variationsHTML}</div>

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

    async function renderFeaturedProducts() {
        const container = document.getElementById('featured-products-container');
        if (!container) return; 

        try {
            const snapshot = await db.collection('produtos').where('featured', '==', true).limit(8).get();

            if (snapshot.empty) {
                container.innerHTML = '<p class="col-span-full text-center text-gray-500">Nenhum produto em destaque no momento.</p>';
                return;
            }

            container.innerHTML = ''; 
            snapshot.forEach(doc => {
                const productCard = createProductCardHTML(doc.data(), doc.id);
                container.insertAdjacentHTML('beforeend', productCard);
            });

        } catch (error) {
            console.error("Erro ao buscar produtos em destaque: ", error);
            container.innerHTML = '<p class="col-span-full text-center text-red-500">Não foi possível carregar os produtos.</p>';
        }
    }
    
    // --- INICIALIZAÇÃO DE LISTENERS ESPECÍFICOS DE PÁGINAS ---
function initProductPageListeners() {
    // Lógica da galeria de imagens (já existente)
    const mainImage = document.getElementById('main-product-image');
    const thumbnailsContainer = document.getElementById('product-thumbnails');
    if (thumbnailsContainer) {
        thumbnailsContainer.addEventListener('click', (e) => {
            const thumbnail = e.target.closest('.thumbnail-item');
            if (!thumbnail || !mainImage) return;
            mainImage.src = thumbnail.src;
            thumbnailsContainer.querySelectorAll('.thumbnail-item').forEach(img => {
                img.classList.remove('thumbnail-active', 'border-primary');
            });
            thumbnail.classList.add('thumbnail-active', 'border-primary');
        });
    }

    // Lógica do seletor de quantidade (já existente)
    const quantityInput = document.getElementById('product-quantity');
    const minusBtn = document.getElementById('quantity-minus');
    const plusBtn = document.getElementById('quantity-plus');
    if (minusBtn && plusBtn && quantityInput) {
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

    // --- NOVO: Lógica para controlar as abas de informação ---
    const tabContainer = document.getElementById('info-tabs');
    if(tabContainer) {
        const tabButtons = tabContainer.querySelectorAll('.tab-btn');
        const tabPanels = document.querySelectorAll('.tab-panel');

        tabContainer.addEventListener('click', (e) => {
            const clickedTab = e.target.closest('.tab-btn');
            if (!clickedTab) return;

            // Desativa todas as abas e painéis
            tabButtons.forEach(btn => btn.classList.remove('active'));
            tabPanels.forEach(panel => panel.classList.remove('active'));

            // Ativa a aba e o painel clicado
            clickedTab.classList.add('active');
            const targetPanelId = 'tab-' + clickedTab.dataset.tab;
            document.getElementById(targetPanelId)?.classList.add('active');
        });
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
    
    // --- LÓGICA DE AUTENTICAÇÃO ---
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
                if (additionalUserInfo.isNewUser) {
                    console.log('Novo usuário via login social, criando registro no Firestore...');
                    return db.collection('users').doc(user.uid).set({
                        name: user.displayName,
                        email: user.email,
                        createdAt: firebase.firestore.FieldValue.serverTimestamp()
                    }).then(() => {
                        loadPage('home');
                    });
                } else {
                    console.log('Usuário existente logado via login social.');
                    loadPage('home');
                }
            })
            .catch((error) => {
                console.error("Erro no login social:", error);
                const currentErrorEl = document.getElementById('login-error');
                if (!currentErrorEl) return;
                let errorMessage = "Ocorreu um erro ao tentar entrar. Tente novamente.";
                if (error.code === 'auth/account-exists-with-different-credential') {
                    errorMessage = "Já existe uma conta com este e-mail. Tente entrar com o método original.";
                } else if (error.code === 'auth/popup-closed-by-user') {
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
                        name: name,
                        email: email,
                        createdAt: firebase.firestore.FieldValue.serverTimestamp()
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
        const quantityInput = document.getElementById('product-quantity');
        const quantity = quantityInput ? parseInt(quantityInput.value) : 1;
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
        const originalContent = button.innerHTML;
        button.classList.add('added');
        button.innerHTML = `<i class="fas fa-check mr-2"></i> Adicionado!`;
        setTimeout(() => {
            button.classList.remove('added');
            button.innerHTML = originalContent;
            if (quantityInput) quantityInput.value = '1';
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
                id: productId,
                name: card.dataset.name,
                price: parseFloat(card.dataset.price),
                image: card.querySelector('img').src
            });
        }
        save.favorites();
        updateCounters();
        updateAllHeartIcons();
    }
    
    // --- LÓGICA DE CONVERSA DO CHATBOT MARRIE ---
    function addChatMessage(message, sender) {
        const chatWindowBody = document.getElementById('marrie-chat-window')?.querySelector('.overflow-y-auto');
        if (!chatWindowBody) return;
        
        const typingIndicator = chatWindowBody.querySelector('.typing-indicator');
        if (typingIndicator) {
            typingIndicator.remove();
        }

        const messageContainer = document.createElement('div');
        messageContainer.className = 'chat-message-container';
        
        const messageBubble = document.createElement('div');
        messageBubble.className = `chat-message ${sender}-message`;
        messageBubble.textContent = message;
        
        messageContainer.appendChild(messageBubble);
        chatWindowBody.appendChild(messageContainer);
        
        chatWindowBody.scrollTop = chatWindowBody.scrollHeight;
    }

    function showTypingIndicator() {
        const chatWindowBody = document.getElementById('marrie-chat-window')?.querySelector('.overflow-y-auto');
        if (!chatWindowBody) return;
        const indicator = document.createElement('div');
        indicator.className = 'typing-indicator';
        indicator.innerHTML = '<span></span><span></span><span></span>';
        chatWindowBody.appendChild(indicator);
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
            
            // ETAPA 3: Controla visibilidade de elementos globais (Banners, etc)
            const topBanner = document.getElementById('top-banner');
            if(topBanner) pageName === 'home' ? topBanner.classList.remove('hidden') : topBanner.classList.add('hidden');
            
            const mainNavBar = document.getElementById('main-nav-bar');
            if(mainNavBar) pageName === 'home' ? mainNavBar.classList.remove('hidden') : mainNavBar.classList.add('hidden');
    
            // ETAPA 4: Executa o código específico para a página que foi carregada
            switch (pageName) {
                case 'home':
                    initSlider();
                    initComparisonSlider();
                    renderFeaturedProducts();
                    updateAllHeartIcons();
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
                        appRoot.innerHTML = `<p class="text-center text-red-500 py-20">Produto não encontrado!</p>`;
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
                    renderFavoritesPage();
                    updateAllHeartIcons();
                    break;
                case 'banho-e-tosa':
                    renderCalendar();
                    initBanhoTosaEventListeners();
                    break;
                // Páginas estáticas que não precisam de JS específico
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
    
            if (pageName === 'home') {
                setTimeout(() => {
                    document.querySelectorAll('.animate-on-load').forEach(el => {
                        el.classList.add('animated');
                    });
                }, 100);
            }
        }
    }

    // --- INICIALIZAÇÃO DA APLICAÇÃO ---
    async function initializeApp() {
        await Promise.all([
            loadComponent('components/header.html', 'header-placeholder'),
            loadComponent('components/footer.html', 'footer-placeholder')
        ]);
        
        // --- LISTENERS GLOBAIS ---
        document.body.addEventListener('click', (e) => {
            const navLink = e.target.closest('.nav-link');
            if (navLink && navLink.dataset.page) {
                e.preventDefault();
                const pageName = navLink.dataset.page;
                const params = { id: navLink.dataset.id };
                loadPage(pageName, params);
            }
// LÓGICA PARA ATUALIZAR VARIAÇÕES DE PRODUTO
           // DENTRO DE initializeApp > document.body.addEventListener('click' ...
const variationBtn = e.target.closest('.variation-btn');
if (variationBtn) {
    e.preventDefault();
    const selectedData = variationBtn.dataset;
    const newImage = selectedData.image;
    const newFullName = selectedData.fullName;
    
    variationBtn.parentElement.querySelectorAll('.variation-btn').forEach(btn => btn.classList.remove('selected'));
    variationBtn.classList.add('selected');

    const productCard = variationBtn.closest('.product-card');

   if (productCard) { // --- LÓGICA PARA O CARD DE PRODUTO ---
    const priceContainer = productCard.querySelector('.product-price-container');
    const addToCartBtn = productCard.querySelector('.add-to-cart-btn');
    const cardImage = productCard.querySelector('.product-card-image');
    const cardName = productCard.querySelector('.product-name-display');

    // Atualiza o HTML do preço no card (já deve estar correto)
    if (selectedData.originalPrice && selectedData.originalPrice > 0) {
        const discount = Math.round(((selectedData.originalPrice - selectedData.price) / selectedData.originalPrice) * 100);
        priceContainer.innerHTML = `<div><span class="product-original-price-display text-sm text-gray-400 line-through">${formatCurrency(selectedData.originalPrice)}</span><span class="product-price-display text-primary font-bold text-lg block">${formatCurrency(selectedData.price)}</span></div>`;
        const discountBadge = productCard.querySelector('.product-discount-display');
        if (discountBadge) discountBadge.textContent = `-${discount}%`;
    } else {
        priceContainer.innerHTML = `<div class="h-[48px] flex items-center"><span class="product-price-display text-primary font-bold text-lg">${formatCurrency(selectedData.price)}</span></div>`;
    }

    // Troca a imagem do card com um efeito suave (já deve estar correto)
    if (newImage && cardImage.src !== newImage) {
        cardImage.style.opacity = '0';
        setTimeout(() => {
            cardImage.src = newImage;
            cardImage.style.opacity = '1';
        }, 200);
    }

    // ATUALIZAÇÃO DO NOME (a linha que provavelmente faltava)
    if (cardName && newFullName) {
        cardName.textContent = newFullName;
    }

    // Atualiza os dados do botão "Adicionar" do card
    addToCartBtn.dataset.price = selectedData.price;
    addToCartBtn.dataset.weight = selectedData.weight;
    addToCartBtn.dataset.image = newImage;
    addToCartBtn.dataset.name = newFullName;
}

    // Atualiza o HTML do preço no card
    if (selectedData.originalPrice && selectedData.originalPrice > 0) {
        const discount = Math.round(((selectedData.originalPrice - selectedData.price) / selectedData.originalPrice) * 100);
        priceContainer.innerHTML = `
            <div>
                <span class="product-original-price-display text-sm text-gray-400 line-through">${formatCurrency(selectedData.originalPrice)}</span>
                <span class="product-price-display text-primary font-bold text-lg block">${formatCurrency(selectedData.price)}</span>
            </div>`;
        const discountBadge = productCard.querySelector('.product-discount-display');
        if (discountBadge) discountBadge.textContent = `-${discount}%`;
    } else {
        priceContainer.innerHTML = `<div class="h-[48px] flex items-center"><span class="product-price-display text-primary font-bold text-lg">${formatCurrency(selectedData.price)}</span></div>`;
    }

    // Troca a imagem do card com um efeito suave
    if (newImage && cardImage.src !== newImage) {
        cardImage.style.opacity = '0';
        setTimeout(() => {
            cardImage.src = newImage;
            cardImage.style.opacity = '1';
        }, 200);
    }

    // Atualiza o nome no card
    if (cardName && newFullName) {
        cardName.textContent = newFullName;
    }

    // Atualiza os dados do botão "Adicionar" do card
    addToCartBtn.dataset.price = selectedData.price;
    addToCartBtn.dataset.weight = selectedData.weight;
    addToCartBtn.dataset.image = newImage;
    addToCartBtn.dataset.name = newFullName;
    } else { 
        // --- LÓGICA PARA A PÁGINA DE PRODUTO ---
        const pagePrice = document.getElementById('product-price');
        const pageOriginalPrice = document.getElementById('product-original-price');
        const pageDiscountBadge = document.getElementById('product-discount-badge');
        const pageAddToCartBtn = document.getElementById('add-to-cart-product-page');
        const pageImage = document.getElementById('main-product-image');

        // --- CORREÇÃO ESTÁ AQUI ---
        // Chamamos a função renderStockStatus com o novo valor de estoque do botão clicado.
        renderStockStatus(parseInt(selectedData.stock));

        // O resto do código para atualizar preço, imagem, etc., continua igual...
        pagePrice.textContent = formatCurrency(selectedData.price);
        if (selectedData.originalPrice && selectedData.originalPrice > 0) {
            pageOriginalPrice.textContent = formatCurrency(selectedData.originalPrice);
            pageOriginalPrice.classList.remove('hidden');
            const discount = Math.round(((selectedData.originalPrice - selectedData.price) / selectedData.originalPrice) * 100);
            pageDiscountBadge.textContent = `-${discount}%`;
            pageDiscountBadge.classList.remove('hidden');
        } else {
            pageOriginalPrice.classList.add('hidden');
            pageDiscountBadge.classList.add('hidden');
        }
        
        if (newImage && pageImage.src !== newImage) {
            pageImage.style.opacity = '0';
            setTimeout(() => {
                pageImage.src = newImage;
                pageImage.style.opacity = '1';
            }, 200);
        }
const cardName = productCard.querySelector('.product-name-display');
if (cardName && newFullName) {
    cardName.textContent = newFullName;
}
const pageName = document.getElementById('product-name');
if (pageName && newFullName) {
    pageName.textContent = newFullName;
}
        pageAddToCartBtn.dataset.price = selectedData.price;
        pageAddToCartBtn.dataset.weight = selectedData.weight;
        pageAddToCartBtn.dataset.image = newImage;
        pageAddToCartBtn.dataset.name = newFullName;
    }
}
            if (e.target.closest('.logout-btn')) handleLogout();
            if (e.target.closest('#google-login-btn')) handleSocialLogin('google');
            if (e.target.closest('#apple-login-btn')) handleSocialLogin('apple');
            if (e.target.closest('.add-to-cart-btn')) handleAddToCart(e);
            if (e.target.closest('.favorite-btn')) handleFavoriteToggle(e);

            if (e.target.closest('.remove-from-cart')) {
                const productId = e.target.closest('.remove-from-cart').dataset.id;
                state.cart = state.cart.filter(item => item.id !== productId);
                save.cart();
                updateCounters();
                renderCart();
            }
            if (e.target.closest('.quantity-change')) {
                const btn = e.target.closest('.quantity-change');
                const productId = btn.dataset.id;
                const change = parseInt(btn.dataset.change);
                const item = state.cart.find(item => item.id === productId);
                if (item) {
                    item.quantity += change;
                    if (item.quantity < 1) item.quantity = 1;
                    save.cart();
                    updateCounters();
                    renderCart();
                }
            }
            if (e.target.closest('#clear-cart-btn')) {
                if (confirm('Tem certeza que deseja limpar o carrinho?')) {
                    showAnimation('clear-cart-animation-overlay', 5800, () => {
                        state.cart = [];
                        save.cart();
                        updateCounters();
                        renderCart();
                    });
                }
            }
            if (e.target.closest('#clear-favorites-btn')) {
                if (confirm('Tem certeza que deseja limpar seus favoritos?')) {
                    showAnimation('unfavorite-animation-overlay', 1500, () => {
                        state.favorites = [];
                        save.favorites();
                        updateCounters();
                        renderFavoritesPage();
                    });
                }
            }
            if (e.target.closest('#checkout-btn')) {
                e.preventDefault();
                if (state.cart.length === 0) return alert("Seu carrinho está vazio.");
                if (!state.shipping.neighborhood) {
                    alert("Por favor, selecione uma taxa de entrega.");
                    const shippingModal = document.getElementById('shipping-modal');
                    if (shippingModal) shippingModal.style.display = 'flex';
                    return;
                }
                loadPage('checkout');
            }
            if (e.target.closest('#confirm-purchase-btn')) {
                alert('Compra confirmada com sucesso! Obrigado.');
                state.cart = [];
                state.shipping = { fee: 0, neighborhood: '' };
                save.cart();
                updateCounters();
                loadPage('home');
            }
        });

        document.body.addEventListener('submit', e => {
            if (e.target.id === 'login-form') handleLogin(e);
            if (e.target.id === 'create-account-form') handleCreateAccount(e);
        if (e.target.id === 'search-form') {
        e.preventDefault(); // Impede que a página recarregue
        const searchInput = document.getElementById('search-input');
        const searchTerm = searchInput.value.trim(); // Pega o texto e remove espaços
        const searchError = document.getElementById('search-error');

        if (!searchTerm) {
            // Se a busca estiver vazia, mostra o erro
            searchError.classList.remove('hidden');
            searchInput.classList.add('animate-shake');
            setTimeout(() => {
                searchError.classList.add('hidden');
                searchInput.classList.remove('animate-shake');
            }, 2000);
        } else {
            // Se a busca for válida, carrega a página de busca com o parâmetro
            loadPage('busca', { query: searchTerm });
            searchInput.value = ''; // Limpa a barra de busca
        }
    }
});
        
        document.addEventListener('shippingSelected', (e) => {
            state.shipping = e.detail;
            const shippingModal = document.getElementById('shipping-modal');
            if (shippingModal) shippingModal.style.display = 'none';
            updateTotals();
        });

        // --- LÓGICA COMPLETA DO CHATBOT MARRIE E PLAQUINHA ---
        const marrieButton = document.getElementById('marrie-chat-button');
        const marrieWindow = document.getElementById('marrie-chat-window');
        const marrieCloseButton = document.getElementById('marrie-chat-close');
        const chatInput = document.getElementById('marrie-chat-input');
        const chatSendButton = document.getElementById('marrie-chat-send');
        const plaqueContainer = document.getElementById('marrie-plaque-container');

        // Lógica da Plaquinha
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
        
        // Lógica de abrir/fechar janela do Chat
        if (marrieButton && marrieWindow && marrieCloseButton) {
            const toggleChatWindow = () => {
                marrieWindow.classList.toggle('active');
                if (marrieWindow.classList.contains('active')) {
                    marrieWindow.classList.remove('hidden');
                } else {
                    setTimeout(() => marrieWindow.classList.add('hidden'), 500);
                }
            };
            marrieButton.addEventListener('click', toggleChatWindow);
            marrieCloseButton.addEventListener('click', toggleChatWindow);
        }

        // Lógica de envio de mensagens do Chat
        if (chatInput && chatSendButton) {
            chatSendButton.addEventListener('click', handleSendMessage);
            chatInput.addEventListener('keypress', (event) => {
                if (event.key === 'Enter') handleSendMessage();
            });
        }
        
        // --- CARGA INICIAL ---
        updateCounters();
        await loadPage('home');
    }
    
    initializeApp();
});












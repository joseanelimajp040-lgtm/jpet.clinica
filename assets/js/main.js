import { initSlider, initComparisonSlider } from './slider.js';
import { initPageModals } from './modals.js';
import { initCartPageListeners, initCheckoutPageListeners } from './cart.js';

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
        const middle = '*'.repeat(str.length - 4);
        return `${start}${middle}${end}`;
    }

    // --- FUNÇÕES DE RENDERIZAÇÃO E ATUALIZAÇÃO DA UI ---
    function updateCounters() { /* ...código existente... */ }
    function updateLoginStatus() { /* ...código existente... */ }
    function updateTotals() { /* ...código existente... */ }
    function renderCart() { /* ...código existente... */ }
    function updateAllHeartIcons() { /* ...código existente... */ }
    function renderFavoritesPage() { /* ...código existente... */ }
    function renderCheckoutSummary() { /* ...código existente... */ }
    
    // --- LÓGICA DA AGENDA ---
    function renderCalendar() {
        const agendaGrid = document.getElementById('agenda-grid');
        if (!agendaGrid) return;
        
        agendaGrid.innerHTML = ''; // Limpa a grade antes de redesenhar
        
        const today = new Date('2025-08-07T10:00:00'); // Usando uma data fixa para consistência
        const daysOfWeek = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
        const hours = ['08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00'];
        
        // Adiciona cabeçalho dos dias
        agendaGrid.insertAdjacentHTML('beforeend', '<div></div>'); // Canto vazio
        for (let i = 0; i < 7; i++) {
            const day = new Date(today);
            day.setDate(today.getDate() + i);
            const dayName = daysOfWeek[day.getDay()];
            const dayDate = `${String(day.getDate()).padStart(2, '0')}/${String(day.getMonth() + 1).padStart(2, '0')}`;
            agendaGrid.insertAdjacentHTML('beforeend', `<div class="day-header">${dayName}<br>${dayDate}</div>`);
        }

        // Adiciona linhas de horário
        hours.forEach(hour => {
            agendaGrid.insertAdjacentHTML('beforeend', `<div class="time-label">${hour}</div>`);
            for (let i = 0; i < 7; i++) {
                const day = new Date(today);
                day.setDate(today.getDate() + i);
                const dayDate = `${String(day.getDate()).padStart(2, '0')}/${String(day.getMonth() + 1).padStart(2, '0')}`;
                
                const appointment = state.appointments.find(a => a.day === dayDate && a.time === hour);
                
                if (appointment) {
                    const appointmentData = JSON.stringify(appointment).replace(/'/g, "&apos;");
                    agendaGrid.insertAdjacentHTML('beforeend', `
                        <div class="time-slot booked" data-appointment='${appointmentData}'> 
                            <span class="booked-name">${censorString(appointment.petName)}</span> 
                            <span class="booked-status">Reservado</span> 
                        </div>`);
                } else {
                    agendaGrid.insertAdjacentHTML('beforeend', `
                        <div class="time-slot available" data-day="${dayDate}" data-time="${hour}"> 
                            <i class="fas fa-plus"></i> 
                        </div>`);
                }
            }
        });
    }

    function initBanhoTosaEventListeners() {
        const pageContainer = document.getElementById('app-root');
        if (!pageContainer) return;

        pageContainer.addEventListener('click', e => {
            const openModal = (modal) => { if (modal) modal.style.display = 'flex'; };
            const closeModal = (modal) => { if (modal) modal.style.display = 'none'; };

            // Clicou em um horário vago
            const availableSlot = e.target.closest('.time-slot.available');
            if (availableSlot) {
                if (state.loggedInUser) {
                    const day = availableSlot.dataset.day;
                    const time = availableSlot.dataset.time;
                    const bookingModal = document.getElementById('booking-modal');
                    
                    document.getElementById('booking-info').textContent = `${day} às ${time}`;
                    document.getElementById('booking-day').value = day;
                    document.getElementById('booking-time').value = time;
                    document.getElementById('booking-tutor-name').value = state.loggedInUser.fullname;
                    document.getElementById('booking-phone-number').value = state.loggedInUser.phone || '';
                    document.getElementById('booking-pet-name').value = '';

                    openModal(bookingModal);
                    document.getElementById('booking-pet-name').focus();
                } else {
                    openModal(document.getElementById('login-required-modal'));
                }
            }

            // Clicou em um horário reservado
            const bookedSlot = e.target.closest('.time-slot.booked');
            if (bookedSlot) {
                const appointment = JSON.parse(bookedSlot.dataset.appointment.replace(/&apos;/g, "'"));
                document.getElementById('details-tutor-name').textContent = censorString(appointment.tutorName);
                document.getElementById('details-pet-name').textContent = censorString(appointment.petName);
                document.getElementById('details-phone-number').textContent = censorString(appointment.phoneNumber);
                openModal(document.getElementById('appointment-details-modal'));
            }

            // Clicou no botão para redirecionar para login
            if (e.target.closest('#redirect-to-login-btn')) {
                closeModal(document.getElementById('login-required-modal'));
                loadPage('login');
            }
        });

        // Listener para o formulário de agendamento
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
                
                closeModal(document.getElementById('booking-modal'));
                showAnimation('success-animation-overlay', 1500);
                renderCalendar(); // Re-renderiza o calendário para mostrar o novo agendamento
            });
        }
    }

    // --- CARREGAMENTO DE PÁGINAS ---
    async function loadComponent(url, placeholderId) { /* ...código existente... */ }

    async function loadPage(pageName) {
        loadingOverlay.style.display = 'flex';
        try {
            const response = await fetch(`pages/${pageName}.html`);
            if (!response.ok) throw new Error(`Page ${pageName}.html not found.`);
            appRoot.innerHTML = await response.text();
            
            switch (pageName) {
                case 'home':
                    initSlider();
                    initComparisonSlider();
                    updateAllHeartIcons();
                    break;
                case 'cart':
                    renderCart();
                    initCartPageListeners();
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
                    // Essas funções agora estão definidas e serão chamadas corretamente
                    renderCalendar();
                    initBanhoTosaEventListeners();
                    break;
            }
            initPageModals();

        } catch (error) {
            console.error('Failed to load page:', error);
            appRoot.innerHTML = `<p class="text-red-500 text-center py-20">Erro ao carregar a página. Verifique o console.</p>`;
        } finally {
            setTimeout(() => loadingOverlay.style.display = 'none', 300);
            window.scrollTo(0, 0);
        }
    }

    // --- MANIPULADORES DE EVENTOS GLOBAIS ---
    function handleNavigation(e) {
        const navLink = e.target.closest('.nav-link');
        if (navLink && navLink.dataset.page) {
            e.preventDefault();
            loadPage(navLink.dataset.page);
        }
    }
    
    // --- INICIALIZAÇÃO DA APLICAÇÃO ---
    async function initializeApp() {
        await Promise.all([
            loadComponent('components/header.html', 'header-placeholder'),
            loadComponent('components/footer.html', 'footer-placeholder')
        ]);
        
        document.body.addEventListener('click', handleNavigation);

        updateLoginStatus();
        updateCounters();
        
        await loadPage('home');
    }
    
    initializeApp();
});

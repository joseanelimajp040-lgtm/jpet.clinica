// Adicionamos 'export' para que a função possa ser importada em main.js
export function initSlider() {
    const slider = document.getElementById('slider');
    if (!slider) return;

    const dots = document.querySelectorAll('.slider-dot');
    const prevSlideBtn = document.getElementById('prev-slide');
    const nextSlideBtn = document.getElementById('next-slide');
    const slideCount = slider.children.length;
    let currentIndex = 0;
    let autoPlayInterval;

    const goToSlide = (index) => {
        if (index < 0) index = slideCount - 1;
        else if (index >= slideCount) index = 0;

        const offset = index * (100 / slideCount);
        slider.style.transform = `translateX(-${offset}%)`;
        
        dots.forEach(dot => dot.classList.remove('active'));
        const currentDot = document.querySelector(`.slider-dot[data-index="${index}"]`);
        if(currentDot) currentDot.classList.add('active');
        
        currentIndex = index;
    };

    const startAutoPlay = () => {
        clearInterval(autoPlayInterval);
        autoPlayInterval = setInterval(() => goToSlide(currentIndex + 1), 5000);
    };

    const resetAutoPlay = () => {
        startAutoPlay();
    };

    nextSlideBtn.addEventListener('click', () => {
        goToSlide(currentIndex + 1);
        resetAutoPlay();
    });

    prevSlideBtn.addEventListener('click', () => {
        goToSlide(currentIndex - 1);
        resetAutoPlay();
    });

    dots.forEach(dot => {
        dot.addEventListener('click', () => {
            goToSlide(parseInt(dot.dataset.index));
            resetAutoPlay();
        });
    });

    startAutoPlay();
}

export function initComparisonSlider() {
    const container = document.getElementById('comparison-container');
    if (!container) return;

    const handle = document.getElementById('slider-handle');
    const afterWrapper = document.getElementById('after-image-wrapper');
    let isDragging = false;

    const moveSlider = (clientX) => {
        const rect = container.getBoundingClientRect();
        let x = Math.max(0, Math.min(clientX - rect.left, rect.width));
        const percentage = (x / rect.width) * 100;
        handle.style.left = `${percentage}%`;
        afterWrapper.style.width = `${percentage}%`;
    };

    const onDrag = (e) => {
        if (!isDragging) return;
        const clientX = e.type.includes('touch') ? e.touches[0].clientX : e.clientX;
        moveSlider(clientX);
    };
    
    const startDrag = (e) => { e.preventDefault(); isDragging = true; onDrag(e); };
    const stopDrag = () => { isDragging = false; };

    container.addEventListener('mousedown', startDrag);
    container.addEventListener('touchstart', startDrag, { passive: false });
    window.addEventListener('mouseup', stopDrag);
    window.addEventListener('touchend', stopDrag);
    window.addEventListener('mousemove', onDrag);
    window.addEventListener('touchmove', onDrag, { passive: false });
}
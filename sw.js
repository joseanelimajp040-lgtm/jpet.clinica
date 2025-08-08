const CACHE_NAME = 'ja-pet-clinica-cache-v1';
// Adicione aqui os arquivos principais do seu site que você quer que funcionem offline.
const urlsToCache = [
  '/',
  'index.html',
  'manifest.json',
  'assets/css/style.css',
  'assets/js/main.js',
  'assets/js/slider.js',
  'assets/js/modals.js',
  'assets/js/cart.js',
  // Adicione aqui o link para uma imagem de logo ou um 'fallback' de imagem
  'https://i.postimg.cc/W3Q0hCWZ/IMG-3941.jpg' 
];

// Evento de Instalação: Salva os arquivos no cache
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Cache aberto');
        return cache.addAll(urlsToCache);
      })
  );
});

// Evento de Fetch: Intercepta as requisições
// Se o recurso estiver no cache, entrega a partir do cache.
// Se não, busca na rede, entrega e salva uma cópia no cache.
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        if (response) {
          return response; // Retorna do cache
        }
        return fetch(event.request).then(
          response => {
            if(!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }
            const responseToCache = response.clone();
            caches.open(CACHE_NAME)
              .then(cache => {
                cache.put(event.request, responseToCache);
              });
            return response;
          }
        );
      })
  );
});
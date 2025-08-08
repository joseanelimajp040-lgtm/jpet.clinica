// sw.js - Versão Corrigida

const CACHE_NAME = 'ja-pet-clinica-cache-v2'; // Mudei a versão para forçar a atualização
const repoName = '/jpet.clinica/';

// Lista de arquivos com os caminhos completos
const urlsToCache = [
  repoName,
  `${repoName}index.html`,
  `${repoName}manifest.json`,
  `${repoName}assets/css/style.css`,
  `${repoName}assets/js/main.js`,
  `${repoName}assets/js/slider.js`,
  `${repoName}assets/js/modals.js`,
  `${repoName}assets/js/cart.js`,
  `${repoName}pages/home.html`,
  // Adicione outras páginas importantes se desejar
  // Ex: `${repoName}pages/cart.html`,
];

// Instala o Service Worker e armazena os arquivos em cache
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Cache aberto');
        return cache.addAll(urlsToCache);
      })
  );
});

// Limpa caches antigos quando um novo Service Worker é ativado
self.addEventListener('activate', event => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

// Intercepta as requisições e responde com o cache se disponível
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Se o recurso estiver no cache, retorna ele
        if (response) {
          return response;
        }
        // Se não, busca na rede
        return fetch(event.request);
      })
  );
});

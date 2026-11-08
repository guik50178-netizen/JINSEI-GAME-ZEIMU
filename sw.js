// 人生ゲーム税務台帳 Service Worker
//  - 本体(index.html)は「ネットワーク優先」: つながるときは常に最新版、オフラインならキャッシュ版を表示
//  - アイコンなどは「キャッシュ優先」、Googleフォントは「古いものを即表示しつつ裏で更新」
//  - 保存データ(localStorage)には一切触れない
const CORE_CACHE = 'jinsei-core-v1';
const FONT_CACHE = 'jinsei-fonts-v1';
const CORE = ['./', 'index.html', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png', 'icon-maskable-512.png', 'apple-touch-icon.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CORE_CACHE).then((c) => c.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('jinsei-core-') && k !== CORE_CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function fetchWithTimeout(req, ms){
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('timeout')), ms);
    fetch(req).then((res) => { clearTimeout(t); resolve(res); }, (err) => { clearTimeout(t); reject(err); });
  });
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if(req.method !== 'GET') return;
  const url = new URL(req.url);

  // 本体: ネットワーク優先(通信が遅いときは4秒でキャッシュに切り替え)
  if(url.origin === self.location.origin && (req.mode === 'navigate' || url.pathname.endsWith('/index.html'))){
    e.respondWith(
      fetchWithTimeout(req, 4000)
        .then((res) => {
          if(res && res.ok){ const copy = res.clone(); caches.open(CORE_CACHE).then((c) => c.put('index.html', copy)); }
          return res;
        })
        .catch(() => caches.match('index.html').then((hit) => hit || caches.match('./')))
    );
    return;
  }

  // 同じサイトのその他(アイコン等): キャッシュ優先
  if(url.origin === self.location.origin){
    e.respondWith(
      caches.match(req).then((hit) => hit || fetch(req).then((res) => {
        if(res && res.ok){ const copy = res.clone(); caches.open(CORE_CACHE).then((c) => c.put(req, copy)); }
        return res;
      }))
    );
    return;
  }

  // Googleフォント: 古いものを即表示しつつ、裏で更新
  if(url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com'){
    e.respondWith(
      caches.open(FONT_CACHE).then((cache) => cache.match(req).then((hit) => {
        const net = fetch(req).then((res) => {
          if(res && (res.ok || res.type === 'opaque')) cache.put(req, res.clone());
          return res;
        }).catch(() => hit);
        return hit || net;
      }))
    );
  }
});

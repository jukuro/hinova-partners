// BizCore Service Worker
// 隴・ｽｹ鬩･繝ｻ HTML繝ｻ蛹ｻ繝ｪ郢晁侭縺皮ｹ晢ｽｼ郢ｧ・ｷ郢晢ｽｧ郢晢ｽｳ繝ｻ蟲ｨ繝ｻ郢晞亂繝｣郢晏現ﾎ｡郢晢ｽｼ郢ｧ・ｯ陷・ｽｪ陷亥現縲定涕・ｸ邵ｺ・ｫ隴崢隴・ｽｰ郢ｧ雋槫徐陟募干・邵ｲ繝ｻ// 郢昜ｸ翫Ε郢ｧ・ｷ郢晢ｽ･闔牙･窶ｳ鬮ｱ蜥丞飭郢ｧ・｢郢ｧ・ｻ郢昴・繝ｨ繝ｻ繝ｻassets/...繝ｻ蟲ｨ繝ｻ邵ｺ・ｿ郢ｧ・ｭ郢晢ｽ｣郢昴・縺咏ｹ晢ｽ･邵ｺ蜷ｶ・狗ｸｲ繝ｻ// Supabase API and auth requests are never cached.
const CACHE = 'bizcore-static-v1';
const ASSET_RE = /\/assets\/.*\.(?:js|css|woff2?|png|svg|jpg|jpeg|webp)$/;

self.addEventListener('install', () => {
  // 隴・ｽｰ邵ｺ蜉ｱ・・SW 郢ｧ雋槫初隴弱ｈ諤剰怏・ｹ陋ｹ繝ｻ  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
      await self.clients.claim();
    })()
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // 陋ｻ・･郢ｧ・ｪ郢晢ｽｪ郢ｧ・ｸ郢晢ｽｳ繝ｻ繝ｻupabase / Stripe / 郢晁ｼ斐°郢晢ｽｳ郢昴・/ QR API 驕ｲ莨夲ｽｼ蟲ｨ繝ｻ邵ｺ譏ｴ繝ｻ邵ｺ・ｾ邵ｺ・ｾ鬨ｾ螢ｹ笘・  if (url.origin !== self.location.origin) return;

  // 郢晉ｿｫ繝ｳ郢ｧ・ｲ郢晢ｽｼ郢ｧ・ｷ郢晢ｽｧ郢晢ｽｳ繝ｻ繝ｻTML繝ｻ蟲ｨ繝ｻ郢晞亂繝｣郢晏現ﾎ｡郢晢ｽｼ郢ｧ・ｯ陷・ｽｪ陷亥現ﾂ竏晢ｽ､・ｱ隰ｨ邇ｲ蜃ｾ邵ｺ・ｮ邵ｺ・ｿ郢ｧ・ｭ郢晢ｽ｣郢昴・縺咏ｹ晢ｽ･
  if (request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          return await fetch(request);
        } catch {
          const cached = await caches.match('/index.html');
          return cached || Response.error();
        }
      })()
    );
    return;
  }

  // 郢昜ｸ翫Ε郢ｧ・ｷ郢晢ｽ･闔牙･窶ｳ鬮ｱ蜥丞飭郢ｧ・｢郢ｧ・ｻ郢昴・繝ｨ邵ｺ・ｯ stale-while-revalidate
  if (ASSET_RE.test(url.pathname)) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(CACHE);
        const cached = await cache.match(request);
        const network = fetch(request)
          .then((res) => {
            if (res && res.status === 200) cache.put(request, res.clone());
            return res;
          })
          .catch(() => cached);
        return cached || network;
      })()
    );
  }
});

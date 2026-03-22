/**
 * HEXARO INFRASTRUCTURE v4.0
 * PROXY + MIME FIX + LOGO CACHE
 */

export default {
  async fetch(request) {
    const url = new URL(request.url);
    const targetUrl = url.searchParams.get("url");
    if (!targetUrl) return new Response("Hexaro: Missing URL", { status: 400 });

    // Use Cloudflare's cache to stay under API limits
    const cache = caches.default;
    let response = await cache.match(request);

    if (!response) {
      response = await fetch(targetUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/124.0.0.0 Safari/537.36",
          "Referer": "https://streamed.pk/",
        }
      });

      // Clone and fix headers
      let newHeaders = new Headers(response.headers);
      newHeaders.set("Access-Control-Allow-Origin", "*");
      newHeaders.delete("X-Frame-Options");
      newHeaders.delete("Content-Security-Policy");
      
      // MIME TYPE FIX (No more fff.bin)
      const t = targetUrl.toLowerCase();
      if (t.includes('.webp')) newHeaders.set("Content-Type", "image/webp");
      else if (t.includes('.png')) newHeaders.set("Content-Type", "image/png");
      else if (t.includes('.jpg')) newHeaders.set("Content-Type", "image/jpeg");

      // Cache logos for 24 hours to save your 30 req/min quota
      if (targetUrl.includes('thesportsdb') || targetUrl.includes('badges')) {
        newHeaders.set("Cache-Control", "public, max-age=86400");
      }

      response = new Response(response.body, { status: response.status, headers: newHeaders });
      if (request.method === "GET") await cache.put(request, response.clone());
    }

    return response;
  }
};

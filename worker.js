export default {
  async fetch(request) {
    const url = new URL(request.url);
    const targetUrl = url.searchParams.get("url");

    if (!targetUrl) return new Response("Velocity Engine: Ready.", { status: 200 });

    try {
      // 1. Spoof the Request
      const response = await fetch(targetUrl, {
        method: request.method,
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
          "Referer": "https://streamed.pk/",
          "Origin": "https://streamed.pk/",
          "Accept": "*/*"
        }
      });

      // 2. Scrub the Response Headers
      const nH = new Headers(response.headers);
      
      // Force CORS and Iframe permissions
      nH.set("Access-Control-Allow-Origin", "*");
      nH.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
      
      // DELETE these - they are why your streams are blank/forbidden
      nH.delete("X-Frame-Options");
      nH.delete("Content-Security-Policy");
      nH.delete("Cross-Origin-Opener-Policy");
      nH.delete("Cross-Origin-Resource-Policy");
      nH.delete("Cross-Origin-Embedder-Policy");
      
      // Fix for 'fff.bin' and broken images
      const t = targetUrl.toLowerCase();
      if (t.includes('.webp')) nH.set("Content-Type", "image/webp");
      if (t.includes('.m3u8')) nH.set("Content-Type", "application/x-mpegURL");

      return new Response(response.body, {
        status: response.status,
        headers: nH
      });
    } catch (e) {
      return new Response("Bridge Error", { status: 500 });
    }
  }
};

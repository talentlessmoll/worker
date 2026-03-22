/**
 * HEXARO INFRASTRUCTURE v3.1
 * MIME Type & Proxy Fix
 */

export default {
  async fetch(request) {
    const url = new URL(request.url);
    const targetUrl = url.searchParams.get("url");
    if (!targetUrl) return new Response("Missing URL", { status: 400 });

    try {
      const response = await fetch(targetUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/124.0.0.0 Safari/537.36",
          "Referer": "https://streamed.pk/",
          "Origin": "https://streamed.pk/"
        }
      });

      const newHeaders = new Headers(response.headers);
      newHeaders.set("Access-Control-Allow-Origin", "*");
      newHeaders.delete("X-Frame-Options");
      newHeaders.delete("Content-Security-Policy");
      newHeaders.set("Referrer-Policy", "no-referrer");

      // FORCE CORRECT MIME TYPES (Fixes fff.bin error)
      if (targetUrl.includes('.webp')) newHeaders.set("Content-Type", "image/webp");
      if (targetUrl.includes('.png')) newHeaders.set("Content-Type", "image/png");
      if (targetUrl.includes('.jpg') || targetUrl.includes('.jpeg')) newHeaders.set("Content-Type", "image/jpeg");

      return new Response(response.body, { status: response.status, headers: newHeaders });
    } catch (e) {
      return new Response("Worker Error: " + e.message, { status: 500 });
    }
  }
};

/**
 * HEXARO INFRASTRUCTURE v3.2
 * THE FULL PROXY: Spoofing + MIME Fix + CORS
 */

export default {
  async fetch(request) {
    const url = new URL(request.url);
    const targetUrl = url.searchParams.get("url");
    if (!targetUrl) return new Response("Hexaro: No URL", { status: 400 });

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

      // FIX FOR THUMBNAILS (MIME TYPE ENFORCEMENT)
      const t = targetUrl.toLowerCase();
      if (t.includes('.webp')) newHeaders.set("Content-Type", "image/webp");
      else if (t.includes('.png')) newHeaders.set("Content-Type", "image/png");
      else if (t.includes('.jpg') || t.includes('.jpeg')) newHeaders.set("Content-Type", "image/jpeg");

      return new Response(response.body, { status: response.status, headers: newHeaders });
    } catch (e) {
      return new Response("Worker Error: " + e.message, { status: 500 });
    }
  }
};

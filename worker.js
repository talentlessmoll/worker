/**
 * HEXARO INFRASTRUCTURE v3.0
 * PROXY & HEADER STRIPPER
 */

export default {
  async fetch(request) {
    const url = new URL(request.url);
    const targetUrl = url.searchParams.get("url");

    if (!targetUrl) {
      return new Response("Hexaro Engine: No URL provided.", { status: 400 });
    }

    // Handle Preflight for Browser Security
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "*"
        }
      });
    }

    try {
      // Fetch with Spoofed Identity
      const response = await fetch(targetUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
          "Referer": "https://streamed.pk/",
          "Origin": "https://streamed.pk/"
        }
      });

      // Clone and Clean Headers
      const newHeaders = new Headers(response.headers);
      newHeaders.set("Access-Control-Allow-Origin", "*");
      newHeaders.delete("X-Frame-Options");
      newHeaders.delete("Content-Security-Policy");
      newHeaders.delete("Content-Security-Policy-Report-Only");
      
      // Fix for manifestLoadError
      newHeaders.set("Referrer-Policy", "no-referrer");

      // Cache images for 24h to stay under the 100k limit
      if (targetUrl.match(/\.(jpg|jpeg|png|webp|gif)/i)) {
        newHeaders.set("Cache-Control", "public, max-age=86400");
      }

      return new Response(response.body, {
        status: response.status,
        headers: newHeaders
      });
    } catch (e) {
      return new Response("Worker Error: " + e.message, { status: 500 });
    }
  }
};

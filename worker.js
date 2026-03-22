/**
 * HEXARO INFRASTRUCTURE v5.2
 * FIXED EXPORT STRUCTURE
 */

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const targetUrl = url.searchParams.get("url");

    // If no URL is provided, don't just crash; give a helpful response
    if (!targetUrl) {
      return new Response("Hexaro Proxy: Active. Please provide a ?url= parameter.", {
        status: 200,
        headers: { "Content-Type": "text/plain", "Access-Control-Allow-Origin": "*" }
      });
    }

    try {
      // Spoof identity to bypass bot protection
      const response = await fetch(targetUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/124.0.0.0 Safari/537.36",
          "Referer": "https://streamed.pk/",
          "Origin": "https://streamed.pk/"
        }
      });

      // Clone headers and strip security restrictions
      const nH = new Headers(response.headers);
      nH.set("Access-Control-Allow-Origin", "*");
      nH.delete("X-Frame-Options");
      nH.delete("Content-Security-Policy");
      nH.set("Referrer-Policy", "no-referrer");

      // MIME Fix for binary/fff.bin issues
      const t = targetUrl.toLowerCase();
      if (t.includes('.webp')) nH.set("Content-Type", "image/webp");
      else if (t.includes('.png')) nH.set("Content-Type", "image/png");
      else if (t.includes('.jpg') || t.includes('.jpeg')) nH.set("Content-Type", "image/jpeg");

      return new Response(response.body, {
        status: response.status,
        headers: nH
      });
    } catch (e) {
      return new Response("Hexaro Worker Error: " + e.message, { 
        status: 500,
        headers: { "Access-Control-Allow-Origin": "*" }
      });
    }
  }
};

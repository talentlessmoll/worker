/**
 * HEXARO ENGINE v4.1
 * THE SMART TUNNEL
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
        }
      });

      const nH = new Headers(response.headers);
      nH.set("Access-Control-Allow-Origin", "*");
      nH.delete("X-Frame-Options");
      nH.delete("Content-Security-Policy");
      nH.set("Referrer-Policy", "no-referrer");

      // MIME Fix for binary issues
      const t = targetUrl.toLowerCase();
      if (t.includes('.webp')) nH.set("Content-Type", "image/webp");
      else if (t.includes('.png')) nH.set("Content-Type", "image/png");
      else if (t.includes('.jpg')) nH.set("Content-Type", "image/jpeg");

      return new Response(response.body, { status: response.status, headers: nH });
    } catch (e) {
      return new Response("Hexaro Worker Error", { status: 500 });
    }
  }
};

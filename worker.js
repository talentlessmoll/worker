export default {
  async fetch(request) {
    const url = new URL(request.url);
    const targetUrl = url.searchParams.get("url");

    if (!targetUrl) {
      return new Response("Hexaro Heavy Proxy Active.", { status: 200 });
    }

    // Handle Preflight for big-match player scripts
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
      // THE FIX: We must spoof the Referer for the VIDEO as well as the API
      const response = await fetch(targetUrl, {
        method: request.method,
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
          "Referer": "https://streamed.pk/",
          "Origin": "https://streamed.pk/"
        },
        body: request.method === "POST" ? await request.blob() : null
      });

      const nH = new Headers(response.headers);
      nH.set("Access-Control-Allow-Origin", "*");
      
      // Strip the security headers that cause the "Forbidden" or "Blocked" message in iframes
      nH.delete("X-Frame-Options");
      nH.delete("Content-Security-Policy");
      nH.delete("Content-Security-Policy-Report-Only");

      return new Response(response.body, {
        status: response.status,
        headers: nH
      });
    } catch (e) {
      return new Response("Proxy Error: " + e.message, { status: 500 });
    }
  }
};

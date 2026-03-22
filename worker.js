export default {
  async fetch(request) {
    const url = new URL(request.url);
    const targetUrl = url.searchParams.get("url");

    // Health check for the worker URL
    if (!targetUrl) return new Response("Velocity Engine v6: Online.", { status: 200 });

    try {
      // THE SECRET SAUCE: Spoofing the identity and following redirects
      const response = await fetch(targetUrl, {
        method: request.method,
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
          "Referer": "https://streamed.pk/",
          "Origin": "https://streamed.pk/",
          "Accept": "*/*"
        },
        redirect: "follow", // Crucial for big-match server hops
        body: request.method === "POST" ? await request.blob() : null
      });

      // Clone and sanitize the response headers
      const nH = new Headers(response.headers);
      nH.set("Access-Control-Allow-Origin", "*");
      
      // Delete the "Handcuffs" - these cause the Forbidden/Blank screens
      const blackList = [
        "X-Frame-Options", 
        "Content-Security-Policy", 
        "Content-Security-Policy-Report-Only",
        "Cross-Origin-Opener-Policy",
        "Cross-Origin-Resource-Policy"
      ];
      blackList.forEach(h => nH.delete(h));

      // Force MIME types for sports streams
      if (targetUrl.includes('.m3u8')) nH.set("Content-Type", "application/x-mpegURL");

      return new Response(response.body, {
        status: response.status,
        headers: nH
      });
    } catch (e) {
      return new Response("Bridge Error: " + e.message, { status: 500 });
    }
  }
};

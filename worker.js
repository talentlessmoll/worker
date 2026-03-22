export default {
  async fetch(request) {
    const url = new URL(request.url);
    const targetUrl = url.searchParams.get("url");

    if (!targetUrl) return new Response("Velocity Engine: Online.", { status: 200 });

    try {
      // THE FIX: Added 'redirect: "follow"' to chase the stream across servers
      const response = await fetch(targetUrl, {
        method: request.method,
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
          "Referer": "https://streamed.pk/",
          "Origin": "https://streamed.pk/",
        },
        redirect: "follow" 
      });

      const nH = new Headers(response.headers);
      nH.set("Access-Control-Allow-Origin", "*");
      
      // Nuclear header strip - remove EVERYTHING that stops iframes
      nH.delete("X-Frame-Options");
      nH.delete("Content-Security-Policy");
      nH.delete("Content-Security-Policy-Report-Only");
      nH.delete("Cross-Origin-Opener-Policy");
      nH.delete("Cross-Origin-Resource-Policy");
      nH.delete("Cross-Origin-Embedder-Policy");

      return new Response(response.body, {
        status: response.status,
        headers: nH
      });
    } catch (e) {
      return new Response("Bridge Error: " + e.message, { status: 500 });
    }
  }
};

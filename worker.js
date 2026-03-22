export default {
  async fetch(request) {
    const url = new URL(request.url);
    const targetUrl = url.searchParams.get("url");

    if (!targetUrl) {
      return new Response("Hexaro Ghost Proxy Active.", {
        status: 200, headers: { "Access-Control-Allow-Origin": "*" }
      });
    }

    try {
      const response = await fetch(targetUrl, {
        method: request.method,
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
          "Referer": "https://streamed.pk/",
          "Origin": "https://streamed.pk/",
          "Accept": "*/*"
        },
        redirect: "follow", 
        body: request.method === "POST" ? await request.blob() : null
      });

      const nH = new Headers(response.headers);
      nH.set("Access-Control-Allow-Origin", "*");
      
      // Strip the security "Handcuffs"
      const blackList = [
        "X-Frame-Options", 
        "Content-Security-Policy", 
        "Content-Security-Policy-Report-Only",
        "Cross-Origin-Opener-Policy",
        "Cross-Origin-Resource-Policy",
        "Cross-Origin-Embedder-Policy"
      ];
      blackList.forEach(h => nH.delete(h));

      return new Response(response.body, { status: response.status, headers: nH });
    } catch (e) {
      return new Response("Proxy Error", { status: 500 });
    }
  }
};

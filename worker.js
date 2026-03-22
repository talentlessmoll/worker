export default {
  async fetch(request) {
    const url = new URL(request.url);
    const targetUrl = url.searchParams.get("url");

    if (!targetUrl) {
      return new Response("Hexaro Velocity Proxy Active.", {
        status: 200, headers: { "Access-Control-Allow-Origin": "*" }
      });
    }

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

      return new Response(response.body, { status: response.status, headers: nH });
    } catch (e) {
      return new Response("Proxy Error", { status: 500 });
    }
  }
};

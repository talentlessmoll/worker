export default {
  async fetch(request) {
    const url = new URL(request.url);
    const targetUrl = url.searchParams.get("url");
    if (!targetUrl) return new Response("API Bridge Active", { status: 200 });

    const response = await fetch(targetUrl, {
      headers: { 
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/124.0.0.0",
        "Referer": "https://streamed.pk/" 
      }
    });

    const nH = new Headers(response.headers);
    nH.set("Access-Control-Allow-Origin", "*");
    return new Response(response.body, { status: response.status, headers: nH });
  }
};

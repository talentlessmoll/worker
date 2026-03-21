export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    
    // Handle stream proxying
    const streamUrl = url.searchParams.get('url');
    if (streamUrl) {
      console.log('Proxying stream:', streamUrl);
      try {
        const response = await fetch(streamUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
          }
        });
        console.log('Proxy response status:', response.status);
        const newHeaders = new Headers(response.headers);
        newHeaders.set("Access-Control-Allow-Origin", "*");
        newHeaders.delete("X-Frame-Options"); // Kill the block
        newHeaders.delete("Content-Security-Policy"); // Kill the security wall
        newHeaders.set("Referrer-Policy", "no-referrer");

        return new Response(response.body, { status: response.status, headers: newHeaders });
      } catch (error) {
        console.error('Proxy failed:', error);
        return new Response("Proxy Failed", { status: 500 });
      }
    }

    // Handle API requests
    if (url.pathname === '/api/sports') {
      const category = url.searchParams.get('category') || 'live';
      const categoryMap = {
        'All Sports': 'live',
        'Soccer': 'football',
        'Basketball': 'basketball',
        'Tennis': 'tennis',
        'UFC': 'mma'
      };
      
      const targetCategory = categoryMap[category] || 'live';
      const targetUrl = `https://streamed.pk/api/matches/${targetCategory}`;
      
      try {
        const response = await fetch(targetUrl);
        const data = await response.json();
        
        // Return JSON with CORS headers to allow your frontend to fetch it
        return new Response(JSON.stringify(data), {
          headers: {
            'content-type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        });
      } catch (error) {
        return new Response(JSON.stringify({ error: "Failed to fetch" }), { status: 500 });
      }
    }
    
    return new Response("Not Found", { status: 404 });
  }
};

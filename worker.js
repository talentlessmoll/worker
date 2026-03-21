export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    
    // Handle stream proxying
    const streamUrl = url.searchParams.get('url');
    if (streamUrl) {
      try {
        const response = await fetch(streamUrl);
        const newHeaders = new Headers(response.headers);
        newHeaders.set("Access-Control-Allow-Origin", "*");
        newHeaders.delete("X-Frame-Options"); // Kill the block
        newHeaders.delete("Content-Security-Policy"); // Kill the security wall
        newHeaders.set("Referrer-Policy", "no-referrer");

        return new Response(response.body, { status: response.status, headers: newHeaders });
      } catch (error) {
        return new Response("Proxy Failed", { status: 500 });
      }
    }

    // Handle API requests
    if (url.pathname === '/api/sports') {
      const category = url.searchParams.get('category') || 'All Sports';
      const urls = {
        'All Sports': 'https://site.api.espn.com/apis/site/v2/sports/soccer/all/scoreboard',
        'Soccer': 'https://site.api.espn.com/apis/site/v2/sports/soccer/all/scoreboard',
        'Basketball': 'https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard',
        'Tennis': 'https://site.api.espn.com/apis/site/v2/sports/tennis/atp/scoreboard',
        'UFC': 'https://site.api.espn.com/apis/site/v2/sports/mma/ufc/scoreboard'
      };
      
      const targetUrl = urls[category] || urls['All Sports'];
      
      try {
        const response = await fetch(targetUrl);
        const data = await response.json();
        
        // Return JSON with CORS headers to allow your frontend to fetch it
        return new Response(JSON.stringify(data), {
          headers: {
            'content-type': 'application/json',
            'Access-Control-Allow-Origin': '*', // Adjust to your domain
          },
        });
      } catch (error) {
        return new Response(JSON.stringify({ error: "Failed to fetch" }), { status: 500 });
      }
    }
    
    return new Response("Not Found", { status: 404 });
  }
};

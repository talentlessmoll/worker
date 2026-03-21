export default {hhhhhhhhhhhh
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    
    // Only handle API requests
    if (url.pathname === '/api/sports') {
      const category = url.searchParams.get('category') || 'All Sports';
      const urls = {
        'All Sports': 'https://site.api.espn.com/apis/site/v2/sports/soccer/all/scoreboard',
        'Football': 'https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard',
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

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
      const category = url.searchParams.get('category');
      
      try {
        if (!category || category === 'All Sports') {
          const response = await fetch('https://streamed.pk/api/matches/all');
          const data = await response.json();
          return new Response(JSON.stringify(data), {
            headers: { 'content-type': 'application/json', 'Access-Control-Allow-Origin': '*' },
          });
        } else {
          // Fetch the list of sports to get the ID
          const sportsResponse = await fetch('https://streamed.pk/api/sports');
          const sports = await sportsResponse.json();
          
          // Handle 'Soccer' mapping to 'football'
          let sportName = category;
          if (category === 'Soccer') sportName = 'Football';
          
          const sport = sports.find((s) => s.name.toLowerCase() === sportName.toLowerCase());
          
          if (!sport) {
            return new Response(JSON.stringify({ error: "Sport not found" }), { status: 404 });
          }

          const matchesResponse = await fetch(`https://streamed.pk/api/matches/${sport.id}`);
          const data = await matchesResponse.json();
          return new Response(JSON.stringify(data), {
            headers: { 'content-type': 'application/json', 'Access-Control-Allow-Origin': '*' },
          });
        }
      } catch (error) {
        console.error('API fetch failed:', error);
        return new Response(JSON.stringify({ error: "Failed to fetch" }), { status: 500 });
      }
    } else if (url.pathname.startsWith('/api/stream/')) {
      const matchId = url.pathname.split('/').pop();
      try {
        const response = await fetch(`https://streamed.pk/api/match/${matchId}`);
        
        const contentType = response.headers.get("content-type");
        if (!contentType || !contentType.includes("application/json")) {
          const text = await response.text();
          console.error(`Stream fetch returned non-JSON (status ${response.status}): ${text.substring(0, 100)}`);
          return new Response(JSON.stringify({ error: "API returned non-JSON", status: response.status, text: text.substring(0, 100) }), { status: 500 });
        }

        const data = await response.json();
        return new Response(JSON.stringify(data), {
          headers: { 'content-type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        });
      } catch (error) {
        console.error('Stream fetch failed:', error);
        return new Response(JSON.stringify({ error: "Failed to fetch stream" }), { status: 500 });
      }
    }
    
    return new Response("Not Found", { status: 404 });
  }
};

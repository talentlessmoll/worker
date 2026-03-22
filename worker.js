/**
 * HEXARO INFRASTRUCTURE - BACKEND ENGINE v2.1
 * Purpose: CORS Bypass, Referer Spoofing, and Header Stripping
 */

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const targetUrl = url.searchParams.get("url");

    // 1. Handle CORS Preflight (Browser "Check-in")
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "*",
          "Access-Control-Max-Age": "86400",
        },
      });
    }

    if (!targetUrl) {
      return new Response("Hexaro Error: Missing 'url' parameter.", { status: 400 });
    }

    try {
      // 2. The Spoofing: Make the request look like it's from the source
      const modifiedRequest = new Request(targetUrl, {
        method: request.method,
        headers: {
          ...Object.fromEntries(request.headers),
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
          "Referer": "https://streamed.pk/",
          "Origin": "https://streamed.pk/",
        },
        body: request.body,
        redirect: "follow",
      });

      const response = await fetch(modifiedRequest);

      // 3. The Stripping: Kill the headers that cause "Refused to Connect" or "Manifest Errors"
      const newHeaders = new Headers(response.headers);
      
      // Allow your frontend to read the data
      newHeaders.set("Access-Control-Allow-Origin", "*");
      newHeaders.set("Access-Control-Expose-Headers", "*");
      
      // CRITICAL: Remove headers that prevent embedding in an iframe
      newHeaders.delete("X-Frame-Options");
      newHeaders.delete("Content-Security-Policy");
      newHeaders.delete("Content-Security-Policy-Report-Only");
      
      // Fix for manifestLoadError: Tell the browser to forget the referrer for this specific stream
      newHeaders.set("Referrer-Policy", "no-referrer");

      // 4. Return the cleaned response
      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: newHeaders,
      });

    } catch (e) {
      return new Response("Hexaro Engine Critical Failure: " + e.message, { 
        status: 500,
        headers: { "Access-Control-Allow-Origin": "*" } 
      });
    }
  },
};

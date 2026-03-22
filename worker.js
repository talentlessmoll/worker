function renderGrid(data) {
    const grid = document.getElementById('grid');
    if (data.length === 0) { 
        grid.innerHTML = '<div class="loading-msg">NO MATCHES CURRENTLY ACTIVE</div>'; 
        return; 
    }

    grid.innerHTML = data.map(m => {
        // Start with the API's team objects
        let homeName = m.teams?.home?.name;
        let awayName = m.teams?.away?.name;

        // If team objects are missing/empty, we hunt the title string
        if (!homeName || homeName.toLowerCase() === 'home') {
            // Split by: " vs ", " vs. ", " - ", or " @ " (case insensitive)
            const parts = m.title.split(/\s+vs\.?\s+|\s+-\s+|\s+@\s+/i);
            
            if (parts.length >= 2) {
                homeName = parts[0].trim();
                awayName = parts[1].trim();
            } else {
                // If no separator exists (e.g. "UFC 300" or "LIV Golf")
                homeName = m.title;
                awayName = null; 
            }
        }
        
        const isLive = m.category === 'live';
        const matchDate = new Date(m.date);
        const formattedTime = matchDate.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
        
        const timeStatus = isLive ? `<span class="live-dot">● LIVE</span>` : `<span>${formattedTime}</span>`;
        
        // Render one centered name if it's a solo event, otherwise do the VS layout
        const teamDisplay = awayName 
            ? `<span>${homeName}</span> <span class="vs">vs</span> <span>${awayName}</span>`
            : `<span style="display:block; width:100%; text-align:center;">${homeName}</span>`;

        return `
            <div class="card">
                <div class="card-meta">
                    <span>${m.category.toUpperCase()}</span>
                    ${timeStatus}
                </div>
                <div class="card-teams">
                    ${teamDisplay}
                </div>
                <button class="btn" onclick="watchClick('${m.id}')">WATCH BROADCAST</button>
            </div>
        `;
    }).join('');
}

    function renderGrid(data) {
        const grid = document.getElementById('grid');
        if (data.length === 0) { grid.innerHTML = '<div class="loading-msg">NO MATCHES CURRENTLY ACTIVE</div>'; return; }

        grid.innerHTML = data.map(m => {
            let homeName = m.teams?.home?.name;
            let awayName = m.teams?.away?.name;

            // FIX: If the API is being lazy and didn't provide team objects, parse the title
            if (!homeName || !awayName) {
                if (m.title.toLowerCase().includes(' vs ')) {
                    const parts = m.title.split(/ vs /i);
                    homeName = parts[0].trim();
                    awayName = parts[1].trim();
                } else {
                    // For single events like "LIV Golf" or "UFC 300"
                    homeName = m.title;
                    awayName = null; 
                }
            }
            
            const isLive = m.category === 'live';
            const matchDate = new Date(m.date);
            const formattedTime = matchDate.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
            
            let timeStatus = isLive ? `<span class="live-dot">● LIVE</span>` : `<span>${formattedTime}</span>`;
            
            // Build the team display HTML
            let teamDisplay = awayName 
                ? `<span>${homeName}</span> <span class="vs">vs</span> <span>${awayName}</span>`
                : `<span>${homeName}</span>`;

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

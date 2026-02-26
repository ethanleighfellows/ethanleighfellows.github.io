const fs = require('fs');
const https = require('https');

const TEAM_ID = 8602;
const DATA_FILE = 'js/football_data.js';

async function updateFootballData() {
    console.log("Fetching football data for Wolves (8602)...");
    
    try {
        const data = await fetchData(`https://www.fotmob.com/api/teams?id=${TEAM_ID}`);
        
        const nextMatch = data.overview.nextMatch;
        const nextMatchStr = nextMatch ? `${nextMatch.opponent.name} (${new Date(nextMatch.status.utcTime).toLocaleString()})` : "No upcoming matches";
        
        // Find Wolves in the table
        let points = "N/A";
        let form = [];
        if (data.overview.table && data.overview.table.length > 0) {
            const table = data.overview.table[0].data.table.all;
            const wolvesRow = table.find(t => t.id === TEAM_ID);
            if (wolvesRow) {
                points = wolvesRow.pts;
                // Form is usually a string like "WWDLL" or an array
                form = wolvesRow.form || []; 
            }
        }

        const topScorer = data.overview.topPlayers.byGoals.players[0] ? `${data.overview.topPlayers.byGoals.players[0].name} (${data.overview.topPlayers.byGoals.players[0].value})` : "N/A";
        const topAssister = data.overview.topPlayers.byAssists.players[0] ? `${data.overview.topPlayers.byAssists.players[0].name} (${data.overview.topPlayers.byAssists.players[0].value})` : "N/A";

        const footballData = {
            updated_at: new Date().toISOString().split('T')[0],
            team: "Wolverhampton Wanderers",
            nextMatch: nextMatchStr,
            points: points,
            form: form,
            topScorer: topScorer,
            topAssister: topAssister
        };

        const content = `// Automatically updated football data
window.FOOTBALL_DATA = ${JSON.stringify(footballData, null, 4)};`;

        fs.writeFileSync(DATA_FILE, content);
        console.log(`Successfully updated ${DATA_FILE}`);

    } catch (error) {
        console.error("Error updating football data:", error.message);
    }
}

function fetchData(url) {
    return new Promise((resolve, reject) => {
        const options = {
            headers: { 'User-Agent': 'Mozilla/5.0' }
        };
        https.get(url, options, (res) => {
            let body = '';
            res.on('data', d => body += d);
            res.on('end', () => resolve(JSON.parse(body)));
        }).on('error', reject);
    });
}

updateFootballData();

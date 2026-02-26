const fs = require('fs');
const https = require('https');

const TEAM_ID = 8602;
const YOUTUBE_CHANNEL_ID = 'UCQ7Lqg5Czh5djGK6iOG53KQ';
const DATA_FILE = 'js/football_data.js';

async function updateFootballData() {
    console.log("Fetching football and video data for Wolves...");
    
    try {
        // 1. Fetch FotMob Data
        const teamData = await fetchData(`https://www.fotmob.com/api/teams?id=${TEAM_ID}`);
        
        const nextMatch = teamData.overview.nextMatch;
        const nextMatchStr = nextMatch ? `${nextMatch.opponent.name} (${new Date(nextMatch.status.utcTime).toLocaleString()})` : "No upcoming matches";
        
        let points = "N/A";
        if (teamData.overview.table && teamData.overview.table.length > 0) {
            const table = teamData.overview.table[0].data.table.all;
            const wolvesRow = table.find(t => t.id === TEAM_ID);
            if (wolvesRow) {
                points = wolvesRow.pts;
            }
        }

        // 2. Get Form from Fixtures
        let form = [];
        try {
            const allFixtures = teamData.fixtures.allFixtures.fixtures;
            if (Array.isArray(allFixtures)) {
                form = allFixtures
                    .filter(f => f.status && f.status.finished)
                    .slice(-5)
                    .map(f => {
                        if (f.result === 1) return 'W';
                        if (f.result === -1) return 'L';
                        return 'D';
                    });
            }
        } catch (fError) {
            console.error("Error parsing form:", fError.message);
        }

        const topScorer = teamData.overview.topPlayers.byGoals.players[0] ? `${teamData.overview.topPlayers.byGoals.players[0].name} (${teamData.overview.topPlayers.byGoals.players[0].value})` : "N/A";
        const topAssister = teamData.overview.topPlayers.byAssists.players[0] ? `${teamData.overview.topPlayers.byAssists.players[0].name} (${teamData.overview.topPlayers.byAssists.players[0].value})` : "N/A";

        // 3. Fetch Latest YouTube Video via RSS (Excluding Shorts)
        let latestVideo = { title: "N/A", link: "#" };
        try {
            const rssXml = await fetchDataStr(`https://www.youtube.com/feeds/videos.xml?channel_id=${YOUTUBE_CHANNEL_ID}`);
            
            // YouTube RSS feed lists entries in order. 
            // We'll split by entries and find the first one that isn't a short.
            const entries = rssXml.split('<entry>');
            for (let i = 1; i < entries.length; i++) {
                const entry = entries[i];
                const linkMatch = entry.match(/<link rel="alternate" href="([^"]+)"/);
                const titleMatch = entry.match(/<title>([^<]+)<\/title>/);
                
                if (linkMatch && titleMatch) {
                    const link = linkMatch[1];
                    // Exclude links that contain "/shorts/"
                    if (!link.includes('/shorts/')) {
                        latestVideo = {
                            title: titleMatch[1],
                            link: link
                        };
                        break; // Stop at the first non-short video
                    }
                }
            }
        } catch (vError) {
            console.error("Error fetching YouTube RSS:", vError.message);
        }

        const footballData = {
            updated_at: new Date().toISOString().split('T')[0],
            team: "Wolverhampton Wanderers",
            nextMatch: nextMatchStr,
            points: points,
            form: form,
            topScorer: topScorer,
            topAssister: topAssister,
            latestVideo: latestVideo
        };

        const content = `// Automatically updated football data
window.FOOTBALL_DATA = ${JSON.stringify(footballData, null, 4)};`;

        fs.writeFileSync(DATA_FILE, content);
        console.log(`Successfully updated ${DATA_FILE} with form: ${form.join(', ')}`);

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
            res.on('end', () => {
                try {
                    resolve(JSON.parse(body));
                } catch (e) {
                    reject(new Error("Failed to parse JSON response"));
                }
            });
        }).on('error', reject);
    });
}

function fetchDataStr(url) {
    return new Promise((resolve, reject) => {
        const options = {
            headers: { 'User-Agent': 'Mozilla/5.0' }
        };
        https.get(url, options, (res) => {
            let body = '';
            res.on('data', d => body += d);
            res.on('end', () => resolve(body));
        }).on('error', reject);
    });
}

updateFootballData();

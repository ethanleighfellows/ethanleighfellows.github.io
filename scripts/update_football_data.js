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
        let form = [];
        if (teamData.overview.table && teamData.overview.table.length > 0) {
            const table = teamData.overview.table[0].data.table.all;
            const wolvesRow = table.find(t => t.id === TEAM_ID);
            if (wolvesRow) {
                points = wolvesRow.pts;
                form = wolvesRow.form || []; 
            }
        }

        const topScorer = teamData.overview.topPlayers.byGoals.players[0] ? `${teamData.overview.topPlayers.byGoals.players[0].name} (${teamData.overview.topPlayers.byGoals.players[0].value})` : "N/A";
        const topAssister = teamData.overview.topPlayers.byAssists.players[0] ? `${teamData.overview.topPlayers.byAssists.players[0].name} (${teamData.overview.topPlayers.byAssists.players[0].value})` : "N/A";

        // 2. Fetch Latest YouTube Video via RSS
        let latestVideo = { title: "N/A", link: "#" };
        try {
            const rssXml = await fetchDataStr(`https://www.youtube.com/feeds/videos.xml?channel_id=${YOUTUBE_CHANNEL_ID}`);
            // Simple XML parsing for title and link of first entry
            const titleMatch = rssXml.match(/<entry>[\s\S]*?<title>([^<]+)<\/title>/);
            const linkMatch = rssXml.match(/<entry>[\s\S]*?<link rel="alternate" href="([^"]+)"/);
            
            if (titleMatch && linkMatch) {
                latestVideo = {
                    title: titleMatch[1],
                    link: linkMatch[1]
                };
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

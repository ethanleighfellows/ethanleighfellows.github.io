const fs = require('fs');
const https = require('https');

// Configuration
const CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;
const REFRESH_TOKEN = process.env.SPOTIFY_REFRESH_TOKEN;
const DATA_FILE = 'js/spotify_data.js';

// Fallback Tracks (The ones requested for validation)
const FALLBACK_TRACKS = [
    { id: '4WjEY877D3AgyMLqMKrUsV', name: 'Parsifal: Prelude', artist: 'Richard Wagner' },
    { id: '7pyDecU8b4zIVuNv6YdI0q', name: 'Requiem, Op. 48: In Paradisum', artist: 'Gabriel Fauré' },
    { id: '6bDd1ETtj3yBcTuCYMxSmM', name: 'Psalm 104', artist: 'Poor Bishop Hooper' },
    { id: '4RqW6FZXZLUrndtWNaMGAf', name: 'Turandot: Nessun dorma!', artist: 'Giacomo Puccini' },
    { id: '1lWoPg6qu3RNLeXkt1OPmh', name: 'The Isle of the Dead, Op. 29', artist: 'Sergei Rachmaninoff' }
];

async function updateData() {
    let tracks = FALLBACK_TRACKS;

    if (CLIENT_ID && CLIENT_SECRET && REFRESH_TOKEN) {
        console.log("Found Refresh Token, fetching dynamic top tracks...");
        try {
            // 1. Get Access Token
            const tokenResponse = await fetchToken(CLIENT_ID, CLIENT_SECRET, REFRESH_TOKEN);
            const accessToken = tokenResponse.access_token;
            
            // 2. Fetch User's Top Tracks
            const topTracks = await fetchTopTracks(accessToken);
            if (topTracks && topTracks.items && topTracks.items.length > 0) {
                tracks = topTracks.items.slice(0, 5).map(item => ({
                    id: item.id,
                    name: item.name,
                    artist: item.artists[0].name
                }));
            } else {
                console.warn("API returned successfully, but top tracks were empty. Using fallback tracks. Response:", JSON.stringify(topTracks));
            }
        } catch (error) {
            console.error("Error fetching dynamic tracks, using fallback:", error.message);
        }
    } else {
        console.log("No Refresh Token provided. Using hardcoded validation tracks.");
    }

    // Write to js/spotify_data.js
    const content = `// This file is automatically updated via a background process to keep Spotify data fresh without exposing credentials.
window.SPOTIFY_DATA = {
    updated_at: "${new Date().toISOString().split('T')[0]}",
    tracks: ${JSON.stringify(tracks, null, 8)}
};`;

    fs.writeFileSync(DATA_FILE, content);
    console.log(`Successfully updated ${DATA_FILE} with ${tracks.length} tracks.`);
}

function fetchToken(clientId, clientSecret, refreshToken) {
    return new Promise((resolve, reject) => {
        const data = `grant_type=refresh_token&refresh_token=${refreshToken}`;
        const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
        
        const options = {
            hostname: 'accounts.spotify.com',
            path: '/api/token',
            method: 'POST',
            headers: {
                'Authorization': `Basic ${auth}`,
                'Content-Type': 'application/x-www-form-urlencoded',
                'Content-Length': data.length
            }
        };

        const req = https.request(options, (res) => {
            let body = '';
            res.on('data', d => body += d);
            res.on('end', () => {
                try {
                    const parsed = JSON.parse(body);
                    if (res.statusCode >= 400) {
                        reject(new Error(`Spotify Token API Error (${res.statusCode}): ${body}`));
                    } else if (parsed.error) {
                        reject(new Error(`Spotify Token API Error: ${parsed.error} - ${parsed.error_description}`));
                    } else {
                        resolve(parsed);
                    }
                } catch (e) {
                    reject(new Error(`Failed to parse token response: ${e.message}`));
                }
            });
        });

        req.on('error', reject);
        req.write(data);
        req.end();
    });
}

function fetchTopTracks(accessToken) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'api.spotify.com',
            path: '/v1/me/top/tracks?time_range=short_term&limit=5',
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${accessToken}`
            }
        };

        const req = https.request(options, (res) => {
            let body = '';
            res.on('data', d => body += d);
            res.on('end', () => {
                try {
                    const parsed = JSON.parse(body);
                    if (res.statusCode >= 400) {
                        reject(new Error(`Spotify Top Tracks API Error (${res.statusCode}): ${body}`));
                    } else if (parsed.error) {
                        reject(new Error(`Spotify Top Tracks API Error: ${parsed.error.message}`));
                    } else {
                        resolve(parsed);
                    }
                } catch (e) {
                    reject(new Error(`Failed to parse top tracks response: ${e.message}`));
                }
            });
        });

        req.on('error', reject);
        req.end();
    });
}

updateData();

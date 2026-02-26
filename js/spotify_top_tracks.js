/**
 * Spotify Top Tracks Module
 * Dynamically renders the most listened tracks using data enriched via Spotify API.
 * To keep the client secret safe, data is updated via GitHub Actions into spotify_data.js.
 */

const DEFAULT_TRACKS = [
    { id: '6OakIaj4T039vJ8V2AJiWa', name: 'History (feat. James Blake)', artist: 'Dave' },
    { id: '0ylPYJtAJmAMr9jdPQ3cF7', name: 'This Is The Last Time', artist: 'Keane' },
    { id: '1A1BitAAJBXl2wpUaDnYc5', name: 'Torturous', artist: 'Turnerjoy' },
    { id: '7454StFiLI0EMexuqtvNv4', name: 'Psycho', artist: 'Dave' },
    { id: '6zfczP87XO2SxWlQtnjFNa', name: 'The Look', artist: 'Metronomy' }
];

function renderSpotifyTracks() {
    const listContainer = document.getElementById('music-tracks-list');
    if (!listContainer) return;

    // Use data from spotify_data.js if available (populated by GitHub Actions)
    const tracks = (window.SPOTIFY_DATA && window.SPOTIFY_DATA.tracks) || DEFAULT_TRACKS;

    listContainer.innerHTML = '';

    tracks.forEach((track, index) => {
        const trackElement = document.createElement('div');
        trackElement.className = 'track-item';
        trackElement.innerHTML = `
            <div class="track-index">#${index + 1}</div>
            <div class="track-info">
                <div class="track-name">${track.name}</div>
                <div class="track-artist">${track.artist}</div>
                <div class="track-player">
                    <iframe 
                        src="https://open.spotify.com/embed/track/${track.id}?utm_source=generator&theme=0" 
                        width="100%" 
                        height="80" 
                        frameBorder="0" 
                        allowfullscreen="" 
                        allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" 
                        loading="lazy">
                    </iframe>
                </div>
            </div>
        `;
        listContainer.appendChild(trackElement);
    });
}

// Initialize when the DOM is ready or when the app is launched
document.addEventListener('DOMContentLoaded', renderSpotifyTracks);

// Also expose to the window so it can be re-triggered if needed
window.refreshMusicList = renderSpotifyTracks;

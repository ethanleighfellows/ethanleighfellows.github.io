/**
 * Spotify Top Tracks Module
 * Dynamically renders the most listened tracks using data enriched via Spotify API.
 * To keep the client secret safe, data is updated via GitHub Actions into spotify_data.js.
 */

const DEFAULT_TRACKS = [
    { id: '4WjEY877D3AgyMLqMKrUsV', name: 'Parsifal: Prelude', artist: 'Richard Wagner' },
    { id: '7pyDecU8b4zIVuNv6YdI0q', name: 'Requiem, Op. 48: In Paradisum', artist: 'Gabriel Fauré' },
    { id: '6bDd1ETtj3yBcTuCYMxSmM', name: 'Psalm 104', artist: 'Poor Bishop Hooper' },
    { id: '4RqW6FZXZLUrndtWNaMGAf', name: 'Turandot: Nessun dorma!', artist: 'Giacomo Puccini' },
    { id: '1lWoPg6qu3RNLeXkt1OPmh', name: 'The Isle of the Dead, Op. 29', artist: 'Sergei Rachmaninoff' }
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
                <div style="display: flex; align-items: center; justify-content: space-between;">
                    <div class="track-name">${track.name}</div>
                    <div class="visualizer">
                        <div class="visualizer-bar"></div>
                        <div class="visualizer-bar"></div>
                        <div class="visualizer-bar"></div>
                        <div class="visualizer-bar"></div>
                    </div>
                </div>
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

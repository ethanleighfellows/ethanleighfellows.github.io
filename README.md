# ethanleighfellows.github.io

A highly interactive, macOS-inspired personal portfolio and retro arcade platform.

## 🚀 Live Demo
[https://ethanleighfellows.github.io/](https://ethanleighfellows.github.io/)

## 🛠 Features

### 🖥️ macOS-Style Desktop Environment
*   **Window Management:** A custom-built window manager supporting active states, z-index layering, and smooth animations.
*   **Universal Search:** A status-bar integrated language switcher (English, French, Russian) and dynamic system stats.
*   **Mobile-First Design:** A dedicated responsive mode that transforms the windowed environment into a full-screen card system with a glassmorphism dock.

### 🎵 Secure Spotify Integration
*   **Dynamic Music Hub:** Displays my Top 5 tracks from the past month in real-time.
*   **Security Architecture:** Implements a "Build-Time Enrichment" workflow. A secure Node.js worker runs to fetch Spotify metadata, ensuring sensitive credentials are never exposed to the client.
*   **Enriched UI:** Features a custom CSS audio visualizer, pulsing "Live" status indicators, and deep-links to the native Spotify app.

### ⚽ Real-time Football Integration (FotMob)
*   **Live Data Feed:** Fetches real-time statistics for Wolverhampton Wanderers directly from the FotMob API.
*   **Automated Updates:** A GitHub Action runs periodically to update team standings, form (W/D/L), top scorers, and upcoming match details.
*   **Media Enrichment:** Integrates the latest non-Shorts YouTube video from the official Wolves channel via RSS feed, ensuring the most recent highlights are always available.

### 🌤️ Live Widgets (API Integrations)
*   **Crypto Tracker:** Real-time cryptocurrency price tracker for top assets (BTC, ETH, SOL, DOGE) using the CoinGecko API. Features 24h percentage changes and interactive 30-day historical line charts powered by Chart.js.
*   **Weather:** Auto-locating weather widget that dynamically fetches current temperature and conditions based on the user's IP (via GeoJS and Open-Meteo).

### 🕹️ Retro Arcade & Apps
*   **Identity (Terminal-X):** A hacker-themed identity readout featuring animated Dragon ASCII art and system telemetry.
*   **Projects (GitHub API):** Dynamically fetches and renders public repositories directly from the GitHub API.
*   **Arcade Module:** Fully functional implementations of classic games:
    *   *Invader Protocol* (Space Invaders)
    *   *Pitchybird* (Flappy Bird clone)
    *   *2048*
    *   *Battleship*
*   **Places:** A seamless, infinitely looping carousel showcasing travel photography through the SF Bay Area and beyond.

## 📁 File Structure

```text
├── .github/workflows/       # Automated workflows
│   ├── football_update.yml  # Automated football data enrichment
│   └── spotify_update.yml   # Periodic Spotify data enrichment
├── battleship/              # Arcade: Battleship source code
│   ├── src/                 # Battleship game logic, assets, and components
│   └── dist/                # Production build of Battleship
├── js/                      # Client-side Logic
│   ├── 2048.js              # Arcade: 2048 Game logic
│   ├── battleship_game.js   # Arcade: Battleship UI logic
│   ├── crypto.js            # Crypto Tracker logic & Chart.js integration
│   ├── dragon_data.js       # ASCII Art Data
│   ├── ethan_data.js        # Identity readout content
│   ├── football_data.js     # Data store for football results
│   ├── hacker_ascii.js      # Identity app ASCII animations
│   ├── pitchybird.js        # Arcade: Pitchybird logic
│   ├── spotify_data.js      # Data store for Spotify tracks
│   ├── spotify_top_tracks.js # Music app UI & visualizer logic
│   └── weather.js           # Live weather widget logic
├── photoassets/             # Images for the Places carousel
├── pitchybird/              # Arcade: Pitchybird standalone assets
├── scripts/                 # Background Utility Scripts
│   ├── update_football_data.js # Football data fetcher
│   └── update_spotify_data.js # Secure Node.js worker for Spotify API
├── 2048.html                # Standalone 2048 game entry point
├── background.mp4           # Dynamic video background
├── index.html               # Main entry point (Styles, DOM, & core Desktop OS logic)
└── README.md                # Project documentation
```

## 🛡️ Security & Privacy
The project follows modern security practices for static site deployments:
1.  **Credential Management:** No API keys are stored in the codebase.
2.  **Serverless Processing:** Secure backend processing handles private data before committing non-sensitive results to the public repo.
3.  **Encrypted Variables:** All Spotify credentials are encrypted and injected at build-time.

## 👨‍💻 Tech Stack
*   **Frontend:** Vanilla JS (ES6+), HTML5, CSS3 (Custom Variables & Keyframes).
*   **APIs:** Spotify Web API, GitHub REST API, CoinGecko API, Open-Meteo API.
*   **Libraries:** Chart.js, FontAwesome.
*   **Automation:** Node.js.
*   **Design:** SF Pro / Inter Typography, Apple Glassmorphism.

---
*Created and maintained by Ethan Leigh-Fellows*

# ethanleighfellows.github.io

A highly interactive, macOS-inspired personal portfolio and retro arcade platform. This project serves as a technical showcase for modern web development, secure API integration, and immersive UI/UX design.

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
│   └── spotify_update.yml   # Periodic Spotify data enrichment
├── js/                      # Client-side Logic
│   ├── spotify_top_tracks.js # Music app UI & visualizer logic
│   ├── spotify_data.js      # Data store for Spotify tracks
│   ├── 2048.js              # Arcade: 2048 Game logic
│   ├── battleship_game.js   # Arcade: Battleship logic
│   ├── pitchybird.js        # Arcade: Pitchybird logic
│   └── hacker_ascii.js      # Identity app ASCII animations
├── scripts/                 # Background Utility Scripts
│   └── update_spotify_data.js # Secure Node.js worker for Spotify API
├── photoassets/             # Images for the Places carousel
├── index.html               # Main entry point (Styles, DOM, & core Desktop OS logic)
└── background.mp4           # Dynamic video background
```

## 🛡️ Security & Privacy
The project follows modern security practices for static site deployments:
1.  **Credential Management:** No API keys are stored in the codebase.
2.  **Serverless Processing:** Secure backend processing handles private data before committing non-sensitive results to the public repo.
3.  **Encrypted Variables:** All Spotify credentials are encrypted and injected at build-time.

## 👨‍💻 Tech Stack
*   **Frontend:** Vanilla JS (ES6+), HTML5, CSS3 (Custom Variables & Keyframes).
*   **APIs:** Spotify Web API, GitHub REST API.
*   **Automation:** Node.js.
*   **Design:** SF Pro / Inter Typography, Apple Glassmorphism, FontAwesome.

---
*Created and maintained by Ethan Leigh-Fellows*

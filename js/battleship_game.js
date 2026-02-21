class BattleshipGame {
    constructor(canvasId) {
        this.canvasId = canvasId;
        this.gameContainer = document.getElementById('game-container');
        this.originalHTML = this.gameContainer.innerHTML;
        this.scriptId = 'battleship-bundle-script';
    }

    async start() {
        // Clear canvas and prepare container
        const canvas = document.getElementById(this.canvasId);
        if (canvas) canvas.style.display = 'none';
        
        document.body.classList.add('battleship-active');
        
        // Inject styles to override battleship's original CSS
        const styleId = 'battleship-design-overrides';
        if (!document.getElementById(styleId)) {
            document.head.insertAdjacentHTML('beforeend', `
                <style id="${styleId}">
                    #battleship-wrapper {
                        background: #0a0a0a !important;
                        color: #eee !important;
                        font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Inter', sans-serif !important;
                        display: flex;
                        flex-direction: column;
                        min-height: 100%;
                    }

                    #v-1 {
                        background-image: none !important;
                    }

                    #battleship-wrapper h1 {
                        font-family: 'SF Pro Display', sans-serif !important;
                        font-weight: 700 !important;
                        letter-spacing: -1px !important;
                        background: linear-gradient(to right, #007AFF, #00D4FF) !important;
                        -webkit-background-clip: text !important;
                        -webkit-text-fill-color: transparent !important;
                        font-size: 3rem !important;
                    }

                    #battleship-wrapper header {
                        border: none !important;
                        background: rgba(30, 30, 30, 0.5) !important;
                        backdrop-filter: blur(10px) !important;
                        padding: 20px !important;
                        margin-bottom: 20px !important;
                        border-bottom: 1px solid rgba(255, 255, 255, 0.1) !important;
                    }

                    #game-stage {
                        background-color: rgba(0, 122, 255, 0.15) !important;
                        border: 1px solid rgba(0, 122, 255, 0.3) !important;
                        color: #007AFF !important;
                        border-radius: 8px !important;
                        padding: 8px 16px !important;
                        font-family: 'SF Mono', monospace !important;
                        text-transform: uppercase !important;
                        font-size: 14px !important;
                    }

                    #battleship-wrapper .pvs-btn, 
                    #battleship-wrapper button:not(.window-btn) {
                        background: linear-gradient(135deg, #007AFF 0%, #0051D4 100%) !important;
                        border: none !important;
                        color: white !important;
                        border-radius: 10px !important;
                        padding: 12px 24px !important;
                        font-weight: 600 !important;
                        cursor: pointer !important;
                        box-shadow: 0 4px 15px rgba(0, 122, 255, 0.3) !important;
                        transition: all 0.2s ease !important;
                        text-shadow: none !important;
                    }

                    #battleship-wrapper button:hover:not(.disabled) {
                        transform: translateY(-2px) !important;
                        box-shadow: 0 6px 20px rgba(0, 122, 255, 0.4) !important;
                        filter: brightness(1.1) !important;
                    }

                    #battleship-wrapper .grid {
                        border: 2px solid rgba(0, 122, 255, 0.4) !important;
                        background: rgba(0, 0, 0, 0.6) !important;
                        border-radius: 4px !important;
                        box-shadow: 0 0 30px rgba(0, 122, 255, 0.1) !important;
                    }

                    #battleship-wrapper .cell {
                        border: 0.5px solid rgba(255, 255, 255, 0.05) !important;
                    }

                    #battleship-wrapper .cell-busy {
                        background-color: rgba(0, 122, 255, 0.5) !important;
                        border: 1px solid #007AFF !important;
                    }

                    #battleship-wrapper .cell.hit {
                        background-color: rgba(255, 59, 48, 0.7) !important;
                        border: 1px solid #ff3b30 !important;
                    }

                    #battleship-wrapper .cell.miss {
                        background-color: rgba(255, 255, 255, 0.15) !important;
                    }

                    #battleship-wrapper .cell.adjacent {
                        background-color: rgba(255, 255, 255, 0.05) !important;
                    }

                    #battleship-wrapper .ship-container div > div {
                        background-color: #007AFF !important;
                        border: 1px solid rgba(255, 255, 255, 0.2) !important;
                    }

                    #battleship-wrapper input[type="text"] {
                        background: rgba(255, 255, 255, 0.05) !important;
                        border: 1px solid rgba(255, 255, 255, 0.2) !important;
                        color: #fff !important;
                        border-radius: 8px !important;
                        padding: 12px !important;
                        outline: none !important;
                        transition: border-color 0.2s !important;
                    }

                    #battleship-wrapper input[type="text"]:focus {
                        border-color: #007AFF !important;
                    }

                    #battleship-wrapper .footer {
                        border: none !important;
                        border-top: 1px solid rgba(255, 255, 255, 0.1) !important;
                        background: rgba(20, 20, 20, 0.8) !important;
                        padding: 15px !important;
                        margin-top: auto !important;
                    }

                    #battleship-wrapper .coords-num, 
                    #battleship-wrapper .coords-letters {
                        color: rgba(255, 255, 255, 0.4) !important;
                        font-family: 'SF Mono', monospace !important;
                    }

                    #battleship-wrapper .disabled {
                        opacity: 0.5 !important;
                        filter: grayscale(1) !important;
                        cursor: not-allowed !important;
                    }

                    .hamburger-menu {
                        background-color: rgba(20, 20, 20, 0.95) !important;
                        backdrop-filter: blur(20px) !important;
                        color: #fff !important;
                    }
                </style>
            `);
        }

        // Load the battleship HTML
        // We need to inject the specific structure expected by battleship/dist/main.js
        this.gameContainer.insertAdjacentHTML('beforeend', `
            <div id="battleship-wrapper" style="width: 100%; height: 100%; overflow: auto;">
                <div id="v-1">
                    <header class="v-1">
                        <h1>Battleship</h1>
                        <div class="hamburger">
                            <div class="bar"></div>
                        </div>
                        <div class="hamburger-menu">
                            <h2>How To Play:</h2>
                            <ul class="list">
                                <li>Battleship is a strategy guessing game.</li>
                                <li>Each player takes turns to destroy the other's battleships.</li>
                                <li>There are two phases: placing ships and attacking.</li>
                                <li>In the placing ships phase:
                                    <ul>
                                        <li>Drag ships to place them on your board.</li>
                                        <li>Alternatively, click the "Randomize" button to place them randomly.</li>
                                        <li>Click on a ship to toggle between horizontal and vertical placement.</li>
                                    </ul>
                                </li>
                                <li>Each player has 10 ships of different lengths.</li>
                                <li>The first player to correctly guess and destroy all opponent's ships wins the game.</li>
                            </ul>
                        </div>
                    </header>
                    <main class="v-1">
                        <div class="pvs">
                            <button class="pvs-btn player">Player vs Player</button>
                            <button class="pvs-btn computer">Player vs Computer</button>
                        </div>
                    </main>
                    <main class="v-2 player-form removed">
                        <form id="p-vs-c-form" class="removed">
                            <h2>ENTER PLAYER NAME:</h2>
                            <input type="text" name="player-name" id="p-vs-c-name" required />
                            <button type="submit" id="p-vs-c-start">START GAME</button>
                        </form>
                        <form id="p-vs-player-form" class="removed">
                            <h2>ENTER PLAYER ONE NAME:</h2>
                            <input type="text" name="player-1-name" id="get-player-1-name" required />
                            <h2>ENTER PLAYER TWO NAME:</h2>
                            <input type="text" name="player-2-name" id="get-player-2-name" required />
                            <button type="submit" id="p-vs-player-start">START GAME</button>
                        </form>
                    </main>
                </div>
                <div id="v-2" class="removed">
                    <header class="v-2">
                        <h1>Battleship</h1>
                        <p id="game-stage">Place your ships!</p>
                        <img id="sound-on" class="sound" src="battleship/dist/images/sound-on.png" alt="sound-on" />
                        <img id="sound-off" class="sound removed" src="battleship/dist/images/off.png" alt="sound-off" />
                    </header>
                    <main id="p-vs-c-boards" class="v-3 p-vs-c removed">
                        <div class="grid-container1">
                            <div class="player-pieces">
                                <div class="ship-container">
                                    <p id="ship-4-count">1x</p>
                                    <div id="ship-4" draggable="true" class="ship-4"><div></div><div></div><div></div><div></div></div>
                                </div>
                                <div class="ship-container">
                                    <p id="ship-3-count">2x</p>
                                    <div id="ship-3" draggable="true" class="ship-3"><div></div><div></div><div></div></div>
                                </div>
                                <div class="ship-container">
                                    <p id="ship-2-count">3x</p>
                                    <div id="ship-2" draggable="true" class="ship-2"><div></div><div></div></div>
                                </div>
                                <div class="ship-container">
                                    <p id="ship-1-count">4x</p>
                                    <div id="ship-1" draggable="true" class="ship-1"><div></div></div>
                                </div>
                            </div>
                            <div class="coords-num">
                                <div class="number">1</div><div class="number">2</div><div class="number">3</div><div class="number">4</div><div class="number">5</div><div class="number">6</div><div class="number">7</div><div class="number">8</div><div class="number">9</div><div class="number">10</div>
                            </div>
                            <div class="coords-letters">
                                <div class="letter">A</div><div class="letter">B</div><div class="letter">C</div><div class="letter">D</div><div class="letter">E</div><div class="letter">F</div><div class="letter">G</div><div class="letter">H</div><div class="letter">I</div><div class="letter">J</div>
                            </div>
                            <div id="player-grid" class="grid"></div>
                            <p id="player-name"></p>
                        </div>
                        <div class="grid-container2">
                            <div class="coords-num">
                                <div class="number">1</div><div class="number">2</div><div class="number">3</div><div class="number">4</div><div class="number">5</div><div class="number">6</div><div class="number">7</div><div class="number">8</div><div class="number">9</div><div class="number">10</div>
                            </div>
                            <div class="coords-letters">
                                <div class="letter">A</div><div class="letter">B</div><div class="letter">C</div><div class="letter">D</div><div class="letter">E</div><div class="letter">F</div><div class="letter">G</div><div class="letter">H</div><div class="letter">I</div><div class="letter">J</div>
                            </div>
                            <div id="computer-grid" class="grid"></div>
                            <p>Computer's board</p>
                        </div>
                        <div id="p-vs-c-game-buttons">
                            <button id="p-vs-c-randomize">Randomize</button>
                            <button id="p-vs-c-clear">Clear</button>
                            <button id="p-vs-c-start-game" class="disabled">Start</button>
                        </div>
                        <div id="p-vs-c-restart-buttons">
                            <button id="restart-game-p-vs-c">Restart Game</button>
                            <button id="main-menu">Main Menu</button>
                        </div>
                    </main>
                    <main id="p-vs-p-boards" class="removed">
                        <!-- Simplified for brevity, add full P-vs-P if needed -->
                        <div id="player-1-container" class="grid-container1">
                             <div id="player-1-grid" class="grid"></div>
                             <p id="player-1-name"></p>
                        </div>
                        <div id="player-2-container" class="grid-container2 removed">
                             <div id="player-2-grid" class="grid"></div>
                             <p id="player-2-name"></p>
                        </div>
                        <div id="buttons-container">
                            <div id="game-buttons">
                                <button id="p-1-randomize">Randomize</button>
                                <button id="p-1-clear">Clear</button>
                                <button id="p-2-randomize" class="removed">Randomize</button>
                                <button id="p-2-clear" class="removed">Clear</button>
                                <button id="p-vs-p-start-game" class="removed disabled">Start</button>
                                <button id="show-next" class="disabled">Show next player board</button>
                                <button id="attack-next-player" class="disabled removed">Attack next player</button>
                            </div>
                            <div id="restart-buttons">
                                <button id="restart-game-p-vs-p">Restart Game</button>
                                <button id="p-v-p-main-menu">Main Menu</button>
                            </div>
                        </div>
                        <div id="modal-overlay" class="removed">
                            <div id="modal">
                                <p id="place-ships-p">Click continue to show the other player's board</p>
                                <button id="hide-placing-ships-modal" type="button">Continue</button>
                            </div>
                        </div>
                        <div id="attacking-modal-overlay" class="removed">
                            <div id="attacking-modal">
                                <p id="attack-ships-p">Click continue to show the other board to attack</p>
                                <button id="hide-attacking-modal" type="button">Continue</button>
                            </div>
                        </div>
                    </main>
                </div>
                <footer class="footer">
                    <p><a href="https://github.com/BodiAli/battleship" target="_blank" style="color: #007AFF; text-decoration: none;">Original Github</a></p>
                </footer>
            </div>
        `);

        // Load the bundle
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.id = this.scriptId;
            script.src = 'battleship/dist/main.js';
            script.onload = () => {
                // The bundle should automatically initialize since it's likely a self-executing script
                // that expects the DOM to be ready.
                document.body.style.visibility = 'visible';
                resolve();
            };
            script.onerror = reject;
            document.body.appendChild(script);
        });
    }

    stop() {
        document.body.classList.remove('battleship-active');
        const wrapper = document.getElementById('battleship-wrapper');
        if (wrapper) wrapper.remove();
        
        const style = document.getElementById('battleship-design-overrides');
        if (style) style.remove();
        
        const script = document.getElementById(this.scriptId);
        if (script) script.remove();
        
        const canvas = document.getElementById(this.canvasId);
        if (canvas) canvas.style.display = 'block';
        
        // Reset battleship-specific global side effects if any
        // (This is tricky since the bundle might have added global listeners)
        // For a true cleanup, we might need a page reload or more careful encapsulation.
    }
}

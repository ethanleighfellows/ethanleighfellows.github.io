
class PinballGame {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        if (!this.canvas) return;
        
        this.width = 640;
        this.height = 480;
        this.canvas.width = this.width;
        this.canvas.height = this.height;
        
        this.ctx = this.canvas.getContext('2d');
        this.loader = new DatLoader();
        if (typeof this.loader.queryVisualInfo !== "function") {
            this.loader.queryVisualInfo = () => null;
        }
        this.renderer = new Renderer(canvasId);
        this.table = new TPinballTable(this);
        this.running = false;
        this.assetsLoaded = false;
        this.message = "Initializing...";
        this.fileInput = null;
        this.renderList = [];
        
        this.bindEvents();
    }

    bindEvents() {
        this._keydownListener = (e) => {
            const key = e.key.toLowerCase();
            if (key === ' ' || key === 'z' || e.code === 'Slash') {
                e.preventDefault();
            }
            if (e.repeat && (key === ' ' || key === 'z' || e.code === 'Slash')) {
                return;
            }
            if (key === ' ') {
                if (this.assetsLoaded && !this.table.ball.active) {
                    this.table.newGame();
                } else if (this.assetsLoaded && this.table.ball.active) {
                    this.table.launchBall();
                }
            }
            if (key === 'z') this.table.flipperL?.onInput(true);
            if (e.code === 'Slash') this.table.flipperR?.onInput(true);
        };
        this._keyupListener = (e) => {
            const key = e.key.toLowerCase();
            if (key === 'z') this.table.flipperL?.onInput(false);
            if (e.code === 'Slash') this.table.flipperR?.onInput(false);
        };
        window.addEventListener('keydown', this._keydownListener);
        window.addEventListener('keyup', this._keyupListener);
    }

    async start() {
        if (this.running) return;
        this.running = true;
        this.renderer.clear();
        this.drawMessage("Loading PINBALL.DAT...");

        try {
            if (typeof this.loader.loadCollisionCsvs === "function") {
                await this.loader.loadCollisionCsvs('js/spacecadet');
            }
        } catch (e) {
            console.warn("Collision CSV auto-load failed. Proceeding with DAT defaults.", e);
        }

        try {
            const datPath = 'js/spacecadet/PINBALL_ENGLISH/pinball.dat';
            const datFile = await this.loader.load(datPath);
            if (datFile) {
                this.loader.datFile = datFile;
                this.onDatLoaded(datFile);
            }
        } catch (e) {
            console.warn("Auto-load failed. Showing manual upload UI.", e);
            this.showUploadUI();
        }

        this.lastTime = performance.now();
        requestAnimationFrame((t) => this.loop(t));
    }

    stop() {
        this.running = false;
        if (this._keydownListener) window.removeEventListener('keydown', this._keydownListener);
        if (this._keyupListener) window.removeEventListener('keyup', this._keyupListener);
        this._keydownListener = null;
        this._keyupListener = null;
        if (this.fileInput) {
            this.fileInput.remove();
            this.fileInput = null;
        }
    }

    showUploadUI() {
        this.message = "Please manually select PINBALL.DAT:";
        this.drawMessage(this.message);
        if (!this.fileInput) {
            const input = document.createElement('input');
            input.type = 'file';
            input.id = 'pinball-dat-upload';
            input.style.position = 'absolute';
            input.style.top = '50%';
            input.style.left = '50%';
            input.style.transform = 'translate(-50%, 80px)';
            input.style.zIndex = '1000';
            input.onchange = (e) => {
                const file = e.target.files[0];
                if (file) {
                    const reader = new FileReader();
                    reader.onload = (evt) => {
                        const datFile = this.loader.parse(evt.target.result);
                        if (datFile) {
                            this.loader.datFile = datFile;
                            input.remove();
                            this.fileInput = null;
                            this.onDatLoaded(datFile);
                        } else {
                            this.message = "Invalid PINBALL.DAT file!";
                            this.drawMessage(this.message);
                        }
                    };
                    reader.readAsArrayBuffer(file);
                }
            };
            document.getElementById('game-container').appendChild(input);
            this.fileInput = input;
        }
    }

    onDatLoaded(datFile) {
        console.log("DAT Parsed:", datFile.appName);
        
        let paletteData = datFile.field(0, FieldTypes.Palette);
        if (!paletteData) {
            for (let i = 0; i < datFile.groups.length; i++) {
                paletteData = datFile.field(i, FieldTypes.Palette);
                if (paletteData) break;
            }
        }
        if (paletteData) {
            this.renderer.setPalette(paletteData);
        }

        this.renderList = [];
        const bg0 = datFile.getBitmap(0, 0);
        if (bg0) this.renderList.push(bg0);

        const bgNames = ["background", "table", "vscreen", "board"];
        bgNames.forEach(name => {
            const idx = datFile.record_labeled(name);
            if (idx !== -1 && idx !== 0) {
                const bmp = datFile.getBitmap(idx, 0);
                if (bmp) this.renderList.push(bmp);
            }
        });

        this.table.initialize(datFile);
        this.assetsLoaded = true;
        this.message = "Press SPACE to Start";
    }

    drawMessage(text, overlay = false) {
        if (!this.ctx) return;
        if (!overlay) {
            this.ctx.fillStyle = '#000';
            this.ctx.fillRect(0, 0, this.width, this.height);
        }
        this.ctx.fillStyle = '#0f0';
        this.ctx.font = '18px monospace';
        this.ctx.textAlign = 'center';
        const lines = text.split('\n');
        lines.forEach((line, i) => {
            this.ctx.fillText(line, this.width / 2, this.height / 2 + (i * 24));
        });
    }

    drawHud() {
        if (!this.ctx || !this.assetsLoaded) return;
        const score = this.table?.score ?? 0;
        const balls = this.table?.ballsRemaining ?? this.table?.ballsPerGame ?? 3;
        this.ctx.save();
        this.ctx.font = 'bold 18px monospace';
        this.ctx.fillStyle = '#d4ff58';
        this.ctx.textAlign = 'left';
        this.ctx.fillText(`SCORE ${score.toString().padStart(6, '0')}`, 18, 28);
        this.ctx.textAlign = 'right';
        this.ctx.fillText(`BALLS ${balls}`, this.width - 18, 28);
        this.ctx.restore();
    }

    update(dt) {
        if (this.assetsLoaded) {
            this.table.update(dt);
        }
    }

    render() {
        this.renderer.clear();
        if (this.assetsLoaded) {
            this.renderList.forEach(bmp => this.renderer.drawBitmap(bmp));
            this.table.render(this.renderer);
            this.drawHud();
            if (!this.table.ball.active) {
                this.drawMessage(this.message, true);
            }
        } else {
            this.drawMessage(this.message);
        }
    }

    loop(time = performance.now()) {
        if (!this.running) return;
        const dt = Math.max(0, Math.min((time - this.lastTime) / 1000, 0.03));
        this.lastTime = time;
        this.update(dt);
        this.render();
        requestAnimationFrame((t) => this.loop(t));
    }
}

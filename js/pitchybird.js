class Pitchybird {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        if (!this.canvas) return;
        this.ctx = this.canvas.getContext("2d");

        // Game dimensions
        this.width = 400;
        this.height = 512;
        this.canvas.width = this.width;
        this.canvas.height = this.height;

        // Assets preloading
        this.bgImage = new Image();
        this.bgImage.src = "pitchybird/assets/bg.png";

        const birdSprites = [
            "pitchybird/assets/pitchsurprise.png",
            "pitchybird/assets/pitchsurprise.png"
        ];

        this.birdImageObjects = birdSprites.map(src => {
            const img = new Image();
            img.src = src;
            return img;
        });

        this.pipeTopImg = new Image();
        this.pipeTopImg.src = "pitchybird/assets/pitchcatdown.png";

        this.pipeBottomImg = new Image();
        this.pipeBottomImg.src = "pitchybird/assets/pitchcatup.png";

        this.emailImg = new Image();
        this.emailImg.src = "pitchybird/assets/email.png";

        // Game State
        this.frames = 0;
        this.gameOver = false;
        this.pitchlaneCredits = 0;
        this.running = false;

        // Bird parameters
        this.birdX = 50;
        this.birdY = this.height / 2;
        this.birdWidth = 34;
        this.birdHeight = 24;
        this.birdVelocity = 0;
        this.gravity = 0.4;
        this.jumpHeight = -6;

        // Bird Animation
        this.birdFrameIndex = 0;
        this.birdFrameDelay = 5;

        // Pipes
        this.pipeSpeed = 2;
        this.pipeGap = 150;
        this.pipeWidth = 60;
        this.pipeFrequency = 120;
        this.pipes = [];

        // Emails
        this.emailSpeed = 3;
        this.emailSpawnRate = 200;
        this.emails = [];

        // Background scrolling
        this.bgScaledWidth = 0;
        this.bgScaledHeight = 0;
        this.bgX = 0;
        this.bgScrollSpeed = 1;

        this.bgImage.onload = () => {
            const scaleFactor = this.height / this.bgImage.height;
            this.bgScaledWidth = this.bgImage.width * scaleFactor;
            this.bgScaledHeight = this.height;
        };

        this.bindEvents();
    }

    bindEvents() {
        this._keydownListener = (e) => {
            if (e.code === "Space") {
                e.preventDefault();
                if (!this.gameOver) {
                    this.birdVelocity = this.jumpHeight;
                } else {
                    this.resetGame();
                }
            }
        };
        window.addEventListener("keydown", this._keydownListener);
    }

    unbindEvents() {
        window.removeEventListener("keydown", this._keydownListener);
    }

    start() {
        this.running = true;
        this.resetGame();
    }

    stop() {
        this.running = false;
        this.unbindEvents();
    }

    resetGame() {
        this.frames = 0;
        this.gameOver = false;
        this.pitchlaneCredits = 0;
        this.birdY = this.height / 2;
        this.birdVelocity = 0;
        this.pipes = [];
        this.emails = [];
        this.bgX = 0;
        
        // Ensure game loop starts
        this.lastTime = performance.now();
        requestAnimationFrame((t) => this.gameLoop(t));
    }

    gameLoop(time) {
        if (!this.running) return;
        if (!this.gameOver) {
            this.update();
            this.draw();
            requestAnimationFrame((t) => this.gameLoop(t));
        } else {
            this.draw(); // Draw final state with Game Over
        }
    }

    update() {
        this.frames++;

        // 1) Scroll background
        if (this.bgScaledWidth) {
            this.bgX -= this.bgScrollSpeed;
            if (this.bgX <= -this.bgScaledWidth) {
                this.bgX = 0;
            }
        }

        // 2) Generate pipes
        if (this.frames % this.pipeFrequency === 0) {
            this.generatePipes();
        }

        // 3) Move pipes
        for (let i = 0; i < this.pipes.length; i++) {
            this.pipes[i].x -= this.pipeSpeed;
            if (this.pipes[i].x + this.pipeWidth < 0) {
                this.pipes.splice(i, 1);
                i--;
                this.pitchlaneCredits++;
            }
        }

        // 4) Generate emails
        if (this.frames % this.emailSpawnRate === 0) {
            this.spawnEmail();
        }

        // 5) Move emails
        this.updateEmails();

        // 6) Bird physics
        this.birdVelocity += this.gravity;
        this.birdY += this.birdVelocity;

        if (this.birdY + this.birdHeight >= this.height) {
            this.birdY = this.height - this.birdHeight;
            this.triggerGameOver();
        }
        if (this.birdY < 0) {
            this.birdY = 0;
            this.birdVelocity = 0;
        }

        // 7) Collisions
        this.checkPipeCollisions();
    }

    draw() {
        this.ctx.clearRect(0, 0, this.width, this.height);

        // 1) Background
        this.drawBackground();

        // 2) Pipes
        for (let i = 0; i < this.pipes.length; i++) {
            let p = this.pipes[i];
            this.ctx.drawImage(p.topImg, p.x, p.topY, this.pipeWidth, p.topHeight);
            this.ctx.drawImage(p.bottomImg, p.x, p.bottomY, this.pipeWidth, p.bottomHeight);
        }

        // 3) Emails
        this.drawEmails();

        // 4) Bird
        this.drawBird();

        // 5) Credits
        this.ctx.font = "bold 20px Raleway, sans-serif";
        this.ctx.strokeStyle = "#000";
        this.ctx.lineWidth = 3;
        this.ctx.strokeText("Pitchlane Credits: " + this.pitchlaneCredits, 10, 30);
        this.ctx.fillStyle = "#fff";
        this.ctx.fillText("Pitchlane Credits: " + this.pitchlaneCredits, 10, 30);

        // 6) Game Over
        if (this.gameOver) {
            this.ctx.save();
            this.ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
            this.ctx.fillRect(0, 0, this.width, this.height);
            
            this.ctx.fillStyle = "#fff";
            this.ctx.font = "bold 40px Raleway, sans-serif";
            this.ctx.textAlign = "center";
            this.ctx.fillText("GAME OVER", this.width / 2, this.height / 2 - 20);
            
            this.ctx.font = "bold 20px Raleway, sans-serif";
            this.ctx.fillText("Press SPACE to Restart", this.width / 2, this.height / 2 + 20);
            this.ctx.restore();
        }
    }

    drawBackground() {
        if (!this.bgScaledWidth || !this.bgScaledHeight) return;
        this.ctx.drawImage(this.bgImage, this.bgX, 0, this.bgScaledWidth, this.bgScaledHeight);
        this.ctx.drawImage(this.bgImage, this.bgX + this.bgScaledWidth, 0, this.bgScaledWidth, this.bgScaledHeight);
    }

    drawBird() {
        if (this.frames % this.birdFrameDelay === 0) {
            this.birdFrameIndex = (this.birdFrameIndex + 1) % this.birdImageObjects.length;
        }
        const frameImage = this.birdImageObjects[this.birdFrameIndex];

        this.ctx.save();
        this.ctx.shadowColor = "rgba(0, 0, 0, 0.6)";
        this.ctx.shadowBlur = 6;
        this.ctx.drawImage(frameImage, this.birdX, this.birdY, this.birdWidth, this.birdHeight);
        this.ctx.restore();
    }

    drawEmails() {
        for (let i = 0; i < this.emails.length; i++) {
            const e = this.emails[i];
            this.ctx.drawImage(e.img, e.x, e.y, e.width, e.height);
        }
    }

    updateEmails() {
        for (let i = 0; i < this.emails.length; i++) {
            this.emails[i].x -= this.emailSpeed;

            if (this.emails[i].x + this.emails[i].width < 0) {
                this.emails.splice(i, 1);
                i--;
                continue;
            }

            if (this.checkEmailCollision(this.emails[i])) {
                this.pitchlaneCredits += 3;
                this.emails.splice(i, 1);
                i--;
            }
        }
    }

    checkEmailCollision(email) {
        return !(
            this.birdY + this.birdHeight < email.y ||
            this.birdY > email.y + email.height ||
            this.birdX + this.birdWidth < email.x ||
            this.birdX > email.x + email.width
        );
    }

    spawnEmail() {
        const emailY = Math.random() * (this.height - 40) + 10;
        this.emails.push({
            x: this.width,
            y: emailY,
            width: 32,
            height: 24,
            img: this.emailImg
        });
    }

    generatePipes() {
        const topHeight = Math.floor(
            Math.random() * (this.height - this.pipeGap - 100)
        ) + 50;
        const bottomHeight = this.height - topHeight - this.pipeGap;

        this.pipes.push({
            x: this.width,
            topY: 0,
            topHeight: topHeight,
            bottomY: topHeight + this.pipeGap,
            bottomHeight: bottomHeight,
            topImg: this.pipeTopImg,
            bottomImg: this.pipeBottomImg
        });
    }

    checkPipeCollisions() {
        for (let i = 0; i < this.pipes.length; i++) {
            const p = this.pipes[i];

            // Collision with top pipe
            if (
                this.birdX + this.birdWidth > p.x &&
                this.birdX < p.x + this.pipeWidth &&
                this.birdY < p.topHeight
            ) {
                this.triggerGameOver();
            }

            // Collision with bottom pipe
            if (
                this.birdX + this.birdWidth > p.x &&
                this.birdX < p.x + this.pipeWidth &&
                this.birdY + this.birdHeight > p.bottomY
            ) {
                this.triggerGameOver();
            }
        }
    }

    triggerGameOver() {
        if (!this.gameOver) {
            this.gameOver = true;
        }
    }
}

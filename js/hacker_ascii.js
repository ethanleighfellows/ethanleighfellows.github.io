(function() {
    const dragonContainer = document.getElementById('hacker-dragon-container');
    const nameContainer = document.getElementById('hacker-name-container');
    
    if (dragonContainer && nameContainer && window.dragonBase64 && window.ethanBase64Vars) {
        try {
            const dragonTemplate = atob(window.dragonBase64);
            const ethanVars = window.ethanBase64Vars.map(b64 => atob(b64));

            const chars = '0123456789!#$%&*+-~?=';
            let newDragonHtml = '';
            for (let i = 0; i < dragonTemplate.length; i++) {
                const char = dragonTemplate[i];
                if (['.', ':', "'", '!', '*', '`', '"'].includes(char)) {
                    newDragonHtml += '<span class="dragon-anim-char">' + char + '</span>';
                } else {
                    newDragonHtml += char;
                }
            }
            dragonContainer.innerHTML = newDragonHtml;
            
            const animSpans = dragonContainer.querySelectorAll('.dragon-anim-char');
            setInterval(() => {
                animSpans.forEach(span => {
                    if (Math.random() > 0.8) {
                        span.textContent = chars[Math.floor(Math.random() * chars.length)];
                    }
                });
            }, 100);

            let currentVarIdx = 0;
            let isTransitioning = false;
            
            function renderName(text) {
                let html = '';
                for(let i=0; i<text.length; i++) {
                    html += '<span>' + text[i] + '</span>';
                }
                nameContainer.innerHTML = html;
            }

            function animateTransition(nextText) {
                if(isTransitioning) return;
                isTransitioning = true;
                
                const spans = nameContainer.querySelectorAll('span');
                let steps = 15;
                let currentStep = 0;
                
                const interval = setInterval(() => {
                    currentStep++;
                    for(let i=0; i<spans.length; i++) {
                        if (spans[i].textContent !== '\n' && spans[i].textContent !== ' ' && Math.random() < 0.6) {
                            spans[i].textContent = chars[Math.floor(Math.random() * chars.length)];
                        }
                    }
                    if (currentStep >= steps) {
                        clearInterval(interval);
                        renderName(nextText);
                        isTransitioning = false;
                    }
                }, 40);
            }

            if (ethanVars.length > 0) {
                renderName(ethanVars[0]);
                setInterval(() => {
                    currentVarIdx = (currentVarIdx + 1) % ethanVars.length;
                    animateTransition(ethanVars[currentVarIdx]);
                }, 4000);
            }
        } catch (error) {
            console.error("Error rendering hacker ASCII art:", error);
        }
    }
})();
// js/crypto.js

async function initCrypto() {
    const cryptoContent = document.getElementById('crypto-content');
    if (!cryptoContent) return;

    try {
        // Fetch data from CoinGecko
        const url = 'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,solana,dogecoin&vs_currencies=usd,eur,rub&include_24hr_change=true';
        const response = await fetch(url);

        if (!response.ok) throw new Error('Failed to fetch crypto data');

        const data = await response.json();

        // Use current language to pick currency (simplified mapping for demonstration)
        const currency = currentLang === 'fr' ? 'eur' : (currentLang === 'ru' ? 'rub' : 'usd');
        const symbol = currency === 'eur' ? '€' : (currency === 'rub' ? '₽' : '$');

        const coins = [
            { id: 'bitcoin', name: 'Bitcoin', ticker: 'BTC', icon: 'fa-bitcoin', color: '#f7931a' },
            { id: 'ethereum', name: 'Ethereum', ticker: 'ETH', icon: 'fa-ethereum', color: '#627eea' },
            { id: 'solana', name: 'Solana', ticker: 'SOL', icon: 'fa-sun', color: '#14F195' }, // using sun as proxy for SOL logo
            { id: 'dogecoin', name: 'Dogecoin', ticker: 'DOGE', icon: 'fa-paw', color: '#c2a633' }
        ];

        let html = '<div class="crypto-list">';

        coins.forEach((coin, index) => {
            const coinData = data[coin.id];
            if (coinData) {
                const price = coinData[currency].toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                const change = coinData[`${currency}_24h_change`];
                const changeColor = change >= 0 ? '#30d158' : '#ff5f57';
                const changeSign = change >= 0 ? '+' : '';
                const delay = index * 0.15;

                html += `
                    <div class="crypto-item" style="animation: slideInFromRight 0.5s ease forwards; opacity: 0; animation-delay: ${delay}s;">
                        <div class="crypto-info">
                            <div class="crypto-icon" style="color: ${coin.color};">
                                <i class="fab ${coin.icon}"></i>
                            </div>
                            <div class="crypto-name">
                                <strong>${coin.ticker}</strong>
                                <span>${coin.name}</span>
                            </div>
                        </div>
                        <div class="crypto-price-info">
                            <div class="crypto-price">${symbol}${price}</div>
                            <div class="crypto-change" style="color: ${changeColor};">
                                ${changeSign}${change.toFixed(2)}%
                            </div>
                        </div>
                    </div>
                `;
            }
        });

        html += '</div>';
        html += `
            <style>
                @keyframes slideInFromRight {
                    from { opacity: 0; transform: translateX(20px); }
                    to { opacity: 1; transform: translateX(0); }
                }
            </style>
        `;

        cryptoContent.innerHTML = html;

    } catch (err) {
        console.error("Crypto error:", err);
        const errorText = document.querySelector('.window-title[data-i18n="crypto.title"]')
            ? translations[currentLang]?.crypto?.error || "Error loading crypto prices"
            : "Error loading crypto prices";

        cryptoContent.innerHTML = `<div style="color: #ff5f57; text-align: center; padding: 20px;">
            <i class="fas fa-exclamation-circle" style="font-size: 2rem; margin-bottom: 10px;"></i><br>${errorText}</div>`;
    }
}

// Add event listener to crypto icon
document.addEventListener('DOMContentLoaded', () => {
    // Dynamically bind to the desktop icon
    const cryptoIcon = document.querySelector('.desktop-icon[data-app="crypto"]');
    if (cryptoIcon) {
        cryptoIcon.addEventListener('click', () => {
            if (typeof openWindow === 'function') {
                openWindow('crypto');
            } else {
                const w = document.getElementById('crypto');
                if (w) w.classList.add('active');
            }

            // Check if it's still showing the loading state
            const content = document.getElementById('crypto-content');
            if (content && content.innerHTML.includes('crypto-loading')) {
                initCrypto();
            }
        });
    }
});

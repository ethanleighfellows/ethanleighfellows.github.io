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
            { id: 'bitcoin', name: 'Bitcoin', ticker: 'BTC', icon: '<img src="https://assets.coingecko.com/coins/images/1/small/bitcoin.png" />' },
            { id: 'ethereum', name: 'Ethereum', ticker: 'ETH', icon: '<img src="https://assets.coingecko.com/coins/images/279/small/ethereum.png" />' },
            { id: 'solana', name: 'Solana', ticker: 'SOL', icon: '<img src="https://assets.coingecko.com/coins/images/4128/small/solana.png" />' },
            { id: 'dogecoin', name: 'Dogecoin', ticker: 'DOGE', icon: '<img src="https://assets.coingecko.com/coins/images/5/small/dogecoin.png" />' }
        ];

        let html = `
            <div class="crypto-list" id="crypto-list">
        `;

        coins.forEach((coin, index) => {
            const coinData = data[coin.id];
            if (coinData) {
                const price = coinData[currency].toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                const change = coinData[`${currency}_24h_change`];
                const changeColor = change >= 0 ? '#30d158' : '#ff5f57';
                const changeSign = change >= 0 ? '+' : '';
                const delay = index * 0.15;

                html += `
                    <div class="crypto-item" onclick="showCryptoChart('${coin.id}', '${coin.name}', '${coin.ticker}', '${currency}', '${symbol}')" style="animation: slideInFromRight 0.5s ease forwards; opacity: 0; animation-delay: ${delay}s;">
                        <div class="crypto-info">
                            <div class="crypto-icon">
                                ${coin.icon}
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

        // Add chart view overlay
        html += `
            <div class="crypto-chart-view" id="crypto-chart-view">
                <div class="crypto-chart-header">
                    <div class="crypto-back-btn" onclick="hideCryptoChart()"><i class="fas fa-chevron-left"></i> Back</div>
                    <div class="crypto-chart-title" id="crypto-chart-title"></div>
                </div>
                <div class="crypto-chart-container">
                    <canvas id="cryptoChartCanvas"></canvas>
                </div>
            </div>
        `;
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

let cryptoChartInstance = null;

async function showCryptoChart(coinId, coinName, ticker, currency, symbol) {
    const listView = document.getElementById('crypto-list');
    const chartView = document.getElementById('crypto-chart-view');
    const titleEl = document.getElementById('crypto-chart-title');
    const canvas = document.getElementById('cryptoChartCanvas');

    if (!listView || !chartView || !canvas) return;

    // UI Transition
    listView.classList.add('hidden');
    chartView.classList.add('active');
    titleEl.textContent = `${coinName} (${ticker})`;

    // Destroy previous chart if exists
    if (cryptoChartInstance) {
        cryptoChartInstance.destroy();
    }

    // Display a temporary loading state on canvas (optional, handled by empty canvas)

    try {
        const url = `https://api.coingecko.com/api/v3/coins/${coinId}/market_chart?vs_currency=${currency}&days=30`;
        const response = await fetch(url);
        if (!response.ok) throw new Error('Failed to fetch historical data');

        const data = await response.json();
        const prices = data.prices; // Array of [timestamp, price]

        const labels = prices.map(p => {
            const d = new Date(p[0]);
            return `${d.getMonth() + 1}/${d.getDate()}`;
        });

        const dataPoints = prices.map(p => p[1]);

        // Determine line color based on overall 30-day trend
        const startPrice = dataPoints[0];
        const endPrice = dataPoints[dataPoints.length - 1];
        const isPositive = endPrice >= startPrice;
        const color = isPositive ? '#30d158' : '#ff5f57';
        const gradientColor = isPositive ? 'rgba(48, 209, 88, 0.2)' : 'rgba(255, 95, 87, 0.2)';

        const ctx = canvas.getContext('2d');
        const gradient = ctx.createLinearGradient(0, 0, 0, 300);
        gradient.addColorStop(0, gradientColor);
        gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');

        cryptoChartInstance = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: `${ticker} Price`,
                    data: dataPoints,
                    borderColor: color,
                    backgroundColor: gradient,
                    borderWidth: 2,
                    pointRadius: 0,
                    pointHoverRadius: 4,
                    fill: true,
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        mode: 'index',
                        intersect: false,
                        callbacks: {
                            label: function (context) {
                                let label = context.dataset.label || '';
                                if (label) {
                                    label += ': ';
                                }
                                if (context.parsed.y !== null) {
                                    label += symbol + context.parsed.y.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                                }
                                return label;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        display: false,
                        grid: { display: false }
                    },
                    y: {
                        display: false,
                        grid: { display: false }
                    }
                },
                interaction: {
                    mode: 'nearest',
                    axis: 'x',
                    intersect: false
                }
            }
        });

    } catch (err) {
        console.error("Chart error:", err);
        titleEl.textContent = "Error loading chart";
    }
}

function hideCryptoChart() {
    const listView = document.getElementById('crypto-list');
    const chartView = document.getElementById('crypto-chart-view');

    if (listView && chartView) {
        chartView.classList.remove('active');
        listView.classList.remove('hidden');
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

// js/weather.js

async function initWeather() {
    const weatherContent = document.getElementById('weather-content');
    if (!weatherContent) return;
    
    // Attempt to get location based on IP and then query Open-Meteo
    try {
        const geoResponse = await fetch('https://get.geojs.io/v1/ip/geo.json');
        if (!geoResponse.ok) throw new Error('Failed to get location');
        const geoData = await geoResponse.json();
        
        const lat = geoData.latitude;
        const lon = geoData.longitude;
        const city = geoData.city || geoData.region || "Current Location";
        
        // Fetch weather from Open-Meteo
        const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true`;
        const weatherResponse = await fetch(weatherUrl);
        if (!weatherResponse.ok) throw new Error('Failed to fetch weather data');
        
        const weatherData = await weatherResponse.json();
        const temp = Math.round(weatherData.current_weather.temperature);
        const code = weatherData.current_weather.weathercode;
        
        // Interpret WMO code
        const { desc, iconClass } = getWeatherInfo(code);
        
        // Only update if translations are available; fallback if needed
        const errorText = document.querySelector('.window-title[data-i18n="weather.title"]') 
            ? translations[currentLang]?.weather?.error || "Error loading weather" 
            : "Error loading weather";
            
        weatherContent.innerHTML = `
            <i class="fas ${iconClass} weather-icon-large"></i>
            <div class="weather-temp">${temp}°C</div>
            <div class="weather-desc">${desc}</div>
            <div class="weather-location">${city}</div>
        `;
    } catch(err) {
        console.error("Weather error:", err);
        const errorText = document.querySelector('.window-title[data-i18n="weather.title"]') 
            ? translations[currentLang]?.weather?.error || "Error loading weather" 
            : "Error loading weather";
            
        weatherContent.innerHTML = `<div style="color: #ff5f57;">
            <i class="fas fa-exclamation-circle" style="font-size: 2rem; margin-bottom: 10px;"></i><br>${errorText}</div>`;
    }
}

function getWeatherInfo(code) {
    // WMO Weather interpretation codes (https://open-meteo.com/en/docs)
    const map = {
        0: { desc: 'Clear sky', iconClass: 'fa-sun' },
        1: { desc: 'Mainly clear', iconClass: 'fa-cloud-sun' },
        2: { desc: 'Partly cloudy', iconClass: 'fa-cloud-sun' },
        3: { desc: 'Overcast', iconClass: 'fa-cloud' },
        45: { desc: 'Fog', iconClass: 'fa-smog' },
        48: { desc: 'Depositing rime fog', iconClass: 'fa-smog' },
        51: { desc: 'Light drizzle', iconClass: 'fa-cloud-rain' },
        53: { desc: 'Moderate drizzle', iconClass: 'fa-cloud-rain' },
        55: { desc: 'Dense drizzle', iconClass: 'fa-cloud-rain' },
        61: { desc: 'Slight rain', iconClass: 'fa-cloud-rain' },
        63: { desc: 'Moderate rain', iconClass: 'fa-cloud-showers-heavy' },
        65: { desc: 'Heavy rain', iconClass: 'fa-cloud-showers-heavy' },
        71: { desc: 'Slight snow', iconClass: 'fa-snowflake' },
        73: { desc: 'Moderate snow', iconClass: 'fa-snowflake' },
        75: { desc: 'Heavy snow', iconClass: 'fa-snowflake' },
        77: { desc: 'Snow grains', iconClass: 'fa-snowflake' },
        80: { desc: 'Slight rain showers', iconClass: 'fa-cloud-rain' },
        81: { desc: 'Moderate rain showers', iconClass: 'fa-cloud-showers-heavy' },
        82: { desc: 'Violent rain showers', iconClass: 'fa-cloud-showers-heavy' },
        85: { desc: 'Slight snow showers', iconClass: 'fa-snowflake' },
        86: { desc: 'Heavy snow showers', iconClass: 'fa-snowflake' },
        95: { desc: 'Thunderstorm', iconClass: 'fa-bolt' },
        96: { desc: 'Thunderstorm with slight hail', iconClass: 'fa-bolt' },
        99: { desc: 'Thunderstorm with heavy hail', iconClass: 'fa-bolt' },
    };
    return map[code] || { desc: 'Unknown', iconClass: 'fa-cloud' };
}

// Add event listener to weather icon
document.addEventListener('DOMContentLoaded', () => {
    // We bind it dynamically
    const weatherIcon = document.querySelector('.desktop-icon[data-app="weather"]');
    if (weatherIcon) {
        weatherIcon.addEventListener('click', () => {
            // Open window relies on existing openWindow('id') logic of the desktop
            if (typeof openWindow === 'function') {
                openWindow('weather');
            } else {
                const w = document.getElementById('weather');
                if (w) w.classList.add('active');
            }
            
            // If content is still "loading...", initialize it
            const content = document.getElementById('weather-content');
            if (content && content.innerHTML.includes('weather-loading')) {
                initWeather();
            }
        });
    }
});

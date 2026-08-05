// --- FUNCIONES MATEMÁTICAS ---
function calcVolume(sensorDist, geo) {
    const level = Math.max(0, geo.height_m - sensorDist);
    const volumeM3 = level * geo.area_m2;
    return { m3: volumeM3, liters: volumeM3 * 1000 };
}

function analyzeMetrics(series, geo) {
    let isStuck = true;
    let totalConsumption24h = 0;

    const lastVal = series.dist[series.dist.length - 1];
    for(let i = 1; i <= 12; i++) {
        if(series.dist[series.dist.length - i] !== lastVal) {
            isStuck = false;
            break;
        }
    }

    for(let i = 1; i <= 24; i++) {
        let idx = series.dist.length - i;
        let diffL = calcVolume(series.dist[idx], geo).liters - calcVolume(series.dist[idx-1], geo).liters;
        if (diffL < 0) { 
            totalConsumption24h += Math.abs(diffL);
        }
    }
    const avgHourlyConsumption = totalConsumption24h / 24;

    return { isStuck, avgHourlyConsumption };
}

// --- GENERADOR MOCK (Reemplazar con Fetch a API real) ---
function generate5DayData(geo, simulateFailure = false) {
    const times = [];
    const distances = [];
    let now = new Date();
    let currentDist = geo.height_m * 0.4; 
    
    for (let i = 120; i >= 0; i--) {
        let d = new Date(now.getTime() - i * 3600 * 1000);
        times.push(d);
        currentDist += (Math.random() * 0.03 + 0.01); 
        if (i % 24 === 0 && i !== 120) currentDist -= (Math.random() * 0.5 + 0.3);
        if (currentDist < 0.2) currentDist = 0.2;
        if (currentDist > geo.height_m) currentDist = geo.height_m;
        distances.push(currentDist);
    }
    if (simulateFailure) {
        const stuckValue = distances[distances.length - 13];
        for(let i = 1; i <= 12; i++) distances[distances.length - i] = stuckValue;
    }
    return { x: times, dist: distances };
}

// --- RENDERIZADO PRINCIPAL ---
document.addEventListener('DOMContentLoaded', () => {
    const container = document.getElementById('cisternsGrid');
    const now = new Date();
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' };
    const formattedDate = now.toLocaleDateString('es-MX', options);
    
    document.getElementById('updateTime').innerText = formattedDate.charAt(0).toUpperCase() + formattedDate.slice(1) + ' hrs';

    // Iniciar el string del caption para Telegram
    let telegramCaption = `💧 *Reporte SMAWA - IBERO CDMX*\n📅 ${formattedDate.charAt(0).toUpperCase() + formattedDate.slice(1)} hrs\n\n`;

    Object.keys(APP_CONFIG.GEOMETRY).forEach(id => {
        const geo = APP_CONFIG.GEOMETRY[id];
        if (!geo.sensor_id) return; // Ignoramos la Cisterna D por ahora

        // MOCK: Aquí conectarás tu fetch real
        const series = generate5DayData(geo, id === "CISTERNA_B");
        
        const currentDist = series.dist[series.dist.length - 1];
        const prevDist = series.dist[series.dist.length - 2];

        const currentVol = calcVolume(currentDist, geo);
        const prevVol = calcVolume(prevDist, geo);

        const flowL = currentVol.liters - prevVol.liters;
        const isPositive = flowL > 0;
        const isStable = Math.abs(flowL) < 10; 
        
        const flowClass = isStable ? '' : (isPositive ? 'flow-positive' : 'flow-negative');
        const flowStatusText = isStable ? 'Estable' : (isPositive ? 'Recarga' : 'Gasto');
        const sign = isPositive ? '+' : '';
        const fillPercentage = ((currentVol.liters / geo.max_capacity_l) * 100).toFixed(1);

        const analysis = analyzeMetrics(series, geo);
        let autonomyText = "N/A";
        if (analysis.avgHourlyConsumption > 0) {
            const daysLeft = currentVol.liters / (analysis.avgHourlyConsumption * 24);
            autonomyText = daysLeft > 30 ? "+30 días" : `${daysLeft.toFixed(1)} días`;
        }
        
        const sensorHtml = analysis.isStuck 
            ? `<div class="sensor-warning">⚠️ ALERTA: Sin variación 12h</div>` 
            : `<div class="sensor-ok">✅ Operativo</div>`;

        // Construir Tarjeta HTML
        const card = document.createElement('div');
        card.className = 'cistern-card';
        card.innerHTML = `
            <div class="card-header" style="display:flex; justify-content:space-between; border-bottom:1px solid #eee; padding-bottom:10px; margin-bottom:10px;">
                <div>
                    <h2 class="cistern-name" style="margin:0; font-size:16px;">${geo.name}</h2>
                    <p style="margin:0; font-size:12px; color:#666;">Max: ${geo.max_capacity_l.toLocaleString()} L | ${sensorHtml}</p>
                </div>
                <div style="text-align: right;">
                    <div class="volume-display" style="font-size:20px; font-weight:bold; color:#007acc;">${currentVol.liters.toLocaleString('es-MX', {maximumFractionDigits: 0})} L</div>
                    <div style="font-size: 14px; font-weight: bold; color: ${geo.color};">${fillPercentage}% Lleno</div>
                </div>
            </div>
            
            <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:10px; font-size:13px;">
                <div>
                    <div style="color:#666; font-size:11px;">ÚLTIMA HORA</div>
                    <div class="${flowClass} font-weight-bold">${flowStatusText} ${sign}${flowL.toLocaleString('es-MX', {maximumFractionDigits: 0})} L</div>
                </div>
                <div>
                    <div style="color:#666; font-size:11px;">PROMEDIO</div>
                    <div>${analysis.avgHourlyConsumption.toLocaleString('es-MX', {maximumFractionDigits: 0})} L/h</div>
                </div>
                <div>
                    <div style="color:#666; font-size:11px;">AUTONOMÍA</div>
                    <div style="font-weight:bold;">${autonomyText}</div>
                </div>
            </div>
            <div id="chart_${id}" style="width:100%; height:160px; margin-top:10px;"></div>
        `;
        container.appendChild(card);

        // Renderizar Plotly
        const volumeSeries = series.dist.map(dist => calcVolume(dist, geo).m3);
        Plotly.newPlot(`chart_${id}`, [{
            x: series.x,
            y: volumeSeries,
            type: 'scatter',
            mode: 'lines',
            line: { color: geo.color, shape: 'spline', smoothing: 0.3, width: 2 },
            fill: 'tozeroy',
            fillcolor: `${geo.color}22`
        }], {
            margin: { t: 10, b: 25, l: 40, r: 10 },
            xaxis: { showgrid: true, gridcolor: '#eee', tickformat: '%d/%m', tickangle: 0, tickfont: { size: 9, color: '#888' } },
            yaxis: { title: { text: 'Vol (m³)', font: {size: 10, color: '#888'} }, range: [0, geo.max_capacity_l / 1000], showgrid: true, gridcolor: '#eee', tickfont: { size: 9, color: '#888' } },
            staticPlot: true
        });

        // Alimentar el texto para Telegram
        const emojiStatus = isStable ? '⚖️' : (isPositive ? '⬆️' : '⬇️');
        const emojiColor = id === "CISTERNA_B" ? '🟣' : '🔵';
        const telegramSensorStatus = analysis.isStuck ? '⚠️ Alerta (Sin variación en 12h)' : '✅ Operativo';
        
        telegramCaption += `${emojiColor} *[${geo.name}](https://maps.google.com/?q=${geo.lat},${geo.lng})*\n`;
        telegramCaption += `Nivel: ${fillPercentage}% (${flowStatusText} ${emojiStatus})\n`;
        telegramCaption += `Autonomía est.: ${autonomyText}\n`;
        telegramCaption += `Tasa de consumo: ${analysis.avgHourlyConsumption.toLocaleString('es-MX', {maximumFractionDigits: 0})} L/h\n`;
        telegramCaption += `Estado Sensor: ${telegramSensorStatus}\n\n`;
    });

    // Guardar el texto en la ventana para que la Lambda lo lea
    window.telegramCaption = telegramCaption;
    setTimeout(() => { window.dashboardReady = true; }, 1500); 
});

// --- FUNCIONES MATEMÁTICAS Y DE FECHAS ---
function calcVolume(sensorDist, geo) {
    const level = Math.max(0, geo.height_m - sensorDist);
    const volumeM3 = level * geo.area_m2;
    return { m3: volumeM3, liters: volumeM3 * 1000 };
}

function formatDateForApi(date) {
    const pad = (n) => n.toString().padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

// --- FETCH HISTÓRICO (NIVEL Y BATERÍA) ---
async function fetchHistoricalData(token) {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - 5); 

    const dtEnd = formatDateForApi(endDate);
    const dtStart = formatDateForApi(startDate);

    const url = `/api/GetData?token=${token}&idSensor=15&dtStart=${encodeURIComponent(dtStart)}&dtEnd=${encodeURIComponent(dtEnd)}`;

    try {
        const response = await fetch(url);
        return await response.json();
    } catch (error) {
        console.error("Error consultando API de Nivel:", error);
        return null;
    }
}

async function fetchBatteryData(token) {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - 2); // 2 días es suficiente para capturar el último estado de batería

    const dtEnd = formatDateForApi(endDate);
    const dtStart = formatDateForApi(startDate);

    const url = `/api/GetData?token=${token}&idSensor=1&dtStart=${encodeURIComponent(dtStart)}&dtEnd=${encodeURIComponent(dtEnd)}`;

    try {
        const response = await fetch(url);
        const data = await response.json();
        if (data && data.length > 0) {
            // Retornamos el último valor registrado
            return parseFloat(data[data.length - 1].Data);
        }
        return null;
    } catch (error) {
        console.error("Error consultando Batería:", error);
        return null;
    }
}

// Procesa el JSON y limita los valores a la geometría física
function processApiData(apiRawData, geo) {
    const times = [];
    const distances = [];
    
    if (!apiRawData || apiRawData.length === 0) return { valid: false };

    apiRawData.forEach(item => {
        let dist = parseFloat(item.Data);
        if (!isNaN(dist)) {
            if (dist < 0.1) dist = 0.1; 
            if (dist > geo.height_m) dist = geo.height_m; 
            
            distances.push(dist);
            times.push(new Date(item.TimeStamp));
        }
    });

    return { x: times, dist: distances, valid: distances.length > 0 };
}

// Analiza consumos y bloqueos
function analyzeMetrics(series, geo) {
    const lastIdx = series.dist.length - 1;
    const currentTime = series.x[lastIdx].getTime();
    
    let totalConsumption24h = 0;
    let isStuck12h = true;
    let prevD = null;
    
    const last12hStart = currentTime - 12 * 3600 * 1000;
    const last24hStart = currentTime - 24 * 3600 * 1000;

    for (let i = 0; i <= lastIdx; i++) {
        const t = series.x[i].getTime();
        
        if (t >= last24hStart) {
            if (prevD !== null) {
                let diffL = calcVolume(series.dist[i], geo).liters - calcVolume(prevD, geo).liters;
                if (diffL < 0) totalConsumption24h += Math.abs(diffL);
            }
            prevD = series.dist[i];
        }
        
        if (t >= last12hStart) {
            if (series.dist[i] !== series.dist[lastIdx]) isStuck12h = false;
        }
    }
    
    return { isStuck: isStuck12h, avgHourlyConsumption: totalConsumption24h / 24 };
}

// --- RENDERIZADO PRINCIPAL ---
document.addEventListener('DOMContentLoaded', async () => {
    const container = document.getElementById('cisternsGrid');
    const now = new Date();
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' };
    const formattedDate = now.toLocaleDateString('es-MX', options);
    
    document.getElementById('updateTime').innerText = formattedDate.charAt(0).toUpperCase() + formattedDate.slice(1) + ' hrs';
    let telegramCaption = `💧 *Reporte SMAWA - IBERO CDMX*\n📅 ${formattedDate.charAt(0).toUpperCase() + formattedDate.slice(1)} hrs\n\n`;

    for (const id of Object.keys(APP_CONFIG.GEOMETRY)) {
        const geo = APP_CONFIG.GEOMETRY[id];
        if (!geo.sensor_id) continue;

        const token = APP_CONFIG.API_TOKENS[geo.sensor_id];
        
        // Ejecutamos ambas peticiones en paralelo para mayor velocidad
        const [apiRawData, batteryVal] = await Promise.all([
            fetchHistoricalData(token),
            fetchBatteryData(token)
        ]);

        const series = processApiData(apiRawData, geo);
        const batteryText = batteryVal !== null ? `🔋 ${batteryVal.toFixed(0)}%` : '🔋 N/A';
        
        if (!series.valid) {
            container.innerHTML += `<div class="cistern-card"><h2 class="cistern-name">${geo.name}</h2><div class="sensor-warning">⚠️ Sin datos del sensor en 5 días</div></div>`;
            telegramCaption += `*[${geo.name}](https://maps.google.com/?q=${geo.lat},${geo.lng})*\n⚠️ Sensor sin datos recientes.\n\n`;
            continue;
        }

        const lastIdx = series.dist.length - 1;
        const currentDist = series.dist[lastIdx];
        const currentTime = series.x[lastIdx].getTime();

        let prevDist = currentDist;
        for (let i = lastIdx; i >= 0; i--) {
            if ((currentTime - series.x[i].getTime()) >= 3600 * 1000) {
                prevDist = series.dist[i];
                break;
            }
        }

        const currentVol = calcVolume(currentDist, geo);
        const prevVol = calcVolume(prevDist, geo);

        const flowL = currentVol.liters - prevVol.liters;
        const isPositive = flowL > 0;
        const isStable = Math.abs(flowL) < 50; 
        
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

        const card = document.createElement('div');
        card.className = 'cistern-card';
        card.innerHTML = `
            <div class="card-header" style="display:flex; justify-content:space-between; border-bottom:1px solid #eee; padding-bottom:10px; margin-bottom:10px;">
                <div>
                    <h2 class="cistern-name" style="margin:0; font-size:16px;">${geo.name}</h2>
                    <p style="margin:4px 0 0 0; font-size:12px; color:#666;">
                        📏 Espejo de agua: <strong>${currentDist.toFixed(2)} m</strong> | ${batteryText}
                    </p>
                    <p style="margin:2px 0 0 0; font-size:12px; color:#666;">
                        Max: ${geo.max_capacity_l.toLocaleString()} L | ${sensorHtml}
                    </p>
                </div>
                <div style="text-align: right;">
                    <div class="volume-display" style="font-size:20px; font-weight:bold; color:#007acc;">
                        ${currentVol.liters.toLocaleString('es-MX', {maximumFractionDigits: 0})} L
                    </div>
                    <div style="font-size: 13px; color: #666;">
                        ${currentVol.m3.toLocaleString('es-MX', {maximumFractionDigits: 1})} m³
                    </div>
                    <div style="font-size: 14px; font-weight: bold; color: ${geo.color}; margin-top: 2px;">
                        ${fillPercentage}% Lleno
                    </div>
                </div>
            </div>
            
            <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:10px; font-size:13px;">
                <div>
                    <div style="color:#666; font-size:11px;">ÚLTIMA HORA</div>
                    <div class="${flowClass} font-weight-bold">${flowStatusText} ${sign}${flowL.toLocaleString('es-MX', {maximumFractionDigits: 0})} L</div>
                </div>
                <div>
                    <div style="color:#666; font-size:11px;">PROMEDIO (24h)</div>
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

        const volumeSeries = series.dist.map(dist => calcVolume(dist, geo).m3);
        Plotly.newPlot(`chart_${id}`, [{
            x: series.x,
            y: volumeSeries,
            type: 'scatter',
            mode: 'lines',
            line: { color: geo.color, shape: 'spline', smoothing: 0.2, width: 2 },
            fill: 'tozeroy',
            fillcolor: `${geo.color}22`
        }], {
            margin: { t: 10, b: 25, l: 40, r: 10 },
            xaxis: { showgrid: true, gridcolor: '#eee', tickformat: '%d/%m', tickangle: 0, tickfont: { size: 9, color: '#888' } },
            yaxis: { title: { text: 'Vol (m³)', font: {size: 10, color: '#888'} }, range: [0, geo.max_capacity_l / 1000], showgrid: true, gridcolor: '#eee', tickfont: { size: 9, color: '#888' } },
            staticPlot: true
        });

        const emojiStatus = isStable ? '⚖️' : (isPositive ? '⬆️' : '⬇️');
        const emojiColor = id === "CISTERNA_B" ? '🟣' : '🔵';
        const telegramSensorStatus = analysis.isStuck ? '⚠️ Alerta (Sin variación en 12h)' : '✅ Operativo';
        
        telegramCaption += `${emojiColor} *[${geo.name}](https://maps.google.com/?q=${geo.lat},${geo.lng})*\n`;
        telegramCaption += `Nivel: ${fillPercentage}% (${flowStatusText} ${emojiStatus}) | 🔋 ${batteryVal !== null ? batteryVal.toFixed(0) : 'N/A'}%\n`;
        telegramCaption += `Volumen: ${currentVol.liters.toLocaleString('es-MX', {maximumFractionDigits: 0})} L (${currentVol.m3.toLocaleString('es-MX', {maximumFractionDigits: 1})} m³)\n`;
        telegramCaption += `Autonomía est.: ${autonomyText}\n`;
        telegramCaption += `Tasa de consumo: ${analysis.avgHourlyConsumption.toLocaleString('es-MX', {maximumFractionDigits: 0})} L/h\n`;
        telegramCaption += `Estado Sensor: ${telegramSensorStatus}\n\n`;
    }

    window.telegramCaption = telegramCaption;
    setTimeout(() => { window.dashboardReady = true; }, 2000); 
});

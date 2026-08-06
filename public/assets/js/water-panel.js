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

// --- FETCH HISTÓRICO (AJUSTADO A 24 HORAS) ---
async function fetchHistoricalData(token) {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setHours(endDate.getHours() - 24); // Reducido a las últimas 24 horas

    const url = `/api/GetData?token=${token}&idSensor=15&dtStart=${encodeURIComponent(formatDateForApi(startDate))}&dtEnd=${encodeURIComponent(formatDateForApi(endDate))}`;

    try {
        const response = await fetch(url);
        return await response.json();
    } catch (error) {
        console.error("Error consultando API de Nivel:", error);
        return null;
    }
}

async function fetchLatestBattery(token) {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setHours(startDate.getHours() - 2); 

    const url = `/api/GetData?token=${token}&idSensor=1&dtStart=${encodeURIComponent(formatDateForApi(startDate))}&dtEnd=${encodeURIComponent(formatDateForApi(endDate))}`;

    try {
        const response = await fetch(url);
        const data = await response.json();
        if (data && data.length > 0) {
            return parseFloat(data[data.length - 1].Data);
        }
        return null;
    } catch (error) {
        console.error("Error consultando Batería:", error);
        return null;
    }
}

// Procesa el JSON, aplica calibración punto por punto a Cisterna A
function processApiData(apiRawData, geo, cisternId) {
    const times = [];
    const distances = [];
    
    if (!apiRawData || apiRawData.length === 0) return { valid: false };

    apiRawData.forEach(item => {
        let rawDist = parseFloat(item.Data);
        let currentTime = new Date(item.TimeStamp);

        if (!isNaN(rawDist)) {
            let dist = rawDist;
            
            // LOGICA DE CALIBRACIÓN: Aplicada individualmente a cada punto de tiempo
            if (cisternId === "CISTERNA_A") {
                dist = (rawDist + 0.3) * (5 / 5.09);
            }

            if (dist < 0.1) dist = 0.1; 
            if (dist > geo.height_m) dist = geo.height_m; 

            distances.push(dist);
            times.push(currentTime);
        }
    });

    return { x: times, dist: distances, valid: distances.length > 0 };
}

function analyzeMetrics(series, geo) {
    const validPoints = series.dist.map((d, i) => ({ dist: d, time: series.x[i] })).filter(p => p.dist !== null);
    if (validPoints.length === 0) return { isStuck: true, avgHourlyConsumption: 0 };

    const lastIdx = validPoints.length - 1;
    const currentTime = validPoints[lastIdx].time.getTime();
    
    let totalConsumption24h = 0;
    let isStuck12h = true;
    let prevD = null;
    
    const last12hStart = currentTime - 12 * 3600 * 1000;
    const last24hStart = currentTime - 24 * 3600 * 1000;

    validPoints.forEach(p => {
        const t = p.time.getTime();
        if (t >= last24hStart) {
            if (prevD !== null) {
                let diffL = calcVolume(p.dist, geo).liters - calcVolume(prevD, geo).liters;
                if (diffL < 0) totalConsumption24h += Math.abs(diffL);
            }
            prevD = p.dist;
        }
        if (t >= last12hStart) {
            if (p.dist !== validPoints[lastIdx].dist) isStuck12h = false;
        }
    });
    
    return { isStuck: isStuck12h, avgHourlyConsumption: totalConsumption24h / 24 };
}

// --- RENDERIZADO PRINCIPAL ---
document.addEventListener('DOMContentLoaded', async () => {
    
    // LOGICA DE AUTO-REFRESH: Recargar la página automáticamente cada hora (3,600,000 ms)
    setInterval(() => {
        window.location.reload();
    }, 3600000);

    const container = document.getElementById('cisternsGrid');
    const now = new Date();
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' };
    const formattedDate = now.toLocaleDateString('es-MX', options);
    
    document.getElementById('updateTime').innerText = formattedDate.charAt(0).toUpperCase() + formattedDate.slice(1) + ' hrs';
    let telegramCaption = `💧 *Reporte SMAWA - IBERO CDMX*\n📅 ${formattedDate.charAt(0).toUpperCase() + formattedDate.slice(1)} hrs\n\n`;

    const activeCisternKeys = Object.keys(APP_CONFIG.GEOMETRY).filter(id => APP_CONFIG.GEOMETRY[id].sensor_id !== null);

    const promises = activeCisternKeys.map(async (id) => {
        const geo = APP_CONFIG.GEOMETRY[id];
        const token = APP_CONFIG.API_TOKENS[geo.sensor_id];
        
        const [apiRawData, batteryVal] = await Promise.all([
            fetchHistoricalData(token),
            fetchLatestBattery(token)
        ]);

        return { id, geo, apiRawData, batteryVal };
    });

    const results = await Promise.all(promises);

    for (const res of results) {
        const { id, geo, apiRawData, batteryVal } = res;
        const series = processApiData(apiRawData, geo, id);
        const batteryText = batteryVal !== null ? `🔋 ${batteryVal.toFixed(0)}%` : '🔋 N/A';
        const mapsUrl = `https://maps.google.com/?q=${geo.lat},${geo.lng}`;

        if (!series.valid) {
            container.innerHTML += `<div class="cistern-card"><h2 class="cistern-name">${geo.name}</h2><div class="sensor-warning">⚠️ Sin datos recientes</div></div>`;
            telegramCaption += `*[${geo.name}](${mapsUrl})*\n⚠️ Sensor sin datos recientes.\n\n`;
            continue;
        }

        let lastValidIdx = series.dist.length - 1;
        while(lastValidIdx >= 0 && series.dist[lastValidIdx] === null) {
            lastValidIdx--;
        }
        
        if (lastValidIdx < 0) continue;

        const currentDist = series.dist[lastValidIdx];
        const currentTime = series.x[lastValidIdx].getTime();

        let prevDist = currentDist;
        for (let i = lastValidIdx; i >= 0; i--) {
            if (series.dist[i] !== null && (currentTime - series.x[i].getTime()) >= 3600 * 1000) {
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
                    <p style="margin:3px 0; font-size:11px;">
                        <a href="${mapsUrl}" target="_blank" style="color: #007acc; text-decoration: none; font-weight: 500;">
                            📍 ${geo.lat}, ${geo.lng} ↗
                        </a>
                    </p>
                    <p style="margin:2px 0 0 0; font-size:12px; color:#666;">
                        📏 Espejo de agua: <strong>${currentDist.toFixed(2)} m</strong> ${id === "CISTERNA_A" ? '<span style="color:#007acc; font-size:10px;">(Calibrada)</span>' : ''} | ${batteryText}
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

        const volumeSeries = series.dist.map(dist => dist !== null ? calcVolume(dist, geo).m3 : null);
        
        // GRÁFICA AJUSTADA A HISTOGRAMA (BARRAS) CON AUTO-SCALE Y ANCHO HOMOLOGADO
        Plotly.newPlot(`chart_${id}`, [{
            x: series.x,
            y: volumeSeries,
            type: 'bar',
            marker: { color: geo.color },
            width: 1000 * 60 * 4 // Fuerza el ancho exacto de 4 minutos (240,000 ms) para alinear todas las gráficas
        }], {
            margin: { t: 10, b: 25, l: 40, r: 10 },
            xaxis: { 
                showgrid: true, 
                gridcolor: '#eee', 
                tickformat: '%H:%M', 
                tickangle: -45, 
                tickfont: { size: 9, color: '#888' } 
            },
            yaxis: { 
                title: { text: 'Vol (m³)', font: {size: 10, color: '#888'} }, 
                autorange: true, // Deja que Plotly escale automáticamente la altura según los datos
                showgrid: true, 
                gridcolor: '#eee', 
                tickfont: { size: 9, color: '#888' } 
            },
            staticPlot: true
            // Eliminamos 'bargap' porque el 'width' temporal ya controla el espaciado
        });

        const emojiStatus = isStable ? '⚖️' : (isPositive ? '⬆️' : '⬇️');
        const emojiColor = id === "CISTERNA_B" ? '🟣' : '🔵';
        const telegramSensorStatus = analysis.isStuck ? '⚠️ Alerta (Sin variación en 12h)' : '✅ Operativo';
        
        telegramCaption += `${emojiColor} *[${geo.name}](${mapsUrl})*\n`;
        telegramCaption += `Nivel: ${fillPercentage}% (${flowStatusText} ${emojiStatus}) | ${batteryText}\n`;
        telegramCaption += `Volumen: ${currentVol.liters.toLocaleString('es-MX', {maximumFractionDigits: 0})} L (${currentVol.m3.toLocaleString('es-MX', {maximumFractionDigits: 1})} m³)\n`;
        telegramCaption += `Autonomía est.: ${autonomyText}\n`;
        telegramCaption += `Tasa de consumo: ${analysis.avgHourlyConsumption.toLocaleString('es-MX', {maximumFractionDigits: 0})} L/h\n`;
        telegramCaption += `Estado Sensor: ${telegramSensorStatus}\n\n`;
    }

    window.telegramCaption = telegramCaption;
    setTimeout(() => { window.dashboardReady = true; }, 1000); 
});

// --- FUNCIONES MATEMÁTICAS Y DE FECHAS ---
function calcVolume(sensorDist, geo) {
    // Al ser PIEZÓMETRO, la lectura (sensorDist) es directamente el NIVEL de agua.
    // Usamos Math.min para topar el cálculo a la altura máxima de la cisterna en caso de picos de ruido en el sensor.
    const level = Math.min(sensorDist, geo.height_m); 
    const volumeM3 = level * geo.area_m2;
    
    return { m3: volumeM3, liters: volumeM3 * 1000 };
}

function formatDateForApi(date) {
    const pad = (n) => n.toString().padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

// --- FETCH HISTÓRICO ---
async function fetchHistoricalData(token) {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setHours(endDate.getHours() - 168); 

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

function processApiData(apiRawData, geo, cisternId) {
    const times = [];
    const distances = [];
    
    if (!apiRawData || apiRawData.length === 0) return { valid: false };

    let lastTime = null;
    // Límite de tiempo: Si no hay datos en 15 minutos, rompe la línea en la gráfica
    const MAX_GAP_MS = 15 * 60 * 1000; 

    apiRawData.forEach(item => {
        let rawDist = parseFloat(item.Data);
        let currentTime = new Date(item.TimeStamp);

        if (!isNaN(rawDist)) {
            let dist = rawDist;
            
            // --- NUEVA ECUACIÓN DE CALIBRACIÓN IDEAL ---
            if (cisternId === "CISTERNA_A") {
                dist = (rawDist * 0.8478) + 0.5709;
            }
            
            if (dist < 0.1) dist = 0.1; 
            if (dist > geo.height_m) dist = geo.height_m; 

            // Lógica para detectar vacíos de conexión (Inyección de null)
            if (lastTime !== null) {
                let diff = currentTime.getTime() - lastTime.getTime();
                if (diff > MAX_GAP_MS) {
                    times.push(new Date(lastTime.getTime() + 1000)); 
                    distances.push(null); // Obliga a Plotly a romper el trazo
                }
            }

            distances.push(dist);
            times.push(currentTime);
            lastTime = currentTime;
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
                // FILTRO DE RUIDO: Tolerar variaciones menores a 1.5 cm
                if ((p.dist - prevD) > 0.015) { 
                    let diffL = calcVolume(p.dist, geo).liters - calcVolume(prevD, geo).liters;
                    totalConsumption24h += Math.abs(diffL);
                    prevD = p.dist; 
                } else if ((prevD - p.dist) > 0.015) { 
                    prevD = p.dist;
                }
            } else {
                prevD = p.dist;
            }
        }
        if (t >= last12hStart) {
            if (Math.abs(p.dist - validPoints[lastIdx].dist) > 0.015) isStuck12h = false;
        }
    });
    
    return { isStuck: isStuck12h, avgHourlyConsumption: totalConsumption24h / 24 };
}

// Variable global para almacenar los datos de las gráficas
window.chartDataStore = {};

function updateCharts(hours) {
    const nowMs = new Date().getTime();
    const startMs = nowMs - (hours * 3600 * 1000);
    const xAxisFormat = hours > 24 ? '%d/%m %H:%M' : '%H:%M';

    Object.keys(window.chartDataStore).forEach(id => {
        const data = window.chartDataStore[id];
        const filteredX = [];
        const filteredY = [];
        
        let minY = Infinity;
        let maxY = -Infinity;
        
        for(let i = 0; i < data.x.length; i++) {
            if(data.x[i].getTime() >= startMs) {
                filteredX.push(data.x[i]);
                filteredY.push(data.y[i]);
                
                // Buscamos el mínimo y máximo real para encuadrar la sierra
                if (data.y[i] !== null) {
                    if (data.y[i] < minY) minY = data.y[i];
                    if (data.y[i] > maxY) maxY = data.y[i];
                }
            }
        }

        // Si la cisterna no tiene datos en este periodo, evitamos errores matemáticos
        if (minY === Infinity) { minY = 0; maxY = 10; }

        // Calculamos un margen del 5% arriba y abajo para que la curva no toque los bordes
        const rangeDiff = maxY - minY;
        const padding = rangeDiff === 0 ? maxY * 0.05 : rangeDiff * 0.1; 
        const yRange = [Math.max(0, minY - padding), maxY + padding];

        // --- ACTUALIZACIÓN DE GRÁFICA A LÍNEAS ---
        Plotly.newPlot(`chart_${id}`, [{
            x: filteredX,
            y: filteredY,
            type: 'scatter',
            mode: 'lines',
            connectgaps: false, 
            line: { color: data.geo.color, width: 2 },
            fill: 'tozeroy',
            fillcolor: `${data.geo.color}22`
        }], {
            margin: { t: 10, b: 25, l: 40, r: 10 },
            xaxis: { 
                range: [new Date(startMs), new Date(nowMs)], // <--- FIX 1: Eje X anclado a la ventana de tiempo real
                showgrid: true, gridcolor: '#eee', 
                tickformat: xAxisFormat,
                tickangle: 0, 
                tickfont: { size: 9, color: '#888' } 
            },
            yaxis: { 
                range: yRange, // <--- FIX 2: Eje Y encuadrado dinámicamente en los datos (Zoom automático)
                title: { text: 'Vol (m³)', font: {size: 10, color: '#888'} }, 
                showgrid: true, gridcolor: '#eee', 
                tickfont: { size: 9, color: '#888' } 
            },
            staticPlot: true
        });
    });
}

// --- RENDERIZADO PRINCIPAL ---
document.addEventListener('DOMContentLoaded', async () => {
    // --- LÓGICA DE ACTUALIZACIÓN SINCRONIZADA ---
    console.log('⏰ Configurando actualización sincronizada...');
    
    function scheduleNextReload() {
        const now = new Date();
        // Calculamos los milisegundos exactos que faltan para el inicio de la siguiente hora
        const msUntilNextHour = (60 - now.getMinutes()) * 60000 - (now.getSeconds() * 1000);
        
        console.log(`⏳ Próxima actualización en aprox ${Math.round(msUntilNextHour / 60000)} minutos.`);
        
        // Programamos la recarga para que ocurra exactamente en ese milisegundo
        setTimeout(() => {
            window.location.reload();
        }, msUntilNextHour);
    }

    // Iniciamos el cronómetro al cargar la página
    scheduleNextReload();

    const container = document.getElementById('cisternsGrid');
    const header = document.querySelector('.header');
    
    const filterHtml = `
        <div class="time-filters" style="display:flex; justify-content:center; gap:10px; margin-bottom:15px; flex-wrap: wrap;">
            <button class="filter-btn" data-hours="168">7 Días</button>
            <button class="filter-btn active" data-hours="24">24 Hrs</button>
            <button class="filter-btn" data-hours="12">12 Hrs</button>
            <button class="filter-btn" data-hours="8">8 Hrs</button>
            <button class="filter-btn" data-hours="4">4 Hrs</button>
            <button class="filter-btn" data-hours="2">2 Hrs</button>
        </div>
    `;
    header.insertAdjacentHTML('afterend', filterHtml);

    const style = document.createElement('style');
    style.innerHTML = `
        .filter-btn { padding: 6px 15px; border: 1px solid #007acc; background: white; color: #007acc; border-radius: 15px; cursor: pointer; font-size: 13px; font-weight: bold; transition: all 0.2s; outline: none;}
        .filter-btn.active { background: #007acc; color: white; }
        .filter-btn:hover { background: #e6f2ff; }
        .filter-btn.active:hover { background: #005999; }
    `;
    document.head.appendChild(style);

    const now = new Date();
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' };
    const formattedDate = now.toLocaleDateString('es-MX', options);
    
    document.getElementById('updateTime').innerText = formattedDate.charAt(0).toUpperCase() + formattedDate.slice(1) + ' hrs';
    let telegramCaption = `💧 *Reporte SMAWA - IBERO CDMX*\n📅 ${formattedDate.charAt(0).toUpperCase() + formattedDate.slice(1)} hrs\n\n`;

    const activeCisternKeys = Object.keys(APP_CONFIG.GEOMETRY).filter(id => APP_CONFIG.GEOMETRY[id].sensor_id !== null);

    const promises = activeCisternKeys.map(async (id) => {
        const geo = APP_CONFIG.GEOMETRY[id];
        const token = APP_CONFIG.API_TOKENS[geo.sensor_id];
        const [apiRawData, batteryVal] = await Promise.all([ fetchHistoricalData(token), fetchLatestBattery(token) ]);
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

        // Buscar el último índice válido (ignorando los huecos de la gráfica)
        let lastValidIdx = series.dist.length - 1;
        while(lastValidIdx >= 0 && series.dist[lastValidIdx] === null) { lastValidIdx--; }
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
        
        let rawFlowL = currentVol.liters - prevVol.liters;
        
        const isStable = Math.abs(currentDist - prevDist) <= 0.015; 
        
        const flowL = isStable ? 0 : rawFlowL;
        const isPositive = flowL > 0;
        
        const flowClass = isStable ? '' : (isPositive ? 'flow-positive' : 'flow-negative');
        const flowStatusText = isStable ? 'Estable' : (isPositive ? 'Recarga' : 'Gasto');
        const sign = isPositive && !isStable ? '+' : '';
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
                        📏 Nivel de agua: <strong>${currentDist.toFixed(2)} m</strong> ${id === "CISTERNA_A" ? '<span style="color:#007acc; font-size:10px;">(Calibrada)</span>' : ''} | ${batteryText}
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
                <div class="metric-box">
                    <div style="color:#666; font-size:11px; margin-bottom:4px;">ÚLTIMA HORA</div>
                    <div class="${flowClass} font-weight-bold">${flowStatusText} ${sign}${Math.abs(flowL).toLocaleString('es-MX', {maximumFractionDigits: 0})} L</div>
                </div>
                <div class="metric-box">
                    <div style="color:#666; font-size:11px; margin-bottom:4px;">PROMEDIO GASTO (24h)</div>
                    <div style="font-weight:bold; color:#333;">${analysis.avgHourlyConsumption.toLocaleString('es-MX', {maximumFractionDigits: 0})} L/h</div>
                </div>
                <div class="metric-box">
                    <div style="color:#666; font-size:11px; margin-bottom:4px;">AUTONOMÍA</div>
                    <div style="font-weight:bold; color:#333;">${autonomyText}</div>
                </div>
            </div>
            <div id="chart_${id}" style="width:100%; height:160px; margin-top:10px;"></div>
        `;
        container.appendChild(card);

        const volumeSeries = series.dist.map(dist => dist !== null ? calcVolume(dist, geo).m3 : null);
        window.chartDataStore[id] = { geo: geo, x: series.x, y: volumeSeries };

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

    updateCharts(24);

    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            const hrs = parseInt(e.target.getAttribute('data-hours'));
            updateCharts(hrs);
        });
    });

    window.telegramCaption = telegramCaption;
    setTimeout(() => { window.dashboardReady = true; }, 1000); 
});

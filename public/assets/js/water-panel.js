// --- FUNCIONES MATEMÁTICAS Y DE FECHAS ---
function calcVolume(sensorDist, geo) {
    const level = Math.min(sensorDist, geo.height_m); 
    const volumeM3 = level * geo.area_m2;
    return { m3: volumeM3, liters: volumeM3 * 1000 };
}

function formatDateForApi(date) {
    const pad = (n) => n.toString().padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

// --- ICONOS SVG ---
const ICONS = {
    pin: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>`,
    ruler: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.3 15.3l-7.6-7.6a2 2 0 0 0-2.8 0l-1.4 1.4a2 2 0 0 0 0 2.8l7.6 7.6a2 2 0 0 0 2.8 0l1.4-1.4a2 2 0 0 0 0-2.8z"></path><path d="M14.5 10.5L11 14"></path><path d="M17.5 13.5L14 17"></path></svg>`,
    battery: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="16" height="10" rx="2" ry="2"></rect><line x1="22" y1="11" x2="22" y2="13"></line></svg>`,
    eye: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>`,
    barChart: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line></svg>`,
    lineChart: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline></svg>`,
    stable: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="4" y1="12" x2="20" y2="12"></line></svg>`,
    up: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="19" x2="12" y2="5"></line><polyline points="5 12 12 5 19 12"></polyline></svg>`,
    down: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><polyline points="19 12 12 19 5 12"></polyline></svg>`,
    warning: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#d35400" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>`,
    check: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#27ae60" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>`,
    globe: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg>`,
    calendar: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>`
};

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
        if (data && data.length > 0) return parseFloat(data[data.length - 1].Data);
        return null;
    } catch (error) {
        return null;
    }
}

function processApiData(apiRawData, geo, cisternId) {
    const times = [];
    const distances = [];
    if (!apiRawData || apiRawData.length === 0) return { valid: false };

    let lastTime = null;
    const MAX_GAP_MS = 15 * 60 * 1000; 

    apiRawData.forEach(item => {
        let rawDist = parseFloat(item.Data);
        let currentTime = new Date(item.TimeStamp);

        if (!isNaN(rawDist)) {
            let dist = rawDist;
            if (cisternId === "CISTERNA_A") dist = (rawDist * 0.8478) + 0.5709;
            if (dist < 0.1) dist = 0.1; 
            if (dist > geo.height_m) dist = geo.height_m; 

            if (lastTime !== null) {
                let diff = currentTime.getTime() - lastTime.getTime();
                if (diff > MAX_GAP_MS) {
                    times.push(new Date(lastTime.getTime() + 1000)); 
                    distances.push(null); 
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
                if ((p.dist - prevD) > 0.015) { 
                    let diffL = calcVolume(p.dist, geo).liters - calcVolume(prevD, geo).liters;
                    totalConsumption24h += Math.abs(diffL);
                    prevD = p.dist; 
                } else if ((prevD - p.dist) > 0.015) { 
                    prevD = p.dist;
                }
            } else { prevD = p.dist; }
        }
        if (t >= last12hStart) {
            if (Math.abs(p.dist - validPoints[lastIdx].dist) > 0.015) isStuck12h = false;
        }
    });
    
    return { isStuck: isStuck12h, avgHourlyConsumption: totalConsumption24h / 24 };
}

window.chartDataStore = {};

function updateCharts(hours) {
    const urlParams = new URLSearchParams(window.location.search);
    const isBot = urlParams.get('bot') === 'true';

    // 🔥 FIX DEFINITIVO: Ajustamos el borde derecho (nowMs) restando 6 horas.
    // Como la Lambda está en UTC puro, esto alinea el eje X exactamente con el último dato.
    const realNowMs = new Date().getTime();
    const nowMs = isBot ? realNowMs - (6 * 3600 * 1000) : realNowMs;
    const startMs = nowMs - (hours * 3600 * 1000);
    
    const xAxisFormat = hours > 24 ? '%d/%m %H:%M' : '%H:%M';
    window.isHourlyBarChart = window.isHourlyBarChart || {};

    Object.keys(window.chartDataStore).forEach(id => {
        if (window.isHourlyBarChart[id] === undefined) {
            if (isBot) {
                window.isHourlyBarChart[id] = true;
            } else {
                const storedVal = sessionStorage.getItem(`isHourlyBarChart_${id}`);
                window.isHourlyBarChart[id] = storedVal !== null ? storedVal === 'true' : true;
            }
        }

        const data = window.chartDataStore[id];
        let filteredX = [];
        let filteredY = [];
        const multiplier = (id === 'CISTERNA_C') ? 2 : 1;
        
        // 🔥 LOS DATOS SE QUEDAN INTACTOS. Solo comparamos contra startMs.
        for(let i = 0; i < data.x.length; i++) {
            if(data.x[i].getTime() >= startMs) {
                filteredX.push(data.x[i]);
                filteredY.push(data.y[i] !== null ? (data.y[i] * multiplier) : null);
            }
        }

        let finalX = filteredX;
        let finalY = filteredY;
        let chartType = 'scatter';
        let chartMode = 'lines';
        let chartProps = { connectgaps: false, line: { color: data.geo.color, width: 2 }, fill: 'tozeroy', fillcolor: `${data.geo.color}22` };

        if (window.isHourlyBarChart[id]) {
            const hourlyData = {};
            for (let i = 0; i < filteredX.length; i++) {
                if (filteredY[i] === null) continue;
                const d = new Date(filteredX[i]);
                d.setMinutes(0, 0, 0);
                const ts = d.getTime();
                if (!hourlyData[ts]) { hourlyData[ts] = { sum: 0, count: 0 }; }
                hourlyData[ts].sum += filteredY[i];
                hourlyData[ts].count += 1;
            }
            finalX = [];
            finalY = [];
            Object.keys(hourlyData).sort().forEach(ts => {
                finalX.push(new Date(parseInt(ts)));
                finalY.push(hourlyData[ts].sum / hourlyData[ts].count);
            });
            chartType = 'bar';
            chartMode = undefined;
            chartProps = { marker: { color: data.geo.color, opacity: 0.8 } };
        }

        let minY = Infinity; let maxY = -Infinity;
        for (let i = 0; i < finalY.length; i++) {
            if (finalY[i] !== null) {
                if (finalY[i] < minY) minY = finalY[i];
                if (finalY[i] > maxY) maxY = finalY[i];
            }
        }
        if (minY === Infinity) { minY = 0; maxY = 10; }
        const padding = (maxY - minY) === 0 ? maxY * 0.05 : (maxY - minY) * 0.1; 
        const yRange = [Math.max(0, minY - padding), Math.max(0.1, maxY + padding)];

        Plotly.newPlot(`chart_${id}`, [{
            x: finalX, y: finalY, type: chartType, mode: chartMode, ...chartProps
        }], {
            margin: { t: 10, b: 25, l: 40, r: 10 },
            xaxis: { range: [new Date(startMs), new Date(nowMs)], showgrid: true, gridcolor: '#eee', tickformat: xAxisFormat, tickangle: 0, tickfont: { size: 9, color: '#888' } },
            yaxis: { range: yRange, title: { text: 'Vol (m³)', font: {size: 10, color: '#888'} }, showgrid: true, gridcolor: '#eee', tickfont: { size: 9, color: '#888' } },
            staticPlot: true,
            plot_bgcolor: "transparent",
            paper_bgcolor: "transparent"
        }, { displayModeBar: false, responsive: true });
    });
}

document.addEventListener('DOMContentLoaded', async () => {
    // --- PANTALLA DE CARGA INICIAL (LOADER) ---
    const loader = document.createElement('div');
    loader.id = 'smawa-loader';
    loader.innerHTML = `
        <div style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: #0a192f; z-index: 9999; display: flex; flex-direction: column; justify-content: center; align-items: center;">
            <div style="width: 45px; height: 45px; border: 4px solid #1a365d; border-top: 4px solid #007acc; border-radius: 50%; animation: spin 1s linear infinite;"></div>
            <div style="margin-top: 15px; font-weight: 600; color: #ffffff; font-family: sans-serif; font-size: 14px;">Consultando telemetría...</div>
            <style>@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }</style>
        </div>
    `;
    document.body.appendChild(loader);

    console.log('⏰ Configurando actualización sincronizada...');
    
    function scheduleNextReload() {
        const now = new Date();
        const msUntilNextHour = (60 - now.getMinutes()) * 60000 - (now.getSeconds() * 1000);
        setTimeout(() => { window.location.reload(); }, msUntilNextHour);
    }
    scheduleNextReload();

    const container = document.getElementById('cisternsGrid');

    const urlParams = new URLSearchParams(window.location.search);
    const isBot = urlParams.get('bot') === 'true';

    // 🔥 FIX 2: Cálculo blindado (UTC-6) aislando la Lambda de su propio reloj roto
    let formattedDate = "";
    let captionDate = "";
    const pad2 = (n) => n.toString().padStart(2, '0');

    if (isBot) {
        const realNow = new Date();
        const nowMx = new Date(realNow.getTime() - (6 * 3600 * 1000));
        
        const dias = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
        const meses = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
        
        const hrNum = pad2(nowMx.getUTCHours());
        const minNum = pad2(nowMx.getUTCMinutes());
        const dayNum = pad2(nowMx.getUTCDate());
        const monthNum = pad2(nowMx.getUTCMonth() + 1);
        const yearNum = nowMx.getUTCFullYear();
        
        // Texto para el Header de la foto
        formattedDate = `${dias[nowMx.getUTCDay()]}, ${nowMx.getUTCDate()} de ${meses[nowMx.getUTCMonth()]} de ${yearNum}, ${hrNum}:${minNum}`;
        // Texto para el pie del mensaje de Telegram
        captionDate = `${dayNum}/${monthNum}/${yearNum}, ${hrNum}:${minNum}`;
    } else {
        const now = new Date();
        formattedDate = now.toLocaleDateString('es-MX', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });
        captionDate = `${pad2(now.getDate())}/${pad2(now.getMonth() + 1)}/${now.getFullYear()}, ${pad2(now.getHours())}:${pad2(now.getMinutes())}`;
    }

    // --- ENCABEZADO Y FILTROS INTEGRADOS ---
    const filterHtml = `
        <div style="text-align: center; margin-bottom: 20px; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 15px; margin-top: 10px;">
            <div style="display: flex; justify-content: center; align-items: center; gap: 15px;">
                <img src="assets/images/logo-smability.png" alt="Smability" style="height: 35px; filter: brightness(0) invert(1);">
                <h2 style="margin: 0; font-size: 18px; color: #ffffff; text-transform: uppercase; letter-spacing: 1px; font-weight: 700; text-align: left;">Monitoreo de Red Cisternas IBERO CDMX</h2>
            </div>
            <div style="font-size: 13px; color: #ffffff; font-weight: bold; margin-top: 10px; display: flex; justify-content: center; align-items: center;">
                <span class="svg-icon" style="margin-right: 6px;">${ICONS.calendar}</span> ${formattedDate.charAt(0).toUpperCase() + formattedDate.slice(1)} 
            </div>
        </div>
        <div class="time-filters">
            <button class="filter-btn" data-hours="168">7 Días</button>
            <button class="filter-btn active" data-hours="24">24 Hrs</button>
            <button class="filter-btn" data-hours="12">12 Hrs</button>
            <button class="filter-btn" data-hours="8">8 Hrs</button>
            <button class="filter-btn" data-hours="4">4 Hrs</button>
            <button class="filter-btn" data-hours="2">2 Hrs</button>
        </div>
    `;

    const activeCisternKeys = Object.keys(APP_CONFIG.GEOMETRY)
        .filter(id => APP_CONFIG.GEOMETRY[id].sensor_id !== null)
        .sort((a, b) => {
            if (a === 'CISTERNA_C') return -1;
            if (b === 'CISTERNA_C') return 1;
            return 0;
        });

    const promises = activeCisternKeys.map(async (id) => {
        const geo = APP_CONFIG.GEOMETRY[id];
        const token = APP_CONFIG.API_TOKENS[geo.sensor_id];
        const [apiRawData, batteryVal] = await Promise.all([ fetchHistoricalData(token), fetchLatestBattery(token) ]);
        return { id, geo, apiRawData, batteryVal };
    });

    const results = await Promise.all(promises);

    window.botTelegramData = {};

    for (const res of results) {
        const { id, geo, apiRawData, batteryVal } = res;
        const series = processApiData(apiRawData, geo, id);
        
        const batteryText = batteryVal !== null ? `<span class="svg-icon" style="color: #27ae60;">${ICONS.battery}</span> ${batteryVal.toFixed(0)}%` : `<span class="svg-icon">${ICONS.battery}</span> N/A`;
        const mapsUrl = `https://maps.google.com/?q=${geo.lat},${geo.lng}`;
        
        if (id === 'CISTERNA_C') {
            container.insertAdjacentHTML('beforeend', filterHtml);
        }

        if (!series.valid) {
            container.innerHTML += `<div class="cistern-card"><h2 class="cistern-name">${geo.name}</h2><div class="sensor-warning"><span class="svg-icon">${ICONS.warning}</span> Sin datos recientes</div></div>`;
            continue;
        }

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
        
        const analysis = analyzeMetrics(series, geo);

        if (id === 'CISTERNA_C') {
            currentVol.liters *= 2;
            currentVol.m3 *= 2;
            rawFlowL *= 2;
            analysis.avgHourlyConsumption *= 2;
            geo.max_capacity_l *= 2; 
        }

        const flowL = isStable ? 0 : rawFlowL;
        const isPositive = flowL > 0;
        const flowClass = isStable ? '' : (isPositive ? 'flow-positive' : 'flow-negative');
        const flowStatusText = isStable ? 'Estable' : (isPositive ? 'Recarga' : 'Gasto');
        const sign = isPositive && !isStable ? '+' : '';
        const fillPercentage = ((currentVol.liters / geo.max_capacity_l) * 100).toFixed(1);

        let autonomyText = "N/A";
        if (analysis.avgHourlyConsumption > 0) {
            const daysLeft = currentVol.liters / (analysis.avgHourlyConsumption * 24);
            autonomyText = daysLeft > 30 ? "+30 días" : `${daysLeft.toFixed(1)} días`;
        }
        
        const sensorHtml = analysis.isStuck 
            ? `<div class="sensor-warning" style="display: inline-block; color: #d35400;"><span class="svg-icon">${ICONS.warning}</span> ALERTA: Sin variación 12h</div>` 
            : `<div class="sensor-ok" style="display: inline-block; color: #27ae60;"><span class="svg-icon">${ICONS.check}</span> Operativo</div>`;

        const TARIFA_AGUA_M3 = 80.00; 
        const costoPorLitro = TARIFA_AGUA_M3 / 1000;
        
        const costoPorHoraMXN = Math.round(analysis.avgHourlyConsumption * costoPorLitro);
        const costoUltimaHoraMXN = Math.round(Math.abs(flowL) * costoPorLitro);

        const moneyHtmlPromedio = id !== 'CISTERNA_B' 
            ? `<div style="font-size:10px; color:#d35400; font-weight:bold; margin-top:2px;">($${costoPorHoraMXN.toLocaleString('es-MX')} MXN/h)</div>` 
            : ``;
            
        const moneyHtmlUltimaHora = id !== 'CISTERNA_B' 
            ? `<div style="font-size:10px; color:#d35400; font-weight:bold; margin-top:2px;">($${costoUltimaHoraMXN.toLocaleString('es-MX')} MXN)</div>` 
            : ``;

        // Llenar el objeto de datos para la Lambda
        if (id === 'CISTERNA_C') {
            window.botTelegramData.C = { porcentaje: fillPercentage, litros: currentVol.liters.toLocaleString('es-MX', {maximumFractionDigits: 0}), autonomia: autonomyText };
        } else if (id === 'CISTERNA_B') {
            window.botTelegramData.B = { porcentaje: fillPercentage, gastoPromedio: analysis.avgHourlyConsumption.toLocaleString('es-MX', {maximumFractionDigits: 0}) };
        }

        const card = document.createElement('div');
        card.className = 'cistern-card';
        
        if (id === 'CISTERNA_A') {
            card.innerHTML = `
                <div class="card-header" style="display:flex; justify-content:space-between; border-bottom:1px solid #eee; padding-bottom:10px; margin-bottom:10px;">
                    <div>
                        <h2 class="cistern-name" style="margin:0; font-size:16px; color:#333;">${geo.name} (Sonda de Control)</h2>
                        <p style="margin:3px 0; font-size:11px;">
                            <a href="${mapsUrl}" target="_blank" style="color: #007acc; text-decoration: none; font-weight: 500;"><span class="svg-icon">${ICONS.pin}</span> ${geo.lat}, ${geo.lng} ↗</a>
                        </p>
                        <p style="margin:2px 0 0 0; font-size:12px; color:#666;">
                            <span class="svg-icon">${ICONS.ruler}</span> Nivel de agua: <strong>${currentDist.toFixed(2)} m</strong> <span style="color:#007acc; font-size:10px;">(Calibrada)</span> | ${batteryText}
                        </p>
                    </div>
                    <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 6px;">
                        <button id="toggleCisternaA" style="padding: 4px 8px; font-size: 11px; cursor: pointer; border: 1px solid #ccc; border-radius: 4px; background: #f8f9fa;"><span class="svg-icon">${ICONS.eye}</span> Mostrar</button>
                        <button id="toggleChartBtn_${id}" style="display: none; padding: 4px 8px; font-size: 11px; background-color: #f8f9fa; border: 1px solid #ccc; border-radius: 6px; cursor: pointer; color: #333; font-weight: 500; transition: all 0.2s;"><span class="svg-icon">${ICONS.barChart}</span> Promedio por Hora</button>
                    </div>
                </div>
                <div id="body_CISTERNA_A" style="display: none; width: 100%; max-width: 100%; overflow: hidden;">
                    <div id="chart_${id}" style="width:100% !important; min-width: 0 !important; height:160px; margin-top:10px; overflow: hidden !important;"></div>
                </div>
            `;
        } else {
            const footerHtml = id === 'CISTERNA_B' ? `
                <div style="text-align: center; margin-top: 20px; padding-top: 12px; border-top: 1px solid #eee;">
                    <a href="https://smability.io" target="_blank" style="text-decoration: none; color: #666; font-size: 12px; font-weight: 600; display: flex; align-items: center; justify-content: center; transition: color 0.2s;">
                        <span class="svg-icon" style="margin-right: 6px;">${ICONS.globe}</span> © ${new Date().getFullYear()} smability.io
                    </a>
                </div>
            ` : '';

            card.innerHTML = `
                <div class="card-header" style="display:flex; justify-content:space-between; border-bottom:1px solid #eee; padding-bottom:10px; margin-bottom:10px;">
                    <div>
                        <h2 class="cistern-name" style="margin:0; font-size:16px; color:#333;">${id === 'CISTERNA_C' ? geo.name + ' (Total Unificado)' : geo.name}</h2>
                        <p style="margin:3px 0; font-size:11px;">
                            <a href="${mapsUrl}" target="_blank" style="color: #007acc; text-decoration: none; font-weight: 500;"><span class="svg-icon">${ICONS.pin}</span> ${geo.lat}, ${geo.lng} ↗</a>
                        </p>
                        <p style="margin:2px 0 0 0; font-size:12px; color:#666;">
                            <span class="svg-icon">${ICONS.ruler}</span> Nivel de agua: <strong>${currentDist.toFixed(2)} m</strong> | ${batteryText}
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
                        <button id="toggleChartBtn_${id}" style="margin-top: 8px; padding: 4px 8px; font-size: 11px; background-color: #f8f9fa; border: 1px solid #ccc; border-radius: 6px; cursor: pointer; color: #333; font-weight: 500; transition: all 0.2s;">
                            <span class="svg-icon">${ICONS.barChart}</span> Promedio por Hora
                        </button>
                    </div>
                </div>
                
                <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:10px; font-size:13px;">
                    <div class="metric-box">
                        <div style="color:#666; font-size:11px; margin-bottom:4px;">ÚLTIMA HORA</div>
                        <div class="${flowClass} font-weight-bold" style="display:flex; align-items:center; justify-content:center;">
                            ${isStable ? `<span class="svg-icon">${ICONS.stable}</span>` : (isPositive ? `<span class="svg-icon" style="color: #27ae60;">${ICONS.up}</span>` : `<span class="svg-icon" style="color: #e74c3c;">${ICONS.down}</span>`)}
                            ${flowStatusText} ${sign}${Math.abs(flowL).toLocaleString('es-MX', {maximumFractionDigits: 0})} L
                        </div>
                        ${moneyHtmlUltimaHora}
                    </div>
                    <div class="metric-box">
                        <div style="color:#666; font-size:11px; margin-bottom:4px;">PROMEDIO GASTO (24h)</div>
                        <div style="font-weight:bold; color:#333;">${analysis.avgHourlyConsumption.toLocaleString('es-MX', {maximumFractionDigits: 0})} L/h</div>
                        ${moneyHtmlPromedio}
                    </div>
                    <div class="metric-box">
                        <div style="color:#666; font-size:11px; margin-bottom:4px;">AUTONOMÍA</div>
                        <div style="font-weight:bold; color:#333;">${autonomyText}</div>
                    </div>
                </div>
                <div id="chart_${id}" style="width:100% !important; min-width: 0 !important; height:160px; margin-top:10px; overflow: hidden !important;"></div>
                ${footerHtml}
            `;
        }
        
        container.appendChild(card);

        if (id === 'CISTERNA_A') {
            setTimeout(() => {
                const btnToggleA = document.getElementById('toggleCisternaA');
                const bodyCisternaA = document.getElementById('body_CISTERNA_A');
                const btnChartA = document.getElementById(`toggleChartBtn_${id}`); 
                
                if (btnToggleA && bodyCisternaA) {
                    btnToggleA.addEventListener('click', () => {
                        if (bodyCisternaA.style.display === 'none') {
                            bodyCisternaA.style.display = 'block';
                            btnToggleA.innerHTML = `<span class="svg-icon">${ICONS.eye}</span> Ocultar`;
                            if (btnChartA) btnChartA.style.display = 'block'; 
                            
                            setTimeout(() => {
                                if (window.Plotly) Plotly.Plots.resize(`chart_${id}`);
                            }, 50);
                            
                        } else {
                            bodyCisternaA.style.display = 'none';
                            btnToggleA.innerHTML = `<span class="svg-icon">${ICONS.eye}</span> Mostrar`;
                            if (btnChartA) btnChartA.style.display = 'none'; 
                        }
                    });
                }
            }, 50);
        }

        setTimeout(() => {
            const btnToggle = document.getElementById(`toggleChartBtn_${id}`);
            if (btnToggle) {
                window.isHourlyBarChart = window.isHourlyBarChart || {};
                if (isBot) {
                    window.isHourlyBarChart[id] = true;
                } else {
                    const storedVal = sessionStorage.getItem(`isHourlyBarChart_${id}`);
                    window.isHourlyBarChart[id] = storedVal !== null ? storedVal === 'true' : true;
                }
                
                const updateBtnUI = () => {
                    btnToggle.innerHTML = window.isHourlyBarChart[id] 
                        ? `<span class="svg-icon">${ICONS.lineChart}</span> Ver Línea de Tiempo` 
                        : `<span class="svg-icon">${ICONS.barChart}</span> Promedio por Hora`;
                    btnToggle.style.backgroundColor = window.isHourlyBarChart[id] ? '#e0f7fa' : '#f8f9fa';
                };
                updateBtnUI();

                btnToggle.addEventListener('click', () => {
                    window.isHourlyBarChart[id] = !window.isHourlyBarChart[id];
                    sessionStorage.setItem(`isHourlyBarChart_${id}`, window.isHourlyBarChart[id]); 
                    updateBtnUI();
                    
                    const activeBtn = document.querySelector('.filter-btn.active');
                    const currentHours = activeBtn ? parseInt(activeBtn.dataset.hours) : 24;
                    updateCharts(currentHours);
                });
            }
        }, 50);

        const volumeSeries = series.dist.map(dist => dist !== null ? calcVolume(dist, geo).m3 : null);
        window.chartDataStore[id] = { geo: geo, x: series.x, y: volumeSeries };
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

    const loaderEl = document.getElementById('smawa-loader');
    if (loaderEl) loaderEl.remove();

    // 🔥 GENERACIÓN DEL MENSAJE DE TELEGRAM AL FINALIZAR EL BUCLE (OPCIÓN 2) 🔥

    const c_perc = window.botTelegramData.C?.porcentaje || '--';
    const c_lit = window.botTelegramData.C?.litros || '--';
    const c_aut = window.botTelegramData.C?.autonomia || '--';
    const b_perc = window.botTelegramData.B?.porcentaje || '--';
    const b_gas = window.botTelegramData.B?.gastoPromedio || '--';

    window.telegramCaption = `💧 *Reporte Horario de la Red de Cisternas IBERO CDMX*
Estado actual de las reservas de agua:

🔵 *Agua Potable (Cisterna C):*
Nivel al ${c_perc}% (${c_lit} L). Gasto promedio: ${c_gas} L/h. Autonomía: ${c_aut}.

🟢 *Aguas Servidas (Cisterna B):*
Nivel al ${b_perc}%. Gasto promedio: ${b_gas} L/h.

🔗 [Ver Panel Web](https://smawatelegram.netlify.app)
_${captionDate} (CDMX)_`;

    setTimeout(() => { window.dashboardReady = true; }, 1000); 
});

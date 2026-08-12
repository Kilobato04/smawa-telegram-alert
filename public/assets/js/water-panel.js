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

    const realNowMs = new Date().getTime();
    const nowMs = isBot ? realNowMs - (6 * 3600 * 1000) : realNowMs;
    const startMs = nowMs - (hours * 3600 * 1000);
    
    const xAxisFormat = hours > 24 ? '%d/%m %H:%M' : '%H:%M';
    window.isHourlyBarChart = window.isHourlyBarChart || {};

    Object.keys(window.chartDataStore).forEach(id => {
        // 🔥 FIX BLINDADO: Si es el bot (AWS), SIEMPRE usa barras para evitar Timeout.
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
        const yRange = [Math.max(0, minY - padding), maxY + padding];

        Plotly.newPlot(`chart_${id}`, [{
            x: finalX, y: finalY, type: chartType, mode: chartMode, ...chartProps
        }], {
            margin: { t: 10, b: 25, l: 40, r: 10 },
            xaxis: { range: [new Date(startMs), new Date(nowMs)], showgrid: true, gridcolor: '#eee', tickformat: xAxisFormat, tickangle: 0, tickfont: { size: 9, color: '#888' } },
            yaxis: { range: yRange, title: { text: 'Vol (m³)', font: {size: 10, color: '#888'} }, showgrid: true, gridcolor: '#eee', tickfont: { size: 9, color: '#888' } },
            staticPlot: true
        }, { displayModeBar: false, responsive: true });
    });
}

document.addEventListener('DOMContentLoaded', async () => {
    // --- PANTALLA DE CARGA INICIAL (LOADER) ---
    const loader = document.createElement('div');
    loader.id = 'smawa-loader';
    loader.innerHTML = `
        <div style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(244, 247, 246, 0.95); z-index: 9999; display: flex; flex-direction: column; justify-content: center; align-items: center; backdrop-filter: blur(3px);">
            <div style="width: 45px; height: 45px; border: 4px solid #e0e0e0; border-top: 4px solid #007acc; border-radius: 50%; animation: spin 1s linear infinite;"></div>
            <div style="margin-top: 15px; font-weight: 600; color: #007acc; font-family: sans-serif; font-size: 14px;">Consultando datos...</div>
            <style>@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }</style>
        </div>
    `;
    document.body.appendChild(loader);

    console.log('⏰ Configurando actualización sincronizada...');
    
    function scheduleNextReload() {
        const now = new Date();
        const msUntilNextHour = (60 - now.getMinutes()) * 60000 - (now.getSeconds() * 1000);
        console.log(`⏳ Próxima actualización en aprox ${Math.round(msUntilNextHour / 60000)} minutos.`);
        setTimeout(() => { window.location.reload(); }, msUntilNextHour);
    }
    scheduleNextReload();

    // Ocultar el encabezado original por completo
    const header = document.querySelector('.header');
    if (header) {
        header.style.display = 'none';
    }

    const container = document.getElementById('cisternsGrid');

    const urlParams = new URLSearchParams(window.location.search);
    const isBot = urlParams.get('bot') === 'true';

    const nowReal = new Date();
    // Ajuste condicional: Si es el bot (AWS), le restamos 6 horas para empatar con CDMX
    const nowMx = isBot ? new Date(nowReal.getTime() - (6 * 3600 * 1000)) : nowReal;
    
    // Si es bot, forzamos UTC en las opciones para que el navegador de AWS no intente reajustar nada
    const options = { 
        timeZone: isBot ? 'UTC' : undefined, 
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' 
    };
    const formattedDate = nowMx.toLocaleDateString('es-MX', options);

    // --- ENCABEZADO Y FILTROS INTEGRADOS ---
    const filterHtml = `
        <div style="text-align: center; margin-bottom: 15px; border-bottom: 1px solid #e0e0e0; padding-bottom: 12px;">
            <h2 style="margin: 0; font-size: 14px; color: #333; text-transform: uppercase;">Monitoreo de Red Cisternas Ibero CDMX</h2>
            <div style="font-size: 13px; color: #007acc; font-weight: bold; margin-top: 4px;">📅 ${formattedDate.charAt(0).toUpperCase() + formattedDate.slice(1)} </div>
        </div>
        <div class="time-filters" style="display:flex; justify-content:center; gap:8px; margin-bottom:15px; flex-wrap: wrap;">
            <button class="filter-btn" data-hours="168">7 Días</button>
            <button class="filter-btn active" data-hours="24">24 Hrs</button>
            <button class="filter-btn" data-hours="12">12 Hrs</button>
            <button class="filter-btn" data-hours="8">8 Hrs</button>
            <button class="filter-btn" data-hours="4">4 Hrs</button>
            <button class="filter-btn" data-hours="2">2 Hrs</button>
        </div>
    `;

    const style = document.createElement('style');
    style.innerHTML = `
        /* Estilos de botones existentes */
        .filter-btn { padding: 5px 12px; border: 1px solid #007acc; background: #f8f9fa; color: #007acc; border-radius: 12px; cursor: pointer; font-size: 12px; font-weight: bold; transition: all 0.2s; outline: none;}
        .filter-btn.active { background: #007acc; color: white; border-color: #007acc; }
        .filter-btn:hover { background: #e6f2ff; }
        .filter-btn.active:hover { background: #005999; }
        
        /* 🔥 NUEVO: REGLAS DE RESPONSIVIDAD GLOBAL 🔥 */
        * { box-sizing: border-box; } 
        body { margin: 0; padding: 0; overflow-x: hidden; }
        
        /* Forzamos el contenedor principal a adaptarse a la pantalla */
        #cisternsGrid { 
            width: 100% !important; 
            max-width: 100% !important; 
            padding: 10px !important; 
            display: flex; 
            flex-direction: column; 
            align-items: center; 
        }
        
        /* Forzamos las tarjetas a estirarse llenando el celular */
        .cistern-card { 
            width: 100% !important; 
            max-width: 600px !important; 
            margin-left: 0 !important; 
            margin-right: 0 !important; 
        }

        /* Ajuste fino para pantallas de celulares muy pequeñas */
        @media (max-width: 480px) {
            .volume-display { font-size: 18px !important; }
            .metric-box { padding: 4px; font-size: 11px; }
            .time-filters { gap: 4px; }
            .filter-btn { padding: 4px 8px; font-size: 11px; }
        }
    `;
    document.head.appendChild(style);

    // 🔥 NUEVO: Forzamos la etiqueta Viewport por si tu HTML original no la tiene
    if (!document.querySelector('meta[name="viewport"]')) {
        const meta = document.createElement('meta');
        meta.name = 'viewport';
        meta.content = 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no';
        document.head.appendChild(meta);
    }
    
    let telegramCaption = `💧 *Reporte SMAWA - IBERO CDMX*\n📅 ${formattedDate.charAt(0).toUpperCase() + formattedDate.slice(1)} hrs\n\n`;

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

    for (const res of results) {
        const { id, geo, apiRawData, batteryVal } = res;
        const series = processApiData(apiRawData, geo, id);
        const batteryText = batteryVal !== null ? `🔋 ${batteryVal.toFixed(0)}%` : '🔋 N/A';
        const mapsUrl = `https://maps.google.com/?q=${geo.lat},${geo.lng}`;
        
        // Determinar si inyectamos los filtros (solo para la primera tarjeta: Cisterna C)
        const injectedFilters = id === 'CISTERNA_C' ? filterHtml : '';

        if (!series.valid) {
            container.innerHTML += `<div class="cistern-card">${injectedFilters}<h2 class="cistern-name">${geo.name}</h2><div class="sensor-warning">⚠️ Sin datos recientes</div></div>`;
            telegramCaption += `*[${geo.name}](${mapsUrl})*\n⚠️ Sensor sin datos recientes.\n\n`;
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
            ? `<div class="sensor-warning">⚠️ ALERTA: Sin variación 12h</div>` 
            : `<div class="sensor-ok">✅ Operativo</div>`;

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

        const card = document.createElement('div');
        card.className = 'cistern-card';
        
        if (id === 'CISTERNA_A') {
            card.innerHTML = `
                <div class="card-header" style="display:flex; justify-content:space-between; border-bottom:1px solid #eee; padding-bottom:10px; margin-bottom:10px;">
                    <div>
                        <h2 class="cistern-name" style="margin:0; font-size:16px;">${geo.name} (Sonda de Control)</h2>
                        <p style="margin:3px 0; font-size:11px;">
                            <a href="${mapsUrl}" target="_blank" style="color: #007acc; text-decoration: none; font-weight: 500;">📍 ${geo.lat}, ${geo.lng} ↗</a>
                        </p>
                        <p style="margin:2px 0 0 0; font-size:12px; color:#666;">
                            📏 Nivel de agua: <strong>${currentDist.toFixed(2)} m</strong> <span style="color:#007acc; font-size:10px;">(Calibrada)</span> | ${batteryText}
                        </p>
                    </div>
                    <div>
                        <button id="toggleCisternaA" style="padding: 4px 8px; font-size: 11px; cursor: pointer; border: 1px solid #ccc; border-radius: 4px; background: #f8f9fa;">👁️ Mostrar</button>
                    </div>
                </div>
                <div id="body_CISTERNA_A" style="display: none;">
                    <div id="chart_${id}" style="width:100%; height:160px; margin-top:10px;"></div>
                </div>
            `;
        } else {
            card.innerHTML = `
                ${injectedFilters}
                <div class="card-header" style="display:flex; justify-content:space-between; border-bottom:1px solid #eee; padding-bottom:10px; margin-bottom:10px;">
                    <div>
                        <h2 class="cistern-name" style="margin:0; font-size:16px;">${id === 'CISTERNA_C' ? geo.name + ' (Total Unificado)' : geo.name}</h2>
                        <p style="margin:3px 0; font-size:11px;">
                            <a href="${mapsUrl}" target="_blank" style="color: #007acc; text-decoration: none; font-weight: 500;">📍 ${geo.lat}, ${geo.lng} ↗</a>
                        </p>
                        <p style="margin:2px 0 0 0; font-size:12px; color:#666;">
                            📏 Nivel de agua: <strong>${currentDist.toFixed(2)} m</strong> | ${batteryText}
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
                            📊 Promedio por Hora
                        </button>
                    </div>
                </div>
                
                <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:10px; font-size:13px;">
                    <div class="metric-box">
                        <div style="color:#666; font-size:11px; margin-bottom:4px;">ÚLTIMA HORA</div>
                        <div class="${flowClass} font-weight-bold">${flowStatusText} ${sign}${Math.abs(flowL).toLocaleString('es-MX', {maximumFractionDigits: 0})} L</div>
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
                <div id="chart_${id}" style="width:100%; height:160px; margin-top:10px;"></div>
            `;
        }
        
        container.appendChild(card);

        // Lógica Colapsar Cisterna A
        if (id === 'CISTERNA_A') {
            setTimeout(() => {
                const btnToggleA = document.getElementById('toggleCisternaA');
                const bodyCisternaA = document.getElementById('body_CISTERNA_A');
                if (btnToggleA && bodyCisternaA) {
                    btnToggleA.addEventListener('click', () => {
                        if (bodyCisternaA.style.display === 'none') {
                            bodyCisternaA.style.display = 'block';
                            btnToggleA.innerHTML = '👁️ Ocultar';
                            window.dispatchEvent(new Event('resize')); 
                        } else {
                            bodyCisternaA.style.display = 'none';
                            btnToggleA.innerHTML = '👁️ Mostrar';
                        }
                    });
                }
            }, 50);
        }

        // --- EVENT LISTENER INDEPENDIENTE PARA CADA BOTÓN (C y B) ---
        if (id === 'CISTERNA_C' || id === 'CISTERNA_B') {
            setTimeout(() => {
                const btnToggle = document.getElementById(`toggleChartBtn_${id}`);
                if (btnToggle) {
                    // 🔥 NUEVO: Mantenemos la misma lógica del TRUE por defecto para los botones
                    // 🔥 Mismo blindaje para la interfaz
                    window.isHourlyBarChart = window.isHourlyBarChart || {};
                    if (isBot) {
                        window.isHourlyBarChart[id] = true;
                    } else {
                        const storedVal = sessionStorage.getItem(`isHourlyBarChart_${id}`);
                        window.isHourlyBarChart[id] = storedVal !== null ? storedVal === 'true' : true;
                    }
                    
                    const updateBtnUI = () => {
                        btnToggle.innerHTML = window.isHourlyBarChart[id] ? '📈 Ver Línea de Tiempo' : '📊 Promedio por Hora';
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
        }

        const volumeSeries = series.dist.map(dist => dist !== null ? calcVolume(dist, geo).m3 : null);
        window.chartDataStore[id] = { geo: geo, x: series.x, y: volumeSeries };

        if (id === 'CISTERNA_A') {
            telegramCaption += `🔵 *[${geo.name} - Control]*\n`;
            telegramCaption += `Nivel espejo: ${currentDist.toFixed(2)} m | ${batteryText}\n\n`; // Nota: En Telegram mantenemos tu formato original para no romper límites, pero si prefieres también puedes cambiarlo.
        } else {
            const emojiStatus = isStable ? '⚖️' : (isPositive ? '⬆️' : '⬇️');
            const emojiColor = id === 'CISTERNA_B' ? '🟣' : '🔵';
            const telegramSensorStatus = analysis.isStuck ? '⚠️ Alerta (Sin variación en 12h)' : '✅ Operativo';
            
            const telegramMoneyText = id !== 'CISTERNA_B' ? ` (~$${costoPorHoraMXN.toLocaleString('es-MX')} MXN)` : '';
            const telegramMoneyUltimaHora = id !== 'CISTERNA_B' ? ` (~$${costoUltimaHoraMXN.toLocaleString('es-MX')} MXN)` : '';

            telegramCaption += `${emojiColor} *[${id === 'CISTERNA_C' ? geo.name + ' (Total Unificado)' : geo.name}]*\n`;
            telegramCaption += `Nivel actual: ${fillPercentage}% | ${batteryText}\n`;
            telegramCaption += `Última hora: ${flowStatusText} ${emojiStatus} ${sign}${Math.abs(flowL).toLocaleString('es-MX', {maximumFractionDigits: 0})} L${telegramMoneyUltimaHora}\n`;
            telegramCaption += `Volumen: ${currentVol.liters.toLocaleString('es-MX', {maximumFractionDigits: 0})} L (${currentVol.m3.toLocaleString('es-MX', {maximumFractionDigits: 1})} m³)\n`;
            telegramCaption += `Autonomía est.: ${autonomyText}\n`;
            telegramCaption += `Tasa de gasto: ${analysis.avgHourlyConsumption.toLocaleString('es-MX', {maximumFractionDigits: 0})} L/h${telegramMoneyText}\n`;
            telegramCaption += `Estado Sensor: ${telegramSensorStatus}\n\n`;
        }
    }

    updateCharts(24);

    // Activamos los botones inyectados en la Cisterna C
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            const hrs = parseInt(e.target.getAttribute('data-hours'));
            updateCharts(hrs);
        });
    });

    // --- REMOVER PANTALLA DE CARGA ---
    const loaderEl = document.getElementById('smawa-loader');
    if (loaderEl) loaderEl.remove();

    window.telegramCaption = telegramCaption;
    setTimeout(() => { window.dashboardReady = true; }, 1000); 
});

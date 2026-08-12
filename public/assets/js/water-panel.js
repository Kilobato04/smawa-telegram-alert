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

    // Asegurarnos de que la variable exista en caso de que sea el primer render
    window.isHourlyBarChartC = window.isHourlyBarChartC || (sessionStorage.getItem('isHourlyBarChartC') === 'true');

    Object.keys(window.chartDataStore).forEach(id => {
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
        let chartProps = {
            connectgaps: false, 
            line: { color: data.geo.color, width: 2 },
            fill: 'tozeroy',
            fillcolor: `${data.geo.color}22`
        };

        // --- NUEVO: AGRUPACIÓN POR HORA PARA HISTOGRAMA (CISTERNA C) ---
        if (id === 'CISTERNA_C' && window.isHourlyBarChartC) {
            const hourlyData = {};
            
            for (let i = 0; i < filteredX.length; i++) {
                if (filteredY[i] === null) continue;
                
                // Redondeamos la fecha al inicio de la hora exacta (ej. 14:35 -> 14:00)
                const d = new Date(filteredX[i]);
                d.setMinutes(0, 0, 0);
                const ts = d.getTime();
                
                if (!hourlyData[ts]) { hourlyData[ts] = { sum: 0, count: 0 }; }
                hourlyData[ts].sum += filteredY[i];
                hourlyData[ts].count += 1;
            }
            
            finalX = [];
            finalY = [];
            
            // Promediamos los ~12 puntos de cada hora
            Object.keys(hourlyData).sort().forEach(ts => {
                const avgVolume = hourlyData[ts].sum / hourlyData[ts].count;
                finalX.push(new Date(parseInt(ts)));
                finalY.push(avgVolume);
            });
            
            // Cambiamos el estilo a Histograma
            chartType = 'bar';
            chartMode = undefined;
            chartProps = {
                marker: { color: data.geo.color, opacity: 0.8 }
            };
        }

        // Recalculamos Mínimos y Máximos Dinámicos
        let minY = Infinity;
        let maxY = -Infinity;
        for (let i = 0; i < finalY.length; i++) {
            if (finalY[i] !== null) {
                if (finalY[i] < minY) minY = finalY[i];
                if (finalY[i] > maxY) maxY = finalY[i];
            }
        }

        if (minY === Infinity) { minY = 0; maxY = 10; }

        const rangeDiff = maxY - minY;
        const padding = rangeDiff === 0 ? maxY * 0.05 : rangeDiff * 0.1; 
        const yRange = [Math.max(0, minY - padding), maxY + padding];

        // --- RENDERIZADO FINAL CON FIX DE PLOTLY ---
        Plotly.newPlot(`chart_${id}`, [{
            x: finalX,
            y: finalY,
            type: chartType,
            mode: chartMode,
            ...chartProps
        }], {
            margin: { t: 10, b: 25, l: 40, r: 10 },
            xaxis: { 
                range: [new Date(startMs), new Date(nowMs)], 
                showgrid: true, gridcolor: '#eee', 
                tickformat: xAxisFormat,
                tickangle: 0, 
                tickfont: { size: 9, color: '#888' } 
            },
            yaxis: { 
                range: yRange, 
                title: { text: 'Vol (m³)', font: {size: 10, color: '#888'} }, 
                showgrid: true, gridcolor: '#eee', 
                tickfont: { size: 9, color: '#888' } 
            },
            staticPlot: true
        }, {
            displayModeBar: false,  // Ocultar herramientas al hacer hover
            responsive: true
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

    // 1. Ocultar el encabezado original por completo
    const header = document.querySelector('.header');
    if (header) {
        header.style.display = 'none';
    }

    const container = document.getElementById('cisternsGrid');
    
    // Inserción de filtros antes del grid
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
    container.insertAdjacentHTML('beforebegin', filterHtml);

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
    
    // Obviamos updateTime dado que se quitó el header, pero conservamos telegramCaption
    let telegramCaption = `💧 *Reporte SMAWA - IBERO CDMX*\n📅 ${formattedDate.charAt(0).toUpperCase() + formattedDate.slice(1)} hrs\n\n`;

    // Extraer y ordenar las cisternas: Forzamos a que CISTERNA_C siempre sea la primera
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
        
        const analysis = analyzeMetrics(series, geo);

        // --- NUEVA LÓGICA DE NEGOCIO: CONSOLIDACIÓN EN CISTERNA C ---
        if (id === 'CISTERNA_C') {
            // Multiplicamos por 2 para representar el vaso completo
            currentVol.liters *= 2;
            currentVol.m3 *= 2;
            rawFlowL *= 2;
            analysis.avgHourlyConsumption *= 2;
            geo.max_capacity_l *= 2; // Duplicamos capacidad base para que el % sea correcto
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

        // --- CÁLCULO MONETARIO ---
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
        
        // --- RENDERIZADO CONDICIONAL DE TARJETAS ---
        if (id === 'CISTERNA_A') {
            // VISTA CISTERNA A: Inicia colapsada por default y tiene botón Mostrar
            card.innerHTML = `
                <div class="card-header" style="display:flex; justify-content:space-between; border-bottom:1px solid #eee; padding-bottom:10px; margin-bottom:10px;">
                    <div>
                        <h2 class="cistern-name" style="margin:0; font-size:16px;">${geo.name} (Sonda de Control)</h2>
                        <p style="margin:3px 0; font-size:11px;">
                            <a href="${mapsUrl}" target="_blank" style="color: #007acc; text-decoration: none; font-weight: 500;">📍 ${geo.lat}, ${geo.lng} ↗</a>
                        </p>
                        <p style="margin:2px 0 0 0; font-size:12px; color:#666;">
                            📏 Espejo de agua: <strong>${currentDist.toFixed(2)} m</strong> <span style="color:#007acc; font-size:10px;">(Calibrada)</span> | ${batteryText}
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
            // VISTA CISTERNA C (Y Aguas Negras)
            // Agregamos Fecha/Hora debajo del título solo para Cisterna C
            const dateHtml = id === 'CISTERNA_C' ? `<div style="font-size:12px; color:#007acc; font-weight:bold; margin-top:2px; margin-bottom:8px;">📅 ${formattedDate.charAt(0).toUpperCase() + formattedDate.slice(1)} hrs</div>` : '';

            card.innerHTML = `
                <div class="card-header" style="display:flex; justify-content:space-between; border-bottom:1px solid #eee; padding-bottom:10px; margin-bottom:10px;">
                    <div>
                        <h2 class="cistern-name" style="margin:0; font-size:16px;">${id === 'CISTERNA_C' ? geo.name + ' (Total Unificado)' : geo.name}</h2>
                        ${dateHtml}
                        <p style="margin:3px 0; font-size:11px;">
                            <a href="${mapsUrl}" target="_blank" style="color: #007acc; text-decoration: none; font-weight: 500;">📍 ${geo.lat}, ${geo.lng} ↗</a>
                        </p>
                        <p style="margin:2px 0 0 0; font-size:12px; color:#666;">
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
                        <!-- NUEVO BOTÓN DE HISTOGRAMA -->
                        <button id="toggleChartBtnC" style="margin-top: 8px; padding: 4px 8px; font-size: 11px; background-color: #f8f9fa; border: 1px solid #ccc; border-radius: 6px; cursor: pointer; color: #333; font-weight: 500; transition: all 0.2s;">
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

        // --- LÓGICA DEL BOTÓN COLAPSAR CISTERNA A ---
        if (id === 'CISTERNA_A') {
            setTimeout(() => {
                const btnToggleA = document.getElementById('toggleCisternaA');
                const bodyCisternaA = document.getElementById('body_CISTERNA_A');
                if (btnToggleA && bodyCisternaA) {
                    btnToggleA.addEventListener('click', () => {
                        if (bodyCisternaA.style.display === 'none') {
                            bodyCisternaA.style.display = 'block';
                            btnToggleA.innerHTML = '👁️ Ocultar';
                            // Disparamos un resize para que Plotly recalcule los anchos si estaba escondido
                            window.dispatchEvent(new Event('resize')); 
                        } else {
                            bodyCisternaA.style.display = 'none';
                            btnToggleA.innerHTML = '👁️ Mostrar';
                        }
                    });
                }
            }, 50);
        }

        // --- LÓGICA DEL BOTÓN DE HISTOGRAMA (CISTERNA C) ---
        if (id === 'CISTERNA_C') {
            setTimeout(() => {
                const btnToggle = document.getElementById('toggleChartBtnC');
                if (btnToggle) {
                    // Leemos la memoria por si la página se acaba de auto-recargar
                    window.isHourlyBarChartC = sessionStorage.getItem('isHourlyBarChartC') === 'true';
                    
                    const updateBtnUI = () => {
                        btnToggle.innerHTML = window.isHourlyBarChartC ? '📈 Ver Línea de Tiempo' : '📊 Promedio por Hora';
                        btnToggle.style.backgroundColor = window.isHourlyBarChartC ? '#e0f7fa' : '#f8f9fa';
                    };
                    updateBtnUI();

                    btnToggle.addEventListener('click', () => {
                        window.isHourlyBarChartC = !window.isHourlyBarChartC;
                        sessionStorage.setItem('isHourlyBarChartC', window.isHourlyBarChartC); // Guardamos estado
                        updateBtnUI();
                        
                        // Buscamos cuántas horas estamos visualizando actualmente y repintamos
                        const activeBtn = document.querySelector('.filter-btn.active');
                        const currentHours = activeBtn ? parseInt(activeBtn.dataset.hours) : 24;
                        updateCharts(currentHours);
                    });
                }
            }, 50);
        }

        const volumeSeries = series.dist.map(dist => dist !== null ? calcVolume(dist, geo).m3 : null);
        window.chartDataStore[id] = { geo: geo, x: series.x, y: volumeSeries };

        // Ajuste en Telegram: Omitimos los detalles irrelevantes de Cisterna A
        if (id === 'CISTERNA_A') {
            telegramCaption += `🔵 *[${geo.name} - Control]*\n`;
            telegramCaption += `Nivel espejo: ${currentDist.toFixed(2)} m | ${batteryText}\n\n`;
        } else {
            const emojiStatus = isStable ? '⚖️' : (isPositive ? '⬆️' : '⬇️');
            const emojiColor = id === 'CISTERNA_B' ? '🟣' : '🔵';
            const telegramSensorStatus = analysis.isStuck ? '⚠️ Alerta (Sin variación en 12h)' : '✅ Operativo';
            
            // Textos monetarios (vacíos si es Aguas Negras)
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

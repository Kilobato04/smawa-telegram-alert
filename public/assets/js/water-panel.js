document.addEventListener('DOMContentLoaded', async () => {
    // 1. Aquí se integrarán las peticiones reales a las APIs de telemetría.
    // Simulando la carga de datos estructurados:
    const cisternaData = await fetchMockData();
    renderDashboard(cisternaData);
});

async function fetchMockData() {
    return new Promise(resolve => {
        setTimeout(() => {
            resolve([
                { id: "CISTERN_1", name: "Cisterna Principal", distance_m: 1.2, prev_distance_m: 1.0 },
                { id: "CISTERN_2", name: "Cisterna Secundaria", distance_m: 0.5, prev_distance_m: 0.5 },
                { id: "CISTERN_3", name: "Cisterna Pluvial", distance_m: 2.0, prev_distance_m: 2.5 },
                { id: "CISTERN_4", name: "Tanque Elevado", distance_m: 1.8, prev_distance_m: 1.5 }
            ]);
        }, 500);
    });
}

function calculateMetrics(sensorData) {
    const geo = APP_CONFIG.GEOMETRY[sensorData.id];
    if (!geo) return null;

    // Nivel = Altura total - distancia medida
    const currentLevel = Math.max(0, geo.height_m - sensorData.distance_m);
    const prevLevel = Math.max(0, geo.height_m - sensorData.prev_distance_m);

    // Volumen en litros (1 m3 = 1000 L)
    const currentVolume = currentLevel * geo.area_m2 * 1000;
    const prevVolume = prevLevel * geo.area_m2 * 1000;

    // Gasto (-) o Recarga (+)
    const flow = currentVolume - prevVolume;

    return {
        volume: currentVolume,
        flow: flow,
        status: flow > 0 ? "Recarga" : (flow < 0 ? "Gasto" : "Estable")
    };
}

function renderDashboard(cisternsRaw) {
    const grid = document.getElementById('cisternsGrid');
    grid.innerHTML = '';

    cisternsRaw.forEach(raw => {
        const metrics = calculateMetrics(raw);
        if (!metrics) return;

        const flowClass = metrics.flow < 0 ? 'flow-negative' : (metrics.flow > 0 ? 'flow-positive' : '');
        const flowPrefix = metrics.flow > 0 ? '+' : '';
        
        const card = `
            <div class="cistern-card">
                <h2 class="cistern-name">${raw.name}</h2>
                <div class="volume-display">${metrics.volume.toLocaleString('es-MX', {maximumFractionDigits: 0})} L</div>
                <div class="flow-status ${flowClass}">
                    ${metrics.status}: ${flowPrefix}${metrics.flow.toLocaleString('es-MX', {maximumFractionDigits: 0})} L/h
                </div>
            </div>
        `;
        grid.innerHTML += card;
    });

    const now = new Date();
    document.getElementById('updateTime').innerText = `Actualizado: ${now.toLocaleTimeString('es-MX')}`;
    
    // Señal vital para la Lambda (Puppeteer)
    window.dashboardReady = true; 
}

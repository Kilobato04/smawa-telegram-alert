document.addEventListener('DOMContentLoaded', async () => {
    const apiData = await fetchMockData();
    renderDashboard(apiData);
});

// Simulador de respuestas de los 3 sensores activos
async function fetchMockData() {
    return new Promise(resolve => {
        setTimeout(() => {
            resolve({
                // Las distancias de A y C deberían ser iguales o muy similares en la realidad
                "SMAWA_A": { distance_m: 1.2, prev_distance_m: 1.1 },
                "SMAWA_C": { distance_m: 1.2, prev_distance_m: 1.1 },
                "SMAWA_B": { distance_m: 0.8, prev_distance_m: 0.9 }
            });
        }, 500);
    });
}

function calculateMetrics(cisternId, cisternConfig, apiData) {
    // Si no tiene sensor asignado, no hay métricas que calcular
    if (!cisternConfig.sensor_id) return null;
    
    const sensorData = apiData[cisternConfig.sensor_id];
    
    // Si el sensor falló o no hay datos, retornamos null para manejar el error
    if (!sensorData) return null;

    const currentLevel = Math.max(0, cisternConfig.height_m - sensorData.distance_m);
    const prevLevel = Math.max(0, cisternConfig.height_m - sensorData.prev_distance_m);

    const currentVolume = currentLevel * cisternConfig.area_m2 * 1000;
    const prevVolume = prevLevel * cisternConfig.area_m2 * 1000;
    
    const flow = currentVolume - prevVolume;
    const fillPercentage = (currentVolume / cisternConfig.max_capacity_l) * 100;

    return {
        volume: currentVolume,
        flow: flow,
        percentage: fillPercentage,
        status: flow > 0 ? "Recarga" : (flow < 0 ? "Gasto" : "Estable")
    };
}

function renderDashboard(apiData) {
    const grid = document.getElementById('cisternsGrid');
    grid.innerHTML = '';

    // Iteramos sobre A, C, B, D
    Object.keys(APP_CONFIG.GEOMETRY).forEach(cisternId => {
        const config = APP_CONFIG.GEOMETRY[cisternId];
        
        // Excluimos las no instrumentadas (Cisterna D) de la visualización principal
        if (!config.sensor_id) return; 

        const metrics = calculateMetrics(cisternId, config, apiData);
        
        // Tarjeta de error si el sensor está caído
        if (!metrics) {
            grid.innerHTML += `
                <div class="cistern-card">
                    <h2 class="cistern-name">${config.name}</h2>
                    <div class="volume-display" style="color: #999;">Sin Datos</div>
                    <div class="flow-status">Revisar conexión SMAWA</div>
                </div>`;
            return;
        }

        const flowClass = metrics.flow < 0 ? 'flow-negative' : (metrics.flow > 0 ? 'flow-positive' : '');
        const flowPrefix = metrics.flow > 0 ? '+' : '';
        
        const card = `
            <div class="cistern-card">
                <h2 class="cistern-name">${config.name}</h2>
                <div class="volume-display">
                    ${metrics.volume.toLocaleString('es-MX', {maximumFractionDigits: 0})} L 
                    <span style="font-size: 14px; color: #666;">(${metrics.percentage.toFixed(1)}%)</span>
                </div>
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

# SMAWA Telegram Alert

Sistema automatizado de monitoreo de cisternas. Utiliza AWS Lambda (Node.js) y Puppeteer para renderizar un dashboard web con los niveles de agua, capturarlo y enviarlo periódicamente a un canal de Telegram.

## Arquitectura Híbrida
- **Backend (Lambda):** Ejecuta un navegador *headless*, toma una captura del dashboard y orquesta el envío a Telegram vía S3.
- **Frontend (Netlify):** Interfaz estática (HTML/CSS/JS) utilizada como lienzo para la captura. Aquí reside la lógica de consulta a las APIs de telemetría y los cálculos geométricos de las cisternas.

## Despliegue
Ver la documentación en la carpeta `docs/`.

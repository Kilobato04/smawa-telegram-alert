const chromium = require('@sparticuz/chromium');
const puppeteer = require('puppeteer-core');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const axios = require('axios');

const s3Client = new S3Client({ region: 'us-east-1' });

const CONFIG = {
    S3_BUCKET: process.env.S3_BUCKET || 'smability-water-alerts',
    PANEL_URL: process.env.PANEL_URL || 'https://tu-netlify-url.netlify.app',
    TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN,
    TELEGRAM_CHANNEL_ID: process.env.TELEGRAM_CHANNEL_ID
};

exports.handler = async (event) => {
    console.log('🚀 Iniciando captura del panel de agua SMAWA...');
    let browser = null;
    
    try {
        browser = await launchBrowser();
        const imageBuffer = await captureDashboard(browser);
        
        const imageUrl = await uploadToS3(imageBuffer);
        await publishToTelegram(imageUrl);
        
        return { statusCode: 200, body: JSON.stringify({ success: true, image: imageUrl }) };
    } catch (error) {
        console.error('❌ Error:', error);
        return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
    } finally {
        if (browser) await browser.close();
    }
};

async function launchBrowser() {
    return await puppeteer.launch({
        args: chromium.args,
        defaultViewport: { width: 600, height: 800, deviceScaleFactor: 2 },
        executablePath: await chromium.executablePath(),
        headless: chromium.headless,
    });
}

async function captureDashboard(browser) {
    const page = await browser.newPage();
    await page.goto(CONFIG.PANEL_URL, { waitUntil: 'networkidle0', timeout: 30000 });
    
    // Esperar a que el JS del frontend termine de calcular y renderizar
    await page.waitForFunction('window.dashboardReady === true', { timeout: 15000 });
    
    const panelElement = await page.$('#capturePanel');
    return await panelElement.screenshot({ type: 'jpeg', quality: 90 });
}

async function uploadToS3(imageBuffer) {
    const fileName = `smawa-alert-${Date.now()}.jpg`;
    const command = new PutObjectCommand({
        Bucket: CONFIG.S3_BUCKET,
        Key: `alertas/${fileName}`,
        Body: imageBuffer,
        ContentType: 'image/jpeg'
    });
    await s3Client.send(command);
    return `https://${CONFIG.S3_BUCKET}.s3.amazonaws.com/alertas/${fileName}`;
}

async function publishToTelegram(imageUrl) {
    if (!CONFIG.TELEGRAM_BOT_TOKEN) return;
    
    const caption = `💧 *Reporte Horario de Cisternas*\nConsulta el estado actual de la red SMAWA.`;
    
    await axios.post(`https://api.telegram.org/bot${CONFIG.TELEGRAM_BOT_TOKEN}/sendPhoto`, {
        chat_id: CONFIG.TELEGRAM_CHANNEL_ID,
        photo: imageUrl,
        caption: caption,
        parse_mode: 'Markdown'
    });
}

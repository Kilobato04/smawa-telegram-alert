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
        browser = await puppeteer.launch({
            args: chromium.args,
            defaultViewport: { width: 600, height: 850, deviceScaleFactor: 2 },
            executablePath: await chromium.executablePath(),
            headless: chromium.headless,
        });

        const page = await browser.newPage();
        await page.goto(CONFIG.PANEL_URL, { waitUntil: 'networkidle0', timeout: 30000 });
        
        // Esperamos a que Plotly termine y el frontend nos avise
        await page.waitForFunction('window.dashboardReady === true', { timeout: 15000 });
        
        // 1. Tomamos la captura del Dashboard
        const panelElement = await page.$('#capturePanel');
        const imageBuffer = await panelElement.screenshot({ type: 'jpeg', quality: 90 });
        
        // 2. Extraemos el Caption dinámico generado por el frontend
        const dynamicCaption = await page.evaluate(() => window.telegramCaption);
        
        // 3. Subimos la imagen a S3
        const imageUrl = await uploadToS3(imageBuffer);
        
        // 4. Publicamos en Telegram con el texto exacto del front
        await publishToTelegram(imageUrl, dynamicCaption);
        
        return { statusCode: 200, body: JSON.stringify({ success: true, image: imageUrl }) };
    } catch (error) {
        console.error('❌ Error:', error);
        return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
    } finally {
        if (browser) await browser.close();
    }
};

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

async function publishToTelegram(imageUrl, caption) {
    if (!CONFIG.TELEGRAM_BOT_TOKEN) return;
    
    await axios.post(`https://api.telegram.org/bot${CONFIG.TELEGRAM_BOT_TOKEN}/sendPhoto`, {
        chat_id: CONFIG.TELEGRAM_CHANNEL_ID,
        photo: imageUrl,
        caption: caption,
        parse_mode: 'Markdown'
    });
}

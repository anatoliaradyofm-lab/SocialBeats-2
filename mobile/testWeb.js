const puppeteer = require('puppeteer');

(async () => {
    try {
        const browser = await puppeteer.launch({ headless: 'new' });
        const page = await browser.newPage();

        page.on('console', msg => {
            console.log(`[CONSOLE] ${msg.type().toUpperCase()}:`, msg.text());
        });

        page.on('pageerror', err => {
            console.log('[PAGE_ERROR_STACK]', err.stack || err.message);
        });

        console.log('Navigating to http://localhost:8081...');
        await page.goto('http://localhost:8081', { waitUntil: 'networkidle0', timeout: 30000 });

        await browser.close();
    } catch (err) {
        console.error('[SCRIPT_ERROR]', err);
    }
})();

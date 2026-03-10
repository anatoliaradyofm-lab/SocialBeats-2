const puppeteer = require('puppeteer');

(async () => {
    const browser = await puppeteer.launch({ headless: 'new' });
    const page = await browser.newPage();

    page.on('console', msg => console.log('PAGE LOG:', msg.type(), msg.text()));
    page.on('pageerror', error => console.log('PAGE ERROR:', error.message));
    page.on('response', response => {
        if (!response.ok()) console.log('NETWORK ERROR:', response.url(), response.status());
    });
    page.on('requestfailed', request => {
        console.log('REQUEST FAILED:', request.url(), request.failure().errorText);
    });

    console.log("Navigating to http://localhost:8080");
    await page.goto('http://localhost:8080', { waitUntil: 'networkidle2' });

    console.log("Waiting 3 seconds...");
    await new Promise(r => setTimeout(r, 3000));

    const rootHtml = await page.evaluate(() => document.getElementById('root')?.innerHTML);
    console.log("Root HTML length:", rootHtml ? rootHtml.length : 'null');
    console.log("Root HTML preview:", rootHtml ? rootHtml.substring(0, 100) : 'null');

    await browser.close();
})();

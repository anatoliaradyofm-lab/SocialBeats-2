const puppeteer = require('puppeteer');

(async () => {
    const browser = await puppeteer.launch({ headless: 'new' });
    const page = await browser.newPage();
    await page.setViewport({ width: 375, height: 812 });

    page.on('console', msg => {
        if (msg.type() === 'error') console.log('PAGE LOG ERROR:', msg.text());
        else console.log('PAGE LOG:', msg.text());
    });
    page.on('pageerror', error => console.log('FATAL PAGE ERROR:', error.message));

    console.log("Navigating to http://localhost:8082");
    await page.goto('http://localhost:8082', { waitUntil: 'networkidle0' });

    console.log("Waiting 2s for onboarding to render...");
    await new Promise(r => setTimeout(r, 2000));

    await page.screenshot({ path: 'before_click.png' });
    console.log("Saved before_click.png");

    console.log("Clicking 'Atla' / 'Skip'...");
    await page.evaluate(() => {
        const elements = Array.from(document.querySelectorAll('div'));
        const btn = elements.find(el => el.textContent && (el.textContent.trim() === 'Atla' || el.textContent.trim() === 'Skip'));
        if (btn) btn.click();
    });

    console.log("Waiting 3s for potential mount crash...");
    await new Promise(r => setTimeout(r, 3000));

    await page.screenshot({ path: 'after_click.png' });
    console.log("Saved after_click.png");

    await browser.close();
})();

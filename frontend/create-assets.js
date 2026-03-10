const fs = require('fs');
const path = require('path');
const dir = path.join(__dirname, 'assets');
if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
['icon.png', 'adaptive-icon.png', 'splash.png', 'notification-icon.png', 'favicon.png'].forEach(f => {
  fs.writeFileSync(path.join(dir, f), png);
});
console.log('Assets created');

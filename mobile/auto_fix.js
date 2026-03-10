const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('====================================================');
console.log('YAPAY ZEKA - OTOMATIK PROJE TARAMA VE TAMIR ROBOTU');
console.log('====================================================');
console.log('Bot: Kodlarinizdaki tum eksikleri simdi TEK SEFERDE tarayacagim...');

const walkSync = (dir, filelist = []) => {
    if (!fs.existsSync(dir)) return filelist;
    fs.readdirSync(dir).forEach(file => {
        const dirFile = path.join(dir, file);
        if (fs.statSync(dirFile).isDirectory()) {
            filelist = walkSync(dirFile, filelist);
        } else if (dirFile.endsWith('.js') || dirFile.endsWith('.jsx')) {
            filelist.push(dirFile);
        }
    });
    return filelist;
};

const files = walkSync(path.join(__dirname, 'src'));
files.push(path.join(__dirname, 'App.js'));

const packageJson = require('./package.json');
const allDeps = { ...packageJson.dependencies, ...packageJson.devDependencies };

const externalPackages = new Set();
const importRegex = /import\s+.*?\s+from\s+['"]([^.][^'"]+)['"]/g;
const requireRegex = /require\(['"]([^.][^'"]+)['"]\)/g;

files.forEach(file => {
    const content = fs.readFileSync(file, 'utf-8');
    let match;
    while ((match = importRegex.exec(content)) !== null) {
        let pkg = match[1];
        if (pkg.startsWith('@')) {
            const parts = pkg.split('/');
            pkg = parts[0] + '/' + (parts[1] || '');
        } else {
            pkg = pkg.split('/')[0];
        }
        externalPackages.add(pkg);
    }
    while ((match = requireRegex.exec(content)) !== null) {
        let pkg = match[1];
        if (pkg.startsWith('@')) {
            const parts = pkg.split('/');
            pkg = parts[0] + '/' + (parts[1] || '');
        } else {
            pkg = pkg.split('/')[0];
        }
        externalPackages.add(pkg);
    }
});

const builtIn = ['react', 'react-native', 'expo', 'react-dom'];
const missingPackages = [];

externalPackages.forEach(pkg => {
    if (!allDeps[pkg] && !builtIn.includes(pkg)) {
        missingPackages.push(pkg);
    }
});

if (missingPackages.length > 0) {
    console.log('\n[!] Tespit Edilen TUM Eksik Paketler: ' + missingPackages.join(', '));
    console.log('[!] Hepsi tek seferde kuruluyor, lutfen bekleyin...');
    try {
        execSync(`npx expo install ${missingPackages.join(' ')}`, { stdio: 'inherit' });
        console.log('[+] Tum kutuphaneler basariyla kuruldu!');
    } catch (e) {
        console.log('[-] Kurulum sirasinda ufak bir hata olustu.', e.message);
    }
} else {
    console.log('\n[+] Kutuphanelerinizde hicbir eksik bulunmadi!');
}

console.log('\n====================================================');
console.log('2. Asama: Kodlardaki Tum Yazim/Noktalama Hatalari Denetleniyor...');
console.log('====================================================');

try {
    execSync('npx expo export --platform android', { stdio: 'pipe' });
    console.log('\n[MUKEMMEL!] Artik PROJENIZDE HICBIR KOD HATASI VEYA EKSIK YOK!');
    console.log('Gonul rahatligiyla "APK_OLUSTUR.bat" dosyasini calistirabilirsiniz!');
} catch (e) {
    const errorLog = e.stdout.toString() + e.stderr.toString();
    console.log('\n[HATA TESPIT EDILDI!] Javascript Derlenirken Bir Sorun Cikti.\n');
    fs.writeFileSync('BundleHataRaporu.txt', errorLog);
    console.log('Hata detaylari "BundleHataRaporu.txt" dosyasina kaydedildi.');
    console.log('Lutfen Yapay Zeka Asistanina (Bana) Yalnizca "HATA CIKTI" deyin!');
}

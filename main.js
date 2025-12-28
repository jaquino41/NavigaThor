const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');
const os = require('os');
const { exec } = require('child_process');

let mainWindow;
let prevCpus = os.cpus();

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1300,
        height: 900,
        frame: false,
        title: 'NavigaThor',
        webPreferences: {
            nodeIntegration: true, // Habilitamos para facilitar tabs y stats en este caso Lite
            contextIsolation: false,
            webviewTag: true,
            preload: path.join(__dirname, 'preload.js')
        },
        backgroundColor: '#0f172a',
        show: false
    });

    mainWindow.loadFile('index.html');

    mainWindow.once('ready-to-show', () => {
        mainWindow.show();
    });
}

app.whenReady().then(() => {
    // Definir identidad global ultra-limpia para bypass de Google
    const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';
    app.userAgentFallback = UA;
    createWindow();
});

// IPC Handlers
ipcMain.on('window-control', (event, action) => {
    if (action === 'close') app.quit();
    if (action === 'minimize') mainWindow.minimize();
    if (action === 'maximize') {
        if (mainWindow.isMaximized()) mainWindow.unmaximize();
        else mainWindow.maximize();
    }
});

ipcMain.on('open-external', (event, url) => {
    shell.openExternal(url);
});

// Stats del sistema avanzados (Estilo ThorTube)
let systemStats = { disk: 0, network: 0 };

function updateDiskStats() {
    if (process.platform === 'win32') {
        exec('wmic logicaldisk where "DeviceID=\'C:\'" get size,freespace /value', (err, stdout) => {
            if (!err && stdout) {
                const sizeMatch = stdout.match(/Size=(\d+)/);
                const freeMatch = stdout.match(/FreeSpace=(\d+)/);
                if (sizeMatch && freeMatch) {
                    const total = parseInt(sizeMatch[1]);
                    const free = parseInt(freeMatch[1]);
                    systemStats.disk = Math.round(((total - free) / total) * 100);
                }
            }
        });
    }
}
setInterval(updateDiskStats, 60000);
updateDiskStats();

ipcMain.handle('get-system-stats', async () => {
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const memUsage = Math.round(((totalMem - freeMem) / totalMem) * 100);

    const currentCpus = os.cpus();
    let totalDiff = 0;
    let idleDiff = 0;
    for (let i = 0; i < currentCpus.length; i++) {
        const prev = prevCpus[i].times;
        const curr = currentCpus[i].times;
        totalDiff += Object.values(curr).reduce((a, b) => a + b) - Object.values(prev).reduce((a, b) => a + b);
        idleDiff += (curr.idle - prev.idle);
    }
    const cpuUsage = totalDiff === 0 ? 0 : Math.max(0, Math.min(100, Math.round(100 * (1 - idleDiff / totalDiff))));
    prevCpus = currentCpus;

    return {
        cpu: cpuUsage,
        ram: memUsage,
        disk: systemStats.disk,
        network: Math.floor(Math.random() * 15) + 5, // Simulado como en ThorTube
        appRam: Math.round(process.memoryUsage().rss / 1024 / 1024),
        appCpu: Math.max(1, Math.round(cpuUsage * 0.12))
    };
});

ipcMain.handle('clean-cache', async () => {
    const session = mainWindow.webContents.session;
    await session.clearCache();
    await session.clearStorageData();
    return true;
});

ipcMain.on('force-dark-mode', (event, enabled) => {
    // Esto es experimental en Electron
    if (mainWindow) {
        mainWindow.webContents.insertCSS(enabled ? `
            html, body { background-color: #000 !important; color: #fff !important; }
            webview { filter: invert(0.9) hue-rotate(180deg) !important; }
            img, video { filter: invert(1) hue-rotate(180deg) !important; }
        ` : '');
    }
});

ipcMain.handle('capture-page', async () => {
    const image = await mainWindow.capturePage();
    const fs = require('fs');
    const savePath = path.join(app.getPath('pictures'), `NavigaThor_Capture_${Date.now()}.png`);
    fs.writeFileSync(savePath, image.toPNG());
    return savePath;
});

ipcMain.handle('open-downloads', () => {
    shell.openPath(app.getPath('downloads'));
    return true;
});

ipcMain.handle('kill-apps', async () => {
    const { exec } = require('child_process');
    // Matar navegadores pesados comunes para liberar RAM (excepto el nuestro)
    const commands = [
        'taskkill /F /IM msedge.exe /T',
        'taskkill /F /IM chrome.exe /T',
        'taskkill /F /IM brave.exe /T'
    ];

    commands.forEach(cmd => {
        exec(cmd, (err) => {
            if (err) console.log(`No se pudo cerrar un proceso (probablemente no estaba abierto)`);
        });
    });

    // También abrimos el administrador de tareas para que el usuario tenga control total
    exec('taskmgr.exe');
    return true;
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});


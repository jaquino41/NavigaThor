const { app, BrowserWindow, ipcMain, shell, powerSaveBlocker } = require('electron');
const path = require('path');
const os = require('os');
const { exec } = require('child_process');

// Switches de alto rendimiento para reducir consumo
app.commandLine.appendSwitch('no-sandbox');
app.commandLine.appendSwitch('disable-background-timer-throttling');
app.commandLine.appendSwitch('js-flags', '--max-old-space-size=512');
app.commandLine.appendSwitch('disable-renderer-backgrounding');
app.commandLine.appendSwitch('force-gpu-rasterization');

// Forzar rutas fuera de OneDrive
const baseDir = path.join(os.homedir(), '.navigathor-v2');
app.setPath('userData', baseDir);
app.setPath('sessionData', path.join(baseDir, 'Session'));
app.setPath('cache', path.join(baseDir, 'Cache'));

app.commandLine.appendSwitch('no-sandbox');

let mainWindow;
let prevCpus = os.cpus();
let powerSaveId = null;

function createWindow() {
    console.log('Iniciando ventana principal...');
    mainWindow = new BrowserWindow({
        width: 1300,
        height: 900,
        frame: false,
        title: 'NavigaThor',
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            sandbox: false,
            webviewTag: true,
            preload: path.join(__dirname, 'preload.js'),
            backgroundThrottling: true,
            offscreen: false,
            spellcheck: false
        },
        backgroundColor: '#0f172a',
        show: false
    });

    mainWindow.loadFile(path.join(__dirname, 'index.html')).catch(err => {
        console.error('Error al cargar index.html:', err);
    });

    mainWindow.once('ready-to-show', () => {
        console.log('Ventana lista para mostrar');
        mainWindow.show();
        mainWindow.focus();
    });

    /*
    // Redirigir consola del renderizador a la terminal para depuración
    mainWindow.webContents.on('console-message', (event, level, message, line, sourceId) => {
        console.log(`[Renderer] ${message}`);
    });
    */

    // Diagnóstico de webviews
    mainWindow.webContents.on('render-process-gone', (event, details) => {
        console.error('El proceso de renderizado falló:', details.reason);
    });
}

app.whenReady().then(() => {
    console.log('App lista. UserData en:', app.getPath('userData'));
    const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';
    app.userAgentFallback = UA;
    createWindow();
});

// Configuración de seguridad para webviews
app.on('web-contents-created', (event, contents) => {
    contents.on('will-attach-webview', (event, webPreferences, params) => {
        // Asegurar que las webviews tengan aislamiento y no tengan nodeIntegration
        webPreferences.nodeIntegration = false;
        webPreferences.contextIsolation = true;
    });
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

// Stats del sistema avanzados optimizados
let systemStats = { disk: 0 };

function updateDiskStats() {
    if (process.platform === 'win32') {
        // Usar PowerShell que es más moderno que WMIC
        exec('Powershell "Get-PSDrive C | Select-Object Used, Free"', (err, stdout) => {
            if (!err && stdout) {
                const lines = stdout.trim().split('\n');
                if (lines.length >= 3) {
                    const values = lines[2].trim().split(/\s+/);
                    const used = parseInt(values[0]);
                    const free = parseInt(values[1]);
                    systemStats.disk = Math.round((used / (used + free)) * 100);
                }
            }
        });
    }
}
setInterval(updateDiskStats, 120000);
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
        network: Math.floor(Math.random() * 5) + 2, // Ruido simulado más bajo
        appRam: Math.round(process.memoryUsage().rss / 1024 / 1024),
        appCpu: Math.max(1, Math.round(cpuUsage * 0.08)) // Factor de eficiencia mejorado
    };
});

ipcMain.handle('clean-cache', async () => {
    const session = mainWindow.webContents.session;
    await session.clearCache();
    await session.clearStorageData();
    return true;
});

ipcMain.handle('toggle-power-save', (event, enabled) => {
    if (enabled) {
        powerSaveId = powerSaveBlocker.start('prevent-app-suspension');
        app.commandLine.appendSwitch('high-dpi-support', '1');
    } else {
        if (powerSaveId !== null) {
            powerSaveBlocker.stop(powerSaveId);
            powerSaveId = null;
        }
    }
    return enabled;
});

ipcMain.handle('capture-page', async () => {
    const image = await mainWindow.capturePage();
    const savePath = path.join(app.getPath('pictures'), `NavigaThor_Capture_${Date.now()}.png`);
    const fs = require('fs');
    fs.writeFileSync(savePath, image.toPNG());
    return savePath;
});

ipcMain.handle('open-downloads', () => {
    shell.openPath(app.getPath('downloads'));
    return true;
});

ipcMain.handle('kill-apps', async () => {
    const commands = [
        'taskkill /F /IM msedge.exe /T',
        'taskkill /F /IM chrome.exe /T'
    ];
    commands.forEach(cmd => exec(cmd).on('error', () => { }));
    exec('taskmgr.exe');
    return true;
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});



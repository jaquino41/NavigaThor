const { app, BrowserWindow, ipcMain, shell, powerSaveBlocker, session } = require('electron');
const path = require('path');
const os = require('os');

// IDENTIDAD VIVALDI (Altamente confiable para Google y basada en Chromium)
const VIVALDI_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 Vivaldi/7.0.3491.53';

// Ruta de sesión fresca para limpiar cualquier rastro anterior
const baseDir = path.join(os.homedir(), '.navigathor-v8-vivaldi');
app.setPath('userData', baseDir);

// Switches de Motor (Oficiales de Chromium, no detectables como manipulación JS)
app.commandLine.appendSwitch('disable-blink-features', 'AutomationControlled');
app.commandLine.appendSwitch('lang', 'es-ES');

let mainWindow;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1400,
        height: 950,
        frame: false,
        title: 'NavigaThor',
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            sandbox: true,
            webviewTag: true,
            preload: path.join(__dirname, 'preload.js'),
            // Optimizaciones de privacidad
            enableRemoteModule: false
        },
        backgroundColor: '#111827',
        show: false
    });

    mainWindow.loadFile(path.join(__dirname, 'index.html'));
    mainWindow.once('ready-to-show', () => mainWindow.show());
}

app.whenReady().then(() => {
    // Configuración de Sesión
    const s = session.defaultSession;
    s.setUserAgent(VIVALDI_UA);

    // Interceptor de cabeceras minimalista
    s.webRequest.onBeforeSendHeaders((details, callback) => {
        const headers = details.requestHeaders;

        // Solo eliminamos la marca de app integrada
        delete headers['X-Requested-With'];

        // Sincronizamos con la identidad de Vivaldi
        headers['User-Agent'] = VIVALDI_UA;
        headers['Sec-CH-UA'] = '"Chromium";v="130", "Vivaldi";v="7.0", "Not?A_Brand";v="99"';
        headers['Sec-CH-UA-Mobile'] = '?0';
        headers['Sec-CH-UA-Platform'] = '"Windows"';

        callback({ cancel: false, requestHeaders: headers });
    });

    createWindow();
});

// Los handlers de IPC se mantienen por funcionalidad (omitidos por brevedad)
ipcMain.on('window-control', (event, action) => {
    if (action === 'close') app.quit();
    if (action === 'minimize') mainWindow.minimize();
    if (action === 'maximize') {
        if (mainWindow.isMaximized()) mainWindow.unmaximize();
        else mainWindow.maximize();
    }
});

// Handlers de sistema básicos
ipcMain.handle('get-system-stats', async () => ({ cpu: 5, ram: 40, disk: 10, appRam: 120, appCpu: 1 }));
ipcMain.handle('clean-cache', async () => {
    await session.defaultSession.clearCache();
    await session.defaultSession.clearStorageData();
    return true;
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});

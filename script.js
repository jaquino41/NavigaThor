const { ipcRenderer } = require('electron');

// Estado Global
let tabs = [];
let activeTabId = null;
const browserContainer = document.getElementById('browserContainer');
const tabsBar = document.getElementById('tabsBar');
const urlInput = document.getElementById('urlInput');
const engineSelect = document.getElementById('engineSelect');
const statusText = document.getElementById('statusText');

// Motores de Búsqueda
const ENGINES = {
    google: 'https://www.google.com/search?q=',
    duck: 'https://duckduckgo.com/?q=',
    bing: 'https://www.bing.com/search?q=',
    apple: 'https://www.apple.com/search?q='
};

class Tab {
    constructor(id, url = 'https://www.google.com') {
        this.id = id;
        this.color = this.generateRandomColor();
        this.title = 'Cargando...';
        this.url = url;

        // Crear elemento Webview
        this.webview = document.createElement('webview');
        this.webview.setAttribute('src', url);
        this.webview.className = 'tab-content';
        this.webview.id = `webview-${id}`;
        // Identidad Ultra-Limpia de Chrome 122 para bypass de seguridad
        this.webview.setAttribute('useragent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');

        // Crear elemento visual de la pestaña
        this.tabEl = document.createElement('div');
        this.tabEl.className = 'tab';
        this.tabEl.id = `tab-btn-${id}`;
        this.tabEl.style.borderTop = `3px solid ${this.color}`;
        this.tabEl.innerHTML = `
            <span class="tab-title">${this.title}</span>
            <span class="tab-close" onclick="closeTab('${this.id}', event)">×</span>
        `;

        this.tabEl.onclick = () => selectTab(this.id);

        // Listeners del Webview
        this.webview.addEventListener('did-start-loading', () => {
            if (activeTabId === this.id) document.getElementById('loadingSpinner').classList.remove('hidden');
        });

        this.webview.addEventListener('did-stop-loading', () => {
            if (activeTabId === this.id) document.getElementById('loadingSpinner').classList.add('hidden');
            this.updateMetadata();
        });

        this.webview.addEventListener('page-title-updated', (e) => {
            this.title = e.title;
            this.tabEl.querySelector('.tab-title').textContent = e.title;
        });

        // "Capa de Invisibilidad" avanzada para Google/YouTube
        this.webview.addEventListener('dom-ready', () => {
            this.webview.executeJavaScript(`
                // Ocultar automatización
                Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
                
                // Simular Chrome real
                window.chrome = {
                  runtime: {},
                  loadTimes: function() {},
                  csi: function() {},
                  app: {}
                };

                // Corregir plataformas
                Object.defineProperty(navigator, 'languages', { get: () => ['es-ES', 'es', 'en'] });
                Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
            `);
        });

        this.webview.addEventListener('did-navigate', (e) => {
            this.url = e.url;
            if (activeTabId === this.id) {
                urlInput.value = e.url;
                updateFavUI();
            }
            addToHistory(e.url, this.title);
        });

        browserContainer.appendChild(this.webview);
        tabsBar.insertBefore(this.tabEl, document.getElementById('newTabBtn'));
    }

    generateRandomColor() {
        const colors = ['#38bdf8', '#a78bfa', '#f472b6', '#fb923c', '#4ade80', '#e879f9'];
        return colors[Math.floor(Math.random() * colors.length)];
    }

    updateMetadata() {
        try {
            this.url = this.webview.getURL();
            if (activeTabId === this.id) {
                urlInput.value = this.url;
                statusText.textContent = `${this.title}`;
            }
        } catch (e) { }
    }
}

// --- Gestión de Pestañas ---

function addTab(url) {
    const id = Date.now().toString();
    const newTab = new Tab(id, url);
    tabs.push(newTab);
    selectTab(id);
}

function selectTab(id) {
    activeTabId = id;
    tabs.forEach(t => {
        t.webview.classList.remove('active');
        t.tabEl.classList.remove('active');
        if (t.id === id) {
            t.webview.classList.add('active');
            t.tabEl.classList.add('active');
            urlInput.value = t.url;
            statusText.textContent = `${t.title}`;
            updateFavUI();
        }
    });
}

function closeTab(id, event) {
    if (event) event.stopPropagation();

    if (tabs.length === 1) {
        addTab('https://www.google.com');
    }

    const index = tabs.findIndex(t => t.id === id);
    if (index === -1) return;

    const tabToClose = tabs[index];
    tabToClose.webview.remove();
    tabToClose.tabEl.remove();
    tabs.splice(index, 1);

    if (activeTabId === id) {
        const nextTab = tabs[index] || tabs[index - 1];
        selectTab(nextTab.id);
    }
}

// --- Navegación ---

urlInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        let val = urlInput.value.trim();
        if (!val) return;

        if (!val.includes('.') || val.includes(' ')) {
            const engine = ENGINES[engineSelect.value];
            val = engine + encodeURIComponent(val);
        } else if (!val.startsWith('http')) {
            val = 'https://' + val;
        }

        const currentTab = tabs.find(t => t.id === activeTabId);
        if (currentTab) currentTab.webview.loadURL(val);
    }
});

document.getElementById('backBtn').onclick = () => {
    const currentTab = tabs.find(t => t.id === activeTabId);
    if (currentTab && currentTab.webview.canGoBack()) currentTab.webview.goBack();
};

document.getElementById('forwardBtn').onclick = () => {
    const currentTab = tabs.find(t => t.id === activeTabId);
    if (currentTab && currentTab.webview.canGoForward()) currentTab.webview.goForward();
};

document.getElementById('reloadBtn').onclick = () => {
    const currentTab = tabs.find(t => t.id === activeTabId);
    if (currentTab) currentTab.webview.reload();
};

document.getElementById('newTabBtn').onclick = () => addTab('https://www.google.com');

// --- Sidebar y Stats ---

const sidebar = document.getElementById('mainSidebar');
const statsBox = document.getElementById('appStatsBox');

document.getElementById('toggleSidebar').onclick = () => {
    sidebar.classList.toggle('hidden');
};

document.getElementById('closeSidebar').onclick = () => {
    sidebar.classList.add('hidden');
};

// --- Herramientas PRO ---
let darkModeEnabled = false;
document.getElementById('toggleDarkMode').onclick = () => {
    darkModeEnabled = !darkModeEnabled;
    const currentTab = tabs.find(t => t.id === activeTabId);
    if (currentTab) {
        currentTab.webview.insertCSS(darkModeEnabled ? `
            html, body { filter: invert(1) hue-rotate(180deg) !important; background: #000 !important; }
            img, video, iframe { filter: invert(1) hue-rotate(180deg) !important; }
        ` : 'html, body { filter: none !important; }');
    }
    showToast(darkModeEnabled ? "Modo Dark Forzado Activado 🌙" : "Modo Dark Desactivado ☀️");
    sidebar.classList.add('hidden');
};

document.getElementById('capturePage').onclick = async () => {
    try {
        const path = await ipcRenderer.invoke('capture-page');
        showToast(`Captura guardada en: ${path} 📸`);
    } catch (e) {
        showToast("Error al realizar la captura");
    }
    sidebar.classList.add('hidden');
};

document.getElementById('cleanCache').onclick = async () => {
    if (confirm("¿Estás seguro de que quieres limpiar la caché y datos de navegación?")) {
        await ipcRenderer.invoke('clean-cache');
        showToast("Caché y datos eliminados correctamente 🧹");
    }
    sidebar.classList.add('hidden');
};

document.getElementById('killApps').onclick = async () => {
    if (confirm("¿Deseas cerrar navegadores pesados y abrir el Administrador de Tareas para liberar RAM?")) {
        await ipcRenderer.invoke('kill-apps');
        showToast("Limpieza selectiva de procesos en curso... 💀");
    }
    sidebar.classList.add('hidden');
};

document.getElementById('toggleAppStats').onclick = () => {
    statsBox.classList.toggle('hidden');
};

function windowControl(action) {
    ipcRenderer.send('window-control', action);
}

// Historial
function addToHistory(url, title) {
    let history = JSON.parse(localStorage.getItem('thorHistory') || '[]');
    // Evitar duplicados consecutivos
    if (history.length > 0 && history[0].url === url) return;

    history.unshift({ url, title, date: new Date().toISOString() });
    if (history.length > 50) history.pop();
    localStorage.setItem('thorHistory', JSON.stringify(history));
}

document.getElementById('btnHistory').onclick = () => {
    const history = JSON.parse(localStorage.getItem('thorHistory') || '[]');
    const historyHtml = `
        <html lang="es"><head>
        <meta charset="UTF-8">
        <title>Historial - NavigaThor</title>
        <style>
            body { background: #0b0f1a; color: #f1f5f9; font-family: 'Outfit', sans-serif; padding: 40px; margin: 0; } 
            .container { max-width: 800px; margin: 0 auto; }
            h1 { color: #38bdf8; font-weight: 800; border-bottom: 2px solid #38bdf8; padding-bottom: 10px; margin-bottom: 30px; display: flex; align-items: center; gap: 10px; }
            .item { padding: 15px; border-bottom: 1px solid rgba(255,255,255,0.05); cursor: pointer; transition: 0.2s; border-radius: 8px; } 
            .item:hover { background: rgba(56,189,248,0.1); transform: translateX(5px); }
            .title { font-weight: 600; font-size: 1.1rem; color: #fff; margin-bottom: 4px; }
            .url { color: #94a3b8; font-size: 0.9rem; word-break: break-all; }
            small { opacity: 0.5; font-size: 0.7rem; display: block; margin-top: 5px; }
        </style></head><body>
        <div class="container">
            <h1>📜 Tu Historial NavigaThor</h1>
            ${history.map(h => `
                <div class="item" onclick="window.location='${h.url}'">
                    <div class="title">${h.title || 'Sitio Web'}</div>
                    <div class="url">${h.url}</div>
                    <small>${new Date(h.date).toLocaleString()}</small>
                </div>
            `).join('')}
            ${history.length === 0 ? '<p>No hay historial aún.</p>' : ''}
        </div>
        </body></html>
    `;
    const blob = new Blob([historyHtml], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    addTab(url);
    sidebar.classList.add('hidden');
};

document.getElementById('btnFavorites').onclick = () => {
    const favorites = JSON.parse(localStorage.getItem('thorFavorites') || '[]');
    const favHtml = `
        <html lang="es"><head>
        <meta charset="UTF-8">
        <title>Favoritos - NavigaThor</title>
        <style>
            body { background: #0b213a; color: #f1f5f9; font-family: 'Outfit', sans-serif; padding: 40px; margin: 0; } 
            .container { max-width: 800px; margin: 0 auto; }
            h1 { color: #ffbd2e; font-weight: 800; border-bottom: 2px solid #ffbd2e; padding-bottom: 10px; margin-bottom: 30px; display: flex; align-items: center; gap: 10px; }
            .item { padding: 15px; border-bottom: 1px solid rgba(255,189,46,0.1); cursor: pointer; transition: 0.2s; border-radius: 12px; position: relative; margin-bottom: 10px; background: rgba(255,255,255,0.03); } 
            .item:hover { background: rgba(255,189,46,0.15); transform: translateX(8px); border-color: #ffbd2e; }
            .title { font-weight: 600; font-size: 1.1rem; color: #fff; margin-bottom: 4px; padding-right: 40px; }
            .url { color: #94a3b8; font-size: 0.9rem; word-break: break-all; }
            .star { color: #ffbd2e; position: absolute; right: 20px; top: 50%; transform: translateY(-50%); font-size: 1.2rem; }
        </style></head><body>
        <div class="container">
            <h1>⭐ Tus Favoritos NavigaThor</h1>
            ${favorites.map(f => `
                <div class="item" onclick="window.location='${f.url}'">
                    <div class="title">${f.title || 'Sitio Web'}</div>
                    <div class="url">${f.url}</div>
                    <div class="star">⭐</div>
                </div>
            `).join('')}
            ${favorites.length === 0 ? '<div style="text-align:center; padding-top: 50px; opacity:0.5;"><h3>No tienes favoritos aún.</h3><p>Pulsa la estrella en la barra del navegador para guardar tus páginas preferidas.</p></div>' : ''}
        </div>
        </body></html>
    `;
    const blob = new Blob([favHtml], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    addTab(url);
    sidebar.classList.add('hidden');
};

document.getElementById('btnDownloads').onclick = () => {
    ipcRenderer.invoke('open-downloads');
    sidebar.classList.add('hidden');
};

// Compartir
window.shareTo = (platform) => {
    const currentTab = tabs.find(t => t.id === activeTabId);
    if (!currentTab) return;
    const url = currentTab.url;
    const text = `NavigaThor: ${currentTab.title}`;

    let shareUrl = '';
    switch (platform) {
        case 'whatsapp': shareUrl = `https://web.whatsapp.com/send?text=${encodeURIComponent(text + ' ' + url)}`; break;
        case 'telegram': shareUrl = `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`; break;
        case 'twitter': shareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`; break;
        case 'facebook': shareUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`; break;
        case 'instagram': shareUrl = `https://www.instagram.com/`; break; // Instagram no permite compartir URL directa via web fácilmente
        case 'email': shareUrl = `https://mail.google.com/mail/?view=cm&fs=1&su=${encodeURIComponent(currentTab.title)}&body=${encodeURIComponent(url)}`; break;
        default: showToast("Plataforma no soportada"); return;
    }

    if (shareUrl) addTab(shareUrl);
    sidebar.classList.add('hidden');
};

// Conectar (Abrir Apps)
window.openApp = (platform) => {
    const APPS = {
        whatsapp: 'https://web.whatsapp.com',
        telegram: 'https://web.telegram.org',
        twitter: 'https://x.com',
        facebook: 'https://facebook.com',
        instagram: 'https://instagram.com',
        tiktok: 'https://tiktok.com',
        gmail: 'https://mail.google.com',
        gemini: 'https://gemini.google.com',
        chatgpt: 'https://chat.openai.com',
        copilot: 'https://copilot.microsoft.com',
        deepseek: 'https://chat.deepseek.com',
        aistudio: 'https://aistudio.google.com'
    };

    const url = APPS[platform];
    if (url) {
        addTab(url);
        showToast(`Iniciando sesión en ${platform.charAt(0).toUpperCase() + platform.slice(1)}... ⚡`);
    }
    sidebar.classList.add('hidden');
};

// UI Helpers
window.toggleDropdown = (id) => {
    const content = document.getElementById(id);
    const trigger = content.previousElementSibling;
    content.classList.toggle('hidden');
    trigger.classList.toggle('active');
};

// --- Sistema de Stats ---

async function updateStats() {
    try {
        const stats = await ipcRenderer.invoke('get-system-stats');

        // Update Bars
        document.getElementById('barCpu').style.width = `${stats.cpu}%`;
        document.getElementById('valCpu').textContent = `${stats.cpu}%`;

        document.getElementById('barRam').style.width = `${stats.ram}%`;
        document.getElementById('valRam').textContent = `${stats.ram}%`;

        // App Specific Stats
        if (document.getElementById('barAppCpu')) {
            document.getElementById('barAppCpu').style.width = `${stats.appCpu}%`;
            document.getElementById('valAppCpu').textContent = `${stats.appCpu}%`;
        }

        document.getElementById('valAppRam').textContent = `${stats.appRam} MB`;
        document.getElementById('valDisk').textContent = `${stats.disk}%`;

    } catch (e) {
        console.warn("Stats error", e);
    }
}

setInterval(updateStats, 3000);

document.getElementById('optimizeBtn').onclick = () => {
    showToast("Mjolnir ha liberado recursos ⚡");
    updateStats();
};

function showToast(msg) {
    const toast = document.getElementById('toast');
    toast.textContent = msg;
    toast.classList.remove('hidden');
    setTimeout(() => toast.classList.add('hidden'), 3500);
}

// --- Gestión de Favoritos ---
let favorites = JSON.parse(localStorage.getItem('thorFavorites') || '[]');

function updateFavUI() {
    const activeTab = tabs.find(t => t.id === activeTabId);
    const btn = document.getElementById('addFavBtn');
    if (!activeTab || !btn) return;

    const isFav = favorites.some(f => f.url === activeTab.url);
    if (isFav) {
        btn.classList.add('active');
        btn.textContent = '⭐';
    } else {
        btn.classList.remove('active');
        btn.textContent = '☆';
    }
}

function toggleFavorite() {
    const activeTab = tabs.find(t => t.id === activeTabId);
    if (!activeTab) return;

    const url = activeTab.url;
    const title = activeTab.title;
    const index = favorites.findIndex(f => f.url === url);

    if (index === -1) {
        favorites.push({ url, title, date: new Date().toISOString() });
        showToast("Página guardada en Favoritos ⭐");
    } else {
        favorites.splice(index, 1);
        showToast("Página eliminada de Favoritos");
    }

    localStorage.setItem('thorFavorites', JSON.stringify(favorites));
    updateFavUI();
}

document.getElementById('addFavBtn').onclick = toggleFavorite;

// Inicialización
addTab('https://www.google.com');
updateStats();

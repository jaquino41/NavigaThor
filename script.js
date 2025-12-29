const thorAPI = window.thorBridge;

// Estado Global
let tabs = [];
let activeTabId = null;
const browserContainer = document.getElementById('browserContainer');
const tabsBar = document.getElementById('tabsBar');
const urlInput = document.getElementById('urlInput');
const engineSelect = document.getElementById('engineSelect');
const statusText = document.getElementById('statusText');

const MAX_ACTIVE_TABS = 5;

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
        this.hibernated = false;
        this.webview = null;

        this.tabEl = document.createElement('div');
        this.tabEl.className = 'tab';
        this.tabEl.id = `tab-btn-${id}`;
        this.tabEl.style.borderTop = `3px solid ${this.color}`;
        this.tabEl.innerHTML = `
            <span class="tab-title">${this.title}</span>
            <span class="tab-close" onclick="closeTab('${this.id}', event)">×</span>
        `;

        this.tabEl.onclick = () => selectTab(this.id);
        this.createWebview(url);
        tabsBar.insertBefore(this.tabEl, document.getElementById('newTabBtn'));
    }

    createWebview(url) {
        if (this.webview) this.webview.remove();

        this.webview = document.createElement('webview');
        this.webview.setAttribute('src', url);
        this.webview.className = 'tab-content';
        this.webview.id = `webview-${this.id}`;
        this.webview.setAttribute('allowpopups', ''); // Necesario para ventanas de login

        this.addWebviewListeners();
        browserContainer.appendChild(this.webview);
        this.hibernated = false;
    }

    addWebviewListeners() {
        this.webview.addEventListener('did-start-loading', () => {
            if (activeTabId === this.id) {
                const spinner = document.getElementById('loadingSpinner');
                if (spinner) spinner.classList.remove('hidden');
            }
        });

        this.webview.addEventListener('did-stop-loading', () => {
            if (activeTabId === this.id) {
                const spinner = document.getElementById('loadingSpinner');
                if (spinner) spinner.classList.add('hidden');
            }
            this.updateMetadata();
        });

        this.webview.addEventListener('page-title-updated', (e) => {
            this.title = e.title;
            const titleEl = this.tabEl.querySelector('.tab-title');
            if (titleEl) titleEl.textContent = e.title;
        });

        this.webview.addEventListener('did-navigate', (e) => {
            this.url = e.url;
            if (activeTabId === this.id) {
                urlInput.value = e.url;
                updateFavUI();
            }
            addToHistory(e.url, this.title);
        });
    }

    hibernate() {
        if (this.hibernated || activeTabId === this.id) return;
        if (this.webview) {
            this.url = this.webview.getURL();
            this.webview.remove();
            this.webview = null;
        }
        this.hibernated = true;
        this.tabEl.classList.add('hibernated');
    }

    wakeUp() {
        if (!this.hibernated) return;
        this.createWebview(this.url);
        this.tabEl.classList.remove('hibernated');
    }

    generateRandomColor() {
        const colors = ['#38bdf8', '#a78bfa', '#f472b6', '#fb923c', '#4ade80', '#e879f9'];
        return colors[Math.floor(Math.random() * colors.length)];
    }

    updateMetadata() {
        try {
            if (this.webview) {
                this.url = this.webview.getURL();
                if (activeTabId === this.id) {
                    urlInput.value = this.url;
                    statusText.textContent = `${this.title}`;
                }
            }
        } catch (e) { }
    }
}

function addTab(url) {
    const id = Date.now().toString();
    const newTab = new Tab(id, url);
    tabs.push(newTab);
    selectTab(id);
    if (tabs.length > MAX_ACTIVE_TABS) {
        const toHibernate = tabs.slice(0, tabs.length - MAX_ACTIVE_TABS);
        toHibernate.forEach(t => t.hibernate());
    }
}

function selectTab(id) {
    activeTabId = id;
    tabs.forEach(t => {
        const isActive = t.id === id;
        if (isActive) {
            if (t.hibernated) t.wakeUp();
            if (t.webview) t.webview.classList.add('active');
            t.tabEl.classList.add('active');
            urlInput.value = t.url;
            statusText.textContent = `${t.title}`;
            updateFavUI();
        } else {
            if (t.webview) t.webview.classList.remove('active');
            t.tabEl.classList.remove('active');
        }
    });
}

function closeTab(id, event) {
    if (event) event.stopPropagation();
    if (tabs.length === 1) addTab('https://www.google.com');
    const index = tabs.findIndex(t => t.id === id);
    if (index === -1) return;
    const tabToClose = tabs[index];
    if (tabToClose.webview) tabToClose.webview.remove();
    tabToClose.tabEl.remove();
    tabs.splice(index, 1);
    if (activeTabId === id) {
        const nextTab = tabs[index] || tabs[index - 1];
        selectTab(nextTab.id);
    }
}

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
        if (currentTab) {
            if (currentTab.hibernated) currentTab.wakeUp();
            currentTab.webview.loadURL(val);
        }
    }
});

document.getElementById('backBtn').onclick = () => {
    const currentTab = tabs.find(t => t.id === activeTabId);
    if (currentTab && currentTab.webview && currentTab.webview.canGoBack()) currentTab.webview.goBack();
};
document.getElementById('forwardBtn').onclick = () => {
    const currentTab = tabs.find(t => t.id === activeTabId);
    if (currentTab && currentTab.webview && currentTab.webview.canGoForward()) currentTab.webview.goForward();
};
document.getElementById('reloadBtn').onclick = () => {
    const currentTab = tabs.find(t => t.id === activeTabId);
    if (currentTab && currentTab.webview) currentTab.webview.reload();
};
document.getElementById('newTabBtn').onclick = () => addTab('https://www.google.com');

const sidebar = document.getElementById('mainSidebar');
const statsBox = document.getElementById('appStatsBox');
document.getElementById('toggleSidebar').onclick = () => sidebar.classList.toggle('hidden');
document.getElementById('closeSidebar').onclick = () => sidebar.classList.add('hidden');

let bitMode = false;
document.getElementById('toggleDarkMode').onclick = async () => {
    bitMode = !bitMode;
    await thorAPI.invoke('toggle-power-save', bitMode);
    const btn = document.getElementById('toggleDarkMode');
    btn.innerHTML = bitMode ? '<span class="icon">⚡</span> Ahorro Activado' : '<span class="icon">🌓</span> Modo Ultra Ahorro';
    btn.classList.toggle('active', bitMode);
    showToast(bitMode ? "Modo Ultra Ahorro de Recursos Activado ⚡" : "Modo Normal Restaurado");
    sidebar.classList.add('hidden');
};

document.getElementById('capturePage').onclick = async () => {
    try {
        const path = await thorAPI.invoke('capture-page');
        showToast(`Captura guardada en: ${path} 📸`);
    } catch (e) {
        showToast("Error al realizar la captura");
    }
    sidebar.classList.add('hidden');
};

document.getElementById('cleanCache').onclick = async () => {
    if (confirm("¿Estás seguro de que quieres limpiar la caché y datos de navegación?")) {
        await thorAPI.invoke('clean-cache');
        showToast("Caché y datos eliminados correctamente 🧹");
    }
    sidebar.classList.add('hidden');
};

document.getElementById('killApps').onclick = async () => {
    if (confirm("¿Deseas cerrar navegadores pesados y abrir el Administrador de Tareas para liberar RAM?")) {
        await thorAPI.invoke('kill-apps');
        showToast("Limpieza selectiva de procesos en curso... 💀");
    }
    sidebar.classList.add('hidden');
};

document.getElementById('toggleAppStats').onclick = () => statsBox.classList.toggle('hidden');

window.windowControl = (action) => {
    thorAPI.send('window-control', action);
};

function addToHistory(url, title) {
    let history = JSON.parse(localStorage.getItem('thorHistory') || '[]');
    if (history.length > 0 && history[0].url === url) return;
    history.unshift({ url, title, date: new Date().toISOString() });
    if (history.length > 50) history.pop();
    localStorage.setItem('thorHistory', JSON.stringify(history));
}

document.getElementById('btnHistory').onclick = () => {
    const history = JSON.parse(localStorage.getItem('thorHistory') || '[]');
    const historyHtml = `
        <html lang="es"><head><meta charset="UTF-8"><title>Historial</title><style>body { background:#0b0f1a; color:#f1f5f9; font-family:sans-serif; padding:40px; } .item { padding:10px; border-bottom:1px solid #333; cursor:pointer; }</style></head>
        <body><h1>📜 Historial</h1>${history.map(h => `<div class="item" onclick="location='${h.url}'"><b>${h.title || h.url}</b><br>${h.url}</div>`).join('')}</body></html>
    `;
    const blob = new Blob([historyHtml], { type: 'text/html' });
    addTab(URL.createObjectURL(blob));
    sidebar.classList.add('hidden');
};

document.getElementById('btnFavorites').onclick = () => {
    const favorites = JSON.parse(localStorage.getItem('thorFavorites') || '[]');
    const favHtml = `
        <html lang="es"><head><meta charset="UTF-8"><title>Favoritos</title><style>body { background:#0b213a; color:#f1f5f9; font-family:sans-serif; padding:40px; } .item { padding:10px; border-bottom:1px solid #333; cursor:pointer; }</style></head>
        <body><h1>⭐ Favoritos</h1>${favorites.map(f => `<div class="item" onclick="location='${f.url}'"><b>${f.title}</b><br>${f.url}</div>`).join('')}</body></html>
    `;
    const blob = new Blob([favHtml], { type: 'text/html' });
    addTab(URL.createObjectURL(blob));
    sidebar.classList.add('hidden');
};

document.getElementById('btnDownloads').onclick = () => {
    thorAPI.invoke('open-downloads');
    sidebar.classList.add('hidden');
};

async function updateStats() {
    if (sidebar.classList.contains('hidden') && statsBox.classList.contains('hidden')) return;
    try {
        const stats = await thorAPI.invoke('get-system-stats');
        document.getElementById('barCpu').style.width = `${stats.cpu}%`;
        document.getElementById('valCpu').textContent = `${stats.cpu}%`;
        document.getElementById('barRam').style.width = `${stats.ram}%`;
        document.getElementById('valRam').textContent = `${stats.ram}%`;
        if (document.getElementById('barAppCpu')) {
            document.getElementById('barAppCpu').style.width = `${stats.appCpu}%`;
            document.getElementById('valAppCpu').textContent = `${stats.appCpu}%`;
        }
        document.getElementById('valAppRam').textContent = `${stats.appRam} MB`;
        document.getElementById('valDisk').textContent = `${stats.disk}%`;
    } catch (e) { }
}
setInterval(updateStats, 4000);

document.getElementById('optimizeBtn').onclick = async () => {
    await thorAPI.invoke('clean-cache');
    showToast("Mjolnir Liberado ⚡");
    updateStats();
};

function showToast(msg) {
    const toast = document.getElementById('toast');
    toast.textContent = msg;
    toast.classList.remove('hidden');
    setTimeout(() => toast.classList.add('hidden'), 3500);
}

let favorites = JSON.parse(localStorage.getItem('thorFavorites') || '[]');
function updateFavUI() {
    const activeTab = tabs.find(t => t.id === activeTabId);
    const btn = document.getElementById('addFavBtn');
    if (!activeTab || !btn) return;
    const isFav = favorites.some(f => f.url === activeTab.url);
    btn.textContent = isFav ? '⭐' : '☆';
}

function toggleFavorite() {
    const activeTab = tabs.find(t => t.id === activeTabId);
    if (!activeTab) return;
    const url = activeTab.url;
    const title = activeTab.title;
    const index = favorites.findIndex(f => f.url === url);
    if (index === -1) {
        favorites.push({ url, title, date: new Date().toISOString() });
    } else {
        favorites.splice(index, 1);
    }
    localStorage.setItem('thorFavorites', JSON.stringify(favorites));
    updateFavUI();
}
document.getElementById('addFavBtn').onclick = toggleFavorite;

window.openApp = (platform) => {
    const APPS = { whatsapp: 'https://web.whatsapp.com', telegram: 'https://web.telegram.org', twitter: 'https://x.com', facebook: 'https://facebook.com', instagram: 'https://instagram.com', tiktok: 'https://tiktok.com', gmail: 'https://mail.google.com', gemini: 'https://gemini.google.com', chatgpt: 'https://chat.openai.com', copilot: 'https://copilot.microsoft.com', deepseek: 'https://chat.deepseek.com', aistudio: 'https://aistudio.google.com' };
    const url = APPS[platform];
    if (url) addTab(url);
    sidebar.classList.add('hidden');
};

window.toggleDropdown = (id) => document.getElementById(id).classList.toggle('hidden');

// Start
addTab('https://www.google.com');

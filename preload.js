const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('thorBridge', {
    send: (channel, data) => {
        const validChannels = ['window-control', 'open-external'];
        if (validChannels.includes(channel)) {
            ipcRenderer.send(channel, data);
        }
    },
    invoke: (channel, data) => {
        const validChannels = [
            'get-system-stats',
            'clean-cache',
            'toggle-power-save',
            'capture-page',
            'open-downloads',
            'kill-apps'
        ];
        if (validChannels.includes(channel)) {
            return ipcRenderer.invoke(channel, data);
        }
    }
});

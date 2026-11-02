const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  sendTerminalCommand: (command) => ipcRenderer.send('execute-custom-command', command), // renderer to main
  onCreateNote: (data) => ipcRenderer.invoke('create-new-note', data),
  onDeleteNote: (id) => ipcRenderer.invoke('close-and-delete-note', id),
  onUpdateContent: (data) => ipcRenderer.invoke('update-note-content', data),
   onLoadContent: (callback) => {
        ipcRenderer.removeAllListeners('load-note-content');
        ipcRenderer.on('load-note-content', (event, data) => callback(data));
    }
});

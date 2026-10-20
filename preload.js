const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  sendTerminalCommand: (command) => ipcRenderer.send('execute-custom-command', command), // renderer to main
  onCreateNote: (text) => ipcRenderer.invoke('create-new-note', text),
  onDeleteNote: (id) => ipcRenderer.invoke('close-and-delete-note', id),
  onUpdateText: (id, text) => ipcRenderer.invoke('update-text', id, text),
  onLoadContent: (callback) => ipcRenderer.on('load-note-content', (event, data) => callback(data))
});

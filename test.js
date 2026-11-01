const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');

let activeWindows = new Map();

function createNote(id, content, x, y, colour) {
  if (activeWindows.has(id)) return; // Prevent duplicate windows for the same record

  const win = new BrowserWindow({
    width: 250,
    height: 250,
    x: x || 200,
    y: y || 200,
    frame: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    resizable: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  win.loadFile('note.html');
  activeWindows.set(id, win);
  win.setAlwaysOnTop(true, 'screen-saver');

  // send content data once webContents finish loading
  win.webContents.on('did-finish-load', () => {
    win.webContents.send('load-note-content', { id, content, colour });
  });
  win.on('moved', () => {
    const [x_pos, y_pos] = win.getPosition();
  });

  win.on('resize', () => { // bug where moving the window slightly increases the window size
    win.setContentSize(250, 250); // set it back to 250x250
  });

  win.on('closed', () => {
    activeWindows.delete(id);
  });
}

app.whenReady().then(() => {
  createNote("main", "testing note", 250, 250, "blue");
});


app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

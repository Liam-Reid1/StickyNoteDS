const { app, BrowserWindow, ipcMain, screen } = require('electron');
const path = require('path');
const os = require('os');

let mainWindow;

function createWindow() {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;
  const windowWidth = 200;
  const windowHeight = 300;

  mainWindow = new BrowserWindow({
    width: windowWidth,
    height: windowHeight,
    x: 0,
    y: height - windowHeight,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: false, // Keep false so the user can't manually drag resize it
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'), // preload script for security
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  mainWindow.loadFile('index.html'); // Load your main file directly

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    mainWindow.setIgnoreMouseEvents(true, { forward: true });
  });
}

ipcMain.on('disable-click-through', () => {
  mainWindow.setIgnoreMouseEvents(false);
});

ipcMain.on('enable-click-through', () => {
  mainWindow.setIgnoreMouseEvents(true, { forward: true });
});

ipcMain.on('close-terminal', () => {
  if (process.platform !== 'darwin') app.quit();
});


app.whenReady().then(() => {
  createWindow();

  ipcMain.on('execute-custom-command', async (event, command) => {
    console.log(`Command received: ${JSON.stringify(command)}`);

    const baseCommand = command.command; // create, grab, hide
    if (baseCommand.length === 0) return;
    try {
      switch (baseCommand) {
        case 'help':
          console.log("add help command here");
          break;

        case 'create': {
          const randomX = Math.floor(Math.random() * 500) + 100;
          const randomY = Math.floor(Math.random() * 500) + 100;

          // Check flags or fall back to defaults
          const type = parseInt(command.type, 10);
          const noteText = command.text;
          const colour = command.colour;
          const { data, error } = await supabase
            .from('notes')
            .insert([{ content: noteText, x_pos: randomX, y_pos: randomY, colour: colour, type: type, canvas_json: null }]);

          if (error) throw error;

          console.log('Note created successfully:', data);
          event.reply('execute-custom-command-success', 'Note created successfully.');
          break;
        }

        case 'grab':
          // Pulls all rows from notes
          callSupabase();
          event.reply('execute-custom-command-success', 'Fetched latest notes.');
          break;

        case 'hide': {
          const allWindows = BrowserWindow.getAllWindows();
          allWindows.forEach((win) => {
            // Safely close note windows
            if (typeof mainWindow !== 'undefined' && win !== mainWindow) {
              win.close();
            }
          });
          event.reply('execute-custom-command-success', 'Hidden non-main windows.');
          break;
        }

        default:
          console.log(`Unknown command: ${baseCommand}`);
          event.reply('execute-custom-command-error', `Unknown command: ${baseCommand}`);
          break;
      }
    } catch (error) {
      console.error('An error occurred inside the ipcMain handler:', error);
      event.reply('execute-custom-command-error', error.message);
    }
  });
});


app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
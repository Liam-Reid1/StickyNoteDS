const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const os = require('os');
const { createClient } = require('@supabase/supabase-js');

// posting env is bad
require('dotenv').config({
  path: app.isPackaged 
    ? path.join(process.resourcesPath, '.env') 
    : path.resolve(process.cwd(), '.env')
});

const supabase = createClient(
  process.env.SUPABASE_URL, 
  process.env.SUPABASE_KEY
);

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'), // preload script for security
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.loadFile('index.html');

  mainWindow.on('closed', () => { // close terminal, close all (does not delete notes)
    if (process.platform !== 'darwin') app.quit();
  });
}

let activeWindows = new Map();

function createNote(id, content, x, y, colour, type) {
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
    win.webContents.send('load-note-content', { id, content, colour, type });
  });
  win.on('moved', () => {
    const [x_pos, y_pos] = win.getPosition();
    moveSupabase(id, x_pos, y_pos);
  });

  win.on('resize', () => { // bug where moving the window slightly increases the window size
    win.setContentSize(250, 250); // set it back to 250x250
  });

  win.on('closed', () => {
    activeWindows.delete(id);
  });
}
// listen to Supabase
function initSupabaseRealtime() {
  supabase
    .channel('schema-db-changes')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notes' }, (payload) => {
      const { id, content, x_pos, y_pos, colour, type } = payload.new;
      createNote(id, content, x_pos, y_pos, colour, type);
    })
    .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'notes' }, (payload) => {
      const targetWin = activeWindows.get(payload.old.id);
      if (targetWin) targetWin.close();
    })
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'notes' }, (payload) => {
      const {id, content, x_pos, y_pos, colour, type } = payload.new;
      const targetWin = activeWindows.get(payload.old.id);
      if (targetWin) {
        targetWin.webContents.send('load-note-content', { id, content, colour, type });
        targetWin.setPosition(x_pos, y_pos);
        targetWin.setSize(250, 250);
      }
    })
    .subscribe();
}

async function moveSupabase(id, x_pos, y_pos) {
  try {
    const { data: result, error } = await supabase
      .from('notes')
      .update({ x_pos: x_pos, y_pos: y_pos })
      .eq('id', id);

    if (error) throw error;
    return { success: true, result };
  } catch (err) {
    console.error('Failed to update note:', err);
    return { success: false, error: err.message };
  }
}

async function callSupabase() {
  const { data: rows, error } = await supabase
    .from('notes')
    .select('*');

  if (rows) {
    for (const row of rows) {
      createNote(row.id, row.content, row.x_pos, row.y_pos, row.colour, row.type); // spawn each note on local
    }
  }
}

// Bridge note user interface request to write back to Supabase
ipcMain.handle('create-new-note', async (_, data) => {
  const randomX = Math.floor(Math.random() * 500) + 100;
  const randomY = Math.floor(Math.random() * 500) + 100;
  await supabase.from('notes').insert([{ content: data.content, x_pos: randomX, y_pos: randomY, colour: data.colour, type: data.type}]);
});

ipcMain.handle('close-and-delete-note', async (_, id) => {
  await supabase.from('notes').delete().eq('id', id);
}); // currently can only delete notes individually

ipcMain.handle('update-note-content', async (event, data) => {
  try {
    const { data: result, error } = await supabase
      .from('notes')
      .update({ content: data.content, colour: data.colour })
      .eq('id', data.id);

    if (error) throw error;
    return { success: true, result };
  } catch (err) {
    console.error('Failed to update note:', err);
    return { success: false, error: err.message };
  }
});


app.whenReady().then(() => {
  initSupabaseRealtime();
  createWindow();
  callSupabase();

  ipcMain.on('execute-custom-command', async (event, command) => {
    console.log(`Command received: ${command}`);

    // string to args
    const args = command.match(/(?:[^\s"]+|"[^"]*")+/g) || [];
    if (args.length === 0) return;

    const baseCommand = args[0].toLowerCase(); // create, grab, hide

    // change this so instead of -w -c it works as -wc
    const getFlagValue = (flag) => {
      const index = args.indexOf(flag);
      if (index !== -1 && index + 1 < args.length) {
        return args[index + 1].replace(/^"|"$/g, ''); 
      }
      return null;
    };

    try {
      switch (baseCommand) {
        case 'help':
          console.log("add help command here");
          break;

        case 'create': {
          const randomX = Math.floor(Math.random() * 500) + 100;
          const randomY = Math.floor(Math.random() * 500) + 100;

          // Check flags or fall back to defaults
          const noteText = getFlagValue('-w') || 'New note';
          const colour = getFlagValue('-c') || 'yellow';

          const { data, error } = await supabase
            .from('notes')
            .insert([{ content: noteText, x_pos: randomX, y_pos: randomY, colour: colour, type: 1 }]);

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

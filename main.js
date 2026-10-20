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

function createNote(id, content, x, y) {

  if (activeWindows.has(id)) return; // Prevent duplicate windows for the same record

  const win = new BrowserWindow({
    width: 250,
    height: 250,
    x: x || 200,
    y: y || 200,
    frame: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    resizable: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  win.loadFile('note.html');
  activeWindows.set(id, win);

  // send content data once webContents finish loading
  win.webContents.on('did-finish-load', () => {
    win.webContents.send('load-note-content', { id, content });
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
      const { id, content, x_pos, y_pos } = payload.new;
      createNote(id, content, x_pos, y_pos);
    })
    .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'notes' }, (payload) => {
      const targetWin = activeWindows.get(payload.old.id);
      if (targetWin) targetWin.close();
    })
    .subscribe();
}

// Bridge note user interface request to write back to Supabase
ipcMain.handle('create-new-note', async (_, text) => {
  const randomX = Math.floor(Math.random() * 500) + 100;
  const randomY = Math.floor(Math.random() * 500) + 100;
  await supabase.from('notes').insert([{ content: text, x_pos: randomX, y_pos: randomY }]);
});

ipcMain.handle('close-and-delete-note', async (_, id) => {
  await supabase.from('notes').delete().eq('id', id);
}); // currently can only delete notes individually

app.whenReady().then(() => { 
    initSupabaseRealtime(); 
    createWindow(); 
    ipcMain.on('execute-custom-command', async (event, command) => { // custom commands from renderer.js
        console.log(`Command: ${command}`); 

        try {
          // commands from terminal
            if (command === 'help') { 
                console.log('add command list here'); 
            } else if (command === 'create') { // make new note add amounts, colour, text customization?
                const randomX = Math.floor(Math.random() * 500) + 100; 
                const randomY = Math.floor(Math.random() * 500) + 100; 
                
                const noteText = typeof text !== 'undefined' ? text : `New note`;

                const { data, error } = await supabase
                    .from('notes')
                    .insert([{ content: noteText, x_pos: randomX, y_pos: randomY }]);

                if (error) throw error; // catch Supabase API errors
                console.log('Note created successfully:', data);
            }
            else if (command === 'grab') { // pulls all rows from notes
              const { data: rows, error } = await supabase
                .from('notes')
                .select('*');

              if (rows) {
                for (const row of rows) {
                  createNote(row.id, row.content, row.x_pos, row.y_pos); // spawn each note on local
                  console.log(row.id);
                }
              }
            } else { 
                console.log(`Unknown command: ${command}`); 
            } 
        } catch (error) {
            // This catches both the ReferenceError (missing text) and network/database errors
            console.error('An error occurred inside the ipcMain handler:', error);
            
            // Send the error back to the frontend UI
            event.reply('execute-custom-command-error', error.message);
        }
    }); 
});


app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

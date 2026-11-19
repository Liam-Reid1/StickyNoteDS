const { app, BrowserWindow, ipcMain, screen } = require("electron");
const path = require("path");
const crypto = require("crypto");
const dgram = require("dgram");
const fs = require("node:fs");

// UDP Multicast Configuration
const UDP_PORT = 41234;
const MULTICAST_ADDR = "239.255.255.250"; // Local network multicast address SSDP
const INSTANCE_ID = crypto.randomUUID(); // Prevent processing our own broadcasts

const udpSocket = dgram.createSocket({ type: "udp4", reuseAddr: true });

let mainWindow;
let activeWindows = new Map();
let notesStore = new Map(); // In-memory store replacing the Supabase table

// Helper to broadcast JSON messages over UDP
function broadcastUDP(action, payload) {
  const message = Buffer.from(
    JSON.stringify({
      sender: INSTANCE_ID,
      action,
      payload,
    }),
  );

  udpSocket.send(message, 0, message.length, UDP_PORT, MULTICAST_ADDR, (err) => {
    if (err) console.error("UDP Broadcast Error:", err);
  });
}

// Initialize UDP Listener
function initUDP() {
  udpSocket.on("error", (err) => {
    console.error(`UDP socket error:\n${err.stack}`);
    udpSocket.close();
  });

  udpSocket.on("message", (msg) => {
    try {
      const data = JSON.parse(msg.toString());
      // Ignore messages sent by this exact app instance
      if (data.sender === INSTANCE_ID) return;

      const { action, payload } = data;

      switch (action) {
        case "INSERT":
          notesStore.set(payload.id, payload);
          syncData();
          createNote(
            payload.id,
            payload.content,
            payload.x_pos,
            payload.y_pos,
            payload.colour,
            payload.type,
            payload.canvas_json,
          );
          break;

        case "DELETE":
          notesStore.delete(payload.id);
          syncData();
          const winToDelete = activeWindows.get(payload.id);
          if (winToDelete) winToDelete.close();
          break;

        case "CLEAR":
          // delete every note
          notesStore.clear();
          syncData();
          const allWindows = BrowserWindow.getAllWindows();
          allWindows.forEach((win) => {
            if (typeof mainWindow !== "undefined" && win !== mainWindow) {
              win.close();
            }
          });
          break;

        case "UPDATE":
          const existingNote = notesStore.get(payload.id) || {};
          const updatedNote = { ...existingNote, ...payload };
          notesStore.set(payload.id, updatedNote);
          syncData();

          const winToUpdate = activeWindows.get(payload.id);
          if (winToUpdate) {
            if (
              payload.content !== undefined ||
              payload.colour !== undefined ||
              payload.canvas_json !== undefined
            ) {
              winToUpdate.webContents.send("load-note-content", updatedNote);
            }
            if (payload.x_pos !== undefined && payload.y_pos !== undefined) {
              winToUpdate.setPosition(payload.x_pos, payload.y_pos);
              winToUpdate.setSize(250, 250);
            }
          }
          break;

        case "SYNC_REQUEST":
          // Another peer ran 'grab' or just booted up; send them all our active notes
          notesStore.forEach((note) => {
            broadcastUDP("INSERT", note);
          });
          break;
      }
    } catch (err) {
      console.error("Failed to parse incoming UDP message:", err);
    }
  });

  udpSocket.bind(UDP_PORT, () => {
    udpSocket.addMembership(MULTICAST_ADDR);
    console.log(`Listening for notes on UDP ${MULTICAST_ADDR}:${UDP_PORT}`);
    // Ask peers on the network for any existing notes on startup
    broadcastUDP("SYNC_REQUEST", {});
  });
}

function syncData() {
  const jsonIn = JSON.stringify(Object.fromEntries(notesStore), null, 2);
  // Write to a file
  fs.writeFileSync("data.json", jsonIn, "utf8");
}
function pullData() {
  const jsonOut = fs.readFileSync("data.json", "utf8");
  notesStore = new Map(Object.entries(JSON.parse(jsonOut)));
  notesStore.forEach((row) => {
    createNote(row.id, row.content, row.x_pos, row.y_pos, row.colour, row.type, row.canvas_json);
  });
}

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
    resizable: false,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  mainWindow.loadFile("index.html");
  mainWindow.once("ready-to-show", () => {
    mainWindow.show();
    mainWindow.setIgnoreMouseEvents(true, { forward: true });
  });
}

ipcMain.on("disable-click-through", () => {
  mainWindow.setIgnoreMouseEvents(false);
});

ipcMain.on("enable-click-through", () => {
  mainWindow.setIgnoreMouseEvents(true, { forward: true });
});

ipcMain.on("close-terminal", () => {
  if (process.platform !== "darwin") app.quit();
});

function createNote(id, content, x, y, colour, type, canvas_json) {
  if (activeWindows.has(id)) return;

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
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  win.loadFile("note.html");
  activeWindows.set(id, win);
  win.setAlwaysOnTop(true, "screen-saver");

  win.webContents.on("did-finish-load", () => {
    win.webContents.send("load-note-content", {
      id,
      content,
      colour,
      type,
      canvas_json,
    });
  });

  win.on("move", () => {
    const [x_pos, y_pos] = win.getPosition();
    const note = notesStore.get(id);
    if (note) {
      note.x_pos = x_pos;
      note.y_pos = y_pos;
      notesStore.set(id, note);
      syncData();
    }
    broadcastUDP("UPDATE", { id, x_pos, y_pos });
  });

  win.on("resize", () => {
    win.setContentSize(250, 250);
  });

  win.on("closed", () => {
    activeWindows.delete(id);
  });
}

// Helper to spawn a note locally AND broadcast it to UDP peers
function spawnAndBroadcastNote(data) {
  const newNote = {
    id: crypto.randomUUID(),
    content: data.content,
    x_pos: Math.floor(Math.random() * 500) + 100,
    y_pos: Math.floor(Math.random() * 500) + 100,
    colour: data.colour,
    type: data.type,
    canvas_json: null,
  };

  notesStore.set(newNote.id, newNote);
  syncData();
  createNote(
    newNote.id,
    newNote.content,
    newNote.x_pos,
    newNote.y_pos,
    newNote.colour,
    newNote.type,
    newNote.canvas_json,
  );
  broadcastUDP("INSERT", newNote);
  return newNote;
}

// Bridge note UI requests to local state + UDP broadcast
ipcMain.handle("create-new-note", async (_, data) => {
  spawnAndBroadcastNote(data);
});

ipcMain.handle("close-and-delete-note", async (_, id) => {
  notesStore.delete(id);
  syncData();
  const win = activeWindows.get(id);
  if (win) win.close();
  broadcastUDP("DELETE", { id });
});

ipcMain.handle("update-note-content", async (event, data) => {
  try {
    const updateData = { id: data.id, colour: data.colour };
    switch (data.type) {
      case 1:
        updateData.content = data.content;
        break;
      case 2:
        updateData.canvas_json = data.canvas_json;
        break;
      default:
        throw new Error(`Invalid data type: ${data.type}`);
    }

    const existing = notesStore.get(data.id) || {};
    notesStore.set(data.id, { ...existing, ...updateData });
    syncData();

    broadcastUDP("UPDATE", updateData);
    return { success: true };
  } catch (err) {
    console.error("Failed to update note:", err);
    return { success: false, error: err.message };
  }
});

app.whenReady().then(() => {
  pullData();
  initUDP();
  createWindow();

  ipcMain.on("execute-custom-command", async (event, command) => {
    console.log(`Command received: ${JSON.stringify(command)}`);
    const baseCommand = command.command;
    if (!baseCommand || baseCommand.length === 0) return;

    try {
      switch (baseCommand) {
        case "help":
          console.log("add help command here");
          break;

        case "create": {
          const note = spawnAndBroadcastNote({
            content: command.text,
            colour: command.colour,
            type: parseInt(command.type, 10),
          });
          console.log("Note created successfully:", note);
          event.reply("execute-custom-command-success", "Note created successfully.");
          break;
        }

        case "grab": {
          // Re-open any locally stored notes and request missing notes from peers
          notesStore.forEach((row) => {
            createNote(
              row.id,
              row.content,
              row.x_pos,
              row.y_pos,
              row.colour,
              row.type,
              row.canvas_json,
            );
          });
          broadcastUDP("SYNC_REQUEST", {});
          event.reply("execute-custom-command-success", "Requested latest notes via UDP.");
          break;
        }
        case "hide": {
          const allWindows = BrowserWindow.getAllWindows();
          allWindows.forEach((win) => {
            if (typeof mainWindow !== "undefined" && win !== mainWindow) {
              win.close();
            }
          });
          event.reply("execute-custom-command-success", "Hidden non-main windows.");
          break;
        }
        case "clear": {
          // delete every note
          notesStore.clear();
          syncData();
          const allWindows = BrowserWindow.getAllWindows();
          allWindows.forEach((win) => {
            if (typeof mainWindow !== "undefined" && win !== mainWindow) {
              win.close();
            }
          });
          broadcastUDP("CLEAR", {});
          event.reply("execute-custom-command-success", "Destroyed all notes.");
          break;
        }

        default: {
          console.log(`Unknown command: ${baseCommand}`);
          event.reply("execute-custom-command-error", `Unknown command: ${baseCommand}`);
          break;
        }
      }
    } catch (error) {
      console.error("An error occurred inside the ipcMain handler:", error);
      event.reply("execute-custom-command-error", error.message);
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    udpSocket.close();
    app.quit();
  }
});

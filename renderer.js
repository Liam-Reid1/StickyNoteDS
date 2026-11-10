const container = document.getElementById('app-container');
const openBtn = document.getElementById('openBtn');
const closeBtn = document.getElementById('closeBtn');
const minimizeBtn = document.getElementById('minimizeBtn');
const terminal = document.getElementById('terminal');

const availableCommands = ['help', 'create', 'grab', 'hide'];


var term = new Terminal({
  cursorBlink: true,
  rows: 13,
  theme: { background: '#1e1e1e' }
});

term.open(terminal);
const fitAddon = new FitAddon.FitAddon();
term.loadAddon(fitAddon);
fitAddon.fit();
window.addEventListener('resize', () => {
  fitAddon.fit();
});
const prompt = '> '; 
term.write(prompt);
let commandBuffer = '';

container.addEventListener('mouseenter', () => {
  window.electronAPI.disableClickThrough();
});

container.addEventListener('mouseleave', () => {
  // Only restore click-through if it's not expanded yet
  if (!container.classList.contains('expanded')) {
    window.electronAPI.enableClickThrough();
  }
});

// Trigger the growth animation smoothly using CSS
openBtn.addEventListener('click', () => {
  window.electronAPI.disableClickThrough();// lock mouse focus permanently now
  container.classList.add('expanded');
  setTimeout(() => { 
    document.getElementById('terminalContainer').style.display = 'block';
    setTimeout(() => {
      fitAddon.fit();
    }, 50);
  }, 300); 
});
minimizeBtn.addEventListener('click', () => {
  container.classList.remove('expanded');
  document.getElementById('terminalContainer').style.display = 'none';
});
closeBtn.addEventListener('click', () => {
  window.electronAPI.onCloseTerminal();
});

term.onData(e => {
  switch (e) {
    case '\r': // enter key
      term.write('\r\n');
      if (commandBuffer.trim().length > 0) {
        // Send the command string to the main process via the preload bridge
        window.electronAPI.sendTerminalCommand(commandBuffer.trim());
      }
      commandBuffer = ''; // reset buffer
      term.write(prompt);
      break;

    case '\u007F': // backspace
      if (commandBuffer.length > 0) {
        commandBuffer = commandBuffer.slice(0, -1);
        term.write('\b \b');
      }
      break;

    case '\t': // tab completion
      completeCommand();
      break;

    default: // Printable characters
      if (e >= String.fromCharCode(32) && e <= String.fromCharCode(126)) {
        commandBuffer += e;
        term.write(e);
      }
      break;
  }
});

function completeCommand() {
  // Look through possible commands
  const match = availableCommands.find((cmd) => cmd.startsWith(commandBuffer));
  
  if (match && match !== commandBuffer) {
    const remainder = match.slice(commandBuffer.length);
    commandBuffer = match; // Update buffer
    term.write(remainder); // Complete the command
  }
}

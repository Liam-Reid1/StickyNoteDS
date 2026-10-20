var term = new Terminal({
    cursorBlink: true,
    rows: 32,
    theme: { background: '#1e1e1e' }
});
term.open(document.getElementById("terminal"));
const prompt = 'custom-shell> '; // not appearing first?
let commandBuffer = '';

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
      
    default: // Printable characters
      if (e >= String.fromCharCode(32) && e <= String.fromCharCode(126)) {
        commandBuffer += e;
        term.write(e);
      }
      break;
  }
});
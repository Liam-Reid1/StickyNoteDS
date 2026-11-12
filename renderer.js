const container = document.getElementById('app-container');
const openBtn = document.getElementById('openBtn');
const closeBtn = document.getElementById('closeBtn');
const minimizeBtn = document.getElementById('minimizeBtn');

const commandTerminal = document.getElementById('commandTerminal');
const colourTerminal = document.getElementById('colourTerminal');
const textTerminal = document.getElementById('textTerminal');

const radioButtons = document.querySelectorAll('input[name="choice"]');
const typeContainer = document.getElementById('typeContainer');

const availableCommands = ['create', 'grab', 'hide', 'help'];
const availableColours = ['red', 'orange', 'yellow', 'green', 'cyan', 'blue', 'purple', 'pink', 'white'];

const translucentWhite = '\x1b[38;2;128;128;128m';
const resetColor = '\x1b[0m';

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
      commandTerm.focus();
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

// Helper function to create, open, and fit any xterm.js terminal
const defaultCommand = { command: '', type: '1', colour: 'yellow', text: 'New note' };
let fullCommand = { ...defaultCommand };

function createTerminal(containerElement, config = {}) {
  const {
    prompt = '> ',
    maxLength = 16,
    suggestions = [],
    onInput = () => {},
    onEnter = () => {},
    onUp = () => {},
    onDown = () => {}
  } = config;

  const defaultOptions = { cursorBlink: true, rows: 10, theme: { background: '#1e1e1e' } };
  const term = new Terminal(defaultOptions);
  const fitAddon = new FitAddon.FitAddon();

  term.open(containerElement);
  term.loadAddon(fitAddon);
  fitAddon.fit();

  window.addEventListener('resize', () => {
    fitAddon.fit();
  });

  let buffer = '';
  let cursor = 0;
  let currentPreviewLength = 0;

  term.write(prompt);

  function clearPreview() {
    if (currentPreviewLength > 0) {
      term.write(' '.repeat(currentPreviewLength) + '\b'.repeat(currentPreviewLength));
      currentPreviewLength = 0;
    }
  }

  function suggest() {
    if (buffer.length === 0 || suggestions.length === 0) return;
    const match = suggestions.find((item) => item.startsWith(buffer));
    if (match && match !== buffer) {
      const remainder = match.slice(buffer.length);
      currentPreviewLength = remainder.length;
      term.write(`${translucentWhite}${remainder}${resetColor}`);
      term.write('\b'.repeat(currentPreviewLength));
    }
  }

  function complete() {
    if (buffer.length === 0 || suggestions.length === 0) return;
    const match = suggestions.find((item) => item.startsWith(buffer));
    if (match && match !== buffer) {
      clearPreview();
      const remainder = match.slice(buffer.length);
      buffer = match;
      cursor = buffer.length;
      term.write(remainder);
      onInput(buffer);
    }
  }

  function reset() {
    clearPreview();
    buffer = '';
    cursor = 0;
    term.clear();
    term.write('\r\x1b[K' + prompt);
  }

  term.onData(e => {
    switch (e) {
      case '\r': // Enter key
        clearPreview();
        onInput(buffer);
        onEnter();
        break;

      case '\u007F': // Backspace
        if (cursor > 0) {
          clearPreview();
          // Remove the character right before the cursor
          buffer = buffer.slice(0, cursor - 1) + buffer.slice(cursor);
          cursor--;
          // Move terminal cursor left, redraw the rest of the line + trailing space, then move back
          const tail = buffer.slice(cursor);
          term.write('\b' + tail + ' ' + '\x1b[D'.repeat(tail.length + 1));
          suggest();
          onInput(buffer);
        }
        break;

      case '\t': // Tab
        complete();
        onDown();
        break;

      case '\x1b[A': // Up Arrow
        onUp();
        break;

      case '\x1b[B': // Down Arrow
        onDown();
        break;
      case '\x1b[C': // Right Arrow
        if (cursor < buffer.length) {
          cursor++;
          term.write('\x1b[C');
        }
        break;

      case '\x1b[D': // Left Arrow
        if (cursor > 0) {
          cursor--;
          term.write('\x1b[D');
        }
        break;
      case '\x1b': // Esc
        container.classList.remove('expanded'); // mimimize terminal
        document.getElementById('terminalContainer').style.display = 'none';
        break;

      default: // Printable characters
        if (e >= String.fromCharCode(32) && e <= String.fromCharCode(126)) {
          if (buffer.length >= maxLength) break;
          clearPreview();

          // Insert character at the current cursor position
          buffer = buffer.slice(0, cursor) + e + buffer.slice(cursor);
          
          // Write the new character + everything after it, then move cursor back to position
          const tail = buffer.slice(cursor + 1);
          term.write(e + tail + '\x1b[D'.repeat(tail.length));
          cursor++;

          suggest();
          onInput(buffer);
        }
        break;
    }
  });

  return { term, fitAddon, getBuffer: () => buffer, reset };
}

function moveFocus(currentTerm, direction) {
  const terminals = [
    { term: commandTerm, container: commandTerminal },
    { term: colourTerm, container: colourTerminal },
    { term: textTerm, container: textTerminal }
  ];

  const visibleTerminals = terminals.filter((item, index) => 
    index === 0 || item.container.classList.contains('visible')
  );

  const currentIndex = visibleTerminals.findIndex(item => item.term === currentTerm);
  if (currentIndex === -1) return;

  const nextIndex = currentIndex + direction;
  if (nextIndex >= 0 && nextIndex < visibleTerminals.length) {
    visibleTerminals[nextIndex].term.focus();
  }
}

function handleGlobalEnter() {
  window.electronAPI.sendTerminalCommand({ ...fullCommand });

  commandTerminalInstance.reset();
  colourTerminalInstance.reset();
  textTerminalInstance.reset();

  fullCommand = { ...defaultCommand };
  if (radioButtons.length > 0) {
    radioButtons[0].checked = true;
  }

  checkCommand('');
  commandTerminalInstance.term.focus();
}

const commandTerminalInstance = createTerminal(
  document.getElementById('commandTerminal'),
  {
    prompt: '> ',
    maxLength: 16,
    suggestions: availableCommands,
    onInput: (val) => {
      fullCommand.command = val;
      checkCommand(val);
    },
    onEnter: handleGlobalEnter,
    onUp: () => moveFocus(commandTerm, -1),
    onDown: () => moveFocus(commandTerm, 1)
  }
);
const { term: commandTerm, getBuffer: getCommandBuffer } = commandTerminalInstance;

const colourTerminalInstance = createTerminal(
  document.getElementById('colourTerminal'),
  {
    prompt: 'colour? ',
    maxLength: 11,
    suggestions: availableColours,
    onInput: (val) => {
      fullCommand.colour = val || 'yellow';
    },
    onEnter: handleGlobalEnter,
    onUp: () => moveFocus(colourTerm, -1),
    onDown: () => moveFocus(colourTerm, 1)
  }
);

const textTerminalInstance = createTerminal(
  document.getElementById('textTerminal'),
  {
    prompt: 'text? ',
    maxLength: 113,
    onInput: (val) => {
      fullCommand.text = val || 'New note';
    },
    onEnter: handleGlobalEnter,
    onUp: () => moveFocus(textTerm, -1),
    onDown: () => moveFocus(textTerm, 1)
  }
);

// 1. Extract fitAddon alongside term and getBuffer
const { 
    term: colourTerm, 
    fitAddon: colourFitAddon
} = colourTerminalInstance;

const { 
    term: textTerm, 
    fitAddon: textFitAddon
} = textTerminalInstance;

function checkCommand(currentCommand = getCommandBuffer()) {
    if (currentCommand.trim() === "create") {
        typeContainer.classList.add('visible');
        
        colourTerminal.classList.add('visible');
        colourFitAddon.fit();

        if (fullCommand.type === '1') {
            textTerminal.classList.add('visible');
            textFitAddon.fit();
        } else {
            textTerminal.classList.remove('visible');
        }
    } else {
        typeContainer.classList.remove('visible');
        colourTerminal.classList.remove('visible');
        textTerminal.classList.remove('visible');
    }
}

radioButtons.forEach(radio => {
  radio.addEventListener('click', (event) => {
    fullCommand.type = event.target.value;
    colourTerm.focus();
    checkCommand();
  });
});
let currentNoteId = null;
let clickTimer = null;
const DELAY = 250;
let colour = "yellow";

const colourButtons = document.querySelectorAll('.colour-btn');
const addColour = document.querySelectorAll('.add-colour');
const paintColour = document.querySelectorAll('.paint-colour');
const textColour = document.querySelectorAll('.text-colour')
const overlay = document.getElementById('overlayWindow');

window.electronAPI.onLoadContent((data) => {
  currentNoteId = data.id;
  document.getElementById('noteArea').value = data.content;
  colour = data.colour;
  document.documentElement.className = "";
  document.documentElement.classList.add(colour);
});

document.getElementById('closeBtn').addEventListener('click', () => {
  if (currentNoteId) window.electronAPI.onDeleteNote(currentNoteId);
});

document.getElementById('noteArea').addEventListener('change', () => {
  const val = document.getElementById('noteArea').value;
  if (currentNoteId) window.electronAPI.onUpdateContent({id: currentNoteId, content: val, colour: colour});
});

// Current Note Functions

document.getElementById('addBtn').addEventListener('click', (e) => { // fix this to be variable depending on the base note
  if (clickTimer !== null) { // double click
      clearTimeout(clickTimer);
      clickTimer = null;
      revealColourButtons(addColour);
  } else {
      // Start a timer for a single click
      clickTimer = setTimeout(() => {
          clickTimer = null;
          createTextNote(); // single click
      }, DELAY);
  }
});

addColour.forEach(button => { // fix this to be variable depending on the base note
  button.addEventListener('click', (e) => {
    createTextNote(e.target.id);
  });
});

// Text Note Functions

document.getElementById('textBtn').addEventListener('click', (e) => {
  // If the timer is active, this is the second click of a double click
  if (clickTimer !== null) {
      clearTimeout(clickTimer);
      clickTimer = null;
      revealColourButtons(textColour);
  } else {
      // Start a timer for a single click
      clickTimer = setTimeout(() => {
          clickTimer = null;
          createTextNote();
      }, DELAY);
  }
});

textColour.forEach(button => { // creates text note with defined colour
  button.addEventListener('click', (e) => {
    createTextNote(e.target.id);
  });
});

function createTextNote(newColour = colour) { // use base colour if none given
  const val = document.getElementById('noteArea').value;
  window.electronAPI.onCreateNote({content: val || "Empty note", colour: newColour});
  hideColourButtons();
  closeOverlay();
}

// Paint Button Functions

document.getElementById('paintBtn').addEventListener('click', (e) => {
  revealColourButtons(paintColour);
});

paintColour.forEach(button => { // creates text note with defined colour
  button.addEventListener('click', (e) => {
    updateNoteColour(e.target.id);
    closeOverlay();
  });
});

function updateNoteColour(newColour) {
  const val = document.getElementById('noteArea').value;
  if (currentNoteId) window.electronAPI.onUpdateContent({id: currentNoteId, content: val, colour: newColour});
  closeOverlay();
}

// Overlay Functions

document.getElementById('optionBtn').addEventListener('click', (e) => {
  if (overlay.classList.contains('show')) {
    closeOverlay();
  }
  else {
    hideColourButtons();
    overlay.classList.add('show');
    document.getElementById('optionBtn').classList.add('animate');
    overlay.style.animation = "fadeIn 0.3s ease forwards"; 
    setTimeout(() => { 
      document.getElementById('optionBtn').classList.remove('animate');
    }, 300); 
  }
});

function closeOverlay() {
  overlay.style.animation = "fadeOut 0.3s ease forwards"; 
  document.getElementById('optionBtn').classList.add('animate');
    setTimeout(() => { 
      overlay.classList.remove('show'); 
      document.getElementById('optionBtn').classList.remove('animate');
    }, 300); 
}
// Colour Button Functions

function revealColourButtons(buttonClass) { // reveals only the selected buttons
    buttonClass.forEach((button) => {
      if (button.classList.contains('show')) {
        hideColourButtons(buttonClass);
      } else {
        button.classList.add('show');
        button.style.animation = "popIn 0.15s ease forwards"; 
      }
    });
}

function hideColourButtons(buttonClass = colourButtons) { // hides everything if none given
  buttonClass.forEach((button) => {
    button.style.animation = "popOut 0.15s ease forwards"; 
    setTimeout(() => { 
      button.classList.remove('show'); 
    }, 150); 
  });
}

let currentNoteId = null;
let clickTimer = null;
const DELAY = 250;

const colourButtons = document.querySelectorAll('.add-colour');
const overlay = document.getElementById('overlayWindow');

window.electronAPI.onLoadContent((data) => {
  currentNoteId = data.id;
  document.getElementById('noteArea').value = data.content;
  document.documentElement.classList.add(data.colour);
});

colourButtons.forEach(button => {
  button.addEventListener('click', (e) => {
    const val = document.getElementById('noteArea').value;
    const colour = e.target.id;
    window.electronAPI.onCreateNote({content: val || "Empty note", colour: colour});
    hideButtons();
  });
});

document.getElementById('addBtn').addEventListener('click', (e) => {
  // If the timer is active, this is the second click of a double click
  if (clickTimer !== null) {
      clearTimeout(clickTimer);
      clickTimer = null;
      handleDoubleClick(e);
  } else {
      // Start a timer for a single click
      clickTimer = setTimeout(() => {
          clickTimer = null;
          handleSingleClick(e);
      }, DELAY);
  }
});

function handleSingleClick(e) {
  const val = document.getElementById('noteArea').value;
  window.electronAPI.onCreateNote({content: val || "Empty note", colour: "yellow"});
  hideButtons();
}

function handleDoubleClick(e) {
    colourButtons.forEach((button) => {
      if (button.classList.contains('show')) {
        hideButtons();
      } else {
        button.classList.add('show');
        button.style.animation = "popIn 0.15s ease forwards"; 
      }
    });
    overlay.classList.add('show');
    overlay.style.animation = "fadeIn 0.3s ease forwards"; 

}

function hideButtons() {
  colourButtons.forEach((button) => {
    button.style.animation = "popOut 0.15s ease forwards"; 
    setTimeout(() => { 
      button.classList.remove('show'); 
      button.style.animation = "none"
    }, 150); 
  });
}



document.getElementById('closeBtn').addEventListener('click', () => {
  if (currentNoteId) window.electronAPI.onDeleteNote(currentNoteId);
});

document.getElementById('noteArea').addEventListener('change', () => {
  const val = document.getElementById('noteArea').value;
  if (currentNoteId) window.electronAPI.onUpdateContent({id: currentNoteId, content: val});
});
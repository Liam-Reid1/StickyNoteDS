const canvas = new fabric.Canvas('drawCanvas');

canvas.isDrawingMode = true;
canvas.freeDrawingBrush.width = 3;
canvas.freeDrawingBrush.color = '#000000';
canvas.freeDrawingBrush.strokeLineCap = 'round';

let allStrokes = [];
let canvasJsonData;

canvas.on('path:created', (e) => {
    const path = e.path;
    
    const currentStroke = path.path.map(point => {
        return { 
            x: point[point.length - 2], 
            y: point[point.length - 1] 
        };
    });

    allStrokes.push(currentStroke);
    
    // send update now
    canvasJsonData = canvas.toJSON(); 
    if (currentNoteId) window.electronAPI.onUpdateContent({id: currentNoteId, colour: colour, type: 2, canvas_json: canvasJsonData});
});


document.getElementById('clearBtn').addEventListener('click', () => {
    canvas.clear();
    allStrokes = [];
    canvasJsonData = canvas.toJSON(); 
    if (currentNoteId) window.electronAPI.onUpdateContent({id: currentNoteId, colour: colour, type: 2, canvas_json: canvasJsonData});
});
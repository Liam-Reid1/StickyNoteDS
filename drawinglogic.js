const canvas = new fabric.Canvas('drawCanvas');

canvas.isDrawingMode = true;
canvas.freeDrawingBrush.width = 3;
canvas.freeDrawingBrush.color = '#000000';
canvas.freeDrawingBrush.strokeLineCap = 'round';

let allStrokes = [];

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
    const canvasJsonData = canvas.toJSON(); 
    console.log(canvasJsonData);
});

document.getElementById('clearBtn').addEventListener('click', () => {
    canvas.clear();
    allStrokes = [];
});

// ------------------ Renderer ------------------
const stage = $("#stage");
const gPaths = $("#paths");
const gTool = $("#toolLayer");
const gGrid = $("#grid");
function clear() {
    gPaths.innerHTML = "";
    gTool.innerHTML = "";
}
function drawGrid() {
    gGrid.innerHTML = "";
    const w = 200,
        h = 200;
    const step = 5;
    for (let x = -100; x <= 100; x += step) {
        const l = createEl("line", {
            x1: x,
            y1: -100,
            x2: x,
            y2: 100,
            stroke: "#071b25",
            "stroke-width": 0.1,
        });
        gGrid.appendChild(l);
    }
    for (let z = -100; z <= 100; z += step) {
        const l = createEl("line", {
            x1: -100,
            y1: -z,
            x2: 100,
            y2: -z,
            stroke: "#071b25",
            "stroke-width": 0.1,
        });
        gGrid.appendChild(l);
    }
}

function renderSegments(model, opts) {
    clear();
    drawGrid();
    const showRapid = $("#chk-show-rapid").checked;
    const isDiameter = $("#chk-diam").checked;
    // find bounds
    let minX = Infinity,
        maxX = -Infinity,
        minZ = Infinity,
        maxZ = -Infinity;
    for (const s of model.segments) {
        minX = Math.min(minX, s.x1, s.x2);
        maxX = Math.max(maxX, s.x1, s.x2);
        minZ = Math.min(minZ, s.z1, s.z2);
        maxZ = Math.max(maxZ, s.z1, s.z2);
    }
    if (!isFinite(minX)) {
        minX = -10;
        maxX = 10;
        minZ = -10;
        maxZ = 10;
    }
    // if X is diameter, convert to radius for drawing
    const xs = (v) => (isDiameter ? v / 2 : v);
    // draw segments
    for (const s of model.segments) {
        if (s.rapid && !showRapid) continue;
        const line = createEl("line", {
            x1: xs(s.x1),
            y1: -s.z1,
            x2: xs(s.x2),
            y2: -s.z2,
            "stroke-width": s.rapid ? 0.1 : 0.2,
            stroke: s.rapid ? "#9aa6b2" : "#58a6ff",
            "stroke-linecap": "round",
        });
        if (s.rapid) line.setAttribute("stroke-dasharray", "3 5");
        gPaths.appendChild(line);
    }
    // dessiner l'axe de la pièce et l'initiale de l'outil
    const axis = createEl("line", {
        x1: -100,
        y1: 0,
        x2: 200,
        y2: 0,
        stroke: "#820000ff",
        "stroke-width": 0.2,
    });
    gPaths.appendChild(axis);
    const tool = createEl("g", {});
    const tg = createEl("circle", {
        cx: xs(0),
        cy: 0,
        r: 0.8,
        fill: "#f6bd3b",
    });
    tool.appendChild(tg);
    const tip = createEl("rect", {
        x: xs(0) - 0.2,
        y: -0.4,
        width: 0.6,
        height: 0.8,
        fill: "#f6bd3b",
        transform: `rotate(0 ${xs(0)} 0)`,
    });
    tool.appendChild(tip);
    gTool.appendChild(tool);
    // store for animation
    window.__sim = { model, toolEl: tool, isDiameter: isDiameter };
}

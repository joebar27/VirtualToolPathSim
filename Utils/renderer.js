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
    // recupérer les dimensions du svg
    const w = 200, h = 200;
    const step = 5;

    // lignes verticales
    for (let x = step; x <= h; x += step) {
        const l = createEl("line", {
            x1: x,
            y1: 0,
            x2: x,
            y2: w,
            stroke: "#393737ff",
            "stroke-width": 0.1,
        });
        gGrid.appendChild(l);
    }
    // lignes horizontales
    for (let z = step; z <= w; z += step) {
        const l = createEl("line", {
            x1: 0,
            y1: z,
            x2: h,
            y2: z,
            stroke: "#393737ff",
            "stroke-width": 0.1,
        });
        gGrid.appendChild(l);
    }
    // materialisation des axes X et Z
    const axeX = createEl("line", {
            x1: 0,
            y1: 0,
            x2: 0,
            y2: h,
            stroke: "#f50606ff",
            "stroke-width": 0.2,
        });
        gGrid.appendChild(axeX);

    const axeZ = createEl("line", {
            x1: 0,
            y1: h/2,
            x2: w,
            y2: h/2,
            stroke: "#f50606ff",
            "stroke-width": 0.2,
        });
        gGrid.appendChild(axeZ);
}

function renderSegments(model, opts) {
    clear();
    drawGrid();
    const showRapid = $("#chk-show-rapid").checked;
    const isDiameter = $("#chk-diam").checked;
    // determine bounds
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
    // Si X est en diametre, convertir vers radius pour le cadrage
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

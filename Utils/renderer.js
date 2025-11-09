// ------------------ Renderer ------------------
const stage = $("#stage");
const gPaths = $("#paths");
const gTool = $("#toolLayer");
const gGrid = $("#grid");

function clear() {
    gPaths.innerHTML = "";
    gTool.innerHTML = "";
    gGrid.innerHTML = "";
}

function drawGrid(w, h, step) {
    gGrid.innerHTML = "";
    // Création des lignes verticales
    for (let x = step; x <= w; x += step) {
        const l = createEl("line", {
            x1: x,
            y1: 0,
            x2: x,
            y2: h,
            stroke: "#393737ff",
            "stroke-width": $("#zoom-piece").checked ? 0.05 : 0.1,
        });
        gGrid.appendChild(l);
    }
    // Création des lignes horizontales
    for (let z = step; z <= h; z += step) {
        const l = createEl("line", {
            x1: 0,
            y1: z,
            x2: w,
            y2: z,
            stroke: "#393737ff",
            "stroke-width": $("#zoom-piece").checked ? 0.05 : 0.1,
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
        "stroke-width":  $("#zoom-piece").checked ? 0.05 : 0.2,
    });
    const axeZ = createEl("line", {
        x1: 0,
        y1: h / 2,
        x2: w,
        y2: h / 2,
        stroke: "#f50606ff",
        "stroke-dasharray": "5 3",
        "stroke-width":  $("#zoom-piece").checked ? 0.05 : 0.2,
    });
    gGrid.append(axeZ, axeX);
}

function drawBrut(brutDiameter, g54Value, pMinZ, pMaxZ) {
    const h = stage.getAttribute("height");
    const isDia = $("#chk-diam").checked;
    const xs = (v) => (isDia ? v / 2 : v);
    
    const brut = createEl("rect", {
        x: 0,
        y: (h - xs(brutDiameter) * 2) / 2,
        width: g54Value - (-pMinZ),
        height: xs(brutDiameter),
        fill: "rgba(54, 75, 110, 0.8)",
        stroke: "rgba(200,0,0,0.4)",
        "stroke-width": $("#zoom-piece").checked ? 0.1 : 0.2,
    });
    gGrid.appendChild(brut);
}

function renderSegments(model, opts) {
    const showRapid = $("#chk-show-rapid").checked;
    const isDiameter = $("#chk-diam").checked;
    const g54Value = parseFloat(opts?.g54Value) || 0;

    // determine les limites max et min du model (toutes les trajectoires outils incluses)
    let minX = Infinity,
        maxX = -Infinity,
        minZ = Infinity,
        maxZ = -Infinity,
        pMinX = Infinity,
        pMaxX = -Infinity,
        pMinZ = Infinity,
        pMaxZ = -Infinity;
    for (const s of model.segments) {
        minX = Math.min(minX, s.x1, s.x2);
        maxX = Math.max(maxX, s.x1, s.x2);
        minZ = Math.min(minZ, s.z1, s.z2);
        maxZ = Math.max(maxZ, s.z1, s.z2);
    }
    for (const s of model.segments) {
        if (!s.rapid) {
            pMinX = Math.min(pMinX, s.x1, s.x2);
            pMaxX = Math.max(pMaxX, s.x1, s.x2);
            pMinZ = Math.min(pMinZ, s.z1, s.z2);
            pMaxZ = Math.max(pMaxZ, s.z1, s.z2);
        }
    }
    if (!isFinite(minX)) {
        minX = -10;
        maxX = 10;
        minZ = -10;
        maxZ = 10;
    }
    if (pMinZ + g54Value <= 0)
        return alert(
            "Erreur: La pièce dépasse de la zone d'usinage en Z !\n La valeur G54 minimale doit être supérieure à " +
                (-pMinZ + 0.5).toFixed(3) +
                " mm."
        );

    // Ajustement de la taille du svg en fonction des limites du model
    let zoomPiece = $("#zoom-piece");
    let viewG0 = $("#chk-show-rapid");
    // Initialisation des dimensions du svg et du pas de la grille
    let w, h, step;

    if (zoomPiece.checked) {
        console.log("Zoom sur la pièce");
        w = pMaxZ - pMinZ + 5;
        if (w < g54Value + 1) w = g54Value + 5;
        // if (pMinZ + g54Value <= 0) return alert("Erreur: La pièce dépasse de la zone d'usinage en Z !\n La valeur G54 minimale doit être supérieure à " + (-pMinZ + 0.5).toFixed(3) + " mm."));
        h = pMaxX - pMinX + 10;
        step = 0.5;
        stage.setAttribute("width", w);
        stage.setAttribute("height", h);
    } else if (viewG0.checked) {
        console.log("Vue complète");
        w = maxZ - minZ + 5;
        h = maxX - minX + 10;
        step = 2;
        stage.setAttribute("width", w);
        stage.setAttribute("height", h);
    }

    // Nettoyage des anciens dessins
    clear();
    // Dessiner la grille avec les nouvelles dimensions
    drawGrid(w, h, step);
    // Dessiner le rectangle du brut
    const brutDiameter = parseFloat($("#brutbox").value) || 0;
    // if (brutDiameter > 0) {
    //     if (brutDiameter < pMaxX)
    //         return alert("Erreur: Le diamètre brut est inférieur au diamètre maximal de la pièce !");
    drawBrut(brutDiameter, g54Value, pMinZ, pMaxZ);
    // }
    // Si X est en diametre, convertion pour le cadrage
    const xs = (v) => (isDiameter ? v / 2 : v);

    // Dessin des segments
    for (const s of model.segments) {
        if (s.rapid && !showRapid) continue;
        const line = createEl("line", {
            x1: s.z1 + g54Value,
            y1: xs(-s.x1) + h / 2,
            x2: s.z2 + g54Value,
            y2: xs(-s.x2) + h / 2,
            "stroke-width": s.rapid ? 0.1 : 0.2,
            stroke: s.rapid ? "#9aa6b2" : "#58a6ff",
            "stroke-linecap": "round",
        });
        if (s.rapid) line.setAttribute("stroke-dasharray", "5 3");
        if (zoomPiece.checked) line.setAttribute("stroke-width", 0.05);
        gPaths.appendChild(line);
    }

    // dessiner l'outil
    const tool = createEl("g", {});

    // outil butée
    const toolPound = createEl("ellipse", {
        cx: xs(0) + g54Value,
        cy: 0,
        rx: 0.5,
        ry: 2,
        fill: "#fc9222ff",
        stroke: "#662a00ff",
        "stroke-width": "0.2",
    });
    //! tool.appendChild(toolPound);

    // outil d'ébauche
    const toolRough = createEl("polygon", {
        points: "16,0 21,8 16,16 11,8",
        fill: "floralwhite",
        stroke: "brown",
        "stroke-width": "1",
        "stroke-linejoin": "round",
        transform: `translate(${
            xs(0) + g54Value
        }, ${50}) scale(0.4) rotate(45) translate(-16 -16)`,
    });
    // !tool.appendChild(toolRough);

    // outil de finition
    const toolFinish = createEl("polygon", {
        points: "16,0 19,8 16,16 13,8",
        fill: "floralwhite",
        stroke: "blue",
        "stroke-width": "0.8",
        "stroke-linejoin": "round",
        transform: `translate(${
            xs(0) + g54Value
        }, ${50}) scale(0.4) rotate(45) translate(-16 -16)`,
    });
    // !tool.appendChild(toolFinish);

    //// console.log("tool:", tool);
    //// const tip = createEl("rect", {
    ////     x: xs(0) - 0.2 + g54Value,
    ////     y: -0.4 + 100,
    ////     width: 0.6,
    ////     height: 0.8,
    ////     fill: "#f6bd3b",
    ////     transform: `rotate(0 ${xs(0)} 0)`,
    //// });
    //// tool.appendChild(tip);
    gTool.appendChild(tool);

    // Stockage des informations pour l'animation
    window.__sim = { model, toolEl: tool, isDiameter: isDiameter };

    // ajuster le viewbox pour ajuster le cadrage automatiquement
    const svg = document.getElementById("stage");
    // récupère les limites de la box du contenu
    const bbox = svg.getBBox();
    console.log("bbox:", bbox);
    // modifie les atribues du viewbox
    svg.setAttribute(
        "viewBox",
        `${bbox.x} ${bbox.y} ${bbox.width} ${bbox.height}`
    );
}

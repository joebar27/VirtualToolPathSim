// ------------------ Utils ------------------
const $ = (s) => document.querySelector(s);
const svgNS = "http://www.w3.org/2000/svg";
function createEl(tag, attrs = {}) {
    const e = document.createElementNS(svgNS, tag);
    for (const k in attrs) {
        e.setAttribute(k, attrs[k]);
    }
    return e;
}
function fmt(n, d = 3) {
    return Number.isFinite(n) ? n.toFixed(d) : "—";
}

// ------------------ G-code Parser (Fanuc, simplified) ------------------
function parseFanuc(text) {
    const lines = text
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter((l) => l && !l.startsWith("(") && !l.startsWith(";"));
    let absolute = true; // G90/G91 - assume absolute by default
    let unitScale = 1; // G21 mm, G20 inches
    let x = 0,
        z = 0,
        f = 0; // current position
    let stats = { lines: lines.length, segs: 0 };
    const segments = []; // {x1,z1,x2,z2,rapid:boolean, feed,meta}

    function parseParams(s) {
        const out = {};
        const re = /([A-Za-z])\s*(-?\d*\.?\d+)/g;
        let m;
        while ((m = re.exec(s))) {
            out[m[1].toUpperCase()] = parseFloat(m[2]);
        }
        return out;
    }

    for (const raw of lines) {
        // remove comments after ; or ()
        const line = raw.split(";")[0].trim();
        if (!line) continue;
        // extract words
        const words = line.match(/[A-Za-z][-+]?[0-9]*\.?[0-9]*/g) || [];
        // find G or M codes
        const gcodes = words
            .filter((w) => /^G\d+/i.test(w))
            .map((w) => w.toUpperCase());
        const mcodes = words
            .filter((w) => /^M\d+/i.test(w))
            .map((w) => w.toUpperCase());

        // handle modal commands quickly
        if (line.match(/G20/i)) {
            unitScale = 25.4;
        }
        if (line.match(/G21/i)) {
            unitScale = 1;
        }
        if (line.match(/G90/i)) {
            absolute = true;
        }
        if (line.match(/G91/i)) {
            absolute = false;
        }

        // if contains G00/G0/G01/G1/G02/G2/G03/G3 parse motion
        const motion = words.find((w) => /^G(0|00|1|01|2|02|3|03)$/i.test(w));
        if (motion) {
            const params = parseParams(line);
            const nx =
                params.X != null
                    ? absolute
                        ? params.X * unitScale
                        : x + params.X * unitScale
                    : x;
            const nz =
                params.Z != null
                    ? absolute
                        ? params.Z * unitScale
                        : z + params.Z * unitScale
                    : z;
            const nf = params.F != null ? params.F : f;
            const code = motion.toUpperCase().replace(/^G/, "");
            // G0 rapid, G1 linear, G2/G3 arc
            if (
                code === "0" ||
                code === "00" ||
                code === "1" ||
                code === "01"
            ) {
                segments.push({
                    x1: x,
                    z1: z,
                    x2: nx,
                    z2: nz,
                    rapid: code === "0" || code === "00",
                    feed: nf,
                    type: "line",
                });
                stats.segs++;
            } else if (
                code === "2" ||
                code === "02" ||
                code === "3" ||
                code === "03"
            ) {
                // arc: look for I (X center offset) and K (Z center offset) or R
                if (params.I != null || params.K != null) {
                    const i = (params.I || 0) * unitScale;
                    const k = (params.K || 0) * unitScale;
                    const cx = x + i;
                    const cz = z + k; // center
                    const arc = buildArcSegments(
                        x,
                        z,
                        nx,
                        nz,
                        cx,
                        cz,
                        code === "2" /*CW*/
                    );
                    for (const s of arc) {
                        s.rapid = false;
                        s.feed = nf;
                        s.type = "arc";
                        segments.push(s);
                        stats.segs++;
                    }
                } else if (params.R != null) {
                    const R = Math.abs(params.R * unitScale);
                    const arc = buildArcFromR(x, z, nx, nz, R, code === "2");
                    for (const s of arc) {
                        s.rapid = false;
                        s.feed = nf;
                        s.type = "arc";
                        segments.push(s);
                        stats.segs++;
                    }
                } else {
                    // fallback to straight line
                    segments.push({
                        x1: x,
                        z1: z,
                        x2: nx,
                        z2: nz,
                        rapid: false,
                        feed: nf,
                        type: "line",
                    });
                    stats.segs++;
                }
            }
            x = nx;
            z = nz;
            f = nf;
            continue;
        }

        // other commands ignored for now
    }

    return { segments, stats };
}

// ------------------ Arc helpers ------------------
function buildArcSegments(x1, z1, x2, z2, cx, cz, cw, segLength = 0.5) {
    // compute start and end angles
    const sx = x1 - cx;
    const sz = z1 - cz;
    const ex = x2 - cx;
    const ez = z2 - cz;
    const r = Math.hypot(sx, sz);
    if (r === 0) return [];
    let a1 = Math.atan2(sz, sx);
    let a2 = Math.atan2(ez, ex);
    // normalize depending on cw/ccw
    if (cw) {
        // clockwise decreases angle
        if (a2 > a1) a2 -= Math.PI * 2;
    } else {
        // ccw increases angle
        if (a2 < a1) a2 += Math.PI * 2;
    }
    const total = Math.abs(a2 - a1);
    const n = Math.max(1, Math.ceil((r * total) / segLength));
    const segs = [];
    for (let i = 1; i <= n; i++) {
        const t = i / n;
        const a = a1 + (a2 - a1) * t;
        const nx = cx + Math.cos(a) * r;
        const nz = cz + Math.sin(a) * r;
        const prev = i === 1 ? { x1: x1, z1: z1 } : segs[segs.length - 1];
        segs.push({
            x1: prev.x2 !== undefined ? prev.x2 : prev.x1 || x1,
            z1: prev.z2 !== undefined ? prev.z2 : prev.z1 || z1,
            x2: nx,
            z2: nz,
        });
        // write back to make chaining easy
        segs[segs.length - 1].x1 = i === 1 ? x1 : segs[segs.length - 2].x2;
        segs[segs.length - 1].z1 = i === 1 ? z1 : segs[segs.length - 2].z2;
    }
    return segs;
}

function buildArcFromR(x1, z1, x2, z2, R, cw) {
    // compute circle center from R (two possible centers). We'll pick the one matching cw.
    // Solve by geometry in 2D.
    const dx = x2 - x1;
    const dz = z2 - z1;
    const d2 = dx * dx + dz * dz;
    const d = Math.hypot(dx, dz);
    if (d === 0) return [];
    const h = Math.sqrt(Math.max(0, R * R - (d / 2) * (d / 2)));
    // midpoint
    const mx = (x1 + x2) / 2;
    const mz = (z1 + z2) / 2;
    // perpendicular unit vector
    const ux = -dz / d;
    const uz = dx / d;
    // two centers
    const c1x = mx + ux * h;
    const c1z = mz + uz * h;
    const c2x = mx - ux * h;
    const c2z = mz - uz * h;
    // choose based on cw: compute signed angle from start->center->end
    const choose = (centerX, centerZ) => {
        const a1 = Math.atan2(z1 - centerZ, x1 - centerX);
        const a2 = Math.atan2(z2 - centerZ, x2 - centerX);
        // compute delta going cw (negative) and ccw (positive)
        let delta = a2 - a1;
        if (delta > Math.PI) delta -= 2 * Math.PI;
        if (delta < -Math.PI) delta += 2 * Math.PI;
        return delta;
    };
    const d1 = choose(c1x, c1z);
    const d2val = choose(c2x, c2z);
    const center = (cw ? d1 < 0 : d1 > 0)
        ? { cx: c1x, cz: c1z }
        : { cx: c2x, cz: c2z };
    return buildArcSegments(x1, z1, x2, z2, center.cx, center.cz, cw);
}

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
            "stroke-width": s.rapid ? 0.3 : 0.8,
            stroke: s.rapid ? "#9aa6b2" : "#58a6ff",
            "stroke-linecap": "round",
        });
        if (s.rapid) line.setAttribute("stroke-dasharray", "3 5");
        gPaths.appendChild(line);
    }
    // draw workpiece axis & tool initial
    const axis = createEl("line", {
        x1: -100,
        y1: 0,
        x2: 100,
        y2: 0,
        stroke: "#213340",
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

// ------------------ Animation/Simulator ------------------
let runner = null;
let currentIndex = 0;
let position = { x: 0, z: 0 };
function placeTool(x, z) {
    const isDia = window.__sim?.isDiameter;
    const px = isDia ? x / 2 : x;
    const g = window.__sim.toolEl;
    if (!g) return;
    g.setAttribute("transform", `translate(${px} ${-z})`);
    $("#coord-x").textContent = "X: " + fmt(x, 3);
    $("#coord-z").textContent = "Z: " + fmt(z, 3);
}

function playSim() {
    if (!window.__sim) return;
    if (runner) return;
    const segs = window.__sim.model.segments;
    if (segs.length === 0) return;
    const speed = parseFloat($("#speed").value);
    runner = { start: performance.now(), speed };
    if (currentIndex >= segs.length) currentIndex = 0;
    stepLoop();
}
function pauseSim() {
    if (runner) {
        cancelAnimationFrame(runner.af);
        runner = null;
    }
}
function stepLoop() {
    if (!runner) return;
    const segs = window.__sim.model.segments;
    if (currentIndex >= segs.length) {
        runner = null;
        return;
    }
    const s = segs[currentIndex];
    const dur = 200 / runner.speed; // ms per segment (simple)
    const start = performance.now();
    const sx = s.x1,
        sz = s.z1,
        ex = s.x2,
        ez = s.z2;
    function tick() {
        const t = (performance.now() - start) / dur;
        if (t >= 1) {
            position = { x: ex, z: ez };
            placeTool(ex, ez);
            currentIndex++;
            if (runner) {
                runner.af = requestAnimationFrame(stepLoop);
            }
        } else {
            const ix = sx + (ex - sx) * t;
            const iz = sz + (ez - sz) * t;
            position = { x: ix, z: iz };
            placeTool(ix, iz);
            runner.af = requestAnimationFrame(tick);
        }
    }
    runner.af = requestAnimationFrame(tick);
}

function stepOnce() {
    if (!window.__sim) return;
    const segs = window.__sim.model.segments;
    if (currentIndex >= segs.length) currentIndex = 0;
    const s = segs[currentIndex];
    position = { x: s.x2, z: s.z2 };
    placeTool(s.x2, s.z2);
    currentIndex++;
}

// ------------------ UI wiring ------------------
$("#btn-run").addEventListener("click", () => {
    const text = $("#gcode").value.trim();
    if (!text) return alert("Collez le G-code Fanuc d'abord");
    const model = parseFanuc(text);
    $("#stat-lines").textContent = "Lignes: " + model.stats.lines;
    $("#stat-segs").textContent = "Segments: " + model.stats.segs;
    renderSegments(model);
    currentIndex = 0;
    placeTool(0, 0);
});
$("#play").addEventListener("click", () => {
    playSim();
});
$("#pause").addEventListener("click", () => {
    pauseSim();
});
$("#step").addEventListener("click", () => {
    pauseSim();
    stepOnce();
});
$("#chk-diam").addEventListener("change", () => {
    if (window.__sim) renderSegments(window.__sim.model);
});

// file load
$("#btn-load").addEventListener("click", async () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".nc,.txt,.ngc,.tap,.gcode";
    input.onchange = async (e) => {
        const f = e.target.files[0];
        if (!f) return;
        const t = await f.text();
        $("#gcode").value = t;
    };
    input.click();
});

// init demo
const demo = `O0000
G21
G90
G0 X100 Z0
G1 X80 Z-5 F0.2
G1 X60 Z-10
G2 X40 Z-10 I-10 K0
G1 X20 Z-10
G3 X40 Z-5 I10 K5
G1 X0 Z-0
M30`;
$("#gcode").value = demo;

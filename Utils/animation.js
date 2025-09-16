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

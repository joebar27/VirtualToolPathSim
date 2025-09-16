// ------------------ UI wiring ------------------
$("#btn-run").addEventListener("click", () => {
    const text = $("#gcode").value.trim();
    if (!text) return alert("Inserez un G-code d'abord");
    const model = parseGCode(text);
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
const demo = `O1234 (PROGRAM NAME) ;
G54 ; (origin piece)
G0 X100 Z0 ;
G1 X80 Z-5 F0.2 ;
G1 X60 Z-10 ;
G2 X40 Z-10 I-10 K0 ;
G1 X20 Z-10 ;
G3 X40 Z-5 I10 K5 ;
G1 X0 Z-0 ;
M30 ;`;
$("#gcode").value = demo;

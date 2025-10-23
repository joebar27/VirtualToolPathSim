console.log("Largeur: ", screen.width);
console.log("Hauteur: ", screen.height);

// Gestion des éléments UI
$("#btn-run").addEventListener("click", () => {
    const text = $("#gcode").value.trim();
    const g54Value = $("#g54box").value.trim();
    if (!text) return alert("Inserez un G-code d'abord");
    if (!g54Value) return alert("Inserez une valeur G54 valide d'abord");
    const model = parseGCode(text, g54Value);
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

// Changer le G-code via un fichier externe
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

// Verification si l'utilisateur a renseigné le G54
$("#g54box").addEventListener("input", () => {
    const inputG54 = document.getElementById("g54box");
    const labelG54 = document.querySelector(".g54warning");
    const valueG54 = inputG54.value.trim();
    // const regex = /^(?:[0-9]{1,2}|[1-4][0-9]{2}|500)\.[0-9]{3}$/;

    // if (regex.test(value)) {
    //   // ✅ Format valide
    //   const num = parseFloat(value);
    //   if (num >= 0 && num <= 500) {
    //     labelG54.textContent = "✅ Valeur G54 valide : " + value;
    //     labelG54.classList.remove("invalid");
    //     labelG54.classList.add("valid");
    //   } else {
    //     labelG54.textContent = "⚠️ Valeur hors limites (0 à 500)";
    //     labelG54.classList.remove("valid");
    //     labelG54.classList.add("invalid");
    //   }
    // } else if (value === "") {
    //   labelG54.textContent = "⚠️ Insérez valeur G54 :";
    //   labelG54.classList.remove("valid");
    //   labelG54.classList.add("invalid");
    // } else {
    //   // ❌ Mauvais format
    //   labelG54.textContent = "⚠️ Format invalide (ex : 123.456)";
    //   labelG54.classList.remove("valid");
    //   labelG54.classList.add("invalid");
    // }
    if (valueG54 !== "") {
      // ✅ Si une valeur est saisie → vert
      labelG54.style.color = "green";
    } else {
      // ⚠️ Si vide → rouge
      labelG54.style.color = "red";
    }
  });

// init demo
const demo = `O1234 (PROGRAM NAME) ;
G54 ; (origin piece)
M0 ;
G0 T909 ;   (Butée outil)
G0 X40 Z0.4 ;
M0 ;
G0 X100 Z100 ;
G50 S2000 ;
G0 T707 ;   (outil d'ébauche)
G96 S120 M3 ;
G0 X15 Z0.1 ;
G1 X-1 F0.007 ;
G0 X15 Z0.5 ;
G90 X14 Z-10 F0.03;
X13 ;
X12 ;
X11.2 ;
G0 X100 Z100 ;
G0 T202 ;
G96 S150 M3 ;
G0 X11.5 Z0 ;
G1 X-1 F0.005 ;
G0 X11 Z0.5 ;
G1 X11 Z-10 F0.02 ;
G0 X100 Z100 ;
M99 ;
`;
$("#gcode").value = demo;

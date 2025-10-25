// ------------------ G-code Parser (Fanuc, simplified) ------------------
function parseGCode(text, g54Value) {
    const lines = text
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter((l) => l && !l.startsWith("(") && !l.startsWith(";"));
    let absolute = true; // G90/G91 - assume absolute by default
    let unitScale = 1; // G21 mm, G20 inches
    let xPiece = 0.000,
        zPiece = g54Value ; // G54 origin piece
    let x = 100.000,
        z = 80.000,
        f = 2.000; // current position
    let stats = { lines: lines.length, segs: 0 };
    const segments = []; // {x1,z1,x2,z2,rapid:boolean, feed,meta}

    function parseParams(s) {
        const out = {};
        const reg = /([A-Za-z])\s*(-?\d*\.?\d+)/g;
        let m;
        while ((m = reg.exec(s))) {
            out[m[1].toUpperCase()] = parseFloat(m[2]);
        }
        return out;
    }

    for (const raw of lines) {
        // Supprime les commentaires après ";"
        const line = raw.split(";")[0].trim();
        if (!line) continue;
        // Extraction des mots (clés et valeurs)
        const words = line.match(/[A-Za-z][-+]?[0-9]*\.?[0-9]*/g) || [];
        // find G or M codes
        const gcodes = words
            .filter((w) => /^G\d+/i.test(w))
            .map((w) => w.toUpperCase());
        const mcodes = words
            .filter((w) => /^M\d+/i.test(w))
            .map((w) => w.toUpperCase());

        // gérer rapidement les commandes modales
        if (line.match(/G20/i)) {   // affichage en inch
            unitScale = 25.4;
        }
        if (line.match(/G21/i)) {   // affichage en mm
            unitScale = 1;
        }
        if (line.match(/G90/i)) {   // commande en absolute
            absolute = true;
        }
        if (line.match(/G91/i)) {   // commande en relative
            absolute = false;
        }
        if (line.match(/G54/i)) {   // origin piece
            xPiece = 0;
            zPiece = g54Value;
            continue; // no movement
        }

        // Si la ligne contient => G00/G0/G01/G1/G02/G2/G03/G3 parse motion
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
                    // retour à la ligne droite
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
    }

    return { segments, stats };
}
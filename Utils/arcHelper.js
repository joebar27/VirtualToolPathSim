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


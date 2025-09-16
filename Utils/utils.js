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
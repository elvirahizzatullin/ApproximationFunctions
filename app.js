let chartData = null;
let pointsReady = false;
let presetText = "";
let isCustomPoints = false;

let animProgress = 1;  
let residProgress = 1;    
let animFrame = null;   

const PRESETS = {
    5: "(2, 4.2), (3, 5.1), (4, 5.9), (5, 7.2), (6, 8.5)",
    10: "(0, 2), (1, 2.5), (2, 3.2), (3, 4.1), (4, 5.3), (5, 6.8), (6, 8.5), (7, 10.5), (8, 12.5), (9, 14.0)",
    20: "(1, 1.0), (1.2, 1.5), (1.4, 2.1), (1.6, 2.8), (1.8, 3.5), (2.0, 4.2), (2.2, 5.1), (2.4, 6.2), (2.6, 7.3), (2.8, 8.5), (3.0, 9.8), (3.2, 11.2), (3.4, 12.8), (3.6, 14.5), (3.8, 16.3), (4.0, 18.2), (4.2, 20.2), (4.4, 22.4), (4.6, 24.7), (4.8, 27.1)"
};

function easeOut(t) { return 1 - Math.pow(1 - t, 3); }

function parsePoints(text) {
    const points = [];
    const found = text.matchAll(/\(\s*([-+]?\d*\.?\d+)\s*,\s*([-+]?\d*\.?\d+)\s*\)/g);
    for (const item of found) points.push({ x: +item[1], y: +item[2] });
    points.sort((a, b) => a.x - b.x);
    return points;
}

function lagrangeAt(xs, ys, x) {
    let sum = 0;
    for (let i = 0; i < xs.length; i++) {
        let li = 1;
        for (let j = 0; j < xs.length; j++) {
            if (j !== i) li *= (x - xs[j]) / (xs[i] - xs[j]);
        }
        sum += ys[i] * li;
    }
    return sum;
}

function buildDiffTable(points) {
    const xs = points.map((p) => p.x);
    const table = points.map((p) => [p.y]);
    for (let k = 1; k < points.length; k++) {
        for (let i = 0; i < points.length - k; i++) {
            table[i][k] = (table[i + 1][k - 1] - table[i][k - 1]) / (xs[i + k] - xs[i]);
        }
    }
    return { xs, table };
}

function showFormula(points) {
    const xs = points.map((p) => p.x);
    let text = "L(x) = ";
    for (let i = 0; i < points.length; i++) {
        let ch = "";
        let zn = "";
        for (let j = 0; j < points.length; j++) {
            if (j !== i) {
                ch += "(x - " + xs[j] + ") * ";
                zn += "(" + xs[i] + " - " + xs[j] + ") * ";
            }
        }
        text += points[i].y + " * [" + ch.slice(0, -3) + " / " + zn.slice(0, -3) + "]";
        if (i < points.length - 1) text += " + ";
    }
    return text;
}

function showDiffTable(place, points) {
    const data = buildDiffTable(points);
    let html = "<table><tr><th>x</th><th>f(x)</th>";
    for (let k = 1; k < points.length; k++) html += "<th>порядок " + k + "</th>";
    html += "</tr>";
    for (let i = 0; i < points.length; i++) {
        html += "<tr><td>" + data.xs[i] + "</td>";
        for (let k = 0; k < data.table[i].length; k++) {
            html += "<td>" + (+data.table[i][k].toFixed(4)) + "</td>";
        }
        html += "</tr>";
    }
    html += "</table>";
    place.innerHTML = html;
}

function buildDesignMatrix(points, m) {
    const matrix = [];
    for (let i = 0; i < points.length; i++) {
        const row = [];
        let power = 1;
        for (let j = 0; j <= m; j++) {
            row.push(power);
            power *= points[i].x;
        }
        matrix.push(row);
    }
    return matrix;
}

function qrSolve(A, b) {
    const n = A.length;
    const m = A[0].length;
    const Q = A.map((row) => row.slice());
    const R = [];

    for (let j = 0; j < m; j++) {
        R[j] = [];
        let norm = 0;
        for (let i = 0; i < n; i++) norm += Q[i][j] * Q[i][j];
        R[j][j] = Math.sqrt(norm);
        for (let i = 0; i < n; i++) Q[i][j] /= R[j][j];
        for (let k = j + 1; k < m; k++) {
            let dot = 0;
            for (let i = 0; i < n; i++) dot += Q[i][j] * Q[i][k];
            R[j][k] = dot;
            for (let i = 0; i < n; i++) Q[i][k] -= dot * Q[i][j];
        }
    }

    const qtB = [];
    for (let j = 0; j < m; j++) {
        let sum = 0;
        for (let i = 0; i < n; i++) sum += Q[i][j] * b[i];
        qtB.push(sum);
    }

    const coefs = [];
    for (let i = m - 1; i >= 0; i--) {
        let sum = qtB[i];
        for (let j = i + 1; j < m; j++) sum -= R[i][j] * coefs[j];
        coefs[i] = sum / R[i][i];
    }
    return coefs;
}

function polyValue(coefs, x) {
    let sum = 0;
    let power = 1;
    for (let i = 0; i < coefs.length; i++) {
        sum += coefs[i] * power;
        power *= x;
    }
    return sum;
}

function showDesignMatrix(place, points, matrix) {
    const m = matrix[0].length - 1;
    let html = "<table><tr><th>i</th><th>x</th><th>1</th>";
    for (let p = 1; p <= m; p++) html += "<th>x<sup>" + p + "</sup></th>";
    html += "</tr>";
    for (let i = 0; i < matrix.length; i++) {
        html += "<tr><td>" + (i + 1) + "</td><td>" + points[i].x + "</td>";
        for (let j = 0; j < matrix[i].length; j++) {
            html += "<td>" + (+matrix[i][j].toFixed(4)) + "</td>";
        }
        html += "</tr>";
    }
    html += "</table>";
    place.innerHTML = html;
}

function showPolyFormula(coefs) {
    let text = "P(x) = ";
    for (let i = 0; i < coefs.length; i++) {
        const c = +coefs[i].toFixed(4);
        if (i === 0) text += c;
        else if (i === 1) text += (c >= 0 ? " + " : " - ") + Math.abs(c) + "·x";
        else text += (c >= 0 ? " + " : " - ") + Math.abs(c) + "·x^" + i;
    }
    return text;
}

function showMnkTable(place, points, coefs) {
    let html = "<table><tr><th>i</th><th>x</th><th>y</th><th>ŷ</th><th>залишок e</th></tr>";
    for (let i = 0; i < points.length; i++) {
        const yHat = polyValue(coefs, points[i].x);
        const err = points[i].y - yHat;
        html += "<tr><td>" + (i + 1) + "</td><td>" + points[i].x + "</td><td>" + points[i].y;
        html += "</td><td>" + (+yHat.toFixed(4)) + "</td><td>" + (+err.toFixed(4)) + "</td></tr>";
    }
    html += "</table>";
    place.innerHTML = html;
}

function resetResults(msg) {
    document.getElementById("dividedDiffTable").innerHTML = "";
    document.getElementById("lagrangeFormula").textContent = "";
    document.getElementById("designMatrix").innerHTML = "";
    document.getElementById("mnkCoefs").textContent = msg || "";
    document.getElementById("mnkPoly").textContent = "";
    document.getElementById("mnkResiduals").innerHTML = "";
}

function getMode() {
    const btn = document.querySelector("#chartMode button.active");
    return btn ? btn.dataset.mode : "all";
}

function toPx(x, y, box, w, h, pad) {
    const pw = w - 2 * pad;
    const ph = h - 2 * pad;
    const px = pad + ((x - box.xMin) / (box.xMax - box.xMin)) * pw;
    const py = h - pad - ((y - box.yMin) / (box.yMax - box.yMin)) * ph;
    return [px, py];
}

function drawGrid(ctx, box, w, h, pad) {
    ctx.strokeStyle = "#1e293b";
    ctx.lineWidth = 1;
    ctx.font = "11px Arial";
    ctx.fillStyle = "#64748b";

    const xSteps = 8;
    const ySteps = 6;

    for (let i = 0; i <= xSteps; i++) {
        const x = box.xMin + ((box.xMax - box.xMin) * i) / xSteps;
        const [px, py1] = toPx(x, box.yMin, box, w, h, pad);
        const [, py2] = toPx(x, box.yMax, box, w, h, pad);

        ctx.beginPath();
        ctx.moveTo(px, py1);
        ctx.lineTo(px, py2);
        ctx.stroke();

        ctx.fillText(x.toFixed(1), px - 10, h - pad + 15);
    }

    for (let i = 0; i <= ySteps; i++) {
        const y = box.yMin + ((box.yMax - box.yMin) * i) / ySteps;
        const [px1, py] = toPx(box.xMin, y, box, w, h, pad);
        const [px2] = toPx(box.xMax, y, box, w, h, pad);

        ctx.beginPath();
        ctx.moveTo(px1, py);
        ctx.lineTo(px2, py);
        ctx.stroke();

        ctx.fillText(y.toFixed(1), pad - 35, py + 4);
    }

    ctx.strokeStyle = "#475569";
    ctx.lineWidth = 2;
    ctx.beginPath();
    const [x1, y0] = toPx(box.xMin, 0, box, w, h, pad);
    const [x2] = toPx(box.xMax, 0, box, w, h, pad);
    ctx.moveTo(x1, y0);
    ctx.lineTo(x2, y0);
    ctx.stroke();

    const [x0, y1] = toPx(0, box.yMin, box, w, h, pad);
    const [, y2] = toPx(0, box.yMax, box, w, h, pad);
    ctx.beginPath();
    ctx.moveTo(x0, y1);
    ctx.lineTo(x0, y2);
    ctx.stroke();

    ctx.fillStyle = "#94a3b8";
    ctx.font = "13px Arial";
    ctx.fillText("X", w - pad + 10, y0 + 4);
    ctx.fillText("Y", x0 - 10, pad - 10);
}

function getMainBox(points, coefs) {
    const mode = getMode();
    const xs = points.map((p) => p.x);
    const ys = points.map((p) => p.y);
    let xMin = Math.min(...xs);
    let xMax = Math.max(...xs);
    const dx = (xMax - xMin) * 0.1 || 1;
    xMin -= dx;
    xMax += dx;

    const dataYMin = Math.min(...ys);
    const dataYMax = Math.max(...ys);
    const dataRange = (dataYMax - dataYMin) || 1;
    const clampLo = dataYMin - dataRange * 3;
    const clampHi = dataYMax + dataRange * 3;

    let yMin = dataYMin;
    let yMax = dataYMax;

    for (let k = 0; k <= 60; k++) {
        const x = xMin + ((xMax - xMin) * k) / 60;
        if (mode === "all" || mode === "lagrange") {
            const yL = lagrangeAt(xs, ys, x);
            if (isFinite(yL) && yL >= clampLo && yL <= clampHi) {
                yMin = Math.min(yMin, yL);
                yMax = Math.max(yMax, yL);
            }
        }
        if ((mode === "all" || mode === "mnk") && coefs) {
            const y = polyValue(coefs, x);
            if (isFinite(y) && y >= clampLo && y <= clampHi) {
                yMin = Math.min(yMin, y);
                yMax = Math.max(yMax, y);
            }
        }
    }

    const dy = (yMax - yMin) * 0.12 || 1;
    return { xMin, xMax, yMin: yMin - dy, yMax: yMax + dy, xs, ys };
}

function drawLine(ctx, color, fn, box, w, h, pad, progress = 1, fromY = null) {
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.setLineDash([]);
    ctx.beginPath();
    const steps = 100;
    const limit = Math.round(steps * progress);
    for (let k = 0; k <= limit; k++) {
        const x = box.xMin + ((box.xMax - box.xMin) * k) / steps;
        const finalY = fn(x);
        const y = fromY !== null ? fromY + (finalY - fromY) * progress : finalY;
        const [px, py] = toPx(x, y, box, w, h, pad);
        if (k === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
    }
    ctx.stroke();
}

function drawMainChart() {
    const canvas = document.getElementById("mainChart");
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    const w = (canvas.width = canvas.clientWidth);
    const h = (canvas.height = canvas.clientHeight);
    const pad = 60;

    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = "#0f172a";
    ctx.fillRect(0, 0, w, h);

    if (!chartData) return;

    const mode = getMode();
    const { points, coefs } = chartData;
    const box = getMainBox(points, coefs);

    drawGrid(ctx, box, w, h, pad);

    if (mode === "all" || mode === "lagrange") {
        drawLine(ctx, "#3b82f6", (x) => lagrangeAt(box.xs, box.ys, x), box, w, h, pad, animProgress);
    }
    if ((mode === "all" || mode === "mnk") && coefs) {
        const yMean = points.reduce((s, p) => s + p.y, 0) / points.length;
        drawLine(ctx, "#10b981", (x) => polyValue(coefs, x), box, w, h, pad, animProgress, yMean);
    }

    chartData.screenPoints = [];

    for (const p of points) {
        const [px, py] = toPx(p.x, p.y, box, w, h, pad);
        const yHat = coefs ? polyValue(coefs, p.x) : null;
        const error = coefs ? p.y - yHat : null;
        chartData.screenPoints.push({ x: p.x, y: p.y, px, py, yHat, error });

        ctx.fillStyle = "#f8fafc";
        ctx.strokeStyle = "#1e293b";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(px, py, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
    }

    if ((mode === "all" || mode === "mnk") && coefs && residProgress > 0) {
        const numToShow = Math.floor(points.length * residProgress);
        for (let i = 0; i < numToShow; i++) {
            const p = points[i];
            const yHat = polyValue(coefs, p.x);
            const [px1, py1] = toPx(p.x, yHat, box, w, h, pad);
            const [px2, py2] = toPx(p.x, p.y, box, w, h, pad);

            ctx.strokeStyle = "#f59e0b";
            ctx.lineWidth = 2;
            ctx.setLineDash([5, 3]);
            ctx.beginPath();
            ctx.moveTo(px1, py1);
            ctx.lineTo(px2, py2);
            ctx.stroke();
            ctx.setLineDash([]);
        }
    }

    ctx.font = "14px Arial";
    ctx.fillStyle = "#1e293b";
    ctx.fillRect(pad, 10, 300, 30);

    let lx = pad + 10;
    if (mode === "all" || mode === "lagrange") {
        ctx.fillStyle = "#3b82f6";
        ctx.fillRect(lx, 15, 20, 20);
        ctx.fillStyle = "#e2e8f0";
        ctx.fillText("Лагранж", lx + 28, 30);
        lx += 100;
    }
    if ((mode === "all" || mode === "mnk") && coefs) {
        ctx.fillStyle = "#10b981";
        ctx.fillRect(lx, 15, 20, 20);
        ctx.fillStyle = "#e2e8f0";
        ctx.fillText("МНК", lx + 28, 30);
        lx += 60;
    }
    ctx.fillStyle = "#f8fafc";
    ctx.beginPath();
    ctx.arc(lx + 10, 25, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#e2e8f0";
    ctx.fillText("Точки даних", lx + 22, 30);
}

function drawResidualChart() {
    const canvas = document.getElementById("residualChart");
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    const w = (canvas.width = canvas.clientWidth);
    const h = (canvas.height = canvas.clientHeight);
    const pad = 50;

    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = "#0f172a";
    ctx.fillRect(0, 0, w, h);

    const mode = getMode();
    if (!chartData || !chartData.coefs || mode === "lagrange") {
        ctx.fillStyle = "#94a3b8";
        ctx.font = "14px Arial";
        ctx.fillText("Діаграма залишків — режим «МНК» або «Усі»", pad, 40);
        return;
    }

    const { points, coefs } = chartData;
    const errs = points.map((p) => p.y - polyValue(coefs, p.x));
    const xs = points.map((p) => p.x);

    let yMin = Math.min(0, ...errs);
    let yMax = Math.max(0, ...errs);
    const dy = (yMax - yMin) * 0.2 || 0.5;
    yMin -= dy;
    yMax += dy;

    let xMin = Math.min(...xs);
    let xMax = Math.max(...xs);
    const dx = (xMax - xMin) * 0.15 || 0.5;
    xMin -= dx;
    xMax += dx;

    const box = { xMin, xMax, yMin, yMax };

    const [z1x, zy] = toPx(xMin, 0, box, w, h, pad);
    const [z2x] = toPx(xMax, 0, box, w, h, pad);

    ctx.strokeStyle = "#94a3b8";
    ctx.lineWidth = 1;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    ctx.moveTo(z1x, zy);
    ctx.lineTo(z2x, zy);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = "#94a3b8";
    ctx.font = "12px Arial";
    ctx.fillText("0", pad - 18, zy + 4);

    for (let i = 0; i < points.length; i++) {
        const x = xs[i];
        const e = errs[i];
        const [px0, py0] = toPx(x, 0, box, w, h, pad);
        const [px1, py1] = toPx(x, e, box, w, h, pad);

        ctx.strokeStyle = "#f59e0b";
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 4]);
        ctx.beginPath();
        ctx.moveTo(px0, py0);
        ctx.lineTo(px1, py1);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.fillStyle = "#f59e0b";
        ctx.beginPath();
        ctx.arc(px1, py1, 6, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = "#cbd5e1";
        ctx.font = "11px Arial";
        ctx.fillText("e" + (i + 1), px1 + 8, py1 - 4);
    }
}

function drawCharts() {
    drawMainChart();
    drawResidualChart();
}

function updateVisibility() {
    const mode = getMode();

    document.querySelectorAll(".lagrange-block").forEach(function (el) {
        el.classList.toggle("hidden", mode === "mnk");
    });
    document.querySelectorAll(".mnk-block").forEach(function (el) {
        el.classList.toggle("hidden", mode === "lagrange");
    });
    document.getElementById("mnkDegreeBox").classList.toggle("hidden", mode === "lagrange");
}

function getPointsText() {
    if (isCustomPoints) {
        return document.getElementById("pointsInput").value;
    }
    return presetText;
}

function showWorkArea(callback) {
    document.getElementById("resultsSection").classList.remove("hidden");
    document.getElementById("chartsSection").classList.remove("hidden");
    if (callback) {
        requestAnimationFrame(function () {
            requestAnimationFrame(callback);
        });
    }
}

function selectPreset(count) {
    isCustomPoints = false;
    presetText = PRESETS[count];

    document.querySelectorAll("#pointCountBtns button").forEach(function (b) {
        b.classList.toggle("active", b.dataset.count === String(count));
    });

    const infoEl = document.getElementById("presetPointsInfo");
    if (infoEl) {
        infoEl.textContent = "Точки (набір " + count + "): " + PRESETS[count];
        infoEl.classList.remove("hidden");
    }

    document.getElementById("pointsSection").classList.add("hidden");
    pointsReady = true;
    updateVisibility();
    showWorkArea(calculate);
}

function selectCustomPoints() {
    isCustomPoints = true;
    presetText = "";

    document.querySelectorAll("#pointCountBtns button").forEach(function (b) {
        b.classList.toggle("active", b.dataset.count === "custom");
    });

    const infoEl = document.getElementById("presetPointsInfo");
    if (infoEl) infoEl.classList.add("hidden");

    document.getElementById("pointsInput").value = "";
    document.getElementById("pointsCount").textContent = "Точок: 0";
    document.getElementById("pointsSection").classList.remove("hidden");
    pointsReady = false;
    updateVisibility();
}

function setReplayBtn(visible, busy) {
    const btn = document.getElementById("replayBtn");
    if (!btn) return;
    btn.classList.toggle("hidden", !visible);
    btn.classList.toggle("animating", busy);
    btn.disabled = busy;
    btn.textContent = busy ? "\u23F3 Анімація..." : "\u25B6 Запустити анімацію";
}

function startAnimation() {
    if (animFrame) cancelAnimationFrame(animFrame);

    animProgress = 0;
    residProgress = 0;
    setReplayBtn(true, true);

    const CURVE_MS = 2000; 
    const RESID_MS = 1500;   
    const start = Date.now();

    function tick() {
        const t = Date.now() - start;

        animProgress = easeOut(Math.min(1, t / CURVE_MS));
        residProgress = t > CURVE_MS ? easeOut(Math.min(1, (t - CURVE_MS) / RESID_MS)) : 0;

        drawCharts();

        if (t < CURVE_MS + RESID_MS) {
            animFrame = requestAnimationFrame(tick);
        } else {
            animProgress = 1;
            residProgress = 1;
            animFrame = null;
            drawCharts();
            setReplayBtn(true, false);
        }
    }

    animFrame = requestAnimationFrame(tick);
}


function calculate() {
    if (!pointsReady) return;
    const chartsEl = document.getElementById("chartsSection");
    if (chartsEl.classList.contains("hidden")) {
        showWorkArea(calculate);
        return;
    }

    const mode = getMode();
    const points = parsePoints(getPointsText());
    const m = +document.getElementById("mnkDegree").value;

    resetResults();

    if (isCustomPoints) {
        document.getElementById("pointsCount").textContent = "Точок: " + points.length;
    }
    document.getElementById("mnkDegLabel").textContent = m;

    if (points.length < 2) {
        document.getElementById("mnkCoefs").textContent = "Потрібно щонайменше 2 точки.";
        chartData = null;
        drawCharts();
        return;
    }

    if (mode === "all" || mode === "lagrange") {
        showDiffTable(document.getElementById("dividedDiffTable"), points);
        document.getElementById("lagrangeFormula").textContent = showFormula(points);
    }

    let coefs = null;

    if (mode === "all" || mode === "mnk") {
        if (points.length < m + 1) {
            clearMnk("Для ступеня m = " + m + " потрібно щонайменше " + (m + 1) + " точок.");
        } else {
            const A = buildDesignMatrix(points, m);
            const y = points.map((p) => p.y);
            coefs = qrSolve(A, y);

            showDesignMatrix(document.getElementById("designMatrix"), points, A);

            let coefText = "";
            for (let i = 0; i < coefs.length; i++) {
                coefText += "a" + i + " = " + (+coefs[i].toFixed(6));
                if (i < coefs.length - 1) coefText += ", ";
            }

            document.getElementById("mnkCoefs").textContent = coefText;
            document.getElementById("mnkPoly").textContent = showPolyFormula(coefs);
            showMnkTable(document.getElementById("mnkResiduals"), points, coefs);
        }
    } else {
        clearMnk("");
    }

    chartData = { points, coefs, screenPoints: [] };

    if (points.length >= 2) {
        startAnimation();
    } else {
        setReplayBtn(false, false);
        drawCharts();
    }
}

function clearMnk(msg) {
    document.getElementById("designMatrix").innerHTML = "";
    document.getElementById("mnkCoefs").textContent = msg || "";
    document.getElementById("mnkPoly").textContent = "";
    document.getElementById("mnkResiduals").innerHTML = "";
}

function onChartHover(e) {
    const tip = document.getElementById("chartTooltip");
    if (!chartData || !chartData.screenPoints || !chartData.screenPoints.length) {
        tip.style.display = "none";
        return;
    }

    const rect = e.target.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    let hit = null;

    for (const p of chartData.screenPoints) {
        if (Math.hypot(mx - p.px, my - p.py) < 14) hit = p;
    }

    if (hit) {
        tip.style.display = "block";
        let text = "x: " + (+hit.x.toFixed(3)) + ", y: " + (+hit.y.toFixed(3));
        if (hit.error !== null && hit.error !== undefined) {
            text += "\nŷ: " + (+hit.yHat.toFixed(3));
            text += "\nПохибка: " + (+hit.error.toFixed(4));
        }
        tip.textContent = text;
        tip.style.left = e.clientX + 15 + "px";
        tip.style.top = e.clientY - 35 + "px";
    } else {
        tip.style.display = "none";
    }
}

document.getElementById("pointCountBtns").addEventListener("click", function (e) {
    if (e.target.tagName !== "BUTTON") return;
    if (e.target.dataset.count === "custom") {
        selectCustomPoints();
    } else {
        selectPreset(+e.target.dataset.count);
    }
});

document.getElementById("mnkDegree").addEventListener("change", calculate);

document.getElementById("pointsInput").addEventListener("input", function () {
    if (isCustomPoints) {
        const pts = parsePoints(this.value);
        document.getElementById("pointsCount").textContent = "Точок: " + pts.length;
    }
});

document.getElementById("calcBtn").addEventListener("click", function () {
    pointsReady = true;
    updateVisibility();
    showWorkArea(calculate);
});

document.getElementById("chartMode").addEventListener("click", function (e) {
    if (e.target.tagName !== "BUTTON") return;
    this.querySelectorAll("button").forEach((b) => b.classList.remove("active"));
    e.target.classList.add("active");
    updateVisibility();
    calculate();
});

document.getElementById("mainChart").addEventListener("mousemove", onChartHover);
document.getElementById("mainChart").addEventListener("mouseleave", function () {
    document.getElementById("chartTooltip").style.display = "none";
});

document.getElementById("replayBtn").addEventListener("click", function () {
    if (!animFrame && chartData) startAnimation();
});

window.addEventListener("resize", drawCharts);

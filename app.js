function parsePoints(text) {
    const points = [];
    const found = text.matchAll(/\(\s*([-+]?\d*\.?\d+)\s*,\s*([-+]?\d*\.?\d+)\s*\)/g);

    for (const item of found) {
        points.push({ x: +item[1], y: +item[2] });
    }

    points.sort((a, b) => a.x - b.x);
    return points;
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
        let chyselnyk = "";
        let znamennik = "";

        for (let j = 0; j < points.length; j++) {
            if (j !== i) {
                chyselnyk += "(x - " + xs[j] + ") * ";
                znamennik += "(" + xs[i] + " - " + xs[j] + ") * ";
            }
        }

        text += points[i].y + " * [" + chyselnyk.slice(0, -3) + " / " + znamennik.slice(0, -3) + "]";
        if (i < points.length - 1) text += " + ";
    }

    return text;
}

function showDiffTable(place, points) {
    const data = buildDiffTable(points);
    let html = "<table><tr><th>x</th><th>f(x)</th>";

    for (let k = 1; k < points.length; k++) {
        html += "<th>порядок " + k + "</th>";
    }

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
    let html = "<table><tr><th>i</th><th>x</th>";

    html += "<th>1</th>";
    for (let p = 1; p <= m; p++) {
        html += "<th>x<sup>" + p + "</sup></th>";
    }
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
    const names = ["a0", "a1", "a2", "a3", "a4"];

    for (let i = 0; i < coefs.length; i++) {
        const c = (+coefs[i].toFixed(4));
        if (i === 0) {
            text += c;
        } else if (i === 1) {
            text += (c >= 0 ? " + " : " - ") + Math.abs(c) + "·x";
        } else {
            text += (c >= 0 ? " + " : " - ") + Math.abs(c) + "·x^" + i;
        }
    }

    return text;
}

function showMnkTable(place, points, coefs) {
    let html = "<table><tr><th>i</th><th>x</th><th>y</th><th>ŷ</th><th>залишок e</th></tr>";

    for (let i = 0; i < points.length; i++) {
        const yHat = polyValue(coefs, points[i].x);
        const err = points[i].y - yHat;

        html += "<tr>";
        html += "<td>" + (i + 1) + "</td>";
        html += "<td>" + points[i].x + "</td>";
        html += "<td>" + points[i].y + "</td>";
        html += "<td>" + (+yHat.toFixed(4)) + "</td>";
        html += "<td>" + (+err.toFixed(4)) + "</td>";
        html += "</tr>";
    }

    html += "</table>";
    place.innerHTML = html;
}

function clearMnk(msg) {
    document.getElementById("designMatrix").innerHTML = "";
    document.getElementById("mnkCoefs").textContent = msg || "";
    document.getElementById("mnkPoly").textContent = "";
    document.getElementById("mnkResiduals").innerHTML = "";
}


function calculate() {
    const points = parsePoints(document.getElementById("pointsInput").value);
    const m = +document.getElementById("mnkDegree").value;

    document.getElementById("pointsCount").textContent = "Точок: " + points.length;
    document.getElementById("mnkDegLabel").textContent = m;

    const formula = document.getElementById("lagrangeFormula");
    const diffPlace = document.getElementById("dividedDiffTable");

    if (points.length < 2) {
        formula.textContent = "Потрібно щонайменше 2 точки.";
        diffPlace.innerHTML = "";
        clearMnk("Потрібно щонайменше m + 1 точок.");
        return;
    }

    showDiffTable(diffPlace, points);
    formula.textContent = showFormula(points);

    if (points.length < m + 1) {
        clearMnk("Для ступеня m = " + m + " потрібно щонайменше " + (m + 1) + " точок.");
        return;
    }

    const A = buildDesignMatrix(points, m);
    const y = points.map((p) => p.y);
    const coefs = qrSolve(A, y);

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

document.getElementById("calcBtn").addEventListener("click", calculate);
document.getElementById("mnkDegree").addEventListener("change", calculate);

document.getElementById("pointsInput").addEventListener("input", function () {
    document.getElementById("pointsCount").textContent = "Точок: " + parsePoints(this.value).length;
});

calculate();

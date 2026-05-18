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

        chyselnyk = chyselnyk.slice(0, -3);
        znamennik = znamennik.slice(0, -3);

        text += points[i].y + " * [" + chyselnyk + " / " + znamennik + "]";
        if (i < points.length - 1) text += " + ";
    }

    return text;
}

function showTable(place, points) {
    const data = buildDiffTable(points);
    const xs = data.xs;
    const table = data.table;
    let html = "<table><tr><th>x</th><th>f(x)</th>";

    for (let k = 1; k < points.length; k++) {
        html += "<th>порядок " + k + "</th>";
    }

    html += "</tr>";

    for (let i = 0; i < points.length; i++) {
        html += "<tr><td>" + xs[i] + "</td>";

        for (let k = 0; k < table[i].length; k++) {
            html += "<td>" + (+table[i][k].toFixed(4)) + "</td>";
        }

        html += "</tr>";
    }

    html += "</table>";
    place.innerHTML = html;
}

function calculate() {
    const points = parsePoints(document.getElementById("pointsInput").value);
    const formula = document.getElementById("lagrangeFormula");
    const tablePlace = document.getElementById("dividedDiffTable");

    document.getElementById("pointsCount").textContent = "Точок: " + points.length;

    if (points.length < 2) {
        formula.textContent = "Потрібно щонайменше 2 точки.";
        tablePlace.innerHTML = "";
        return;
    }

    showTable(tablePlace, points);
    formula.textContent = showFormula(points);
}

document.getElementById("calcBtn").addEventListener("click", calculate);

document.getElementById("pointsInput").addEventListener("input", function () {
    const n = parsePoints(this.value).length;
    document.getElementById("pointsCount").textContent = "Точок: " + n;
});

calculate();

#!/usr/bin/env node
/**
 * manage_grades.js - Automatizimi i menaxhimit dhe shtimit të notave në SMIP
 * Përdor kanalin e qëndrueshëm CDP worker në portën 8321.
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

function cdpEval(code) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({ code: `(async () => { try { ${code} } catch(e) { return "ERROR: " + e.stack; } })()` });
    const req = http.request('http://127.0.0.1:8321/eval', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    }, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data).result);
        } catch (e) {
          resolve(data);
        }
      });
    });
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

function cdpScreenshot(filePath) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({ filePath, fullPage: true });
    const req = http.request('http://127.0.0.1:8321/screenshot', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    }, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(JSON.parse(data)));
    });
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

async function addGrades(options) {
  const { className, subjectKeyword, period = 'parë', grades = [], dryRun = false } = options;

  console.log(`[SMIP] Fillimi i hedhjes së notave për Klasën ${className} (${subjectKeyword}), Periudha e ${period}...`);

  const res = await cdpEval(`
    if (!window.location.href.includes("tab=trimester-register")) {
      window.location.href = "https://smip.al/teacher/registry?tab=trimester-register";
      await new Promise(r => setTimeout(r, 1200));
    }

    // 1. Zgjidh 'Klasa e bashkuar: Jo' nese ekziston
    const controls = Array.from(document.querySelectorAll("[class*=-control]"));
    const labels = Array.from(document.querySelectorAll("div")).filter(d => d.children.length === 0);

    // 2. Zgjidh Klasën
    const klasaLabel = labels.find(d => d.innerText.trim() === "Klasa");
    const klasaControl = klasaLabel ? klasaLabel.parentElement.querySelector("[class*=-control]") : controls[1];
    klasaControl.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    await new Promise(r => setTimeout(r, 400));
    const optClass = Array.from(document.querySelectorAll("[class*=-option]")).find(o => o.innerText.trim() === "${className}");
    if (!optClass) return { error: "Klasa ${className} nuk u gjet në dropdown" };
    optClass.click();
    await new Promise(r => setTimeout(r, 800));

    // 3. Zgjidh Lëndën
    const lendaLabel = Array.from(document.querySelectorAll("div")).find(d => d.innerText.trim() === "Lënda" && d.children.length === 0);
    const lendaControl = lendaLabel ? lendaLabel.parentElement.querySelector("[class*=-control]") : document.querySelectorAll("[class*=-control]")[2];
    lendaControl.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    await new Promise(r => setTimeout(r, 400));
    let subOpt = Array.from(document.querySelectorAll("[class*=-option]")).find(o => o.innerText.toLowerCase().includes("${subjectKeyword}".toLowerCase()));
    if (!subOpt) subOpt = Array.from(document.querySelectorAll("[class*=-option]"))[0];
    if (!subOpt) return { error: "Lënda nuk u gjet" };
    const subName = subOpt.innerText.trim();
    subOpt.click();
    await new Promise(r => setTimeout(r, 800));

    // 4. Zgjidh Periudhën
    const perControl = Array.from(document.querySelectorAll("[class*=-control]")).find(c => c.innerText.includes("periudhën") || c.innerText.includes("Periudha"));
    if (perControl) {
      perControl.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
      await new Promise(r => setTimeout(r, 400));
      const pOpt = Array.from(document.querySelectorAll("[class*=-option]")).find(o => o.innerText.toLowerCase().includes("${period}".toLowerCase()));
      if (pOpt) pOpt.click();
      await new Promise(r => setTimeout(r, 1200));
    }

    const table = document.querySelector("table");
    if (!table) return { error: "Tabela e regjistrit nuk u ngarkua" };

    const headers = Array.from(table.querySelectorAll("th")).map(th => th.innerText.replace(/\\n+/g, " ").trim());
    const rows = Array.from(table.querySelectorAll("tbody tr"));

    const targets = ${JSON.stringify(grades)};
    const audit = [];

    for (const t of targets) {
      const row = rows.find(r => {
        const firstTd = r.querySelector("td");
        return firstTd && firstTd.innerText.toLowerCase().includes(t.name.toLowerCase());
      });

      if (!row) {
        audit.push({ name: t.name, status: "error", error: "Nxënësi nuk u gjet në tabelë" });
        continue;
      }

      // Gjej indeksin e kolones per daten
      let colIdx = -1;
      if (t.dateExact) {
        colIdx = headers.findIndex((h, i) => i > 0 && h.trim() === t.dateExact.trim());
      } else if (t.datePattern) {
        colIdx = headers.findIndex((h, i) => i > 0 && h.includes(t.datePattern));
      }

      if (colIdx < 0) {
        audit.push({ name: t.name, date: t.datePattern || t.dateExact, status: "error", error: "Kolona e datës nuk u gjet" });
        continue;
      }

      const cell = row.querySelectorAll("td")[colIdx];
      if (!cell) {
        audit.push({ name: t.name, status: "error", error: "Qeliza e datës mungon" });
        continue;
      }

      const addBtn = cell.querySelector("button.jss-add-grade, #action-button, button");
      if (!addBtn) {
        audit.push({ name: t.name, status: "skipped", message: "Qeliza ka tashmë notë: " + cell.innerText.trim() });
        continue;
      }

      addBtn.click();
      await new Promise(r => setTimeout(r, 400));

      const modal = document.querySelector(".modal-panel");
      if (!modal) {
        audit.push({ name: t.name, status: "error", error: "Modali nuk u hap" });
        continue;
      }

      // Tipi i vleresimit
      const contRadio = document.getElementById("evaluation-type-continuous");
      if (contRadio && !contRadio.checked) contRadio.click();

      // Kliko butonin e notes
      const gradeBtn = Array.from(modal.querySelectorAll(".jss-grade-button")).find(b => b.innerText.trim() === String(t.grade));
      if (!gradeBtn) {
        audit.push({ name: t.name, status: "error", error: "Butoni i notës " + t.grade + " nuk u gjet në modal" });
        window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
        await new Promise(r => setTimeout(r, 200));
        continue;
      }

      gradeBtn.click();
      await new Promise(r => setTimeout(r, 400));

      audit.push({
        name: t.name,
        date: headers[colIdx],
        grade: t.grade,
        newCellText: cell.innerText.trim(),
        status: "success"
      });
    }

    // Ruajtja me bulk save
    let saved = false;
    const saveBtn = document.getElementById("bulk-save-grades");
    if (saveBtn && !saveBtn.disabled && !${Boolean(dryRun)}) {
      saveBtn.click();
      await new Promise(r => setTimeout(r, 3000));
      saved = true;
    }

    return {
      className: "${className}",
      subject: subName,
      audit,
      saved,
      dryRun: ${Boolean(dryRun)}
    };
  `);

  const screenshotPath = `smip_docs/screenshots/notat_${className}_${Date.now()}.png`;
  try {
    await cdpScreenshot(screenshotPath);
    console.log(`[SMIP] Screenshot konfirmimi: ${screenshotPath}`);
  } catch (e) {
    // optional screenshot
  }

  return res;
}

// CLI Runner
if (require.main === module) {
  const args = process.argv.slice(2);
  if (args.length === 0 || args.includes('--help')) {
    console.log(`
Përdorimi:
  node manage_grades.js --class <klasa> --subject <lenda> --grades-file <skedari.json> [--period <pare|dyte|trete>] [--dry-run]

Shembull:
  node manage_grades.js --class 7-A --subject "edukim" --grades-file notat_7a.json
    `);
    process.exit(0);
  }

  const getArg = flag => {
    const idx = args.indexOf(flag);
    return idx >= 0 && args[idx + 1] ? args[idx + 1] : null;
  };

  const className = getArg('--class');
  const subjectKeyword = getArg('--subject') || 'edukim';
  const period = getArg('--period') || 'parë';
  const gradesFile = getArg('--grades-file');
  const dryRun = args.includes('--dry-run');

  if (!className) {
    console.error('Gabim: Mungon parametri --class (p.sh. --class 7-A)');
    process.exit(1);
  }

  let grades = [];
  if (gradesFile && fs.existsSync(gradesFile)) {
    grades = JSON.parse(fs.readFileSync(gradesFile, 'utf8'));
  }

  addGrades({ className, subjectKeyword, period, grades, dryRun })
    .then(res => {
      console.log('Rezultati:', JSON.stringify(res, null, 2));
      process.exit(0);
    })
    .catch(err => {
      console.error('Gabim gjatë ekzekutimit:', err);
      process.exit(1);
    });
}

module.exports = { addGrades };

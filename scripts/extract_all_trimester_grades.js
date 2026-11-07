const http = require('http');
const fs = require('fs');

function cdpEval(code) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({ code: `(() => { try { ${code} } catch(e) { return "ERROR: " + e.stack; } })()` });
    const req = http.request('http://127.0.0.1:8321/eval', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    }, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(JSON.parse(data).result));
    });
    req.write(postData);
    req.end();
  });
}

async function extractClassPeriod(className, subjectKeyword, periodIndex) {
  return await cdpEval(`
    return (async () => {
      // 1. Zgjidh klasën
      const klasaLabel = Array.from(document.querySelectorAll("div")).find(d => d.innerText.trim() === "Klasa" && d.children.length === 0);
      if (!klasaLabel) return { error: "Klasa label not found" };
      const klasaControl = klasaLabel.parentElement.querySelector("[class*=-control]");
      klasaControl.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
      await new Promise(r => setTimeout(r, 350));
      const opt = Array.from(document.querySelectorAll("[class*=-option]")).find(o => o.innerText.trim() === "${className}");
      if (!opt) return { error: "Option ${className} not found" };
      opt.click();
      await new Promise(r => setTimeout(r, 600));

      // 2. Zgjidh lëndën
      const lendaLabel = Array.from(document.querySelectorAll("div")).find(d => d.innerText.trim() === "Lënda" && d.children.length === 0);
      if (!lendaLabel) return { error: "Lënda label not found" };
      const lendaControl = lendaLabel.parentElement.querySelector("[class*=-control]");
      lendaControl.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
      await new Promise(r => setTimeout(r, 350));
      
      let subOpt;
      if ("${subjectKeyword}") {
        subOpt = Array.from(document.querySelectorAll("[class*=-option]")).find(o => o.innerText.toLowerCase().includes("${subjectKeyword}".toLowerCase()));
      }
      if (!subOpt) {
        subOpt = Array.from(document.querySelectorAll("[class*=-option]"))[0];
      }
      if (!subOpt) return { error: "No subject option found" };
      const chosenSubject = subOpt.innerText.trim();
      subOpt.click();
      await new Promise(r => setTimeout(r, 600));

      // 3. Zgjidh Periudhen
      const perControl = Array.from(document.querySelectorAll("[class*=-control]")).find(c => c.innerText.includes("periudhën") || c.innerText.includes("Periudha"));
      if (!perControl) return { error: "Periudha control not found" };
      perControl.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
      await new Promise(r => setTimeout(r, 350));
      const perOpts = Array.from(document.querySelectorAll("[class*=-option]"));
      const chosenPer = perOpts[${periodIndex}] ? perOpts[${periodIndex}].innerText.trim() : null;
      if (!perOpts[${periodIndex}]) return { error: "Period index ${periodIndex} not found", available: perOpts.map(o => o.innerText.trim()) };
      perOpts[${periodIndex}].click();
      await new Promise(r => setTimeout(r, 1200));

      // 4. Lexo tabelen
      const table = document.querySelector("table");
      if (!table) return { error: "Table not found", chosenSubject, chosenPer };

      const headers = Array.from(table.querySelectorAll("th")).map(th => th.innerText.replace(/\\n+/g, " ").trim());
      const rows = Array.from(table.querySelectorAll("tbody tr")).map(tr => {
        return Array.from(tr.querySelectorAll("td")).map(td => td.innerText.replace(/\\n+/g, " ").trim());
      });

      return {
        success: true,
        klasa: "${className}",
        lenda: chosenSubject,
        periudha: chosenPer,
        headers,
        rowCount: rows.length,
        rows
      };
    })();
  `);
}

async function main() {
  const classes = [
    { klasa: '1-A', lenda: 'angleze' },
    { klasa: '2-A', lenda: 'angleze' },
    { klasa: '3-A', lenda: 'angleze' },
    { klasa: '4-A', lenda: 'angleze' },
    { klasa: '5-A', lenda: 'angleze' },
    { klasa: '6-A', lenda: 'fizik' },
    { klasa: '7-A', lenda: 'fizik' },
    { klasa: '8-A', lenda: 'fizik' },
    { klasa: '9-A', lenda: 'fizik' },
    { klasa: '10-A', lenda: 'fizik' },
    { klasa: '11-A', lenda: 'fizik' },
    { klasa: '12-A', lenda: 'fizik' },
  ];

  const results = {};

  for (const c of classes) {
    results[c.klasa] = {};
    for (let pIdx = 0; pIdx < 3; pIdx++) {
      const pName = ['Periudha 1', 'Periudha 2', 'Periudha 3'][pIdx];
      console.log(`Processing ${c.klasa} - ${pName}...`);
      const res = await extractClassPeriod(c.klasa, c.lenda, pIdx);
      results[c.klasa][pName] = res;
      console.log(`  -> ${c.klasa} ${pName}: rows=${res.rowCount || 0}, dates=${res.headers ? res.headers.length - 1 : 0}`);
    }
  }

  fs.writeFileSync('raw_trimester_grades_2025_2026.json', JSON.stringify(results, null, 2));
  console.log('Finished extracting all trimester grades! Saved to raw_trimester_grades_2025_2026.json');
}

main().catch(console.error);

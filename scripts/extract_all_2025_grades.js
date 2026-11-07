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
      res.on('end', () => {
        try {
          resolve(JSON.parse(data).result);
        } catch (e) {
          reject(e);
        }
      });
    });
    req.write(postData);
    req.end();
  });
}

async function selectClassAndSubject(className, subjectName) {
  return await cdpEval(`
    return (async () => {
      // 1. Zgjidh klasën
      const klasaLabel = Array.from(document.querySelectorAll("div")).find(d => d.innerText.trim() === "Klasa" && d.children.length === 0);
      if (!klasaLabel) return { error: "Klasa label not found" };
      const klasaControl = klasaLabel.parentElement.querySelector("[class*=-control]");
      klasaControl.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
      await new Promise(r => setTimeout(r, 400));
      const opt = Array.from(document.querySelectorAll("[class*=-option]")).find(o => o.innerText.trim() === "${className}");
      if (!opt) return { error: "Option ${className} not found" };
      opt.click();
      await new Promise(r => setTimeout(r, 700));

      // 2. Zgjidh lëndën
      const lendaLabel = Array.from(document.querySelectorAll("div")).find(d => d.innerText.trim() === "Lënda" && d.children.length === 0);
      if (!lendaLabel) return { error: "Lënda label not found" };
      const lendaControl = lendaLabel.parentElement.querySelector("[class*=-control]");
      lendaControl.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
      await new Promise(r => setTimeout(r, 400));
      
      let subOpt;
      if ("${subjectName}") {
        subOpt = Array.from(document.querySelectorAll("[class*=-option]")).find(o => o.innerText.toLowerCase().includes("${subjectName}".toLowerCase()));
      } else {
        subOpt = Array.from(document.querySelectorAll("[class*=-option]"))[0];
      }
      
      if (!subOpt) {
        return { error: "Subject not found", available: Array.from(document.querySelectorAll("[class*=-option]")).map(o => o.innerText.trim()) };
      }
      const chosenSubject = subOpt.innerText.trim();
      subOpt.click();
      await new Promise(r => setTimeout(r, 1500));

      // 3. Lexo tabelen
      const table = document.querySelector("table");
      if (!table) return { error: "Table not found", chosenSubject };

      const headers = Array.from(table.querySelectorAll("th")).map(th => th.innerText.replace(/\\n+/g, " ").trim());
      const rows = Array.from(table.querySelectorAll("tbody tr")).map(tr => {
        return Array.from(tr.querySelectorAll("td")).map(td => td.innerText.replace(/\\n+/g, " ").trim());
      });

      return {
        success: true,
        klasa: "${className}",
        lenda: chosenSubject,
        headers,
        rowCount: rows.length,
        rows
      };
    })();
  `);
}

async function main() {
  const targets = [
    { klasa: '1-A', lendaKeyword: 'angleze' },
    { klasa: '2-A', lendaKeyword: 'angleze' },
    { klasa: '3-A', lendaKeyword: 'angleze' },
    { klasa: '4-A', lendaKeyword: 'angleze' },
    { klasa: '5-A', lendaKeyword: 'angleze' },
    { klasa: '6-A', lendaKeyword: 'fizik' },
    { klasa: '7-A', lendaKeyword: 'fizik' },
    { klasa: '8-A', lendaKeyword: 'fizik' },
    { klasa: '9-A', lendaKeyword: 'fizik' },
    { klasa: '10-A', lendaKeyword: 'fizik' },
    { klasa: '11-A', lendaKeyword: 'fizik' },
    { klasa: '12-A', lendaKeyword: 'fizik' },
  ];

  const results = {};

  for (const t of targets) {
    console.log(`Extracting ${t.klasa} - ${t.lendaKeyword}...`);
    const res = await selectClassAndSubject(t.klasa, t.lendaKeyword);
    results[t.klasa] = res;
    console.log(`-> ${t.klasa}: found ${res.rowCount || 0} rows (Subject: ${res.lenda || res.chosenSubject})`);
  }

  fs.writeFileSync('raw_grades_2025_2026.json', JSON.stringify(results, null, 2));
  console.log('Saved to raw_grades_2025_2026.json');
}

main().catch(console.error);

const http = require('http');

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

async function main() {
  const className = process.argv[2] || '6-A';
  const res = await cdpEval(`
    return (async () => {
      // 1. Zgjidh klasën
      const klasaLabel = Array.from(document.querySelectorAll("div")).find(d => d.innerText.trim() === "Klasa" && d.children.length === 0);
      if (!klasaLabel) return "Klasa label not found";
      const klasaControl = klasaLabel.parentElement.querySelector("[class*=-control]");
      klasaControl.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
      await new Promise(r => setTimeout(r, 400));
      const opt = Array.from(document.querySelectorAll("[class*=-option]")).find(o => o.innerText.trim() === "${className}");
      if (!opt) return "Option ${className} not found among: " + Array.from(document.querySelectorAll("[class*=-option]")).map(o => o.innerText.trim()).join(", ");
      opt.click();
      await new Promise(r => setTimeout(r, 600));

      // 2. Zgjidh lëndën
      const lendaLabel = Array.from(document.querySelectorAll("div")).find(d => d.innerText.trim() === "Lënda" && d.children.length === 0);
      if (!lendaLabel) return "Lënda label not found";
      const lendaControl = lendaLabel.parentElement.querySelector("[class*=-control]");
      lendaControl.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
      await new Promise(r => setTimeout(r, 400));
      const subOpts = Array.from(document.querySelectorAll("[class*=-option]")).map(o => o.innerText.trim());
      const sub = Array.from(document.querySelectorAll("[class*=-option]"))[0];
      if (sub) sub.click();
      await new Promise(r => setTimeout(r, 1500));

      // 3. Tabela
      const table = document.querySelector("table");
      if (!table) return { klasa: "${className}", subOpts, error: "table not found" };

      const headers = Array.from(table.querySelectorAll("th")).map(th => th.innerText.replace(/\\n+/g, " ").trim());
      const rows = Array.from(table.querySelectorAll("tbody tr")).map(tr => {
        return Array.from(tr.querySelectorAll("td")).map(td => td.innerText.replace(/\\n+/g, " ").trim());
      });

      return {
        klasa: "${className}",
        lenda: lendaControl.innerText.trim(),
        subOpts,
        headers,
        rowCount: rows.length,
        rows
      };
    })();
  `);
  console.log(JSON.stringify(res, null, 2));
}

main().catch(console.error);

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
  const res = await cdpEval(`
    return (async () => {
      const klasaLabel = Array.from(document.querySelectorAll("div")).find(d => d.innerText.trim() === "Klasa" && d.children.length === 0);
      const klasaControl = klasaLabel.parentElement.querySelector("[class*=-control]");
      klasaControl.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
      await new Promise(r => setTimeout(r, 400));
      const classes = Array.from(document.querySelectorAll("[class*=-option]")).map(o => o.innerText.trim());
      klasaControl.dispatchEvent(new MouseEvent("mousedown", { bubbles: true })); // close
      return classes;
    })();
  `);
  console.log("Classes in 2025-2026:", res);
}

main().catch(console.error);

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
  const classes = ['1-A', '2-A', '3-A', '4-A', '5-A', '6-A', '7-A', '8-A', '9-A', '10-A', '11-A', '12-A'];
  const results = {};

  for (const c of classes) {
    const res = await cdpEval(`
      return (async () => {
        // Zgjidh klasen c
        const klasaLabel = Array.from(document.querySelectorAll("div")).find(d => d.innerText.trim() === "Klasa" && d.children.length === 0);
        const klasaControl = klasaLabel.parentElement.querySelector("[class*=-control]");
        klasaControl.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
        await new Promise(r => setTimeout(r, 400));
        const opt = Array.from(document.querySelectorAll("[class*=-option]")).find(o => o.innerText.trim() === "${c}");
        if (!opt) return { error: "Class ${c} option not found" };
        opt.click();
        await new Promise(r => setTimeout(r, 600));

        // Shiko lendet
        const lendaLabel = Array.from(document.querySelectorAll("div")).find(d => d.innerText.trim() === "Lënda" && d.children.length === 0);
        const lendaControl = lendaLabel.parentElement.querySelector("[class*=-control]");
        lendaControl.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
        await new Promise(r => setTimeout(r, 400));
        const subjects = Array.from(document.querySelectorAll("[class*=-option]")).map(o => o.innerText.trim());
        lendaControl.dispatchEvent(new MouseEvent("mousedown", { bubbles: true })); // close
        return { subjects };
      })();
    `);
    results[c] = res;
  }
  console.log(JSON.stringify(results, null, 2));
}

main().catch(console.error);

const http = require('http');
const fs = require('fs');
const path = require('path');

const WORKER_URL = 'http://127.0.0.1:8321';

function cdpEval(code) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({ code });
    const req = http.request(`${WORKER_URL}/eval`, {
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
          const json = JSON.parse(data);
          resolve(json.result);
        } catch (e) {
          reject(e);
        }
      });
    });
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

function takeScreenshot(filename) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({
      fullPage: true,
      filePath: filename
    });
    const req = http.request(`${WORKER_URL}/screenshot`, {
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
          const json = JSON.parse(data);
          if (json.status === 'ok') {
            resolve(path.join(__dirname, '..', filename));
          } else {
            reject(new Error(json.error));
          }
        } catch (e) {
          reject(e);
        }
      });
    });
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

async function selectView(className, subjectSearch, monthStr) {
  return await cdpEval(`(async () => {
    // 1. Zgjidh klasën
    const klasaLabel = Array.from(document.querySelectorAll("div")).find(d => d.innerText.trim() === "Klasa" && d.children.length === 0);
    if (!klasaLabel) return { error: "Klasa label not found" };
    const klasaControl = klasaLabel.parentElement.querySelector("[class*=-control]");
    if (!klasaControl) return { error: "Klasa control not found" };
    
    if (!klasaControl.innerText.includes("${className}")) {
      klasaControl.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
      await new Promise(r => setTimeout(r, 400));
      const opt = Array.from(document.querySelectorAll("[class*=-option]")).find(o => o.innerText.trim() === "${className}");
      if (!opt) return { error: "Option ${className} not found" };
      opt.click();
      await new Promise(r => setTimeout(r, 600));
    }

    // 2. Zgjidh lëndën
    const lendaLabel = Array.from(document.querySelectorAll("div")).find(d => d.innerText.trim() === "Lënda" && d.children.length === 0);
    if (!lendaLabel) return { error: "Lënda label not found" };
    const lendaControl = lendaLabel.parentElement.querySelector("[class*=-control]");
    if (!lendaControl) return { error: "Lënda control not found" };

    if (!lendaControl.innerText.includes("${subjectSearch}")) {
      lendaControl.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
      await new Promise(r => setTimeout(r, 400));
      const opt = Array.from(document.querySelectorAll("[class*=-option]")).find(o => o.innerText.includes("${subjectSearch}"));
      if (!opt) return { error: "Subject ${subjectSearch} not found" };
      opt.click();
      await new Promise(r => setTimeout(r, 600));
    }

    // 3. Zgjidh muajin nëse duhet
    if ("${monthStr}") {
      const mp = document.getElementById("month-picker");
      if (mp && mp.value !== "${monthStr}") {
        mp.click();
        await new Promise(r => setTimeout(r, 300));
        const monthNum = parseInt("${monthStr}".split("/")[0], 10);
        const mClass = ".react-datepicker__month-" + (monthNum - 1);
        const targetMonth = document.querySelector(mClass);
        if (targetMonth) {
          targetMonth.click();
          await new Promise(r => setTimeout(r, 400));
        }
      }
    }

    // 4. Kliko te Tabi Temat
    const topicsTab = document.getElementById("topics");
    if (topicsTab) {
      topicsTab.click();
      await new Promise(r => setTimeout(r, 700));
    }

    // 5. Zhblloko lartësinë për screenshot të plotë (unclamp overflow)
    const sc = document.querySelector(".overflow-y-auto");
    if (sc) {
      sc.style.height = "auto";
      sc.style.minHeight = sc.scrollHeight + "px";
      sc.style.overflow = "visible";
    }
    const root = document.querySelector("#root");
    if (root) {
      root.style.height = "auto";
      root.style.minHeight = "100%";
      root.style.overflow = "visible";
    }
    document.body.style.height = "auto";
    document.body.style.overflow = "visible";
    document.documentElement.style.height = "auto";
    document.documentElement.style.overflow = "visible";
    window.scrollTo(0, 0);

    const rows = Array.from(document.querySelectorAll("tbody tr")).map(tr => tr.innerText.replace(/\\n+/g, ' | ').trim());
    return {
      success: true,
      klasa: klasaControl.innerText.trim(),
      lenda: lendaControl.innerText.trim(),
      month: document.getElementById("month-picker")?.value,
      rowCount: rows.length,
      sampleRows: rows.slice(0, 5)
    };
  })()`);
}

async function main() {
  const className = process.argv[2] || '1-A';
  const subjectSearch = process.argv[3] || 'Gjuhë angleze';
  const monthStr = process.argv[4] || '10/2026';
  const outFile = process.argv[5] || `screenshots/temat_${className.replace(/\s+/g, '_')}_${monthStr.replace('/', '_')}.png`;

  console.log(`Zgjedhje: Klasa '${className}', Lënda '${subjectSearch}', Muaji '${monthStr}'...`);
  const viewRes = await selectView(className, subjectSearch, monthStr);
  console.log('Rezultati i zgjedhjes:', JSON.stringify(viewRes, null, 2));

  await new Promise(r => setTimeout(r, 1500));

  console.log(`Duke kapur screenshot në ${outFile}...`);
  const dest = await takeScreenshot(outFile);
  console.log(`✓ Screenshot u ruajt me sukses: ${dest}`);
}

main().catch(err => {
  console.error('Gabim:', err);
  process.exit(1);
});

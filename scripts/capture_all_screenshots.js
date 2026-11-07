const http = require('http');
const path = require('path');
const fs = require('fs');

const WORKER_URL = 'http://127.0.0.1:8321';
const BRAIN_DIR = '/Users/adalenv/.gemini/antigravity/brain/084d2ab7-9baf-4eb5-8bfc-ac2804000dbc';

const CLASSES = [
  { className: '1-A', subject: 'Gjuhë angleze' },
  { className: '2-A', subject: 'Gjuhë angleze' },
  { className: '3-A', subject: 'Gjuhë angleze' },
  { className: '4-A', subject: 'Gjuhë angleze' },
  { className: '5-A', subject: 'Gjuhë angleze' },
  { className: '6-A', subject: 'Edukim fizik' },
  { className: '7-A', subject: 'Edukim fizik' },
  { className: '8-A', subject: 'Edukim fizik' },
  { className: '9-A', subject: 'Edukim fizik' },
  { className: '11-A', subject: 'Edukim fizik' },
  { className: '12-A', subject: 'Edukim fizik' }
];

const MONTHS = [
  { monthStr: '09/2026', label: 'shtator' },
  { monthStr: '10/2026', label: 'tetor' }
];

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
          resolve(JSON.parse(data).result);
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
      rowCount: rows.length
    };
  })()`);
}

async function main() {
  console.log(`====================================================`);
  console.log(`MARRJA E SCREENSHOT-EVE ME FAQE TE PLOTE: SHTATOR & TETOR`);
  console.log(`====================================================`);

  const screenshotsDir = path.join(__dirname, '../screenshots');
  fs.mkdirSync(screenshotsDir, { recursive: true });

  const summary = [];
  let totalScreenshots = 0;

  for (const m of MONTHS) {
    console.log(`\n================== MUAJI: ${m.label.toUpperCase()} (${m.monthStr}) ==================`);
    for (let i = 0; i < CLASSES.length; i++) {
      const item = CLASSES[i];
      const filename = `temat_${item.className}_${m.label}_2026.png`;
      const outFile = `screenshots/${filename}`;
      console.log(`[${i + 1}/${CLASSES.length}] Zgjedhje: Klasa '${item.className}' - '${item.subject}' (${m.monthStr})...`);

      try {
        const res = await selectView(item.className, item.subject, m.monthStr);
        await new Promise(r => setTimeout(r, 1200));
        const absPath = await takeScreenshot(outFile);

        // Copy also to brain directory
        try {
          fs.copyFileSync(absPath, path.join(BRAIN_DIR, filename));
        } catch (_) {}

        console.log(`  ✓ U ruajt: ${outFile} (${res.rowCount} tema)`);
        summary.push({
          muaji: m.label,
          klasa: item.className,
          lenda: item.subject,
          rowCount: res.rowCount,
          status: 'OK',
          file: filename
        });
        totalScreenshots++;
      } catch (err) {
        console.error(`  ❌ Gabim te ${item.className} (${m.monthStr}):`, err.message);
        summary.push({
          muaji: m.label,
          klasa: item.className,
          lenda: item.subject,
          status: 'ERROR',
          error: err.message
        });
      }
      await new Promise(r => setTimeout(r, 500));
    }
  }

  console.log('\n================ PËRMBLEDHJE PËRFUNDIMTARE ================');
  console.table(summary);
  console.log(`\n🎉 Gjithsej u shkrepën dhe u ruajtën me sukses ${totalScreenshots} foto të plota në dosjen 'screenshots/'!`);
}

main().catch(console.error);

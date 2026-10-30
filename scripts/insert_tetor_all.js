const fs = require('fs');
const http = require('http');

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

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function selectClassAndSubject(className, subjectSearch) {
  return await cdpEval(`(async () => {
    // 1. Zgjidh klasën
    const klasaLabel = Array.from(document.querySelectorAll("div")).find(d => d.innerText.trim() === "Klasa" && d.children.length === 0);
    if (!klasaLabel) return { error: "Klasa label not found" };
    const klasaControl = klasaLabel.parentElement.querySelector("[class*=-control]");
    if (!klasaControl) return { error: "Klasa control not found" };
    
    // Check if already selected
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

    // 3. Sigurohu qe muaji eshte 10/2026
    const mp = document.getElementById("month-picker");
    if (mp && mp.value !== "10/2026") {
      mp.click();
      await new Promise(r => setTimeout(r, 300));
      const tet = document.querySelector(".react-datepicker__month-9");
      if (tet) tet.click();
      await new Promise(r => setTimeout(r, 400));
    }

    // 4. Kliko te Tabi Temat
    const topicsTab = document.getElementById("topics");
    if (topicsTab) {
      topicsTab.click();
      await new Promise(r => setTimeout(r, 500));
    }

    // Lexo rreshtat ekzistuese te tabeles
    const existingRows = Array.from(document.querySelectorAll("tbody tr")).map(tr => tr.innerText.trim());
    return {
      success: true,
      klasa: klasaControl.innerText.trim(),
      lenda: lendaControl.innerText.trim(),
      month: mp ? mp.value : "",
      existingRows
    };
  })()`);
}

async function insertSingleTopic(dateIso, title) {
  return await cdpEval(`(async () => {
    function setVal(el, val) {
      const proto = Object.getPrototypeOf(el);
      const desc = Object.getOwnPropertyDescriptor(proto, "value");
      if (desc && desc.set) {
        desc.set.call(el, val);
      } else {
        el.value = val;
      }
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
    }

    // 1. Kliko Shto teme
    const addBtn = document.getElementById("add-topic");
    if (!addBtn) return { error: "Butoni add-topic nuk u gjet" };
    addBtn.click();
    await new Promise(r => setTimeout(r, 350));

    // 2. Ploteso fushat ne modal
    const modal = document.getElementById("add-modal");
    if (!modal) return { error: "Modali add-modal nuk u hap" };

    const dateInput = modal.querySelector("input[type=date]");
    const nameInput = modal.querySelector("#name");
    const confirmBtn = modal.querySelector("#add-modal-button");

    if (!dateInput || !nameInput || !confirmBtn) {
      return { error: "Fushat brenda modalit mungojne" };
    }

    setVal(dateInput, "${dateIso}");
    setVal(nameInput, ${JSON.stringify(title)});
    await new Promise(r => setTimeout(r, 200));

    // 3. Konfirmo
    confirmBtn.click();
    await new Promise(r => setTimeout(r, 800));

    // 4. Verifiko mbylljen e modalit dhe shtimin
    const modalStillOpen = !!document.getElementById("add-modal");
    return { success: !modalStillOpen, modalStillOpen };
  })()`);
}

async function run() {
  const data = JSON.parse(fs.readFileSync('temat_tetor_2026_klasat.json', 'utf8'));
  const classOrder = ['1-A', '2-A', '3-A', '4-A', '5-A', '6-A', '7-A', '8-A', '9-A', '11-A', '12-A'];

  console.log('====================================================');
  console.log(' Nisja e Hedhjes së Temave për Tetorin 2026 në SMIP');
  console.log(' Klasat në radhë:', classOrder.join(', '));
  console.log('====================================================\n');

  const summary = {};

  for (const className of classOrder) {
    const classInfo = data.klasat[className];
    if (!classInfo) {
      console.log(`⚠️ Nuk ka të dhëna për klasën ${className}`);
      continue;
    }

    const subjectSearch = className.startsWith('1-') || className.startsWith('2-') || className.startsWith('3-') || className.startsWith('4-') || className.startsWith('5-')
      ? 'Gjuhë angleze'
      : 'Edukim fizik';

    console.log(`\n📌 Duke hapur Klasën ${className} (${subjectSearch}) për Tetor 2026...`);
    const selectRes = await selectClassAndSubject(className, subjectSearch);
    if (!selectRes || selectRes.error) {
      console.error(`❌ Gabim në përzgjedhje për ${className}:`, selectRes ? selectRes.error : 'No response');
      summary[className] = { status: 'error', error: selectRes ? selectRes.error : 'No response' };
      continue;
    }

    console.log(`   ✓ U zgjodh: ${selectRes.klasa} | ${selectRes.lenda} | Muaji: ${selectRes.month}`);
    console.log(`   Rreshta ekzistues në tabelë: ${selectRes.existingRows ? selectRes.existingRows.length : 0}`);

    const existingText = (selectRes.existingRows || []).join(' ');
    let insertedCount = 0;
    let skippedCount = 0;

    for (let i = 0; i < classInfo.oret.length; i++) {
      const ora = classInfo.oret[i];
      // Verifiko nëse tema është hedhur tashmë
      if (existingText.includes(ora.tema)) {
        console.log(`   ⏭️ [Ora ${i + 1}/${classInfo.oret.length}] ${ora.data_iso} - "${ora.tema}" (Ekziston tashmë, kapërcyer)`);
        skippedCount++;
        continue;
      }

      console.log(`   ➕ [Ora ${i + 1}/${classInfo.oret.length}] ${ora.data_iso} - "${ora.tema}"...`);
      const res = await insertSingleTopic(ora.data_iso, ora.tema);
      if (res && res.success) {
        insertedCount++;
        console.log(`      ✓ U shtua me sukses!`);
      } else {
        console.error(`      ❌ Gabim gjatë shtimit:`, res);
      }
      await sleep(300);
    }

    summary[className] = {
      total: classInfo.oret.length,
      inserted: insertedCount,
      skipped: skippedCount,
      status: 'ok'
    };
    console.log(`🏁 Përfundoi Klasa ${className}: ${insertedCount} të shtuara, ${skippedCount} ekzistuese nga ${classInfo.oret.length} orë.`);
  }

  console.log('\n====================================================');
  console.log(' PËRMBLEDHJA PËRFUNDIMTARE E HEDHJES SË TEMAVE (TETOR 2026)');
  console.log('====================================================');
  console.table(summary);
}

run().catch(err => {
  console.error('Fatal error:', err);
});

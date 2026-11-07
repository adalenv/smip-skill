const http = require('http');
const fs = require('fs');
const path = require('path');

const WORKER_URL = 'http://127.0.0.1:8321';

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

async function getStudentsForClass(className, subjectSearch) {
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
      await new Promise(r => setTimeout(r, 800));
    }

    // 3. Kliko te Tabi Regjistri
    const regTab = document.getElementById("registry");
    if (regTab) {
      regTab.click();
      await new Promise(r => setTimeout(r, 800));
    }

    // 4. Lexo rreshtat e nxënësve nga tabela
    const rows = Array.from(document.querySelectorAll("tbody tr")).map(tr => {
      const td = tr.querySelector("td");
      return td ? td.innerText.trim() : tr.innerText.trim();
    }).filter(text => text.length > 0);

    return {
      success: true,
      klasa: klasaControl.innerText.trim(),
      lenda: lendaControl.innerText.trim(),
      rows
    };
  })()`);
}

async function main() {
  console.log('====================================================');
  console.log('MARRJA E LISTËS SË NXËNËSVE PËR ÇDO KLASË NË SMIP');
  console.log('====================================================');

  const resultByClass = {};
  let totalNxenes = 0;

  for (let i = 0; i < CLASSES.length; i++) {
    const item = CLASSES[i];
    console.log(`[${i + 1}/${CLASSES.length}] Duke marrë nxënësit për klasën ${item.className} (${item.subject})...`);

    const res = await getStudentsForClass(item.className, item.subject);
    if (!res || !res.success) {
      console.error(`  ❌ Gabim:`, res ? res.error : 'Përgjigje e pavlefshme');
      continue;
    }

    // Parsim i listës së nxënësve (p.sh. "1. Altea Hoti")
    const nxenesit = res.rows.map(rowText => {
      const match = rowText.match(/^(\d+)[\.\s]+(.+)$/);
      if (match) {
        const nr = parseInt(match[1], 10);
        const emriPlote = match[2].trim();
        const parts = emriPlote.split(/\s+/);
        const emri = parts[0];
        const mbiemri = parts.slice(1).join(' ');
        return { nr, emri_plote: emriPlote, emri, mbiemri };
      }
      return { nr: null, emri_plote: rowText, emri: rowText, mbiemri: '' };
    });

    resultByClass[item.className] = {
      klasa: item.className,
      lenda: res.lenda,
      numri_nxenesve: nxenesit.length,
      nxenesit
    };

    totalNxenes += nxenesit.length;
    console.log(`  ✓ Klasa ${item.className}: ${nxenesit.length} nxënës gjetur.`);
    nxenesit.forEach(n => console.log(`     ${n.nr ? n.nr + '.' : '-'} ${n.emri_plote}`));

    await new Promise(r => setTimeout(r, 500));
  }

  // 1. Ruaj JSON
  const jsonPath = path.join(__dirname, '../nxenesit_sipas_klasave.json');
  fs.writeFileSync(jsonPath, JSON.stringify({
    shkolla: 'SHKOLLA E BASHKUAR "NIKOLLE KAÇORI", LURË, DIBËR',
    mesuesi: 'Zojë Vladi',
    viti_shkollor: '2026-2027',
    data_ekstraktimit: new Date().toISOString(),
    gjithsej_nxenes: totalNxenes,
    klasat: resultByClass
  }, null, 2), 'utf8');

  // 2. Ruaj Markdown
  const mdPath = path.join(__dirname, '../nxenesit_sipas_klasave.md');
  let mdContent = `# Lista e Nxënësve sipas Klasave\n\n`;
  mdContent += `**Shkolla:** SHKOLLA E BASHKUAR "NIKOLLE KAÇORI", LURË, DIBËR  \n`;
  mdContent += `**Mësuesi:** Zojë Vladi  \n`;
  mdContent += `**Viti Shkollor:** 2026-2027  \n`;
  mdContent += `**Gjithsej Nxënës:** ${totalNxenes}  \n\n`;
  mdContent += `---\n\n`;

  for (const [klasa, data] of Object.entries(resultByClass)) {
    mdContent += `## Klasa ${klasa} (${data.lenda})\n`;
    mdContent += `**Numri i nxënësve:** ${data.numri_nxenesve}\n\n`;
    if (data.numri_nxenesve === 0) {
      mdContent += `*Nuk ka nxënës të regjistruar.*\n\n`;
    } else {
      mdContent += `| Nr | Emri dhe Mbiemri | Emri | Mbiemri |\n`;
      mdContent += `| :-: | :--- | :--- | :--- |\n`;
      data.nxenesit.forEach(n => {
        mdContent += `| ${n.nr || '-'} | **${n.emri_plote}** | ${n.emri} | ${n.mbiemri} |\n`;
      });
      mdContent += `\n`;
    }
  }

  fs.writeFileSync(mdPath, mdContent, 'utf8');

  console.log('\n================ PËRMBLEDHJE PËRFUNDIMTARE ================');
  console.log(`✓ Gjithsej klasa të skanuara: ${Object.keys(resultByClass).length}`);
  console.log(`✓ Gjithsej nxënës: ${totalNxenes}`);
  console.log(`✓ Skedari JSON: ${jsonPath}`);
  console.log(`✓ Skedari Markdown: ${mdPath}`);
}

main().catch(err => {
  console.error('Gabim fatal:', err);
  process.exit(1);
});

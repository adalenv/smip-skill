const fs = require('fs');

const rawData = JSON.parse(fs.readFileSync('raw_grades_2025_2026.json', 'utf8'));
const currentStudentsData = JSON.parse(fs.readFileSync('nxenesit_sipas_klasave.json', 'utf8'));

const statusKeywords = [
  'Ka përfunduar',
  'Në progres',
  'Përjashtuar',
  'Dalë nga detyrimi shkollor',
  'Ka ikur jashtë shtetit'
];

function parseStudentCell(cellText) {
  let name = cellText.trim();
  let status = 'Aktive';
  for (const sk of statusKeywords) {
    if (name.includes(sk)) {
      status = sk;
      name = name.replace(sk, '').trim();
      break;
    }
  }
  return { name, status };
}

// 1. Struktura e regjistrit të plotë 2025-2026
const registri2025 = {};
const all2025Students = [];

for (const [klasa, info] of Object.entries(rawData)) {
  const students = [];
  for (const row of info.rows) {
    const nr = row[0];
    const { name, status } = parseStudentCell(row[1] || '');
    const p1 = row[2] || '-';
    const p2 = row[3] || '-';
    const p3 = row[4] || '-';
    const vj = row[5] || '-';
    const finalGrade = row[6] || '-';

    const stObj = {
      nr,
      emri: name,
      statusi: status,
      klasa_2025_2026: klasa,
      lenda: info.lenda,
      periudha_1: p1,
      periudha_2: p2,
      periudha_3: p3,
      vleresimi_vjetor: vj,
      nota_perfundimtare: finalGrade
    };
    students.push(stObj);
    all2025Students.push(stObj);
  }
  registri2025[klasa] = {
    klasa,
    lenda: info.lenda,
    nxenesit_total: students.length,
    nxenesit: students
  };
}

// 2. Përputhja me 48 nxënësit aktualë (2026-2027)
const matchedCurrentStudents = [];

for (const [klasaKey, group] of Object.entries(currentStudentsData.klasat)) {
  const currentClass = group.klasa;
  const currentSubject = group.lenda;
  
  for (const curSt of group.nxenesit) {
    const curNameNorm = (curSt.emri_plote || `${curSt.emri} ${curSt.mbiemri}`).toLowerCase().trim();
    
    // Gjej tek të dhënat e 2025-2026
    const match = all2025Students.find(s => {
      const sNameNorm = s.emri.toLowerCase().trim();
      return sNameNorm === curNameNorm || sNameNorm.includes(curNameNorm) || curNameNorm.includes(sNameNorm);
    });

    const displayName = curSt.emri_plote || `${curSt.emri} ${curSt.mbiemri}`;

    if (match) {
      matchedCurrentStudents.push({
        emri: displayName,
        klasa_aktuale_2026_2027: currentClass,
        lenda_aktuale: currentSubject,
        klasa_vitit_kaluar_2025_2026: match.klasa_2025_2026,
        lenda_vitit_kaluar: match.lenda,
        statusi_vitit_kaluar: match.statusi,
        periudha_1: match.periudha_1,
        periudha_2: match.periudha_2,
        periudha_3: match.periudha_3,
        vleresimi_vjetor: match.vleresimi_vjetor,
        nota_perfundimtare: match.nota_perfundimtare
      });
    } else {
      matchedCurrentStudents.push({
        emri: displayName,
        klasa_aktuale_2026_2027: currentClass,
        lenda_aktuale: currentSubject,
        klasa_vitit_kaluar_2025_2026: currentClass === '1-A' ? 'Parashkollor' : 'Nuk figuron',
        lenda_vitit_kaluar: '-',
        statusi_vitit_kaluar: currentClass === '1-A' ? 'I regjistruar rishtas në klasë të parë' : 'Nuk ka të dhëna',
        periudha_1: '-',
        periudha_2: '-',
        periudha_3: '-',
        vleresimi_vjetor: '-',
        nota_perfundimtare: '-'
      });
    }
  }
}

// Ruaj JSON
const outputJSON = {
  viti_shkollor_referues: '2025-2026',
  data_gjenerimit: new Date().toISOString(),
  nxenesit_aktuale_me_notat_e_vitit_kaluar: matchedCurrentStudents,
  regjistri_i_plote_sipas_klasave_2025_2026: registri2025
};

fs.writeFileSync('notat_vitit_kaluar_2025_2026.json', JSON.stringify(outputJSON, null, 2));

// Ndërto Markdown Report
let md = `# Regjistri i Notave të Vitit të Kaluar (2025-2026) - SMIP\n\n`;
md += `Ky dokument përmban notat e vitit shkollor **2025-2026** të nxënësve sipas lëndëve të mësuara në portalin zyrtar SMIP.\n\n`;
md += `**Përmbajtja:**\n`;
md += `1. [Notat e vitit të kaluar për 48 nxënësit aktualë (2026-2027)](#1-notat-e-vitit-të-kaluar-për-nxënësit-aktualë-2026-2027)\n`;
md += `2. [Regjistri i plotë i notave sipas klasave për vitin shkollor 2025-2026](#2-regjistri-i-plotë-i-notave-për-çdo-klasë-2025-2026)\n\n`;
md += `---\n\n`;

md += `## 1. Notat e vitit të kaluar për nxënësit aktualë (2026-2027)\n\n`;
md += `Në këtë tabelë paraqitet secili nga 48 nxënësit e klasave tuaja aktuale, klasa ku ndodhej vitin e kaluar (2025-2026), lënda dhe vlerësimet përkatëse (Periudha 1, Periudha 2, Periudha 3, Vlerësimi vjetor dhe Nota përfundimtare).\n\n`;

let lastClass = '';
let count = 0;
for (const s of matchedCurrentStudents) {
  if (s.klasa_aktuale_2026_2027 !== lastClass) {
    lastClass = s.klasa_aktuale_2026_2027;
    count = 0;
    md += `\n### Klasa Aktuale ${lastClass} (2026-2027) - Lënda: ${s.lenda_aktuale.replace(' (KURRIKULA BËRTHAMË)', '')}\n\n`;
    md += `| Nr | Emri Mbiemri | Klasa (2025-2026) | Lënda (2025-2026) | Periudha 1 | Periudha 2 | Periudha 3 | Vlerësimi Vjetor | Nota Përfundimtare |\n`;
    md += `|:---:|:---|:---:|:---|:---:|:---:|:---:|:---:|:---:|\n`;
  }
  count++;
  md += `| ${count}. | **${s.emri}** | ${s.klasa_vitit_kaluar_2025_2026} | ${s.lenda_vitit_kaluar.replace(' (KURRIKULA BËRTHAMË)', '')} | ${s.periudha_1} | ${s.periudha_2} | ${s.periudha_3} | ${s.vleresimi_vjetor} | **${s.nota_perfundimtare}** |\n`;
}

md += `\n\n---\n\n`;
md += `## 2. Regjistri i plotë i notave për çdo klasë (2025-2026)\n\n`;
md += `Këtu paraqitet regjistri origjinal i notave për secilën nga 12 klasat e vitit shkollor 2025-2026 të eksportuara direkt nga SMIP:\n\n`;

for (const [klasa, info] of Object.entries(registri2025)) {
  md += `### Klasa ${klasa} (2025-2026) — ${info.lenda.replace(' (KURRIKULA BËRTHAMË)', '')}\n\n`;
  md += `*Gjithsej nxënës:* **${info.nxenesit_total}**\n\n`;
  md += `| Nr | Nxënësi | Statusi | Periudha 1 | Periudha 2 | Periudha 3 | Vlerësimi Vjetor | Nota Përfundimtare |\n`;
  md += `|:---:|:---|:---:|:---:|:---:|:---:|:---:|:---:|\n`;
  for (const s of info.nxenesit) {
    md += `| ${s.nr} | **${s.emri}** | ${s.statusi} | ${s.periudha_1} | ${s.periudha_2} | ${s.periudha_3} | ${s.vleresimi_vjetor} | **${s.nota_perfundimtare}** |\n`;
  }
  md += `\n`;
}

fs.writeFileSync('notat_vitit_kaluar_2025_2026.md', md);
console.log('Successfully regenerated notat_vitit_kaluar_2025_2026.md with clean numbering');

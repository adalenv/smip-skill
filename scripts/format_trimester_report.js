const fs = require('fs');

const rawTrimesterData = JSON.parse(fs.readFileSync('raw_trimester_grades_2025_2026.json', 'utf8'));
const currentStudentsData = JSON.parse(fs.readFileSync('nxenesit_sipas_klasave.json', 'utf8'));

// Pastrim emri
function cleanName(raw) {
  return raw.replace(/^\d+\.\s*/, '').replace(/(Ka përfunduar|Në progres|Përjashtuar|Dalë nga detyrimi shkollor|Ka ikur jashtë shtetit)/g, '').trim();
}

// Analizo rreshtin e nxënësit në një periudhë
function parsePeriodRow(row, headers) {
  const studentRaw = row[0];
  const name = cleanName(studentRaw);
  const grades = [];
  const absences = [];

  for (let i = 1; i < row.length; i++) {
    const val = row[i].trim();
    const date = headers[i];
    if (!val) continue;

    if (val === 'M') {
      absences.push({ date });
    } else {
      grades.push({ date, grade: val });
    }
  }

  return {
    studentRaw,
    name,
    grades,
    absences,
    gradeValues: grades.map(g => g.grade),
    totalGrades: grades.length,
    totalAbsences: absences.length
  };
}

// 1. Ndërto strukturën e plotë të klasave për 2025-2026
const structuredClasses = {};
const allStudentsTrimesterMap = {}; // nameNorm -> { klasa, lenda, p1, p2, p3 }

for (const [klasa, perMap] of Object.entries(rawTrimesterData)) {
  structuredClasses[klasa] = {
    klasa,
    periudhat: {}
  };

  for (const [pName, pData] of Object.entries(perMap)) {
    if (!pData.rows) continue;
    const headers = pData.headers;
    const lenda = pData.lenda;

    const parsedStudents = pData.rows.map(r => parsePeriodRow(r, headers));

    structuredClasses[klasa].periudhat[pName] = {
      lenda,
      total_data: headers.length - 1,
      nxenesit: parsedStudents
    };

    // Populloj map-in
    for (const ps of parsedStudents) {
      const norm = ps.name.toLowerCase().trim();
      if (!allStudentsTrimesterMap[norm]) {
        allStudentsTrimesterMap[norm] = {
          emri: ps.name,
          klasa_2025_2026: klasa,
          lenda,
          p1: null,
          p2: null,
          p3: null
        };
      }
      if (pName === 'Periudha 1') allStudentsTrimesterMap[norm].p1 = ps;
      if (pName === 'Periudha 2') allStudentsTrimesterMap[norm].p2 = ps;
      if (pName === 'Periudha 3') allStudentsTrimesterMap[norm].p3 = ps;
    }
  }
}

// 2. Lidh me 48 nxënësit aktualë
const currentMatched = [];

for (const [klasaKey, group] of Object.entries(currentStudentsData.klasat)) {
  const currentClass = group.klasa;
  const currentSubject = group.lenda;

  for (const curSt of group.nxenesit) {
    const curName = curSt.emri_plote || `${curSt.emri} ${curSt.mbiemri}`;
    const curNorm = curName.toLowerCase().trim();

    // Gjej tek allStudentsTrimesterMap
    let matchedKey = Object.keys(allStudentsTrimesterMap).find(k => k === curNorm || k.includes(curNorm) || curNorm.includes(k));
    const match = matchedKey ? allStudentsTrimesterMap[matchedKey] : null;

    currentMatched.push({
      emri: curName,
      klasa_aktuale_2026_2027: currentClass,
      lenda_aktuale: currentSubject,
      klasa_vitit_kaluar_2025_2026: match ? match.klasa_2025_2026 : (currentClass === '1-A' ? 'Parashkollor' : '-'),
      periudha_1: match && match.p1 ? {
        notat: match.p1.gradeValues,
        detaje_notat: match.p1.grades,
        mungesa: match.p1.totalAbsences
      } : null,
      periudha_2: match && match.p2 ? {
        notat: match.p2.gradeValues,
        detaje_notat: match.p2.grades,
        mungesa: match.p2.totalAbsences
      } : null,
      periudha_3: match && match.p3 ? {
        notat: match.p3.gradeValues,
        detaje_notat: match.p3.grades,
        mungesa: match.p3.totalAbsences
      } : null
    });
  }
}

// Ruaj JSON
const finalJSON = {
  pershkrimi: 'Notat dhe mungesat nga Regjistri i Periudhës (trimester-register) në SMIP për vitin 2025-2026',
  viti_shkollor: '2025-2026',
  data_ekstraktimit: new Date().toISOString(),
  nxenesit_aktuale_regjistri_periudhes: currentMatched,
  regjistri_i_plote_sipas_klasave: structuredClasses
};

fs.writeFileSync('notat_regjistri_periudhes_2025_2026.json', JSON.stringify(finalJSON, null, 2));

// 3. Gjenero Markdown Report
let md = `# Regjistri i Periudhës (Notat Ditore dhe Mungesat) - Viti Shkollor 2025-2026\n\n`;
md += `Ky dokument pasqyron notat ditore, vlerësimet e vazhdueshme dhe mungesat nga nën-faqja **"Regjistri i periudhës"** në SMIP për secilën nga 3 periudhat e vitit shkollor **2025-2026**.\n\n`;
md += `> **Shënim:** Në ciklin fillor të ulët (Klasat 1-A, 2-A, 3-A), vlerësimi bëhet me nivele arritjeje (AK, ANP, AShK) në fund të periudhës në regjistrin vjetor, prandaj kolonat ditore në këtë regjistër nuk përmbajnë nota numerike.\n\n`;

md += `## Përmbajtja\n`;
md += `1. [Pasqyra për 48 nxënësit tuaj aktualë (2026-2027)](#1-pasqyra-për-nxënësit-aktualë-2026-2027)\n`;
md += `2. [Regjistri i plotë sipas klasave dhe periudhave (2025-2026)](#2-regjistri-i-plotë-i-periudhave-sipas-klasave-2025-2026)\n\n`;
md += `---\n\n`;

md += `## 1. Pasqyra për nxënësit aktualë (2026-2027)\n\n`;

let lastClass = '';
let count = 0;
for (const s of currentMatched) {
  if (s.klasa_aktuale_2026_2027 !== lastClass) {
    lastClass = s.klasa_aktuale_2026_2027;
    count = 0;
    md += `\n### Klasa Aktuale ${lastClass} (Lënda: ${s.lenda_aktuale.replace(' (KURRIKULA BËRTHAMË)', '')})\n\n`;
    md += `| Nr | Nxënësi | Klasa (2025-2026) | Periudha 1 (Notat / Mungesat) | Periudha 2 (Notat / Mungesat) | Periudha 3 (Notat / Mungesat) |\n`;
    md += `|:---:|:---|:---:|:---|:---|:---|\n`;
  }
  count++;

  const formatP = (p) => {
    if (!p) return '-';
    const notesStr = p.notat.length > 0 ? `**Notat:** [${p.notat.join(', ')}]` : 'Pa nota numerike';
    const absStr = p.mungesa > 0 ? ` (${p.mungesa} mungesa)` : '';
    return `${notesStr}${absStr}`;
  };

  md += `| ${count}. | **${s.emri}** | ${s.klasa_vitit_kaluar_2025_2026} | ${formatP(s.periudha_1)} | ${formatP(s.periudha_2)} | ${formatP(s.periudha_3)} |\n`;
}

md += `\n\n---\n\n`;
md += `## 2. Regjistri i plotë i periudhave sipas klasave (2025-2026)\n\n`;

for (const [klasa, info] of Object.entries(structuredClasses)) {
  md += `### Klasa ${klasa} (2025-2026)\n\n`;
  for (const [pName, pInfo] of Object.entries(info.periudhat)) {
    md += `#### ${pName} — ${pInfo.lenda.replace(' (KURRIKULA BËRTHAMË)', '')} (${pInfo.total_data} orë/data)\n\n`;
    md += `| Nr | Nxënësi | Notat e marra (me datë) | Gjithsej Mungesa |\n`;
    md += `|:---:|:---|:---|:---:|\n`;

    let nrSt = 0;
    for (const st of pInfo.nxenesit) {
      nrSt++;
      const gradeDetails = st.grades.length > 0 
        ? st.grades.map(g => `\`${g.grade}\` (${g.date.split(' ')[0]})`).join(', ')
        : '*(Pa vlerësime numerike ditore)*';
      md += `| ${nrSt}. | **${st.name}** | ${gradeDetails} | ${st.totalAbsences} |\n`;
    }
    md += `\n`;
  }
  md += `---\n\n`;
}

fs.writeFileSync('notat_regjistri_periudhes_2025_2026.md', md);
console.log('Successfully written notat_regjistri_periudhes_2025_2026.json and notat_regjistri_periudhes_2025_2026.md');

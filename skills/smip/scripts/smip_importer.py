#!/usr/bin/env python3
"""
smip_importer.py - Inseruesi Automatik i Temave Ditore në SMIP (smip.al)
"""

import os
import sys
import json
import argparse
import time

def extract_topics_list(data, class_name=None):
    if isinstance(data, list):
        return data
    if isinstance(data, dict):
        if "klasat" in data:
            klasat = data["klasat"]
            if class_name and class_name in klasat:
                return klasat[class_name].get("oret", [])
            # Nëse nuk specifikohet ose nuk gjendet ekzaktësisht, kërko fuzzy
            for k, val in klasat.items():
                if class_name and (class_name.lower() in k.lower() or k.lower() in class_name.lower()):
                    return val.get("oret", [])
            # Nëse ka vetëm 1 klasë
            if len(klasat) == 1:
                return list(klasat.values())[0].get("oret", [])
        if "oret" in data:
            return data["oret"]
        if "topics" in data:
            return data["topics"]
    return []

def generate_browser_snippet(topics_file, class_name, subject_name, month_year):
    """
    Gjeneron një skript JavaScript që mësuesi mund ta ekzekutojë në konsolën e shfletuesit
    (DevTools Console) në faqen smip.al, ose që mund të injektohet përmes Playwright/Puppeteer.
    """
    with open(topics_file, 'r', encoding='utf-8') as f:
        raw_data = json.load(f)

    topics = extract_topics_list(raw_data, class_name)

    js_code = f"""// =====================================================================
// SMIP Auto-Importer Script
// Klasa: {class_name} | Lënda: {subject_name} | Muaji: {month_year}
// Gjithsej tema për inserim: {len(topics)}
// =====================================================================

(async function insertSmipTopics() {{
    const topics = {json.dumps(topics, ensure_ascii=False, indent=2)};
    
    console.log(`%c[SMIP BOT] Filloi inserimi i ${{topics.length}} temave...`, 'color: #10b981; font-weight: bold; font-size: 14px;');

    function sleep(ms) {{
        return new Promise(resolve => setTimeout(resolve, ms));
    }}

    async function addSingleTopic(item, index) {{
        console.log(`[%c${{index + 1}}/${{topics.length}}] Duke inseruar: ${{item.data}} - ${{item.tema}}`, 'color: #3b82f6;');
        
        // 1. Kliko butonin 'Shto temë'
        const addBtn = document.querySelector('#add-topic') || Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Shto temë'));
        if (!addBtn) {{
            console.error('Nuk u gjet butoni #add-topic! Sigurohuni që jeni në Regjistrin Ditor.');
            return false;
        }}
        addBtn.click();
        await sleep(500);

        // 2. Plotëso datën (#date)
        const dateInput = document.querySelector('#date') || document.querySelector('input[name="date"]');
        if (dateInput) {{
            dateInput.value = item.data;
            dateInput.dispatchEvent(new Event('input', {{ bubbles: true }}));
            dateInput.dispatchEvent(new Event('change', {{ bubbles: true }}));
        }}

        // 3. Plotëso titullin e temës (#name)
        const nameInput = document.querySelector('#name') || document.querySelector('input[name="name"]') || document.querySelector('textarea[name="name"]');
        if (nameInput) {{
            nameInput.value = item.tema;
            nameInput.dispatchEvent(new Event('input', {{ bubbles: true }}));
            nameInput.dispatchEvent(new Event('change', {{ bubbles: true }}));
        }}

        await sleep(300);

        // 4. Kliko Konfirmo / Shto në modal
        const modal = document.querySelector('#add-modal') || document.querySelector('.modal');
        const confirmBtn = modal ? Array.from(modal.querySelectorAll('button')).find(b => b.textContent.includes('Konfirmo') || b.textContent.includes('Shto') || b.type === 'submit') : null;
        
        if (confirmBtn) {{
            confirmBtn.click();
            await sleep(700);
            return true;
        }} else {{
            console.warn('Nuk u gjet butoni i konfirmimit në modal.');
            return false;
        }}
    }}

    let successCount = 0;
    for (let i = 0; i < topics.length; i++) {{
        const ok = await addSingleTopic(topics[i], i);
        if (ok) successCount++;
        await sleep(500);
    }}

    console.log(`%c[SMIP BOT] Përfundoi me sukses inserimi i ${{successCount}} nga ${{topics.length}} tema!`, 'color: #10b981; font-weight: bold; font-size: 16px;');
    console.log(`%cMos harroni të klikoni butonin e gjelbër "Ruaj Ndryshimet" (#bulk-save-grades) në fund të tabelës.`, 'color: #f59e0b; font-weight: bold;');
}})();
"""
    return js_code

def main():
    parser = argparse.ArgumentParser(description="Inseruesi i temave në portalin SMIP")
    parser.add_argument("--topics", required=True, help="Skedari JSON me temat e gjeneruara")
    parser.add_argument("--class-name", default="Klasa 6 - 8", help="Emri i klasës në SMIP")
    parser.add_argument("--subject-name", default="Edukim Fizik", help="Emri i lëndës në SMIP")
    parser.add_argument("--month", default="10/2026", help="Muaji (format MM/YYYY)")
    parser.add_argument("--output-snippet", default="inject_smip.js", help="Skedari JS i gjeneruar për injektim në shfletues")
    parser.add_argument("--dry-run", action="store_true", help="Simulim pa kryer veprime në server")
    
    args = parser.parse_args()

    if not os.path.exists(args.topics):
        print(f"Gabim: Skedari '{args.topics}' nuk u gjet!", file=sys.stderr)
        sys.exit(1)

    with open(args.topics, 'r', encoding='utf-8') as f:
        raw_data = json.load(f)

    topics = extract_topics_list(raw_data, args.class_name)

    print("=====================================================")
    print("           SMIP TOPIC IMPORTER                      ")
    print("=====================================================")
    print(f"Klasa:    {args.class_name}")
    print(f"Lënda:    {args.subject_name}")
    print(f"Periudha: {args.month}")
    print(f"Gjithsej: {len(topics)} tema")
    print("-----------------------------------------------------")

    for t in topics[:5]:
        print(f"  • {t.get('data')}: {t.get('tema')}")
    if len(topics) > 5:
        print(f"  ... dhe {len(topics) - 5} tema të tjera.")
    print("-----------------------------------------------------")

    snippet = generate_browser_snippet(args.topics, args.class_name, args.subject_name, args.month)
    with open(args.output_snippet, 'w', encoding='utf-8') as f:
        f.write(snippet)

    print(f"✓ U gjenerua skripti i shpejtë i injektimit: {args.output_snippet}")
    print("\nUdhëzime përdorimi:")
    print("1. Hapni https://smip.al/teacher/registry?tab=daily-register në shfletues (Chrome/Firefox/Safari).")
    print(f"2. Zgjidhni Klasën '{args.class_name}', Lëndën '{args.subject_name}' dhe Muajin '{args.month}'.")
    print(f"3. Hapni DevTools Console (F12 ose Cmd+Option+I), ngjitni përmbajtjen e '{args.output_snippet}' dhe shtypni Enter.")
    print("4. Temat do të shtohen njëra pas tjetrës automatikisht!")

if __name__ == "__main__":
    main()

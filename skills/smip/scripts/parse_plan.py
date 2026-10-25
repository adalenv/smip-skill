#!/usr/bin/env python3
"""
parse_plan.py - Analizuesi dhe Përgatitësi i Temave Mësimore për SMIP
"""

import os
import sys
import json
import re
import argparse
import datetime
import zipfile
import xml.etree.ElementTree as ET

def find_workspace_root():
    cur = os.path.abspath(__file__)
    for _ in range(10):
        cur = os.path.dirname(cur)
        if os.path.exists(os.path.join(cur, "smip_docs")) or os.path.exists(os.path.join(cur, "kalendari_pushimeve.json")):
            return cur
    return os.getcwd()

WORKSPACE_ROOT = find_workspace_root()

def get_calendar_path():
    in_docs = os.path.join(WORKSPACE_ROOT, "smip_docs", "kalendari_pushimeve.json")
    if os.path.exists(in_docs):
        return in_docs
    in_ref = os.path.join(WORKSPACE_ROOT, ".agents", "skills", "smip", "references", "kalendari_pushimeve.json")
    if os.path.exists(in_ref):
        return in_ref
    return in_docs

DEFAULT_CALENDAR_PATH = get_calendar_path()
DEFAULT_SCHEDULE_PATH = os.path.join(WORKSPACE_ROOT, "orari_mesimor.json")

WEEKDAYS_AL = {
    0: "E Hënë",
    1: "E Martë",
    2: "E Mërkurë",
    3: "E Enjte",
    4: "E Premte",
    5: "E Shtunë",
    6: "E Diel"
}

def load_holidays(cal_path=DEFAULT_CALENDAR_PATH):
    holidays = set()
    if not os.path.exists(cal_path):
        return holidays
    try:
        with open(cal_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
            # Festa zyrtare
            for f in data.get("festat_zyrtare_2026_2027", []):
                d = f.get("data")
                if d:
                    holidays.add(d)
            # Pushime periudhash
            for p in data.get("pushimet_dhe_periudhat", []):
                fillimi = p.get("fillimi")
                mbarimi = p.get("mbarimi")
                if fillimi and mbarimi:
                    d_start = datetime.datetime.strptime(fillimi, "%Y-%m-%d").date()
                    d_end = datetime.datetime.strptime(mbarimi, "%Y-%m-%d").date()
                    cur = d_start
                    while cur <= d_end:
                        holidays.add(cur.strftime("%Y-%m-%d"))
                        cur += datetime.timedelta(days=1)
    except Exception as e:
        print(f"Vërejtje gjatë leximit të kalendarit të festave: {e}", file=sys.stderr)
    return holidays

def extract_topics_from_docx(docx_path):
    ns = {'w': 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'}
    topics = []
    
    with zipfile.ZipFile(docx_path) as z:
        tree = ET.fromstring(z.read('word/document.xml'))
        tables = tree.findall('.//w:tbl', ns)
        
        # 1. Kontrollo tabelat me kolona standarde
        for tbl in tables:
            rows = tbl.findall('.//w:tr', ns)
            if not rows:
                continue
            
            header_cells = [' '.join(''.join(c.itertext()).split()).lower() for c in rows[0].findall('.//w:tc', ns)]
            
            # Gjej indeksin e temës dhe situatës
            topic_idx = -1
            situat_idx = -1
            order_idx = -1
            
            for idx, h in enumerate(header_cells):
                if any(k in h for k in ['tema mesimore', 'temat mesimore', 'tema mësimore', 'temat mësimore', 'tema', 'topic']):
                    if topic_idx == -1:
                        topic_idx = idx
                elif any(k in h for k in ['situate', 'situata', 'situatë']):
                    situat_idx = idx
                elif any(k in h for k in ['nr.', 'nr', 'orë', 'oret']):
                    if order_idx == -1:
                        order_idx = idx

            if topic_idx != -1:
                for r in rows[1:]:
                    cells = [' '.join(''.join(c.itertext()).split()) for c in r.findall('.//w:tc', ns)]
                    if len(cells) > topic_idx:
                        topic_title = cells[topic_idx].strip()
                        if not topic_title or topic_title.lower().startswith('tema'):
                            continue
                        
                        situation = cells[situat_idx].strip() if situat_idx != -1 and len(cells) > situat_idx else ""
                        topics.append({
                            "tema": topic_title,
                            "situata": situation
                        })

        # 2. Nëse nuk u gjetën tema tabelare, kërko strukturë liste në qeliza (p.sh. Smiles)
        if not topics:
            for tbl in tables:
                rows = tbl.findall('.//w:tr', ns)
                for r in rows:
                    for c in r.findall('.//w:tc', ns):
                        text = ' '.join(''.join(c.itertext()).split())
                        # Nëse përmban tema të shpërndara me rreshta ose numra
                        lines = [l.strip() for l in ''.join(c.itertext()).split('\n') if l.strip()]
                        if len(lines) > 5 and any("classes" in l.lower() or "module" in l.lower() or "unit" in l.lower() for l in lines):
                            for line in lines:
                                l_clean = line.strip()
                                # Filtro titujt e moduleve apo numrin e orëve
                                if re.match(r'^(module|unit|starter|let’s|lets|period|september|january|april|\d+\s*classes)', l_clean.lower()):
                                    continue
                                if len(l_clean) > 3:
                                    topics.append({
                                        "tema": l_clean,
                                        "situata": "Situatë e sugjeruar nga libri i mësuesit"
                                    })
    return topics

def get_school_days(year, month, days_config, holidays):
    """
    Kthen listën e datave mësimore për muajin e specifikuar bazuar në orarin javor.
    days_config: {"E Hënë": 2, "E Premte": 1}
    """
    school_sessions = []
    
    # Numri i ditëve në muaj
    first_day = datetime.date(year, month, 1)
    if month == 12:
        next_month = datetime.date(year + 1, 1, 1)
    else:
        next_month = datetime.date(year, month + 1, 1)
    
    last_day = next_month - datetime.timedelta(days=1)
    
    cur = first_day
    while cur <= last_day:
        d_str = cur.strftime("%Y-%m-%d")
        w_name = WEEKDAYS_AL[cur.weekday()]
        
        # Për Shtator 2026, shkolla ka filluar më 14 Shtator
        if year == 2026 and month == 9 and cur.day < 14:
            cur += datetime.timedelta(days=1)
            continue
            
        if w_name in days_config and d_str not in holidays:
            hours_count = days_config[w_name]
            for h in range(1, hours_count + 1):
                school_sessions.append({
                    "data": cur.strftime("%d.%m.%Y"),
                    "data_iso": d_str,
                    "dita": w_name,
                    "ora": h
                })
        cur += datetime.timedelta(days=1)
        
    return school_sessions

def generate_plan(docx_path, grade, subject, year, month, days_config, start_index=0, holidays_file=DEFAULT_CALENDAR_PATH):
    holidays = load_holidays(holidays_file)
    sessions = get_school_days(year, month, days_config, holidays)
    extracted_topics = extract_topics_from_docx(docx_path)
    
    if not extracted_topics:
        raise ValueError(f"Nuk u gjetën tema mësimore brenda skedarit: {docx_path}")
    
    assigned_topics = []
    cur_topic_idx = start_index
    
    for sess in sessions:
        if cur_topic_idx < len(extracted_topics):
            top_info = extracted_topics[cur_topic_idx]
            tema_title = top_info["tema"]
            situata = top_info["situata"]
            cur_topic_idx += 1
        else:
            tema_title = "Përsëritje dhe Përforcim Njohurish"
            situata = "Ushtrime praktike dhe përmbledhje në grup"
            
        assigned_topics.append({
            "nr": len(assigned_topics) + 1,
            "data": sess["data"],
            "data_iso": sess["data_iso"],
            "dita": sess["dita"],
            "ora": sess["ora"],
            "tema": tema_title,
            "situata": situata,
            "klasa": grade,
            "lenda": subject
        })
        
    return assigned_topics, cur_topic_idx

def to_markdown(topics_list, title="Temat Mësimore të Gjeneruara"):
    md = [f"# {title}\n"]
    md.append(f"**Gjithsej orë të planifikuara:** {len(topics_list)}\n")
    md.append("| Nr. | Data | Dita | Ora | Tema Mësimore | Situata e Parashikuar e të Nxënit |")
    md.append("| :---: | :---: | :---: | :---: | :--- | :--- |")
    for t in topics_list:
        md.append(f"| **{t['nr']}** | {t['data']} | {t['dita']} | {t['ora']} | {t['tema']} | {t['situata']} |")
    return "\n".join(md)

def main():
    parser = argparse.ArgumentParser(description="Përgatit temat mësimore për SMIP")
    parser.add_argument("--file", required=True, help="Rruga drejt skedarit të planit vjetor (.docx)")
    parser.add_argument("--grade", required=True, help="Klasa (p.sh. 'Klasa 6', 'Klasa 6 - 8')")
    parser.add_argument("--subject", required=True, help="Lënda (p.sh. 'Edukim Fizik', 'Anglisht')")
    parser.add_argument("--month", default="10", type=int, help="Muaji (1 - 12, default: 10 Tetor)")
    parser.add_argument("--year", default=2026, type=int, help="Viti (default: 2026)")
    parser.add_argument("--days", required=True, help='Orari javor në format JSON, p.sh: \'{"E Hënë": 2, "E Premte": 1}\'')
    parser.add_argument("--start-index", default=0, type=int, help="Indeksi i temës fillestare (default: 0)")
    parser.add_argument("--output-json", help="Emri i skedarit përfundimtar JSON")
    parser.add_argument("--output-md", help="Emri i skedarit përfundimtar Markdown")
    
    args = parser.parse_args()
    days_config = json.loads(args.days)
    
    topics, next_idx = generate_plan(
        docx_path=args.file,
        grade=args.grade,
        subject=args.subject,
        year=args.year,
        month=args.month,
        days_config=days_config,
        start_index=args.start_index
    )
    
    print(f"U gjeneruan me sukses {len(topics)} orë/tema për {args.grade} ({args.subject}) për muajin {args.month:02d}/{args.year}.")
    print(f"Indeksi i temës së ardhshme për muajin pasardhës: {next_idx}")
    
    if args.output_json:
        with open(args.output_json, 'w', encoding='utf-8') as f:
            json.dump(topics, f, ensure_ascii=False, indent=2)
        print(f"U ruajt JSON: {args.output_json}")
        
    if args.output_md:
        md_content = to_markdown(topics, f"Temat Mësimore - {args.grade} ({args.subject}) - {args.month:02d}/{args.year}")
        with open(args.output_md, 'w', encoding='utf-8') as f:
            f.write(md_content)
        print(f"U ruajt Markdown: {args.output_md}")

if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""
find_curriculum.py - Kërkimi dhe menaxhimi i planeve mësimore për SMIP
"""

import os
import sys
import glob
import re
import argparse
import urllib.request
import urllib.parse

def get_workspace_root():
    cur = os.path.abspath(__file__)
    for _ in range(10):
        cur = os.path.dirname(cur)
        if os.path.exists(os.path.join(cur, "smip_docs")) or os.path.exists(os.path.join(cur, "kalendari_pushimeve.json")):
            return cur
    return os.getcwd()

WORKSPACE_ROOT = get_workspace_root()
DOCS_DIR = os.path.join(WORKSPACE_ROOT, "smip_docs")

# Burimet e njohura të shtëpive botuese në Shqipëri
PUBLISHER_SOURCES = {
    "Albas": {
        "url": "https://portalishkollor.al",
        "description": "Portali Shkollor Albas - Planet Mësimore dhe Libri i Mësuesit"
    },
    "Mediaprint": {
        "url": "https://mediaprint.al/planet-mesimore/",
        "description": "Botimet Mediaprint - Planet Vjetore dhe Periudhore"
    },
    "Pegi": {
        "url": "https://botimepegi.al/plane-mesimore/",
        "description": "Botimet Pegi - Planet mësimore lëndore"
    },
    "Irisoft": {
        "url": "https://irisoft.al",
        "description": "Irisoft Education - Planet mësimore TIK dhe Shkenca"
    },
    "ASCAP": {
        "url": "https://ascap.edu.al",
        "description": "Agjencia e Sigurimit të Cilësisë së Arsimit Parauniversitar (Programet Orientuese)"
    },
    "Express Publishing": {
        "url": "https://expresspublishing.al",
        "description": "Seritë Smiles, Right On, Spark, Flash"
    }
}

def normalize_text(text):
    text = text.lower()
    replacements = {
        'ë': 'e', 'ç': 'c', 'é': 'e', 'è': 'e', '-': ' ', '_': ' ', '.': ' '
    }
    for k, v in replacements.items():
        text = text.replace(k, v)
    return ' '.join(text.split())

def search_local(grade=None, subject=None, publisher=None, docs_dir=None):
    if not docs_dir or not os.path.exists(docs_dir):
        docs_dir = DOCS_DIR
    
    if not os.path.exists(docs_dir):
        return []

    files = glob.glob(os.path.join(docs_dir, "*.docx")) + glob.glob(os.path.join(docs_dir, "*.pdf"))
    matches = []

    keywords = []
    if grade:
        # P.sh. "6", "klasa 6", "kl 6", "6-8"
        norm_grade = re.findall(r'\d+', str(grade))
        keywords.extend(norm_grade)
    if subject:
        norm_subj = normalize_text(subject)
        keywords.extend([w for w in norm_subj.split() if len(w) > 2])
    if publisher:
        norm_pub = normalize_text(publisher)
        keywords.extend([w for w in norm_pub.split() if len(w) > 2])

    for fpath in files:
        fname = os.path.basename(fpath)
        norm_fname = normalize_text(fname)
        score = 0
        for kw in keywords:
            if kw.lower() in norm_fname:
                score += 1
        if score > 0 or not keywords:
            matches.append((score, fpath))

    # Rendit sipas pikëve më të larta
    matches.sort(key=lambda x: x[0], reverse=True)
    return [m[1] for m in matches]

def download_file(url, output_path=None, filename=None):
    if not output_path:
        output_path = DOCS_DIR
    os.makedirs(output_path, exist_ok=True)
    
    if not filename:
        filename = os.path.basename(urllib.parse.urlparse(url).path) or "plani_shkarkuar.docx"
    
    dest = os.path.join(output_path, filename)
    print(f"Duke shkarkuar: {url} -> {dest}")
    
    headers = {'User-Agent': 'Mozilla/5.0'}
    req = urllib.request.Request(url, headers=headers)
    with urllib.request.urlopen(req) as resp, open(dest, 'wb') as out_f:
        out_f.write(resp.read())
    print(f"Shkarkimi përfundoi me sukses: {dest}")
    return dest

def main():
    parser = argparse.ArgumentParser(description="Kërko ose shkarko planet mësimore për SMIP")
    parser.add_argument("--grade", help="Klasa (p.sh. 6, 8, 3, 11)")
    parser.add_argument("--subject", help="Lënda (p.sh. 'Edukim Fizik', 'Anglisht', 'Qytetari')")
    parser.add_argument("--publisher", help="Shtëpia botuese (p.sh. 'Albas', 'Mediaprint', 'Smiles')")
    parser.add_argument("--download-url", help="URL për shkarkim të drejtpërdrejtë të planit")
    parser.add_argument("--output-name", help="Emri i skedarit të shkarkuar")
    parser.add_argument("--docs-dir", default=DOCS_DIR, help="Dosja ku ruhen planet")
    
    args = parser.parse_args()

    if args.download_url:
        download_file(args.download_url, args.docs_dir, args.output_name)
        return

    print(f"=== Kërkimi i Planeve Mësimore në '{args.docs_dir}' ===")
    results = search_local(args.grade, args.subject, args.publisher, args.docs_dir)
    
    if results:
        print(f"U gjetën {len(results)} skedarë që përputhen:")
        for idx, res in enumerate(results, 1):
            print(f"  [{idx}] {os.path.basename(res)}")
    else:
        print("Nuk u gjet asnjë plan lokal me këto kritere.")
        print("\nBurimet e sugjeruara zyrtare për shkarkim online:")
        for pub, info in PUBLISHER_SOURCES.items():
            print(f"  * {pub}: {info['url']} - {info['description']}")

if __name__ == "__main__":
    main()

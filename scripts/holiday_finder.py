#!/usr/bin/env python3
"""
holiday_finder.py - Gjetësi dhe Gjeneruesi Automatik i Pushimeve dhe Festave për Shqipërinë (MAS / Ligji 7651)
"""

import os
import sys
import json
import datetime
import urllib.request
import urllib.error

def find_workspace_root():
    cur = os.path.abspath(__file__)
    for _ in range(10):
        cur = os.path.dirname(cur)
        if os.path.exists(os.path.join(cur, "smip_docs")) or os.path.exists(os.path.join(cur, "package.json")):
            return cur
    return os.getcwd()

WORKSPACE_ROOT = find_workspace_root()
DOCS_CALENDAR_PATH = os.path.join(WORKSPACE_ROOT, "smip_docs", "kalendari_pushimeve.json")

# Festat zyrtare fikse sipas ligjit shqiptar (muaji, dita, emri)
FIXED_HOLIDAYS = [
    (1, 1, "Viti i Ri"),
    (1, 2, "Viti i Ri (Dita 2)"),
    (3, 14, "Dita e Verës"),
    (3, 22, "Dita e Nevruzit"),
    (5, 1, "Dita Ndërkombëtare e Punëtorëve"),
    (9, 5, "Dita e Shenjtërimit të Shenjtë Terezës"),
    (11, 28, "Dita e Pavarësisë"),
    (11, 29, "Dita e Çlirimit"),
    (12, 8, "Dita Kombëtare e Rinisë"),
    (12, 25, "Krishtlindjet")
]

# Tabela e përafërt e datave të Bajramit (pasi varet nga kalendari hënor)
BAJRAM_DATES = {
    2025: [("2025-03-30", "Fitër Bajrami"), ("2025-06-06", "Kurban Bajrami")],
    2026: [("2026-03-20", "Fitër Bajrami"), ("2026-05-27", "Kurban Bajrami")],
    2027: [("2027-03-09", "Fitër Bajrami"), ("2027-05-16", "Kurban Bajrami")],
    2028: [("2028-02-26", "Fitër Bajrami"), ("2028-05-05", "Kurban Bajrami")],
    2029: [("2029-02-14", "Fitër Bajrami"), ("2029-04-24", "Kurban Bajrami")],
    2030: [("2030-02-04", "Fitër Bajrami"), ("2030-04-13", "Kurban Bajrami")]
}

def catholic_easter(year):
    """Llogarit të Dielën e Pashkëve Katolike me algoritmin Gregorian (Meeus/Jones)"""
    a = year % 19
    b = year // 100
    c = year % 100
    d = b // 4
    e = b % 4
    f = (b + 8) // 25
    g = (b - f + 1) // 3
    h = (19 * a + b - d - g + 15) % 30
    i = c // 4
    k = c % 4
    l = (32 + 2 * e + 2 * i - h - k) % 7
    m = (a + 11 * h + 22 * l) // 451
    month = (h + l - 7 * m + 114) // 31
    day = ((h + l - 7 * m + 114) % 31) + 1
    return datetime.date(year, month, day)

def orthodox_easter(year):
    """Llogarit të Dielën e Pashkëve Ortodokse sipas kalendarit Julian të konvertuar në Gregorian"""
    a = year % 4
    b = year % 7
    c = year % 19
    d = (19 * c + 15) % 30
    e = (2 * a + 4 * b - d + 34) % 7
    month = (d + e + 114) // 31
    day = ((d + e + 114) % 31) + 1
    julian_date = datetime.date(year, month, day)
    return julian_date + datetime.timedelta(days=13)

def apply_weekend_rollover(d):
    """
    Rregulli i Republikës së Shqipërisë:
    Kur një ditë feste zyrtare bie ditë pushimi javor (e shtunë ose e diel),
    dita e punës pasardhëse (e hënë) është ditë pushimi.
    """
    if d.weekday() == 5: # E Shtunë -> E Hënë pushim
        return d + datetime.timedelta(days=2)
    elif d.weekday() == 6: # E Diel -> E Hënë pushim
        return d + datetime.timedelta(days=1)
    return d

def fetch_online_holidays(year):
    """Merr festat kombëtare nga API publike zyrtare për Shqipërinë"""
    url = f"https://date.nager.at/api/v3/PublicHolidays/{year}/AL"
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'SMIP-Agent/1.0'})
        with urllib.request.urlopen(req, timeout=4) as resp:
            data = json.loads(resp.read().decode('utf-8'))
            holidays = []
            for item in data:
                holidays.append({
                    "data": item.get("date"),
                    "festa": item.get("localName") or item.get("name")
                })
            return holidays
    except Exception as e:
        return None

def generate_algorithmic_holidays(year):
    """Gjeneron automatikisht festat sipas ligjit dhe llogaritjeve astronomike"""
    holidays = []

    # 1. Festat fikse me rregullin e transferimit të së hënës
    for m, d, name in FIXED_HOLIDAYS:
        f_date = datetime.date(year, m, d)
        actual_day = apply_weekend_rollover(f_date)
        holidays.append({
            "data": actual_day.strftime("%Y-%m-%d"),
            "festa": name if actual_day == f_date else f"{name} (Shtyrë të Hënën)"
        })

    # 2. Pashkët Katolike (E Diel -> E Hënë pushim)
    ce = catholic_easter(year)
    holidays.append({
        "data": (ce + datetime.timedelta(days=1)).strftime("%Y-%m-%d"),
        "festa": "E Hëna e Pashkëve Katolike"
    })

    # 3. Pashkët Ortodokse (E Diel -> E Hënë pushim)
    oe = orthodox_easter(year)
    holidays.append({
        "data": (oe + datetime.timedelta(days=1)).strftime("%Y-%m-%d"),
        "festa": "E Hëna e Pashkëve Ortodokse"
    })

    # 4. Bajramet
    if year in BAJRAM_DATES:
        for b_str, b_name in BAJRAM_DATES[year]:
            b_date = datetime.datetime.strptime(b_str, "%Y-%m-%d").date()
            act_b = apply_weekend_rollover(b_date)
            holidays.append({
                "data": act_b.strftime("%Y-%m-%d"),
                "festa": b_name if act_b == b_date else f"{b_name} (Shtyrë të Hënën)"
            })

    # Rendit sipas datës
    holidays.sort(key=lambda x: x["data"])
    return holidays

def get_school_vacations(school_year_start):
    """
    Gjeneron periudhat e pushimeve shkollore (Dimër & Pranverë) sipas standardeve të MAS.
    school_year_start: p.sh. 2026 për vitin shkollor 2026-2027
    """
    y1 = school_year_start
    y2 = school_year_start + 1
    
    # Pushimet e Dimrit: 24 Dhjetor deri ditën e parë pas Vitit të Ri (zakonisht 4/5 Janar)
    winter_start = f"{y1}-12-24"
    winter_end = f"{y2}-01-04"

    # Pushimet e Pranverës: Java e fundit e Marsit / fillimi i Prillit (e Hënë deri të Premte)
    # Gjej të Hënën e fundit të Marsit të vitit y2
    last_day_march = datetime.date(y2, 3, 31)
    # Llogarit të hënën
    offset = (last_day_march.weekday() - 0) % 7
    spring_monday = last_day_march - datetime.timedelta(days=offset)
    spring_friday = spring_monday + datetime.timedelta(days=4)

    return [
        {
            "periudha": "Pushimet e Dimrit",
            "fillimi": winter_start,
            "mbarimi": winter_end
        },
        {
            "periudha": "Pushimet e Pranverës (Cikli 9-vjeçar)",
            "fillimi": spring_monday.strftime("%Y-%m-%d"),
            "mbarimi": spring_friday.strftime("%Y-%m-%d")
        }
    ]

def resolve_all_holidays(year, auto_save=True, target_file=DOCS_CALENDAR_PATH):
    """
    Kthen bashkësinë e të gjitha datave të pushimeve për vitin përkatës (festa + pushime shkollore).
    Nëse skedari lokal mungon, e gjen online ose e llogarit vetë dhe e ruan në smip_docs/.
    """
    # 1. Kontrollo nëse ekziston skedari lokal dhe a mbulon vitin e kërkuar
    if os.path.exists(target_file):
        try:
            with open(target_file, 'r', encoding='utf-8') as f:
                data = json.load(f)
                holiday_dates = set()
                found_for_year = False
                for item in data.get("festat_zyrtare", []) + data.get("festat_zyrtare_2026_2027", []):
                    d = item.get("data")
                    if d:
                        holiday_dates.add(d)
                        if d.startswith(str(year)):
                            found_for_year = True

                for p in data.get("pushimet_dhe_periudhat", []):
                    f_d = p.get("fillimi")
                    m_d = p.get("mbarimi")
                    if f_d and m_d:
                        cur = datetime.datetime.strptime(f_d, "%Y-%m-%d").date()
                        end = datetime.datetime.strptime(m_d, "%Y-%m-%d").date()
                        while cur <= end:
                            holiday_dates.add(cur.strftime("%Y-%m-%d"))
                            if cur.year == year:
                                found_for_year = True
                            cur += datetime.timedelta(days=1)

                if found_for_year:
                    return holiday_dates
        except Exception:
            pass

    # 2. Nëse nuk u gjet, gjeje automatikisht (online ose algoritmikisht)
    print(f"ℹ️ [SMIP Holiday Finder] Duke gjetur automatikisht kalendarin e pushimeve për vitin {year}...")
    holidays = fetch_online_holidays(year)
    if not holidays:
        print("  * Duke përdorur motorin algoritmik të ligjit shqiptar të festave (offline mode)...")
        holidays = generate_algorithmic_holidays(year)
    else:
        print("  * U morën me sukses festat zyrtare kombëtare nga shërbimi zyrtar.")

    school_year = year if datetime.date.today().month >= 8 else year - 1
    vacations = get_school_vacations(school_year)

    # 3. Krijo strukturën e plotë
    calendar_data = {
        "viti": f"{school_year} - {school_year + 1}",
        "burimi": "Gjeneruar automatikisht nga SMIP Skill (MAS / Ligji 7651)",
        "festat_zyrtare": holidays,
        "pushimet_dhe_periudhat": vacations
    }

    # 4. Ruaj automatikisht në smip_docs nëse kërkohet
    if auto_save:
        os.makedirs(os.path.dirname(target_file), exist_ok=True)
        try:
            with open(target_file, 'w', encoding='utf-8') as f:
                json.dump(calendar_data, f, ensure_ascii=False, indent=2)
            print(f"✓ Kalendari u ruajt automatikisht te: {target_file}")
        except Exception as e:
            print(f"Vërejtje gjatë ruajtjes së kalendarit: {e}", file=sys.stderr)

    # Kthe bashkësinë e datave
    dates = set(h["data"] for h in holidays)
    for vac in vacations:
        cur = datetime.datetime.strptime(vac["fillimi"], "%Y-%m-%d").date()
        end = datetime.datetime.strptime(vac["mbarimi"], "%Y-%m-%d").date()
        while cur <= end:
            dates.add(cur.strftime("%Y-%m-%d"))
            cur += datetime.timedelta(days=1)

    return dates

if __name__ == "__main__":
    year = int(sys.argv[1]) if len(sys.argv) > 1 else 2026
    holidays = resolve_all_holidays(year, auto_save=True)
    print(f"U llogaritën gjithsej {len(holidays)} data pushimi për vitin {year}.")

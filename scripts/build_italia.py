#!/usr/bin/env python3
"""
RISTOAPP - Costruisce i dati di TUTTA ITALIA dall'estratto OpenStreetMap.

Input : file .osm.pbf gia' filtrato con osmium-tool (amenity + tourism + parking + place)
Output: data/tiles/<lat10>_<lng10>.json   locali e localita' per quadrante 0.1 x 0.1 gradi
        data/tiles/index.json             elenco quadranti disponibili
        data/places/<lettera>.json        localita' per la ricerca per nome
        data/parking/<lat10>_<lng10>.json parcheggi pubblici (caricati solo per i B&B)
        data/README.md, data/LICENSE-ODbL.txt  licenza e attribuzione (ODbL)

Alloggi: il campo "cin" contiene il CIN (tag ref:cin) normalizzato e valido;
l'app mostra SOLO gli alloggi con CIN valido.

I telefoni scaricano questi file dal sito stesso dell'app: nessuna
dipendenza dai server pubblici di OpenStreetMap.

Uso: python3 scripts/build_italia.py filtered.osm.pbf [cartella_output]
"""

import json
import math
import os
import re
import shutil
import sys
import unicodedata
from datetime import datetime, timezone

import osmium

AMENITIES = {"restaurant", "fast_food", "pub", "bar", "cafe",
             "biergarten", "food_court", "ice_cream"}
PLACE_RANK = {"city": 1, "town": 2, "suburb": 3, "village": 3, "quarter": 4, "hamlet": 5, "neighbourhood": 5}
# Tag extra mostrati nella scheda "Altre informazioni"
EXTRA_TAGS = ["stars", "rooms", "beds", "guest_house", "check_in", "check_out",
              "brand", "capacity", "reservation", "smoking", "internet_access",
              "air_conditioning", "diet:halal", "diet:kosher", "drive_through",
              "level", "description", "email", "contact:email", "ref:cin"]
# tourism=* -> categoria alloggio usata dall'app
LODGING = {"guest_house": "guest_house", "hotel": "hotel", "motel": "hotel",
           "hostel": "hostel", "apartment": "apartment", "chalet": "apartment"}
PARKING_SKIP_ACCESS = {"private", "no", "customers", "permit", "delivery", "residents"}
TILE = 10  # 10 = quadranti da 0.1 gradi (circa 11 x 8 km)
CIN_RE = re.compile(r"^IT[0-9]{6}[A-Z0-9]{2}[A-Z0-9]{1,8}$")

ATTRIBUTION = "© OpenStreetMap contributors"
LICENSE = "ODbL-1.0"
LICENSE_URL = "https://opendatacommons.org/licenses/odbl/1-0/"
COPYRIGHT_URL = "https://www.openstreetmap.org/copyright"

DATA_README = """# Dati OpenStreetMap di RistoApp

I file di questa cartella (tiles/, places/, parking/) sono una banca dati derivata da OpenStreetMap.

© OpenStreetMap contributors. Disponibile con licenza Open Database License (ODbL) 1.0:
https://opendatacommons.org/licenses/odbl/1-0/ — fonte e dettagli: https://www.openstreetmap.org/copyright

Estratto settimanale da Geofabrik (Italia), filtrato e convertito in JSON da RistoApp
(scripts/build_italia.py). Se riusi questi dati devi citare OpenStreetMap e mantenere
la licenza ODbL per le banche dati derivate.

I contenuti inseriti dai titolari (Firestore) non fanno parte di questa banca dati.
"""

DATA_LICENSE = """Open Database License (ODbL) 1.0 - avviso

The data in this directory (tiles/, places/, parking/) is a Derivative Database of
OpenStreetMap data and is made available under the Open Database License (ODbL) 1.0.

  © OpenStreetMap contributors
  Source:  https://www.openstreetmap.org/copyright
  Licence: https://opendatacommons.org/licenses/odbl/1-0/
  Full legal text: https://opendatacommons.org/licenses/odbl/1-0/legalcode.txt

Any rights in individual contents of the database are licensed under the
Database Contents License: https://opendatacommons.org/licenses/dbcl/1-0/

If you publicly use this data you must attribute OpenStreetMap contributors, and if
you redistribute an adapted version of this database you must offer it under the ODbL.
"""


def norm_cin(value):
    """CIN normalizzato (maiuscolo, senza spazi) se valido, altrimenti ''."""
    c = re.sub(r"\s+", "", str(value or "")).upper()
    return c if CIN_RE.match(c) else ""


def write_license_files(out):
    """README e avviso di licenza ODbL nella cartella dei dati (contenuto fisso)."""
    os.makedirs(out, exist_ok=True)
    with open(os.path.join(out, "README.md"), "w", encoding="utf-8") as f:
        f.write(DATA_README)
    with open(os.path.join(out, "LICENSE-ODbL.txt"), "w", encoding="utf-8") as f:
        f.write(DATA_LICENSE)


def tile_key(lat, lng):
    return f"{math.floor(lat * TILE)}_{math.floor(lng * TILE)}"


def norm(s):
    s = unicodedata.normalize("NFD", s.lower())
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    return s.replace("'", "").replace("’", "").strip()


def bucket(name):
    n = norm(name)
    c = n[:1]
    return c if "a" <= c <= "z" else "_"


def category(tags):
    """Categoria: amenity per la ristorazione, tipo di alloggio per tourism=*."""
    amenity = tags.get("amenity")
    if amenity in AMENITIES:
        return amenity
    return LODGING.get(tags.get("tourism"))


def restaurant(osm_id, tags, lat, lng, cat):
    t = dict(tags)
    street = " ".join(x for x in [t.get("addr:street"), t.get("addr:housenumber")] if x)
    city = " ".join(x for x in [t.get("addr:postcode"), t.get("addr:city")] if x)
    r = {
        "id": osm_id,
        "name": t["name"],
        "amenity": cat,
        "lat": round(lat, 6),
        "lng": round(lng, 6),
        "cuisine": t.get("cuisine", ""),
        "address": ", ".join(x for x in [street, city] if x),
        "phone": t.get("phone") or t.get("contact:phone", ""),
        "website": t.get("website") or t.get("contact:website", ""),
        "facebook": t.get("contact:facebook", ""),
        "instagram": t.get("contact:instagram", ""),
        "opening_hours": t.get("opening_hours", ""),
        "takeaway": t.get("takeaway", ""),
        "delivery": t.get("delivery", ""),
        "outdoor_seating": t.get("outdoor_seating", ""),
        "wheelchair": t.get("wheelchair", ""),
        "vegetarian": t.get("diet:vegetarian", ""),
        "vegan": t.get("diet:vegan", ""),
        "gluten_free": t.get("diet:gluten_free", ""),
        "payments": sorted(k[8:] for k, v in t.items() if k.startswith("payment:") and v == "yes"),
        "rawTags": {k: t[k] for k in EXTRA_TAGS if k in t},
    }
    # Alloggi: CIN valido (ref:cin) in chiaro; senza CIN l'app non li mostra
    if cat in LODGING.values():
        r["cin"] = norm_cin(t.get("ref:cin"))
    # Toglie i campi vuoti: l'app li ricostruisce (file piu' leggeri)
    return {k: v for k, v in r.items() if v not in ("", [], {})}


def main():
    src = sys.argv[1]
    out = sys.argv[2] if len(sys.argv) > 2 else "data"
    tiles = {}     # key -> {"items": [], "places": []}
    places = {}    # lettera -> [[nome, lat, lng, rank, provincia]]
    parking = {}   # key -> [[lat, lng, nome, fee, tipo, posti]]
    n_rest = n_place = n_park = 0

    def tile(lat, lng):
        return tiles.setdefault(tile_key(lat, lng), {"items": [], "places": []})

    for obj in osmium.FileProcessor(src).with_locations():
        tags = obj.tags
        name = tags.get("name")
        is_parking = tags.get("amenity") == "parking"
        if is_parking:
            if tags.get("access") in PARKING_SKIP_ACCESS or obj.is_relation():
                continue
        elif not name:
            continue
        cat = None if is_parking else category(tags)
        place = tags.get("place")

        if obj.is_node():
            if not obj.location.valid():
                continue
            lat, lng = obj.location.lat, obj.location.lon
            osm_id = f"node/{obj.id}"
        elif obj.is_way():
            if not cat and not is_parking:
                continue
            pts = [(n.location.lat, n.location.lon) for n in obj.nodes if n.location.valid()]
            if not pts:
                continue
            if len(pts) > 1 and pts[0] == pts[-1]:
                pts = pts[:-1]
            lat = sum(p[0] for p in pts) / len(pts)
            lng = sum(p[1] for p in pts) / len(pts)
            osm_id = f"way/{obj.id}"
        else:
            continue

        if is_parking:
            parking.setdefault(tile_key(lat, lng), []).append([
                round(lat, 5), round(lng, 5), name or "",
                tags.get("fee", ""), tags.get("parking", ""), tags.get("capacity", ""),
            ])
            n_park += 1
        elif cat:
            tile(lat, lng)["items"].append(restaurant(osm_id, tags, lat, lng, cat))
            n_rest += 1
        elif obj.is_node() and place in PLACE_RANK:
            rank = PLACE_RANK[place]
            prov = tags.get("is_in:province", "") or tags.get("ref:ISTAT", "")[:3]
            entry = [name, round(lat, 5), round(lng, 5), rank]
            tile(lat, lng)["places"].append(entry)
            places.setdefault(bucket(name), []).append(entry + [prov] if prov else entry)
            n_place += 1

    # Controllo di sicurezza PRIMA di toccare i dati esistenti
    if n_rest < 1000 and os.environ.get("RISTOAPP_ALLOW_SMALL") != "1":
        sys.exit(f"Solo {n_rest} locali: estratto incompleto, tengo i dati precedenti.")

    # Scrittura (cartelle ricreate da zero: niente quadranti vecchi)
    for sub in ("tiles", "places", "parking"):
        shutil.rmtree(os.path.join(out, sub), ignore_errors=True)
        os.makedirs(os.path.join(out, sub))

    index = {}
    for key, data in tiles.items():
        data["items"].sort(key=lambda r: r["id"])
        data["places"].sort()
        with open(os.path.join(out, "tiles", f"{key}.json"), "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, separators=(",", ":"))
        index[key] = len(data["items"])

    lats = [int(k.split("_")[0]) for k in index] or [0]
    lngs = [int(k.split("_")[1]) for k in index] or [0]
    with open(os.path.join(out, "tiles", "index.json"), "w", encoding="utf-8") as f:
        json.dump({
            "generated": datetime.now(timezone.utc).isoformat(timespec="seconds"),
            "tile": TILE,
            "attribution": ATTRIBUTION,
            "license": LICENSE,
            "licenseUrl": LICENSE_URL,
            "copyrightUrl": COPYRIGHT_URL,
            "fields": {"cin": "CIN valido (ref:cin) per gli alloggi; vuoto = senza CIN"},
            "bbox": [min(lats), min(lngs), max(lats), max(lngs)],
            "tiles": dict(sorted(index.items())),
        }, f, separators=(",", ":"))

    for key, entries in parking.items():
        entries.sort()
        with open(os.path.join(out, "parking", f"{key}.json"), "w", encoding="utf-8") as f:
            json.dump(entries, f, ensure_ascii=False, separators=(",", ":"))

    for letter, entries in places.items():
        entries.sort(key=lambda e: (e[3], e[0]))
        with open(os.path.join(out, "places", f"{letter}.json"), "w", encoding="utf-8") as f:
            json.dump(entries, f, ensure_ascii=False, separators=(",", ":"))

    write_license_files(out)
    print(f"Locali: {n_rest}  Localita': {n_place}  Parcheggi: {n_park}  Quadranti: {len(index)}")


if __name__ == "__main__":
    main()

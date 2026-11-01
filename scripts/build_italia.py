#!/usr/bin/env python3
"""
RISTOAPP - Costruisce i dati di TUTTA ITALIA dall'estratto OpenStreetMap.

Input : file .osm.pbf gia' filtrato con osmium-tool (amenity + tourism=guest_house + place)
Output: data/tiles/<lat10>_<lng10>.json   locali e localita' per quadrante 0.1 x 0.1 gradi
        data/tiles/index.json             elenco quadranti disponibili
        data/places/<lettera>.json        localita' per la ricerca per nome

I telefoni scaricano questi file dal sito stesso dell'app: nessuna
dipendenza dai server pubblici di OpenStreetMap.

Uso: python3 scripts/build_italia.py filtered.osm.pbf [cartella_output]
"""

import json
import math
import os
import shutil
import sys
import unicodedata
from datetime import datetime, timezone

import osmium

AMENITIES = {"restaurant", "fast_food", "pub", "bar", "cafe",
             "biergarten", "food_court", "ice_cream"}
PLACE_RANK = {"city": 1, "town": 2, "suburb": 3, "village": 3, "quarter": 4, "hamlet": 5}
# Tag extra mostrati nella scheda "Altre informazioni"
EXTRA_TAGS = ["stars", "rooms", "beds", "guest_house", "check_in", "check_out",
              "brand", "capacity", "reservation", "smoking", "internet_access",
              "air_conditioning", "diet:halal", "diet:kosher", "drive_through",
              "level", "description", "email", "contact:email"]
TILE = 10  # 10 = quadranti da 0.1 gradi (circa 11 x 8 km)


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
    """Categoria del locale: amenity per la ristorazione, 'guest_house' per i B&B."""
    amenity = tags.get("amenity")
    if amenity in AMENITIES:
        return amenity
    if tags.get("tourism") == "guest_house":
        return "guest_house"
    return None


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
    # Toglie i campi vuoti: l'app li ricostruisce (file piu' leggeri)
    return {k: v for k, v in r.items() if v not in ("", [], {})}


def main():
    src = sys.argv[1]
    out = sys.argv[2] if len(sys.argv) > 2 else "data"
    tiles = {}     # key -> {"items": [], "places": []}
    places = {}    # lettera -> [[nome, lat, lng, rank, provincia]]
    n_rest = n_place = 0

    def tile(lat, lng):
        return tiles.setdefault(tile_key(lat, lng), {"items": [], "places": []})

    for obj in osmium.FileProcessor(src).with_locations():
        tags = obj.tags
        name = tags.get("name")
        if not name:
            continue
        cat = category(tags)
        place = tags.get("place")

        if obj.is_node():
            if not obj.location.valid():
                continue
            lat, lng = obj.location.lat, obj.location.lon
            osm_id = f"node/{obj.id}"
        elif obj.is_way():
            if not cat:
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

        if cat:
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
    for sub in ("tiles", "places"):
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
            "bbox": [min(lats), min(lngs), max(lats), max(lngs)],
            "tiles": dict(sorted(index.items())),
        }, f, separators=(",", ":"))

    for letter, entries in places.items():
        entries.sort(key=lambda e: (e[3], e[0]))
        with open(os.path.join(out, "places", f"{letter}.json"), "w", encoding="utf-8") as f:
            json.dump(entries, f, ensure_ascii=False, separators=(",", ":"))

    print(f"Locali: {n_rest}  Localita': {n_place}  Quadranti: {len(index)}")


if __name__ == "__main__":
    main()

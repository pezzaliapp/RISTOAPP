#!/usr/bin/env python3
# Genera data-static/istat-comuni.json (vedi data-static/README.md).
# Uso: python3 scripts/build_istat.py <gi_comuni_cap.json> <italian-territories municipalities.json> data-static/istat-comuni.json
import json, math, sys
gi_path, it_path, out = sys.argv[1:4]
gi = {r['codice_istat']: r for r in json.load(open(gi_path))}
act = set()
for m in json.load(open(it_path)):
    v = m['versions'][-1]
    if m['status'] == 'active' and v.get('valid_until') is None:
        act.add(v['istat_code'])
assert set(gi) == act, (len(set(gi) ^ act))
# Comuni formati da piu' isole lontane tra loro (Linosa, Stromboli/Alicudi, Marettimo)
ISLANDS = {'084020': 50, '083041': 50, '081009': 35}
res = {}
big = 0
for c in sorted(gi):
    r = gi[c]
    lat, lng = round(float(r['lat']), 4), round(float(r['lon']), 4)
    assert 35 < lat < 47.2 and 6.5 < lng < 18.6, c
    row = [r['denominazione_ita'], r['sigla_provincia'], lat, lng]
    area = float(r.get('superficie_kmq') or 0)
    rad = math.ceil(1.5 * math.sqrt(area / math.pi)) if area else 0
    rad = max(rad, ISLANDS.get(c, 0))
    if rad > 20:
        row.append(rad); big += 1
    res[c] = row
# Codici soppressi o cambiati dal 2023 (fusioni, riordino delle province
# sarde del 2026): i CIN rilasciati prima conservano il vecchio codice.
# Alias: vecchio codice -> codice attuale (stringa).
byid = {m['id']: m for m in json.load(open(it_path))}
aliases = 0
for m in byid.values():
    cur = m['versions'][-1]
    for v in m['versions']:
        vu = v.get('valid_until')
        if not vu or vu < '2023-06-01' or v['istat_code'] in res:
            continue
        if m['status'] == 'active':
            target = cur['istat_code']
        else:
            succ = [byid[x]['versions'][-1]['istat_code'] for x in m.get('current_successors', []) if x in byid]
            target = next((t for t in succ if t in res), None)
        if target in res:
            res[v['istat_code']] = target
            aliases += 1
print(aliases, 'codici precedenti (alias)')
json.dump(res, open(out, 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
print(sum(isinstance(v, list) for v in res.values()), "comuni;", big, "con raggio > 20 km")

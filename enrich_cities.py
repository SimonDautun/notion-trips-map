import os
import time
import json
import re
import requests
from dotenv import load_dotenv
import math

load_dotenv()

NOTION_TOKEN = os.environ["NOTION_TOKEN"]
NOTION_DATABASE_ID = os.environ["NOTION_DATABASE_ID"]

NOMINATIM_USER_AGENT = os.environ.get(
    "NOMINATIM_USER_AGENT",
    "NotionCityEnricher/1.0 (contact: you@example.com)"
)

NOTION_API_BASE = "https://api.notion.com/v1"
NOTION_VERSION = os.environ.get("NOTION_VERSION", "2022-06-28")

notion = requests.Session()
notion.headers.update({
    "Authorization": f"Bearer {NOTION_TOKEN}",
    "Notion-Version": NOTION_VERSION,
    "Content-Type": "application/json",
})

def extract_date_range(page, prop_name: str):
    prop = page["properties"].get(prop_name)
    if not prop or prop.get("type") != "date" or not prop.get("date"):
        return (None, None)
    d = prop["date"]
    return (d.get("start"), d.get("end"))  # ISO strings

def extract_rich_text(page, prop_name: str) -> str | None:
    prop = page["properties"].get(prop_name)
    if not prop or prop.get("type") != "rich_text":
        return None
    parts = prop["rich_text"]
    text = "".join([p.get("plain_text", "") for p in parts]).strip()
    return text or None

def extract_title(page, prop_name: str) -> str | None:
    prop = page["properties"].get(prop_name)
    if not prop or prop.get("type") != "title":
        return None
    parts = prop["title"]
    text = "".join([p.get("plain_text", "") for p in parts]).strip()
    return text or None

def extract_select(page, prop_name: str) -> str | None:
    prop = page["properties"].get(prop_name)
    if not prop or prop.get("type") != "select" or not prop.get("select"):
        return None
    return prop["select"].get("name")

def set_rich_text(page_id: str, prop_name: str, value: str):
    payload = {"properties": {prop_name: {"rich_text": [{"text": {"content": value}}]}}}
    r = notion.patch(f"{NOTION_API_BASE}/pages/{page_id}", json=payload, timeout=30)
    if r.status_code >= 400:
        print("Update error:", r.status_code, r.text)
    r.raise_for_status()

def nominatim_geocode(query: str):
    url = "https://nominatim.openstreetmap.org/search"
    params = {"q": query, "format": "json", "limit": 1, "addressdetails": 1}
    headers = {"User-Agent": NOMINATIM_USER_AGENT}
    r = requests.get(url, params=params, headers=headers, timeout=30)
    r.raise_for_status()
    data = r.json()
    if not data:
        return None

    item = data[0]
    addr = item.get("address", {})
    city = addr.get("city") or addr.get("town") or addr.get("village") or addr.get("municipality") or query
    region = addr.get("state") or addr.get("region") or addr.get("county") or ""
    country = addr.get("country") or ""
    lat = item.get("lat")
    lon = item.get("lon")
    return city, region, country, lat, lon

def query_pages(filter_payload=None, start_cursor=None, page_size=50):
    payload = {"page_size": page_size}
    if filter_payload:
        payload["filter"] = filter_payload
    if start_cursor:
        payload["start_cursor"] = start_cursor

    r = notion.post(f"{NOTION_API_BASE}/databases/{NOTION_DATABASE_ID}/query", json=payload, timeout=30)
    if r.status_code >= 400:
        print("Query error:", r.status_code, r.text)
    r.raise_for_status()
    return r.json()

def query_needing_details(source_prop: str, details_prop: str, start_cursor=None):
    filter_payload = {
        "and": [
            {"property": source_prop, "rich_text": {"is_not_empty": True}},
            {"property": details_prop, "rich_text": {"is_empty": True}},
        ]
    }
    return query_pages(filter_payload=filter_payload, start_cursor=start_cursor)

def enrich_details(source_prop: str, details_prop: str):
    cursor = None
    updated = 0

    while True:
        res = query_needing_details(source_prop, details_prop, start_cursor=cursor)
        for page in res.get("results", []):
            page_id = page["id"]
            q = extract_rich_text(page, source_prop)
            if not q:
                continue

            geo = nominatim_geocode(q)
            time.sleep(1.05)  # ~1 req/sec (Nominatim public)

            if not geo:
                set_rich_text(page_id, details_prop, "Not found")
                continue

            city, region, country, lat, lon = geo
            details = f"{city}{', ' + region if region else ''}{', ' + country if country else ''} — {lat}, {lon}"
            set_rich_text(page_id, details_prop, details)
            updated += 1

        if not res.get("has_more"):
            break
        cursor = res.get("next_cursor")

    return updated

_latlon_re = re.compile(r"—\s*([-0-9.]+)\s*,\s*([-0-9.]+)\s*$")

def parse_details(details: str):
    """
    Ex: 'Paris, Île-de-France, France — 48.8566, 2.3522'
    -> {"label":"Paris, Île-de-France, France", "lat":48.8566, "lon":2.3522}
    """
    if not details or details.strip().lower() == "not found":
        return None

    m = _latlon_re.search(details)
    if not m:
        return None

    lat = float(m.group(1))
    lon = float(m.group(2))

    label = details.split("—")[0].strip()
    return {"label": label, "lat": lat, "lon": lon}

def haversine_km(lat1, lon1, lat2, lon2):
    # Rayon moyen de la Terre en km
    R = 6371.0
    p1 = math.radians(lat1)
    p2 = math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlmb = math.radians(lon2 - lon1)

    a = math.sin(dphi / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dlmb / 2) ** 2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R * c

def export_cities_json(filepath="cities.json"):
    trips = []
    cursor = None

    # on prend toutes les lignes qui ont au moins "Arrival details" (ville où on est / arrive)
    filter_payload = {
        "and": [
            {"property": "Arrival details", "rich_text": {"is_not_empty": True}}
        ]
    }

    while True:
        res = query_pages(filter_payload=filter_payload, start_cursor=cursor)

        for page in res.get("results", []):
            name = extract_title(page, "Name") or "Trip"
            trip_type = extract_select(page, "Type") or "Unknown"
            start, end = extract_date_range(page, "Date")  # start/end

            arr_details = extract_rich_text(page, "Arrival details") or ""
            dep_details = extract_rich_text(page, "Departure details") or ""

            arr = parse_details(arr_details)          # Arrival = ville d'arrivée (ou ville du séjour)
            dep = parse_details(dep_details)          # Departure = ville de départ (peut être vide pour séjour)

            if not arr:
                continue

            # --- STAY (pas de departure details) ---
            if not dep:
                trips.append({
                    "kind": "stay",
                    "name": name,
                    "type": trip_type,
                    "arrival": [arr["lat"], arr["lon"]],
                    "arrival_label": arr["label"],
                    # pour un séjour: start = arrivée sur place, end = départ
                    "arrival_date": start,
                    "departure_date": end,
                })
                continue

            # --- TRANSPORT ---
            dist = haversine_km(dep["lat"], dep["lon"], arr["lat"], arr["lon"])
            trips.append({
                "kind": "transport",
                "name": name,
                "type": trip_type,
                "departure": [dep["lat"], dep["lon"]],
                "arrival": [arr["lat"], arr["lon"]],
                "departure_label": dep["label"],
                "arrival_label": arr["label"],
                "distance_km": round(dist, 2),
                # pour un trajet: start = départ, end = arrivée
                "departure_date": start,
                "arrival_date": end,
            })

        if not res.get("has_more"):
            break
        cursor = res.get("next_cursor")

    with open(filepath, "w", encoding="utf-8") as f:
        json.dump(trips, f, ensure_ascii=False, indent=2)

    print(f"Exported {len(trips)} item(s) to {filepath}")


def main():
    a = enrich_details("Arrival", "Arrival details")
    d = enrich_details("Departure", "Departure details")
    print(f"Done. Updated Arrival={a}, Departure={d}")

    # Always export a file (even if empty) so GitHub Actions can commit it.
    export_cities_json("cities.json")

if __name__ == "__main__":
    main()

import html
import json
import os
import re
import time
import urllib.parse
import urllib.request
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parent.parent
SERVER_DIR = PROJECT_ROOT / "server"
UPLOADS_DIR = SERVER_DIR / "uploads"
PRODUCTS_JSON_PATH = SERVER_DIR / "data" / "products.json"

DEFAULT_PLACEHOLDER = "/assets/images/laptop-placeholder.svg"


CATALOG_ITEMS = [
    {"name": "HP ProBook 650 G3", "cpu": "Core i7 7th HQ", "ram": "8GB", "storage": "256GB SSD", "price": 9000},
    {"name": "Dell Latitude 5490", "cpu": "Core i5 8th U", "ram": "8GB", "storage": "256GB SSD", "price": 8500},
    {"name": "Dell Latitude 5590 Touch", "cpu": "Core i7 8th U", "ram": "8GB", "storage": "256GB SSD", "price": 10900},
    {"name": "Dell Precision 3550", "cpu": "Core i5 10th U", "ram": "16GB", "storage": "256GB SSD", "price": 14300},
    {"name": "Dell Precision 3560", "cpu": "Core i5 11th G7", "ram": "16GB", "storage": "256GB SSD", "price": 15300},
    {"name": "HP ProBook 650 G5", "cpu": "Core i5 8th", "ram": "8GB", "storage": "256GB SSD", "price": 9800},
    {"name": "Dell Latitude 5530", "cpu": "Core i7 12th", "ram": "16GB", "storage": "256GB SSD", "price": 20000},
    {"name": "Dell Latitude 5430", "cpu": "Core i5 12th", "ram": "16GB", "storage": "256GB SSD", "price": 15500},
    {"name": "HP EliteBook X360 1040", "cpu": "Core i7 1185G7", "ram": "32GB", "storage": "512GB SSD", "price": 27000},
    {"name": "Dell Latitude 7340", "cpu": "Core i5 1345U", "ram": "16GB", "storage": "512GB SSD", "price": 19500},
    {"name": "HP EliteBook 650 G9", "cpu": "Core i5 1245U", "ram": "16GB", "storage": "256GB SSD", "price": 18700},
    {"name": "Dell Latitude 5570", "cpu": "Core i5 6th HQ", "ram": "8GB", "storage": "256GB SSD", "price": 7700},
    {"name": "Dell Latitude 5580", "cpu": "Core i5 7th U", "ram": "8GB", "storage": "256GB SSD", "price": 8500},
    {"name": "Dell Precision 3510", "cpu": "Core i5 6300HQ", "ram": "8GB", "storage": "256GB SSD", "price": 9000},
    {"name": "Dell Precision 3520", "cpu": "Core i5 7440HQ", "ram": "8GB", "storage": "256GB SSD", "price": 8800},
    {"name": "HP EliteBook 840 G6", "cpu": "Core i5 8365U", "ram": "8GB", "storage": "256GB SSD", "price": 10500},
    {"name": "HP EliteBook 840 G6", "cpu": "Core i7 8365U", "ram": "8GB", "storage": "256GB SSD", "price": 11900},
    {"name": "HP EliteBook 845 G8", "cpu": "Ryzen 5 Pro 5650U", "ram": "16GB", "storage": "256GB SSD", "price": 13900},
    {"name": "Dell Latitude 5511", "cpu": "Core i7 10th H", "ram": "16GB", "storage": "256GB SSD", "price": 15800},
    {
        "name": "Dell Precision 7510",
        "cpu": "Core i7 6820HQ",
        "ram": "16GB",
        "storage": "512GB SSD",
        "gpu": "Nvidia Quadro M2000M",
        "price": 16000,
    },
    {
        "name": "Dell Precision 7510 Touch",
        "cpu": "Core i7 6820HQ",
        "ram": "16GB",
        "storage": "512GB SSD",
        "gpu": "Nvidia Quadro M1000M",
        "price": 14000,
    },
    {
        "name": "Dell Precision 7520",
        "cpu": "Core i7 7820HQ",
        "ram": "16GB",
        "storage": "512GB SSD",
        "gpu": "Nvidia Quadro M1200",
        "price": 17000,
    },
    {
        "name": "Dell Precision 7530",
        "cpu": "Core i7 8850H",
        "ram": "16GB",
        "storage": "512GB SSD",
        "gpu": "Nvidia Quadro 4GB",
        "price": 20000,
    },
    {
        "name": "Dell Precision 7530",
        "cpu": "Xeon E-2186M",
        "ram": "16GB",
        "storage": "512GB SSD",
        "gpu": "Nvidia Quadro 6GB",
        "price": 22000,
    },
    {
        "name": "Dell Precision 7540",
        "cpu": "Core i5 9th H",
        "ram": "16GB",
        "storage": "512GB SSD",
        "gpu": "Nvidia Quadro T2000",
        "price": 19300,
    },
    {
        "name": "Dell Precision 7540",
        "cpu": "Core i7 9th H",
        "ram": "16GB",
        "storage": "512GB SSD",
        "gpu": "Nvidia Quadro T2000",
        "price": 23500,
    },
    {
        "name": "Dell Precision 7540",
        "cpu": "Xeon E-2276M",
        "ram": "16GB",
        "storage": "512GB SSD",
        "gpu": "Nvidia Quadro T2000",
        "price": 23500,
    },
    {
        "name": "Dell Precision 7540",
        "cpu": "Core i9 9th H",
        "ram": "16GB",
        "storage": "512GB SSD",
        "gpu": "Nvidia Quadro T1000",
        "price": 25000,
    },
    {
        "name": "Dell Precision 7680",
        "cpu": "Core i5 13600HX",
        "ram": "16GB",
        "storage": "512GB SSD",
        "gpu": "RTX A1000 6GB",
        "price": 41500,
    },
    {
        "name": "Dell Precision 5520 4K Touch",
        "cpu": "Xeon E3",
        "ram": "16GB",
        "storage": "512GB SSD",
        "gpu": "Nvidia Quadro M1200",
        "price": 17300,
    },
    {
        "name": "Dell Precision 5530",
        "cpu": "Core i7 6th H",
        "ram": "16GB",
        "storage": "512GB SSD",
        "gpu": "Nvidia GTX 960M",
        "price": 14800,
    },
    {
        "name": "Dell Precision 5530",
        "cpu": "Xeon E-2176M",
        "ram": "16GB",
        "storage": "512GB SSD",
        "gpu": "Nvidia Quadro P1000",
        "price": 19800,
    },
    {
        "name": "Dell Precision 5530 Touch",
        "cpu": "Xeon E-2176M",
        "ram": "16GB",
        "storage": "512GB SSD",
        "gpu": "Nvidia Quadro P1000",
        "price": 20800,
    },
    {
        "name": "Dell Precision 5540",
        "cpu": "Core i7 9th H",
        "ram": "16GB",
        "storage": "512GB SSD",
        "gpu": "Nvidia Quadro T1000",
        "price": 23000,
    },
    {
        "name": "Dell Precision 5540 4K Touch",
        "cpu": "Core i7 9th H",
        "ram": "16GB",
        "storage": "512GB SSD",
        "gpu": "Nvidia Quadro T1000",
        "price": 24000,
    },
    {
        "name": "Dell Latitude 5511 Touch",
        "cpu": "Core i7 10th H",
        "ram": "16GB",
        "storage": "256GB SSD",
        "gpu": "Nvidia MX250",
        "price": 17500,
    },
    {
        "name": "Dell Latitude 5521",
        "cpu": "Core i7 11th H",
        "ram": "16GB",
        "storage": "256GB SSD",
        "gpu": "Nvidia MX450",
        "price": 19000,
    },
    {
        "name": "Dell Precision 5570",
        "cpu": "Core i9 12900H",
        "ram": "32GB",
        "storage": "512GB SSD",
        "gpu": "RTX 2000 8GB",
        "price": 50000,
    },
    {
        "name": "Dell Precision 5560",
        "cpu": "Core i7 11850H",
        "ram": "16GB",
        "storage": "512GB SSD",
        "gpu": "RTX A2000",
        "price": 29000,
    },
    {
        "name": "Dell Precision 5760",
        "cpu": "Core i7 11850H",
        "ram": "16GB",
        "storage": "512GB SSD",
        "gpu": "RTX 2000",
        "price": 32500,
    },
    {
        "name": "Dell Precision 3530",
        "cpu": "Core i7 8850H",
        "ram": "16GB",
        "storage": "256GB SSD",
        "gpu": "Quadro P600",
        "price": 16500,
    },
    {
        "name": "Dell Latitude 5591",
        "cpu": "Core i7 8850H",
        "ram": "16GB",
        "storage": "256GB SSD",
        "gpu": "Quadro MX130",
        "price": 15000,
    },
    {
        "name": "HP ZBook Fury G8",
        "cpu": "Core i7 11850H",
        "ram": "32GB",
        "storage": "512GB SSD",
        "gpu": "RTX A2000",
        "price": 32000,
    },
    {
        "name": "HP ZBook Fury G8",
        "cpu": "Core i7 11850H",
        "ram": "32GB",
        "storage": "512GB SSD",
        "gpu": "RTX T1200",
        "price": 30500,
    },
]


def slugify(value: str) -> str:
    value = value.strip().lower()
    value = re.sub(r"[^a-z0-9]+", "-", value)
    value = re.sub(r"-+", "-", value).strip("-")
    return value or "laptop"


def infer_brand(name: str) -> str:
    lower = name.lower()
    if lower.startswith("hp"):
        return "HP"
    if lower.startswith("dell"):
        return "Dell"
    return name.split(" ")[0]


def search_image_candidates(query: str) -> list[str]:
    url = "https://www.bing.com/images/search?" + urllib.parse.urlencode(
        {"q": query, "form": "HDRSC2"}
    )
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=25) as res:
        html_text = res.read().decode("utf-8", errors="ignore")

    matches = re.findall(r' class="iusc"[^>]* m="(\{&quot;.*?\})"', html_text)
    candidates: list[str] = []
    for raw in matches:
        try:
            decoded = html.unescape(raw)
            payload = json.loads(decoded)
            murl = str(payload.get("murl") or "").strip()
            if not murl.startswith("http"):
                continue
            if "bing.net/th?id=" in murl:
                continue
            candidates.append(murl)
        except Exception:
            continue
    return candidates


def extension_from_url(url: str) -> str:
    parsed = urllib.parse.urlparse(url)
    ext = os.path.splitext(parsed.path)[1].lower()
    if ext in {".jpg", ".jpeg", ".png", ".webp", ".gif"}:
        return ext
    return ".jpg"


def download_first_working_image(item: dict, file_stem: str) -> str:
    queries = [
        f"{item['name']} {item.get('cpu', '')} {item.get('gpu', '')} laptop",
        f"{item['name']} laptop",
        item["name"],
    ]
    seen = set()
    candidate_urls: list[str] = []
    for query in queries:
        for candidate in search_image_candidates(query):
            if candidate in seen:
                continue
            seen.add(candidate)
            candidate_urls.append(candidate)
        if len(candidate_urls) >= 20:
            break

    for idx, candidate in enumerate(candidate_urls[:20]):
        try:
            ext = extension_from_url(candidate)
            file_name = f"{file_stem}-{idx + 1}{ext}"
            target = UPLOADS_DIR / file_name
            req = urllib.request.Request(candidate, headers={"User-Agent": "Mozilla/5.0"})
            with urllib.request.urlopen(req, timeout=30) as res:
                content_type = str(res.headers.get("Content-Type", "")).lower()
                data = res.read()
            if not content_type.startswith("image/"):
                continue
            if len(data) < 15_000:
                continue
            target.write_bytes(data)
            return f"/api/uploads/{file_name}"
        except Exception:
            continue
    return DEFAULT_PLACEHOLDER


def build_product_object(item: dict, index: int, image_path: str) -> dict:
    price = int(item["price"])
    gpu_value = str(item.get("gpu") or "Integrated Graphics").strip()
    return {
        "id": f"catalog-{index:03d}",
        "name": item["name"],
        "brand": infer_brand(item["name"]),
        "category": "Laptops",
        "price": price,
        "oldPrice": price,
        "rating": 4.7,
        "stock": 5,
        "isFeatured": index <= 8,
        "shortDescription": f"{item['name']} - {item['cpu']} - {item['ram']} - {item['storage']}",
        "image": image_path,
        "images": [image_path],
        "specs": {
            "cpu": item["cpu"],
            "ram": item["ram"],
            "storage": item["storage"],
            "display": "FHD Display",
            "gpu": gpu_value,
            "warranty": "",
        },
    }


def main() -> None:
    UPLOADS_DIR.mkdir(parents=True, exist_ok=True)
    products = []
    total = len(CATALOG_ITEMS)

    for idx, item in enumerate(CATALOG_ITEMS, start=1):
        slug = slugify(f"{item['name']}-{item.get('cpu', '')}-{item.get('gpu', '')}")[:70]
        print(f"[{idx}/{total}] Fetching image for: {item['name']}")
        image = download_first_working_image(item, slug)
        products.append(build_product_object(item, idx, image))
        time.sleep(0.8)

    PRODUCTS_JSON_PATH.parent.mkdir(parents=True, exist_ok=True)
    PRODUCTS_JSON_PATH.write_text(json.dumps(products, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Saved {len(products)} products to {PRODUCTS_JSON_PATH}")


if __name__ == "__main__":
    main()

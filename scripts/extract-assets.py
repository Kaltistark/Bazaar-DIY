"""Rebuild screenshot-derived Bazaar UI icons. Requires Pillow (pip install Pillow).

Run from any directory: python scripts/extract-assets.py
No generated artwork or downloaded substitutes are used by this extractor.
"""
from __future__ import annotations

import json
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "参考素材"
OUTPUT = ROOT / "public" / "assets"

# Source rectangles use original screenshot pixels, not resized previews.
ICONS = {
    "damage": ("剧毒 伤害 充能.jpg", (768, 196, 815, 243), "red"),
    "heal": ("治疗.jpg", (581, 216, 633, 271), "green"),
    "shield": ("飞行 价值 增益.jpg", (939, 369, 985, 414), "yellow"),
    "burn": ("剧毒 灼烧 生命再生.jpg", (773, 307, 819, 357), "orange"),
    "poison": ("剧毒 伤害 充能.jpg", (1019, 351, 1071, 404), "green"),
    "regen": ("剧毒 灼烧 生命再生.jpg", (926, 235, 972, 282), "green"),
    "health": ("生命再生.jpg", (589, 424, 641, 474), "green"),
    "haste": ("加速.jpg", (865, 186, 916, 241), "cyan"),
    "charge": ("剧毒 伤害 充能.jpg", (656, 487, 705, 544), "cyan"),
    "cooldown": ("冷却.jpg", (538, 204, 582, 249), "cream"),
    "slow": ("减速.jpg", (617, 207, 665, 265), "cream"),
    "freeze": ("冻结.jpg", (850, 292, 901, 343), "blue"),
    "crit": ("暴击.jpg", (513, 310, 564, 364), "red"),
    "ammo": ("弹药.jpg", (570, 339, 620, 389), "orange"),
    "lifesteal": ("吸血.jpg", (651, 335, 700, 378), "pink"),
    "rage": ("怒火 暴怒.jpg", (701, 463, 752, 517), "pink"),
    "gold": ("黄金 价值.jpg", (790, 452, 840, 500), "yellow"),
    "income": ("关键词标签.png", (213, 127, 235, 152), "yellow"),
    "value": ("黄金 价值.jpg", (432, 376, 483, 426), "yellow"),
    "flight": ("飞行 价值 增益.jpg", (1026, 226, 1072, 268), "yellow"),
    "tempo": ("获得节奏.jpg", (821, 178, 864, 229), "purple"),
    "multicast": ("多重释放.jpg", (293, 402, 340, 448), "cream"),
    "destroy": ("黄金 价值.jpg", (675, 295, 726, 345), "pink"),
}

HEROES = {
    "vanessa": ("多重释放.jpg", (711, 84, 798, 166)),
    "pygmalien": ("飞行 价值 增益.jpg", (1050, 95, 1138, 182)),
    "dooley": ("剧毒 伤害 充能.jpg", (1027, 78, 1118, 157)),
    "mak": ("生命再生.jpg", (1024, 107, 1114, 179)),
    "karnok": ("怒火 暴怒.jpg", (1013, 94, 1111, 171)),
    # The shared mark shown on neutral/monster items. Not The Dragons' portrait.
    "neutral": ("摧毁.jpg", (824, 89, 912, 168)),
    "dragons": ("获得节奏.jpg", (868, 55, 957, 139)),
}


def colored(rgb: tuple[int, int, int], kind: str) -> bool:
    r, g, b = rgb
    return {
        "red": r > 110 and r > g * 1.45 and r > b * 1.4,
        "green": g > 110 and g > r * 1.2 and g > b * 1.2,
        "yellow": r > 140 and g > 115 and b < min(r, g) * .6,
        "orange": r > 145 and 65 < g < r * .85 and b < g * .65,
        "cyan": g > 125 and b > 100 and r < g * .6,
        "blue": b > 135 and g > 95 and r < b * .65,
        "cream": r > 135 and g > 105 and b > 65,
        "pink": r > 100 and b > 40 and g < r * .65,
        "purple": b > 125 and b > g * 1.08,
        "hero": r > 76 and g > 46 and r > g * 1.14 and b < g * .85,
    }[kind]


def select_largest_component(mask: Image.Image) -> Image.Image:
    """Reject neighboring text fragments caught at the edge of a tight crop."""
    w, h = mask.size
    pixels = list(mask.getdata())
    seen = set()
    components = []
    for start, value in enumerate(pixels):
        if not value or start in seen:
            continue
        stack, component = [start], []
        seen.add(start)
        while stack:
            n = stack.pop()
            component.append(n)
            x, y = n % w, n // w
            for nx, ny in ((x-1,y), (x+1,y), (x,y-1), (x,y+1)):
                if 0 <= nx < w and 0 <= ny < h:
                    q = ny*w+nx
                    if pixels[q] and q not in seen:
                        seen.add(q)
                        stack.append(q)
        components.append(component)
    out = Image.new("L", (w, h), 0)
    if components:
        # Keep detached strokes in glyphs (ammo bullets, haste speed lines etc.)
        # Only reject very small unrelated fragments near the image boundary.
        biggest = max(map(len, components))
        data = [0] * (w * h)
        for component in components:
            if len(component) >= max(5, biggest * .07):
                for n in component:
                    data[n] = 255
        out.putdata(data)
    return out


def fill_enclosed_holes(mask: Image.Image) -> Image.Image:
    """Retain black interior details instead of punching through the silhouette."""
    w, h = mask.size
    values = list(mask.getdata())
    seeds = [x for x in range(w)] + [(h-1)*w+x for x in range(w)]
    seeds += [y*w for y in range(h)] + [y*w+w-1 for y in range(h)]
    outside = set()
    stack = [p for p in seeds if values[p] == 0]
    outside.update(stack)
    while stack:
        n = stack.pop()
        x, y = n % w, n // w
        for nx, ny in ((x-1,y), (x+1,y), (x,y-1), (x,y+1)):
            if 0 <= nx < w and 0 <= ny < h:
                q = ny*w+nx
                if not values[q] and q not in outside:
                    outside.add(q)
                    stack.append(q)
    mask.putdata([0 if n in outside else 255 for n in range(w*h)])
    return mask


def extract(file: str, rect: tuple[int, ...], kind: str) -> Image.Image:
    crop = Image.open(SOURCE / file).convert("RGB").crop(rect)
    mask = Image.new("L", crop.size)
    mask.putdata([255 if colored(p, kind) else 0 for p in crop.getdata()])
    mask = select_largest_component(mask)
    if kind == "hero":
        # Hero insignia use the transparent negative space as their facial lines.
        mask = mask.filter(ImageFilter.GaussianBlur(.35))
    else:
        mask = fill_enclosed_holes(mask.filter(ImageFilter.MaxFilter(5)))
        mask = mask.filter(ImageFilter.GaussianBlur(.35))
    crop = crop.convert("RGBA")
    crop.putalpha(mask)
    bounds = mask.getbbox()
    if not bounds:
        raise ValueError(f"Empty icon extraction: {file} {rect}")
    crop = crop.crop(bounds)
    output = Image.new("RGBA", (crop.width+4, crop.height+4))
    output.paste(crop, (2, 2))
    return output


def main() -> None:
    manifest = {"version": 1, "icons": {}, "heroes": {}, "unavailable": {
        "icons": {
            "quest": "任务标签仅含文字；素材没有独立任务图标。",
            "enrage": "暴怒仅有文字换色，素材未显示独立图标。",
        },
        "heroes": ["stelle", "jules"],
    }}
    for directory, values in (("icons", ICONS), ("heroes", HEROES)):
        (OUTPUT / directory).mkdir(parents=True, exist_ok=True)
        for key, entry in values.items():
            file, rect = entry[:2]
            kind = entry[2] if directory == "icons" else "hero"
            icon = extract(file, rect, kind)
            path = OUTPUT / directory / f"{key}.png"
            icon.save(path)
            manifest[directory][key] = {
                "path": f"/assets/{directory}/{key}.png",
                "source": f"参考素材/{file}", "rect": list(rect),
                "width": icon.width, "height": icon.height,
            }
    (OUTPUT / "assets-manifest.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    # Check sheet is a local development artifact, not an application asset.
    entries = [(directory, key) for directory in ("icons", "heroes") for key in manifest[directory]]
    sheet = Image.new("RGB", (720, ((len(entries)+5)//6)*124), "#20160e")
    draw = ImageDraw.Draw(sheet)
    for i, (directory, key) in enumerate(entries):
        x, y = (i % 6)*120, (i//6)*124
        draw.text((x+6, y+5), key, fill="white")
        icon = Image.open(OUTPUT / directory / f"{key}.png")
        scale = min(2, 95/max(icon.size))
        icon = icon.resize((round(icon.width*scale), round(icon.height*scale)), Image.Resampling.LANCZOS)
        sheet.paste(icon, (x+(120-icon.width)//2, y+24), icon)
    sheet.save(ROOT / "docs" / "extracted-assets-preview.png")
    print(f"Extracted {len(manifest['icons'])} icons and {len(manifest['heroes'])} hero marks.")


if __name__ == "__main__":
    main()

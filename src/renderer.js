import {
  QUALITIES,
  SIZES,
  HEROES,
  KEYWORDS,
  BADGE_ORDER,
  TYPES,
} from "./data.js";
import {
  resolveTier,
  available,
  displayText,
  extractStats,
  questTarget,
  questComplete,
} from "./model.js";
const CREAM = "#ffe4b3",
  TITLE_FONT = "BazaarTitle",
  BODY_FONT = "BazaarBody",
  NUMBER_FONT = "BazaarNumbers";
const cap = (s) => s[0].toUpperCase() + s.slice(1);
const imageFor = (src) =>
  new Promise((resolve) => {
    const im = new Image();
    im.onload = () => resolve(im);
    im.onerror = () => resolve(null);
    im.src = src;
  });
export class Renderer {
  constructor() {
    this.images = new Map();
    this.art = null;
    this.artSource = null;
    this.lastLayout = null;
  }
  async load() {
    const list = [
      ["background", "/assets/ui/Tooltip_BG_TUI.png"],
      ["arrow", "/assets/ui/Tooltip_Arrow_TUI.png"],
      ["critDivider", "/assets/ui/Tooltip_Crit_Divider_TUI.png"],
      ["icon-fusion", "/assets/icons/fusion.png"],
      ["questDivider", "/assets/ui/Tooltip_Quest_Divider_TUI.png"],
      ["questVertical", "/assets/ui/Tooltip_Quest_DividerVertical_TUI.png"],
      ["questFrame", "/assets/ui/Tooltip_Quest_Frame_TUI.png"],
      ["icon-quest-lock", "/assets/icons/quest-lock.png"],
    ];
    for (const q of QUALITIES) {
      for (const s of Object.keys(SIZES))
        list.push([
          `frame-${q.id}-${s}`,
          `/assets/frames/Card_PreviewFrame_${cap(q.id)}_${cap(s)}_TUI.png`,
        ]);
      for (const suffix of [
        "Title",
        "Frame_Active",
        "Passive",
        "Clock",
        "Ammo",
      ])
        list.push([
          `${q.id}-${suffix}`,
          `/assets/ui/Tooltip_${cap(q.id)}_${suffix}_TUI.png`,
        ]);
    }
    for (const k of KEYWORDS.filter((k) => k.icon))
      list.push([`icon-${k.icon}`, `/assets/icons/${k.icon}.png`]);
    for (const [id] of HEROES)
      list.push([`hero-${id}`, `/assets/heroes/${id}.png`]);
    for (const id of BADGE_ORDER)
      list.push([
        `gem-${id}`,
        `/assets/gems/Card_PreviewGem_${id === "regen" ? "Regen" : cap(id)}_TUI.png`,
      ]);
    await Promise.all(
      list.map(async ([id, url]) => {
        const im = await imageFor("." + url);
        if (im) this.images.set(id, im);
      }),
    );
    await Promise.allSettled(
      [
        new FontFace(BODY_FONT, "url(./assets/fonts/NotoSansSC-Bold.woff2)", {
          weight: "700",
        }),
        new FontFace(
          TITLE_FONT,
          "url(./assets/fonts/NotoSerifSC-SemiBold.woff2)",
          { weight: "600" },
        ),
        new FontFace(
          NUMBER_FONT,
          "url(./assets/fonts/BazaarNumbersWeb-Regular.woff2)",
          { weight: "400" },
        ),
      ].map(async (f) => document.fonts.add(await f.load())),
    );
  }
  async setArt(source) {
    if (source === this.artSource) return;
    this.artSource = source;
    this.art = source ? await imageFor(source) : null;
  }
  image(ctx, key, x, y, w, h) {
    const im = this.images.get(key);
    if (im) ctx.drawImage(im, x, y, w, h);
    return !!im;
  }
  tinted(key, color) {
    const cacheKey = `${key}-${color}`;
    if (this.images.has(cacheKey)) return cacheKey;
    const image = this.images.get(key);
    if (!image) return key;
    const canvas = document.createElement("canvas");
    canvas.width = image.width;
    canvas.height = image.height;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(image, 0, 0);
    ctx.globalCompositeOperation = "source-in";
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    this.images.set(cacheKey, canvas);
    return cacheKey;
  }
  nine(ctx, key, x, y, w, h, border = 100, dest = 22) {
    const im = this.images.get(key);
    if (!im) return false;
    const b =
      typeof border === "number" ? [border, border, border, border] : border;
    const d = typeof dest === "number" ? [dest, dest, dest, dest] : dest;
    const sx = [0, b[0], im.width - b[2], im.width],
      sy = [0, b[1], im.height - b[3], im.height],
      dx = [x, x + d[0], x + w - d[2], x + w],
      dy = [y, y + d[1], y + h - d[3], y + h];
    for (let row = 0; row < 3; row++)
      for (let col = 0; col < 3; col++) {
        const sw = sx[col + 1] - sx[col],
          sh = sy[row + 1] - sy[row],
          dw = dx[col + 1] - dx[col],
          dh = dy[row + 1] - dy[row];
        if (sw > 0 && sh > 0 && dw > 0 && dh > 0)
          ctx.drawImage(im, sx[col], sy[row], sw, sh, dx[col], dy[row], dw, dh);
      }
    return true;
  }
  outlineText(
    ctx,
    text,
    x,
    y,
    color,
    size = 22,
    align = "left",
    font = BODY_FONT,
  ) {
    if (/^-?\d[\d.%]*$/.test(text)) font = NUMBER_FONT;
    ctx.font = `${font === TITLE_FONT ? 600 : font === NUMBER_FONT ? 400 : 700} ${size}px "${font}", "Microsoft YaHei", sans-serif`;
    ctx.textAlign = align;
    ctx.textBaseline = "alphabetic";
    ctx.lineJoin = "round";
    ctx.lineWidth = Math.max(1.6, size * 0.09);
    ctx.strokeStyle = "#110b08";
    ctx.strokeText(text, x, y);
    ctx.fillStyle = color;
    ctx.fillText(text, x, y);
  }
  rich(parts) {
    const runs = [];
    const aliases = KEYWORDS.flatMap((k) =>
      k.aliases.map((a) => ({ a, k })),
    ).sort((a, b) => b.a.length - a.a.length);
    for (const part of parts) {
      if (part.type === "number") {
        runs.push({ ...part, kind: "number", color: CREAM });
        continue;
      }
      let rest = part.text;
      while (rest) {
        let matched = aliases.find(
          ({ a, k }) =>
            rest.startsWith(a) &&
            !(k.id === "gold" && /^黄金(?:级|品质)/.test(rest)),
        );
        if (matched) {
          const { a, k } = matched;
          runs.push({
            kind: "word",
            text: a,
            color: k.color,
            icon: k.icon,
            id: k.id,
          });
          rest = rest.slice(a.length);
          continue;
        }
        const type = TYPES.find((t) => rest.startsWith(t));
        if (type) {
          runs.push({ kind: "word", text: type, color: "#b3baff" });
          rest = rest.slice(type.length);
          continue;
        }
        const ch = [...rest][0];
        runs.push({ kind: "text", text: ch, color: CREAM });
        rest = rest.slice(ch.length);
      }
    }
    for (let i = 0; i < runs.length; i++) {
      const r = runs[i];
      if (r.kind !== "number") continue;
      const next = runs[i + 1],
        prev = runs[i - 1];
      if (next?.kind === "word" && next.id) {
        r.color = next.color;
        r.icon = next.icon;
        next.icon = null;
      } else if (prev?.kind === "word" && prev.id) {
        r.color = prev.color;
        if (prev.id === "heal" || prev.id === "regen") {
          r.icon = prev.icon;
          prev.icon = null;
        }
      } else {
        const context = runs
          .slice(Math.max(0, i - 7), i)
          .reverse()
          .find((v) => v.id);
        if (context) r.color = context.color;
      }
      if (next?.id === "health" && prev?.id === "heal") {
        r.color = prev.color;
        r.icon = "heal";
        next.icon = null;
        prev.icon = null;
      }
    }
    return runs;
  }
  units(ctx, runs, size) {
    const units = [];
    const measure = (text) => {
      const numeric = /^-?\d[\d.%]*$/.test(text);
      ctx.font = `${numeric ? 400 : 700} ${size}px "${numeric ? NUMBER_FONT : BODY_FONT}",sans-serif`;
      return ctx.measureText(text).width;
    };
    for (const r of runs) {
      if (r.values) {
        r.values.forEach((v, i) => {
          if (i)
            units.push({
              icon: "fusion",
              color: "#b7e9ec",
              width: size * 0.9,
            });
          units.push({
            text: v.value,
            icon: i === 0 ? r.icon : null,
            color: v.color,
            width: measure(v.value) + (i === 0 && r.icon ? size * 1.13 : 0),
            number: true,
          });
        });
      } else {
        const pieces = ["number", "word"].includes(r.kind)
          ? [r.text]
          : [...r.text];
        for (const [index, text] of pieces.entries())
          units.push({
            text,
            icon: index === 0 ? r.icon : null,
            color: r.color,
            width: measure(text) + (index === 0 && r.icon ? size * 1.13 : 0),
            newline: text === "\n",
          });
      }
    }
    return units;
  }
  wrap(ctx, runs, width, size = 22) {
    const units = this.units(ctx, runs, size),
      lines = [[]];
    let used = 0;
    for (const unit of units) {
      if (unit.newline) {
        lines.push([]);
        used = 0;
        continue;
      }
      if (used + unit.width > width && lines.at(-1).length) {
        lines.push([]);
        used = 0;
      }
      lines.at(-1).push(unit);
      used += unit.width;
    }
    return lines;
  }
  icon(ctx, id, x, y, size) {
    if (this.image(ctx, `icon-${id}`, x, y, size, size)) return;
    const symbols = {
      damage: "✹",
      heal: "✚",
      health: "✚",
      regen: "✚",
      shield: "◈",
      burn: "♨",
      poison: "☠",
      haste: "◴",
      charge: "ϟ",
      freeze: "❄",
      crit: "⊕",
      ammo: "▥",
      flying: "➤",
      tempo: "♪",
      destroy: "◀",
      multicast: "»",
    };
    this.outlineText(
      ctx,
      symbols[id] || "◆",
      x + size / 2,
      y + size * 0.82,
      KEYWORDS.find((k) => k.id === id)?.color || CREAM,
      size,
      "center",
    );
  }
  paintLines(ctx, lines, x, y, size = 22, lineHeight = 32) {
    for (const line of lines) {
      let cursor = x;
      for (const unit of line) {
        if (unit.icon)
          this.icon(ctx, unit.icon, cursor, y - size * 0.91, size * 1.04);
        if (unit.text)
          this.outlineText(
            ctx,
            unit.text,
            cursor + (unit.icon ? size * 1.13 : 0),
            y,
            unit.color,
            size,
          );
        cursor += unit.width;
      }
      y += lineHeight;
    }
    return y;
  }
  sequence(ctx, values, centerX, y, size, maxWidth) {
    const measure = (fs) => {
      ctx.font = `400 ${fs}px "${NUMBER_FONT}"`;
      return (
        values.reduce((sum, v) => sum + ctx.measureText(v.value).width, 0) +
        (values.length - 1) * fs * 0.75
      );
    };
    let width = measure(size);
    if (width > maxWidth) {
      size *= maxWidth / width;
      width = measure(size);
    }
    let x = centerX - width / 2;
    values.forEach((v, i) => {
      if (i) {
        this.icon(ctx, "fusion", x, y - size * 0.83, size * 0.7);
        x += size * 0.75;
      }
      ctx.font = `400 ${size}px "${NUMBER_FONT}"`;
      const w = ctx.measureText(v.value).width;
      this.outlineText(ctx, v.value, x, y, v.color, size);
      x += w;
    });
  }
  panel(ctx, quality, kind, x, y, w, h) {
    ctx.save();
    cutRect(ctx, x + 3, y + 3, w - 6, h - 6, kind === "title" ? 15 : 11);
    ctx.clip();
    ctx.fillStyle = "#201307";
    ctx.fillRect(x, y, w, h);
    this.image(ctx, "background", x, y, w, h);
    ctx.restore();
    let ok = false;
    if (kind === "title")
      ok = this.nine(
        ctx,
        `${quality}-Title`,
        x,
        y,
        w,
        h,
        [80, 50, 80, 10],
        [25, 19, 25, 4],
      );
    else if (kind === "active")
      ok = this.nine(ctx, `${quality}-Frame_Active`, x, y, w, h, 120, 28);
    else
      ok = this.nine(
        ctx,
        `${quality}-Passive`,
        x,
        y,
        w,
        h,
        [85, 0, 85, 170],
        [25, 0, 25, 38],
      );
    if (!ok) {
      ctx.strokeStyle = QUALITIES.find((q) => q.id === quality).color;
      ctx.lineWidth = 2;
      cutRect(ctx, x + 2, y + 2, w - 4, h - 4, 12);
      ctx.stroke();
    }
  }
  layout(ctx, project, current, mode, stacked = false) {
    const tier = resolveTier(
      project,
      mode === "all" ? project.initial : current,
    );
    if (mode === "all") {
      const values = available(project).map((q) => resolveTier(project, q.id));
      tier.ammoEnabled = values.some((t) => t.ammoEnabled);
      tier.critEnabled = values.some((t) => t.critEnabled);
      if (tier.cd === "") tier.cd = values.find((t) => t.cd !== "")?.cd || "";
    }
    const quality = mode === "all" ? project.initial : current;
    const size = 22,
      lineHeight = 32,
      descW = 440;
    const ammoValues = (
      mode === "all"
        ? available(project)
        : [QUALITIES.find((q) => q.id === current)]
    ).map((q) => {
      const t = resolveTier(project, q.id);
      return { value: t.ammoEnabled ? String(t.ammo) : "—", color: q.color };
    });
    const ammoVariable = ammoValues.some(
      (v) => v.value !== ammoValues[0].value,
    );
    const ammoW = ammoVariable
      ? Math.min(
          130,
          Math.max(
            70,
            ammoValues.reduce((n, v) => n + v.value.length * 10, 0) +
              (ammoValues.length - 1) * 11 +
              18,
          ),
        )
      : 43;
    const effectWidth = descW - 120 - (tier.ammoEnabled ? ammoW / 2 + 8 : 0);
    const effectLines = tier.active
      ? tier.effects.map((_, i) =>
          this.wrap(
            ctx,
            this.rich(displayText(project, current, (t) => t.effects[i], mode)),
            effectWidth,
            size,
          ),
        )
      : [];
    const activeH = tier.active
      ? Math.max(
          88,
          effectLines.reduce((sum, l) => sum + l.length * lineHeight + 15, 0) +
            25,
        ) + (tier.critEnabled ? 55 : 0)
      : 0;
    const passiveParts = displayText(project, current, (t) => t.passive, mode),
      passiveLines = tier.passive
        ? this.wrap(ctx, this.rich(passiveParts), descW - 44, size)
        : [];
    const quests = tier.quests.map((q, i) => {
      const qualities =
        mode === "all"
          ? available(project)
          : [QUALITIES.find((q) => q.id === current)];
      const targets = qualities.map((quality) => ({
        value: String(
          questTarget(resolveTier(project, quality.id).quests[i] || q),
        ),
        color: quality.color,
      }));
      const variable = targets.some((t) => t.value !== targets[0].value);
      const counterW = Math.min(
        120,
        Math.max(
          35,
          variable
            ? targets.reduce((n, v) => n + v.value.length * 8, 0) +
                (targets.length - 1) * 11 +
                8
            : Math.max(
                String(q.progress).length * 19,
                targets[0].value.length * 9 + 8,
              ),
        ),
      );
      const textW = descW - 90 - counterW;
      const condition = this.wrap(
        ctx,
        this.rich(
          displayText(
            project,
            current,
            (t) => t.quests[i]?.condition || "",
            mode,
          ),
        ),
        textW,
        22,
      );
      const reward = this.wrap(
        ctx,
        this.rich(
          displayText(project, current, (t) => t.quests[i]?.reward || "", mode),
        ),
        textW,
        16,
      );
      const h = Math.max(99, condition.length * 32 + reward.length * 24 + 42);
      const kw = KEYWORDS.find(
        (k) => k.icon && k.aliases.some((a) => q.reward.includes(a)),
      );
      return {
        q,
        condition,
        reward,
        h,
        targets,
        variable,
        counterW,
        icon: q.icon === "auto" ? kw?.icon || "value" : q.icon,
      };
    });
    const lockedRewards = quests
      .filter((row) => row.q.locked)
      .map((row) => {
        const index = tier.quests.indexOf(row.q);
        const runs = this.rich(
          displayText(
            project,
            current,
            (t) => t.quests[index]?.reward || "",
            mode,
          ),
        );
        const locked = !questComplete(row.q);
        if (locked)
          for (const r of runs) {
            r.color = "#ffcd92";
            if (r.values)
              r.values = r.values.map((v) => ({ ...v, color: "#ffcd92" }));
          }
        const lines = this.wrap(ctx, runs, descW - 85, 20);
        return { lines, locked, h: lines.length * 28 + 26 };
      });
    const passiveH = quests.length
      ? (passiveLines.length ? passiveLines.length * lineHeight + 32 : 20) +
        lockedRewards.reduce((sum, r) => sum + r.h + 10, 0) +
        quests.reduce((sum, r) => sum + r.h, 0) +
        25
      : passiveLines.length
        ? passiveLines.length * lineHeight + 44
        : 0;
    const title = project.name || "未命名物品";
    let titleSize = 30;
    ctx.font = `600 ${titleSize}px "${TITLE_FONT}",serif`;
    if (ctx.measureText(title).width > descW - 112) titleSize = 24;
    const titleLines = this.wrap(
      ctx,
      [{ kind: "text", text: title, color: CREAM }],
      descW - 110,
      titleSize,
    );
    const titleH = Math.max(70, titleLines.length * (titleSize + 8) + 26);
    let tagH = 30,
      tagW = 0;
    ctx.font = `700 17px "${BODY_FONT}"`;
    for (const type of [SIZES[project.size].name, ...project.types]) {
      const w = ctx.measureText(type).width + 21;
      if (tagW + w > descW && tagW) {
        tagH += 29;
        tagW = 0;
      }
      tagW += w;
    }
    const artScale = stacked
      ? Math.min(360 / SIZES[project.size].width, 240 / 520)
      : 1;
    const cardW = SIZES[project.size].width * artScale,
      cardH = 520 * artScale,
      descH = tagH + titleH + activeH + passiveH;
    const margin = 32;
    const extraRight = tier.ammoEnabled ? Math.max(0, ammoW / 2 - margin) : 0;
    const width =
      (stacked
        ? Math.max(cardW, descW) + margin * 2
        : cardW + descW + margin * 2 + 52) + extraRight;
    const height = stacked
      ? cardH + descH + margin * 2 + 60
      : Math.max(cardH + 30, descH) + margin * 2;
    const art = {
      x: stacked ? (width - cardW) / 2 : margin,
      y: stacked ? margin + 24 : (height - cardH) / 2 + 10,
      w: cardW,
      h: cardH,
      scale: artScale,
    };
    const desc = {
      x: stacked ? (width - descW) / 2 : art.x + cardW + 52,
      y: stacked ? art.y + cardH + 40 : (height - descH) / 2,
      w: descW,
      h: descH,
    };
    return {
      width,
      height,
      art,
      desc,
      quality,
      tier,
      size,
      lineHeight,
      effectLines,
      activeH,
      passiveLines,
      passiveH,
      quests,
      lockedRewards,
      title,
      titleSize,
      titleLines,
      titleH,
      tagH,
      ammoValues,
      ammoVariable,
      ammoW,
    };
  }
  render(
    canvas,
    project,
    current,
    {
      mode = "current",
      scale = 1,
      background = "transparent",
      stacked = false,
    } = {},
  ) {
    let ctx = canvas.getContext("2d");
    const l = this.layout(ctx, project, current, mode, stacked);
    if (
      l.height * scale > 16384 ||
      l.width * l.height * scale * scale > 65_000_000
    )
      throw new Error("内容过长，请减少文字或选择较低清晰度");
    canvas.width = Math.ceil(l.width * scale);
    canvas.height = Math.ceil(l.height * scale);
    ctx = canvas.getContext("2d");
    ctx.scale(scale, scale);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    if (background === "dark") {
      ctx.fillStyle = "#141b1e";
      ctx.fillRect(0, 0, l.width, l.height);
    }
    const { art: a, desc: d, tier, quality } = l;
    ctx.save();
    const inset = a.scale;
    cutRect(
      ctx,
      a.x + 20 * inset,
      a.y + 21 * inset,
      a.w - 40 * inset,
      a.h - 43 * inset,
      9 * inset,
    );
    ctx.clip();
    if (this.art) {
      const fit =
        Math.max(
          (a.w - 40 * inset) / this.art.width,
          (a.h - 43 * inset) / this.art.height,
        ) * project.crop.zoom;
      const dw = this.art.width * fit,
        dh = this.art.height * fit;
      ctx.drawImage(
        this.art,
        a.x + a.w / 2 - dw / 2 + project.crop.x * a.w,
        a.y + a.h / 2 - dh / 2 + project.crop.y * a.h,
        dw,
        dh,
      );
    } else {
      const grad = ctx.createLinearGradient(a.x, a.y, a.x + a.w, a.y + a.h);
      grad.addColorStop(0, "#283b3b");
      grad.addColorStop(0.6, "#172526");
      grad.addColorStop(1, "#332b22");
      ctx.fillStyle = grad;
      ctx.fillRect(a.x, a.y, a.w, a.h);
    }
    ctx.restore();
    this.image(ctx, `frame-${quality}-${project.size}`, a.x, a.y, a.w, a.h);
    const stats = extractStats(tier),
      ids = BADGE_ORDER.filter((id) => stats[id] !== undefined),
      badgeW = Math.min(
        92 * inset,
        (a.w - 14 * inset) / Math.max(1, ids.length),
      ),
      badgeH = 47 * inset,
      start = a.x + (a.w - ids.length * badgeW) / 2;
    ids.forEach((id, i) => {
      const x = start + i * badgeW;
      this.image(ctx, `gem-${id}`, x, a.y - 19 * inset, badgeW, badgeH);
      this.outlineText(
        ctx,
        String(stats[id]),
        x + badgeW / 2,
        a.y + 16 * inset,
        "#fff8ed",
        Math.min(34 * inset, badgeW * 0.43),
        "center",
      );
    });
    let tx = d.x,
      ty = d.y;
    ctx.font = `700 17px "${BODY_FONT}",sans-serif`;
    for (const type of [SIZES[project.size].name, ...project.types]) {
      ctx.font = `700 17px "${BODY_FONT}"`;
      const w = ctx.measureText(type).width + 16;
      if (tx + w > d.x + d.w) {
        tx = d.x;
        ty += 29;
      }
      ctx.fillStyle = "#1c182ad9";
      roundRect(ctx, tx, ty, w, 26, 5);
      ctx.fill();
      this.outlineText(ctx, type, tx + 8, ty + 20, "#aeb9fb", 17);
      tx += w + 5;
    }
    let y = d.y + l.tagH;
    this.panel(ctx, quality, "title", d.x, y, d.w, l.titleH);
    l.titleLines.forEach((line, i) =>
      this.outlineText(
        ctx,
        line.map((u) => u.text).join(""),
        d.x + 24,
        y + 25 + l.titleSize + i * (l.titleSize + 8),
        CREAM,
        l.titleSize,
        "left",
        TITLE_FONT,
      ),
    );
    const hero = this.images.get(`hero-${project.hero}`);
    if (hero) {
      const side = 51,
        ratio = Math.min(side / hero.width, side / hero.height);
      ctx.drawImage(
        hero,
        d.x + d.w - 70 + (side - hero.width * ratio) / 2,
        y + (l.titleH - hero.height * ratio) / 2,
        hero.width * ratio,
        hero.height * ratio,
      );
    }
    y += l.titleH - 2;
    if (tier.active) {
      this.panel(ctx, quality, "active", d.x, y, d.w, l.activeH);
      let ey = y + 34;
      l.effectLines.forEach((lines) => {
        this.image(ctx, "arrow", d.x + 69, ey - 17, 16, 14);
        this.paintLines(ctx, lines, d.x + 96, ey, l.size, l.lineHeight);
        ey += lines.length * l.lineHeight + 15;
      });
      if (tier.critEnabled) {
        const cy = y + l.activeH - 40;
        this.image(ctx, "critDivider", d.x + 40, cy - 12, d.w - 65, 2);
        const runs = [
            { kind: "text", text: "暴击率：", color: CREAM },
            ...this.rich([
              ...displayText(
                project,
                current,
                (t) => `${t.critEnabled ? t.crit : 0}%`,
                mode,
              ),
            ]).map((r, i) => ({
              ...r,
              color: "#f34137",
              icon: i === 0 ? "crit" : r.icon,
            })),
          ],
          lines = this.wrap(ctx, runs, d.w - 80, 22);
        this.paintLines(ctx, lines, d.x + 95, cy + 17, 22, 31);
      }
      if (tier.cd !== "") {
        const clockW = 118,
          clockH = 108,
          cx = d.x - 50,
          cy = y + (l.activeH - clockH) / 2;
        this.image(ctx, `${quality}-Clock`, cx, cy, clockW, clockH);
        const values = (
          mode === "all"
            ? available(project)
            : [QUALITIES.find((q) => q.id === current)]
        ).map((q) => ({
          value: resolveTier(project, q.id).cd,
          color: q.color,
        }));
        const same = values.every(
          (v) => Number(v.value) === Number(values[0].value),
        );
        if (same)
          this.outlineText(
            ctx,
            Number(values[0].value).toFixed(1),
            cx + clockW * 0.45,
            cy + 61,
            "#ffffff",
            38,
            "center",
          );
        else {
          this.sequence(
            ctx,
            values.map((v) => ({
              ...v,
              value: v.value === "" ? "—" : String(Number(v.value)),
            })),
            cx + clockW * 0.45,
            cy + 55,
            20,
            87,
          );
        }
        this.outlineText(
          ctx,
          "秒",
          cx + clockW * 0.45,
          cy + 82,
          "#e8a35e",
          18,
          "center",
        );
      }
      if (tier.ammoEnabled) {
        const ax = d.x + d.w - l.ammoW / 2,
          ay = y + 12;
        this.image(ctx, `${quality}-Ammo`, ax, ay, l.ammoW, 76);
        this.icon(ctx, "ammo", ax + l.ammoW / 2 - 12, ay + 8, 24);
        if (!l.ammoVariable)
          this.outlineText(
            ctx,
            l.ammoValues[0].value,
            ax + l.ammoW / 2,
            ay + 59,
            "#ffad28",
            24,
            "center",
          );
        else
          this.sequence(
            ctx,
            l.ammoValues,
            ax + l.ammoW / 2,
            ay + 56,
            16,
            l.ammoW - 10,
          );
      }
      y += l.activeH - 2;
    }
    if (l.passiveH) {
      this.panel(ctx, quality, "passive", d.x, y, d.w, l.passiveH);
      this.paintLines(
        ctx,
        l.passiveLines,
        d.x + 23,
        y + 33,
        l.size,
        l.lineHeight,
      );
      let qy =
        y +
        (l.passiveLines.length
          ? l.passiveLines.length * l.lineHeight + 32
          : 20);
      for (const reward of l.lockedRewards) {
        this.nine(
          ctx,
          "questFrame",
          d.x + 19,
          qy,
          d.w - 38,
          reward.h,
          [22, 24, 3, 24],
          [9, 10, 2, 10],
        );
        ctx.save();
        if (reward.locked) ctx.globalAlpha = 0.49;
        this.image(
          ctx,
          reward.locked ? this.tinted("icon-quest-lock", "#ffcd92") : "arrow",
          d.x + 29,
          qy + (reward.h - (reward.locked ? 28 : 18)) / 2,
          23,
          reward.locked ? 28 : 18,
        );
        this.paintLines(ctx, reward.lines, d.x + 63, qy + 29, 20, 28);
        ctx.restore();
        qy += reward.h + 10;
      }
      for (const row of l.quests) {
        this.nine(
          ctx,
          this.tinted("questDivider", "#a67938"),
          d.x + 16,
          qy,
          d.w - 32,
          7,
          [31, 0, 34, 0],
          [10, 0, 11, 0],
        );
        const textH = row.condition.length * 32 + row.reward.length * 24;
        const textY = qy + 8 + (row.h - 8 - textH) / 2 + 23;
        this.paintLines(ctx, row.condition, d.x + 23, textY, 22, 32);
        this.paintLines(
          ctx,
          row.reward,
          d.x + 23,
          textY + row.condition.length * 32 - 4,
          16,
          24,
        );
        const iconX = d.x + d.w - 43,
          midY = qy + row.h / 2 + 3;
        this.image(
          ctx,
          this.tinted("questVertical", "#a67938"),
          iconX - 17,
          midY - 23,
          10,
          46,
        );
        this.icon(ctx, row.icon, iconX, midY - 14, 27);
        const countX = iconX - 27 - row.counterW / 2;
        this.sequence(
          ctx,
          [{ value: String(row.q.progress), color: CREAM }],
          countX,
          midY + 2,
          32,
          row.counterW,
        );
        if (row.variable)
          this.sequence(ctx, row.targets, countX, midY + 19, 15, row.counterW);
        else
          this.outlineText(
            ctx,
            `/${row.targets[0].value}`,
            countX,
            midY + 19,
            "#d3a25b",
            14,
            "center",
            NUMBER_FONT,
          );
        qy += row.h;
      }
    }
    this.lastLayout = l;
    return l;
  }
}
function cutRect(ctx, x, y, w, h, cut = 10) {
  ctx.beginPath();
  ctx.moveTo(x + cut, y);
  ctx.lineTo(x + w - cut, y);
  ctx.lineTo(x + w, y + cut);
  ctx.lineTo(x + w, y + h - cut);
  ctx.lineTo(x + w - cut, y + h);
  ctx.lineTo(x + cut, y + h);
  ctx.lineTo(x, y + h - cut);
  ctx.lineTo(x, y + cut);
  ctx.closePath();
}
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

import { QUALITIES, KEYWORDS, BADGE_ORDER, TYPES, HEROES } from "./data.js";
export const NUM_RE = /-?\d+(?:\.\d+)?/g;
export function defaultQuest() {
  return {
    condition: "",
    reward: "",
    target: 1,
    progress: 0,
    icon: "auto",
    locked: false,
    targetManual: false,
  };
}
export function questTarget(quest) {
  if (quest.targetManual) return quest.target;
  const n = Number(quest.condition.match(/\d+(?:\.\d+)?/)?.[0]);
  return Number.isFinite(n) && n > 0 ? Math.min(999999, Math.ceil(n)) : 1;
}
export const questComplete = (quest) => quest.progress >= questTarget(quest);
export function textValue(tier, field, index) {
  if (field === "effects") return tier.effects[index] || "";
  if (field.startsWith("quest-"))
    return tier.quests[index]?.[field.slice(6)] || "";
  return tier.passive;
}
export function setTextValue(tier, field, index, text) {
  if (field === "effects") tier.effects[index] = text;
  else if (field.startsWith("quest-")) {
    tier.quests ??= [];
    tier.quests[index] ??= defaultQuest();
    tier.quests[index][field.slice(6)] = text;
  } else tier.passive = text;
}
export function defaultTier() {
  return {
    active: true,
    cd: "4.0",
    effects: [""],
    passive: "",
    passiveEnabled: false,
    quests: [],
    ammoEnabled: false,
    ammo: 1,
    critEnabled: false,
    crit: 0,
  };
}
export function createProject() {
  return {
    schemaVersion: 1,
    name: "",
    initial: "bronze",
    size: "medium",
    hero: "neutral",
    types: [],
    art: null,
    crop: { x: 0, y: 0, zoom: 1 },
    independentStructure: false,
    tiers: Object.fromEntries(QUALITIES.map((q) => [q.id, null])),
    seed: defaultTier(),
  };
}
export const clone = (value) => structuredClone(value);
export function available(project) {
  const start = QUALITIES.findIndex((q) => q.id === project.initial);
  return start === 4 ? [QUALITIES[4]] : QUALITIES.slice(Math.max(0, start), 4);
}
export function resolveTier(project, id) {
  const own = project.tiers[id];
  if (own?.edited) return normalizeTier(clone(own));
  const candidates = available(project).filter(
      (q) => project.tiers[q.id]?.edited,
    ),
    idx = QUALITIES.findIndex((q) => q.id === id);
  const lower = candidates
    .filter((q) => QUALITIES.findIndex((v) => v.id === q.id) < idx)
    .reverse();
  const source = lower[0] || candidates[0];
  const resolved = clone(source ? project.tiers[source.id] : project.seed);
  return normalizeTier(resolved);
}
function normalizeTier(tier) {
  tier.quests ??= [];
  // Older saved works used nonempty text to enable the passive section.
  tier.passiveEnabled ??= !!tier.passive;
  return tier;
}
export function editTier(project, id, change) {
  const value = resolveTier(project, id);
  change(value);
  value.edited = true;
  project.tiers[id] = value;
  return value;
}
export function synchronizeStructure(project, current, change) {
  const snapshots = available(project).map((q) => [
    q.id,
    resolveTier(project, q.id),
    !!project.tiers[q.id]?.edited,
  ]);
  for (const [id, t, edited] of snapshots) {
    change(t);
    t.edited = edited || id === current;
    project.tiers[id] = t;
  }
  project.seed.quests ??= [];
  change(project.seed);
}
export function synchronizeText(
  project,
  current,
  field,
  index,
  text,
  numericSource = project,
) {
  const snapshots = available(project).map((q) => [
    q.id,
    resolveTier(project, q.id),
    !!project.tiers[q.id]?.edited,
  ]);
  for (const [id, t, edited] of snapshots) {
    const old = textValue(resolveTier(numericSource, id), field, index);
    const values = numbers(old);
    let n = 0;
    const value =
      id === current ? text : text.replace(NUM_RE, (v) => values[n++] ?? v);
    setTextValue(t, field, index, value);
    t.edited = edited || id === current;
    project.tiers[id] = t;
  }
  setTextValue(project.seed, field, index, text);
}
export function numericSignature(text) {
  return String(text ?? "")
    .replace(NUM_RE, "#")
    .replace(/\s+/g, " ")
    .trim();
}
export function structuralSignature(tier) {
  return JSON.stringify([
    tier.active,
    tier.active ? tier.effects.map(numericSignature) : [],
    tier.passiveEnabled ?? !!tier.passive,
    (tier.passiveEnabled ?? !!tier.passive) ? numericSignature(tier.passive) : "",
    (tier.quests || []).map((q) => [
      numericSignature(q.condition),
      numericSignature(q.reward),
      q.icon,
      q.locked,
    ]),
  ]);
}
export function compatible(project) {
  return (
    new Set(
      available(project).map((q) =>
        structuralSignature(resolveTier(project, q.id)),
      ),
    ).size <= 1
  );
}
export function numbers(text) {
  return [...String(text).matchAll(NUM_RE)].map((m) => m[0]);
}
export function displayText(project, current, textGetter, mode = "current") {
  const qs =
    mode === "all"
      ? available(project)
      : [QUALITIES.find((q) => q.id === current)];
  const texts = qs.map((q) =>
    String(textGetter(resolveTier(project, q.id)) ?? ""),
  );
  const base = texts[0] || "",
    matches = [...base.matchAll(NUM_RE)];
  let cursor = 0;
  const out = [];
  matches.forEach((m, i) => {
    if (m.index > cursor)
      out.push({ text: base.slice(cursor, m.index), type: "text" });
    const values = texts.map((t) => numbers(t)[i] ?? m[0]);
    out.push({
      type: "number",
      text: m[0],
      values: values.every((v) => v === values[0])
        ? null
        : values.map((value, j) => ({
            value,
            color: qs[j].color,
            quality: qs[j].id,
          })),
    });
    cursor = m.index + m[0].length;
  });
  if (cursor < base.length)
    out.push({ text: base.slice(cursor), type: "text" });
  return out;
}
export function extractStats(tier) {
  const result = {};
  if (!tier.active) return result;
  for (const effect of tier.effects) {
    for (const id of BADGE_ORDER) {
      const kw = KEYWORDS.find((k) => k.id === id);
      for (const alias of kw.aliases) {
        const before = new RegExp("(-?\\d+(?:\\.\\d+)?)\\s*" + alias);
        const after = new RegExp(
          alias + "(?:量)?(?:提高|增加|获得|治疗|为)?\\s*(-?\\d+(?:\\.\\d+)?)",
        );
        let m = effect.match(before) || effect.match(after);
        if (id === "heal") {
          m = effect.match(/治疗\s*(-?\d+(?:\.\d+)?)/) || m;
        }
        if (m && result[id] === undefined) result[id] = Number(m[1]);
      }
    }
  }
  for (const id of BADGE_ORDER) {
    if (result[id] !== undefined) continue;
    const kw = KEYWORDS.find((k) => k.id === id);
    for (const effect of tier.effects) {
      if (
        !kw.aliases.some((a) => effect.includes(a)) ||
        !/(?:等同于|等于|等量于)此物品/.test(effect)
      )
        continue;
      const right = effect.split(/(?:等同于|等于|等量于)此物品(?:的)?/)[1];
      const source = KEYWORDS.find(
        (k) =>
          BADGE_ORDER.includes(k.id) &&
          k.aliases.some((a) => right.startsWith(a)),
      );
      if (source && result[source.id] !== undefined) {
        const ratio = right.match(/(\d+(?:\.\d+)?)\s*(%|倍)/);
        const factor = ratio
          ? Number(ratio[1]) / (ratio[2] === "%" ? 100 : 1)
          : 1;
        result[id] = Math.round(result[source.id] * factor * 1e6) / 1e6;
      }
    }
  }
  return result;
}
export { suggest } from "./completion.js";
export function validateProject(value) {
  if (
    !value ||
    value.schemaVersion !== 1 ||
    !QUALITIES.some((q) => q.id === value.initial) ||
    !["small", "medium", "large"].includes(value.size)
  )
    throw new Error("作品格式或版本不受支持");
  if (
    typeof value.name !== "string" ||
    value.name.length > 60 ||
    !Array.isArray(value.types) ||
    value.types.some((t) => !TYPES.includes(t))
  )
    throw new Error("作品字段无效");
  if (!HEROES.some(([id]) => id === value.hero)) throw new Error("职业无效");
  if (
    value.art &&
    (!/^data:image\/(png|jpeg|webp);base64,/.test(value.art) ||
      value.art.length > 30_000_000)
  )
    throw new Error("图片格式无效或过大");
  if (
    !value.crop ||
    ![value.crop.x, value.crop.y, value.crop.zoom].every(Number.isFinite) ||
    value.crop.zoom < 0.3 ||
    value.crop.zoom > 4
  )
    throw new Error("裁切参数无效");
  if (!value.tiers || typeof value.tiers !== "object")
    throw new Error("缺少品质数据");
  if (!value.seed) throw new Error("缺少默认效果");
  for (const t of [value.seed, ...Object.values(value.tiers)].filter(Boolean)) {
    if (
      typeof t.active !== "boolean" ||
      !Array.isArray(t.effects) ||
      t.effects.length > 40 ||
      t.effects.some((s) => typeof s !== "string" || s.length > 4000) ||
      typeof t.passive !== "string" ||
      t.passive.length > 12000 ||
      (t.passiveEnabled != null && typeof t.passiveEnabled !== "boolean") ||
      !/^(?:\d{1,3}(?:\.\d)?)?$/.test(String(t.cd))
    )
      throw new Error("效果内容或冷却时间无效");
    normalizeTier(t);
    if (
      !Array.isArray(t.quests) ||
      t.quests.length > 20 ||
      t.quests.some(
        (q) =>
          !q ||
          typeof q.condition !== "string" ||
          q.condition.length > 4000 ||
          typeof q.reward !== "string" ||
          q.reward.length > 4000 ||
          !Number.isInteger(q.target) ||
          q.target < 1 ||
          q.target > 999999 ||
          !Number.isInteger(q.progress) ||
          q.progress < 0 ||
          q.progress > 999999 ||
          typeof q.targetManual !== "boolean" ||
          typeof q.locked !== "boolean" ||
          ![
            "auto",
            "quest-lock",
            ...KEYWORDS.filter((k) => k.icon).map((k) => k.icon),
          ].includes(q.icon),
      )
    )
      throw new Error("任务内容或进度无效");
  }
  return value;
}

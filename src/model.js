import { QUALITIES, KEYWORDS, BADGE_ORDER, TYPES, HEROES, ENCHANTMENTS } from "./data.js";
import { keywordText } from "./keywords.js";
export const NUM_RE = /-?\d+(?:\.\d+)?/g;
const INTENSITY_WORD = "(?:伤害|治疗|护盾|灼烧|剧毒|生命再生|再生)(?:量)?";
const INTENSITY_AFTER = new RegExp("^\\s*(?:点\\s*)?" + INTENSITY_WORD);
const INTENSITY_BEFORE = new RegExp(INTENSITY_WORD + "\\s*(?:(?:提高|增加|减少|降低|获得|为|等于|[:：=+＋])\\s*)?$");
export function scaleIntensityText(text, factor) {
  if (factor === 1) return text;
  return text.replace(NUM_RE, (value, offset) => {
    const after = keywordText(text.slice(offset + value.length)), before = keywordText(text.slice(0, offset));
    if (/^\s*(?:[%％倍秒次件个张回合])/.test(after)) return value;
    if (!INTENSITY_AFTER.test(after) && !INTENSITY_BEFORE.test(before)) return value;
    return String(Number((Number(value) * factor).toFixed(2)));
  });
}
export function defaultQuest() {
  return {
    condition: "",
    reward: "",
    target: 1,
    progress: 0,
    icon: "auto",
    locked: false,
    rewardRegion: "auto",
    targetManual: false,
  };
}
export function questTarget(quest) {
  if (quest.targetManual) return quest.target;
  const n = Number(quest.condition.match(/\d+(?:\.\d+)?/)?.[0]);
  return Number.isFinite(n) && n > 0 ? Math.min(999999, Math.ceil(n)) : 1;
}
export function questRewardRegion(quest) {
  if (["active", "passive"].includes(quest.rewardRegion)) return quest.rewardRegion;
  const text = keywordText(quest.reward).trim();
  if (/(?:时[，,:：]|每当|每次|每场|每天|每日|开始时|战斗开始|战斗后|出售|卖出|永久|冷却时间|(?:提高|降低).+冷却|额外|免疫|拥有)/.test(text)) return "passive";
  return /^(?:造成|获得|治疗|恢复|回复|生命再生(?:量)?(?:提高|增加)|加速|充能|减速|冻结|摧毁|多重释放|装填|此物品.*多重释放)/.test(text) ||
    /^(?:相邻|左侧|右侧|己方|我方|你的).*(?:获得|增加|提高|[+＋])/.test(text) ||
    /开始飞行/.test(text) || /^为(?:此物品|相邻|左侧|右侧|己方|我方|你的).*(?:充能|加速|減速|减速|冻结|治疗|护盾)/.test(text) ? "active" : "passive";
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
    multicastEnabled: false,
    multicast: 1,
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
    background: defaultBackground(),
    independentStructure: false,
    tiers: Object.fromEntries(QUALITIES.map((q) => [q.id, null])),
    seed: defaultTier(),
    enchantments: defaultEnchantments(),
  };
}
export function defaultBackground() {
  return { color: "#151d21", image: null, useDefault: true };
}
export function defaultEnchantments() {
  return { initialized: false, entries: Object.fromEntries(
    ENCHANTMENTS.map(({ id }) => [id, { enabled: true, text: "", manual: false }]),
  ) };
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
  const sourceIndex = QUALITIES.findIndex(q => q.id === (source?.id || project.initial));
  if (idx < 4 && sourceIndex < 4 && idx !== sourceIndex) {
    const factor = (idx + 1) / (sourceIndex + 1);
    resolved.effects = resolved.effects.map(text => scaleIntensityText(text, factor));
    resolved.passive = scaleIntensityText(resolved.passive, factor);
    for (const quest of resolved.quests || [])
      quest.reward = scaleIntensityText(quest.reward, factor);
  }
  return normalizeTier(resolved);
}
function normalizeTier(tier) {
  tier.quests ??= [];
  if (Array.isArray(tier.quests))
    for (const quest of tier.quests) if (quest && typeof quest === "object") quest.rewardRegion ??= "auto";
  tier.multicastEnabled ??= false;
  tier.multicast ??= 1;
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
    const sourceWeight = QUALITIES.findIndex(q => q.id === current) + 1;
    const targetWeight = QUALITIES.findIndex(q => q.id === id) + 1;
    const defaults = numbers(scaleIntensityText(text,
      current === "legendary" || id === "legendary" ? 1 : targetWeight / sourceWeight));
    let n = 0;
    const value =
      id === current ? text : text.replace(NUM_RE, (v) => {
        const position = n++;
        return values[position] ?? defaults[position] ?? v;
      });
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
    .trim()
    .replace(/[。.!]+$/, "");
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
      q.rewardRegion ?? "auto",
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
const DIRECT_OUTPUT = /^(?:(?:此物品|你|己方|我方)(?:会|将)?\s*)?(?:对(?:敌人|对手)造成|造成|施加|治疗|恢复|回复|获得|(?:生命再生|再生)(?:量)?(?:提高|增加))\s*/;
const BARE_OUTPUT = /^(?:-?\d+(?:\.\d+)?\s*(?:伤害|治疗|护盾|灼烧|剧毒|生命再生|再生)|(?:伤害|治疗|护盾|灼烧|剧毒|生命再生|再生)(?:量)?\s*-?\d)/;
const OTHER_RECIPIENT = /物品|武器|伙伴|工具|载具|食物|陷阱|玩具|药水|遗物|巨龙|核心|科技|恐龙|服饰|地产|战利品|乐器|无人机|射线/;
const ATTRIBUTE_GAIN = /提高|提升|增加|增长|增幅|增益|翻倍|加成|[+＋]/;
function outputClause(text) {
  return text.trim().replace(/^(?:然后|并且|并|同时)\s*/, "");
}
function directOutput(clause) {
  return DIRECT_OUTPUT.test(clause) || BARE_OUTPUT.test(clause);
}
export function extractStats(tier) {
  const result = {};
  if (!tier.active) return result;
  const sentences = tier.effects.flatMap(effect => keywordText(effect).split(/[。；;！!\n]/));
  for (const sentence of sentences) {
    for (const text of sentence.split(/[，,]/)) {
      const clause = outputClause(text);
      if (!directOutput(clause)) continue;
      const rootLength = clause.match(DIRECT_OUTPUT)?.[0].length || 0;
      for (const id of BADGE_ORDER) {
        if (result[id] !== undefined) continue;
        const kw = KEYWORDS.find(k => k.id === id);
        for (const alias of kw.aliases) {
          const pattern = new RegExp("(-?\\d+(?:\\.\\d+)?)\\s*" + alias +
            "|" + alias + "(?:量)?(?:提高|增加|获得|治疗|为)?\\s*(-?\\d+(?:\\.\\d+)?)", "g");
          for (const match of clause.matchAll(pattern)) {
            const value = match[1] ?? match[2];
            const valueEnd = match.index + match[0].lastIndexOf(value) + value.length;
            if (/^\s*[%％倍秒次件个张]/.test(clause.slice(valueEnd))) continue;
            const prefix = clause.slice(rootLength, match.index);
            if (OTHER_RECIPIENT.test(prefix) || ATTRIBUTE_GAIN.test(prefix)) continue;
            // A self-regeneration action is valid; damage/burn/etc. growth is a modifier.
            if (id !== "regen" && ATTRIBUTE_GAIN.test(match[0])) continue;
            result[id] = Number(value);
            break;
          }
          if (result[id] !== undefined) break;
        }
      }
    }
  }
  for (const id of BADGE_ORDER) {
    if (result[id] !== undefined) continue;
    const kw = KEYWORDS.find(k => k.id === id);
    for (const sentence of sentences) {
      const reference = sentence.match(/(?:等同于|等于|等量于)此物品(?:的)?/);
      if (!reference) continue;
      const action = outputClause(sentence.slice(0, reference.index).split(/[，,]/).filter(t => t.trim() && t.trim() !== "增幅").at(-1) || "");
      if (!directOutput(action) || !kw.aliases.some(alias => {
        const index = action.indexOf(alias);
        const rootLength = action.match(DIRECT_OUTPUT)?.[0].length || 0;
        return index >= 0 && !OTHER_RECIPIENT.test(action.slice(rootLength, index)) && !ATTRIBUTE_GAIN.test(action.slice(rootLength, index));
      })) continue;
      const right = sentence.slice(reference.index + reference[0].length);
      const source = KEYWORDS.find(k => BADGE_ORDER.includes(k.id) && k.aliases.some(alias => right.startsWith(alias)));
      if (source && result[source.id] !== undefined) {
        const ratio = right.match(/(\d+(?:\.\d+)?)\s*(%|倍)/);
        const factor = ratio ? Number(ratio[1]) / (ratio[2] === "%" ? 100 : 1) : 1;
        result[id] = Math.round(result[source.id] * factor * 1e6) / 1e6;
        break;
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
  value.background ??= defaultBackground();
  if (!value.background ||
    typeof value.background.color !== "string" ||
    !/^#[\da-f]{6}$/i.test(value.background.color) ||
    !(value.background.image === null ||
      (typeof value.background.image === "string" &&
       /^data:image\/(png|jpeg|webp);base64,/.test(value.background.image) &&
       value.background.image.length <= 30_000_000)))
    throw new Error("背景颜色或图片无效");
  value.background.useDefault ??= false;
  if (typeof value.background.useDefault !== "boolean" ||
      (value.background.useDefault && value.background.image !== null))
    throw new Error("背景模式无效");
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
    if (typeof t.multicastEnabled !== "boolean" || !Number.isInteger(t.multicast) || t.multicast < 1 || t.multicast > 999)
      throw new Error("基础多重释放无效");
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
          !["auto", "active", "passive"].includes(q.rewardRegion) ||
          ![
            "auto",
            "quest-lock",
            ...KEYWORDS.filter((k) => k.icon).map((k) => k.icon),
          ].includes(q.icon),
      )
    )
      throw new Error("任务内容或进度无效");
  }
  value.enchantments ??= defaultEnchantments();
  const enchantments = value.enchantments;
  if (typeof enchantments.initialized !== "boolean" || !enchantments.entries ||
    typeof enchantments.entries !== "object" || Array.isArray(enchantments.entries) ||
    Object.keys(enchantments.entries).some(id => !ENCHANTMENTS.some(e => e.id === id)))
    throw new Error("附魔数据无效");
  for (const { id } of ENCHANTMENTS) {
    const entry = enchantments.entries[id] ??= { enabled: true, text: "", manual: false };
    if (!entry || typeof entry.enabled !== "boolean" || typeof entry.text !== "string" ||
      entry.text.length > 4000 || typeof entry.manual !== "boolean")
      throw new Error("附魔效果无效或过长");
  }
  return value;
}

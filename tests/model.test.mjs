import test from "node:test";
import assert from "node:assert/strict";
import {
  createProject,
  available,
  resolveTier,
  editTier,
  compatible,
  displayText,
  extractStats,
  suggest,
  validateProject,
  synchronizeStructure,
  synchronizeText,
  defaultQuest,
  questTarget,
  questComplete,
  clone,
} from "../src/model.js";
test("被动默认关闭，旧作品保留显示，开关同步且不丢失文字", () => {
  const p = createProject();
  assert.equal(resolveTier(p, "bronze").passiveEnabled, false);
  p.seed.passive = "充能此物品1秒。";
  delete p.seed.passiveEnabled;
  validateProject(p);
  assert.equal(resolveTier(p, "bronze").passiveEnabled, true);
  synchronizeStructure(p, "bronze", (t) => { t.passiveEnabled = false; });
  for (const q of available(p)) {
    assert.equal(resolveTier(p, q.id).passiveEnabled, false);
    assert.equal(resolveTier(p, q.id).passive, "充能此物品1秒。");
  }
  assert.equal(compatible(p), true);
  editTier(p, "silver", (t) => { t.passiveEnabled = true; });
  assert.equal(compatible(p), false);
});
test("起始品质限制及传说单品质", () => {
  const p = createProject();
  p.initial = "silver";
  assert.deepEqual(
    available(p).map((q) => q.id),
    ["silver", "gold", "diamond"],
  );
  p.initial = "legendary";
  assert.deepEqual(
    available(p).map((q) => q.id),
    ["legendary"],
  );
});
test("未编辑品质继承最近已编辑的较低等级，并持续反映修改", () => {
  const p = createProject();
  editTier(p, "bronze", (t) => (t.effects = ["造成10伤害。"]));
  assert.equal(resolveTier(p, "diamond").effects[0], "造成10伤害。");
  editTier(p, "gold", (t) => (t.effects = ["造成40伤害。"]));
  assert.equal(resolveTier(p, "silver").effects[0], "造成10伤害。");
  assert.equal(resolveTier(p, "diamond").effects[0], "造成40伤害。");
  editTier(p, "bronze", (t) => (t.effects = ["造成20伤害。"]));
  assert.equal(resolveTier(p, "silver").effects[0], "造成20伤害。");
  assert.equal(resolveTier(p, "gold").effects[0], "造成40伤害。");
});
test("结构变化禁用合并，纯数值变化允许", () => {
  const p = createProject();
  editTier(p, "bronze", (t) => {
    t.effects = ["造成3灼烧。"];
    t.passive = "充能此物品1秒。";
  });
  editTier(p, "gold", (t) => {
    t.effects = ["造成9灼烧。"];
    t.passive = "充能此物品2秒。";
  });
  assert.equal(compatible(p), true);
  editTier(p, "silver", (t) => t.effects.push("造成5剧毒。"));
  assert.equal(compatible(p), false);
  editTier(p, "silver", (t) => (t.effects = ["造成6灼烧。"]));
  assert.equal(compatible(p), true);
});
test("全品质数值与初始等级颜色映射，固定值只显示一次", () => {
  const p = createProject();
  p.initial = "silver";
  editTier(p, "silver", (t) => (t.effects = ["造成6灼烧。"]));
  editTier(p, "gold", (t) => (t.effects = ["造成9灼烧。"]));
  editTier(p, "diamond", (t) => (t.effects = ["造成12灼烧。"]));
  const parts = displayText(p, "diamond", (t) => t.effects[0], "all");
  assert.deepEqual(
    parts[1].values.map((v) => [v.value, v.quality]),
    [
      ["6", "silver"],
      ["9", "gold"],
      ["12", "diamond"],
    ],
  );
  assert.equal(displayText(p, "diamond", (t) => t.cd, "all")[0].values, null);
});
test("六类顶部数值与等同于伤害", () => {
  const p = createProject();
  const t = resolveTier(p, "bronze");
  t.effects = [
    "造成60伤害。",
    "治疗20生命值。",
    "获得30护盾。",
    "造成灼烧，等同于此物品伤害。",
    "造成5剧毒。",
    "生命再生量提高6。",
  ];
  assert.deepEqual(extractStats(t), {
    damage: 60,
    heal: 20,
    shield: 30,
    poison: 5,
    regen: 6,
    burn: 60,
  });
});
test("补全支持别名、等同于句式并要求已存在引用效果", () => {
  const t = { effects: ["造成60伤害。", "火=伤"] };
  assert.equal(suggest("60火", t), "造成60灼烧。");
  assert.equal(suggest("火=伤", t), "造成灼烧，等同于此物品伤害。");
  assert.equal(suggest("火=伤", { effects: ["火=伤"] }), "");
  assert.equal(suggest("任意自由句子", t), "");
});
test("作品往返与非法图片拒绝", () => {
  const p = createProject();
  editTier(p, "bronze", (t) => (t.effects = ["造成60伤害。"]));
  assert.deepEqual(validateProject(JSON.parse(JSON.stringify(p))), p);
  assert.throws(
    () => validateProject({ ...p, art: "javascript:alert(1)" }),
    /图片/,
  );
});
test("默认同步增删保持各品质数值和未编辑等级继承", () => {
  const p = createProject();
  editTier(p, "bronze", (t) => (t.effects = ["造成10伤害。"]));
  editTier(p, "gold", (t) => (t.effects = ["造成40伤害。"]));
  synchronizeStructure(p, "bronze", (t) => t.effects.push(""));
  assert.equal(resolveTier(p, "gold").effects[0], "造成40伤害。");
  assert.equal(resolveTier(p, "diamond").effects.length, 2);
  assert.equal(compatible(p), true);
  editTier(p, "bronze", (t) => (t.effects[0] = "造成20伤害。"));
  assert.equal(resolveTier(p, "silver").effects[0], "造成20伤害。");
  synchronizeStructure(p, "gold", (t) => t.effects.splice(1, 1));
  assert.equal(resolveTier(p, "bronze").effects.length, 1);
  assert.equal(compatible(p), true);
});
test("同步句式保留已编辑品质数值，新数值继承输入", () => {
  const p = createProject();
  editTier(p, "bronze", (t) => (t.effects = ["造成10伤害。"]));
  editTier(p, "gold", (t) => (t.effects = ["造成40伤害。"]));
  synchronizeText(p, "bronze", "effects", 0, "造成20剧毒，持续2秒。");
  assert.equal(resolveTier(p, "bronze").effects[0], "造成20剧毒，持续2秒。");
  assert.equal(resolveTier(p, "gold").effects[0], "造成40剧毒，持续2秒。");
  assert.equal(resolveTier(p, "diamond").effects[0], "造成40剧毒，持续2秒。");
  assert.equal(compatible(p), true);
});
test("连续清空并重写句式仍保留其他品质的原始数值", () => {
  const p = createProject();
  editTier(p, "bronze", (t) => (t.effects = ["造成10伤害。"]));
  editTier(p, "gold", (t) => (t.effects = ["造成40伤害。"]));
  const before = clone(p);
  synchronizeText(p, "bronze", "effects", 0, "", before);
  synchronizeText(p, "bronze", "effects", 0, "造成20剧毒，持续2秒。", before);
  assert.equal(resolveTier(p, "gold").effects[0], "造成40剧毒，持续2秒。");
});
test("任务默认未完成，自动读取目标并允许手动覆盖和完成", () => {
  const q = defaultQuest();
  assert.equal(questComplete(q), false);
  q.condition = "触发剧毒30次";
  assert.equal(questTarget(q), 30);
  q.progress = 29;
  assert.equal(questComplete(q), false);
  q.progress = 30;
  assert.equal(questComplete(q), true);
  q.targetManual = true;
  q.target = 40;
  assert.equal(questTarget(q), 40);
  assert.equal(questComplete(q), false);
});
test("任务跨品质同步保留奖励数值，合并目标与奖励，独立删除禁用合并", () => {
  const p = createProject();
  synchronizeStructure(p, "bronze", (t) => t.quests.push(defaultQuest()));
  synchronizeText(p, "bronze", "quest-condition", 0, "触发剧毒30次");
  synchronizeText(p, "bronze", "quest-reward", 0, "造成6剧毒");
  editTier(p, "gold", (t) => {
    t.quests[0].condition = "触发剧毒20次";
    t.quests[0].reward = "造成12剧毒";
  });
  assert.equal(compatible(p), true);
  synchronizeText(p, "bronze", "quest-reward", 0, "此物品+8剧毒");
  assert.equal(resolveTier(p, "gold").quests[0].reward, "此物品+12剧毒");
  const parts = displayText(
    p,
    "gold",
    (t) => String(questTarget(t.quests[0])),
    "all",
  );
  assert.deepEqual(
    parts[0].values.map((v) => v.value),
    ["30", "30", "20", "20"],
  );
  editTier(p, "silver", (t) => t.quests.splice(0, 1));
  assert.equal(compatible(p), false);
});
test("旧作品补齐任务字段，非法进度拒绝导入", () => {
  const p = createProject();
  delete p.seed.quests;
  assert.deepEqual(validateProject(p).seed.quests, []);
  p.seed.quests.push({ ...defaultQuest(), progress: -1 });
  assert.throws(() => validateProject(p), /任务/);
});

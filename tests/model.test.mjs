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
  defaultBackground,
  scaleIntensityText,
} from "../src/model.js";
test("预览背景随作品保存，旧作品恢复线上默认背景并拒绝非法颜色或图片", () => {
  const legacy = createProject();
  delete legacy.background;
  assert.deepEqual(validateProject(legacy).background, { color: "#151d21", image: null, useDefault: true });
  const project = createProject();
  project.background = { color: "#123456", image: "data:image/png;base64,dGVzdA==", useDefault: false };
  assert.deepEqual(validateProject(clone(project)).background, project.background);
  for (const background of [
    { color: "red", image: null },
    { color: "#20362e", image: "https://example.com/background.png" },
    { color: "#20362e", image: "data:image/svg+xml;base64,PHN2Zz4=" },
    { color: "#20362e", image: 123 },
    { color: "#20362e", image: null, useDefault: "yes" },
    { color: "#20362e", image: "data:image/png;base64,dGVzdA==", useDefault: true },
  ]) assert.throws(() => validateProject({ ...clone(project), background }), /背景/);
});
test("重置背景清除图片并恢复原有背景，早期自选背景保留颜色", () => {
  const project = createProject();
  project.background = { color: "#382c25", image: null };
  assert.deepEqual(validateProject(project).background, { color: "#382c25", image: null, useDefault: false });
  project.background = defaultBackground();
  assert.deepEqual(validateProject(project).background, { color: "#151d21", image: null, useDefault: true });
});
test("六类强度按1:2:3:4生成，CD与目标、时长、百分比和倍率保持原值", () => {
  const p = createProject();
  editTier(p, "bronze", t => {
    t.effects = ["造成60伤害，治疗20生命值，获得30护盾，造成3灼烧和5剧毒，生命再生量提高2。", "冻结2件物品1秒，造成灼烧，等同于伤害的10%，治疗量提高50%。"];
    t.cd = "4.0"; t.ammoEnabled = true; t.ammo = 2; t.critEnabled = true; t.crit = 25;
  });
  const diamond = resolveTier(p, "diamond");
  assert.equal(diamond.effects[0], "造成240伤害，治疗80生命值，获得120护盾，造成12灼烧和20剧毒，生命再生量提高8。");
  assert.equal(diamond.effects[1], resolveTier(p, "bronze").effects[1]);
  assert.equal(diamond.cd, "4.0");
  assert.equal(diamond.ammo, 2);
  assert.equal(diamond.crit, 25);
  assert.equal(scaleIntensityText("伤害提高1.5，造成2次伤害，加速1件物品2秒，灼烧量等于此物品伤害的5倍。", 2), "伤害提高3，造成2次伤害，加速1件物品2秒，灼烧量等于此物品伤害的5倍。");
  const parts = displayText(p, "bronze", t => t.effects[0], "all");
  assert.deepEqual(parts[1].values.map(v => v.value), ["60", "120", "180", "240"]);
});
test("白银起步按2:3:4，传说保留原值，手动品质不被覆盖", () => {
  const p = createProject(); p.initial = "silver";
  editTier(p, "silver", t => { t.effects = ["造成60伤害。"]; });
  assert.equal(resolveTier(p, "gold").effects[0], "造成90伤害。");
  assert.equal(resolveTier(p, "diamond").effects[0], "造成120伤害。");
  editTier(p, "gold", t => { t.effects = ["造成150伤害。"]; });
  editTier(p, "silver", t => { t.effects = ["造成100伤害。"]; });
  assert.equal(resolveTier(p, "gold").effects[0], "造成150伤害。");
  assert.equal(resolveTier(p, "diamond").effects[0], "造成200伤害。");
  p.initial = "legendary"; p.tiers.legendary = null; p.seed.effects = ["造成7剧毒。"]; p.tiers.gold = null; p.tiers.silver = null;
  assert.equal(resolveTier(p, "legendary").effects[0], "造成7剧毒。");
});
test("自动缩放被动和任务奖励，任务目标保持固定，作品往返不重复缩放", () => {
  const p = createProject();
  editTier(p, "bronze", t => {
    t.passiveEnabled = true; t.passive = "使用物品时，伤害提高10。";
    t.quests = [{ ...defaultQuest(), condition: "触发剧毒30次", reward: "造成6剧毒。" }];
  });
  const q = validateProject(JSON.parse(JSON.stringify(p)));
  assert.equal(resolveTier(q, "diamond").passive, "使用物品时，伤害提高40。");
  assert.equal(resolveTier(q, "diamond").quests[0].reward, "造成24剧毒。");
  assert.equal(resolveTier(q, "diamond").quests[0].condition, "触发剧毒30次");
  assert.equal(resolveTier(q, "diamond").quests[0].target, 1);
  assert.equal(compatible(q), true);
});
test("在其他品质新增强度值仍按比例填充，句号同步保留手写数值", () => {
  const p = createProject();
  editTier(p, "bronze", t => { t.effects = ["造成60伤害。"]; });
  editTier(p, "silver", t => { t.cd = "3.5"; });
  synchronizeText(p, "diamond", "passive", null, "生命再生量提高8");
  assert.equal(resolveTier(p, "bronze").passive, "生命再生量提高2");
  assert.equal(resolveTier(p, "silver").passive, "生命再生量提高4");
  synchronizeText(p, "diamond", "passive", null, "生命再生量提高8。");
  assert.equal(resolveTier(p, "bronze").passive, "生命再生量提高2。");
  assert.equal(resolveTier(p, "silver").cd, "3.5");
  assert.equal(resolveTier(p, "silver").effects[0], "造成120伤害。");
});
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
test("未编辑品质从最近的手动品质按比例生成，并持续反映修改", () => {
  const p = createProject();
  editTier(p, "bronze", (t) => (t.effects = ["造成10伤害。"]));
  assert.equal(resolveTier(p, "diamond").effects[0], "造成40伤害。");
  editTier(p, "gold", (t) => (t.effects = ["造成45伤害。"]));
  assert.equal(resolveTier(p, "silver").effects[0], "造成20伤害。");
  assert.equal(resolveTier(p, "diamond").effects[0], "造成60伤害。");
  editTier(p, "bronze", (t) => (t.effects = ["造成20伤害。"]));
  assert.equal(resolveTier(p, "silver").effects[0], "造成40伤害。");
  assert.equal(resolveTier(p, "gold").effects[0], "造成45伤害。");
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
  assert.equal(suggest("60火", t), "造成60灼烧");
  assert.equal(suggest("火=伤", t), "造成灼烧，等同于此物品伤害");
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
  assert.equal(resolveTier(p, "silver").effects[0], "造成40伤害。");
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
  assert.equal(resolveTier(p, "diamond").effects[0], "造成53.33剧毒，持续2秒。");
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

import test from "node:test";
import assert from "node:assert/strict";
import { suggest, fieldCompletion } from "../src/completion.js";
import { extractStats } from "../src/model.js";
const context = {
  effects: ["造成60伤害。", "获得120护盾。", "造成10灼烧。"],
  passive: "",
};
test("数值前后顺序、代称、全角和计量简写", () => {
  for (const [input, expected] of [
    ["奶60", "治疗60生命值。"],
    ["60奶", "治疗60生命值。"],
    ["火60", "造成60灼烧。"],
    ["毒12", "造成12剧毒。"],
    ["叠盾80", "获得80护盾。"],
    ["再生6", "生命再生量提高6。"],
    ["回血１２０", "治疗120生命值。"],
    ["奶1.5k", "治疗1500生命值。"],
    ["伤2万", "造成20000伤害。"],
    ["HP60", "获得60最大生命值。"],
    ["暴击30%", "此物品+30%暴击率。"],
    ["多重3", "多重释放：3。"],
  ])
    assert.equal(suggest(input, context), expected, input);
});
test("方向、默认秒数、指定秒数、数量和类型目标", () => {
  for (const [input, expected] of [
    ["充左", "为左侧物品充能1秒。"],
    ["充左2.5", "为左侧物品充能2.5秒。"],
    ["加速右", "加速右侧物品1秒。"],
    ["加速右2", "加速右侧物品2秒。"],
    ["冻敌2件1.5", "冻结敌方2件物品1.5秒。"],
    ["充邻科技2", "为相邻科技物品充能2秒。"],
    ["充自1", "为此物品充能1秒。"],
    ["充全1", "为己方所有物品充能1秒。"],
    ["加速小2", "加速一件小型物品2秒。"],
    ["充非玩具2", "为一件非玩具物品充能2秒。"],
    ["减速两件1", "减速2件物品1秒。"],
    ["冰1.5", "冻结一件物品1.5秒。"],
  ])
    assert.equal(suggest(input, context), expected, input);
});
test("战斗、使用物品、触发效果的常用被动句式", () => {
  for (const [input, expected] of [
    ["开战:盾100", "每场战斗开始时，获得100护盾。"],
    ["战后奶60", "每场战斗结束时，治疗60生命值。"],
    ["用邻:充自1", "使用相邻物品时，为此物品充能1秒。"],
    ["用武器加速右2", "使用武器时，加速右侧物品2秒。"],
    ["冻结时:奶60", "触发冻结时，治疗60生命值。"],
    ["得盾:充自1", "获得护盾时，为此物品充能1秒。"],
    ["开日:永久价值+1", "每天开始时，此物品永久+1价值。"],
    ["用邻", "使用相邻物品时，"],
  ])
    assert.equal(suggest(input, context), expected, input);
});
test("属性增长与冷却缩短", () => {
  for (const [input, expected] of [
    ["左伤+10", "左侧物品+10伤害。"],
    ["永久伤+10", "此物品永久+10伤害。"],
    ["全暴击+20", "己方所有物品+20%暴击率。"],
    ["cd-0.5", "此物品冷却时间缩短0.5秒。"],
    ["左cd-10%", "左侧物品冷却时间缩短10%。"],
    ["装填左2", "为左侧物品装填2弹药。"],
  ])
    assert.equal(suggest(input, context), expected, input);
});
test("引用效果支持百分比和倍数，保留不存在引用的保护", () => {
  assert.equal(
    suggest("火=伤10%", context),
    "造成灼烧，等同于此物品伤害的10%。",
  );
  assert.equal(
    suggest("毒=10%伤", context),
    "造成剧毒，等同于此物品伤害的10%。",
  );
  assert.equal(
    suggest("盾=5倍火", context),
    "获得护盾，等同于此物品灼烧的5倍。",
  );
  assert.equal(suggest("奶=盾", context), "治疗生命值，等同于此物品护盾。");
  assert.equal(
    suggest("再生=火", context),
    "生命再生量提高，增幅等于此物品灼烧。",
  );
  assert.equal(suggest("火=伤", { effects: ["火=伤"] }), "");
  assert.equal(
    suggest("火=10%血", context),
    "造成灼烧，等同于最大生命值的10%。",
  );
  assert.deepEqual(
    extractStats({
      active: true,
      effects: [
        "造成60伤害。",
        "造成灼烧，等同于此物品伤害的10%。",
        "生命再生量提高，增幅等于此物品灼烧。",
      ],
    }),
    { damage: 60, burn: 6, regen: 6 },
  );
});
test("朱尔斯温度状态和转化升级", () => {
  for (const [input, expected] of [
    ["高温:火60", "高温时：造成60灼烧。"],
    ["霜冻:奶60", "霜冻时：治疗60生命值。"],
    ["高温", "高温时："],
    ["转左伙伴", "将左侧物品转化为一件伙伴。"],
    ["转左为武器", "将左侧物品转化为一件武器。"],
    ["升级右", "升级右侧物品。"],
  ])
    assert.equal(suggest(input, context), expected, input);
});
test("多行只补全当前行，不改前后文本；选区和中途光标不拦截Tab", () => {
  const input = "已有自由描述。\n奶60\n保留尾行。",
    caret = input.indexOf("\n保留");
  assert.deepEqual(fieldCompletion(input, context, caret), {
    text: "已有自由描述。\n治疗60生命值。\n保留尾行。",
    preview: "治疗60生命值。",
  });
  assert.equal(fieldCompletion("奶60", context, 2), null);
  assert.equal(fieldCompletion("奶60", context, 0, 3), null);
});
test("完成的句子、无效目标和自由文字不被强行替换", () => {
  for (const input of [
    "造成60伤害。",
    "这是我自定义的特殊效果",
    "充未知2",
    "奶-10",
    "加速右2x",
    "火=没有这个属性",
    "用" + "任意自由内容".repeat(300),
  ])
    assert.equal(suggest(input, context), "", input.slice(0, 30));
});

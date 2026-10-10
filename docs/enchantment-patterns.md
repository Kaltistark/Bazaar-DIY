# BazaarDB 物品附魔规律

查阅日期：2026-10-10。主样本采用 BazaarDB 标注的 `19.0 (Hotfix October 8)` 页面；补充旧版样本单独标注。这里归纳的是代表物品的规律，未对数据库全部物品做穷举统计。英文附魔名作为识别依据，中文用于解释效果方向。

## 核心结论

从这些物品可归纳出：附魔有固定的效果主题，但具体实现围绕原物品的属性、触发、目标和成长方式设计。常见操作包括强化已有属性、按另一属性生成新效果、接入原来的触发事件、扩大目标，以及强化原本的增益或经济机制。它适合表示为“通用模板 + 物品特例”，不能只用“附魔名称 → 一句固定效果”描述。

## 13 种附魔的常见行为

| 附魔 | 效果方向 | 常见实现 | 需要保留的分支 |
| --- | --- | --- | --- |
| Golden | 经济 | 物品价值 ×2 | 改为免费成长、强化价值加成，或提高与金币有关的伤害系数 |
| Heavy | 减速 | 已有减速时，减速时长 ×2；否则增加减速 | 可以接在使用物品、使用特定目标或其他事件之后 |
| Icy | 冻结 | 已有冻结时，冻结时长 ×2；否则增加冻结 | 时长、数量、触发均可能定制 |
| Turbo | 加速 | 已有加速时，时长 ×2；否则增加加速 | 也可能增加一个加速目标，不能统一写成时长翻倍 |
| Shielded | 护盾 | 护盾量 ×2，或新增护盾 | 新增量可引用伤害、治疗、持续效果、阵容数量；也可提高别的物品的护盾属性 |
| Restorative | 治疗 | 治疗量 ×2，或新增治疗 | 可以依原触发治疗，也可以提高别的物品的治疗属性 |
| Toxic | 剧毒 | 剧毒量 ×2，或新增剧毒 | 新增量经常引用原物品属性；成长型卡可能给目标增加剧毒属性 |
| Fiery | 灼烧 | 灼烧量 ×2，或新增灼烧 | 与 Toxic 类似，但保留各物品的数值和引用对象 |
| Shiny | 强化主机制 | 普通主动卡常为多重释放 +1 | 被动卡可强化伤害、加成或经济成长；不保证获得多重释放 |
| Deadly | 暴击 | 普通输出卡常为自身暴击率 +50 个百分点 | 辅助卡可给关联物品暴击；也可能强化暴击伤害或绑定其他触发 |
| Radiant | 抗控制／保护 | 普通主动卡常免疫冻结、减速和摧毁 | 辅助卡可让关联物品受冻结／减速的时间减半；自毁卡可能只免疫冻结和减速 |
| Obsidian | 伤害 | 已有伤害时常为伤害 ×2 | 也可让非武器获得武器类型和伤害，或强化对其他物品的伤害加成 |
| Mossy | 生命再生 | 再生量 ×2，或新增再生 | 可以接入原触发，或提高目标的再生属性／原有再生成长 |

普通主动卡的新增效果与自身使用相连，可对照 [Caracal](https://bazaardb.gg/card/13jj00p8141sgwf9798tyt3lp8z/Caracal)、[Uwashiwali Bird](https://bazaardb.gg/card/f901t0tx12ksdhswqvy066d9fl/Uwashiwali-Bird)、[Pufferfish](https://bazaardb.gg/card/qtl4ks17152btzk52ch0gkq5qm/Pufferfish)、[Confetti Cannon](https://bazaardb.gg/card/19sktzpyxj13xlwjlccyg85wgd0/Confetti-Cannon) 和 [Pasta](https://bazaardb.gg/card/e9otw6b2vmgqcae789mru19jl/Pasta)。被动和定制分支见后文逐项例证。

## 数值换算：存在几组常用模板，但并不统一

以下是样本中明确出现的换算。表格表达模板，不表示任意物品都可以按它自动生成全部附魔。

| 原有主要属性 | 新增效果的常见数值 | 例证 |
| --- | --- | --- |
| 伤害 D | 护盾／治疗 = D；剧毒／灼烧／再生 = 10% D | Caracal 的 Shielded、Restorative、Toxic、Fiery、Mossy |
| 治疗 H | 护盾／伤害 = H；剧毒／灼烧／再生 = 10% H | Uwashiwali Bird 的对应附魔 |
| 剧毒 P | 护盾／治疗／伤害 = 5P；灼烧／再生 = P | Pufferfish |
| 灼烧 B | 护盾／治疗／伤害 = 5B；剧毒／再生 = B | Confetti Cannon |
| 再生 R | 护盾／治疗／伤害 = 5R；剧毒／灼烧 = R | Pasta |

这组关系不对称：伤害转剧毒用 10%，而剧毒转伤害用 ×5。不能把所有效果折算成一套可双向转换的固定单位。

没有合适的引用属性时，也有固定数值的模板。例如 [Lens](https://bazaardb.gg/card/kqg286bv9kckzjycgc5ncgh1ls/Lens) 的伤害／护盾／治疗是 30，剧毒／灼烧／再生是 3；[Speedrunner](https://bazaardb.gg/card/5bd84hlpd8tpxs7s04882hjsdt/Speedrunner) 是 10 与 1。两者都是小型、白银起始的充能卡，仍采用不同数值。

因此，尺寸和品质不足以唯一确定新增数值。同理，Lens 的 Heavy 和 Turbo 为 1 秒，而同样小型、白银起始的 [Mini Keyboard](https://bazaardb.gg/card/gzwf4lbnb82mtxbclg47hm95tf/Mini-Keyboard) 为 2 秒。具体数值需要逐卡保存；不能声称数据库存在一条仅由尺寸计算数值的规则。

跨属性换算还可以读取阵容，而非自身属性。[Beach Ball](https://bazaardb.gg/card/mxmg74z6p7zjj8d1ssfs9zkvk8/Beach-Ball) 按己方水系或玩具物品数量计算：每件提供 10 护盾、15 治疗、1 剧毒、1 灼烧、10 伤害或 1 再生。这也说明治疗与护盾不保证等量。

## 触发和目标比附魔名字更重要

### 纯被动卡把新增效果接到自身的事件上

[Bunker](https://bazaardb.gg/card/16k72gzbwbt6nvt85blt3h15hs2/Bunker) 没有主动冷却。其 Heavy、Icy、Turbo 以及新增输出效果都使用“使用护盾物品时”的触发；不是给 Bunker 新增一个主动技能。Shielded 和 Restorative 每次触发为 30，Toxic、Fiery、Mossy 为 3。它的 Shiny 强化原多重释放加成，Deadly 和 Radiant 则支援己方护盾物品。

[Freezer](https://bazaardb.gg/card/hdshgj45j9mpcybdqzpjqqmjvs/Freezer) 也没有主动冷却：原本由相邻食物使用引发冻结，并在施加冻结时造成伤害。新增的护盾、治疗、剧毒、灼烧和再生接在“施加冻结时”。Shiny 与 Obsidian 都强化伤害；Icy 强化自身冻结时长。

### 同一张卡可以有多个不同触发

[Grindstone](https://bazaardb.gg/card/phy8dq4sklc4q0bxmqw2t08t8n/Grindstone) 的 Shielded／Restorative 增加左侧物品的护盾／治疗属性，Toxic／Fiery／Mossy 增加对应持续效果属性。Heavy／Icy／Turbo 却在左侧物品被使用时触发；不能把所有附魔都挂到磨刀石自身的使用上。Obsidian 则翻倍它原有的伤害加成。

[Shadowed Cloak](https://bazaardb.gg/card/kggklc12bvxvqsqlz045j4cbp6/Shadowed-Cloak) 的新增输出接在右侧物品使用时；数值引用的是右侧物品的伤害，而非披风自身。Turbo 强化加速时长，Shiny 和 Obsidian 强化原来的伤害增益，Deadly 和 Radiant 保护／强化右侧目标。

### 出售卡沿用出售事件

[Feather](https://bazaardb.gg/card/fgg9cl23swnsvdg9dk60ywq2lv/Feather) 的新增附魔多在出售时强化己方最左侧的对应物品。例如 Icy 增加 0.1 秒冻结时长，Heavy／Turbo 增加 0.2 秒减速／加速时长，Shielded／Restorative 增加 10 属性，Toxic／Fiery／Mossy 增加 1 属性。它的 Shiny 强化原冷却缩减，Radiant 不可用。

## 几个最容易误判的附魔

### Shiny 不等于把整张卡的效果翻倍

普通主动卡通常是多重释放 +1，这是加法。假设原来一次使用结算 3 次，加 1 后为 4 次；不能据此计算为 6 次。

被动卡采用不同方案：Bunker 强化给予别人的多重释放加成；Freezer 强化伤害；Shadowed Cloak 强化伤害增益。[Piggy Bank](https://bazaardb.gg/card/7w8gkna03comti0bpgrd24qgr/Piggy-Bank) 强化每小时的价值成长；[Display Case](https://bazaardb.gg/card/exlvb3x2stlp2jlh8ocjp8f37/Display-Case) 虽然给其他物品加属性，仍采用多重释放 +1。是否主动、是否有可重复使用的主体效果，都会影响实现，但不能据此建立无例外的推断规则。

### Deadly 不保证提高自身暴击率

Caracal、Pufferfish 等常规输出卡为自身 +50 个百分点。Lens 支援右侧物品，Mini Keyboard 支援相邻物品，Speedrunner 支援非玩具物品，Beach Ball 支援水系与玩具物品。实际加成为 30、40、50 等不同数值，目标范围也不同。

[Critical Core](https://bazaardb.gg/card/9trv3q12kfboq2b2p0kht3lam/Critical-Core) 的 Deadly 强化暴击伤害；[Fire Bomb](https://bazaardb.gg/card/75ngz163yjkus5sbezqhuedll/Fire-Bomb) 则在自身被摧毁时让己方物品获得 30 个百分点暴击率。必须区分“暴击率”“暴击伤害”和“暴击相关事件”。

### Radiant 有自身免疫、支援减时长和自毁例外

Lens 等常规物品为自身免疫冻结、减速和摧毁。Bunker、Freezer、Grindstone 和 Shadowed Cloak 的 Radiant 则作用于关联物品，让其受冻结、减速的时间减半，不等价于完整免疫，也不带同样的摧毁免疫。

Fire Bomb 原本在使用后自毁，其 Radiant 只提供冻结和减速免疫。不能把这张卡自动改成摧毁免疫。这里可以推断设计在保留原卡的自毁机制，但不能扩展成所有自毁物品的确定规则。

### Obsidian 要区分直接伤害和伤害增益

Caracal 的 Obsidian 强化自身伤害；Pufferfish、Pasta 等没有武器类型的卡可以新增伤害并获得武器类型；Grindstone 和 Shadowed Cloak 则强化给目标的伤害增益。新增武器类型不是每一种 Obsidian 都有的操作。

### Golden 也存在经济特例

Lens 等通常价值 ×2。Piggy Bank 的 Golden 移除每小时成长的金币支出，不是直接翻倍现有价值。[Cash Cannon](https://bazaardb.gg/card/8hl24yhwfhky90vnw0vpfvkjj/Cash-Cannon) 的 Golden 把按本局累计获得金币计算的伤害系数从 ×2 改为 ×3。[Farmer's Market](https://bazaardb.gg/card/8kccfuxbsfle1w8bw0ao8tzji/Farmer%27s-Market) 的 Golden 强化原价值加成，Shiny 则强化食物售价加成；它们是不同的数值。

## 品质、成长和可用性

附魔数值不保证随品质递增。Lens 的新增护盾／治疗／伤害在白银、黄金、钻石都为 30，持续效果都为 3。引用原属性的附魔则会随该属性变化：Uwashiwali Bird 的治疗是 20／40／80／160，其 Toxic 按治疗的 10% 计算为 2／4／8／16；Pufferfish 的剧毒是 10／20／30，对应 Shielded 为 50／100／150。

数据库的 Deep Mechanics 对这些引用使用属性和 Aura 表达，而不是仅列一张品质数值表。因此，做 DIY 模板时宜保留“等同于该物品属性”的公式。这里的伤害引用是物品伤害属性，不应直接替换为一次暴击、减伤结算后的实际伤害。Uwashiwali Bird 的部分 10% 换算实现还明确使用向上取整；不能把所有百分比效果一概按四舍五入处理。

附魔可用性也需要逐卡记录。Piggy Bank 只有 Golden 和 Shiny 可用；Feather 有其他多种附魔但不能 Radiant。没有某种附魔的物品不能被当成“效果尚未填写”。

## 补充样本：以下页面版本较旧

| 物品与页面版本 | 用于交叉观察的现象 |
| --- | --- |
| [Duct Tape，18.3](https://bazaardb.gg/card/1g7hm3m0kb1zd2zyct2lkjg2wh/Duct-Tape) | 主动减速与相邻物品使用时护盾并存；Restorative 等新增输出跟随后者，引用自身护盾。Heavy／Shielded 强化原属性。其 Shiny 文案不足以单凭通用模板判断完整变化，因此不当作当前版确定结论。 |
| [Booby Trap，17.4](https://bazaardb.gg/card/19vx8q9zfx9xpts6w7jc6wq1bnf/Booby-Trap) | Shiny 把原先仅敌方第一次使用物品时触发扩展到前两次；说明有限次数触发也可以有专门强化。 |
| [Flamethrower，18.3](https://bazaardb.gg/card/14m4gkf7jjmp0w2wzb4t9nmjtzt/Flamethrower) | 同时有直接伤害和灼烧，新增护盾／治疗却引用 5 倍灼烧；说明多属性卡不保证优先选伤害作为附魔基数。 |

旧版例子只补充设计模式，不用于断言当前版本的精确数值。查阅时还发现同名卡可能出现不同 URL 和不同版本，检索结果及详细机制与历史变更有时交错展示。上文优先采用页面当前 Enchantments 文案，并明确隔离了旧版样本。

## 对 DIY 附魔模板的建议

这些是基于样本提出的设计建议，不是游戏公布的生成算法：

1. 给每张物品保留附魔可用列表；每种附魔允许独立覆盖。
2. 先确定原有属性、触发、目标和引用对象，再选择强化或新增效果。
3. 将乘法强化、固定新增、属性引用、目标数量、触发次数、光环和类型变化分别表达。
4. 同类翻倍、跨属性换算和多重释放 +1 可作为常用起点，但须允许选择引用基数、系数、目标与触发。
5. 固定数值可跨品质不变；公式随属性变化；定制值按品质保存，三者分别处理。
6. 每个模板保留来源和版本，尤其关注 Deadly、Shiny、Radiant、Golden 的特例。

建议采用的工作顺序是：**先检查可用性，再确认原机制和对应属性，选择通用操作，最后套用物品特例。**

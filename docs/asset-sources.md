# 游戏展示素材来源

当前网页使用的素材主要来自用户本机已安装的《The Bazaar》游戏原始 Unity Sprite / 字体。提取过程仅只读打开游戏资源，不修改游戏或插件文件。

安装目录：`F:\SteamLibrary\steamapps\common\The Bazaar\TheBazaar_Data\StreamingAssets\aa\StandaloneWindows64`。

资源使用范围限于卡牌 DIY 展示：关键词、职业标识、卡面框、数值徽章、描述框、冷却与弹药组件和相关字体。游戏素材的权利仍属于原权利人。

## 图像

- `public/assets/icons/`：关键词彩色图标，来源 `fonts_assets_all.bundle` 的真实 `Text_Icon_Atlas_w_Shadows` Sprite。原始尺寸为 64×72，包含游戏黑描边和偏右下的阴影。显示版为 128×144，使用 2 倍 Lanczos 重采样，RGB 温和锐化，透明度边缘不锐化。它改善缩放观感，不产生原图没有的细节。`icons-source/` 保留原始像素供对照。
- `public/assets/heroes/`：Vanessa、Pygmalien、Dooley、Mak、Stelle、Jules、Karnok、The Dragons、中立的游戏内轮廓。来源为 `*flatrough*.bundle` 及 `tooltips_assets_all.bundle`（Karnok）。原生尺寸约 256×256，未放大。输出统一金棕色 `#94641c`；原始白色透明轮廓位于 `heroes-source/`。
- `public/assets/frames/`：来自 `cardframes_assets_all.bundle` 的 `Card_PreviewFrame_{品质}_{尺寸}_TUI`，完整 5 品质×3尺寸。均保留原始透明像素与尺寸。
- `public/assets/gems/`：相同包里的 `Card_PreviewGem_{Damage|Heal|Shield|Burn|Poison|Regen}_TUI`，原生 126×64。额外 Lifesteal 底板随原包提供。
- `public/assets/ui/`：来自 `ui_sprite_atlas_assets_all.bundle` 的标题、主动框、被动框、钟表、弹药、分隔线、箭头和深棕底纹。它们均保留原生像素。
- 传说品质没有独立 `Title` Sprite。`Tooltip_Legendary_Title_TUI.png` 是 `Tooltip_Legendary_Frame_Main_TUI` 顶部 210px 的机械裁切，中心透明、没有独立底边；须与棕色底板及主动区隔断组合绘制。
- `public/assets/assets-manifest.json` 记录每个素材的游戏资源包、原 Sprite 名、尺寸，以及原生九宫格边界 `sliceBorderLTRB`（左、上、右、下）。字体也列在此清单中。

关键词别名：`heal` / `health` 共用生命十字，`income` / `gold` / `value` 共用金币符号，`flying` / `flight` 共用飞行符号。`fusion` 是截图中全品质数值间的双箭头符号。`tempo-spend` 是带回转记号的消耗节奏符号。任务没有独立的关键词图标；暴怒在参考中仅文字换色，未用其他图标替代。

任务展示组件补充（对照 `参考素材/任务/{藏宝图,石碑,旅途石,地图集}.jpg` 及旧任务截图）：

| 文件（位于 `public/assets/ui/`） | 原始尺寸 | 原生九宫格 L/T/R/B | 用途 |
|---|---|---|---|
| `Tooltip_Quest_Divider_TUI.png` | 96×24 | 31/0/34/0 | 金色两端菱形横分隔线，左右端保持比例，仅伸展中央横线 |
| `Tooltip_Quest_DividerVertical_TUI.png` | 16×64 | 0/0/0/0 | 进度文字与奖励图标之间的竖分隔线，中央向右小菱形／箭头 |
| `Tooltip_Quest_DividerOperator_TUI.png` | 256×16 | 0/0/0/0 | 任务操作／进度辅助横线 |
| `Tooltip_Quest_ProgressBar_TUI.png` | 256×48 | 17/0/24/0 | 任务进度条组件 |
| `Tooltip_Quest_Frame_TUI.png` | 512×128 | 22/24/3/24 | 锁定总奖励外框；棕金描边与深棕底板 |
| `Tooltip_Quest_Lock.png` | 106×128 | 0/0/0/0 | 锁定奖励锁符号（原纹理 128×128，Sprite 裁切106×128），亦保存为 `icons/quest-lock.png` |

前四项来自 `tooltips_assets_all.bundle`；任务框和锁来自同名独立 Addressables 包。任务锁是奖励 UI 状态标识，与“任务”关键词没有独立图标的规则并不冲突。锁高度为128px，保留真实原生像素，无需人工放大。

横、竖任务分隔线的原始 Sprite 是白色轮廓，游戏中以金棕色着色后显示；应在渲染时按参考截图着色。原始锁定奖励文字配置为 `#ffcd92`、不透明度 `0.490196`，箭头为白色、不透明度 `0.490196`，合成在深棕底板上形成截图中的灰褐色。检查图 `docs/quest-assets-preview.png` 保留未经着色的原始 Sprite，方便查看轮廓。

透明区有时保留原纹理的 RGB 数值（传说主框中心的红色等），alpha 为 0。应使用 PNG alpha 合成，不应扁平化原 RGBA 图片。

## 字体

- `NotoSansSC-Bold.woff2`：游戏正文的 **Noto Sans SC / Bold，700**，来源 `fonts_cn_assets_all.bundle`，保留完整字符映射；原始 TTF 同目录保存。
- `NotoSerifSC-SemiBold.woff2`：游戏中文名称的 **Noto Serif SC SemiBold / Regular，600**，来自同一字体包，保留完整字符映射；原始 TTF 同目录保存。
- `LiberationSans.woff2` / `.ttf`：游戏包随带的西文回退字体。
- `BazaarNumbersWeb-Regular.woff2`：用于数值与冷却的 **Bazaar Numbers Web / Regular，400**。游戏只保留静态 `BazaarNumbers_Regular_SDF` 和实际字符宽度等元数据，未包含原始数字 TTF。这个网页字体从原 SDF 的 0.5 等值轮廓进行 4 倍采样恢复，保留原形状和字距；这是机械恢复版本，不是游戏原始 TTF。原始 atlas 和完整 TMP 元数据保存在 `docs/numbers-sdf.png`、`docs/fontasset-BazaarNumbers_Regular_SDF.json`。可用字符以原 atlas 为限：数字、小数点、百分号、部分括号和英文计量字母；数值之间的箭头使用 `fusion` 图标或普通字体。

`docs/native-assets-preview.png` 和 `docs/numbers-font-preview.png` 记录透明轮廓、颜色及数字字体的实际检查结果。

## 重现

Python 3 + Pillow、UnityPy、fontTools、Brotli；恢复数字字体还需要 OpenCV / NumPy。依赖只放本地 `.asset-tools`，不属于应用代码或网站部署内容。

```powershell
python -m pip install --target .asset-tools UnityPy fonttools brotli opencv-python-headless
python scripts/extract-game-assets.py
```

可用 `--game-dir` 指向其他安装目录中的 `StandaloneWindows64`；已经生成完整中文 WOFF2 时，可以加 `--skip-fonts` 省去再次字体压缩。

此前基于用户 `参考素材` 截图的回退提取脚本为 `scripts/extract-assets.py`。附件关键词、类型图片已复制进 `参考素材/关键词标签.png` 与 `参考素材/类型标签.png`，避免依赖临时剪贴板目录。现在以游戏包的原始图像优先；截图脚本单独运行会覆盖同名素材，使用后应再运行游戏包提取脚本。

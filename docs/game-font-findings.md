# 本机游戏字体与 TMP 样式核对

2026-10-10，只读提取本机 `F:/SteamLibrary/steamapps/common/The Bazaar/TheBazaar_Data`。详细可机器读取的原始参数摘要见 `game-font-rendering.json`。

## 确认结论

中文效果正文为 `NotoSansSC-Bold`（字重 700）；中文物品名称为 `NotoSerifSC-SemiBold`（字重 600）。两份完整源 TTF 从 `StreamingAssets/aa/StandaloneWindows64/fonts_cn_assets_all.bundle` 的 Font 对象提取，文件逐字节与现有 `public/assets/fonts/*.ttf` 相同，不需要换字体。

- Sans Font path ID：`-2775525612522245199`，10,549,812 bytes，30,890 cmap。
- Serif Font path ID：`473551122707195620`，14,807,872 bytes，30,928 cmap。
- Sans 常用静态 TMP FontAsset path ID：`-6321148902634122542`，face point size 43，padding 8，gradient scale 9。
- Serif 常用静态 TMP FontAsset path ID：`-8284908277950232515`，face point size 48，padding 9，gradient scale 10。
- 两者 TMP normalStyle 0，normalSpacingOffset 0，boldStyle .75，boldSpacing 7；物品效果 / 标题原 Text 均 m_fontWeight=400、m_fontStyle=0，没有叠加 TMP synthetic bold。网页使用 font-weight 700/600 选择原始对应字重仍正确。

游戏英文主字体为 `NotoSans`（face Bold，point64）和 `NotoSerif`（face SemiBold，point64）；中文通过 `NotoFontFallbackConfiguration` zh-CN / zh-Hans / zh 回退到字体包的三个CN SDF（主集、第二集、动态集）。原主要 FontAsset source font 指针为空，所查字体包/main assets未包含英文字体源 TTF。

## 真正物品 UI 样式（不是 CN 字体默认材质）

`tooltips_assets_all.bundle`：Active_EffectText1..4 / Tooltip_Active_EffectText_P 指向 NotoSans，sharedMaterial `NotoSans_ToolTipsTags_M` pathID `-2875357494318815779`；字号39，characterSpacing -2，lineSpacing -35。Passive_Effect_Text 相同材质，字号39（有一个36），spacing -1。

正文材质 source gradient scale 13：FaceDilate .205，OutlineWidth .176，ScaleRatioA .92308，UNDERLAY_ON；UnderlayOffsetX 1，Y -1，Dilate -.009，Softness0。描边为近黑紫 RGBA(.01293,.00392,.07843,1)，阴影 RGBA(.000078,0,.019608,.93725)。

`Header_Label` 指向 NotoSerif：字号58，spacing -1.5，sharedMaterial `NotoSerif_Titles_M` pathID `5847554263670965817`。source gradient17；FaceDilate .06，OutlineWidth .038，ScaleRatioA .94118；阴影位移(.17,-.13)，Dilate .19，RatioC .70824。描边为棕金 RGBA(.80054,.43161,.15860,1)。不能直接沿用正文的厚黑色边。

附魔段 `Enchantment_Text` sharedMaterial `NotoSans_Tooltip_Black_M` pathID `-1932230790168212534`：字号39、spacing -2；FaceDilate .21、Outline .162、黑描边、阴影位移(.432,-.337)、Dilate .431。

## 正文数值字体：运行时证据

不能只根据静态 Text 字体指针把正文数值改成 NotoSans。`TheBazaarRuntime.dll` 中 `TooltipTypography.GetStringWithIconAndValue`、`GetStringWithValue`、`GetStringWithIconAndWord` 明确对指定数值插入：

```
<font="BazaarNumbers_Regular_SDF" material="BazaarNumbers_Regular_SDF_OutlineTooltip_M">
```

同时使用 `<size=145%><voffset=-4>`（来自 TooltipTypography 对象 iconScalePercentageSize145 和 constructor），以较高数字形状和中文对齐。未经属性格式化的普通数字仍沿用基字体。完整只读 IL 记录于 `runtime-font-il.txt`，上述tag在1766、2028等行。

数字 Tooltip 材质在 `tooltips_assets_all.bundle`，pathID `1860050802063975187`，face font point60、gradient31：FaceDilate .06、Outline .037、RatioA .96774；黑描边；阴影位移(.105,-.121)、Dilate .009、Softness0、RatioC .88548、alpha .87451。数字原字体源TTF未找到，已有SDF机械恢复字体继续使用。

## Canvas 近似建议

材质数字不能直接当 Canvas 像素。以下按源SDF point/gradient和字体回退纹理近似换算，须对截图微调；不声称逐像素等同 TMP。

1. 先绘制下方阴影和外描边，再绘制一圈**与字面同色**的细线并填充，使 FaceDilate 真正拓宽有色字面；只有黑描边不会增加字面厚度。
2. 正文：同色 stroke 宽约字号 × .040；外描边线宽约 × .074；主动 tracking ≈ 字号 × -.051，被动 ≈ -.026。阴影可从 x/y ≈ 字号 × .10 / .10 开始（计算参考约 .117）。
3. 标题：同色 stroke ≈ × .012；总外描边 ≈ × .019，棕金色；tracking ≈ -.026；阴影 x≈×.025、y≈×.019。避免 min lineWidth=1.4 导致小标题出现过粗描边。
4. 数字：同色 stroke ≈ × .030，总外黑描边 ≈ × .049；阴影 x≈×.048、y≈×.055。已有 .055 黑stroke接近边宽，但缺少字面同色膨胀。
5. 绘制和测量统一 tracking，避免断行宽度与实际字符间距不同。属性数值使用游戏数字字体，普通自然语言数量可使用正文，规则应从语义标注决定，不宜用“所有纯数字”判断。

## Bazaar++ 证据

已只读检查本机 `BepInEx/plugins/BazaarPlusPlus.dll`：`NativeGameTypography.TryGetSansFontAsset/TryGetSerifFontAsset` 使用 `NotoFontFallbackRuntime._loadedSansPrimary/_loadedSerifPrimary`；`ResolveFallbacks` 读取游戏 `_configuration` 的相应语言 fallback 引用。图鉴插件没有在此处改为另一套中文源字体。IL 见 `plugin-font-il.txt`。

研究过程仅生成 `.local/fonts-research/` 候选原件、TMP JSON、材质 JSON、IL与摘要，没有修改游戏或插件文件。

## 网页实际采用的近似

在导出图比对后，Canvas直接照搬上述SDF换算会让部分汉字内部空隙过窄。网页保留源字体，采用较轻的同色加厚（正文约字号 × .016，标题 × .008，数字 × .012），标题使用细棕金描边；主动字距采用 × -.035，被动 × -.026。这些是针对浏览器轮廓抗锯齿的视觉修正，不是声称Canvas完全复现TMP着色器。数字仍使用SDF恢复字体；暂无证据支持替换成其他中文字体。

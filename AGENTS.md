# 开发交接

- 本对话承接项目主开发；这里只保留长期约束与仍需注意的事项，不累积已完成改动和调试过程。
- 游戏内实际表现及 `参考素材/` 截图优先，BazaarDB 只作辅助；素材来源见 `docs/asset-sources.md`。
- 本地开发与线上发布共用同一套代码和美术样式，不维护独立的本地视觉版本；上线直接使用本地构建结果。
- 当前工作区已有较多未提交修改，继续基于现状开发，避免覆盖或丢弃。
- 静态原生 JavaScript + Canvas；`src/model.js` 管数据，`src/renderer.js` 共用于预览和导出，`src/app.js` 管编辑交互。
- 验证使用 `npm test`、`npm run build`；需要显示验证时检查实际 PNG 导出。
- 正式站 `https://bazaardiy.kalhark.com/`，仓库 `Kaltistark/Bazaar-DIY`；Cloudflare Direct Upload 部署流程见 `docs/cloudflare-deployment.md`，GitHub 推送不自动部署。

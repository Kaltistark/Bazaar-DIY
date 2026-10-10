# 部署到 bazaardiy.kalhark.com

这是在浏览器本地处理作品的纯静态应用，无需服务器、数据库、API 密钥或 ChatGPT 登录。Sites 预览站的登录与“编辑网站”由原托管平台添加，Cloudflare 直接部署 `dist/` 时不含这些界面。

## 当前已上线的项目

正式地址：`https://bazaardiy.kalhark.com/`，备用地址：`https://bazaar-diy.pages.dev/`。
当前 Cloudflare Pages 项目名为 `bazaar-diy`，采用 Direct Upload；阿里云已添加 `bazaardiy` 的 CNAME，指向 `bazaar-diy.pages.dev`。HTTPS 已激活。

后续更新：在本地运行 `npm run build` 和 `python scripts/package-pages.py`，进入 Cloudflare **Workers & Pages → bazaar-diy → Create deployment**，选择 **Production**，上传新的 `output/bazaar-diy-cloudflare.zip` 并部署。域名记录无需重新配置。GitHub 推送目前不会自动更新这个 Direct Upload 项目；如需 Git 自动部署，应另外创建 Git 集成项目并迁移域名。

## 推荐：GitHub 自动部署

1. 登录 Cloudflare 控制台，进入 **Workers & Pages → Create application → Pages → Import an existing Git repository**。授权自己的 GitHub 账户，选择 `Kaltistark/Bazaar-DIY`。
2. 构建设置如下：

   | 设置 | 填写内容 |
   | --- | --- |
   | 项目名称 | `bazaar-diy`（被占用时可换名字） |
   | 生产分支 | `main` |
   | 框架预设 | `None` |
   | 根目录 | 留空，使用仓库根目录 |
   | 构建命令 | `npm run build` |
   | 构建输出目录 | `dist` |
   | 环境变量 | `NODE_VERSION=24` |

3. 点击 **Save and Deploy**。等待成功后先访问实际分配的 `xxx.pages.dev` 地址，检查编辑和 PNG 下载。之后推送 `main` 会自动更新网站。

仓库已包含 `.node-version`，指定 Node 24；环境变量也可覆盖该版本。

参考：[Cloudflare 静态网站部署](https://developers.cloudflare.com/pages/framework-guides/deploy-anything/)、[构建设置](https://developers.cloudflare.com/pages/configuration/build-configuration/)、[Node 版本设置](https://developers.cloudflare.com/pages/configuration/build-image/)。

## 更快捷：上传现成部署包

已准备 `output/bazaar-diy-cloudflare.zip`，压缩包根目录直接包含 `index.html`、`styles.css`、`src/`、`assets/`。

进入 **Workers & Pages → Create application → Pages → Drag and drop / Upload assets**，上传此 ZIP 并部署。也可运行 `npm run build` 后直接上传 `dist/` 文件夹。此方式每次更新需要重新上传；Direct Upload 项目后续不能直接切换成 Git 集成，若希望自动更新，优先采用上面的 GitHub 方式。

参考：[Cloudflare Direct Upload](https://developers.cloudflare.com/pages/get-started/direct-upload/)。

## 绑定你的子域名

已查询到 `kalhark.com` 当前使用 `dns19.hichina.com` 和 `dns20.hichina.com`，因此现阶段按下方阿里云 DNS 步骤添加记录即可。

1. 在已部署的 Pages 项目中进入 **Custom domains → Set up a domain**，填写 `bazaardiy.kalhark.com`。
2. 若 `kalhark.com` 的 DNS 仍由阿里云托管：进入阿里云 **云解析 DNS → 权威域名解析 → kalhark.com → 添加记录**，填写：

   | 字段 | 值 |
   | --- | --- |
   | 记录类型 | `CNAME` |
   | 主机记录 | `bazaardiy` |
   | 记录值 | Cloudflare 实际分配的 `xxx.pages.dev`，不带 `https://` 或路径 |
   | 解析线路 | 默认 |
   | TTL | 默认即可 |

   若此主机名已经有记录，先检查其用途，避免创建冲突的 A/AAAA/CNAME 记录。
3. 若域名的权威 DNS 已经转到 Cloudflare，则在 Cloudflare 中确认自动生成的记录；阿里云此时只负责域名注册，修改阿里云 DNS 记录不会生效。
4. 等待 Pages 的域名状态变为 **Active**，再访问 `https://bazaardiy.kalhark.com`。子域名方案无需修改整个域名的 nameserver，也无需购买阿里云服务器。

必须先在 Pages 中绑定域名，再添加 CNAME，单独添加解析会导致验证失败或 522 错误。HTTPS 由 Cloudflare 在域名验证后提供。

参考：[Cloudflare 自定义域名](https://developers.cloudflare.com/pages/configuration/custom-domains/)、[阿里云公网解析记录](https://help.aliyun.com/zh/dns/pubz-add-parsing-record/)。

## 上线后检查

- 用未登录 ChatGPT 的浏览器打开自有域名，确认没有登录和编辑浮层。
- 上传图片、拖动和滚轮缩放、分别调整 CD 整数与十分位，确认预览更新。
- 下载当前等级与全等级 PNG，并用作品 JSON 验证导入导出。
- 从原预览站迁移时，先保存作品 JSON，再到新域名打开。浏览器本地草稿按域名存储，不能跨域自动同步。

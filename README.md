# HidenCloud 自动续期脚本

[🇬🇧 English](./README_EN.md) | 🇨🇳 简体中文

## 📖 简介

这是一个用于 HidenCloud 服务自动续期的脚本，支持本地运行、GitHub Actions 云端运行和青龙面板三种部署方式。可以自动完成续期和支付操作，并智能管理 Cookie 缓存。

## ✨ 主要特性

- ☁️ **多种部署方式**：本地运行 / GitHub Actions / 青龙面板
- 🔄 **Cookie 自动持久化**：自动更新并缓存最新 Cookie
- 👥 **多账号支持**：支持同时处理多个账号（最多 10 个）
- 💳 **自动支付**：自动完成续期后的支付流程
- 📊 **详细日志**：实时输出处理进度和结果
- 🛡️ **智能重试**：Cookie 失效时自动回退重试
- 🔐 **安全可靠**：GitHub Actions 自动更新仓库变量中的 Cookie

## 🚀 部署方式

### 方式一：本地运行（推荐新手）

**前置要求：**

- Node.js (建议 v14 或更高版本)
- npm 包依赖：`axios`, `cheerio`

**快速开始：**

详见 [快速开始指南](./start.md)

### 方式二：GitHub Actions（推荐）

完全云端自动化，无需本地环境，自动更新 Cookie。

**配置步骤：**

1. **Fork 本仓库**到你的 GitHub 账号
2. **获取 Personal Access Token (PAT)**

   - 访问 GitHub Settings → Developer settings → Personal access tokens → Fine-grained tokens
   - 点击 Generate new token
   - Repository access: 选择你 Fork 的仓库
   - Permissions → Repository permissions → Variables: 设置为 **Read and write**
   - 生成并复制 Token（格式：`github_pat_xxx`）
3. **设置仓库 Secret**

   - 进入你 Fork 的仓库 → Settings → Secrets and variables → Actions
   - 点击 New repository secret
   - Name: `ACTION_VARS_TOKEN`
   - Secret: 粘贴你的 Token
4. **设置仓库变量（Variables）**

   - 同样在 Settings → Secrets and variables → Actions → Variables 标签
   - 依次添加变量：
     - `COOKIE1`: 第一个账号的完整 Cookie
     - `COOKIE2`: 第二个账号的完整 Cookie（如有）
     - `COOKIE3`, `COOKIE4`... (根据需要)
5. **启用 GitHub Actions**

   - 进入 Actions 标签
   - 如果看到提示，点击 "I understand my workflows, go ahead and enable them"
6. **手动运行测试**

   - Actions → HidenCloud Auto Renew → Run workflow
   - 查看运行日志确认成功

**工作流说明：**

- 自动运行：每 3 天自动触发
- 手动触发：可随时在 Actions 页面手动运行
- Cookie 自动更新：执行完成后会自动更新仓库变量中的 Cookie

### 方式三：青龙面板

适合已有青龙面板的用户。

**使用方法：**

1. 复制 `qinglong.js` 到青龙面板
2. 设置环境变量 `HIDEN_COOKIE`，多账号用 `&` 或换行分隔
3. 定时规则：`0 10 */7 * *`（每 7 天运行）

详见文件内注释说明。

## 🚀 使用方法

### 1. 安装依赖

```bash
npm install axios cheerio
```

### 2. 准备 Cookie 文件

在脚本同目录下创建 `cookie.json` 文件，格式如下：

```json
{
    "cookie1": "你的第一个账号的完整Cookie字符串",
    "cookie2": "你的第二个账号的完整Cookie字符串",
    "cookie3": ""
}
```

**说明：**

- 字段名必须为 `cookie1`, `cookie2`, `cookie3` 等格式
- 留空或不填的字段会被自动忽略
- Cookie 获取方法见下文

### 3. 运行脚本

```bash
node local_renew.js
```

## 🍪 如何获取 Cookie

### 方法一：浏览器开发者工具

1. 登录 [HidenCloud Dashboard](https://dash.hidencloud.com)
2. 按 `F12` 打开开发者工具
3. 切换到 `Network` (网络) 标签
4. 刷新页面
5. 点击任意请求，查看 `Request Headers`
6. 复制 `Cookie` 字段的完整内容

### 方法二：浏览器扩展

使用 Cookie 导出扩展（如 EditThisCookie、Cookie-Editor）直接导出。

## ⚙️ 配置说明

脚本内的可配置参数（在 `local_renew.js` 顶部）：

```javascript
const RENEW_DAYS = 10;  // 续期天数，默认 10 天
const COOKIE_FILE = path.join(__dirname, 'cookie.json');  // Cookie 文件路径
const CACHE_FILE = path.join(__dirname, 'hiden_cookies_cache.json');  // 缓存文件路径
```

## 📁 文件说明

### 主要文件

- `local_renew.js` - 本地/云端通用脚本（支持双模式）
- `qinglong.js` - 青龙面板专用脚本
- `update_vars.js` - GitHub 仓库变量更新工具
- `.github/workflows/renew.yml` - GitHub Actions 工作流配置

### 配置文件

- `cookie.json` - 本地模式 Cookie 配置文件
- `hiden_cookies_cache.json` - Cookie 缓存文件（自动生成）
- `package.json` - Node.js 依赖配置

### 文档

- `README.md` - 中文文档（当前文件）
- `README_EN.md` - 英文文档
- `start.md` / `start.bat` - 快速开始指南

## 🔧 运行流程

1. 读取 `cookie.json` 中的 Cookie 配置
2. 优先使用缓存的最新 Cookie（如有）
3. 验证登录状态
4. 获取账号下的所有服务列表
5. 逐个处理每个服务：
   - 提交续期请求
   - 自动完成支付
6. 更新 Cookie 缓存
7. 输出处理结果汇总

## 📊 运行示例

```
╔════════════════════════════════════════════╗
║   HidenCloud 本地自动续期脚本 v2.0        ║
╚════════════════════════════════════════════╝

📋 共找到 2 个账号

==================================================
开始处理: cookie1 (1/2)
==================================================
[cookie1] 🔄 发现本地缓存 Cookie，优先使用...
[cookie1] 🔍 正在验证登录状态...
[cookie1] ✅ 登录成功，发现 3 个服务
[cookie1] >>> 处理服务 ID: 12345
[cookie1] 📅 提交续期 (10天)...
[cookie1] ⚡️ 续期成功，前往支付
[cookie1] 💳 提交支付...
[cookie1] ✅ 支付成功！
💾 [cookie1] 最新 Cookie 已保存到本地缓存

╔════════════════════════════════════════════╗
║              续期结果汇总                  ║
╚════════════════════════════════════════════╝

📊 cookie1:
   ✅ 成功续期 3 个服务
📊 cookie2:
   ✅ 成功续期 2 个服务

✨ 脚本执行完毕！
```

## ⚠️ 注意事项

1. **Cookie 安全**：请妥善保管 `cookie.json` 文件，不要泄露给他人
2. **定期更新**：Cookie 可能会过期，失效时请及时更新
3. **运行频率**：建议设置定时任务，每 7 天运行一次
4. **网络环境**：确保网络能正常访问 hidencloud.com

## 🤖 定时任务设置

### Windows 任务计划程序

1. 打开「任务计划程序」
2. 创建基本任务
3. 触发器设置为每 7 天运行一次
4. 操作选择「启动程序」
5. 程序/脚本填写 `node`
6. 添加参数填写脚本完整路径

### Linux/Mac Crontab

```bash
# 编辑 crontab
crontab -e

# 添加定时任务（每周一上午10点运行）
0 10 * * 1 cd /path/to/hidencloud && node local_renew.js >> renew.log 2>&1
```

## 🆚 部署方式对比

| 特性            | 本地运行     | GitHub Actions    | 青龙面板    |
| --------------- | ------------ | ----------------- | ----------- |
| 运行环境        | 本地 Node.js | GitHub 云端       | 青龙容器    |
| Cookie 来源     | cookie.json  | 仓库变量          | 环境变量    |
| 自动定时        | 需手动设置   | ✅ 内置           | ✅ 内置     |
| Cookie 自动更新 | ✅ 本地缓存  | ✅ 自动推送到仓库 | ✅ 本地缓存 |
| 消息推送        | ❌           | ❌                | ✅          |
| 多账号支持      | ✅           | ✅                | ✅          |
| 免费使用        | ✅           | ✅                | 需自建      |
| 推荐指数        | ⭐⭐⭐       | ⭐⭐⭐⭐⭐        | ⭐⭐⭐⭐    |

## 🐛 问题排查

### Cookie 失效

**现象**：提示「当前 Cookie 已失效」

**解决**：

1. 重新登录 HidenCloud
2. 获取最新 Cookie
3. 更新 `cookie.json`

### 依赖安装失败

**现象**：`npm install` 报错

**解决**：

```bash
# 清除缓存
npm cache clean --force

# 重新安装
npm install axios cheerio
```

### 网络超时

**现象**：请求超时或连接失败

**解决**：

1. 检查网络连接
2. 尝试使用代理
3. 增加脚本中的 `timeout` 值

## 📜 许可证

MIT License

## 🙏 致谢

感谢 [gally16](https://linux.do/u/gally16)提供的青龙脚本！本项目在此基础上进行了优化和Github Actions部署和windows部署。

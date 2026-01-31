# 快速开始指南 🚀

本文档提供两种使用方式：**本地方案**和**云端方案（GitHub Actions）**。

---

## 📍 方案选择

| 方案               | 适合人群           | 优势                     | 劣势            |
| ------------------ | ------------------ | ------------------------ | --------------- |
| **本地方案** | 新手、需要立即使用 | 简单直接、无需配置       | 需要手动运行    |
| **云端方案** | 追求自动化的用户   | 完全自动化、无需本地环境 | 需要配置 GitHub |

---

## 💻 本地方案：3 步即可开始使用

### 步骤 1️⃣：获取 Cookie

1. 打开浏览器，访问 https://dash.hidencloud.com
2. 登录你的账号
3. 按 `F12` 打开开发者工具
4. 切换到 `Network (网络)` 标签
5. 刷新页面 (F5)
6. 点击任意请求，找到 `Request Headers` 中的 `Cookie` 字段
7. 复制完整的 Cookie 内容

### 步骤 2️⃣：配置 Cookie

在项目目录下编辑 `cookie.json` 文件：

```json
{
    "cookie1": "粘贴你复制的Cookie这里",
    "cookie2": ""
}
```

- `cookie1` 填入第一个账号的 Cookie
- `cookie2` 填入第二个账号的 Cookie（如果有）
- 如果没有第二个账号，留空即可

### 步骤 3️⃣：运行脚本

#### 方法一：双击批处理文件（Windows）

直接双击 `start.bat` 文件

#### 方法二：使用命令行

```bash
npm start
# 或
node local_renew.js
```

### ✅ 完成！

脚本会自动：

- ✨ 验证登录状态
- 📋 获取所有服务列表
- 🔄 自动续期所有服务
- 💳 自动完成支付
- 💾 缓存最新 Cookie

### 🔄 设置定时任务（可选）

**Windows 任务计划程序：**

1. 打开「任务计划程序」
2. 创建基本任务
3. 触发器：每 7 天
4. 操作：启动程序 `start.bat`

---

## ☁️ 云端方案：GitHub Actions 全自动化

完全云端运行，无需本地环境，自动更新 Cookie。

### 步骤 1️⃣：Fork 仓库

访问项目 GitHub 页面，点击右上角 **Fork** 按钮，将仓库复制到你的账号下。

### 步骤 2️⃣：获取 GitHub Personal Access Token

> [!IMPORTANT]
> 这个 Token 用于让 GitHub Actions 自动更新仓库变量中的 Cookie。

#### 2.1 创建 Token

1. 访问 GitHub 个人设置

   - 点击右上角头像 → **Settings**
2. 进入开发者设置

   - 左侧边栏底部 → **Developer settings**
3. 创建 Fine-grained token（推荐）

   - 点击 **Personal access tokens** → **Fine-grained tokens**
   - 点击 **Generate new token**

#### 2.2 配置 Token 权限

**重要配置项：**

| 配置项            | 设置值                                                   |
| ----------------- | -------------------------------------------------------- |
| Token name        | 任意名称，如 `HidenCloud Renew`                        |
| Expiration        | 建议选择 `90 days` 或 `No expiration`                |
| Resource owner    | 选择你的账号                                             |
| Repository access | **Only select repositories** → 选择你 Fork 的仓库 |

**权限设置（Permissions）：**

展开 **Repository permissions**，找到以下项目并设置：

- **Variables**: 设置为 `Read and write` ✅ **（必须）**

其他权限保持默认即可。

#### 2.3 生成并保存 Token

1. 点击页面底部 **Generate token**
2. **立即复制** Token（格式：`github_pat_xxxxx`）
3. ⚠️ Token 只显示一次，请妥善保存

### 步骤 3️⃣：配置仓库 Secret

1. 进入你 Fork 的仓库
2. 点击 **Settings** → **Secrets and variables** → **Actions**
3. 点击 **New repository secret**
4. 配置 Secret：
   - **Name**: `ACTION_VARS_TOKEN`
   - **Secret**: 粘贴刚才复制的 Token
5. 点击 **Add secret**

### 步骤 4️⃣：配置仓库变量（Variables）

> [!NOTE]
> 这里存储你的 Cookie，脚本会自动读取并在执行后更新。

1. 同样在 **Settings** → **Secrets and variables** → **Actions**
2. 切换到 **Variables** 标签
3. 点击 **New repository variable**
4. 依次添加以下变量：

#### 第一个账号：

- **Name**: `COOKIE1`
- **Value**: 粘贴第一个账号的完整 Cookie
- 点击 **Add variable**

#### 第二个账号（如有）：

- **Name**: `COOKIE2`
- **Value**: 粘贴第二个账号的完整 Cookie
- 点击 **Add variable**

#### 更多账号（如有）：

继续添加 `COOKIE3`, `COOKIE4` ... 最多支持 10 个账号。

### 步骤 5️⃣：启用 GitHub Actions

1. 点击仓库顶部的 **Actions** 标签
2. 如果看到提示，点击 **I understand my workflows, go ahead and enable them**

### 步骤 6️⃣：手动测试运行

1. 在 **Actions** 页面，左侧选择 **HidenCloud Auto Renew**
2. 点击右侧 **Run workflow** 按钮
3. 再次点击绿色的 **Run workflow** 确认
4. 等待几秒，页面会出现新的运行记录
5. 点击进入查看详细日志

### ✅ 完成！

**自动运行：**

- 每 3 天自动触发一次
- 可在 Actions 页面随时手动运行

**Cookie 自动更新：**

- 脚本执行完成后自动更新仓库变量
- 下次运行会使用最新的 Cookie
- 无需手动维护

**查看运行记录：**

- Actions 页面可查看所有运行历史
- 点击任意记录可查看详细日志

---

## ❓ 常见问题

### Q: 如何获取 Cookie？

A: 见上方「步骤 1️⃣：获取 Cookie」。

### Q: GitHub Actions 运行失败怎么办？

A: 检查以下几点：

1. `ACTION_VARS_TOKEN` 是否正确设置
2. Token 是否有 Variables (Read and write) 权限
3. 仓库变量 `COOKIE1` 等是否已配置
4. Cookie 是否已过期（需重新获取）

### Q: 本地和云端可以同时使用吗？

A: 可以，两种方式使用的是不同的 Cookie 来源（cookie.json vs 仓库变量），互不影响。

### Q: Token 过期后怎么办？

A: 重新生成一个新的 Token，并更新仓库 Secret `ACTION_VARS_TOKEN` 即可。

### Q: 如何查看云端运行结果？

A: 进入 Actions 页面，点击任意运行记录，查看详细日志输出。

---

## 📖 更多帮助

- 详细文档：[README.md](./README.md)
- 英文文档：[README_EN.md](./README_EN.md)
- 问题反馈：GitHub Issues

---

**💡 提示**：第一次运行后，会生成 `hiden_cookies_cache.json` 缓存文件，下次运行时会优先使用缓存的最新 Cookie，提高成功率！

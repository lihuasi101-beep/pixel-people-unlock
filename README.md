# Pixel People Unlock Tracker

一个无后端、可长期维护的 Pixel People 职业解锁自查静态站。

## 目录

```text
data/
  professions.csv   # 职业基础数据：分类、合成前置、工作建筑
  state.json        # 当前玩家状态：已解锁职业、目标范围
src/
  index.html        # 页面骨架
  styles.css        # 视觉样式
  app.js            # 前端渲染与筛选
scripts/
  build.ps1         # 构建 dist/
dist/
  index.html        # 可部署产物
  data/*.json/csv   # 页面读取的数据
```

## 高频更新流程

新解锁职业时，只改 `data/state.json`：

```json
"explicitUnlocked": [
  "Witch",
  "New Profession"
]
```

然后运行：

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass -Force
.\scripts\build.ps1
```

发布 `dist/` 目录即可。

## 推荐托管方式

长期方案推荐 GitHub Pages：

1. 把 `pixel-people-unlock` 作为一个 GitHub 仓库。
2. Settings -> Pages -> Source 选择 GitHub Actions。
3. 每次更新 `data/state.json` 后 push。
4. `.github/workflows/pages.yml` 会自动构建并发布 `dist/`。

也可以用 Cloudflare Pages / Netlify / Vercel：

- 如果平台不运行 PowerShell 构建：本地运行 `scripts/build.ps1`，部署 `dist/`。
- 如果平台支持 PowerShell：构建命令用 `pwsh ./scripts/build.ps1`，输出目录用 `dist`。

## 数据口径

- `unlockThrough` 是基准线，例如 `"Wrestler"`。
- `explicitUnlocked` 是用户明确确认的已解锁职业。
- 构建时会递归补齐已解锁职业所需的普通职业前置。
- 特殊基因只在已解锁职业配方中出现过时视为当前可用。
- 推荐顺位按：当前可合成 -> 新增建筑数 -> 立即后续解锁数 -> 传递后续数 -> 工作建筑数 -> Wiki 表序。

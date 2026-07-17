# Pixel People Unlock Tracker

一个无后端、可长期维护的 Pixel People 职业解锁自查静态站。

## 目录

```text
data/
  professions.csv   # 职业基础数据：分类、合成前置、工作建筑
  animals.csv       # 动物基础数据：Tier、分类、公式、材料分类、获取规则
  state.json        # 当前玩家状态：已解锁职业、目标范围
src/
  index.html        # 页面骨架
  styles.css        # 视觉样式
  app.js            # 前端渲染与筛选
scripts/
  build.ps1         # 构建 dist/
  update_animals.ps1 # 从 Fandom MediaWiki API 刷新 data/animals.csv
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

新解锁特殊基因时，写入 `explicitUnlockedGenes`：

```json
"explicitUnlockedGenes": [
  "Romantic"
]
```

然后运行：

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass -Force
.\scripts\build.ps1
```

发布 `dist/` 目录即可。

动物配方数据通常不需要随玩家状态高频改动。需要刷新 Wiki 动物库时运行：

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass -Force
.\scripts\update_animals.ps1
.\scripts\build.ps1
```

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
- `explicitUnlockedGenes` 是用户明确确认的已解锁特殊基因。
- 构建时会递归补齐已解锁职业所需的普通职业前置。
- 特殊基因在 `explicitUnlockedGenes` 中出现，或在已解锁职业配方中出现过时，视为当前可用。
- 推荐顺位按：当前可合成 -> 新增建筑数 -> 立即后续解锁数 -> 传递后续数 -> 工作建筑数 -> Wiki 表序。
- 动物数据来自 Fandom `Animals` 页面的 `AnimalListTier1-2` 与 `AnimalListTier3-6` 模板。
- 动物页展示字段包括：动物缩略图、动物、Tier、分类、季节、公式 1/2、公式材料缩略图、公式材料分类、获取规则。
- `update_animals.ps1` 会通过 Fandom `pageimages` API 写入动物缩略图 URL；没有返回图片的动物会在页面显示占位缩略图。
- 动物合成规则：Tier 1-2 可通过动物包/Heart/Pet Store/Animal Shelter 或 Altar 获取；Tier 3+ 只能在 Altar 合成；合成会消耗两个材料动物；`any Cat` / `any Dog` 是随机同分类公式。
- “推荐 Secret 消耗品”用于 `any Secret animal` 任务：优先标记 Tier 3 Secret、递归基础材料成本为 2、且成品不作为后续配方材料的动物；完整动物表会同时展示建议保留和成本偏高的 Secret。

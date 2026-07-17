param(
  [string]$ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
)

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'

function Read-Json($Path) {
  Get-Content -LiteralPath $Path -Raw -Encoding UTF8 | ConvertFrom-Json
}

function Write-Utf8NoBom($Path, $Content) {
  [System.IO.File]::WriteAllText($Path, $Content, [System.Text.UTF8Encoding]::new($false))
}

function Split-List([string]$Value) {
  if ([string]::IsNullOrWhiteSpace($Value)) { return @() }
  return @($Value -split ',\s*' | Where-Object { $_ })
}

function Is-NormalProfession($Name, $ByName) {
  return (-not [string]::IsNullOrWhiteSpace($Name)) -and $Name -ne 'None' -and $ByName.ContainsKey($Name)
}

function Is-SpecialGene($Name, $Category) {
  return (-not [string]::IsNullOrWhiteSpace($Name)) -and $Name -ne 'None' -and $Category -eq '特殊基因'
}

function Get-Descendants([string]$Name, $Children) {
  $result = [System.Collections.Generic.HashSet[string]]::new()
  if (-not $Children.ContainsKey($Name)) { return $result }
  foreach ($child in $Children[$Name]) {
    [void]$result.Add($child)
    $sub = Get-Descendants $child $Children
    foreach ($item in $sub) { [void]$result.Add($item) }
  }
  return $result
}

function Resolve-ConfiguredName([string]$Name, $Aliases) {
  if ($Aliases -and $Aliases.PSObject.Properties.Name -contains $Name) {
    return [string]$Aliases.$Name
  }
  return $Name
}

function Get-AnimalBaseCost([string]$Animal, $AnimalByName, $Seen) {
  if ([string]::IsNullOrWhiteSpace($Animal) -or -not $AnimalByName.ContainsKey($Animal)) { return 1 }
  $row = $AnimalByName[$Animal]
  if ($row.tier -le 2) { return 1 }
  if ($Seen.ContainsKey($Animal)) { return 999 }
  $nextSeen = @{}
  foreach ($key in $Seen.Keys) { $nextSeen[$key] = $true }
  $nextSeen[$Animal] = $true
  return (Get-AnimalBaseCost $row.formula1 $AnimalByName $nextSeen) + (Get-AnimalBaseCost $row.formula2 $AnimalByName $nextSeen)
}

function Get-CountOrZero($Map, [string]$Key) {
  if ($Map.ContainsKey($Key)) { return [int]$Map[$Key] }
  return 0
}

$dataDir = Join-Path $ProjectRoot 'data'
$srcDir = Join-Path $ProjectRoot 'src'
$distDir = Join-Path $ProjectRoot 'dist'
$distDataDir = Join-Path $distDir 'data'

$professionsCsv = Join-Path $dataDir 'professions.csv'
$animalsCsv = Join-Path $dataDir 'animals.csv'
$statePath = Join-Path $dataDir 'state.json'
$state = Read-Json $statePath
$rawRows = Import-Csv -LiteralPath $professionsCsv

$rows = @()
foreach ($row in $rawRows) {
  $rows += [pscustomobject]@{
    no = [int]$row.No
    profession = [string]$row.Profession
    category = [string]$row.Category
    formula1 = [string]$row.Formula1
    formula1Category = [string]$row.Formula1Category
    formula2 = [string]$row.Formula2
    formula2Category = [string]$row.Formula2Category
    workplaces = [string]$row.Workplaces
  }
}

$byName = @{}
foreach ($row in $rows) { $byName[$row.profession] = $row }
$byNo = $rows | Sort-Object no

$unlocked = [System.Collections.Generic.HashSet[string]]::new()
$unlockThrough = Resolve-ConfiguredName ([string]$state.unlockThrough) $state.aliases
if (-not $byName.ContainsKey($unlockThrough)) {
  throw "unlockThrough '$unlockThrough' was not found in data/professions.csv"
}
$unlockThroughNo = $byName[$unlockThrough].no
foreach ($row in $byNo | Where-Object { $_.no -le $unlockThroughNo }) {
  [void]$unlocked.Add($row.profession)
}
foreach ($name in $state.explicitUnlocked) {
  $resolved = Resolve-ConfiguredName ([string]$name) $state.aliases
  if (-not $byName.ContainsKey($resolved)) {
    Write-Warning "explicitUnlocked '$name' was not found and was ignored."
    continue
  }
  [void]$unlocked.Add($resolved)
}

$changed = $true
while ($changed) {
  $changed = $false
  foreach ($name in @($unlocked)) {
    if (-not $byName.ContainsKey($name)) { continue }
    $row = $byName[$name]
    foreach ($dep in @($row.formula1, $row.formula2)) {
      if ((Is-NormalProfession $dep $byName) -and -not $unlocked.Contains($dep)) {
        [void]$unlocked.Add($dep)
        $changed = $true
      }
    }
  }
}

$availableGenes = [System.Collections.Generic.HashSet[string]]::new()
foreach ($name in $unlocked) {
  if (-not $byName.ContainsKey($name)) { continue }
  $row = $byName[$name]
  if (Is-SpecialGene $row.formula1 $row.formula1Category) { [void]$availableGenes.Add($row.formula1) }
  if (Is-SpecialGene $row.formula2 $row.formula2Category) { [void]$availableGenes.Add($row.formula2) }
}
if ($state.PSObject.Properties.Name -contains 'explicitUnlockedGenes') {
  foreach ($gene in $state.explicitUnlockedGenes) {
    if (-not [string]::IsNullOrWhiteSpace([string]$gene)) { [void]$availableGenes.Add([string]$gene) }
  }
}

$baseBuildings = [System.Collections.Generic.HashSet[string]]::new()
foreach ($name in $unlocked) {
  if (-not $byName.ContainsKey($name)) { continue }
  foreach ($building in Split-List $byName[$name].workplaces) { [void]$baseBuildings.Add($building) }
}

$rootTargets = [System.Collections.Generic.HashSet[string]]::new()
foreach ($name in $state.explicitPending) {
  $resolved = Resolve-ConfiguredName ([string]$name) $state.aliases
  if ($byName.ContainsKey($resolved) -and -not $unlocked.Contains($resolved)) { [void]$rootTargets.Add($resolved) }
}
if ($state.targetFrom) {
  $targetFrom = Resolve-ConfiguredName ([string]$state.targetFrom) $state.aliases
  if (-not $byName.ContainsKey($targetFrom)) { throw "targetFrom '$targetFrom' was not found." }
  $targetNo = $byName[$targetFrom].no
  foreach ($row in $byNo | Where-Object { $_.no -ge $targetNo -and -not $unlocked.Contains($_.profession) }) {
    [void]$rootTargets.Add($row.profession)
  }
}

$planTargets = [System.Collections.Generic.HashSet[string]]::new()
foreach ($name in $rootTargets) { [void]$planTargets.Add($name) }
$changed = $true
while ($changed) {
  $changed = $false
  foreach ($name in @($planTargets)) {
    if (-not $byName.ContainsKey($name)) { continue }
    $row = $byName[$name]
    foreach ($dep in @($row.formula1, $row.formula2)) {
      if ((Is-NormalProfession $dep $byName) -and -not $unlocked.Contains($dep) -and -not $planTargets.Contains($dep)) {
        [void]$planTargets.Add($dep)
        $changed = $true
      }
    }
  }
}

$children = @{}
foreach ($name in $planTargets) { $children[$name] = @() }
foreach ($name in $planTargets) {
  $row = $byName[$name]
  foreach ($dep in @($row.formula1, $row.formula2)) {
    if ($planTargets.Contains($dep)) { $children[$dep] += $name }
  }
}

$simUnlocked = [System.Collections.Generic.HashSet[string]]::new()
foreach ($name in $unlocked) { [void]$simUnlocked.Add($name) }
foreach ($gene in $availableGenes) { [void]$simUnlocked.Add($gene) }
$simBuildings = [System.Collections.Generic.HashSet[string]]::new()
foreach ($building in $baseBuildings) { [void]$simBuildings.Add($building) }
$remaining = [System.Collections.Generic.HashSet[string]]::new()
foreach ($name in $planTargets) { [void]$remaining.Add($name) }

$order = @()
$step = 0
while ($remaining.Count -gt 0) {
  $available = @()
  foreach ($name in @($remaining)) {
    $row = $byName[$name]
    if ($simUnlocked.Contains($row.formula1) -and $simUnlocked.Contains($row.formula2)) {
      $newBuildings = @(Split-List $row.workplaces | Where-Object { -not $simBuildings.Contains($_) })
      $immediate = 0
      foreach ($otherName in @($remaining)) {
        if ($otherName -eq $name) { continue }
        $other = $byName[$otherName]
        $before = $simUnlocked.Contains($other.formula1) -and $simUnlocked.Contains($other.formula2)
        $after = ($simUnlocked.Contains($other.formula1) -or $other.formula1 -eq $name) -and ($simUnlocked.Contains($other.formula2) -or $other.formula2 -eq $name)
        if (-not $before -and $after) { $immediate++ }
      }
      $desc = Get-Descendants $name $children
      $remainingDesc = 0
      foreach ($descName in $desc) { if ($remaining.Contains($descName)) { $remainingDesc++ } }
      $available += [pscustomobject]@{
        name = $name
        no = $row.no
        newBuildings = $newBuildings
        newCount = $newBuildings.Count
        immediate = $immediate
        descendants = $remainingDesc
        directWorkplaces = (Split-List $row.workplaces).Count
        root = $rootTargets.Contains($name)
      }
    }
  }
  if ($available.Count -eq 0) { break }
  $choice = $available | Sort-Object `
    @{ Expression = 'newCount'; Descending = $true },
    @{ Expression = 'immediate'; Descending = $true },
    @{ Expression = 'descendants'; Descending = $true },
    @{ Expression = 'directWorkplaces'; Descending = $true },
    @{ Expression = 'root'; Descending = $true },
    @{ Expression = 'no'; Descending = $false } |
    Select-Object -First 1
  $step++
  $order += [pscustomobject]@{
    name = $choice.name
    step = $step
    newBuildings = $choice.newBuildings
    immediate = $choice.immediate
    descendants = $choice.descendants
  }
  [void]$simUnlocked.Add($choice.name)
  foreach ($building in Split-List $byName[$choice.name].workplaces) { [void]$simBuildings.Add($building) }
  [void]$remaining.Remove($choice.name)
}

$orderMap = @{}
foreach ($item in $order) { $orderMap[$item.name] = $item }

$outputRows = @()
foreach ($row in $rows) {
  $depsOk = (($unlocked.Contains($row.formula1) -or $availableGenes.Contains($row.formula1) -or $row.formula1 -eq 'None') -and
    ($unlocked.Contains($row.formula2) -or $availableGenes.Contains($row.formula2) -or $row.formula2 -eq 'None'))
  $currentNew = @(Split-List $row.workplaces | Where-Object { -not $baseBuildings.Contains($_) })
  $missing = @()
  foreach ($dep in @($row.formula1, $row.formula2)) {
    if ($dep -and $dep -ne 'None' -and -not $unlocked.Contains($dep) -and -not $availableGenes.Contains($dep)) { $missing += $dep }
  }

  $status = '暂不可解锁'
  $craftable = '否'
  $recommendedStep = $null
  $stepNew = @()
  $chainUnlock = ''
  if ($unlocked.Contains($row.profession)) {
    $status = '已解锁'
    $craftable = '已解锁'
  } elseif ($orderMap.ContainsKey($row.profession)) {
    $status = '推荐解锁'
    $craftable = if ($depsOk) { '是' } else { '否' }
    $recommendedStep = $orderMap[$row.profession].step
    $stepNew = @($orderMap[$row.profession].newBuildings)
    $chainUnlock = "+$($orderMap[$row.profession].immediate)/$($orderMap[$row.profession].descendants)"
  } elseif ($depsOk) {
    $status = '可解锁-未纳入当前目标'
    $craftable = '是'
  }

  $outputRows += [pscustomobject]@{
    no = $row.no
    profession = $row.profession
    category = $row.category
    formula1 = $row.formula1
    formula1Category = $row.formula1Category
    formula2 = $row.formula2
    formula2Category = $row.formula2Category
    workplaces = $row.workplaces
    status = $status
    currentCraftable = $craftable
    currentNewBuildings = ($currentNew -join ', ')
    recommendedStep = $recommendedStep
    stepNewBuildings = ($stepNew -join ', ')
    chainUnlock = $chainUnlock
    missingPrerequisites = ($missing -join ', ')
  }
}

$animalRows = @()
if (Test-Path -LiteralPath $animalsCsv) {
  foreach ($row in (Import-Csv -LiteralPath $animalsCsv)) {
    $animalRows += [pscustomobject]@{
      no = [int]$row.No
      animal = [string]$row.Animal
      pageUrl = [string]$row.PageUrl
      tier = [int]$row.Tier
      categories = [string]$row.Categories
      season = [string]$row.Season
      formula1 = [string]$row.Formula1
      formula1Categories = [string]$row.Formula1Categories
      formula2 = [string]$row.Formula2
      formula2Categories = [string]$row.Formula2Categories
      recipe = [string]$row.Recipe
      acquisition = [string]$row.Acquisition
      altarRequired = ([string]$row.AltarRequired -eq 'True')
      secret = ([string]$row.Secret -eq 'True')
      mythical = ([string]$row.Mythical -eq 'True')
      sourceTemplate = [string]$row.SourceTemplate
    }
  }
}

$animalByName = @{}
foreach ($row in $animalRows) { $animalByName[$row.animal] = $row }

$usedAsMaterial = @{}
foreach ($row in $animalRows) {
  foreach ($formula in @($row.formula1, $row.formula2)) {
    if ($animalByName.ContainsKey($formula)) {
      if (-not $usedAsMaterial.ContainsKey($formula)) { $usedAsMaterial[$formula] = 0 }
      $usedAsMaterial[$formula]++
    }
  }
}

$secretCandidates = @()
foreach ($row in $animalRows) {
  $baseCost = Get-AnimalBaseCost $row.animal $animalByName @{}
  $usedBy = Get-CountOrZero $usedAsMaterial $row.animal
  $formula1Use = Get-CountOrZero $usedAsMaterial $row.formula1
  $formula2Use = Get-CountOrZero $usedAsMaterial $row.formula2
  $materialUseScore = $formula1Use + $formula2Use
  $formula1Tier = if ($animalByName.ContainsKey($row.formula1)) { [int]$animalByName[$row.formula1].tier } else { 0 }
  $formula2Tier = if ($animalByName.ContainsKey($row.formula2)) { [int]$animalByName[$row.formula2].tier } else { 0 }
  $formulaTierScore = $formula1Tier + $formula2Tier
  $level = ''
  $reason = ''

  if ($row.secret) {
    if ($row.tier -eq 3 -and $baseCost -eq 2 -and $usedBy -eq 0) {
      $level = '推荐消耗'
      $reason = 'Tier 3 Secret；只消耗两个 Tier 1-2 材料；成品不作为后续配方材料。'
      $secretCandidates += $row
    } elseif ($usedBy -gt 0) {
      $level = '建议保留'
      $reason = "后续 $usedBy 个配方会用到该动物。"
    } elseif ($baseCost -gt 2) {
      $level = '成本偏高'
      $reason = "递归基础材料成本为 $baseCost，高于普通 Tier 3 Secret。"
    } else {
      $level = '可用'
      $reason = '可作为 Secret 动物，但不在低成本首选列表。'
    }
  }

  $row | Add-Member -NotePropertyName baseMaterialCost -NotePropertyValue $baseCost -Force
  $row | Add-Member -NotePropertyName usedByCount -NotePropertyValue $usedBy -Force
  $row | Add-Member -NotePropertyName materialUseScore -NotePropertyValue $materialUseScore -Force
  $row | Add-Member -NotePropertyName formulaTierScore -NotePropertyValue $formulaTierScore -Force
  $row | Add-Member -NotePropertyName secretRecommendationRank -NotePropertyValue $null -Force
  $row | Add-Member -NotePropertyName secretRecommendationLevel -NotePropertyValue $level -Force
  $row | Add-Member -NotePropertyName secretRecommendationReason -NotePropertyValue $reason -Force
}

$rank = 0
foreach ($row in ($secretCandidates | Sort-Object `
    @{ Expression = 'baseMaterialCost'; Descending = $false },
    @{ Expression = 'materialUseScore'; Descending = $false },
    @{ Expression = 'formulaTierScore'; Descending = $false },
    @{ Expression = 'animal'; Descending = $false })) {
  $rank++
  $row.secretRecommendationRank = $rank
}

$summary = [pscustomobject]@{
  generatedAt = (Get-Date).ToString('yyyy-MM-dd HH:mm:ss')
  total = $outputRows.Count
  unlocked = ($outputRows | Where-Object { $_.status -eq '已解锁' }).Count
  buildings = $baseBuildings.Count
  planned = ($outputRows | Where-Object { $_.status -eq '推荐解锁' }).Count
  blocked = ($outputRows | Where-Object { $_.status -eq '暂不可解锁' }).Count
  availableGenes = @($availableGenes | Sort-Object)
  source = @{
    professions = 'data/professions.csv'
    state = 'data/state.json'
  }
}

$animalSummary = [pscustomobject]@{
  generatedAt = (Get-Date).ToString('yyyy-MM-dd HH:mm:ss')
  total = $animalRows.Count
  secret = ($animalRows | Where-Object { $_.secret }).Count
  mythical = ($animalRows | Where-Object { $_.mythical }).Count
  altarOnly = ($animalRows | Where-Object { $_.altarRequired }).Count
  tierOneTwo = ($animalRows | Where-Object { $_.tier -le 2 }).Count
  recommendedSecret = ($animalRows | Where-Object { $_.secretRecommendationRank }).Count
  source = @{
    animals = 'data/animals.csv'
    fandom = 'https://pixelpeople.fandom.com/wiki/Animals'
  }
  rules = @(
    'Tier 1-2 animals can be obtained from animal packs, Heart rewards, the Pet Store, Animal Shelter gifts, or crafted at the Altar.',
    'Tier 3 and above animals can only be crafted at the Altar.',
    'Splicing animals consumes both required animals.',
    'Some Cat and Dog formulas use any two animals from that category and may return a random result.'
  )
}

New-Item -ItemType Directory -Force -Path $distDir, $distDataDir | Out-Null
Copy-Item -LiteralPath (Join-Path $srcDir 'index.html') -Destination (Join-Path $distDir 'index.html') -Force
Copy-Item -LiteralPath (Join-Path $srcDir 'styles.css') -Destination (Join-Path $distDir 'styles.css') -Force
Copy-Item -LiteralPath (Join-Path $srcDir 'app.js') -Destination (Join-Path $distDir 'app.js') -Force
Copy-Item -LiteralPath $professionsCsv -Destination (Join-Path $distDataDir 'professions.csv') -Force
if (Test-Path -LiteralPath $animalsCsv) {
  Copy-Item -LiteralPath $animalsCsv -Destination (Join-Path $distDataDir 'animals.csv') -Force
}
Copy-Item -LiteralPath $statePath -Destination (Join-Path $distDataDir 'state.json') -Force

$payload = [pscustomobject]@{
  summary = $summary
  rows = $outputRows
}
Write-Utf8NoBom (Join-Path $distDataDir 'professions.json') (($payload | ConvertTo-Json -Depth 8))
$outputRows | Export-Csv -NoTypeInformation -Encoding UTF8 -Path (Join-Path $distDataDir 'profession_status.csv')

$animalPayload = [pscustomobject]@{
  summary = $animalSummary
  rows = $animalRows
}
Write-Utf8NoBom (Join-Path $distDataDir 'animals.json') (($animalPayload | ConvertTo-Json -Depth 8))
if ($animalRows.Count -gt 0) {
  $animalRows | Export-Csv -NoTypeInformation -Encoding UTF8 -Path (Join-Path $distDataDir 'animal_status.csv')
}
Write-Utf8NoBom (Join-Path $distDir '.nojekyll') ''

Write-Host "Built $distDir"
Write-Host "Rows: $($summary.total); unlocked: $($summary.unlocked); buildings: $($summary.buildings); planned: $($summary.planned); blocked: $($summary.blocked)"
Write-Host "Animals: $($animalSummary.total); secret: $($animalSummary.secret); mythical: $($animalSummary.mythical); altar-only: $($animalSummary.altarOnly)"

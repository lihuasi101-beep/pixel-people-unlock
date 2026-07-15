param(
  [string]$ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
)

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'

function Get-WikiText([string]$Page) {
  $encoded = [uri]::EscapeDataString($Page)
  $url = "https://pixelpeople.fandom.com/api.php?action=parse&page=$encoded&prop=wikitext&format=json"
  $response = Invoke-WebRequest -UseBasicParsing $url -Headers @{ 'User-Agent' = 'PixelPeopleUnlockTracker/1.0' }
  $payload = $response.Content | ConvertFrom-Json
  if (-not $payload.parse.wikitext.'*') {
    throw "No wikitext returned for $Page"
  }
  return [string]$payload.parse.wikitext.'*'
}

function Clean-WikiCell([string]$Value) {
  if ([string]::IsNullOrWhiteSpace($Value)) { return '' }
  $text = $Value.Trim()
  $text = $text -replace '<noinclude>.*$', ''
  $text = $text -replace "'''", ''
  $text = $text -replace '\[\[:?Category:([^|\]]+)\|([^\]]+)\]\]', '$2'
  $text = $text -replace '\[\[([^|\]]+)\|([^\]]+)\]\]', '$2'
  $text = $text -replace '\[\[([^\]]+)\]\]', '$1'
  $text = [System.Net.WebUtility]::HtmlDecode($text)
  return $text.Trim()
}

function Parse-AnimalTemplate([string]$WikiText, [string]$TemplateName) {
  $rows = @()
  $currentName = $null
  $currentValues = @()

  foreach ($rawLine in ($WikiText -split "`r?`n")) {
    $line = $rawLine.Trim()
    if ($line -match '^\|-' -or $line -match '^\|}') {
      if ($currentName) {
        $rows += [pscustomobject]@{
          Name = $currentName
          Values = @($currentValues)
          SourceTemplate = $TemplateName
        }
      }
      $currentName = $null
      $currentValues = @()
      continue
    }

    if ($line -match '^!\s+\[\[') {
      if ($currentName) {
        $rows += [pscustomobject]@{
          Name = $currentName
          Values = @($currentValues)
          SourceTemplate = $TemplateName
        }
      }
      $currentName = Clean-WikiCell ($line -replace '^!\s*', '')
      $currentValues = @()
      continue
    }

    if ($currentName -and $line -match '^\|\s*') {
      $currentValues += Clean-WikiCell ($line -replace '^\|\s*', '')
    }
  }

  return $rows
}

function Get-FormulaCategories([string]$Formula, $ByName) {
  if ([string]::IsNullOrWhiteSpace($Formula)) { return '' }
  if ($Formula -match '^any\s+(.+)$') { return $matches[1] }
  if ($ByName.ContainsKey($Formula)) { return [string]$ByName[$Formula].Categories }
  return ''
}

$dataDir = Join-Path $ProjectRoot 'data'
New-Item -ItemType Directory -Force -Path $dataDir | Out-Null

$templateSpecs = @(
  @{ Page = 'Template:AnimalListTier1-2'; HasSeason = $true },
  @{ Page = 'Template:AnimalListTier3-6'; HasSeason = $false }
)

$rawAnimals = @()
foreach ($spec in $templateSpecs) {
  $text = Get-WikiText $spec.Page
  $rawAnimals += Parse-AnimalTemplate $text $spec.Page
}

$baseRows = @()
$no = 0
foreach ($item in $rawAnimals) {
  $values = @($item.Values)
  if ($values.Count -lt 4) { continue }
  $no++
  if ($item.SourceTemplate -eq 'Template:AnimalListTier1-2') {
    $tier = [int]$values[0]
    $categories = [string]$values[1]
    $season = [string]$values[2]
    $formula1 = [string]$values[3]
    $formula2 = [string]$values[4]
  } else {
    $tier = [int]$values[0]
    $categories = [string]$values[1]
    $season = ''
    $formula1 = [string]$values[2]
    $formula2 = [string]$values[3]
  }

  $baseRows += [pscustomobject]@{
    No = $no
    Animal = [string]$item.Name
    Tier = $tier
    Categories = $categories
    Season = $season
    Formula1 = $formula1
    Formula2 = $formula2
    SourceTemplate = [string]$item.SourceTemplate
  }
}

$byName = @{}
foreach ($row in $baseRows) { $byName[$row.Animal] = $row }

$animals = @()
foreach ($row in $baseRows) {
  $recipe = "$($row.Formula1) + $($row.Formula2)"
  $acquisition = if ($row.Tier -le 2) {
    'Animal Pack / Heart / Pet Store / Animal Shelter / Altar'
  } else {
    'Altar only'
  }
  $animals += [pscustomobject]@{
    No = $row.No
    Animal = $row.Animal
    Tier = $row.Tier
    Categories = $row.Categories
    Season = $row.Season
    Formula1 = $row.Formula1
    Formula1Categories = Get-FormulaCategories $row.Formula1 $byName
    Formula2 = $row.Formula2
    Formula2Categories = Get-FormulaCategories $row.Formula2 $byName
    Recipe = $recipe
    Acquisition = $acquisition
    AltarRequired = ($row.Tier -ge 3)
    Secret = (($row.Categories -split ',\s*') -contains 'Secret')
    Mythical = (($row.Categories -split ',\s*') -contains 'Mythical')
    SourceTemplate = $row.SourceTemplate
  }
}

$outPath = Join-Path $dataDir 'animals.csv'
$animals | Export-Csv -NoTypeInformation -Encoding UTF8 -Path $outPath
Write-Host "Wrote $outPath"
Write-Host "Rows: $($animals.Count); secret: $(($animals | Where-Object { $_.Secret }).Count); mythical: $(($animals | Where-Object { $_.Mythical }).Count); altar-only: $(($animals | Where-Object { $_.AltarRequired }).Count)"

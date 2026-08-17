const palette = [
  ['#e0f2fe', '#075985', '#7dd3fc', '#0284c7'],
  ['#dcfce7', '#14532d', '#86efac', '#16a34a'],
  ['#fef3c7', '#713f12', '#fcd34d', '#d97706'],
  ['#fee2e2', '#7f1d1d', '#fca5a5', '#dc2626'],
  ['#ede9fe', '#4c1d95', '#c4b5fd', '#7c3aed'],
  ['#fce7f3', '#831843', '#f9a8d4', '#db2777'],
  ['#ccfbf1', '#134e4a', '#5eead4', '#0f766e'],
  ['#e2e8f0', '#1e293b', '#cbd5e1', '#475569']
];

const stateClass = {
  '已解锁': 'state-unlocked',
  '推荐解锁': 'state-plan',
  '暂不可解锁': 'state-blocked',
  '可解锁-未纳入当前目标': 'state-other'
};

function toneFor(text) {
  let hash = 0;
  for (let i = 0; i < text.length; i += 1) hash = (hash * 31 + text.charCodeAt(i)) >>> 0;
  return palette[hash % palette.length];
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined && text !== null) node.textContent = text;
  return node;
}

function splitValues(value) {
  return String(value || '').split(',').map(v => v.trim()).filter(Boolean);
}

function normalizeSearchText(value) {
  return String(value || '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[‘’]/g, "'")
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function categoryChip(text) {
  const chip = el('span', 'category-chip', text);
  const tone = text === '特殊基因' ? ['#fff7ed', '#7c2d12', '#fdba74', '#ea580c'] : toneFor(text || 'unknown');
  chip.style.setProperty('--chip-bg', tone[0]);
  chip.style.setProperty('--chip-fg', tone[1]);
  chip.style.setProperty('--chip-line', tone[2]);
  chip.style.setProperty('--chip-dot', tone[3]);
  return chip;
}

function chipList(value, className) {
  const fragment = document.createDocumentFragment();
  splitValues(value).forEach(item => {
    fragment.appendChild(el('span', className, item));
  });
  return fragment;
}

function categoryCell(categories) {
  const td = el('td');
  splitValues(categories).forEach(category => td.appendChild(categoryChip(category)));
  return td;
}

function professionSearchButton(name, className) {
  const button = el('button', className, name);
  button.type = 'button';
  button.dataset.professionSearch = name;
  button.title = `搜索职业：${name}`;
  button.setAttribute('aria-label', `按 ${name} 搜索职业`);
  return button;
}

function professionNameCell(name) {
  const td = el('td', 'profession-name-cell');
  if (name && name !== 'None') td.appendChild(professionSearchButton(name, 'profession-name-link'));
  return td;
}

function formulaCell(name) {
  const td = el('td');
  if (name && name !== 'None') {
    td.appendChild(professionSearchButton(name, 'formula-chip profession-search-chip'));
  }
  return td;
}

function animalIdentityCell(row) {
  const td = el('td', 'animal-identity-cell');
  const wrapper = el(row.pageUrl ? 'a' : 'span', 'animal-link');
  if (row.pageUrl) {
    wrapper.href = row.pageUrl;
    wrapper.target = '_blank';
    wrapper.rel = 'noreferrer';
  }
  wrapper.textContent = row.animal;
  td.appendChild(wrapper);
  return td;
}

function secretAdviceCell(row) {
  const td = el('td', 'secret-advice-cell');
  if (!row.secretRecommendationLevel) return td;
  const className = row.secretRecommendationRank ? 'secret-consume' : row.secretRecommendationLevel === '建议保留' ? 'secret-hold' : 'secret-caution';
  const label = row.secretRecommendationRank ? `推荐 #${row.secretRecommendationRank}` : row.secretRecommendationLevel;
  td.appendChild(el('span', `badge ${className}`, label));
  if (row.secretRecommendationReason) td.appendChild(el('div', 'cell-note', row.secretRecommendationReason));
  return td;
}

function animalFormulaChip(name, animalByName) {
  const row = animalByName.get(name);
  const wrapper = el(row?.pageUrl ? 'a' : 'span', 'animal-formula-chip');
  if (row?.pageUrl) {
    wrapper.href = row.pageUrl;
    wrapper.target = '_blank';
    wrapper.rel = 'noreferrer';
  }
  wrapper.appendChild(el('span', null, name));
  return wrapper;
}

function animalFormulaCell(name, animalByName) {
  const td = el('td');
  if (name && name !== 'None') td.appendChild(animalFormulaChip(name, animalByName));
  return td;
}

function materialDetail(name, categories, animalByName) {
  const detail = el('div', 'material-detail');
  const nameWrap = el('div', 'material-name-wrap');
  nameWrap.appendChild(name ? animalFormulaChip(name, animalByName) : el('span', 'material-name', '未知材料'));
  detail.appendChild(nameWrap);
  const chips = el('div', 'material-categories');
  splitValues(categories || '未知').forEach(category => chips.appendChild(categoryChip(category)));
  detail.appendChild(chips);
  return detail;
}

function fillSelect(id, values, labelFor = value => value) {
  const select = document.getElementById(id);
  const placeholder = select.options[0]?.textContent || '全部';
  select.textContent = '';
  const first = el('option', null, placeholder);
  first.value = '';
  select.appendChild(first);
  values.forEach(value => {
    const option = el('option', null, labelFor(value));
    option.value = value;
    select.appendChild(option);
  });
}

function setupTabs(onTabChange) {
  document.querySelectorAll('.tab-button').forEach(button => {
    button.addEventListener('click', () => {
      document.querySelectorAll('.tab-button').forEach(item => item.classList.toggle('active', item === button));
      document.querySelectorAll('.tab-view').forEach(view => view.classList.toggle('active', view.id === `${button.dataset.tab}View`));
      if (onTabChange) onTabChange(button.dataset.tab);
    });
  });
}

function buildingSearchRank(entry, query) {
  const normalized = normalizeSearchText(query);
  if (!normalized) return Number.POSITIVE_INFINITY;
  const compact = normalized.replace(/\s+/g, '');
  if (entry.normalized === normalized || entry.compact === compact) return 0;
  if (entry.normalized.startsWith(normalized)) return 1;
  if (entry.normalized.split(' ').some(part => part.startsWith(normalized))) return 2;
  if (entry.normalized.includes(normalized)) return 3;
  if (compact && entry.compact.includes(compact)) return 4;
  return Number.POSITIVE_INFINITY;
}

function createBuildingIndex(rows) {
  const workersByBuilding = new Map();
  rows.forEach(row => {
    splitValues(row.workplaces).forEach(building => {
      if (!workersByBuilding.has(building)) workersByBuilding.set(building, []);
      workersByBuilding.get(building).push(row);
    });
  });

  return [...workersByBuilding.entries()]
    .map(([name, workers]) => {
      const normalized = normalizeSearchText(name);
      return {
        name,
        normalized,
        compact: normalized.replace(/\s+/g, ''),
        workers: workers.sort((a, b) => Number(a.no) - Number(b.no))
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name, 'en'));
}

function findBuildings(entries, query) {
  return entries
    .map(entry => ({ entry, rank: buildingSearchRank(entry, query) }))
    .filter(match => Number.isFinite(match.rank))
    .sort((a, b) => a.rank - b.rank || a.entry.name.localeCompare(b.entry.name, 'en'));
}

function renderBuildingResult(entry) {
  const result = document.getElementById('buildingResult');
  const suggestions = document.getElementById('buildingSuggestions');
  const feedback = document.getElementById('buildingLookupFeedback');
  const tbody = document.getElementById('buildingWorkerRows');
  const statusOrder = { '已解锁': 0, '推荐解锁': 1, '可解锁-未纳入当前目标': 2, '暂不可解锁': 3 };
  const workers = [...entry.workers].sort((a, b) =>
    (statusOrder[a.status] ?? 9) - (statusOrder[b.status] ?? 9) || Number(a.no) - Number(b.no)
  );
  const unlocked = workers.filter(worker => worker.status === '已解锁').length;

  document.getElementById('buildingResultName').textContent = entry.name;
  document.getElementById('buildingResultSummary').textContent =
    `${workers.length} 种工人 · 已解锁 ${unlocked} · 未解锁 ${workers.length - unlocked}`;
  tbody.textContent = '';
  workers.forEach(worker => {
    const tr = el('tr');
    const status = el('td', 'status-cell');
    status.appendChild(el('span', `badge ${stateClass[worker.status] || 'state-other'}`, worker.status));
    tr.append(el('td', null, worker.no), el('td', 'building-worker-name', worker.profession));
    tr.append(categoryCell(worker.category), status);
    tbody.appendChild(tr);
  });

  feedback.textContent = '';
  suggestions.textContent = '';
  suggestions.hidden = true;
  result.hidden = false;
}

function renderBuildingSuggestions(matches, query) {
  const result = document.getElementById('buildingResult');
  const suggestions = document.getElementById('buildingSuggestions');
  const feedback = document.getElementById('buildingLookupFeedback');
  result.hidden = true;
  suggestions.textContent = '';

  if (!matches.length) {
    suggestions.hidden = true;
    feedback.textContent = `未找到“${query.trim()}”对应的建筑`;
    return;
  }

  const visibleMatches = matches.slice(0, 16);
  feedback.textContent = matches.length > visibleMatches.length
    ? `找到 ${matches.length} 个匹配建筑，显示前 ${visibleMatches.length} 个`
    : `找到 ${matches.length} 个匹配建筑，请选择一个`;
  visibleMatches.forEach(({ entry }) => {
    const button = el('button', 'building-suggestion');
    button.type = 'button';
    button.dataset.building = entry.name;
    button.append(el('span', 'building-suggestion-name', entry.name));
    button.append(el('span', 'building-suggestion-count', `${entry.workers.length} 种工人`));
    suggestions.appendChild(button);
  });
  suggestions.hidden = false;
}

function setupBuildingLookup(rows) {
  const entries = createBuildingIndex(rows);
  const byName = new Map(entries.map(entry => [entry.name, entry]));
  const input = document.getElementById('buildingQuery');
  const datalist = document.getElementById('buildingOptions');
  const suggestions = document.getElementById('buildingSuggestions');
  const result = document.getElementById('buildingResult');
  const feedback = document.getElementById('buildingLookupFeedback');

  document.getElementById('buildingCount').textContent = `${entries.length} 个建筑`;
  entries.forEach(entry => {
    const option = el('option');
    option.value = entry.name;
    datalist.appendChild(option);
  });

  const update = () => {
    const query = input.value.trim();
    if (!query) {
      feedback.textContent = '';
      suggestions.textContent = '';
      suggestions.hidden = true;
      result.hidden = true;
      return;
    }

    const matches = findBuildings(entries, query);
    const exact = matches.find(match => match.rank === 0);
    if (exact) {
      renderBuildingResult(exact.entry);
    } else if (matches.length === 1) {
      renderBuildingResult(matches[0].entry);
    } else {
      renderBuildingSuggestions(matches, query);
    }
  };

  input.addEventListener('input', update);
  input.addEventListener('change', update);
  input.addEventListener('keydown', event => {
    if (event.key === 'Enter') {
      event.preventDefault();
      update();
    }
  });
  suggestions.addEventListener('click', event => {
    const button = event.target.closest('button[data-building]');
    if (!button) return;
    const entry = byName.get(button.dataset.building);
    if (!entry) return;
    input.value = entry.name;
    renderBuildingResult(entry);
    input.focus();
  });
}

function renderTopNew(rows, priorityTargets = []) {
  const tbody = document.getElementById('topNewRows');
  tbody.textContent = '';
  const manualTargets = priorityTargets.length > 0;
  const displayRows = manualTargets
    ? [...priorityTargets].sort((a, b) => Number(a.priorityOrder) - Number(b.priorityOrder))
    : rows.filter(r => r.status === '推荐解锁' && r.stepNewBuildings)
      .sort((a, b) => Number(a.recommendedStep) - Number(b.recommendedStep))
      .slice(0, 30);

  displayRows
    .forEach(row => {
      const tr = el('tr');
      tr.append(
        el('td', null, manualTargets ? row.priorityOrder : row.recommendedStep),
        el('td', null, row.profession),
        categoryCell(row.category)
      );
      const formula = el('td', 'formula-summary');
      [
        `${row.formula1}${row.formula1Category ? `（${row.formula1Category}）` : ''}`,
        `${row.formula2}${row.formula2Category ? `（${row.formula2Category}）` : ''}`
      ].forEach((part, index) => {
        formula.appendChild(el('span', 'formula-part', part));
        if (index === 0) formula.appendChild(document.createTextNode(' + '));
      });
      const status = el('td', 'status-cell');
      status.appendChild(el('span', `badge ${stateClass[row.status] || 'state-other'}`, row.status));
      const newTd = el('td');
      newTd.appendChild(chipList(manualTargets ? row.currentNewBuildings : row.stepNewBuildings, 'building-chip'));
      const missing = el('td');
      missing.appendChild(chipList(row.missingPrerequisites, 'missing-chip'));
      tr.append(
        formula,
        status,
        el('td', null, row.currentCraftable),
        newTd,
        missing,
        el('td', null, row.workplaces)
      );
      tbody.appendChild(tr);
    });
}

function renderFutureBuildingPlans(plans) {
  const tbody = document.getElementById('futureBuildingRows');
  const count = document.getElementById('futureBuildingCount');
  const sortedPlans = [...plans].sort((a, b) => Number(a.no) - Number(b.no) || a.building.localeCompare(b.building, 'en'));
  count.textContent = `${sortedPlans.length} 个未覆盖建筑`;
  tbody.textContent = '';
  sortedPlans.forEach(plan => {
    const tr = el('tr');
    const building = el('td');
    building.appendChild(el('span', 'building-chip', plan.building));
    const status = el('td', 'status-cell');
    status.appendChild(el('span', `badge ${stateClass[plan.status] || 'state-other'}`, plan.status));
    const missing = el('td');
    missing.appendChild(chipList(plan.missingPrerequisites, 'missing-chip'));
    tr.append(
      building,
      el('td', 'building-worker-name', plan.profession),
      categoryCell(plan.category),
      status,
      el('td', null, plan.currentCraftable),
      missing,
      el('td', null, plan.workplaces)
    );
    tbody.appendChild(tr);
  });
}

function renderProfessionRows(rows) {
  const tbody = document.getElementById('professionRows');
  tbody.textContent = '';
  rows.forEach(row => {
    const tr = el('tr');
    tr.dataset.no = String(row.no);
    tr.dataset.profession = row.profession;
    tr.dataset.status = row.status;
    tr.dataset.category = row.category;
    tr.append(el('td', null, row.no), professionNameCell(row.profession), categoryCell(row.category));
    tr.append(formulaCell(row.formula1), categoryCell(row.formula1Category));
    tr.append(formulaCell(row.formula2), categoryCell(row.formula2Category));
    tr.append(el('td', null, row.workplaces));
    const status = el('td', 'status-cell');
    status.appendChild(el('span', `badge ${stateClass[row.status] || 'state-other'}`, row.status));
    const currentNew = el('td', 'signal-cell');
    currentNew.appendChild(chipList(row.currentNewBuildings, 'building-chip'));
    const stepNew = el('td', 'signal-cell');
    stepNew.appendChild(chipList(row.stepNewBuildings, 'building-chip'));
    const missing = el('td');
    missing.appendChild(chipList(row.missingPrerequisites, 'missing-chip'));
    tr.append(status, el('td', null, row.currentCraftable), currentNew, el('td', null, row.recommendedStep || ''), stepNew, missing);
    tbody.appendChild(tr);
  });
}

function applyProfessionSearch(value) {
  const input = document.getElementById('q');
  input.value = value;
  applyProfessionFilters();
  input.focus();
  input.select();
}

function setupProfessionSearchLinks() {
  const tbody = document.getElementById('professionRows');
  tbody.addEventListener('click', event => {
    const trigger = event.target.closest('[data-profession-search]');
    if (!trigger || !tbody.contains(trigger)) return;
    applyProfessionSearch(trigger.dataset.professionSearch);
  });
}

function professionSearchRank(row, text) {
  if (!text) return Number(row.dataset.no);
  const profession = (row.dataset.profession || '').toLowerCase();
  if (profession === text) return 0;
  if (profession.startsWith(text)) return 1;
  if (profession.split(/\s+/).some(part => part.startsWith(text))) return 2;
  if (profession.includes(text)) return 3;
  return 20;
}

function applyProfessionFilters() {
  const text = document.getElementById('q').value.trim().toLowerCase();
  const status = document.getElementById('status').value;
  const category = document.getElementById('category').value;
  const tbody = document.getElementById('professionRows');
  const rows = Array.from(tbody.querySelectorAll('tr'));
  rows.forEach(row => {
    const okText = !text || row.textContent.toLowerCase().includes(text);
    const okStatus = !status || row.dataset.status === status;
    const okCategory = !category || row.dataset.category === category;
    row.classList.toggle('hidden', !(okText && okStatus && okCategory));
  });
  rows.sort((a, b) => {
    const aHidden = a.classList.contains('hidden') ? 1 : 0;
    const bHidden = b.classList.contains('hidden') ? 1 : 0;
    return aHidden - bHidden ||
      professionSearchRank(a, text) - professionSearchRank(b, text) ||
      Number(a.dataset.no) - Number(b.dataset.no);
  }).forEach(row => tbody.appendChild(row));
}

function renderAnimals(summary, rows) {
  document.getElementById('animal-total').textContent = summary.total;
  document.getElementById('animal-secret').textContent = summary.secret;
  document.getElementById('animal-mythical').textContent = summary.mythical;
  document.getElementById('animal-altar').textContent = summary.altarOnly;
  document.getElementById('animal-recommended-secret').textContent = summary.recommendedSecret;

  fillSelect('animalTier', [...new Set(rows.map(row => String(row.tier)))].sort((a, b) => Number(a) - Number(b)), value => `Tier ${value}`);
  fillSelect('animalCategory', [...new Set(rows.flatMap(row => splitValues(row.categories)))].sort());
  fillSelect('animalAcquisition', [...new Set(rows.map(row => row.acquisition))].sort());
  const animalByName = new Map(rows.map(row => [row.animal, row]));
  renderSecretRecommendations(rows, animalByName);

  const tbody = document.getElementById('animalRows');
  tbody.textContent = '';
  rows.forEach(row => {
    const tr = el('tr');
    tr.dataset.no = String(row.no);
    tr.dataset.animal = row.animal;
    tr.dataset.tier = String(row.tier);
    tr.dataset.categories = row.categories;
    tr.dataset.acquisition = row.acquisition;
    if (row.secretRecommendationRank) tr.classList.add('secret-recommended-row');
    tr.append(el('td', null, row.no), animalIdentityCell(row), el('td', null, `Tier ${row.tier}`));
    tr.append(categoryCell(row.categories), el('td', null, row.season || row.acquisition));
    tr.append(animalFormulaCell(row.formula1, animalByName), categoryCell(row.formula1Categories));
    tr.append(animalFormulaCell(row.formula2, animalByName), categoryCell(row.formula2Categories));
    tr.append(secretAdviceCell(row), el('td', null, row.acquisition));
    tbody.appendChild(tr);
  });
}

function renderSecretRecommendations(rows, animalByName) {
  const tbody = document.getElementById('secretRecommendationRows');
  tbody.textContent = '';
  rows.filter(row => row.secretRecommendationRank)
    .sort((a, b) => Number(a.secretRecommendationRank) - Number(b.secretRecommendationRank))
    .forEach(row => {
      const tr = el('tr');
      tr.append(el('td', null, row.secretRecommendationRank), animalIdentityCell(row), el('td', null, `Tier ${row.tier}`));
      tr.append(categoryCell(row.categories));

      const formula = el('td', 'formula-summary');
      formula.appendChild(animalFormulaChip(row.formula1, animalByName));
      formula.appendChild(document.createTextNode(' + '));
      formula.appendChild(animalFormulaChip(row.formula2, animalByName));
      tr.appendChild(formula);

      const materialCell = el('td', 'material-detail-cell');
      materialCell.appendChild(materialDetail(row.formula1, row.formula1Categories, animalByName));
      materialCell.appendChild(materialDetail(row.formula2, row.formula2Categories, animalByName));
      tr.appendChild(materialCell);

      tr.append(el('td', null, `基础材料 ${row.baseMaterialCost} · 材料复用 ${row.materialUseScore}`));
      const reason = el('td');
      reason.appendChild(el('span', 'badge secret-consume', '推荐消耗'));
      reason.appendChild(el('div', 'cell-note', row.secretRecommendationReason));
      tr.appendChild(reason);
      tbody.appendChild(tr);
    });
}

function animalSearchRank(row, text) {
  if (!text) return Number(row.dataset.no);
  const animal = (row.dataset.animal || '').toLowerCase();
  if (animal === text) return 0;
  if (animal.startsWith(text)) return 1;
  if (animal.split(/\s+/).some(part => part.startsWith(text))) return 2;
  if (animal.includes(text)) return 3;
  return 20;
}

function applyAnimalFilters() {
  const text = document.getElementById('animalQ').value.trim().toLowerCase();
  const tier = document.getElementById('animalTier').value;
  const category = document.getElementById('animalCategory').value;
  const acquisition = document.getElementById('animalAcquisition').value;
  const tbody = document.getElementById('animalRows');
  const rows = Array.from(tbody.querySelectorAll('tr'));
  rows.forEach(row => {
    const categories = splitValues(row.dataset.categories);
    const okText = !text || row.textContent.toLowerCase().includes(text);
    const okTier = !tier || row.dataset.tier === tier;
    const okCategory = !category || categories.includes(category);
    const okAcquisition = !acquisition || row.dataset.acquisition === acquisition;
    row.classList.toggle('hidden', !(okText && okTier && okCategory && okAcquisition));
  });
  rows.sort((a, b) => {
    const aHidden = a.classList.contains('hidden') ? 1 : 0;
    const bHidden = b.classList.contains('hidden') ? 1 : 0;
    return aHidden - bHidden ||
      animalSearchRank(a, text) - animalSearchRank(b, text) ||
      Number(a.dataset.no) - Number(b.dataset.no);
  }).forEach(row => tbody.appendChild(row));
}

async function getJson(path) {
  const response = await fetch(path);
  if (!response.ok) throw new Error(`${path} ${response.status}`);
  return response.json();
}

let animalLoadPromise = null;

function loadAnimals() {
  if (!animalLoadPromise) {
    document.getElementById('animal-total').textContent = '...';
    animalLoadPromise = getJson('./data/animals.json')
      .then(animalPayload => {
        renderAnimals(animalPayload.summary, animalPayload.rows);
        applyAnimalFilters();
        return animalPayload;
      })
      .catch(error => {
        document.getElementById('animal-total').textContent = '!';
        document.getElementById('animalRows').textContent = '';
        const tr = el('tr');
        const td = el('td', null, `加载失败：${error.message}`);
        td.colSpan = 11;
        tr.appendChild(td);
        document.getElementById('animalRows').appendChild(tr);
        animalLoadPromise = null;
        return null;
      });
  }
  return animalLoadPromise;
}

async function main() {
  setupTabs(tab => {
    if (tab === 'animals') loadAnimals();
  });
  const professionPayload = await getJson('./data/professions.json');
  const { summary, rows } = professionPayload;

  document.getElementById('meta').textContent = `生成时间：${summary.generatedAt} · 数据源：data/professions.csv + data/state.json + data/animals.csv`;
  document.getElementById('genes').textContent = `当前可用特殊基因：${summary.availableGenes.join(', ') || '无'}`;
  document.getElementById('stat-total').textContent = summary.total;
  document.getElementById('stat-unlocked').textContent = summary.unlocked;
  document.getElementById('stat-buildings').textContent = summary.buildings;
  document.getElementById('stat-planned').textContent = summary.planned;
  document.getElementById('stat-blocked').textContent = summary.blocked;

  fillSelect('status', [...new Set(rows.map(row => row.status))].sort());
  fillSelect('category', [...new Set(rows.map(row => row.category))].sort());
  setupBuildingLookup(rows);
  renderTopNew(rows, professionPayload.priorityTargets || []);
  renderFutureBuildingPlans(professionPayload.futureBuildingPlans || []);
  renderProfessionRows(rows);
  setupProfessionSearchLinks();

  document.getElementById('q').addEventListener('input', applyProfessionFilters);
  document.getElementById('status').addEventListener('change', applyProfessionFilters);
  document.getElementById('category').addEventListener('change', applyProfessionFilters);
  document.getElementById('animalQ').addEventListener('input', applyAnimalFilters);
  document.getElementById('animalTier').addEventListener('change', applyAnimalFilters);
  document.getElementById('animalCategory').addEventListener('change', applyAnimalFilters);
  document.getElementById('animalAcquisition').addEventListener('change', applyAnimalFilters);
}

main().catch(error => {
  document.getElementById('meta').textContent = `加载失败：${error.message}`;
});

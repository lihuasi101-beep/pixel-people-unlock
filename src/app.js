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

function formulaCell(name) {
  const td = el('td');
  if (name && name !== 'None') td.appendChild(el('span', 'formula-chip', name));
  return td;
}

function animalIdentityCell(row) {
  const td = el('td', 'animal-identity-cell');
  const wrapper = el(row.pageUrl ? 'a' : 'span', 'animal-identity');
  if (row.pageUrl) {
    wrapper.href = row.pageUrl;
    wrapper.target = '_blank';
    wrapper.rel = 'noreferrer';
  }
  if (row.imageUrl) {
    const image = el('img', 'animal-thumb');
    image.src = row.imageUrl;
    image.alt = row.animal;
    image.loading = 'lazy';
    image.decoding = 'async';
    wrapper.appendChild(image);
  } else {
    wrapper.appendChild(el('span', 'animal-thumb animal-thumb-placeholder', row.animal ? row.animal.slice(0, 1) : '?'));
  }
  wrapper.appendChild(el('span', 'animal-name', row.animal));
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
  if (row?.imageUrl) {
    const image = el('img', 'animal-mini-thumb');
    image.src = row.imageUrl;
    image.alt = name;
    image.loading = 'lazy';
    image.decoding = 'async';
    wrapper.appendChild(image);
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

function setupTabs() {
  document.querySelectorAll('.tab-button').forEach(button => {
    button.addEventListener('click', () => {
      document.querySelectorAll('.tab-button').forEach(item => item.classList.toggle('active', item === button));
      document.querySelectorAll('.tab-view').forEach(view => view.classList.toggle('active', view.id === `${button.dataset.tab}View`));
    });
  });
}

function renderTopNew(rows) {
  const tbody = document.getElementById('topNewRows');
  tbody.textContent = '';
  rows.filter(r => r.status === '推荐解锁' && r.stepNewBuildings)
    .sort((a, b) => Number(a.recommendedStep) - Number(b.recommendedStep))
    .slice(0, 30)
    .forEach(row => {
      const tr = el('tr');
      tr.append(el('td', null, row.recommendedStep), el('td', null, row.profession), categoryCell(row.category));
      const formula = el('td', 'formula-summary');
      [
        `${row.formula1}${row.formula1Category ? `（${row.formula1Category}）` : ''}`,
        `${row.formula2}${row.formula2Category ? `（${row.formula2Category}）` : ''}`
      ].forEach((part, index) => {
        formula.appendChild(el('span', 'formula-part', part));
        if (index === 0) formula.appendChild(document.createTextNode(' + '));
      });
      const newTd = el('td');
      newTd.appendChild(chipList(row.stepNewBuildings, 'building-chip'));
      tr.append(formula, newTd, el('td', null, row.workplaces));
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
    tr.append(el('td', null, row.no), el('td', null, row.profession), categoryCell(row.category));
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

function applyAnimalFilters() {
  const text = document.getElementById('animalQ').value.trim().toLowerCase();
  const tier = document.getElementById('animalTier').value;
  const category = document.getElementById('animalCategory').value;
  const acquisition = document.getElementById('animalAcquisition').value;
  document.querySelectorAll('#animalRows tr').forEach(row => {
    const categories = splitValues(row.dataset.categories);
    const okText = !text || row.innerText.toLowerCase().includes(text);
    const okTier = !tier || row.dataset.tier === tier;
    const okCategory = !category || categories.includes(category);
    const okAcquisition = !acquisition || row.dataset.acquisition === acquisition;
    row.classList.toggle('hidden', !(okText && okTier && okCategory && okAcquisition));
  });
}

async function getJson(path) {
  const response = await fetch(path, { cache: 'no-store' });
  if (!response.ok) throw new Error(`${path} ${response.status}`);
  return response.json();
}

async function main() {
  setupTabs();
  const [professionPayload, animalPayload] = await Promise.all([
    getJson('./data/professions.json'),
    getJson('./data/animals.json')
  ]);
  const { summary, rows } = professionPayload;
  const animalSummary = animalPayload.summary;
  const animalRows = animalPayload.rows;

  document.getElementById('meta').textContent = `生成时间：${summary.generatedAt} · 数据源：data/professions.csv + data/state.json + data/animals.csv`;
  document.getElementById('genes').textContent = `当前可用特殊基因：${summary.availableGenes.join(', ') || '无'}`;
  document.getElementById('stat-total').textContent = summary.total;
  document.getElementById('stat-unlocked').textContent = summary.unlocked;
  document.getElementById('stat-buildings').textContent = summary.buildings;
  document.getElementById('stat-planned').textContent = summary.planned;
  document.getElementById('stat-blocked').textContent = summary.blocked;

  fillSelect('status', [...new Set(rows.map(row => row.status))].sort());
  fillSelect('category', [...new Set(rows.map(row => row.category))].sort());
  renderTopNew(rows);
  renderProfessionRows(rows);
  renderAnimals(animalSummary, animalRows);

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

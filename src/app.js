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
  String(value || '').split(',').map(v => v.trim()).filter(Boolean).forEach(item => {
    fragment.appendChild(el('span', className, item));
  });
  return fragment;
}

function formulaCell(name, category) {
  const td = el('td');
  if (name && name !== 'None') td.appendChild(el('span', 'formula-chip', name));
  return td;
}

function categoryCell(category) {
  const td = el('td');
  if (category) td.appendChild(categoryChip(category));
  return td;
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

function renderRows(rows) {
  const tbody = document.getElementById('professionRows');
  tbody.textContent = '';
  rows.forEach(row => {
    const tr = el('tr');
    tr.dataset.status = row.status;
    tr.dataset.category = row.category;
    tr.append(el('td', null, row.no), el('td', null, row.profession), categoryCell(row.category));
    tr.append(formulaCell(row.formula1, row.formula1Category), categoryCell(row.formula1Category));
    tr.append(formulaCell(row.formula2, row.formula2Category), categoryCell(row.formula2Category));
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

function fillSelect(id, values) {
  const select = document.getElementById(id);
  values.forEach(value => select.appendChild(el('option', null, value)));
}

function applyFilters() {
  const text = document.getElementById('q').value.trim().toLowerCase();
  const status = document.getElementById('status').value;
  const category = document.getElementById('category').value;
  document.querySelectorAll('#professionRows tr').forEach(row => {
    const okText = !text || row.innerText.toLowerCase().includes(text);
    const okStatus = !status || row.dataset.status === status;
    const okCategory = !category || row.dataset.category === category;
    row.classList.toggle('hidden', !(okText && okStatus && okCategory));
  });
}

async function main() {
  const response = await fetch('./data/professions.json', { cache: 'no-store' });
  const payload = await response.json();
  const { summary, rows } = payload;
  document.getElementById('meta').textContent = `生成时间：${summary.generatedAt} · 数据源：data/professions.csv + data/state.json`;
  document.getElementById('genes').textContent = `当前可用特殊基因：${summary.availableGenes.join(', ') || '无'}`;
  document.getElementById('stat-total').textContent = summary.total;
  document.getElementById('stat-unlocked').textContent = summary.unlocked;
  document.getElementById('stat-buildings').textContent = summary.buildings;
  document.getElementById('stat-planned').textContent = summary.planned;
  document.getElementById('stat-blocked').textContent = summary.blocked;
  fillSelect('status', [...new Set(rows.map(row => row.status))].sort());
  fillSelect('category', [...new Set(rows.map(row => row.category))].sort());
  renderTopNew(rows);
  renderRows(rows);
  document.getElementById('q').addEventListener('input', applyFilters);
  document.getElementById('status').addEventListener('change', applyFilters);
  document.getElementById('category').addEventListener('change', applyFilters);
}

main().catch(error => {
  document.getElementById('meta').textContent = `加载失败：${error.message}`;
});

import { calculatePoolProfile, calculateRarityStack, formatPoolLabel } from '../data.js';
import { getGlobalCharPoolOrder, getGlobalWeaponPoolOrder, getLastDataType, getGlobalPoolConfig } from '../state.js';
import { t } from '../i18n.js';
import { PITY_BOOST_START } from '../constants.js';

// 池子剖面图渲染，单池统计用，currentPool 为当前选中池，仅渲染该池
export function renderPoolProfile(dataMap, currentPool = null) {
  const body = document.getElementById('poolProfileBody');
  if (!body) return;

  if (!currentPool || !dataMap || !dataMap[currentPool]) {
    body.innerHTML = `<div class="stats-chart-empty">${t('stats.noData')}</div>`;
    return;
  }

  // 收窄到当前选中池
  const profiles = calculatePoolProfile(
    { [currentPool]: dataMap[currentPool] },
    [currentPool],
    getGlobalPoolConfig() || {}
  );
  if (!profiles || profiles.length === 0) {
    body.innerHTML = `<div class="stats-chart-empty">${t('stats.noData')}</div>`;
    return;
  }

  const html = profiles.map(p => {
    // 归一参照取本池全部水位含进行中的最大值
    const pityVals = p.cycles.map(c => c.pity);
    if (p.tail > 0) pityVals.push(p.tail);
    const maxPity = Math.max(1, ...pityVals);

    const rowsHtml = p.cycles.map((c, i) => {
      const width = (c.pity / maxPity * 100).toFixed(1);
      const upCls = c.isUp ? ' up' : '';
      // 达软保底阈值时数字标橙
      const pityCls = c.pity >= PITY_BOOST_START ? 'ps-count hi' : 'ps-count';
      const badges =
        (c.isUp ? `<span class="ps-badge ps-badge--up">${t('stats.profileUp')}</span>` : '') +
        (c.isNew ? `<span class="ps-badge ps-badge--new">${t('stats.profileNew')}</span>` : '');
      return `<div class="ps-row">
        <span class="ps-idx">#${i + 1}</span>
        <span class="ps-track">
          <span class="ps-fill-bar${upCls}" style="width:${width}%"></span>
        </span>
        <span class="ps-item${upCls}">${c.name}${badges}</span>
        <span class="${pityCls}">${c.pity}</span>
      </div>`;
    }).join("");

    const tailRow = p.tail > 0
      ? `<div class="ps-row">
          <span class="ps-idx">—</span>
          <span class="ps-track">
            <span class="ps-fill-bar current" style="width:${(p.tail / maxPity * 100).toFixed(1)}%"></span>
          </span>
          <span class="ps-item current">${t('stats.profileOngoing')}</span>
          <span class="ps-count dim">${p.tail}</span>
        </div>`
      : "";

    const upCount = p.cycles.filter(c => c.isUp).length;

    return `<div class="pool-slice">
      <div class="ps-head">
        <span class="ps-name">${formatPoolLabel(p.poolName)}</span>
        <span class="ps-meta">${t('stats.profileMeta', { total: p.total, deepest: p.deepest })}</span>
      </div>
      <div class="ps-stack">${rowsHtml}${tailRow}</div>
      <div class="ps-sum">
        <span>${t('stats.profileTotal')} <b>${p.total}</b></span>
        <span>${t('stats.profileDrops')} <b>${p.cycles.length}</b></span>
        <span>${t('stats.profileUpCount')} <b>${upCount}</b></span>
        <span>${t('stats.profileDeepest')} <b>${p.deepest}</b></span>
      </div>
    </div>`;
  }).join("");

  body.innerHTML = html;
}

// 稀有度成分堆叠条渲染，单池统计用，仅渲染当前选中池
export function renderRarityStack(dataMap, currentPool = null) {
  const body = document.getElementById('rarityStackBody');
  if (!body) return;

  if (!currentPool || !dataMap || !dataMap[currentPool]) {
    body.innerHTML = `<div class="stats-chart-empty">${t('stats.noData')}</div>`;
    return;
  }

  // 收窄到当前选中池
  const poolOrder = (getLastDataType() === 'weapon')
    ? getGlobalWeaponPoolOrder()
    : getGlobalCharPoolOrder();
  const stacks = calculateRarityStack({ [currentPool]: dataMap[currentPool] }, [currentPool]);

  if (!stacks || stacks.length === 0) {
    body.innerHTML = `<div class="stats-chart-empty">${t('stats.noData')}</div>`;
    return;
  }

  const html = stacks.map(s => {
    if (s.total === 0) return '';
    const p6 = +(s.six / s.total * 100).toFixed(1);
    const p5 = +(s.five / s.total * 100).toFixed(1);
    const p4 = +(s.four / s.total * 100).toFixed(1);
    const seg = (cls, pct, label) =>
      `<div class="spp-seg ${cls}" style="width:${pct}%">${pct >= 8 ? label : ''}</div>`;
    return `<div class="spp-row">
      <span class="spp-name">${formatPoolLabel(s.poolName)}</span>
      <div class="spp-bar">
        ${seg('spp-6', p6, `6★ ${p6}%`)}
        ${seg('spp-5', p5, `5★ ${p5}%`)}
        ${seg('spp-4', p4, `4★ ${p4}%`)}
      </div>
      <span class="spp-total">${s.total}</span>
    </div>`;
  }).join("");

  body.innerHTML = html;
}
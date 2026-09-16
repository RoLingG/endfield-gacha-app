import {
  getCurrentType, setCurrentType,
  getLastDataType, setLastDataType,
  getGlobalCharData, getGlobalWeaponData,
  getCurrentPool, setCurrentPool, resetCurrentPool, setCurrentAllPoolsData,
  setIsAllPoolsMode, getIsAllPoolsMode, setCurrentHistoryPage,
  getGlobalPoolConfig, getComingFromStats, setComingFromStats,
} from '../state.js';
import { createPoolButtons } from '../pool.js';
import { mergeAllPoolsData, calculateAvgPity, calculateMaxDrought, calculateMonthlyStats, calculatePityDistribution, calculateLuckLevel, calculateUpLevel, calculateUpCount, calculateCumulativeCurve } from '../data.js';
import { updateOrCreateChart, renderPityDistributionChart, renderMonthlyTrendChart, renderCumulativeChart, destroyStatsCharts } from './chart.js';
import { createSummaryStrip, createAllPoolsSummaryStrip } from './summary.js';
import { createRareRecordCard, createAllPoolsRareRecordsCard } from './rare.js';
import { setPoolSelectorVisibility, updateSummaryStripVisibility, clearDisplay } from '../utils.js';
import { createHistoryTable, createAllPoolsHistoryTable, renderEmptyHistoryTable, updateHistoryPaginationUI } from './history.js';
import { renderUpRecordTable } from './uprecord.js';
import { renderPoolProfile, renderRarityStack } from './profile.js';
import { t } from '../i18n.js';

// 核心切换逻辑
export function switchType(type) {
  if (getCurrentType() === type) return;
  setComingFromStats(getCurrentType() === 'stats' && type !== 'stats');
  setCurrentType(type);
  setCurrentHistoryPage(1);
  if (type !== 'all' && type !== 'stats') {
    setLastDataType(type);
  }
  updateAllBtnText();

  document.getElementById('btnTypeChar').classList.toggle('active', type === 'char');
  document.getElementById('btnTypeWeapon').classList.toggle('active', type === 'weapon');
  document.getElementById('btnTypeAll').classList.toggle('active', type === 'all');
  document.getElementById('btnTypeStats').classList.toggle('active', type === 'stats');

  const poolSelectorWrapper = document.getElementById('poolSelectorWrapper');
  const statsPanel = document.getElementById('statsPanel');
  const dashboardPanel = document.getElementById('dashboardPanel');
  const historySection = document.getElementById('historySection');

  if (type === 'stats') {
    // 进入统计 tab：隐藏 dashboard 和 history，statsPanel 由 renderStatsTab 控制
    if (dashboardPanel) dashboardPanel.style.display = 'none';
    if (historySection) historySection.style.display = 'none';
  } else {
    // 离开统计 tab：隐藏 statsPanel，恢复 dashboard 和 history
    if (statsPanel) statsPanel.style.display = 'none';
    if (dashboardPanel) {
      dashboardPanel.style.display = '';
      if (getComingFromStats()) {
        dashboardPanel.style.animation = 'statsChartFadeIn 0.4s ease-out';
        dashboardPanel.addEventListener('animationend', () => {
          dashboardPanel.style.animation = '';
        }, { once: true });
      }
    }
    if (historySection) {
      historySection.style.display = '';
      if (getComingFromStats()) {
        historySection.style.animation = 'statsChartFadeIn 0.4s ease-out';
        historySection.addEventListener('animationend', () => {
          historySection.style.animation = '';
        }, { once: true });
      }
    }
  }

  // STATS 保持进入前的模式，其余类型按 type 设定
  if (type !== 'stats') {
    setIsAllPoolsMode(type === 'all');
  }

  // 池子选择器显隐：STATS 由 renderStatsTab 自行控制
  if (type === 'all') {
    if (poolSelectorWrapper && poolSelectorWrapper.style.opacity !== '0')
      setPoolSelectorVisibility(poolSelectorWrapper, false);
  } else if (type !== 'stats') {
    if (poolSelectorWrapper && poolSelectorWrapper.style.opacity === '0')
      setPoolSelectorVisibility(poolSelectorWrapper, true);
  }

  renderByType(type);
}

export function renderByType(type) {
  if (type === 'all') {
    const allPoolsNoDataConfig = {
      chartMessage: t('noData.allPoolsChart'),
      detailTitle: t('noData.allPoolsSummary'),
      detailDesc: t('noData.allPoolsDesc'),
      historyMessage: t('noData.allPoolsHistory'),
      detailLabel: t('noData.allPoolsAnalysis'),
      historyColspan: 5,
      hidePoolSelector: true
    };
    const dataMap = (getLastDataType() === 'char') ? getGlobalCharData() : getGlobalWeaponData();
    if (!dataMap || Object.keys(dataMap).length === 0) {
      renderNoDataState(allPoolsNoDataConfig);
      return;
    }
    const allPoolsData = mergeAllPoolsData(dataMap, getLastDataType());
    if (!allPoolsData || allPoolsData.length === 0) {
      renderNoDataState(allPoolsNoDataConfig);
      return;
    }
    setCurrentAllPoolsData(allPoolsData);
    updateSummaryStripVisibility(true);
    displayAllPoolsSummary(allPoolsData);
    return;
  }

  // 统计分析 tab
  if (type === 'stats') {
    renderStatsTab();
    return;
  }

  const dataMap = (type === 'char') ? getGlobalCharData() : getGlobalWeaponData();
  if (!dataMap || Object.keys(dataMap).length === 0) {
    renderNoDataState();
    return;
  }

  updateSummaryStripVisibility(true);
  createPoolButtons(dataMap, updateDisplay, type);
  updateDisplay(dataMap, getCurrentPool());

  const thEl = document.getElementById('thName');
  if (thEl) {
    thEl.textContent = (type === 'char') ? t('table.character') : t('table.weapon');
  }
}

// 统一渲染无数据主界面
export function renderNoDataState({
  poolMessage = t('noData.pool'),
  chartMessage = t('noData.chart'),
  detailTitle = t('noData.detail'),
  detailDesc = t('noData.desc'),
  historyMessage = t('noData.history'),
  detailLabel = t('noData.targetUnavailable'),
  historyColspan = 5,
  hidePoolSelector = false
} = {}) {
  clearDisplay();
  resetCurrentPool();
  setCurrentAllPoolsData(null);

  const poolSelectorWrapper = document.getElementById('poolSelectorWrapper');
  if (poolSelectorWrapper) {
    const isHidden = poolSelectorWrapper.style.opacity === '0';
    if (isHidden !== hidePoolSelector) {
      setPoolSelectorVisibility(poolSelectorWrapper, !hidePoolSelector);
    }
    if (!hidePoolSelector) {
      poolSelectorWrapper.innerHTML = `
        <div style="color:#666; padding:10px; font-weight: bold; font-size: 18px;">
          ${poolMessage}
        </div>
      `;
    }
  }

  updateSummaryStripVisibility(false);

  const chartContainer = document.getElementById('chartContainer');
  const rareCharsContainer = document.getElementById('rareCharsContainer');
  if (chartContainer) {
    chartContainer.querySelectorAll("canvas, .chart-no-data").forEach(el => el.remove());
    const noData = document.createElement("div");
    noData.className = "chart-no-data";
    noData.style.cssText = "display:flex; align-items:center; justify-content:center; width:100%; height:100%; color:#666; font-size:20px; font-weight:bold;";
    noData.textContent = chartMessage;
    chartContainer.appendChild(noData);
  }
  if (rareCharsContainer) {
    rareCharsContainer.innerHTML = `
      <div style="padding:40px 32px; color:#666;">
        <div style="font-size:12px; letter-spacing:2px; margin-bottom:16px;">${detailLabel}</div>
        <div style="font-size:28px; font-weight:bold; margin-bottom:16px;">${detailTitle}</div>
        <div style="font-size:14px; line-height:1.8;">
          ${detailDesc}
        </div>
      </div>
    `;
  }
  renderEmptyHistoryTable(historyMessage, historyColspan);
  updateHistoryPaginationUI(0, 0);
}

export function updateDisplay(dataMap, poolName) {
  if (!poolName || !dataMap || !dataMap[poolName]) return;
  updateOrCreateChart(dataMap[poolName]);
  createRareRecordCard(dataMap, poolName);
  createSummaryStrip(dataMap, poolName);
  createHistoryTable(dataMap, poolName);
}

// 汇总模式的主显示函数
export function displayAllPoolsSummary(allItems) {
  updateOrCreateChart(allItems);
  createAllPoolsRareRecordsCard(allItems);
  createAllPoolsSummaryStrip(allItems);
  createAllPoolsHistoryTable(allItems);
}

// 更新汇总/统计卡池标签
export function updateAllBtnText() {
  const hint = (getLastDataType() === 'char') ? "CHAR" : "WEAPON";
  const allBtn = document.getElementById('btnTypeAll');
  if (allBtn) allBtn.textContent = `[ ${t('typeSwitcher.all')} (${hint}) ]`;
  const statsHint = getIsAllPoolsMode() ? "ALL" : hint;
  const statsBtn = document.getElementById('btnTypeStats');
  if (statsBtn) statsBtn.textContent = `[ ${t('typeSwitcher.stats')} (${statsHint}) ]`;
}

// 统计分析 tab 入口
function renderStatsTab() {
  const statsPanel = document.getElementById('statsPanel');
  if (statsPanel) statsPanel.style.display = '';

  updateSummaryStripVisibility(false);

  const poolSelectorWrapper = document.getElementById('poolSelectorWrapper');
  const isAllPools = getIsAllPoolsMode();

  if (isAllPools) {
    // 汇总模式：隐藏池子选择器（保留内容，切回时 scrollHeight 才准确）
    if (poolSelectorWrapper && poolSelectorWrapper.style.opacity !== '0') {
      setPoolSelectorVisibility(poolSelectorWrapper, false);
    }

    const dataMap = (getLastDataType() === 'char') ? getGlobalCharData() : getGlobalWeaponData();
    if (!dataMap || Object.keys(dataMap).length === 0) {
      renderStatsContent(null, true);
      return;
    }
    const allPoolsData = mergeAllPoolsData(dataMap, getLastDataType());
    renderStatsContent(allPoolsData, true);
    return;
  }

  // 单池模式：确保池子选择器完全可见，再创建按钮
  if (poolSelectorWrapper) {
    // 直接落终态而非走动画，需同步状态标记并摘掉上一轮监听，避免状态与实际不符
    poolSelectorWrapper.dataset.poolSelState = 'shown';
    if (poolSelectorWrapper._poolSelEnd) {
      poolSelectorWrapper.removeEventListener('transitionend', poolSelectorWrapper._poolSelEnd);
      poolSelectorWrapper._poolSelEnd = null;
    }
    poolSelectorWrapper.style.transition = 'none';
    poolSelectorWrapper.style.height = '';
    poolSelectorWrapper.style.opacity = '1';
    poolSelectorWrapper.style.marginBottom = '20px';
    poolSelectorWrapper.style.overflow = '';
  }

  const type = getLastDataType() || 'char';
  const dataMap = (type === 'char') ? getGlobalCharData() : getGlobalWeaponData();
  if (!dataMap || Object.keys(dataMap).length === 0) {
    renderStatsContent(null, false);
    return;
  }

  // 复用主池子选择器，绑定统计选池时回调
  createPoolButtons(dataMap, (dm, poolName) => {
    renderStatsContent(dm[poolName], false);
  }, type);

  // 初始化统计以选择器当前高亮的池为默认池
  renderStatsContent(dataMap[getCurrentPool()], false);
}

// 渲染统计内容
function renderStatsContent(items, isAllPools) {
  const statsCardsRow = document.getElementById('statsCardsRow');
  const pityDistContainer = document.getElementById('pityDistChartContainer');
  const monthlyContainer = document.getElementById('monthlyChartContainer');
  const pityDistBody = document.getElementById('pityDistChartBody');
  const monthlyBody = document.getElementById('monthlyChartBody');

  if (!items || items.length === 0) {
    if (statsCardsRow) statsCardsRow.innerHTML = '';
    if (pityDistBody) pityDistBody.innerHTML = `<div style="color:#666;padding:40px;text-align:center;font-weight:bold;">${t('stats.noData')}</div>`;
    if (monthlyBody) monthlyBody.innerHTML = '';
    if (monthlyContainer) monthlyContainer.style.display = 'none';
    const cumulativeContainer = document.getElementById('cumulativeChartContainer');
    if (cumulativeContainer) cumulativeContainer.style.display = 'none';
    ['upRecordContainer', 'poolProfileContainer', 'rarityStackContainer'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.style.display = 'none';
    });
    ['upRecordBody', 'poolProfileBody', 'rarityStackBody'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.innerHTML = '';
    });
    destroyStatsCharts();
    return;
  }

  const poolConfig = getGlobalPoolConfig() || {};
  const isWeapon = getLastDataType() === 'weapon';

  // 统计卡片
  const avg = calculateAvgPity(items);
  const drought = calculateMaxDrought(items);
  // 口径说明，解释数字与原始记录条数不一致的原因
  const avgInfo = {
    head: t('stats.avgPityInfoHead'),
    rows: [
      [t('stats.infoRuleFree'), t('stats.infoRuleFreeVal')],
      [t('stats.infoRuleExcluded'), t('stats.infoRuleExcludedVal')],
    ],
    desc: t('stats.avgPityInfoDesc'),
  };
  const droughtInfo = {
    head: t('stats.droughtInfoHead'),
    rows: [
      [t('stats.infoRuleFree'), t('stats.infoRuleFreeVal')],
      [t('stats.infoRuleExcluded'), t('stats.infoRuleExcludedVal')],
    ],
    desc: t('stats.droughtInfoDesc'),
  };
  if (statsCardsRow) {
    let avgSub = t('stats.total6Star', { count: avg.sixStarCount });
    if (isAllPools) {
      const speedKey = calculateLuckLevel(avg.avgPity, avg.sixStarCount, isWeapon);
      const upCount = calculateUpCount(items, poolConfig);
      const upKey = calculateUpLevel(upCount, avg.sixStarCount, isWeapon);
      const tags = [];
      if (speedKey) tags.push(`${t('stats.luckSpeedPrefix')} ${t(speedKey)}`);
      if (upKey) tags.push(`${t('stats.luckUpPrefix')} ${t(upKey)}`);
      if (tags.length) avgSub = `${avgSub} · ${tags.join(' · ')}`;
    }
    statsCardsRow.innerHTML =
      createStatCard(t('stats.avgPity'), avg.avgPity, avgSub, avgInfo) +
      createStatCard(t('stats.maxDrought'), drought.maxDrought,
        t('stats.currentDrought', { count: drought.currentDrought }), droughtInfo);
  }

  // 抽数分布图（始终显示）
  const distribution = calculatePityDistribution(items, poolConfig);
  if (pityDistContainer) pityDistContainer.style.display = '';
  renderPityDistributionChart(distribution);

  // 月度趋势图（汇总模式才显示）
  if (isAllPools) {
    const monthlyData = calculateMonthlyStats(items, poolConfig);
    if (monthlyContainer) monthlyContainer.style.display = '';
    renderMonthlyTrendChart(monthlyData);
  } else {
    if (monthlyContainer) monthlyContainer.style.display = 'none';
  }

  // 累计出货曲线（汇总模式才显示）
  const cumulativeContainer = document.getElementById('cumulativeChartContainer');
  if (isAllPools) {
    const curve = calculateCumulativeCurve(items);
    if (cumulativeContainer) cumulativeContainer.style.display = '';
    renderCumulativeChart(curve, isWeapon);
  } else {
    if (cumulativeContainer) cumulativeContainer.style.display = 'none';
  }

  // 统计附加图：UP 战绩表挂 ALL 汇总；池子剖面与稀有度成分挂单池
  const containerUpRecord = document.getElementById('upRecordContainer');
  const containerPoolProfile = document.getElementById('poolProfileContainer');
  const containerRarityStack = document.getElementById('rarityStackContainer');
  const dataMap = (isWeapon ? getGlobalWeaponData() : getGlobalCharData()) || {};
  if (isAllPools) {
    if (containerUpRecord) {
      containerUpRecord.style.display = '';
      renderUpRecordTable(items);
    }
    if (containerPoolProfile) containerPoolProfile.style.display = 'none';
    if (containerRarityStack) containerRarityStack.style.display = 'none';
  } else {
    if (containerUpRecord) containerUpRecord.style.display = 'none';
    if (containerPoolProfile) {
      containerPoolProfile.style.display = '';
      renderPoolProfile(dataMap, getCurrentPool());
    }
    if (containerRarityStack) {
      containerRarityStack.style.display = '';
      renderRarityStack(dataMap, getCurrentPool());
    }
  }
}

// info 可选，形如 { head, rows, desc }，传入时在卡片内渲染规则说明 popover
function createStatCard(label, value, sub, info) {
  return `<div class="stats-card">
    <div class="stats-card-label">${label}</div>
    <div class="stats-card-value">${value}</div>
    <div class="stats-card-sub">${sub}</div>
    ${info ? renderInfoPop(info) : ''}
  </div>`;
}

// 规则说明 popover，复用 .cc-info 样式，图标用 SVG 保证居中
const INFO_ICON_SVG =
  '<svg viewBox="0 0 16 16" aria-hidden="true">' +
  '<rect x="7.2" y="3.6" width="1.6" height="5.6" rx="0.8"/>' +
  '<circle cx="8" cy="11.8" r="1"/></svg>';

export function renderInfoPop({ head, rows = [], desc = '' }) {
  const rowsHtml = rows
    .map(r => `<div class="cc-info-pop__row"><span>${r[0]}</span><b>${r[1]}</b></div>`)
    .join('');
  const descHtml = desc ? `<div class="cc-info-pop__sep"></div><div class="cc-info-pop__desc">${desc}</div>` : '';
  return `<div class="cc-info">
    <span class="cc-info-icon">${INFO_ICON_SVG}</span>
    <div class="cc-info-pop">
      <div class="cc-info-pop__head">${head}</div>
      ${rowsHtml}${descHtml}
    </div>
  </div>`;
}

// 主题切换时重建 stats 图表（仅在 stats 标签页生效）
export function rerenderStatsCharts() {
  if (getCurrentType() !== 'stats') return;
  destroyStatsCharts();
  renderStatsTab();
}

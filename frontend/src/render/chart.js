import {
  getGachaChartInstance, setGachaChartInstance,
  getPityDistChartInstance, setPityDistChartInstance,
  getMonthlyTrendChartInstance, setMonthlyTrendChartInstance,
  getCumulativeChartInstance, setCumulativeChartInstance,
  getGlobalTheme
} from '../state.js';
import { t } from '../i18n.js';
import Chart from 'chart.js/auto';
import { calculateExpectedCurve } from '../data.js';

function getStatsGridColor() {
  return getGlobalTheme() === 'day' ? '#cfcfc7' : '#444';
}

export function updateOrCreateChart(items) {
  if (!items || !Array.isArray(items) || items.length === 0) items = [];

  const chartContainer = document.getElementById("chartContainer");
  if (chartContainer) {
    // 移除残留的无数据样式
    chartContainer.querySelectorAll(".chart-no-data").forEach(el => el.remove());
  }

  const rarityCounts = { 4: 0, 5: 0, 6: 0 };
  items.forEach(item => {
    if (rarityCounts[item.rarity] !== undefined) rarityCounts[item.rarity] += 1;
  });

  const chartInstance = getGachaChartInstance();
  if (chartInstance) {
    chartInstance.data.datasets[0].data = [rarityCounts[4], rarityCounts[5], rarityCounts[6]];
    chartInstance.update();
    return;
  }

  // 清除旧数据的 chart 实例
  const oldCanvas = chartContainer.querySelector("canvas");
  if (oldCanvas) oldCanvas.remove();

  const ctx = document.createElement("canvas");
  ctx.style.maxWidth = "280px";
  ctx.style.maxHeight = "280px";
  chartContainer.appendChild(ctx);

  const newChart = new Chart(ctx, {
    type: "doughnut",
    data: {
      labels: ["4★", "5★", "6★"],
      datasets: [{
        data: [rarityCounts[4], rarityCounts[5], rarityCounts[6]],
        backgroundColor: ["#9c27b0", "#ffca28", "#ff5722"],
        borderColor: Chart.defaults.borderColor,
        borderWidth: 2,
        hoverOffset: 8
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false, cutout: '60%',
      animation: { duration: 800, easing: 'easeOutQuart' },
      plugins: {
        legend: { position: "bottom", labels: { font: { family: 'Consolas' }, boxWidth: 10, padding: 10 } },
        title: { display: false }
      }
    }
  });
  setGachaChartInstance(newChart);
}

export function renderPityDistributionChart(distribution) {
  if (!distribution || !distribution.labels) return;

  const existing = getPityDistChartInstance();
  if (existing) {
    existing.data.datasets[0].data = distribution.counts;
    existing.data.datasets[1].data = distribution.upCounts;
    existing.data.datasets[2].data = distribution.offCounts;
    existing.update();
    return;
  }

  const container = document.getElementById('pityDistChartBody');
  const oldCanvas = container.querySelector('canvas');
  if (oldCanvas) oldCanvas.remove();

  const canvas = document.createElement('canvas');
  container.appendChild(canvas);

  const colors = [
    '#ffd54f', '#ffca28',
    '#ffc107', '#ffb300',
    '#ff9800', '#f57c00',
    '#ef6c00', '#e65100'
  ];

  const newChart = new Chart(canvas, {
    type: 'bar',
    data: {
      labels: distribution.labels,
      datasets: [
        {
          label: t('chart.labelTotal'),
          data: distribution.counts,
          backgroundColor: colors,
          borderColor: colors,
          borderWidth: 1,
          borderRadius: 4
        },
        {
          label: t('chart.labelUp'),
          data: distribution.upCounts,
          backgroundColor: 'rgba(244, 67, 54, 0.7)',
          borderColor: '#f44336',
          borderWidth: 1,
          borderRadius: 4
        },
        {
          label: t('chart.labelOff'),
          data: distribution.offCounts,
          backgroundColor: 'rgba(76, 175, 80, 0.7)',
          borderColor: '#4caf50',
          borderWidth: 1,
          borderRadius: 4
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: {
        duration: 600,
        easing: 'easeOutQuart'
      },
      plugins: {
        legend: {
          position: 'bottom',
          labels: { font: { family: 'Consolas', size: 11 }, boxWidth: 10, padding: 10 }
        },
        title: { display: false }
      },
      scales: {
        x: {
          border: { color: getStatsGridColor(), display: true },
          grid: { display: false },
          ticks: {
            font: { family: 'Consolas', size: 11 }
          }
        },
        y: {
          title: { display: true, text: t('chart.yAxisTimes'), font: { family: 'Consolas', size: 11 } },
          border: { color: getStatsGridColor(), display: true },
          grid: { color: getStatsGridColor() },
          beginAtZero: true,
          ticks: {
            font: { family: 'Consolas', size: 11 },
            stepSize: 1
          }
        }
      }
    }
  });
  setPityDistChartInstance(newChart);
}

export function renderMonthlyTrendChart(monthlyData) {
  if (!monthlyData || !Array.isArray(monthlyData) || monthlyData.length === 0) monthlyData = [];

  const existing = getMonthlyTrendChartInstance();
  if (existing) {
    existing.data.labels = monthlyData.map(d => d.month);
    existing.data.datasets[0].data = monthlyData.map(d => d.totalPulls);
    existing.data.datasets[1].data = monthlyData.map(d => d.sixStarCount);
    existing.data.datasets[2].data = monthlyData.map(d => d.upCount);
    existing.data.datasets[3].data = monthlyData.map(d => d.offCount);
    existing.update();
    return;
  }

  const container = document.getElementById('monthlyChartBody');
  const oldCanvas = container.querySelector('canvas');
  if (oldCanvas) oldCanvas.remove();

  const canvas = document.createElement('canvas');
  container.appendChild(canvas);

  const newChart = new Chart(canvas, {
    type: 'bar',
    data: {
      labels: monthlyData.map(d => d.month),
      datasets: [
        {
          label: t('chart.labelMonthlyPulls'),
          data: monthlyData.map(d => d.totalPulls),
          backgroundColor: 'rgba(255, 202, 40, 0.5)',
          borderColor: '#ffca28',
          borderWidth: 1,
          yAxisID: 'y'
        },
        {
          label: t('chart.label6StarCount'),
          data: monthlyData.map(d => d.sixStarCount),
          type: 'line',
          borderColor: '#ffd54f',
          backgroundColor: '#ffca28',
          pointRadius: 4,
          pointHoverRadius: 6,
          tension: 0.3,
          yAxisID: 'y1'
        },
        {
          label: t('chart.labelUp'),
          data: monthlyData.map(d => d.upCount),
          type: 'line',
          borderColor: '#f44336',
          backgroundColor: '#f44336',
          pointRadius: 4,
          pointHoverRadius: 6,
          tension: 0.3,
          yAxisID: 'y1'
        },
        {
          label: t('chart.labelOff'),
          data: monthlyData.map(d => d.offCount),
          type: 'line',
          borderColor: '#4caf50',
          backgroundColor: '#4caf50',
          pointRadius: 4,
          pointHoverRadius: 6,
          tension: 0.3,
          yAxisID: 'y1'
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 600, easing: 'easeOutQuart' },
      plugins: {
        legend: {
          position: 'bottom',
          labels: { font: { family: 'Consolas', size: 11 }, boxWidth: 10, padding: 10 }
        },
        title: { display: false }
      },
      scales: {
        x: {
          border: { color: getStatsGridColor(), display: true },
          grid: { display: false },
          ticks: { font: { family: 'Consolas', size: 11 } }
        },
        y: {
          type: 'linear',
          position: 'left',
          beginAtZero: true,
          title: { display: true, text: t('chart.yAxisPulls'), font: { family: 'Consolas', size: 11 } },
          border: { color: getStatsGridColor(), display: true },
          grid: { color: getStatsGridColor() },
          ticks: { font: { family: 'Consolas', size: 11 } }
        },
        y1: {
          type: 'linear',
          position: 'right',
          beginAtZero: true,
          title: { display: true, text: '6★', font: { family: 'Consolas', size: 11 } },
          border: { color: getStatsGridColor(), display: true },
          grid: { drawOnChartArea: false },
          ticks: { font: { family: 'Consolas', size: 11 }, stepSize: 1 }
        }
      }
    }
  });
  setMonthlyTrendChartInstance(newChart);
}

export function destroyStatsCharts() {
  const pityChart = getPityDistChartInstance();
  if (pityChart) {
    pityChart.destroy();
    setPityDistChartInstance(null);
  }
  const monthlyChart = getMonthlyTrendChartInstance();
  if (monthlyChart) {
    monthlyChart.destroy();
    setMonthlyTrendChartInstance(null);
  }
  const cumChart = getCumulativeChartInstance();
  if (cumChart) {
    cumChart.destroy();
    setCumulativeChartInstance(null);
  }
}

// 累计出货曲线（ALL 汇总用）：横轴累计抽数，纵轴累计 6★ 数
// 实际曲线 vs 理论期望曲线（按官方概率模型逐抽累加，非线性），
// 实际在期望上方即为偏欧
// 角色池累计出货曲线：限定池（main 链）与复刻池（rerun_char 链）各一条，共用一条期望线
// 两条链的水位互不继承，各自从 (0,0) 起，横轴分别为各自的累计水位
export function renderCumulativeChart(data) {
  const mainPoints = data?.main || [];
  const rerunPoints = data?.rerun || [];
  const hasRerun = rerunPoints.length > 1;
  const hasMain = mainPoints.length > 1;

  // 两条链都无出货点时销毁旧实例，否则会残留上一批数据的曲线
  if (!hasMain && !hasRerun) {
    const stale = getCumulativeChartInstance();
    if (stale) {
      stale.destroy();
      setCumulativeChartInstance(null);
    }
    return;
  }

  // 先确定最终的 x 轴，再让各组数据都按它生成，避免各数组长度不一致。
  // 末次出货后仍有未垫刀时，x 轴向右多延一格用于展示当前垫刀
  const mainTail = data.mainTail || 0;
  const rerunTail = data.rerunTail || 0;
  const mainLast = mainPoints[mainPoints.length - 1];
  const rerunLast = rerunPoints[rerunPoints.length - 1];
  const mainEnd = hasMain ? mainLast.pull + mainTail : 0;
  const rerunEnd = hasRerun ? rerunLast.pull + rerunTail : 0;
  const axisMax = Math.max(mainEnd, rerunEnd);
  const axis = Array.from({ length: axisMax + 1 }, (_, i) => i);

  const expectMap = new Map(calculateExpectedCurve(axisMax, false).map(e => [e.pull, e.expect]));
  const expected = axis.map(pull => expectMap.get(pull) ?? expectMap.get(axisMax) ?? 0);

  // 各链映射到统一的 x 轴上：出货点按原位置，垫刀段仅在终点补一个值形成水平延伸
  // 中间不补点，否则末端会因密集的点标记显示为一串圆点
  const toSeries = (points, tail) => {
    if (points.length < 2) return axis.map(() => null);
    const byPull = new Map(points.map(p => [p.pull, p.six]));
    const lastPull = points[points.length - 1].pull;
    const lastSix = points[points.length - 1].six;
    return axis.map(pull => {
      if (byPull.has(pull)) return byPull.get(pull);
      if (tail > 0 && pull === lastPull + tail) return lastSix;
      return null;
    });
  };

  const mainSeries = toSeries(mainPoints, mainTail);
  const rerunSeries = toSeries(rerunPoints, rerunTail);

  const existing = getCumulativeChartInstance();

  // 图表类型不符（如从武器池申领曲线切来）则销毁重建，避免沿用对方的数据集结构
  if (existing && existing.$chartKind !== 'charCumulative') {
    existing.destroy();
    setCumulativeChartInstance(null);
  }

  const reuse = getCumulativeChartInstance();
  if (reuse) {
    reuse.data.labels = axis;
    reuse.data.datasets[0].data = mainSeries;
    reuse.data.datasets[1].data = expected;
    reuse.data.datasets[2].data = rerunSeries;
    reuse.update();
    return;
  }

  const container = document.getElementById('cumulativeChartBody');
  if (!container) return;
  const oldCanvas = container.querySelector('canvas');
  if (oldCanvas) oldCanvas.remove();

  const canvas = document.createElement('canvas');
  container.appendChild(canvas);

  const grid = getStatsGridColor();
  const newChart = new Chart(canvas, {
    type: 'line',
    data: {
      labels: axis,
      datasets: [
        {
          label: t('chart.labelCumulativeMain'),
          data: mainSeries,
          borderColor: '#ffca28',
          backgroundColor: 'rgba(255, 202, 40, 0.12)',
          borderWidth: 2,
          pointRadius: 2.5,
          pointHoverRadius: 5,
          pointBackgroundColor: '#ffca28',
          tension: 0,
          fill: true,
          spanGaps: true
        },
        {
          label: t('chart.labelCumulativeExpect'),
          data: expected,
          borderColor: grid,
          borderWidth: 1.5,
          borderDash: [5, 4],
          pointRadius: 0,
          tension: 0,
          fill: false
        },
        {
          label: t('chart.labelCumulativeRerun'),
          data: rerunSeries,
          borderColor: '#4fc3f7',
          backgroundColor: 'rgba(79, 195, 247, 0.10)',
          borderWidth: 2,
          pointRadius: 2.5,
          pointHoverRadius: 5,
          pointBackgroundColor: '#4fc3f7',
          tension: 0,
          fill: true,
          spanGaps: true
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 600, easing: 'easeOutQuart' },
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: {
          position: 'bottom',
          labels: { font: { family: 'Consolas', size: 11 }, boxWidth: 10, padding: 10 }
        },
        title: { display: false },
        tooltip: {
          filter: item => item.parsed.y !== null,
          callbacks: {
            title: items => `${t('chart.cumulativeAt')} ${items[0].label} ${t('chart.pullsUnit')}`,
            label: ctx => `${ctx.dataset.label}: ${(+ctx.parsed.y).toFixed(2)}`
          }
        }
      },
      scales: {
        x: {
          type: 'linear',
          title: { display: true, text: t('chart.xAxisPulls'), font: { family: 'Consolas', size: 11 } },
          border: { color: grid, display: true },
          grid: { display: false },
          ticks: { font: { family: 'Consolas', size: 11 }, maxTicksLimit: 12 }
        },
        y: {
          title: { display: true, text: t('chart.yAxis6Count'), font: { family: 'Consolas', size: 11 } },
          border: { color: grid, display: true },
          grid: { color: grid },
          beginAtZero: true,
          ticks: { font: { family: 'Consolas', size: 11 }, stepSize: 5 }
        }
      }
    }
  });
  newChart.$chartKind = 'charCumulative';
  setCumulativeChartInstance(newChart);
}

// 限定武器池出货曲线：单条线，横轴为累计申领次数、纵轴为累计 6★ 数
// 武器池按水位累加会因「不跨池继承 + 保底单位为申领」而与角色池尺度不可比，故单独成图
// popover 显示该次申领所属卡池与本次出货数
export function renderWeaponClaimChart(curve) {
  const points = curve?.points;
  if (!points || points.length < 2) {
    const stale = getCumulativeChartInstance();
    if (stale) {
      stale.destroy();
      setCumulativeChartInstance(null);
    }
    return;
  }

  const labels = points.map(p => p.claim);
  const actual = points.map(p => p.six);
  const poolNames = points.map(p => p.poolName);
  const sixThisClaim = points.map(p => p.sixThisClaim);

  // 图表类型不符（如从角色池累计曲线切来）则销毁重建
  const existing = getCumulativeChartInstance();
  if (existing && existing.$chartKind !== 'weaponClaim') {
    existing.destroy();
    setCumulativeChartInstance(null);
  }

  const reuse = getCumulativeChartInstance();
  if (reuse) {
    reuse.data.labels = labels;
    reuse.data.datasets[0].data = actual;
    reuse.$poolNames = poolNames;
    reuse.$sixThisClaim = sixThisClaim;
    reuse.update();
    return;
  }

  const container = document.getElementById('cumulativeChartBody');
  if (!container) return;
  const oldCanvas = container.querySelector('canvas');
  if (oldCanvas) oldCanvas.remove();

  const canvas = document.createElement('canvas');
  container.appendChild(canvas);

  const grid = getStatsGridColor();
  const newChart = new Chart(canvas, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: t('chart.labelCumulativeActual'),
          data: actual,
          borderColor: '#ffca28',
          backgroundColor: 'rgba(255, 202, 40, 0.12)',
          borderWidth: 2,
          pointRadius: 3,
          pointHoverRadius: 6,
          pointBackgroundColor: '#ffca28',
          tension: 0,
          fill: true
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 600, easing: 'easeOutQuart' },
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: {
          position: 'bottom',
          labels: { font: { family: 'Consolas', size: 11 }, boxWidth: 10, padding: 10 }
        },
        title: { display: false },
        tooltip: {
          callbacks: {
            title: items => {
              const i = items[0].dataIndex;
              const pool = newChart.$poolNames?.[i];
              if (!pool) return t('chart.claimStart');
              return `${pool} · ${t('chart.claimNo')} ${items[0].label}`;
            },
            label: ctx => {
              const i = ctx.dataIndex;
              const thisSix = newChart.$sixThisClaim?.[i] ?? 0;
              const lines = [`${t('chart.labelCumulativeActual')}: ${ctx.parsed.y}`];
              if (i > 0) lines.push(`${t('chart.claimThisSix')}: ${thisSix}`);
              return lines;
            }
          }
        }
      },
      scales: {
        x: {
          type: 'linear',
          title: { display: true, text: t('chart.xAxisClaims'), font: { family: 'Consolas', size: 11 } },
          border: { color: grid, display: true },
          grid: { display: false },
          ticks: { font: { family: 'Consolas', size: 11 }, stepSize: 1, maxTicksLimit: 20 }
        },
        y: {
          title: { display: true, text: t('chart.yAxis6Count'), font: { family: 'Consolas', size: 11 } },
          border: { color: grid, display: true },
          grid: { color: grid },
          beginAtZero: true,
          ticks: { font: { family: 'Consolas', size: 11 }, stepSize: 1 }
        }
      }
    }
  });
  newChart.$chartKind = 'weaponClaim';
  newChart.$poolNames = poolNames;
  newChart.$sixThisClaim = sixThisClaim;
  setCumulativeChartInstance(newChart);
}

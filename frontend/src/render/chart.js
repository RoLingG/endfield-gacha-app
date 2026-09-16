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
export function renderCumulativeChart(data, isWeapon = false) {
  if (!data || !data.points || data.points.length < 2) return;

  const existing = getCumulativeChartInstance();

  // 先确定最终的 x 轴，再让三组数据都按它生成，避免各数组长度不一致。
  // 末次出货后仍有未出货抽数时，x 轴向右多延一格用于展示当前垫刀
  const hasTail = data.tailPulls > 0;
  const axis = data.points.map(p => p.pull);
  if (hasTail) axis.push(data.totalPulls + data.tailPulls);
  const lastIdx = axis.length - 1;

  const expectMax = axis[lastIdx];
  const expectMap = new Map(calculateExpectedCurve(expectMax, isWeapon).map(e => [e.pull, e.expect]));

  // 实际曲线：出货点按原位置，垫刀段只保留末值以形成水平延伸
  const actual = axis.map((pull, i) => {
    if (i < data.points.length) return data.points[i].six;
    return null;
  });
  const expected = axis.map(pull => expectMap.get(pull) ?? expectMap.get(expectMax) ?? 0);
  // 垫刀段：与实线末端同值，构成水平虚线；末端之外的索引为 null 不绘制
  const lastSix = data.points[data.points.length - 1].six;
  const tail = hasTail
    ? axis.map((_, i) => (i >= data.points.length - 1 ? lastSix : null))
    : axis.map(() => null);

  if (existing) {
    existing.data.labels = axis;
    existing.data.datasets[0].data = actual;
    existing.data.datasets[1].data = expected;
    existing.data.datasets[2].data = tail;
    existing.update();
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
          label: t('chart.labelCumulativeActual'),
          data: actual,
          borderColor: '#ffca28',
          backgroundColor: 'rgba(255, 202, 40, 0.12)',
          borderWidth: 2,
          pointRadius: 2.5,
          pointHoverRadius: 5,
          pointBackgroundColor: '#ffca28',
          tension: 0,
          fill: true
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
          label: t('chart.labelCumulativeTail'),
          data: tail,
          borderColor: '#777',
          borderWidth: 1.5,
          borderDash: [4, 3],
          pointRadius: 0,
          pointHoverRadius: 4,
          pointBackgroundColor: '#999',
          tension: 0,
          fill: false,
          spanGaps: false
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
            title: items => {
              const isTail = items[0].datasetIndex === 2;
              const prefix = isTail ? t('chart.cumulativeTailAt') : t('chart.cumulativeAt');
              return `${prefix} ${items[0].label} ${t('chart.pullsUnit')}`;
            },
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
  setCumulativeChartInstance(newChart);
}

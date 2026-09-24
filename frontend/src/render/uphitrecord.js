import { calculateUpHitRecords } from '../data.js';
import { getGlobalPoolConfig } from '../state.js';
import { t } from '../i18n.js';

// 表头排序状态（模块级，切换 tab 后保留）
let sortKey = 'pulls';
let sortAsc = false;

// UP 命中记录表渲染（ALL 汇总用）；items 为该类型全池合并记录
export function renderUpHitRecordTable(items) {
  const body = document.getElementById('upHitRecordBody');
  if (!body) return;

  const records = calculateUpHitRecords(items, getGlobalPoolConfig() || {});
  if (!records || records.length === 0) {
    body.innerHTML = `<div class="stats-chart-empty">${t('stats.upHitRecordEmpty')}</div>`;
    return;
  }

  // 极值用于着色：出货率最高/最低、最深水位最大
  const bestRate = Math.max(...records.map(r => r.rate));
  const worstRate = Math.min(...records.map(r => r.rate));
  const deepestMax = Math.max(...records.map(r => r.deepest), 0);

  const cols = [
    { key: 'upName',   label: t('stats.upTarget'),  align: 'left' },
    { key: 'poolName', label: t('stats.upPools'),   align: 'left' },
    { key: 'pulls',    label: t('stats.upPulls'),   align: 'center' },
    { key: 'sixStarCount', label: '6★',             align: 'center' },
    { key: 'rate',     label: t('stats.upRate'),    align: 'center' },
    { key: 'avgPity',  label: t('stats.upAvgPity'), align: 'center' },
    { key: 'offRate',  label: t('stats.upOffRate'), align: 'center' },
    { key: 'deepest',  label: t('stats.upDeepest'), align: 'center' }
  ];

  const sorted = [...records].sort((a, b) => {
    const va = a[sortKey];
    const vb = b[sortKey];
    const cmp = (typeof va === 'number') ? va - vb : String(va).localeCompare(String(vb));
    return sortAsc ? cmp : -cmp;
  });

  // 对齐统一从列定义注入 th 与 td（两处分别设置会导致表头与数据错位）
  // 数值列居中：table-layout:fixed 下各列等宽，右对齐会让短数字贴右缘显空旷
  const alignOf = c => c.align === 'left' ? 'left' : 'center';

  const headHtml = cols.map(c => {
    const style = `text-align:${alignOf(c)}`;
    if (c.noSort) {
      return `<th style="${style}">${c.label}</th>`;
    }
    const active = c.key === sortKey;
    return `<th class="up-hit-record-table__sort${active ? ' sorted' : ''}" data-key="${c.key}" style="${style}">
              ${c.label}${active ? (sortAsc ? ' ▲' : ' ▼') : ''}
            </th>`;
  }).join('');

  const rowsHtml = sorted.map(rec => {
    const rateCls = rec.rate === bestRate ? ' up-hit-record-table__rate-best'
      : (rec.rate === worstRate && bestRate !== worstRate) ? ' up-hit-record-table__rate-worst' : '';
    const deepestCls = (rec.deepest === deepestMax && deepestMax > 0) ? ' up-hit-record-table__deepest-max' : '';
    const cell = (c, content, extraCls = '', title = '') =>
      `<td class="${extraCls}" style="text-align:${alignOf(c)}"${title ? ` title="${title}"` : ''}>${content}</td>`;
    return `<tr>
      ${cell(cols[0], rec.upName, 'up-hit-record-table__name')}
      ${cell(cols[1], rec.poolName, 'up-hit-record-table__pools', rec.poolName)}
      ${cell(cols[2], rec.pulls)}
      ${cell(cols[3], rec.sixStarCount)}
      ${cell(cols[4], `${rec.rate}%`, rateCls.trim())}
      ${cell(cols[5], rec.avgPity)}
      ${cell(cols[6], `${rec.offRate}%`)}
      ${cell(cols[7], rec.deepest, deepestCls)}
    </tr>`;
  }).join('');

  body.innerHTML =
    `<table class="up-hit-record-table">
      <tr>${headHtml}</tr>
      ${rowsHtml}
    </table>`;

  body.querySelectorAll('.up-hit-record-table__sort').forEach(th => {
    th.addEventListener('click', () => {
      const k = th.dataset.key;
      if (k === sortKey) sortAsc = !sortAsc;
      else { sortKey = k; sortAsc = false; }
      renderUpHitRecordTable(items);
    });
  });
}

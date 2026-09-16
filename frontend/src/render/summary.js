import { calculatePoolStats, calculateSparkInfo, calculatePityBoost, calculatePerPoolPity, calculateOffRate } from '../data.js';
import { getCurrentType, getLastDataType, getGlobalPoolConfig, getGlobalCharPoolOrder, getGlobalWeaponPoolOrder } from '../state.js';
import { updateCurrencyDisplay } from '../utils.js';
import { t } from '../i18n.js';
import { PITY_BOOST_START } from '../constants.js';

let prevPityPct = null;
let prevPityColor = null;

export function createSummaryStrip(dataMap, poolName) {
  const items = dataMap[poolName] || [];
  const poolId = items[0]?.poolId;
  const poolUpConfig = getGlobalPoolConfig() || {};
  const reversed = items.slice().reverse();

  // 每个池子各自的水位（保底计数跨池继承，出 6★ 归零）
  const currentType = getCurrentType();
  const isWeapon = currentType === 'weapon';
  const poolOrder = isWeapon
    ? getGlobalWeaponPoolOrder()
    : getGlobalCharPoolOrder();
  const perPoolPity = calculatePerPoolPity(dataMap, poolOrder);
  const currentPity = perPoolPity[poolName] ?? 0;

  const { total, notFreeTotal, sixStarCount, fiveStarCount, fourStarCount, rate } = calculatePoolStats(items);

  let centerLabel = t('summary.poolTotal');
  let centerValueHtml = total;
  let rightCornerSub = isWeapon ? t('summary.guaranteeWeapon') : t('summary.guaranteeChar');
  let pityCount = isWeapon ? 40 : 80;
  const targetUp = poolUpConfig[poolName] || null;
  if (!isWeapon && targetUp) {
    centerLabel = t('summary.poolSpark');
    const spark = calculateSparkInfo(reversed, targetUp);
    rightCornerSub = spark.rightCornerSub;
    centerValueHtml = `${spark.sparkCount} <span style="font-size:12px;color:#666">/ ${spark.targetLimit}</span>`;
  }

  const pityBoost = calculatePityBoost(currentPity, poolId, isWeapon);
  const pityPct = Math.min((currentPity / pityCount) * 100, 100);
  const pityBarColor = currentPity >= pityCount ? '#ff3b30'
    : (!isWeapon && currentPity >= PITY_BOOST_START) ? '#ff8c1a'
    : 'var(--ef-yellow)';
  const typeLabel = isWeapon ? t('summary.weapons') : t('summary.characters');
  document.getElementById('summaryStrip').innerHTML = `
    <div class="info-card">
      <div class="info-label">${t('summary.currentPity')}</div>
      <div class="info-value" style="color:${pityBoost.pityColor}">
        ${currentPity} <span style="font-size:12px;color:#666">/ ${pityCount}</span>
      </div>
      <div class="pity-bar">
        <div class="pity-bar-fill" style="width:${pityPct}%; background:${pityBarColor};"></div>
      </div>
      <div class="info-sub">${pityBoost.pitySubText}</div>
    </div>

    <div class="info-card">
      <div class="info-label">${centerLabel}</div>
      <div class="info-value">
        ${centerValueHtml}
      </div>
      <div class="info-sub">${rightCornerSub}</div>
    </div>

    <div class="info-card">
      <div class="info-label">${t('summary.ratio')}</div>
      <div class="info-value">${rate}%</div>
      <div class="info-sub">${sixStarCount} ${typeLabel}</div>
    </div>
  `;
  // 切池时 fill 随 strip 整体重建，先设旧值再 reflow 到新值，让宽度/颜色平滑过渡
  const fill = document.getElementById('summaryStrip').querySelector('.pity-bar-fill');
  if (fill) {
    if (prevPityPct !== null) {
      fill.style.width = `${prevPityPct}%`;
      fill.style.background = prevPityColor;
      void fill.offsetWidth;
    }
    fill.style.width = `${pityPct}%`;
    fill.style.background = pityBarColor;
  }
  prevPityPct = pityPct;
  prevPityColor = pityBarColor;
  updateCurrencyDisplay(notFreeTotal, currentType, { six: sixStarCount, five: fiveStarCount, four: fourStarCount });
}

export function createAllPoolsSummaryStrip(items) {
  if (!items || !Array.isArray(items) || items.length === 0) items = [];
  const { total, notFreeTotal, sixStarCount, fiveStarCount, fourStarCount, rate } = calculatePoolStats(items);
  const { upCount, offCount, offRate } = calculateOffRate(items, getGlobalPoolConfig() || {});
  const typeLabel = (getLastDataType() === 'char') ? t('summary.characters') : t('summary.weapons');

  document.getElementById('summaryStrip').innerHTML = `
    <div class="info-card">
      <div class="info-label">${t('summary.totalDraws')}</div>
      <div class="info-value">${total}</div>
      <div class="info-sub">${t('summary.allPoolsCareer')}</div>
    </div>

    <div class="info-card">
      <div class="info-label">${t('summary.total6Count')}</div>
      <div class="info-value">${sixStarCount}</div>
      <div class="info-sub">${t('summary.total6Obtained')}</div>
    </div>

    <div class="info-card">
      <div class="info-label">${t('summary.offRate')}</div>
      <div class="info-value">${offRate}%</div>
      <div class="info-sub">${t('summary.offRateSub', { up: upCount, off: offCount })}</div>
    </div>
  `;
  updateCurrencyDisplay(notFreeTotal, getLastDataType(), { six: sixStarCount, five: fiveStarCount, four: fourStarCount });
}

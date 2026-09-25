import { calculateSixStarDetails, formatPoolLabel } from '../data.js';
import { getCurrentType, getGlobalPoolConfig } from '../state.js';
import { t } from '../i18n.js';

function renderRareItemChip({ label, isUpItem, isNewItem, cornerBadge }) {
  let stateClass = "rare-chip--muted";
  let hasGlowEffect = false;
  if (isUpItem) {
    stateClass = "rare-chip--up";
    if (isNewItem) {
      hasGlowEffect = true;
    }
  } else if (isNewItem) {
    stateClass = "rare-chip--new";
  }
  const glowClass = hasGlowEffect ? "glow-up-new" : "";

  if (cornerBadge) {
    return `<span class="rare-chip rare-chip--split ${stateClass} ${glowClass}">` +
      `<span class="rare-chip__label">${label}</span>` +
      `<span class="rare-chip__badge">+${cornerBadge}</span>` +
      `</span>`;
  }
  return `<span class="rare-chip ${stateClass} ${glowClass}">` +
    `<span class="rare-chip__label">${label}</span>` +
    `</span>`;
}

// 6★ 详情 popover（hover 显示，纯 CSS）
function renderRareChipPop(item, isUpItem) {
  const upText = isUpItem ? "YES" : "-";
  const newText = item.isNew ? "YES" : "-";
  const inheritedRow = item.inheritedPity
    ? `<div class="rare-chip-pop__row"><span>INHERITED</span><b>+${item.inheritedPity}</b></div>`
    : "";
  return `<span class="rare-chip-pop">` +
    `<span class="rare-chip-pop__head">// 6★ DETAIL</span>` +
    `<span class="rare-chip-pop__name">${item.name}</span>` +
    `<span class="rare-chip-pop__row"><span>POOL</span><b>${item.poolName ? formatPoolLabel(item.poolName) : "-"}</b></span>` +
    `<span class="rare-chip-pop__row"><span>PITY</span><b>${item.pityText}</b></span>` +
    inheritedRow +
    `<span class="rare-chip-pop__row"><span>UP</span><b>${upText}</b></span>` +
    `<span class="rare-chip-pop__row"><span>NEW</span><b>${newText}</b></span>` +
    `</span>`;
}

function renderRareRecordsCard(options) {
  const {
    sixStarDetails,
    headerText,
    titleText,
    countLabel,
    countValue,
    labelText,
    getChipLabel,
    getUpCharName,
  } = options;

  const container = document.getElementById("rareCharsContainer");
  container.style.padding = "24px";
  const accentColor = "var(--ef-accent)";
  const textStrong = "var(--ef-text-strong)";
  const textMuted = "var(--ef-text-muted)";
  const emptyColor = "var(--ef-empty)";

  const chipsHtml = sixStarDetails.map(item => {
    const upCharName = getUpCharName ? getUpCharName(item) : null;
    const isUpItem = upCharName && item.name === upCharName;
    const chip = renderRareItemChip({
      label: getChipLabel(item),
      isUpItem,
      isNewItem: item.isNew,
      cornerBadge: item.inheritedPity
    });
    return `<span class="rare-chip-wrap">` + chip + renderRareChipPop(item, isUpItem) + `</span>`;
  }).join("");

  const emptyHtml = `<span style="color:${emptyColor}; font-style:italic; font-size:12px;">// NO SIGNAL DETECTED</span>`;
  container.style.borderLeft = `4px solid ${accentColor}`;
  container.innerHTML = `
    <div style="margin-left: 8px;">
      <div style="font-size:10px; color:${textMuted}; font-family:'Consolas'; letter-spacing:1px; margin-bottom:4px;">${headerText}</div>
      <div style="font-size:18px; font-weight:bold; color:${accentColor}; margin-bottom:12px; font-family:'Consolas'; text-transform:uppercase;">${titleText}</div>
      <div style="display:flex; align-items:center; gap:10px; border-bottom:1px solid #777; padding-bottom:12px; margin-bottom:12px;">
        <div style="font-size:16px; font-weight: bold; color:${textStrong};">${countLabel}</div>
        <div style="font-size:16px; font-weight: bold; color:${textStrong};">${countValue}</div>
      </div>
      <div>
        <div style="font-size:10px; color:${textMuted}; margin-bottom:8px; font-family:'Consolas';">// ${labelText}</div>
        <div style="display:flex; flex-wrap:wrap; margin-left:-4px;">
          ${sixStarDetails.length > 0 ? chipsHtml : emptyHtml}
        </div>
      </div>
    </div>
  `;
}

export function createRareRecordCard(dataMap, poolName) {
  const items = dataMap[poolName] || [];
  const currentType = getCurrentType();
  const allItems = Object.values(dataMap).flat();
  const sixStarDetails = calculateSixStarDetails(items, true, allItems);
  const labelText = (currentType === 'char') ? t('rare.recent6Char') : t('rare.recent6Weapon');

  renderRareRecordsCard({
    sixStarDetails,
    headerText: t('rare.targetPoolIdentified'),
    titleText: poolName,
    countLabel: t('rare.totalRecords'),
    countValue: items.length,
    labelText,
    getChipLabel: (item) => `${item.name} [${item.pityText}]`,
    getUpCharName: () => {
      const config = getGlobalPoolConfig();
      return config && config[poolName] ? config[poolName] : null;
    },
  });
}

export function createAllPoolsRareRecordsCard(items) {
  if (!items || !Array.isArray(items) || items.length === 0) items = [];
  const currentType = getCurrentType();
  const sixStarDetails = calculateSixStarDetails(items, true);
  const labelText = (currentType === 'char') ? t('rare.all6Char') : t('rare.all6Weapon');

  renderRareRecordsCard({
    sixStarDetails,
    headerText: t('rare.allPoolsAnalysis'),
    titleText: t('rare.allPoolsTitle'),
    countLabel: t('rare.total6Records'),
    countValue: sixStarDetails.length,
    labelText,
    getChipLabel: (item) => `${item.name} [${item.pityText}]`,
    getUpCharName: (item) => {
      const config = getGlobalPoolConfig();
      return config && config[item.poolName] ? config[item.poolName] : null;
    },
  });
}

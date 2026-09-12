import {
  CheckLocalFiles, LoadLocalGachaHistory, DeleteLocalGachaHistory, ImportTemporaryJson,
} from "../wailsjs/go/main/App";

import {
  setCurrentUid, setCurrentServerType, setGlobalCharData,
  setGlobalWeaponData, setCurrentType, setTempExportData,
} from './state.js';
import { SNACKBAR_AUTO_CLOSE } from './constants.js';
import { groupDataByPool } from './data.js';
import { renderByType, updateAllBtnText } from './render/main.js';
import { loadPoolConfig, updatePoolConfigHandler } from './pool.js';
import { showAppSnackbar, showLoadingState, setFetchingState, resetButton } from './utils.js';
import { t } from './i18n.js';

// 通过回调注入 startExitAnimation，避免与 main.js 循环依赖
let exitAnimator = null;
export function setExitAnimator(fn) {
  exitAnimator = fn;
}

// 离线分析文件
export async function loadLocal() {
  const btn = document.getElementById("localBtn");
  const originalText = btn.textContent;
  btn.textContent = t('login.status.scanning');
  btn.disabled = true;
  document.getElementById("analyzeError").textContent = "";
  try {
    const archives = await CheckLocalFiles();
    if (!archives || archives.length === 0) {
      throw t('login.error.noArchives');
    }
    if (archives.length === 1 && archives[0].servers.length === 1) {
      const targetArchive = archives[0];
      const targetServer = targetArchive.servers[0];
      const targetUid = targetArchive.uid;
      resetButton(btn, originalText);
      showLoadingState(t('login.status.loadingLocalArchive'), `UID: ${targetUid} // ${targetServer.toUpperCase()}`);
      await initApp(targetServer, targetUid);
      return;
    }
    renderLocalArchiveList(archives);
    document.getElementById("defaultBtnGroup").style.display = "none";
    document.getElementById("playerSelectArea").style.display = "block";
    const desc = document.querySelector("#playerSelectArea .analyze-important-desc");
    if (desc) desc.innerHTML = t('login.localArchiveFound') + "<br>" + t('login.selectDataSource');
    resetButton(btn, originalText);
  } catch (err) {
    console.error(err);
    resetButton(btn, originalText);
    document.getElementById("analyzeError").textContent = "ERR: " + err;
  }
}

// 渲染本地存档列表
export function renderLocalArchiveList(archives) {
  const container = document.getElementById("playerListContainer");
  container.innerHTML = "";
  archives.forEach(arc => {
    arc.servers.forEach(server => {
      const div = document.createElement("div");
      div.className = "player-card";
      let displayTime = arc.timestamp;
      if (displayTime.length > 10) displayTime = displayTime.replace("_", " ");

      div.innerHTML = `
        <div class="player-info">
          <span class="p-name">UID: ${arc.uid}</span>
          <span class="p-uid" style="color:#888;">DATE: ${displayTime}</span>
        </div>
        <div style="display:flex; align-items:center; gap:8px;">
          <div class="p-tag" style="border-color: ${server === 'official' ? 'var(--ef-yellow)' : '#23ade5'}; color: ${server === 'official' ? 'var(--ef-yellow)' : '#23ade5'}">
            ${server.toUpperCase()}
          </div>
          <div class="del-archive-btn" style="cursor: pointer; color: #888;" title="${t('archive.deleteTitle')}">×</div>
        </div>
      `;

      div.onclick = () => doLocalLoad(arc.uid, server);

      const deleteBtn = div.querySelector('.del-archive-btn');
      deleteBtn.onclick = (e) => {
        e.stopPropagation();

        const dialog = document.createElement('mdui-dialog');
        dialog.headline = t('dialog.confirmDeletion');
        dialog.description = t('dialog.deleteDesc', { uid: arc.uid, time: displayTime });
        dialog.innerHTML = `
          <mdui-button slot="action" variant="text" class="dialog-cancel-btn">
            ${t('dialog.cancel')}
          </mdui-button>
          <mdui-button slot="action" variant="tonal" class="dialog-confirm-btn" style="--mdui-comp-button-tonal-container-color: rgba(255, 82, 82, 0.1); --mdui-comp-button-tonal-label-text-color: #ff5252;">
            ${t('dialog.delete')}
          </mdui-button>
        `;
        document.body.appendChild(dialog);
        dialog.open = true;

        dialog.querySelector('.dialog-cancel-btn').onclick = () => {
          dialog.open = false;
        };

        dialog.querySelector('.dialog-confirm-btn').onclick = async () => {
          dialog.open = false;
          try {
            const folderName = `${arc.uid}_${arc.timestamp}`;
            await DeleteLocalGachaHistory(folderName);

            showAppSnackbar({
              message: t('snackbar.archiveDeleted'),
              type: "success"
            });

            await loadLocal();
          } catch (err) {
            console.error(err);
            showAppSnackbar({
              message: t('snackbar.deleteFailed') + err,
              type: "error",
              autoCloseDelay: SNACKBAR_AUTO_CLOSE,
            });
          }
        };

        dialog.addEventListener('closed', () => {
          setTimeout(() => dialog.remove(), 300);
        });
      };

      container.appendChild(div);
    });
  });
}

// 执行选中的本地加载
export async function doLocalLoad(uid, serverName) {
  document.getElementById("playerSelectArea").style.display = "none";
  setCurrentServerType(serverName);
  showLoadingState(t('login.status.loadingLocalDb'), `TARGET: UID ${uid} // ${serverName.toUpperCase()}`);
  try {
    await initApp(serverName, uid);
  } catch (err) {
    console.error(err);
    window.resetToAnalyze();
    document.getElementById("analyzeError").textContent = "LOAD ERR: " + err;
  }
}

// 临时导入浏览 (不落盘)
export async function handleImportTemp() {
  try {
    const res = await ImportTemporaryJson();
    showLoadingState(t('login.status.analyzingExternal'), `TYPE: ${res.type.toUpperCase()} // TEMPORARY VIEW`);
    let rawList = JSON.parse(res.jsonData);
    if (!Array.isArray(rawList)) {
      if (rawList.list) rawList = rawList.list;
      else rawList = [];
    }
    const groupedData = groupDataByPool(rawList);
    if (res.type === 'char') {
      setGlobalCharData(groupedData);
      setGlobalWeaponData({});
      setCurrentType('char');
    } else {
      setGlobalWeaponData(groupedData);
      setGlobalCharData({});
      setCurrentType('weapon');
    }
    setTempExportData({ type: res.type, jsonData: res.jsonData });
    setTimeout(async () => {
      const loadingText = document.querySelector('.loading-text');
      if (loadingText) loadingText.textContent = t('login.status.dataParsed');
      await loadPoolConfig();
      const btnChar = document.getElementById('btnTypeChar');
      const btnWeapon = document.getElementById('btnTypeWeapon');
      if (btnChar) btnChar.classList.toggle('active', res.type === 'char');
      if (btnWeapon) btnWeapon.classList.toggle('active', res.type === 'weapon');
      renderByType(res.type);
      updateAllBtnText();
      if (exitAnimator) exitAnimator();
    }, 600);
  } catch (err) {
    console.error(err);
    if (err && !err.toString().includes("cancelled")) {
      showAppSnackbar({
        message: t('snackbar.importFailed') + err,
        type: "error",
        autoCloseDelay: SNACKBAR_AUTO_CLOSE,
      });
    }
    window.resetToAnalyze();
  }
}

// 加载本地存档数据并渲染（uid 为空时读取当前 UID）
export async function initApp(serverName, uid) {
  setCurrentUid(uid);

  const loadingText = document.querySelector('.loading-text');
  loadingText.textContent = t('login.status.readingLocal');
  const dataStruct = await LoadLocalGachaHistory(uid, serverName);
  const charDataGrouped = dataStruct.char || {};
  const weaponDataGrouped = dataStruct.weapon || {};

  try {
    await updatePoolConfigHandler();
  } catch (err) {
    console.warn("Auto-update pool config failed:", err);
  }

  await loadPoolConfig();

  setGlobalCharData(charDataGrouped);
  setGlobalWeaponData(weaponDataGrouped);
  setTempExportData(null);
  loadingText.textContent = t('login.status.dataReceived');

  renderByType('char');
  updateAllBtnText();
  setFetchingState(false);
  if (exitAnimator) exitAnimator();
}

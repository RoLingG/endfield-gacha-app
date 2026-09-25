package main

import (
	"Go_Arknights_Gacha_App/internal/api"
	"Go_Arknights_Gacha_App/internal/auth"
	"Go_Arknights_Gacha_App/internal/export"
	"Go_Arknights_Gacha_App/internal/logger"
	"Go_Arknights_Gacha_App/internal/model"
	"Go_Arknights_Gacha_App/internal/storage"
	"Go_Arknights_Gacha_App/internal/update"
	"context"
	_ "embed"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	runtimeOs "runtime"
	"strings"
	"sync"
	"time"

	"github.com/energye/systray"
	wailsRuntime "github.com/wailsapp/wails/v2/pkg/runtime"
	"go.uber.org/zap"
)

// App struct
type App struct {
	ctx        context.Context
	cancelFunc context.CancelFunc
	mu         sync.Mutex
}

// NewApp creates a new App application struct
func NewApp() *App {
	return &App{}
}

func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
	a.appSystray()
}

func (a *App) startCancellableOperation() context.Context {
	a.mu.Lock()
	defer a.mu.Unlock()

	if a.cancelFunc != nil {
		a.cancelFunc()
	}
	ctx, cancel := context.WithCancel(a.ctx)
	a.cancelFunc = cancel
	return ctx
}

func (a *App) CancelCurrentOperation() {
	a.mu.Lock()
	defer a.mu.Unlock()

	if a.cancelFunc != nil {
		logger.Log.Info("User requested to cancel current operation")
		a.cancelFunc()
		a.cancelFunc = nil
	}
}

func (a *App) clearCancelFunc() {
	a.mu.Lock()
	defer a.mu.Unlock()
	a.cancelFunc = nil
}

// ================= Window Controls =================

func (a *App) ReloadFrontend() {
	wailsRuntime.WindowReload(a.ctx)
}

func (a *App) WindowMinSize() {
	wailsRuntime.WindowMinimise(a.ctx)
}

func (a *App) WindowToggleMaxSize() bool {
	isMax := wailsRuntime.WindowIsMaximised(a.ctx)
	if isMax {
		wailsRuntime.WindowUnmaximise(a.ctx)
	} else {
		wailsRuntime.WindowMaximise(a.ctx)
	}
	return isMax
}

func (a *App) WindowClose() {
	wailsRuntime.Quit(a.ctx)
}

// ================= File System Operations =================

// OpenDataFolder 打开存放 JSON 数据的文件夹
func (a *App) OpenDataFolder() {
	dir, err := storage.GetStorageDir()
	if err != nil {
		logger.Log.Error("Failed to get storage dir", zap.Error(err))
		return
	}
	logger.Log.Info("User requested to open data folder", zap.String("path", dir))

	var cmd *exec.Cmd
	switch runtimeOs.GOOS {
	case "windows":
		cmd = exec.Command("explorer", dir)
	case "darwin":
		cmd = exec.Command("open", dir)
	default: // linux
		cmd = exec.Command("xdg-open", dir)
	}

	if err := cmd.Start(); err != nil {
		logger.Log.Error("Failed to open folder explorer", zap.Error(err))
	}
}

// ExportData 导出数据为 Excel
func (a *App) ExportData(uid string, serverType string) (string, error) {
	logger.Log.Info("Frontend requested: ExportData", zap.String("uid", uid), zap.String("server", serverType))
	if uid == "" {
		return "", fmt.Errorf("UID 不能为空")
	}
	charList, err := storage.ReadData[model.EndFieldCharInfo](uid, serverType, model.PoolTypeChar)
	if err != nil {
		charList = []model.EndFieldCharInfo{}
	}
	weaponList, err := storage.ReadData[model.EndFieldWeaponInfo](uid, serverType, model.PoolTypeWeapon)
	if err != nil {
		weaponList = []model.EndFieldWeaponInfo{}
	}
	if len(charList) == 0 && len(weaponList) == 0 {
		return "", fmt.Errorf("当前没有任何数据可导出")
	}
	defaultName := fmt.Sprintf("endfield_data_%s_%s", uid, serverType)
	savePath, err := wailsRuntime.SaveFileDialog(a.ctx, wailsRuntime.SaveDialogOptions{
		Title:           "导出抽卡记录",
		DefaultFilename: defaultName,
		Filters: []wailsRuntime.FileFilter{
			{DisplayName: "Excel Files (*.xlsx)", Pattern: "*.xlsx"},
			{DisplayName: "CSV Files (*.csv)", Pattern: "*.csv"},
		},
	})
	if err != nil {
		logger.Log.Error("Failed to open save dialog", zap.Error(err))
		return "", err
	}
	if savePath == "" {
		return "cancelled", nil
	}

	var exportErr error
	if strings.HasSuffix(savePath, ".csv") {
		exportErr = export.SaveToCSV(savePath, charList, weaponList)
	} else {
		exportErr = export.SaveToExcel(savePath, charList, weaponList)
	}
	if exportErr != nil {
		logger.Log.Error("Export failed", zap.Error(exportErr))
		return "", fmt.Errorf("导出文件失败: %v", exportErr)
	}

	return "success", nil
}

func (a *App) ExportDataDirect(jsonData string, dataType string) (string, error) {
	logger.Log.Info("Frontend requested: ExportDataDirect", zap.String("dataType", dataType))
	if jsonData == "" {
		return "", fmt.Errorf("JSON 数据不能为空")
	}
	var charList []model.EndFieldCharInfo
	var weaponList []model.EndFieldWeaponInfo
	if dataType == "char" {
		charList = make([]model.EndFieldCharInfo, 0)
		if err := json.Unmarshal([]byte(jsonData), &charList); err != nil {
			return "", fmt.Errorf("JSON 数据解析失败: %v", err)
		}
	} else {
		weaponList = make([]model.EndFieldWeaponInfo, 0)
		if err := json.Unmarshal([]byte(jsonData), &weaponList); err != nil {
			return "", fmt.Errorf("JSON 数据解析失败: %v", err)
		}
	}
	if len(charList) == 0 && len(weaponList) == 0 {
		return "", fmt.Errorf("当前没有任何数据可导出")
	}
	defaultName := fmt.Sprintf("endfield_data_temp_%s", dataType)
	savePath, err := wailsRuntime.SaveFileDialog(a.ctx, wailsRuntime.SaveDialogOptions{
		Title:           "导出抽卡记录",
		DefaultFilename: defaultName,
		Filters: []wailsRuntime.FileFilter{
			{DisplayName: "Excel Files (*.xlsx)", Pattern: "*.xlsx"},
			{DisplayName: "CSV Files (*.csv)", Pattern: "*.csv"},
		},
	})
	if err != nil {
		logger.Log.Error("Failed to open save dialog", zap.Error(err))
		return "", err
	}
	if savePath == "" {
		return "cancelled", nil
	}

	var exportErr error
	if strings.HasSuffix(savePath, ".csv") {
		exportErr = export.SaveToCSV(savePath, charList, weaponList)
	} else {
		exportErr = export.SaveToExcel(savePath, charList, weaponList)
	}
	if exportErr != nil {
		logger.Log.Error("Export failed", zap.Error(exportErr))
		return "", fmt.Errorf("导出文件失败: %v", exportErr)
	}

	return "success", nil
}

// ================= Auth & Login =================

type LoginResponse struct {
	HgToken string                    `json:"hgToken"`
	Players []model.PlayerBindingInfo `json:"players"`
}

// LoginAndFetchPlayers 登录并获取绑定角色
func (a *App) LoginAndFetchPlayers(shortToken string) (LoginResponse, error) {
	logger.Log.Info("Frontend requested: LoginAndFetchPlayers")
	hgToken, err := api.GetGrantToken(shortToken)
	if err != nil {
		return LoginResponse{}, err
	}
	players, err := api.GetPlayerBindings(hgToken)
	if err != nil {
		return LoginResponse{}, err
	}
	return LoginResponse{
		HgToken: hgToken,
		Players: players,
	}, nil
}

// SyncDataByChoice 前端选好角色后，手动同步数据。
// fullSync 为 true 时跳过增量早停，强制全量抓取（官方分页行为变化导致增量漏抓时的手动兜底）。
func (a *App) SyncDataByChoice(hgToken string, uid string, serverType string, fullSync bool) (string, error) {
	logger.Log.Info("Frontend requested: SyncDataByChoice",
		zap.String("uid", uid), zap.String("server", serverType), zap.Bool("full_sync", fullSync))
	u8Token, err := api.GetU8Token(hgToken, uid)
	if err != nil {
		return "", err
	}
	return a.internalFetchAndSave(u8Token, "1", "zh-cn", uid, serverType, fullSync)
}

// internalFetchAndSave 内部同步逻辑。
// fullSync 为 true 时 knownSeqIDs 传 nil（即冷启动全量抓取路径），用于手动兜底。
func (a *App) internalFetchAndSave(token, serverID, lang string, uid string, serverType string, fullSync bool) (string, error) {
	ctx := a.startCancellableOperation()
	defer a.clearCancelFunc()

	wailsRuntime.EventsEmit(a.ctx, "fetch-progress", "正在抓取角色数据...")
	var charKnown map[string]struct{}
	if !fullSync {
		charKnown = storage.LoadKnownSeqIDs[model.EndFieldCharInfo](uid, serverType, model.PoolTypeChar)
	}
	charData, err := api.FetchCharDataAll(ctx, token, serverID, lang, charKnown)
	if err != nil {
		return "", fmt.Errorf("角色记录抓取失败: %v", err)
	}
	wailsRuntime.EventsEmit(a.ctx, "fetch-progress", fmt.Sprintf("已获取 %d 条角色记录，正在保存...", len(charData)))
	if _, err := storage.MergeAndSaveData(charData, uid, serverType, model.PoolTypeChar); err != nil {
		logger.Log.Warn("Character save warning", zap.Error(err))
	}

	wailsRuntime.EventsEmit(a.ctx, "fetch-progress", "正在抓取武器数据...")
	var weaponKnown map[string]struct{}
	if !fullSync {
		weaponKnown = storage.LoadKnownSeqIDs[model.EndFieldWeaponInfo](uid, serverType, model.PoolTypeWeapon)
	}
	weaponData, err := api.FetchWeaponDataAll(ctx, token, serverID, lang, weaponKnown)
	if err != nil {
		return "", fmt.Errorf("武器记录抓取失败: %v", err)
	}
	wailsRuntime.EventsEmit(a.ctx, "fetch-progress", fmt.Sprintf("已获取 %d 条武器记录，正在保存...", len(weaponData)))
	if _, err := storage.MergeAndSaveData(weaponData, uid, serverType, model.PoolTypeWeapon); err != nil {
		logger.Log.Warn("Weapon save warning", zap.Error(err))
	}

	wailsRuntime.EventsEmit(a.ctx, "fetch-progress", "数据同步完成！")
	return "success", nil
}

// ================= Offline / Local Data =================

type LocalDataResponse struct {
	Char   map[string][]model.EndFieldCharInfo   `json:"char"`
	Weapon map[string][]model.EndFieldWeaponInfo `json:"weapon"`
}

// CheckLocalFiles 检查本地文件是否存在
func (a *App) CheckLocalFiles() ([]model.LocalArchive, error) {
	logger.Log.Info("Frontend requested: CheckLocalFiles")
	archives, err := api.ScanLocalArchives()
	if err != nil {
		logger.Log.Error("Failed to scan local archives", zap.Error(err))
		return []model.LocalArchive{}, err
	}
	return archives, nil
}

// LoadLocalGachaHistory 读取本地历史数据
func (a *App) LoadLocalGachaHistory(uid string, serverType string) (LocalDataResponse, error) {
	logger.Log.Info("Frontend requested: LoadLocalGachaHistory",
		zap.String("uid", uid),
		zap.String("server", serverType),
	)
	if uid == "" {
		return LocalDataResponse{}, fmt.Errorf("读取本地历史数据失败：uid 不能为空")
	}
	charList, err := storage.ReadData[model.EndFieldCharInfo](uid, serverType, model.PoolTypeChar)
	if err != nil {
		logger.Log.Warn("Failed to read local char history, fallback to empty data",
			zap.String("uid", uid),
			zap.String("server", serverType),
			zap.Error(err),
		)
		charList = []model.EndFieldCharInfo{}
	}
	weaponList, err := storage.ReadData[model.EndFieldWeaponInfo](uid, serverType, model.PoolTypeWeapon)
	if err != nil {
		logger.Log.Warn("Failed to read local weapon history, fallback to empty data",
			zap.String("uid", uid),
			zap.String("server", serverType),
			zap.Error(err),
		)
		weaponList = []model.EndFieldWeaponInfo{}
	}

	charGrouped := make(map[string][]model.EndFieldCharInfo)
	if len(charList) > 0 {
		charGrouped = groupByPoolName(charList)
	}

	weaponGrouped := make(map[string][]model.EndFieldWeaponInfo)
	if len(weaponList) > 0 {
		weaponGrouped = groupByPoolName(weaponList)
	}

	return LocalDataResponse{
		Char:   charGrouped,
		Weapon: weaponGrouped,
	}, nil
}

func (a *App) DeleteLocalGachaHistory(folderName string) error {
	baseDir, err := storage.GetStorageDir()
	if err != nil {
		logger.Log.Error("Failed to get data directory", zap.Error(err))
		return fmt.Errorf("获取数据目录失败: %v", err)
	}
	targetDir := filepath.Join(baseDir, folderName)
	// 安全校验，防止越权删除（如传入 "../../windows"）
	if filepath.Base(targetDir) != folderName {
		return fmt.Errorf("非法目录路径: %v", folderName)
	}
	// 删除目标文件夹及其内部所有文件
	return os.RemoveAll(targetDir)
}

// OpenOfficialLoginWindow 用户输入自主登录官网获取 Token
func (a *App) OpenOfficialLoginWindow() (LoginResponse, error) {
	logger.Log.Info("Frontend requested: OpenOfficialLoginWindow")
	token, err := auth.OpenLoginWindow()
	if err != nil {
		logger.Log.Error("Login window closed or failed", zap.Error(err))
		return LoginResponse{}, err
	}
	logger.Log.Info("Token retrieved successfully", zap.Int("token_len", len(token)))
	hgToken, err := api.GetGrantToken(token)
	if err != nil {
		logger.Log.Error("Failed to exchange grant token", zap.Error(err))
		return LoginResponse{}, fmt.Errorf("hgToken 获取失败: %v", err)
	}
	logger.Log.Info("Grant Token exchanged successfully")
	players, err := api.GetPlayerBindings(hgToken)
	if err != nil {
		logger.Log.Error("Failed to fetch players with token", zap.Error(err))
		return LoginResponse{}, err
	}
	return LoginResponse{
		HgToken: hgToken,
		Players: players,
	}, nil
}

type ImportResponse struct {
	Type     string `json:"type"`     // "char" 或 "weapon"
	JsonData string `json:"jsonData"` // JSON 内容字符串
}

// ImportTemporaryJson 读取本地文件但不保存
func (a *App) ImportTemporaryJson() (ImportResponse, error) {
	selection, err := wailsRuntime.OpenFileDialog(a.ctx, wailsRuntime.OpenDialogOptions{
		Title: "临时导入数据",
		Filters: []wailsRuntime.FileFilter{
			{DisplayName: "JSON Files (*.json)", Pattern: "*.json"},
		},
	})
	if err != nil {
		return ImportResponse{}, err
	}
	if selection == "" {
		return ImportResponse{}, fmt.Errorf("cancelled")
	}
	fileContent, err := os.ReadFile(selection)
	if err != nil {
		return ImportResponse{}, fmt.Errorf("读取文件失败: %v", err)
	}
	contentStr := string(fileContent)
	isChar := false
	isWeapon := false
	if strings.Contains(contentStr, "\"charId\"") || strings.Contains(selection, "char") {
		isChar = true
	} else if strings.Contains(contentStr, "\"weaponId\"") || strings.Contains(selection, "weapon") {
		isWeapon = true
	}
	if isChar {
		return ImportResponse{
			Type:     "char",
			JsonData: contentStr,
		}, nil
	} else if isWeapon {
		return ImportResponse{
			Type:     "weapon",
			JsonData: contentStr,
		}, nil
	}
	return ImportResponse{}, fmt.Errorf("无法识别文件类型 (必须包含 char 或 weapon 数据)")
}

// ================= Pool Config Management =================

// UpdatePoolConfig 更新卡池配置（分别处理角色池和武器池）
func (a *App) UpdatePoolConfig() (string, error) {
	logger.Log.Info("Frontend requested: UpdatePoolConfig")

	// 从文件读取已发现的卡池ID列表
	discovered, err := storage.LoadDiscoveredPoolIDs()
	if err != nil {
		return "", fmt.Errorf("加载卡池ID列表失败: %v", err)
	}

	currentTime := time.Now().Format("2006-01-02 15:04:05")
	serverID := "1"
	lang := "zh-cn"

	// 已有介绍页的池不再重拉，只拉新池。
	var deadCharPoolIDs []string
	var deadWeaponPoolIDs []string
	knownPools := map[string]bool{} // 已落盘介绍页的池ID集合
	if existing, err := storage.LoadPoolConfig(); err == nil {
		for _, p := range existing.CharPools {
			if p.PoolID != "" {
				knownPools[p.PoolID] = true
			}
		}
		for _, p := range existing.WeaponPools {
			if p.PoolID != "" {
				knownPools[p.PoolID] = true
			}
		}
	}

	// --- 角色池处理 ---
	var charConfigs []model.PoolConfig
	for _, poolID := range discovered.CharPoolIDs {
		if poolID == "gachaPool_0" || poolID == "gachaPool_1" {
			continue
		}
		if knownPools[poolID] {
			continue
		}
		resp, err := api.FetchPoolContent(poolID, serverID, lang)
		if err != nil {
			logger.Log.Warn("Failed to fetch char pool content",
				zap.String("pool_id", poolID),
				zap.Error(err))
			if errors.Is(err, api.ErrPoolNotFound) {
				deadCharPoolIDs = append(deadCharPoolIDs, poolID)
			}
			continue
		}
		config := model.PoolConfig{
			PoolID:     poolID,
			PoolName:   resp.Data.Pool.PoolName,
			PoolType:   resp.Data.Pool.PoolType,
			Up6Name:    resp.Data.Pool.Up6Name,
			GachaType:  resp.Data.Pool.PoolGachaType,
			LastUpdate: currentTime,
		}
		if len(resp.Data.Pool.All) > 0 {
			for _, char := range resp.Data.Pool.All {
				if char.Rarity == 6 {
					config.Up6CharID = char.ID
					break
				}
			}
		}
		charConfigs = append(charConfigs, config)
		time.Sleep(200 * time.Millisecond)
	}

	// --- 武器池处理 ---
	var weaponConfigs []model.PoolConfig
	for _, poolID := range discovered.WeaponPoolIDs {
		if knownPools[poolID] {
			continue
		}
		resp, err := api.FetchPoolContent(poolID, serverID, lang)
		if err != nil {
			logger.Log.Warn("Failed to fetch weapon pool content",
				zap.String("pool_id", poolID),
				zap.Error(err))
			if errors.Is(err, api.ErrPoolNotFound) {
				deadWeaponPoolIDs = append(deadWeaponPoolIDs, poolID)
			}
			continue
		}
		config := model.PoolConfig{
			PoolID:     poolID,
			PoolName:   resp.Data.Pool.PoolName,
			PoolType:   resp.Data.Pool.PoolType,
			Up6Name:    resp.Data.Pool.Up6Name,
			GachaType:  resp.Data.Pool.PoolGachaType,
			LastUpdate: currentTime,
		}
		if len(resp.Data.Pool.All) > 0 {
			for _, item := range resp.Data.Pool.All {
				if item.Rarity == 6 {
					config.Up6WeaponID = item.ID
					break
				}
			}
		}
		weaponConfigs = append(weaponConfigs, config)
		time.Sleep(200 * time.Millisecond)
	}

	// 放在循环后而非循环内，避免边遍历边修改文件带来的不一致。
	if len(deadCharPoolIDs) > 0 {
		if err := storage.RemoveDiscoveredPoolIDs(deadCharPoolIDs, false); err != nil {
			logger.Log.Error("Failed to remove dead char pool IDs", zap.Error(err))
		}
	}
	if len(deadWeaponPoolIDs) > 0 {
		if err := storage.RemoveDiscoveredPoolIDs(deadWeaponPoolIDs, true); err != nil {
			logger.Log.Error("Failed to remove dead weapon pool IDs", zap.Error(err))
		}
	}

	if len(charConfigs) == 0 && len(weaponConfigs) == 0 {
		// 池配置已在本地，直接视为无变动返回，避免把正常增量同步误报为错误。
		logger.Log.Info("No new pool content fetched (all pools already known)",
			zap.Int("char_pools", len(charConfigs)),
			zap.Int("weapon_pools", len(weaponConfigs)))
		return "卡池配置无变动 / Pool config unchanged", nil
	}

	// 构建配置列表
	configList := model.PoolConfigList{
		CharPools:   charConfigs,
		WeaponPools: weaponConfigs,
		LastUpdate:  currentTime,
	}

	// 分别保存角色池和武器池配置
	msg, err := storage.SavePoolConfig(configList, false)
	if err != nil {
		logger.Log.Error("Failed to save char pool config", zap.Error(err))
		return "", err
	}

	msg2, err := storage.SavePoolConfig(configList, true)
	if err != nil {
		logger.Log.Error("Failed to save weapon pool config", zap.Error(err))
		return "", err
	}

	// 合并消息
	finalMsg := msg
	if msg2 != "卡池配置无变动 / Pool config unchanged" {
		if finalMsg == "卡池配置无变动 / Pool config unchanged" {
			finalMsg = msg2
		} else {
			finalMsg += "；" + msg2
		}
	}

	logger.Log.Info("Pool config updated successfully",
		zap.Int("char_pools", len(charConfigs)),
		zap.Int("weapon_pools", len(weaponConfigs)))

	return finalMsg, nil
}

// GetPoolConfig 获取卡池配置
func (a *App) GetPoolConfig() (*model.PoolConfigList, error) {
	logger.Log.Info("Frontend requested: GetPoolConfig")
	config, err := storage.LoadPoolConfig()
	if err != nil {
		logger.Log.Error("Failed to load pool config", zap.Error(err))
		return nil, err
	}
	return config, nil
}

// CheckUpdate 检测是否有新版本，检测失败时 HasUpdate 为 false
func (a *App) CheckUpdate() model.UpdateInfo {
	info := model.UpdateInfo{CurrentVersion: appVersion}
	if appVersion == "" {
		return info
	}
	result := update.Check(appVersion)
	info.LatestVersion = result.LatestVersion
	info.ReleaseURL = result.ReleaseURL
	info.HasUpdate = result.HasUpdate
	return info
}

// ================= Data Grouping Helpers =================

// groupByPoolName 将抽卡记录列表按卡池分组
// 复刻池同名但分多期（poolVersion），各期机制独立，故 key 追加 #期数以示区分，
// 普通池无 poolVersion 则保持原名
func groupByPoolName[T model.GachaItem](data []T) map[string][]T {
	grouped := make(map[string][]T)
	for _, item := range data {
		key := item.GetPoolName()
		if v := item.GetPoolVersion(); v > 0 {
			key = fmt.Sprintf("%s#%d", key, v)
		}
		grouped[key] = append(grouped[key], item)
	}
	return grouped
}

// ================= System Tray =================

//go:embed frontend/src/assets/icons/home.ico
var homeIcon []byte

//go:embed frontend/src/assets/icons/show.ico
var showIcon []byte

//go:embed frontend/src/assets/icons/hide.ico
var hideIcon []byte

//go:embed frontend/src/assets/icons/reload.ico
var reloadIcon []byte

//go:embed frontend/src/assets/icons/quit.ico
var quitIcon []byte

func (a *App) appSystray() {
	systray.Run(a.onReady, a.onExit)
}

func (a *App) onReady() {
	systray.SetIcon(homeIcon)
	systray.SetTitle("EndField Gacha History")
	systray.SetTooltip("EndField Gacha History")

	systray.SetOnClick(func(menu systray.IMenu) {
		wailsRuntime.Show(a.ctx)
	})

	showMenu := systray.AddMenuItem("显示", "Show the gacha app")
	showMenu.SetIcon(showIcon)
	showMenu.Click(func() {
		go wailsRuntime.Show(a.ctx)
	})

	hideMenu := systray.AddMenuItem("隐藏", "Hide the gacha app")
	hideMenu.SetIcon(hideIcon)
	hideMenu.Click(func() {
		go wailsRuntime.Hide(a.ctx)
	})

	reloadMenu := systray.AddMenuItem("重置", "Reload the gacha app")
	reloadMenu.SetIcon(reloadIcon)
	reloadMenu.Click(func() {
		go a.ReloadFrontend()
	})

	quitMenu := systray.AddMenuItem("退出", "Quit the gacha app")
	quitMenu.SetIcon(quitIcon)
	quitMenu.Click(func() {
		a.onExit()
	})
}

func (a *App) onExit() {
	systray.Quit()
	wailsRuntime.Quit(a.ctx)
}

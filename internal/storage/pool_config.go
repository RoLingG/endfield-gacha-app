package storage

import (
	"Go_Arknights_Gacha_App/internal/logger"
	"Go_Arknights_Gacha_App/internal/model"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"time"

	"go.uber.org/zap"
)

const poolConfigFileName = "pool_config.json"
const discoveredPoolIDsFileName = "discovered_pool_ids.json"
const poolConfigDirName = "poolConfig"

// getPoolConfigDir 获取卡池配置目录，不存在则创建
func getPoolConfigDir() (string, error) {
	dataDir, err := GetStorageDir()
	if err != nil {
		return "", err
	}
	poolConfigDir := filepath.Join(dataDir, poolConfigDirName)
	if err := os.MkdirAll(poolConfigDir, 0755); err != nil {
		return "", fmt.Errorf("创建poolconfig目录失败: %v", err)
	}
	return poolConfigDir, nil
}

// DiscoveredPoolIDs 已发现的卡池ID列表
type DiscoveredPoolIDs struct {
	CharPoolIDs   []string `json:"charPoolIds"`
	WeaponPoolIDs []string `json:"weaponPoolIds"`
	LastUpdate    string   `json:"lastUpdate"`
}

// SaveDiscoveredPoolIDs 保存发现的卡池ID
func SaveDiscoveredPoolIDs(poolIDs []string, isWeapon bool) error {
	// 先加载现有的
	existing, err := LoadDiscoveredPoolIDs()
	if err != nil {
		return fmt.Errorf("加载现有pool_id失败: %v", err)
	}

	// 根据类型选择对应的字段
	var existingIDs *[]string
	if isWeapon {
		existingIDs = &existing.WeaponPoolIDs
	} else {
		existingIDs = &existing.CharPoolIDs
	}

	// 构建现有 ID 集合
	existingSet := make(map[string]bool)
	for _, id := range *existingIDs {
		existingSet[id] = true
	}

	// 追加不重复的 pool_id
	addedCount := 0
	for _, id := range poolIDs {
		if !existingSet[id] {
			*existingIDs = append(*existingIDs, id)
			existingSet[id] = true
			addedCount++
		}
	}

	existing.LastUpdate = time.Now().Format(time.DateTime)

	if addedCount == 0 {
		return nil // 没有新增，不需要写入
	}

	poolConfigDir, err := getPoolConfigDir()
	if err != nil {
		return fmt.Errorf("获取配置目录失败: %v", err)
	}
	configPath := filepath.Join(poolConfigDir, discoveredPoolIDsFileName)

	data, err := json.MarshalIndent(existing, "", "  ")
	if err != nil {
		return fmt.Errorf("序列化失败: %v", err)
	}

	if err := os.WriteFile(configPath, data, 0644); err != nil {
		return fmt.Errorf("写入文件失败: %v", err)
	}

	poolType := "char"
	if isWeapon {
		poolType = "weapon"
	}
	logger.Log.Info("Discovered pool IDs saved",
		zap.String("type", poolType),
		zap.Int("total", len(*existingIDs)),
		zap.Int("new_added", addedCount))

	return nil
}

// RemoveDiscoveredPoolIDs 从 discovered_pool_ids.json 剔除指定卡池ID（死池清理）
// 仅应在 FetchPoolContent 明确返回 404/Pool not found（官方无开放此池数据）时调用
// 网络超时等临时错误不得调用，防止误杀活池，剔除后原子重写文件
func RemoveDiscoveredPoolIDs(poolIDs []string, isWeapon bool) error {
	// 先加载现有列表
	existing, err := LoadDiscoveredPoolIDs()
	if err != nil {
		return fmt.Errorf("加载现有pool_id失败: %v", err)
	}

	// 构建待剔除集合
	removeSet := make(map[string]bool, len(poolIDs))
	for _, id := range poolIDs {
		removeSet[id] = true
	}

	// 根据类型选择目标字段并过滤
	var target *[]string
	if isWeapon {
		target = &existing.WeaponPoolIDs
	} else {
		target = &existing.CharPoolIDs
	}
	originalLen := len(*target)
	filtered := make([]string, 0, originalLen)
	removedCount := 0
	for _, id := range *target {
		if removeSet[id] {
			removedCount++
			continue
		}
		filtered = append(filtered, id)
	}
	*target = filtered

	if removedCount == 0 {
		return nil // 没有可剔除项，不写文件
	}

	existing.LastUpdate = time.Now().Format(time.DateTime)

	poolConfigDir, err := getPoolConfigDir()
	if err != nil {
		return fmt.Errorf("获取配置目录失败: %v", err)
	}
	configPath := filepath.Join(poolConfigDir, discoveredPoolIDsFileName)

	data, err := json.MarshalIndent(existing, "", "  ")
	if err != nil {
		return fmt.Errorf("序列化失败: %v", err)
	}

	// 先写 .tmp 再 rename，避免写一半崩溃导致 ID 列表损坏
	tmpPath := configPath + ".tmp"
	if err := os.WriteFile(tmpPath, data, 0644); err != nil {
		return fmt.Errorf("写入临时文件失败: %v", err)
	}
	if err := os.Rename(tmpPath, configPath); err != nil {
		os.Remove(tmpPath)
		return fmt.Errorf("重命名文件失败: %v", err)
	}

	poolType := "char"
	if isWeapon {
		poolType = "weapon"
	}
	logger.Log.Info("Dead pool IDs removed",
		zap.String("type", poolType),
		zap.Int("removed", removedCount),
		zap.Int("remaining", len(*target)))

	return nil
}

// LoadDiscoveredPoolIDs 加载已发现的卡池ID列表
func LoadDiscoveredPoolIDs() (*DiscoveredPoolIDs, error) {
	poolConfigDir, err := getPoolConfigDir()
	if err != nil {
		return nil, fmt.Errorf("获取配置目录失败: %v", err)
	}
	configPath := filepath.Join(poolConfigDir, discoveredPoolIDsFileName)

	data, err := os.ReadFile(configPath)
	if err != nil {
		if os.IsNotExist(err) {
			return &DiscoveredPoolIDs{CharPoolIDs: []string{}, WeaponPoolIDs: []string{}}, nil
		}
		return nil, fmt.Errorf("读取文件失败: %v", err)
	}

	var result DiscoveredPoolIDs
	if err := json.Unmarshal(data, &result); err != nil {
		return nil, fmt.Errorf("解析文件失败: %v", err)
	}

	// 确保切片不为 nil
	if result.CharPoolIDs == nil {
		result.CharPoolIDs = []string{}
	}
	if result.WeaponPoolIDs == nil {
		result.WeaponPoolIDs = []string{}
	}

	return &result, nil
}

// SavePoolConfig 保存卡池配置到文件（追加写入，自动去重）
func SavePoolConfig(configList model.PoolConfigList, isWeapon bool) (string, error) {
	// 先加载现有配置
	existing, err := LoadPoolConfig()
	if err != nil {
		return "", fmt.Errorf("加载现有配置失败: %v", err)
	}

	// 根据类型选择对应的字段
	var existingPools *[]model.PoolConfig
	if isWeapon {
		existingPools = &existing.WeaponPools
	} else {
		existingPools = &existing.CharPools
	}

	// 构建现有卡池的去重键集合，用于快速查重
	// 优先用 PoolID，老数据 PoolID 为空串时回退按 PoolName 匹配
	existingKeys := make(map[string]bool)
	for _, pool := range *existingPools {
		key := pool.PoolID
		if key == "" {
			key = pool.PoolName
		}
		existingKeys[key] = true
	}

	// 根据类型选择对应的新卡池列表
	var newPools []model.PoolConfig
	if isWeapon {
		newPools = configList.WeaponPools
	} else {
		newPools = configList.CharPools
	}

	// 追加不重复的新卡池，去除重复键值
	// 优先 PoolID，老数据回退按 PoolName
	addedCount := 0
	for _, newPool := range newPools {
		key := newPool.PoolID
		if key == "" {
			key = newPool.PoolName
		}
		if !existingKeys[key] {
			*existingPools = append(*existingPools, newPool)
			existingKeys[key] = true
			addedCount++
		}
	}

	msg := fmt.Sprintf("卡池配置已更新 %d 项卡池数据 / Pool config updated", addedCount)
	if addedCount == 0 {
		msg = "卡池配置无变动 / Pool config unchanged"
	}

	// 更新时间戳
	if configList.LastUpdate != "" {
		existing.LastUpdate = configList.LastUpdate
	}

	poolConfigDir, err := getPoolConfigDir()
	if err != nil {
		return "", fmt.Errorf("获取配置目录失败: %v", err)
	}
	configPath := filepath.Join(poolConfigDir, poolConfigFileName)

	data, err := json.MarshalIndent(existing, "", "  ")
	if err != nil {
		return "", fmt.Errorf("序列化配置失败: %v", err)
	}

	if err := os.WriteFile(configPath, data, 0644); err != nil {
		return "", fmt.Errorf("写入配置文件失败: %v", err)
	}

	poolType := "char"
	if isWeapon {
		poolType = "weapon"
	}
	logger.Log.Info("Pool config saved successfully",
		zap.String("type", poolType),
		zap.String("path", configPath),
		zap.Int("total_pools", len(*existingPools)),
		zap.Int("new_pools_added", addedCount))

	return msg, nil
}

// LoadPoolConfig 加载卡池配置
func LoadPoolConfig() (*model.PoolConfigList, error) {
	poolConfigDir, err := getPoolConfigDir()
	if err != nil {
		return nil, fmt.Errorf("获取配置目录失败: %v", err)
	}
	configPath := filepath.Join(poolConfigDir, poolConfigFileName)

	data, err := os.ReadFile(configPath)
	if err != nil {
		if os.IsNotExist(err) {
			return &model.PoolConfigList{CharPools: []model.PoolConfig{}, WeaponPools: []model.PoolConfig{}}, nil
		}
		return nil, fmt.Errorf("读取配置文件失败: %v", err)
	}

	var configList model.PoolConfigList
	if err := json.Unmarshal(data, &configList); err != nil {
		return nil, fmt.Errorf("解析配置文件失败: %v", err)
	}

	// 确保切片不为 nil
	if configList.CharPools == nil {
		configList.CharPools = []model.PoolConfig{}
	}
	if configList.WeaponPools == nil {
		configList.WeaponPools = []model.PoolConfig{}
	}

	return &configList, nil
}

package model

import "strings"

const (
	ServerOfficial = "official"
	ServerBilibili = "bilibili"
	PoolTypeChar   = "char"
	PoolTypeWeapon = "weapon"
)

type GachaItem interface {
	GetSeqID() string
	GetGachaTime() string
	GetPoolName() string
	GetPoolVersion() int
	// IsStale 判断本地记录是否缺少必要字段。为 true 时该记录会被排除出增量早停集合，从而在下次同步时被重新拉取
	IsStale() bool
}

// isRerunPool 判断是否为复刻池，其 poolId 前缀为 rerun_chr_ / rerun_wpn_
func isRerunPool(poolID string) bool {
	return strings.HasPrefix(poolID, "rerun_chr_") || strings.HasPrefix(poolID, "rerun_wpn_")
}

type EndFieldCharInfo struct {
	Kind        string `json:"kind"`
	NameText    string `json:"nameText"`
	CharID      string `json:"charId"`
	CharName    string `json:"charName"`
	GachaTs     string `json:"gachaTs"`
	IsFree      bool   `json:"isFree"`
	IsNew       bool   `json:"isNew"`
	PoolID      string `json:"poolId"`
	PoolName    string `json:"poolName"`
	PoolVersion int    `json:"poolVersion,omitempty"` // 池的期数，用于区分同名复刻池的不同期
	Rarity      int    `json:"rarity"`
	SeqID       string `json:"seqId"`
}

func (c EndFieldCharInfo) GetSeqID() string     { return c.SeqID }
func (c EndFieldCharInfo) GetGachaTime() string { return c.GachaTs }
func (c EndFieldCharInfo) GetPoolName() string  { return c.PoolName }
func (c EndFieldCharInfo) GetPoolVersion() int  { return c.PoolVersion }

// IsStale 复刻池的记录必须带期数，其余池本就无此字段
func (c EndFieldCharInfo) IsStale() bool {
	return isRerunPool(c.PoolID) && c.PoolVersion == 0
}

type EndFieldCharData struct {
	List    []EndFieldCharInfo `json:"list"`
	HasMore bool               `json:"hasMore"`
}

type EndFieldGachaResponse struct {
	Code int              `json:"code"`
	Data EndFieldCharData `json:"data"`
	Msg  string           `json:"msg"`
}

type EndFieldWeaponInfo struct {
	PoolID      string `json:"poolId"`
	PoolName    string `json:"poolName"`
	PoolVersion int    `json:"poolVersion,omitempty"` // 池的期数，用于区分同名复刻池的不同期
	WeaponID    string `json:"weaponId"`
	WeaponName  string `json:"weaponName"`
	WeaponType  string `json:"weaponType"`
	Rarity      int    `json:"rarity"`
	IsNew       bool   `json:"isNew"`
	GachaTs     string `json:"gachaTs"`
	SeqID       string `json:"seqId"`
}

func (w EndFieldWeaponInfo) GetSeqID() string     { return w.SeqID }
func (w EndFieldWeaponInfo) GetGachaTime() string { return w.GachaTs }
func (w EndFieldWeaponInfo) GetPoolName() string  { return w.PoolName }
func (w EndFieldWeaponInfo) GetPoolVersion() int  { return w.PoolVersion }

// IsStale 复刻池的记录必须带期数，其余池本就无此字段
func (w EndFieldWeaponInfo) IsStale() bool {
	return isRerunPool(w.PoolID) && w.PoolVersion == 0
}

type EndFieldWeaponData struct {
	List    []EndFieldWeaponInfo `json:"list"`
	HasMore bool                 `json:"hasMore"`
}

type EndFieldWeaponResponse struct {
	Code int                `json:"code"`
	Data EndFieldWeaponData `json:"data"`
	Msg  string             `json:"msg"`
}

type EndFieldWeaponPoolResponse struct {
	Code int                  `json:"code"`
	Data []EndFieldWeaponPool `json:"data"`
	Msg  string               `json:"msg"`
}

type EndFieldWeaponPool struct {
	PoolID   string `json:"poolId"`
	PoolName string `json:"poolName"`
}

type PlayerBindingInfo struct {
	Uid         string `json:"uid"`
	NickName    string `json:"nickName"`
	Level       int    `json:"level"`
	ChannelName string `json:"channelName"`
	IsOfficial  bool   `json:"isOfficial"`
	ServerType  string `json:"serverType"` // "official" or "bilibili"
}

type U8TokenRequest struct {
	Token string `json:"token"`
	Uid   string `json:"uid"`
}

type U8TokenResponse struct {
	Status int    `json:"status"`
	Msg    string `json:"msg"`
	Data   struct {
		Token string `json:"token"`
	} `json:"data"`
}

type GrantRequest struct {
	AppCode string `json:"appCode"`
	Token   string `json:"token"`
	Type    int    `json:"type"`
}

type GrantResponse struct {
	Status int    `json:"status"`
	Msg    string `json:"msg"`
	Data   struct {
		Token string `json:"token"`
		HgId  string `json:"hgId"`
	} `json:"data"`
}

type BindingResponse struct {
	Status int    `json:"status"`
	Msg    string `json:"msg"`
	Data   struct {
		List []struct {
			AppCode     string `json:"appCode"`
			BindingList []struct {
				Uid         string `json:"uid"`
				IsOfficial  bool   `json:"isOfficial"`
				ChannelName string `json:"channelName"`
				Roles       []struct {
					RoleId   string `json:"roleId"`
					NickName string `json:"nickName"`
					Level    int    `json:"level"`
				} `json:"roles"`
			} `json:"bindingList"`
		} `json:"list"`
	} `json:"data"`
}

type LocalArchive struct {
	Uid       string   `json:"uid"`
	Timestamp string   `json:"timestamp"`
	Path      string   `json:"path"`
	Servers   []string `json:"servers"`
}

// CharPoolMetaResponse 卡池类型接口响应（/api/record/char/meta）
// 返回的是该玩家近期参与过的池类型，非官方全量清单
type CharPoolMetaResponse struct {
	Code int    `json:"code"`
	Msg  string `json:"msg"`
	Data struct {
		Tabs []struct {
			Key      string `json:"key"`
			Label    string `json:"label"`
			PoolType string `json:"poolType"`
		} `json:"tabs"`
		BeginnerPullCount int `json:"beginnerPullCount"`
	} `json:"data"`
}

// PoolContentResponse 卡池详情接口响应
type PoolContentResponse struct {
	Code int    `json:"code"`
	Msg  string `json:"msg"`
	Data struct {
		Pool struct {
			PoolGachaType string `json:"pool_gacha_type"`
			PoolName      string `json:"pool_name"`
			PoolType      string `json:"pool_type"`
			Up6Name       string `json:"up6_name"`
			Up6Image      string `json:"up6_image"`
			All           []struct {
				ID     string `json:"id"`
				Name   string `json:"name"`
				Rarity int    `json:"rarity"`
			} `json:"all"`
		} `json:"pool"`
	} `json:"data"`
}

// PoolConfig 卡池配置（用于前端）
type PoolConfig struct {
	PoolID      string `json:"poolId"`
	PoolName    string `json:"poolName"`
	PoolType    string `json:"poolType"`
	Up6Name     string `json:"up6Name"`
	Up6CharID   string `json:"up6CharId,omitempty"`
	Up6WeaponID string `json:"up6WeaponId,omitempty"`
	GachaType   string `json:"gachaType"`
	LastUpdate  string `json:"lastUpdate"`
}

// PoolConfigList 卡池配置列表
type PoolConfigList struct {
	CharPools   []PoolConfig `json:"charPools"`
	WeaponPools []PoolConfig `json:"weaponPools"`
	LastUpdate  string       `json:"lastUpdate"`
}

// UpdateInfo 版本更新检测结果
type UpdateInfo struct {
	CurrentVersion string `json:"currentVersion"`
	LatestVersion  string `json:"latestVersion"`
	ReleaseURL     string `json:"releaseUrl"`
	HasUpdate      bool   `json:"hasUpdate"`
}

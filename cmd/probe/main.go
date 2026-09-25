// 探针工具：请求官方接口并原样打印响应，用于排查接口行为
//
// 两种用法：
//
//  1. 按已接入的接口名调用（推荐，参数自动补齐）：
//     go run ./cmd/probe -endpoint char-meta -short-token <短token>
//     go run ./cmd/probe -endpoint char-record -short-token <短token> -pool-type Special
//     go run ./cmd/probe -endpoint content -pool-id special_1_5_1
//
//  2. 直接传 URL（用于尚未接入的接口）：
//     go run ./cmd/probe -url "https://ef-webview.hypergryph.com/api/xxx" -short-token <短token>
//
// token 可给短 token 由工具自动交换，也可用 -token 直接传 u8_token
package main

import (
	"bytes"
	"encoding/json"
	"flag"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"sort"
	"strings"
	"time"
)

const (
	appCodeEndfield = "endfield"
	appCodeLogin    = "be36d44aa36bfb5b"

	grantURL   = "https://as.hypergryph.com/user/oauth2/v2/grant"
	bindingURL = "https://binding-api-account-prod.hypergryph.com/account/binding/v1/binding_list"
	u8TokenURL = "https://binding-api-account-prod.hypergryph.com/account/binding/v1/u8_token_by_uid"

	webviewHost = "https://ef-webview.hypergryph.com"
)

var client = &http.Client{Timeout: 15 * time.Second}

// endpoint 描述一个可请求的接口
type endpoint struct {
	name     string   // 子命令名
	path     string   // 接口路径
	referer  string   // Referer 页面名
	needsTok bool     // 是否需要 token
	params   []string // 额外必填参数名（如 pool_id / pool_type）
	desc     string
	example  string   // 可直接复制的示例命令
}

var endpoints = []endpoint{
	{
		name: "char-meta", path: "/api/record/char/meta", referer: "gacha_char",
		needsTok: true,
		desc:     "角色池类型列表：返回该玩家近 90 天参与过的 poolType",
		example:  "-endpoint char-meta -short-token <短token>",
	},
	{
		name: "char-record", path: "/api/record/char", referer: "gacha_char",
		needsTok: true, params: []string{"pool_type"},
		desc:    "角色抽卡记录：pool_type 可用简称 Special/Rerun/Joint/Standard/Beginner",
		example: "-endpoint char-record -short-token <短token> -pool-type Special",
	},
	{
		name: "weapon-pool", path: "/api/record/weapon/pool", referer: "gacha_weapon",
		needsTok: true,
		desc:     "武器池列表：该账号参与过的池 ID 与池名",
		example:  "-endpoint weapon-pool -short-token <短token>",
	},
	{
		name: "weapon-record", path: "/api/record/weapon", referer: "gacha_weapon",
		needsTok: true, params: []string{"pool_id"},
		desc:    "武器抽卡记录：需 pool_id（可从 weapon-pool 接口获取）",
		example: "-endpoint weapon-record -short-token <短token> -pool-id rerun_wpn_yvonne",
	},
	{
		name: "content", path: "/api/content", referer: "",
		needsTok: false, params: []string{"pool_id"},
		desc:    "卡池详情：pool_type / up6_name / 全部可出物品，不需要 token",
		example: "-endpoint content -pool-id rerun_chr_yvonne",
	},
}

// poolIDExamples 常用 pool_id 示例，供帮助信息展示
var poolIDExamples = []struct{ id, desc string }{
	{"special_1_5_1", "角色限定池（冬猎）"},
	{"rerun_chr_yvonne", "角色复刻池（绚丽异彩）"},
	{"rerun_wpn_yvonne", "武器复刻池（点绘申领）"},
	{"joint_1_2_2", "角色联合寻访池（辉光庆典）"},
	{"standard", "角色基础寻访"},
	{"beginner", "角色启程寻访"},
	{"weaponbox_constant_1", "武器常驻池（坚冰申领）"},
	{"weponbox_1_5_1", "武器限定池（幽寒申领，注意官方拼写 wepon）"},
}

const poolTypePrefix = "E_CharacterGachaPoolType_"

func main() {
	rawURL := flag.String("url", "", "直接指定完整接口地址（用于尚未接入的接口，与 -endpoint 二选一）")
	endpointName := flag.String("endpoint", "", "接口名称，留空且未传 -url 时列出全部")
	shortToken := flag.String("short-token", "", "短 token，工具自动换取 u8_token")
	token := flag.String("token", "", "u8_token（与 -short-token 二选一）")
	uid := flag.String("uid", "", "指定 uid（账号下有多个角色时）")
	index := flag.Int("index", 0, "多个角色时选第几个（0 起）")
	serverID := flag.String("server", "1", "server_id")
	lang := flag.String("lang", "zh-cn", "lang")
	poolID := flag.String("pool-id", "", "池 ID（content / weapon-record 需要）")
	poolType := flag.String("pool-type", "", "池类型简称或完整枚举名（char-record 需要）")
	seqID := flag.String("seq_id", "", "分页游标")
	refererPage := flag.String("referer", "", "Referer 页面名，默认按接口推断，传 empty 则不发送")
	raw := flag.Bool("raw", false, "只打印原始响应体")
	showHelp := flag.Bool("h", false, "查看帮助")
	flag.BoolVar(showHelp, "help", false, "查看帮助")
	flag.Usage = printEndpointList
	flag.Parse()

	// -h / --help：打印完整帮助后退出
	if *showHelp {
		printEndpointList()
		return
	}

	var ep *endpoint
	if *rawURL == "" {
		ep = findEndpoint(*endpointName)
		if ep == nil {
			printEndpointList()
			if *endpointName != "" {
				fmt.Fprintf(os.Stderr, "\n未知接口: %s\n", *endpointName)
				os.Exit(1)
			}
			return
		}
	}
	// -url 模式不预设接口，token 视为可选（部分接口如 /api/content 不需要）
	needsToken := ep != nil && ep.needsTok
	if needsToken && *token == "" && *shortToken == "" {
		fmt.Fprintln(os.Stderr, "错误：该接口需要 token，请提供 -short-token 或 -token")
		os.Exit(1)
	}

	// 组装查询参数
	values := map[string]string{"lang": *lang}
	if *shortToken != "" && *token == "" {
		// 给了短 token 就换取，无论接口是否要求
		got, err := exchangeU8Token(*shortToken, *uid, *index)
		if err != nil {
			fmt.Fprintln(os.Stderr, "换取 u8_token 失败:", err)
			os.Exit(1)
		}
		values["token"] = got
	} else if *token != "" {
		values["token"] = *token
	}
	values["server_id"] = *serverID

	// 目标地址：-url 优先，否则按接口定义拼接
	targetURL := *rawURL
	referer := *refererPage
	if ep != nil {
		targetURL = webviewHost + ep.path
		if referer == "" {
			referer = ep.referer
		}
		if err := fillExtraParams(ep, values, *poolID, *poolType, *seqID); err != nil {
			fmt.Fprintln(os.Stderr, "参数错误:", err)
			if ep.name == "char-record" {
				fmt.Fprintln(os.Stderr, "  提示：-pool-type 可传 Special / Rerun / Joint / Standard / Beginner")
			}
			os.Exit(1)
		}
	} else {
		// -url 模式：不预设必填项，但显式传入的参数照常附加
		if *poolID != "" {
			values["pool_id"] = *poolID
		}
		if *poolType != "" {
			values["pool_type"] = normalizePoolType(*poolType)
		}
		if *seqID != "" {
			values["seq_id"] = *seqID
		}
	}

	// 构造并发送请求
	reqURL := targetURL + "?" + encodeValues(values)
	req, err := http.NewRequest("GET", reqURL, nil)
	if err != nil {
		fmt.Fprintln(os.Stderr, "构造请求失败:", err)
		os.Exit(1)
	}
	if referer != "" {
		refParams := url.Values{}
		refParams.Set("u8_token", values["token"])
		refParams.Set("server", *serverID)
		refParams.Set("lang", *lang)
		req.Header.Set("Referer",
			fmt.Sprintf("%s/page/%s?%s", webviewHost, referer, refParams.Encode()))
	}

	label := *endpointName
	if ep == nil {
		label = "url"
	}
	fmt.Printf("=== 请求 [%s] ===\n", label)
	fmt.Println("GET", maskSecrets(reqURL))
	if ref := req.Header.Get("Referer"); ref != "" {
		fmt.Println("Referer:", maskSecrets(ref))
	}
	fmt.Println()

	start := time.Now()
	resp, err := client.Do(req)
	if err != nil {
		fmt.Fprintln(os.Stderr, "请求失败:", err)
		os.Exit(1)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		fmt.Fprintln(os.Stderr, "读取响应失败:", err)
		os.Exit(1)
	}

	fmt.Println("=== 响应 ===")
	fmt.Printf("状态码: %d    耗时: %dms    长度: %d bytes\n\n",
		resp.StatusCode, time.Since(start).Milliseconds(), len(body))

	outputBody(body, *raw)
}

// fillExtraParams 按接口要求补齐必填参数
func fillExtraParams(ep *endpoint, values map[string]string, poolID, poolType, seqID string) error {
	for _, p := range ep.params {
		switch p {
		case "pool_id":
			if poolID == "" {
				return fmt.Errorf("该接口需要 -pool-id，例如 -pool-id special_1_5_1")
			}
			values["pool_id"] = poolID
		case "pool_type":
			if poolType == "" {
				return fmt.Errorf("该接口需要 -pool-type")
			}
			values["pool_type"] = normalizePoolType(poolType)
		}
	}
	if seqID != "" {
		values["seq_id"] = seqID
	}
	return nil
}

// normalizePoolType 允许传简称（Special）或完整枚举名（E_CharacterGachaPoolType_Special）
func normalizePoolType(v string) string {
	if strings.HasPrefix(v, poolTypePrefix) {
		return v
	}
	return poolTypePrefix + strings.ToUpper(v[:1]) + strings.ToLower(v[1:])
}

func findEndpoint(name string) *endpoint {
	if name == "" {
		return nil
	}
	for i := range endpoints {
		if endpoints[i].name == name {
			return &endpoints[i]
		}
	}
	return nil
}

// printEndpointList 打印完整帮助：接口清单 + 参数 + 示例 + 常用 pool_id
func printEndpointList() {
	fmt.Println("接口探针工具 —— 直接请求官方接口并打印响应")
	fmt.Println()
	fmt.Println("用法：")
	fmt.Println("  go run ./cmd/probe -endpoint <名称> [选项]     按接口名调用（推荐）")
	fmt.Println("  go run ./cmd/probe -url <完整地址> [选项]      请求任意接口")
	fmt.Println("  go run ./cmd/probe -h                          查看本帮助")
	fmt.Println()

	fmt.Println("已接入的接口：")
	fmt.Println()
	names := make([]string, 0, len(endpoints))
	byName := map[string]endpoint{}
	for _, e := range endpoints {
		names = append(names, e.name)
		byName[e.name] = e
	}
	sort.Strings(names)
	for _, n := range names {
		e := byName[n]
		fmt.Printf("  ● %s\n", e.name)
		fmt.Printf("      %s\n", e.desc)
		fmt.Printf("      %s%s\n", tokenHint(e.needsTok), paramHint(e.params))
		fmt.Printf("      示例： go run ./cmd/probe %s\n", e.example)
		fmt.Println()
	}

	fmt.Println("token 参数：")
	fmt.Println("  -short-token <短token>   推荐。工具自动完成 短token → hgToken → uid → u8_token 的交换")
	fmt.Println("  -token <u8_token>        直接传 u8_token（有时效，过期会返回 Token is invalid）")
	fmt.Println("  短 token 获取方式与应用内一致：登录官网后从浏览器 localStorage 取 u8_token 的值")
	fmt.Println()

	fmt.Println("其他参数：")
	fmt.Println("  -pool-id <池ID>          卡池详情与武器记录需要")
	fmt.Println("  -pool-type <类型>        角色记录需要，可传简称 Special/Rerun/Joint/Standard/Beginner")
	fmt.Println("  -referer <页面名>        -url 模式下指定 Referer，如 gacha_char / gacha_weapon")
	fmt.Println("  -uid / -index            账号下有多个角色时选择，默认第 0 个")
	fmt.Println("  -server / -lang          默认 1 / zh-cn")
	fmt.Println("  -seq_id <游标>           分页游标")
	fmt.Println("  -raw                     只打印原始响应体，不格式化 JSON")
	fmt.Println()

	fmt.Println("常用 pool_id：")
	for _, p := range poolIDExamples {
		fmt.Printf("  %-22s %s\n", p.id, p.desc)
	}
	fmt.Println()

	fmt.Println("示例：")
	fmt.Println("  # 查看账号参与过的池类型（最常用）")
	fmt.Println("  go run ./cmd/probe -endpoint char-meta -short-token <短token>")
	fmt.Println()
	fmt.Println("  # 角色复刻池详情（不需要 token）")
	fmt.Println("  go run ./cmd/probe -endpoint content -pool-id rerun_chr_yvonne")
	fmt.Println()
	fmt.Println("  # 武器复刻池详情")
	fmt.Println("  go run ./cmd/probe -endpoint content -pool-id rerun_wpn_yvonne")
	fmt.Println()
	fmt.Println("  # 角色复刻池的抽卡记录")
	fmt.Println("  go run ./cmd/probe -endpoint char-record -short-token <短token> -pool-type Rerun")
}

func tokenHint(needs bool) string {
	if needs {
		return "需 token　"
	}
	return "无需 token　"
}

func paramHint(params []string) string {
	if len(params) == 0 {
		return ""
	}
	return "必填：" + strings.Join(params, ", ")
}

// outputBody 打印响应体，默认尝试格式化 JSON
func outputBody(body []byte, raw bool) {
	if raw {
		fmt.Println(string(body))
		return
	}
	var pretty any
	if err := json.Unmarshal(body, &pretty); err != nil {
		fmt.Println("(响应不是合法 JSON，原样输出)")
		fmt.Println(string(body))
		return
	}
	formatted, _ := json.MarshalIndent(pretty, "", "  ")
	fmt.Println(string(formatted))
}

// encodeValues 按 key 字母序拼接查询串，与 Go 的 url.Values.Encode 行为一致
func encodeValues(values map[string]string) string {
	v := url.Values{}
	for k, val := range values {
		if val != "" {
			v.Set(k, val)
		}
	}
	return v.Encode()
}

// ================= Token 交换（与应用内逻辑一致） =================

func exchangeU8Token(shortToken, wantUID string, index int) (string, error) {
	hgToken, err := getGrantToken(shortToken)
	if err != nil {
		return "", fmt.Errorf("换取 hgToken 失败: %w", err)
	}
	fmt.Println("=== 已换取 hgToken ===")
	fmt.Printf("  hgToken: %s\n", maskValue(hgToken))

	players, err := getPlayerBindings(hgToken)
	if err != nil {
		return "", fmt.Errorf("获取角色列表失败: %w", err)
	}
	fmt.Println("=== 账号下的角色 ===")
	for i, p := range players {
		fmt.Printf("  [%d] uid=%s  %s  Lv.%d  %s\n", i, p.Uid, p.NickName, p.Level, p.ServerType)
	}

	target := wantUID
	if target == "" {
		if index < 0 || index >= len(players) {
			return "", fmt.Errorf("index %d 超出范围（共 %d 个角色）", index, len(players))
		}
		target = players[index].Uid
	}
	fmt.Printf("→ 选用 uid=%s\n", target)

	u8, err := getU8Token(hgToken, target)
	if err != nil {
		return "", fmt.Errorf("换取 u8_token 失败: %w", err)
	}
	fmt.Printf("=== 已换取 u8_token ===\n  %s\n\n", maskValue(u8))
	return u8, nil
}

type playerInfo struct {
	Uid        string
	NickName   string
	Level      int
	ServerType string
}

func getGrantToken(shortToken string) (string, error) {
	body, _ := json.Marshal(map[string]any{
		"appCode": appCodeLogin,
		"token":   shortToken,
		"type":    1,
	})
	resp, err := postJSON(grantURL, body)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("HTTP %d", resp.StatusCode)
	}
	var result struct {
		Status int    `json:"status"`
		Msg    string `json:"msg"`
		Data   struct {
			Token string `json:"token"`
		} `json:"data"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return "", err
	}
	if result.Status != 0 {
		return "", fmt.Errorf("%s", result.Msg)
	}
	if result.Data.Token == "" {
		return "", fmt.Errorf("响应中无 token")
	}
	return result.Data.Token, nil
}

func getPlayerBindings(hgToken string) ([]playerInfo, error) {
	params := url.Values{}
	params.Add("token", hgToken)
	params.Add("appCode", appCodeEndfield)
	resp, err := client.Get(bindingURL + "?" + params.Encode())
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("HTTP %d", resp.StatusCode)
	}

	var result struct {
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
						NickName string `json:"nickName"`
						Level    int    `json:"level"`
					} `json:"roles"`
				} `json:"bindingList"`
			} `json:"list"`
		} `json:"data"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, err
	}
	if result.Status != 0 {
		return nil, fmt.Errorf("%s", result.Msg)
	}

	var players []playerInfo
	for _, app := range result.Data.List {
		if app.AppCode != appCodeEndfield {
			continue
		}
		for _, b := range app.BindingList {
			nick, level := "未知博士", 0
			if len(b.Roles) > 0 {
				nick, level = b.Roles[0].NickName, b.Roles[0].Level
			}
			serverType := "unknown"
			if b.IsOfficial {
				serverType = "official"
			} else if b.ChannelName == "bilibili服" {
				serverType = "bilibili"
			}
			players = append(players, playerInfo{Uid: b.Uid, NickName: nick, Level: level, ServerType: serverType})
		}
	}
	if len(players) == 0 {
		return nil, fmt.Errorf("该账号下未找到终末地的角色信息")
	}
	return players, nil
}

func getU8Token(hgToken, uid string) (string, error) {
	body, _ := json.Marshal(map[string]string{"token": hgToken, "uid": uid})
	resp, err := postJSON(u8TokenURL, body)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("HTTP %d", resp.StatusCode)
	}
	var result struct {
		Status int    `json:"status"`
		Msg    string `json:"msg"`
		Data   struct {
			Token string `json:"token"`
		} `json:"data"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return "", err
	}
	if result.Status != 0 {
		return "", fmt.Errorf("%s", result.Msg)
	}
	if result.Data.Token == "" {
		return "", fmt.Errorf("响应中无 token")
	}
	return result.Data.Token, nil
}

func postJSON(targetURL string, body []byte) (*http.Response, error) {
	req, err := http.NewRequest("POST", targetURL, bytes.NewBuffer(body))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")
	return client.Do(req)
}

// ================= 脱敏 =================

// maskSecrets 把 URL 查询串里的 token 值替换为 ***
func maskSecrets(s string) string {
	out := s
	for _, key := range []string{"token=", "u8_token="} {
		idx := strings.Index(out, key)
		if idx < 0 {
			continue
		}
		start := idx + len(key)
		end := strings.IndexAny(out[start:], "&")
		if end < 0 {
			out = out[:start] + "***"
		} else {
			out = out[:start] + "***" + out[start+end:]
		}
	}
	return out
}

// maskValue 保留首尾各 4 字符，其余打码
func maskValue(v string) string {
	if len(v) <= 12 {
		return "***"
	}
	return v[:4] + "..." + v[len(v)-4:]
}

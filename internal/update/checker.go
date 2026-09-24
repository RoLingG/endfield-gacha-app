package update

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"Go_Arknights_Gacha_App/internal/logger"

	"go.uber.org/zap"
)

const (
	repoSlug = "RoLingG/endfield-gacha-app"

	releaseAPIURL  = "https://api.github.com/repos/" + repoSlug + "/releases/latest"
	releasePageURL = "https://github.com/" + repoSlug + "/releases/latest"
)

// Result 更新检测结果
type Result struct {
	LatestVersion string
	ReleaseURL    string
	HasUpdate     bool
}

var checkClient = &http.Client{Timeout: 8 * time.Second}

// Check 检测是否有新版本，任何失败均返回 HasUpdate=false，不打扰用户
func Check(current string) Result {
	latest, url, err := fetchViaAPI()
	if err != nil {
		logger.Log.Debug("Release API unavailable, falling back to redirect", zap.Error(err))
		latest, url, err = fetchViaRedirect()
		if err != nil {
			logger.Log.Debug("Update check failed", zap.Error(err))
			return Result{}
		}
	}
	if latest == "" {
		return Result{}
	}
	return Result{
		LatestVersion: latest,
		ReleaseURL:    url,
		HasUpdate:     IsNewer(latest, current),
	}
}

// fetchViaAPI 走 GitHub 官方 API，响应最快且能直接拿到 Release 页地址
func fetchViaAPI() (string, string, error) {
	req, err := http.NewRequest("GET", releaseAPIURL, nil)
	if err != nil {
		return "", "", err
	}
	// GitHub API 要求携带 User-Agent
	req.Header.Set("User-Agent", "EndfieldGacha-App")
	req.Header.Set("Accept", "application/vnd.github+json")

	resp, err := checkClient.Do(req)
	if err != nil {
		return "", "", err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return "", "", fmt.Errorf("API status: %d", resp.StatusCode)
	}

	var payload struct {
		TagName string `json:"tag_name"`
		HTMLURL string `json:"html_url"`
	}
	if err := json.NewDecoder(io.LimitReader(resp.Body, 1<<20)).Decode(&payload); err != nil {
		return "", "", err
	}
	if payload.TagName == "" {
		return "", "", fmt.Errorf("empty tag_name")
	}
	return payload.TagName, payload.HTMLURL, nil
}

// fetchViaRedirect 读 /releases/latest 的 302 Location，作为 API 不可用时的兜底，该地址不受 API 速率限制约束
func fetchViaRedirect() (string, string, error) {
	// 不跟随重定向，才能从 Location 头取到实际 tag
	client := &http.Client{
		Timeout: 8 * time.Second,
		CheckRedirect: func(req *http.Request, via []*http.Request) error {
			return http.ErrUseLastResponse
		},
	}
	req, err := http.NewRequest("GET", releasePageURL, nil)
	if err != nil {
		return "", "", err
	}
	req.Header.Set("User-Agent", "EndfieldGacha-App")

	resp, err := client.Do(req)
	if err != nil {
		return "", "", err
	}
	defer resp.Body.Close()

	loc := resp.Header.Get("Location")
	if loc == "" {
		return "", "", fmt.Errorf("no Location header, status: %d", resp.StatusCode)
	}
	// Location 形如 https://github.com/.../releases/tag/v1.8.0
	idx := strings.LastIndex(loc, "/tag/")
	if idx < 0 {
		return "", "", fmt.Errorf("unexpected Location: %s", loc)
	}
	return loc[idx+len("/tag/"):], loc, nil
}

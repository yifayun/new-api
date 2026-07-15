package ratio_setting

import (
	"encoding/json"
	"errors"
	"fmt"
	"strconv"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting/config"
	"github.com/QuantumNous/new-api/types"
)

var defaultGroupRatio = map[string]float64{
	"default": 1,
	"vip":     1,
	"svip":    1,
}

var groupRatioMap = types.NewRWMap[string, float64]()

var defaultGroupGroupRatio = map[string]map[string]float64{
	"vip": {
		"edit_this": 0.9,
	},
}

var groupGroupRatioMap = types.NewRWMap[string, map[string]float64]()

var defaultGroupVisibleUsers = map[string][]int{}

var groupVisibleUsersMap = types.NewRWMap[string, []int]()

var defaultGroupSpecialUsableGroup = map[string]map[string]string{
	"vip": {
		"append_1":   "vip_special_group_1",
		"-:remove_1": "vip_removed_group_1",
	},
}

type GroupRatioSetting struct {
	GroupRatio              *types.RWMap[string, float64]            `json:"group_ratio"`
	GroupGroupRatio         *types.RWMap[string, map[string]float64] `json:"group_group_ratio"`
	GroupSpecialUsableGroup *types.RWMap[string, map[string]string]  `json:"group_special_usable_group"`
	GroupVisibleUsers       *types.RWMap[string, []int]              `json:"group_visible_users"`
}

var groupRatioSetting GroupRatioSetting

func init() {
	groupSpecialUsableGroup := types.NewRWMap[string, map[string]string]()
	groupSpecialUsableGroup.AddAll(defaultGroupSpecialUsableGroup)

	groupRatioMap.AddAll(defaultGroupRatio)
	groupGroupRatioMap.AddAll(defaultGroupGroupRatio)
	groupVisibleUsersMap.AddAll(defaultGroupVisibleUsers)

	groupRatioSetting = GroupRatioSetting{
		GroupSpecialUsableGroup: groupSpecialUsableGroup,
		GroupRatio:              groupRatioMap,
		GroupGroupRatio:         groupGroupRatioMap,
		GroupVisibleUsers:       groupVisibleUsersMap,
	}

	config.GlobalConfig.Register("group_ratio_setting", &groupRatioSetting)
}

func GetGroupRatioSetting() *GroupRatioSetting {
	if groupRatioSetting.GroupSpecialUsableGroup == nil {
		groupRatioSetting.GroupSpecialUsableGroup = types.NewRWMap[string, map[string]string]()
		groupRatioSetting.GroupSpecialUsableGroup.AddAll(defaultGroupSpecialUsableGroup)
	}
	if groupRatioSetting.GroupVisibleUsers == nil {
		groupRatioSetting.GroupVisibleUsers = types.NewRWMap[string, []int]()
		groupRatioSetting.GroupVisibleUsers.AddAll(defaultGroupVisibleUsers)
	}
	return &groupRatioSetting
}

func GetGroupRatioCopy() map[string]float64 {
	return groupRatioMap.ReadAll()
}

func ContainsGroupRatio(name string) bool {
	_, ok := groupRatioMap.Get(name)
	return ok
}

func GroupRatio2JSONString() string {
	return groupRatioMap.MarshalJSONString()
}

func UpdateGroupRatioByJSONString(jsonStr string) error {
	raw := make(map[string]interface{})
	if err := json.Unmarshal([]byte(jsonStr), &raw); err != nil {
		return err
	}
	next := make(map[string]float64)
	for name, value := range raw {
		// 兼容原有格式：{"default":1}
		if n, ok := asFloat64(value); ok {
			next[name] = n
			continue
		}
		// 兼容扩展格式：{"default":{"ratio":1,"enabled":true}}
		obj, ok := value.(map[string]interface{})
		if !ok {
			return fmt.Errorf("invalid group ratio value for %s", name)
		}
		enabled := true
		if v, exists := obj["enabled"]; exists {
			b, ok := v.(bool)
			if !ok {
				return fmt.Errorf("invalid enabled field for %s", name)
			}
			enabled = b
		}
		if !enabled {
			continue
		}
		ratioRaw, exists := obj["ratio"]
		if !exists {
			ratioRaw, exists = obj["value"]
		}
		if !exists {
			ratioRaw, exists = obj["multiplier"]
		}
		if !exists {
			return fmt.Errorf("missing ratio field for %s", name)
		}
		r, ok := asFloat64(ratioRaw)
		if !ok {
			return fmt.Errorf("invalid ratio field for %s", name)
		}
		next[name] = r
	}
	groupRatioMap.Clear()
	groupRatioMap.AddAll(next)
	return nil
}

func GetGroupRatio(name string) float64 {
	ratio, ok := groupRatioMap.Get(name)
	if !ok {
		common.SysLog("group ratio not found: " + name)
		return 1
	}
	return ratio
}

func GetGroupGroupRatio(userGroup, usingGroup string) (float64, bool) {
	gp, ok := groupGroupRatioMap.Get(userGroup)
	if !ok {
		return -1, false
	}
	ratio, ok := gp[usingGroup]
	if !ok {
		return -1, false
	}
	return ratio, true
}

func GroupGroupRatio2JSONString() string {
	return groupGroupRatioMap.MarshalJSONString()
}

func GroupVisibleUsers2JSONString() string {
	return GetGroupRatioSetting().GroupVisibleUsers.MarshalJSONString()
}

func UpdateGroupGroupRatioByJSONString(jsonStr string) error {
	return types.LoadFromJsonString(groupGroupRatioMap, jsonStr)
}

func UpdateGroupVisibleUsersByJSONString(jsonStr string) error {
	raw := make(map[string]interface{})
	if err := json.Unmarshal([]byte(jsonStr), &raw); err != nil {
		return err
	}
	next := make(map[string][]int)
	for groupName, value := range raw {
		// 兼容扩展格式：{"vip":{"enabled":true,"users":[1,2]}}
		if obj, ok := value.(map[string]interface{}); ok {
			enabled := true
			if v, exists := obj["enabled"]; exists {
				b, ok := v.(bool)
				if !ok {
					return fmt.Errorf("invalid enabled field for %s", groupName)
				}
				enabled = b
			}
			if !enabled {
				continue
			}
			usersRaw := obj["users"]
			if usersRaw == nil {
				usersRaw = obj["user_ids"]
			}
			if usersRaw == nil {
				return fmt.Errorf("missing users field for %s", groupName)
			}
			userIDs, err := parseUserIDs(usersRaw)
			if err != nil {
				return fmt.Errorf("invalid users for %s: %w", groupName, err)
			}
			next[groupName] = userIDs
			continue
		}
		userIDs, err := parseUserIDs(value)
		if err != nil {
			return fmt.Errorf("invalid users for %s: %w", groupName, err)
		}
		next[groupName] = userIDs
	}
	groupVisibleUsers := GetGroupRatioSetting().GroupVisibleUsers
	groupVisibleUsers.Clear()
	groupVisibleUsers.AddAll(next)
	return nil
}

func IsGroupVisibleToUser(groupName string, userID int) bool {
	visibleUserIDs, configured := GetGroupRatioSetting().GroupVisibleUsers.Get(groupName)
	if !configured {
		return true
	}
	if userID <= 0 {
		return false
	}
	for _, id := range visibleUserIDs {
		if id == userID {
			return true
		}
	}
	return false
}

func CheckGroupRatio(jsonStr string) error {
	checkGroupRatio := make(map[string]interface{})
	err := json.Unmarshal([]byte(jsonStr), &checkGroupRatio)
	if err != nil {
		return err
	}
	for name, value := range checkGroupRatio {
		ratio, ok := asFloat64(value)
		if !ok {
			obj, isObj := value.(map[string]interface{})
			if !isObj {
				return errors.New("group ratio format is invalid: " + name)
			}
			enabled := true
			if v, exists := obj["enabled"]; exists {
				b, ok := v.(bool)
				if !ok {
					return errors.New("group ratio enabled field is invalid: " + name)
				}
				enabled = b
			}
			if !enabled {
				continue
			}
			ratioRaw, exists := obj["ratio"]
			if !exists {
				ratioRaw, exists = obj["value"]
			}
			if !exists {
				ratioRaw, exists = obj["multiplier"]
			}
			if !exists {
				return errors.New("group ratio field is missing: " + name)
			}
			ratio, ok = asFloat64(ratioRaw)
			if !ok {
				return errors.New("group ratio field is invalid: " + name)
			}
		}
		if ratio < 0 {
			return errors.New("group ratio must be not less than 0: " + name)
		}
	}
	return nil
}

func asFloat64(v interface{}) (float64, bool) {
	switch n := v.(type) {
	case float64:
		return n, true
	case float32:
		return float64(n), true
	case int:
		return float64(n), true
	case int64:
		return float64(n), true
	case int32:
		return float64(n), true
	case json.Number:
		f, err := n.Float64()
		return f, err == nil
	default:
		return 0, false
	}
}

func parseUserIDs(v interface{}) ([]int, error) {
	switch raw := v.(type) {
	case []interface{}:
		result := make([]int, 0, len(raw))
		seen := make(map[int]struct{})
		for _, item := range raw {
			id, ok := asFloat64(item)
			if !ok {
				return nil, fmt.Errorf("user id must be number")
			}
			userID := int(id)
			if userID <= 0 {
				return nil, fmt.Errorf("user id must be positive")
			}
			if _, exists := seen[userID]; exists {
				continue
			}
			seen[userID] = struct{}{}
			result = append(result, userID)
		}
		return result, nil
	case string:
		if strings.TrimSpace(raw) == "" {
			return []int{}, nil
		}
		parts := strings.Split(raw, ",")
		result := make([]int, 0, len(parts))
		seen := make(map[int]struct{})
		for _, p := range parts {
			p = strings.TrimSpace(p)
			if p == "" {
				continue
			}
			userID, err := strconv.Atoi(p)
			if err != nil || userID <= 0 {
				return nil, fmt.Errorf("invalid user id: %s", p)
			}
			if _, exists := seen[userID]; exists {
				continue
			}
			seen[userID] = struct{}{}
			result = append(result, userID)
		}
		return result, nil
	default:
		return nil, fmt.Errorf("unsupported format")
	}
}

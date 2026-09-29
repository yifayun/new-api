package setting

import (
	"encoding/json"
	"fmt"
	"maps"
	"sync"

	"github.com/QuantumNous/new-api/common"
)

var userUsableGroups = map[string]string{
	"default": "默认分组",
	"vip":     "vip分组",
}
var userUsableGroupsMutex sync.RWMutex

func GetUserUsableGroupsCopy() map[string]string {
	userUsableGroupsMutex.RLock()
	defer userUsableGroupsMutex.RUnlock()

	copyUserUsableGroups := make(map[string]string)
	maps.Copy(copyUserUsableGroups, userUsableGroups)
	return copyUserUsableGroups
}

func UserUsableGroups2JSONString() string {
	userUsableGroupsMutex.RLock()
	defer userUsableGroupsMutex.RUnlock()

	jsonBytes, err := json.Marshal(userUsableGroups)
	if err != nil {
		common.SysLog("error marshalling user groups: " + err.Error())
	}
	return string(jsonBytes)
}

func UpdateUserUsableGroupsByJSONString(jsonStr string) error {
	userUsableGroupsMutex.Lock()
	defer userUsableGroupsMutex.Unlock()

	raw := make(map[string]interface{})
	if err := json.Unmarshal([]byte(jsonStr), &raw); err != nil {
		return err
	}
	next := make(map[string]string)
	for groupName, value := range raw {
		// 兼容原有格式：{"default":"默认分组"}
		if desc, ok := value.(string); ok {
			next[groupName] = desc
			continue
		}
		// 兼容布尔开关格式：{"default":true}
		if enabled, ok := value.(bool); ok {
			if enabled {
				next[groupName] = ""
			}
			continue
		}
		// 兼容数字等标量格式：{"default":1}
		if num, ok := value.(json.Number); ok {
			next[groupName] = num.String()
			continue
		}
		if num, ok := value.(float64); ok {
			next[groupName] = fmt.Sprintf("%v", num)
			continue
		}
		// 兼容扩展格式：{"default":{"description":"默认分组","enabled":true}}
		obj, ok := value.(map[string]interface{})
		if !ok {
			return fmt.Errorf("invalid user usable group value for %s", groupName)
		}
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
		desc := ""
		if v, exists := obj["description"]; exists {
			if str, ok := v.(string); ok {
				desc = str
			} else {
				return fmt.Errorf("invalid description field for %s", groupName)
			}
		} else if v, exists := obj["desc"]; exists {
			if str, ok := v.(string); ok {
				desc = str
			} else {
				return fmt.Errorf("invalid desc field for %s", groupName)
			}
		} else if v, exists := obj["label"]; exists {
			if str, ok := v.(string); ok {
				desc = str
			} else {
				return fmt.Errorf("invalid label field for %s", groupName)
			}
		}
		next[groupName] = desc
	}
	userUsableGroups = next
	return nil
}

func GetUsableGroupDescription(groupName string) string {
	userUsableGroupsMutex.RLock()
	defer userUsableGroupsMutex.RUnlock()

	if desc, ok := userUsableGroups[groupName]; ok {
		return desc
	}
	return groupName
}

package doubao

import (
	"github.com/QuantumNous/new-api/common"
)

var ModelList = []string{
	"doubao-seedance-1-0-pro-250528",
	"doubao-seedance-1-0-lite-t2v",
	"doubao-seedance-1-0-lite-i2v",
	"doubao-seedance-1-5-pro-251215",
	"doubao-seedance-2-0-260128",
	"doubao-seedance-2-0-fast-260128",
}

var ChannelName = "doubao-video"

// DoubaoVideoBillingRatiosKey is a JSON string option managed via admin panel.
//
// Format:
// {
//   "default": {
//     "video_input": 0.6,
//     "resolution": { "480p": 0.8, "720p": 1.0, "1080p": 1.5 }
//   },
//   "doubao-seedance-2-0-260128": {
//     "video_input": 0.6087,
//     "resolution": { "480p": 1.0, "720p": 1.0, "1080p": 1.2 }
//   }
// }
const DoubaoVideoBillingRatiosKey = "DoubaoVideoBillingRatios"

type doubaoVideoRatioConfig struct {
	VideoInput   *float64           `json:"video_input,omitempty"`
	NoVideoInput *float64           `json:"no_video_input,omitempty"`
	// VideoInputPrice / NoVideoInputPrice are absolute token prices ($/1M tokens).
	// When configured, backend converts them to multipliers via baseInputPrice.
	VideoInputPrice   *float64           `json:"video_input_price,omitempty"`
	NoVideoInputPrice *float64           `json:"no_video_input_price,omitempty"`
	Resolution   map[string]float64 `json:"resolution,omitempty"`
	// ResolutionPrice stores absolute prices ($/1M tokens) per resolution.
	// When configured, backend converts it to a ratio using model base input price.
	ResolutionPrice map[string]float64 `json:"resolution_price,omitempty"`
	ByResolution    map[string]struct {
		VideoInputPrice   *float64 `json:"video_input_price,omitempty"`
		NoVideoInputPrice *float64 `json:"no_video_input_price,omitempty"`
		VideoInput        *float64 `json:"video_input,omitempty"`
		NoVideoInput      *float64 `json:"no_video_input,omitempty"`
	} `json:"by_resolution,omitempty"`
}

func getDoubaoVideoRatioConfig(modelName string) (*doubaoVideoRatioConfig, bool) {
	common.OptionMapRWMutex.RLock()
	raw, ok := common.OptionMap[DoubaoVideoBillingRatiosKey]
	common.OptionMapRWMutex.RUnlock()
	if !ok {
		return nil, false
	}
	rawStr := common.Interface2String(raw)
	if rawStr == "" || rawStr == "{}" {
		return nil, false
	}
	var m map[string]doubaoVideoRatioConfig
	if err := common.UnmarshalJsonStr(rawStr, &m); err != nil {
		return nil, false
	}
	if cfg, ok := m[modelName]; ok {
		return &cfg, true
	}
	if cfg, ok := m["default"]; ok {
		return &cfg, true
	}
	return nil, false
}

// GetVideoInputRatio returns billing multiplier for "input contains video".
// Priority:
// 1) cfg.video_input as direct ratio
// 2) cfg.video_input_price / baseInputPrice
func GetVideoInputRatio(modelName string, baseInputPrice float64) (float64, bool) {
	cfg, ok := getDoubaoVideoRatioConfig(modelName)
	if !ok || cfg == nil {
		return 0, false
	}
	if cfg.VideoInput != nil {
		return *cfg.VideoInput, true
	}
	if cfg.VideoInputPrice != nil && baseInputPrice > 0 && *cfg.VideoInputPrice > 0 {
		return *cfg.VideoInputPrice / baseInputPrice, true
	}
	return 0, false
}

// GetNoVideoInputRatio returns billing multiplier for "input has no video".
// Priority:
// 1) cfg.no_video_input as direct ratio
// 2) cfg.no_video_input_price / baseInputPrice
func GetNoVideoInputRatio(modelName string, baseInputPrice float64) (float64, bool) {
	cfg, ok := getDoubaoVideoRatioConfig(modelName)
	if !ok || cfg == nil {
		return 0, false
	}
	if cfg.NoVideoInput != nil {
		return *cfg.NoVideoInput, true
	}
	if cfg.NoVideoInputPrice != nil && baseInputPrice > 0 && *cfg.NoVideoInputPrice > 0 {
		return *cfg.NoVideoInputPrice / baseInputPrice, true
	}
	return 0, false
}

// GetResolutionRatio returns billing multiplier for given resolution.
// Priority:
// 1) cfg.resolution[resolution] as direct ratio
// 2) cfg.resolution_price[resolution] / baseInputPrice
func GetResolutionRatio(modelName, resolution string, baseInputPrice float64) (float64, bool) {
	cfg, ok := getDoubaoVideoRatioConfig(modelName)
	if !ok || cfg == nil {
		return 0, false
	}
	if cfg.Resolution != nil {
		if r, ok := cfg.Resolution[resolution]; ok {
			return r, true
		}
	}
	if cfg.ResolutionPrice != nil && baseInputPrice > 0 {
		if p, ok := cfg.ResolutionPrice[resolution]; ok && p > 0 {
			return p / baseInputPrice, true
		}
	}
	return 0, false
}

// GetDimensionRatio returns multiplier by two dimensions:
// - resolution (480p/720p/1080p)
// - hasVideoInput (true/false)
//
// Priority:
// 1) by_resolution[resolution].{*_ratio}
// 2) by_resolution[resolution].{*_price} / baseInputPrice
// 3) legacy global ratio/price config
func GetDimensionRatio(modelName, resolution string, hasVideoInput bool, baseInputPrice float64) (float64, bool) {
	cfg, ok := getDoubaoVideoRatioConfig(modelName)
	if !ok || cfg == nil {
		return 0, false
	}
	if cfg.ByResolution != nil {
		if r, ok := cfg.ByResolution[resolution]; ok {
			if hasVideoInput {
				if r.VideoInput != nil {
					return *r.VideoInput, true
				}
				if r.VideoInputPrice != nil && baseInputPrice > 0 && *r.VideoInputPrice > 0 {
					return *r.VideoInputPrice / baseInputPrice, true
				}
			} else {
				if r.NoVideoInput != nil {
					return *r.NoVideoInput, true
				}
				if r.NoVideoInputPrice != nil && baseInputPrice > 0 && *r.NoVideoInputPrice > 0 {
					return *r.NoVideoInputPrice / baseInputPrice, true
				}
			}
		}
	}
	if hasVideoInput {
		return GetVideoInputRatio(modelName, baseInputPrice)
	}
	return GetNoVideoInputRatio(modelName, baseInputPrice)
}

package service

import (
	"encoding/json"
	"fmt"
	"math"

	"github.com/QuantumNous/new-api/common"
	"github.com/shopspring/decimal"
)

const anthropicAggregatedTextDivisor = 5000
const anthropicAggregatedTextMax = 500

// EstimateAnthropicTextInputFromAggregatedPrompt estimates the text-only input
// portion when upstream returned prompt_tokens = text + cache_creation.
func EstimateAnthropicTextInputFromAggregatedPrompt(aggregatedPrompt int) int {
	if aggregatedPrompt <= 1000 {
		return aggregatedPrompt
	}
	estimated := aggregatedPrompt / anthropicAggregatedTextDivisor
	if estimated < 1 {
		estimated = 1
	}
	if estimated > anthropicAggregatedTextMax {
		estimated = anthropicAggregatedTextMax
	}
	return estimated
}

type ClaudeCacheBillingBackfillRatios struct {
	ModelRatio         float64
	GroupRatio         float64
	CompletionRatio    float64
	CacheCreationRatio float64
}

type ClaudeCacheBillingBackfillResult struct {
	TextInputTokens      int
	CacheCreationTokens  int
	Quota                int
	QuotaDelta           int
	AggregatedPromptSeen int
}

func RecalculateClaudeCacheBillingFromAggregatedPrompt(
	aggregatedPrompt int,
	completionTokens int,
	oldQuota int,
	ratios ClaudeCacheBillingBackfillRatios,
) ClaudeCacheBillingBackfillResult {
	textInput := EstimateAnthropicTextInputFromAggregatedPrompt(aggregatedPrompt)
	cacheCreation := aggregatedPrompt - textInput
	if cacheCreation < 0 {
		cacheCreation = 0
	}

	dPrompt := decimal.NewFromInt(int64(textInput))
	dCacheCreation := decimal.NewFromInt(int64(cacheCreation))
	dCompletion := decimal.NewFromInt(int64(completionTokens))
	dCompletionRatio := decimal.NewFromFloat(ratios.CompletionRatio)
	dCacheCreationRatio := decimal.NewFromFloat(ratios.CacheCreationRatio)
	ratio := decimal.NewFromFloat(ratios.ModelRatio).Mul(decimal.NewFromFloat(ratios.GroupRatio))

	cachedCreationWithRatio := dCacheCreation.Mul(dCacheCreationRatio)
	promptQuota := dPrompt.Add(cachedCreationWithRatio)
	completionQuota := dCompletion.Mul(dCompletionRatio)
	quotaDecimal := promptQuota.Add(completionQuota).Mul(ratio)

	newQuota, _ := common.QuotaFromDecimalChecked(quotaDecimal)
	return ClaudeCacheBillingBackfillResult{
		TextInputTokens:      textInput,
		CacheCreationTokens:  cacheCreation,
		Quota:                newQuota,
		QuotaDelta:           newQuota - oldQuota,
		AggregatedPromptSeen: aggregatedPrompt,
	}
}

type ClaudeCacheBillingBackfillLogOther struct {
	Claude               bool    `json:"claude"`
	CacheCreationTokens  int     `json:"cache_creation_tokens"`
	CacheCreationRatio   float64 `json:"cache_creation_ratio"`
	CacheTokens          int     `json:"cache_tokens"`
	CacheRatio           float64 `json:"cache_ratio"`
	CompletionRatio      float64 `json:"completion_ratio"`
	ModelRatio           float64 `json:"model_ratio"`
	GroupRatio           float64 `json:"group_ratio"`
	CacheWriteTokens     int     `json:"cache_write_tokens,omitempty"`
	UsageSemantic        string  `json:"usage_semantic,omitempty"`
	CacheBillingBackfill bool    `json:"cache_billing_backfill,omitempty"`
	BackfillPrevQuota    int     `json:"backfill_prev_quota,omitempty"`
	BackfillPrevPrompt   int     `json:"backfill_prev_prompt_tokens,omitempty"`
}

func ParseClaudeCacheBillingBackfillOther(raw string) (ClaudeCacheBillingBackfillLogOther, map[string]interface{}, error) {
	other := ClaudeCacheBillingBackfillLogOther{}
	rawMap := map[string]interface{}{}
	if raw == "" {
		return other, rawMap, fmt.Errorf("empty other")
	}
	if err := common.Unmarshal([]byte(raw), &other); err != nil {
		return other, rawMap, err
	}
	if err := common.Unmarshal([]byte(raw), &rawMap); err != nil {
		return other, rawMap, err
	}
	return other, rawMap, nil
}

func ShouldBackfillClaudeCacheBillingLog(
	promptTokens int,
	other ClaudeCacheBillingBackfillLogOther,
	modelName string,
) bool {
	if other.CacheBillingBackfill {
		return false
	}
	if !other.Claude {
		return false
	}
	if other.CacheCreationTokens > 0 {
		return false
	}
	if other.CacheTokens > 0 {
		return false
	}
	if promptTokens <= 1000 {
		return false
	}
	if other.CacheCreationRatio <= 1 {
		return false
	}
	if modelName == "" || modelName[:6] != "claude" {
		return false
	}
	return true
}

func ApplyClaudeCacheBillingBackfillToOtherMap(
	rawMap map[string]interface{},
	result ClaudeCacheBillingBackfillResult,
	prevPromptTokens int,
	prevQuota int,
) ([]byte, error) {
	rawMap["cache_creation_tokens"] = result.CacheCreationTokens
	rawMap["cache_creation_ratio"] = rawMapValueOrFloat(rawMap, "cache_creation_ratio", 1.25)
	rawMap["cache_write_tokens"] = result.CacheCreationTokens
	rawMap["claude"] = true
	if _, ok := rawMap["usage_semantic"]; !ok {
		rawMap["usage_semantic"] = "anthropic"
	}
	rawMap["cache_billing_backfill"] = true
	rawMap["backfill_prev_quota"] = prevQuota
	rawMap["backfill_prev_prompt_tokens"] = prevPromptTokens
	rawMap["backfill_quota_delta"] = result.QuotaDelta
	return common.Marshal(rawMap)
}

func rawMapValueOrFloat(rawMap map[string]interface{}, key string, fallback float64) float64 {
	value, ok := rawMap[key]
	if !ok || value == nil {
		return fallback
	}
	switch typed := value.(type) {
	case float64:
		return typed
	case json.Number:
		parsed, err := typed.Float64()
		if err == nil {
			return parsed
		}
	case int:
		return float64(typed)
	case int64:
		return float64(typed)
	}
	return fallback
}

func SummarizeClaudeCacheBillingBackfill(results []ClaudeCacheBillingBackfillResult) (totalDelta int, maxDelta int) {
	for _, result := range results {
		totalDelta += result.QuotaDelta
		if result.QuotaDelta > maxDelta {
			maxDelta = result.QuotaDelta
		}
	}
	return totalDelta, maxDelta
}

func FormatQuotaUSD(quota int) string {
	usd := float64(quota) / common.QuotaPerUnit
	return fmt.Sprintf("$%.6f", usd)
}

func SafeIntFromAny(value interface{}) int {
	switch typed := value.(type) {
	case float64:
		if typed > math.MaxInt32 {
			return math.MaxInt32
		}
		if typed < math.MinInt32 {
			return math.MinInt32
		}
		return int(typed)
	case int:
		return typed
	case int64:
		return int(typed)
	case json.Number:
		parsed, err := typed.Int64()
		if err != nil {
			return 0
		}
		return int(parsed)
	default:
		return 0
	}
}

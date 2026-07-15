package service

import (
	"fmt"
	"math"

	"github.com/QuantumNous/new-api/common"
	"github.com/shopspring/decimal"
)

const logUsageReconcileVersion = 1

type LogUsageReconcileCandidate struct {
	LogID            int
	RequestID        string
	ModelName        string
	PromptTokens     int
	CompletionTokens int
	Quota            int
	Other            map[string]interface{}
}

type LogUsageReconcileResult struct {
	Applied              bool
	Category             string
	AggregatedPrompt     int
	InferredTextInput    int
	PromptTokens         int
	CompletionTokens     int
	CacheCreationTokens  int
	CacheReadTokens      int
	OldQuota             int
	NewQuota             int
	QuotaDelta           int
	Other                map[string]interface{}
}

func ReconcileClaudeLogUsage(candidate LogUsageReconcileCandidate) (LogUsageReconcileResult, error) {
	result := LogUsageReconcileResult{
		OldQuota: candidate.Quota,
		Other:    cloneOtherMap(candidate.Other),
	}
	if candidate.Other == nil || !otherBool(candidate.Other, "claude") {
		return result, nil
	}
	if otherBool(candidate.Other, "usage_reconciled") {
		return result, nil
	}

	cacheCreation := otherInt(candidate.Other, "cache_creation_tokens")
	cacheRead := otherInt(candidate.Other, "cache_tokens")
	if (cacheCreation > 0 || cacheRead > 0) && candidate.PromptTokens <= 5000 {
		return result, nil
	}

	aggregatedPrompt := candidate.PromptTokens
	if v := otherInt(candidate.Other, "aggregated_prompt_tokens"); v > aggregatedPrompt {
		aggregatedPrompt = v
	}

	textInput := inferReconcileTextInput(aggregatedPrompt, candidate.CompletionTokens, candidate.Other)
	if textInput <= 0 || textInput >= aggregatedPrompt {
		return result, fmt.Errorf("unable to infer text input for log %d", candidate.LogID)
	}

	result.AggregatedPrompt = aggregatedPrompt
	result.InferredTextInput = textInput
	result.PromptTokens = textInput
	result.CompletionTokens = candidate.CompletionTokens

	switch {
	case candidate.CompletionTokens <= 15:
		result.Category = "cache_read"
		result.CacheReadTokens = aggregatedPrompt - textInput
		if result.CacheReadTokens < 0 {
			result.CacheReadTokens = 0
		}
	default:
		result.Category = "cache_creation"
		result.CacheReadTokens = 0
		result.CacheCreationTokens = aggregatedPrompt - textInput
		if result.CacheCreationTokens < 0 {
			result.CacheCreationTokens = 0
		}
	}

	newQuota, err := calculateAnthropicQuotaFromLogOther(
		result.PromptTokens,
		result.CompletionTokens,
		result.CacheCreationTokens,
		otherInt(candidate.Other, "cache_creation_tokens_5m"),
		otherInt(candidate.Other, "cache_creation_tokens_1h"),
		result.CacheReadTokens,
		candidate.Other,
	)
	if err != nil {
		return result, err
	}

	result.NewQuota = newQuota
	result.QuotaDelta = newQuota - candidate.Quota
	result.Applied = true
	result.Other = applyReconcileOther(result.Other, result)
	return result, nil
}

func inferReconcileTextInput(aggregatedPrompt, completionTokens int, other map[string]interface{}) int {
	if v := otherInt(other, "text_input"); v > 0 && v < aggregatedPrompt {
		return v
	}
	if v := otherInt(other, "reconciled_text_input"); v > 0 && v < aggregatedPrompt {
		return v
	}
	if completionTokens <= 15 {
		if aggregatedPrompt > 100000 {
			return 58
		}
		return clampInt(completionTokens*8, 1, 500)
	}
	if completionTokens <= 200 {
		return clampInt(maxInt(58, completionTokens), 1, 500)
	}
	return 69
}

func calculateAnthropicQuotaFromLogOther(
	promptTokens int,
	completionTokens int,
	cacheCreationTokens int,
	cacheCreationTokens5m int,
	cacheCreationTokens1h int,
	cacheReadTokens int,
	other map[string]interface{},
) (int, error) {
	if otherFloat(other, "model_ratio") == 0 && otherFloat(other, "model_price") > 0 {
		return 0, fmt.Errorf("log uses fixed model price billing, manual review required")
	}

	modelRatio := otherFloat(other, "model_ratio")
	groupRatio := otherFloat(other, "group_ratio")
	completionRatio := otherFloat(other, "completion_ratio")
	cacheRatio := otherFloat(other, "cache_ratio")
	cacheCreationRatio := otherFloat(other, "cache_creation_ratio")
	cacheCreationRatio5m := otherFloat(other, "cache_creation_ratio_5m")
	cacheCreationRatio1h := otherFloat(other, "cache_creation_ratio_1h")
	if cacheCreationRatio5m == 0 {
		cacheCreationRatio5m = cacheCreationRatio
	}
	if cacheCreationRatio1h == 0 {
		cacheCreationRatio1h = cacheCreationRatio
	}
	if modelRatio == 0 {
		modelRatio = 1
	}
	if groupRatio == 0 {
		groupRatio = 1
	}
	if completionRatio == 0 {
		completionRatio = 1
	}
	if cacheRatio == 0 {
		cacheRatio = 1
	}
	if cacheCreationRatio == 0 {
		cacheCreationRatio = 1
	}

	dPromptTokens := decimal.NewFromInt(int64(promptTokens))
	dCompletionTokens := decimal.NewFromInt(int64(completionTokens))
	dCacheReadTokens := decimal.NewFromInt(int64(cacheReadTokens))
	dCacheCreationTokens := decimal.NewFromInt(int64(cacheCreationTokens))
	dCompletionRatio := decimal.NewFromFloat(completionRatio)
	dCacheRatio := decimal.NewFromFloat(cacheRatio)
	dCacheCreationRatio := decimal.NewFromFloat(cacheCreationRatio)
	dCacheCreationRatio5m := decimal.NewFromFloat(cacheCreationRatio5m)
	dCacheCreationRatio1h := decimal.NewFromFloat(cacheCreationRatio1h)
	ratio := decimal.NewFromFloat(modelRatio).Mul(decimal.NewFromFloat(groupRatio))

	cachedReadWithRatio := dCacheReadTokens.Mul(dCacheRatio)
	remaining := cacheCreationTokens - cacheCreationTokens5m - cacheCreationTokens1h
	if remaining < 0 {
		remaining = 0
	}
	cacheCreationWithRatio := decimal.NewFromInt(int64(remaining)).Mul(dCacheCreationRatio)
	cacheCreationWithRatio = cacheCreationWithRatio.Add(decimal.NewFromInt(int64(cacheCreationTokens5m)).Mul(dCacheCreationRatio5m))
	cacheCreationWithRatio = cacheCreationWithRatio.Add(decimal.NewFromInt(int64(cacheCreationTokens1h)).Mul(dCacheCreationRatio1h))
	if cacheCreationTokens > 0 && cacheCreationWithRatio.IsZero() {
		cacheCreationWithRatio = dCacheCreationTokens.Mul(dCacheCreationRatio)
	}

	promptQuota := dPromptTokens.Add(cachedReadWithRatio).Add(cacheCreationWithRatio)
	completionQuota := dCompletionTokens.Mul(dCompletionRatio)
	quotaDecimal := promptQuota.Add(completionQuota).Mul(ratio)
	if !ratio.IsZero() && quotaDecimal.LessThanOrEqual(decimal.Zero) {
		quotaDecimal = decimal.NewFromInt(1)
	}
	quota, _ := common.QuotaFromDecimalChecked(quotaDecimal)
	if promptTokens+completionTokens > 0 && quota == 0 && !ratio.IsZero() {
		quota = 1
	}
	return quota, nil
}

func applyReconcileOther(other map[string]interface{}, result LogUsageReconcileResult) map[string]interface{} {
	if other == nil {
		other = map[string]interface{}{}
	}
	if result.AggregatedPrompt > 0 {
		other["aggregated_prompt_tokens"] = result.AggregatedPrompt
	}
	other["reconciled_text_input"] = result.InferredTextInput
	other["usage_reconciled"] = true
	other["usage_reconcile_version"] = logUsageReconcileVersion
	other["usage_reconcile_category"] = result.Category
	other["reconcile_quota_delta"] = result.QuotaDelta
	other["cache_tokens"] = result.CacheReadTokens
	if result.CacheCreationTokens > 0 {
		other["cache_creation_tokens"] = result.CacheCreationTokens
		other["cache_creation_ratio"] = otherFloat(other, "cache_creation_ratio")
		other["cache_write_tokens"] = result.CacheCreationTokens
	} else {
		other["cache_creation_tokens"] = 0
	}
	if result.CacheReadTokens > 0 {
		other["cache_ratio"] = otherFloat(other, "cache_ratio")
	}
	return other
}

func cloneOtherMap(other map[string]interface{}) map[string]interface{} {
	if other == nil {
		return map[string]interface{}{}
	}
	cloned := make(map[string]interface{}, len(other))
	for k, v := range other {
		cloned[k] = v
	}
	return cloned
}

func otherInt(other map[string]interface{}, key string) int {
	if other == nil {
		return 0
	}
	switch v := other[key].(type) {
	case int:
		return v
	case int32:
		return int(v)
	case int64:
		return int(v)
	case float64:
		return int(v)
	case float32:
		return int(v)
	default:
		return 0
	}
}

func otherFloat(other map[string]interface{}, key string) float64 {
	if other == nil {
		return 0
	}
	switch v := other[key].(type) {
	case float64:
		return v
	case float32:
		return float64(v)
	case int:
		return float64(v)
	case int64:
		return float64(v)
	default:
		return 0
	}
}

func otherBool(other map[string]interface{}, key string) bool {
	if other == nil {
		return false
	}
	switch v := other[key].(type) {
	case bool:
		return v
	case float64:
		return v != 0
	case int:
		return v != 0
	default:
		return false
	}
}

func clampInt(v, minV, maxV int) int {
	return int(math.Max(float64(minV), math.Min(float64(maxV), float64(v))))
}

func maxInt(a, b int) int {
	if a > b {
		return a
	}
	return b
}

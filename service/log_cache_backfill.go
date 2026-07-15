package service

import (
	"fmt"
	"math"

	"github.com/QuantumNous/new-api/common"
	"github.com/shopspring/decimal"
	"github.com/tidwall/gjson"
)

const LogCacheBackfillVersion = 1

type LogCacheBackfillCandidate struct {
	LogID            int
	UserID           int
	RequestID        string
	ModelName        string
	OldPromptTokens  int
	OldQuota         int
	CompletionTokens int
	TextTokens       int
	CacheCreation    int
	CacheRead        int
	NewPromptTokens  int
	NewQuota         int
	QuotaDelta       int
	Method           string
	Skipped          bool
	SkipReason       string
}

type LogCacheBackfillOptions struct {
	MinPromptTokens     int
	MinPromptPerOutput  int
	TextFloor           int
	TextCeiling         int
	SinceUnix           int64
	Limit               int
	DryRun              bool
}

func DefaultLogCacheBackfillOptions() LogCacheBackfillOptions {
	return LogCacheBackfillOptions{
		MinPromptTokens:    5000,
		MinPromptPerOutput: 50,
		TextFloor:          50,
		TextCeiling:        500,
	}
}

func EstimateAggregatedClaudeTextInput(promptTokens, completionTokens, textFloor, textCeiling int) (int, bool) {
	if promptTokens <= 0 {
		return 0, false
	}
	outputTokens := completionTokens
	if outputTokens <= 0 {
		outputTokens = 1
	}
	ratio := promptTokens / outputTokens
	if ratio <= 50 {
		return 0, false
	}
	textTokens := textFloor
	if ratio <= 100 {
		textTokens = completionTokens / 10
		if textTokens < textFloor {
			textTokens = textFloor
		}
		if textTokens > textCeiling {
			textTokens = textCeiling
		}
	}
	if textTokens >= promptTokens {
		textTokens = textFloor
	}
	return textTokens, true
}

func RecalculateAnthropicConsumeQuota(
	promptTokens int,
	completionTokens int,
	cacheTokens int,
	cacheCreationTokens int,
	cacheCreationTokens5m int,
	cacheCreationTokens1h int,
	modelRatio float64,
	groupRatio float64,
	completionRatio float64,
	cacheRatio float64,
	cacheCreationRatio float64,
	cacheCreationRatio5m float64,
	cacheCreationRatio1h float64,
) int {
	dPromptTokens := decimal.NewFromInt(int64(promptTokens))
	dCacheTokens := decimal.NewFromInt(int64(cacheTokens))
	dCompletionTokens := decimal.NewFromInt(int64(completionTokens))
	dCachedCreationTokens := decimal.NewFromInt(int64(cacheCreationTokens))
	dCompletionRatio := decimal.NewFromFloat(completionRatio)
	dCacheRatio := decimal.NewFromFloat(cacheRatio)
	dCacheCreationRatio := decimal.NewFromFloat(cacheCreationRatio)
	dCacheCreationRatio5m := decimal.NewFromFloat(cacheCreationRatio5m)
	dCacheCreationRatio1h := decimal.NewFromFloat(cacheCreationRatio1h)
	dModelRatio := decimal.NewFromFloat(modelRatio)
	dGroupRatio := decimal.NewFromFloat(groupRatio)

	ratio := dModelRatio.Mul(dGroupRatio)
	baseTokens := dPromptTokens

	cachedTokensWithRatio := dCacheTokens.Mul(dCacheRatio)

	var cachedCreationTokensWithRatio decimal.Decimal
	hasSplit := cacheCreationTokens5m > 0 || cacheCreationTokens1h > 0
	if !dCachedCreationTokens.IsZero() || hasSplit {
		remaining := cacheCreationTokens - cacheCreationTokens5m - cacheCreationTokens1h
		if remaining < 0 {
			remaining = 0
		}
		cachedCreationTokensWithRatio = decimal.NewFromInt(int64(remaining)).Mul(dCacheCreationRatio)
		cachedCreationTokensWithRatio = cachedCreationTokensWithRatio.Add(
			decimal.NewFromInt(int64(cacheCreationTokens5m)).Mul(dCacheCreationRatio5m))
		cachedCreationTokensWithRatio = cachedCreationTokensWithRatio.Add(
			decimal.NewFromInt(int64(cacheCreationTokens1h)).Mul(dCacheCreationRatio1h))
	}

	promptQuota := baseTokens.Add(cachedTokensWithRatio).Add(cachedCreationTokensWithRatio)
	completionQuota := dCompletionTokens.Mul(dCompletionRatio)
	quotaCalculateDecimal := promptQuota.Add(completionQuota).Mul(ratio)

	if !ratio.IsZero() && quotaCalculateDecimal.LessThanOrEqual(decimal.Zero) {
		quotaCalculateDecimal = decimal.NewFromInt(1)
	}
	quota, _ := common.QuotaFromDecimalChecked(quotaCalculateDecimal)
	if quota == 0 && (promptTokens+completionTokens) > 0 && !ratio.IsZero() {
		quota = 1
	}
	return quota
}

func BuildLogCacheBackfillCandidate(
	logID int,
	userID int,
	requestID string,
	modelName string,
	promptTokens int,
	completionTokens int,
	quota int,
	otherJSON string,
	opts LogCacheBackfillOptions,
) LogCacheBackfillCandidate {
	candidate := LogCacheBackfillCandidate{
		LogID:            logID,
		UserID:           userID,
		RequestID:        requestID,
		ModelName:        modelName,
		OldPromptTokens:  promptTokens,
		OldQuota:         quota,
		CompletionTokens: completionTokens,
		NewPromptTokens:  promptTokens,
		NewQuota:         quota,
	}

	if !gjson.Get(otherJSON, "claude").Bool() {
		candidate.Skipped = true
		candidate.SkipReason = "not_claude"
		return candidate
	}
	if gjson.Get(otherJSON, "cache_backfill.version").Int() > 0 || gjson.Get(otherJSON, "cache_billing_backfill").Bool() {
		candidate.Skipped = true
		candidate.SkipReason = "already_backfilled"
		return candidate
	}
	if gjson.Get(otherJSON, "billing_mode").String() == "tiered_expr" {
		candidate.Skipped = true
		candidate.SkipReason = "tiered_billing"
		return candidate
	}

	cacheCreation := int(gjson.Get(otherJSON, "cache_creation_tokens").Int())
	cacheRead := int(gjson.Get(otherJSON, "cache_tokens").Int())
	cacheCreation5m := int(gjson.Get(otherJSON, "cache_creation_tokens_5m").Int())
	cacheCreation1h := int(gjson.Get(otherJSON, "cache_creation_tokens_1h").Int())
	if cacheCreation > 0 || cacheCreation5m > 0 || cacheCreation1h > 0 {
		if gjson.Get(otherJSON, "cache_backfill.version").Int() > 0 || gjson.Get(otherJSON, "cache_billing_backfill").Bool() {
			candidate.Skipped = true
			candidate.SkipReason = "already_backfilled"
			return candidate
		}
		return buildLogCacheBackfillCandidateFromExistingCacheCreation(
			candidate, otherJSON, promptTokens, completionTokens, quota,
			cacheCreation, cacheCreation5m, cacheCreation1h, cacheRead,
		)
	}
	if promptTokens < opts.MinPromptTokens {
		candidate.Skipped = true
		candidate.SkipReason = "prompt_below_threshold"
		return candidate
	}
	outputTokens := completionTokens
	if outputTokens <= 0 {
		outputTokens = 1
	}
	if promptTokens/outputTokens < opts.MinPromptPerOutput {
		candidate.Skipped = true
		candidate.SkipReason = "prompt_output_ratio_low"
		return candidate
	}
	if completionTokens <= 20 {
		candidate.Skipped = true
		candidate.SkipReason = "likely_cache_read"
		return candidate
	}

	textTokens := EstimateAnthropicTextInputFromAggregatedPrompt(promptTokens)
	if textTokens <= 0 || textTokens >= promptTokens {
		candidate.Skipped = true
		candidate.SkipReason = "cannot_estimate_text_input"
		return candidate
	}

	cacheCreation = promptTokens - textTokens - cacheRead
	if cacheCreation <= 1000 {
		candidate.Skipped = true
		candidate.SkipReason = "cache_creation_too_small"
		return candidate
	}

	modelRatio := gjson.Get(otherJSON, "model_ratio").Float()
	groupRatio := gjson.Get(otherJSON, "group_ratio").Float()
	completionRatio := gjson.Get(otherJSON, "completion_ratio").Float()
	cacheRatio := gjson.Get(otherJSON, "cache_ratio").Float()
	cacheCreationRatio := gjson.Get(otherJSON, "cache_creation_ratio").Float()
	cacheCreationRatio5m := gjson.Get(otherJSON, "cache_creation_ratio_5m").Float()
	cacheCreationRatio1h := gjson.Get(otherJSON, "cache_creation_ratio_1h").Float()
	if cacheCreationRatio == 0 {
		cacheCreationRatio = 1.25
	}
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

	newQuota := RecalculateAnthropicConsumeQuota(
		textTokens,
		completionTokens,
		cacheRead,
		cacheCreation,
		cacheCreation5m,
		cacheCreation1h,
		modelRatio,
		groupRatio,
		completionRatio,
		cacheRatio,
		cacheCreationRatio,
		cacheCreationRatio5m,
		cacheCreationRatio1h,
	)

	candidate.TextTokens = textTokens
	candidate.CacheCreation = cacheCreation
	candidate.CacheRead = cacheRead
	candidate.NewPromptTokens = textTokens
	candidate.NewQuota = newQuota
	candidate.QuotaDelta = newQuota - quota
	candidate.Method = "aggregated_prompt_div5000_v1"
	return candidate
}

func buildLogCacheBackfillCandidateFromExistingCacheCreation(
	candidate LogCacheBackfillCandidate,
	otherJSON string,
	promptTokens int,
	completionTokens int,
	quota int,
	cacheCreation int,
	cacheCreation5m int,
	cacheCreation1h int,
	cacheRead int,
) LogCacheBackfillCandidate {
	textTokens := promptTokens
	if promptTokens > anthropicAggregatedTextMax*anthropicAggregatedTextDivisor/10 {
		textTokens = EstimateAnthropicTextInputFromAggregatedPrompt(promptTokens)
	}
	if textTokens <= 0 || textTokens >= promptTokens {
		if cacheCreation > 0 && promptTokens > cacheCreation {
			textTokens = promptTokens - cacheCreation - cacheRead
		}
	}
	if textTokens <= 0 {
		candidate.Skipped = true
		candidate.SkipReason = "cannot_infer_text_with_existing_cache_creation"
		return candidate
	}

	modelRatio := gjson.Get(otherJSON, "model_ratio").Float()
	groupRatio := gjson.Get(otherJSON, "group_ratio").Float()
	completionRatio := gjson.Get(otherJSON, "completion_ratio").Float()
	cacheRatio := gjson.Get(otherJSON, "cache_ratio").Float()
	cacheCreationRatio := gjson.Get(otherJSON, "cache_creation_ratio").Float()
	cacheCreationRatio5m := gjson.Get(otherJSON, "cache_creation_ratio_5m").Float()
	cacheCreationRatio1h := gjson.Get(otherJSON, "cache_creation_ratio_1h").Float()
	if cacheCreationRatio == 0 {
		cacheCreationRatio = 1.25
	}
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

	newQuota := RecalculateAnthropicConsumeQuota(
		textTokens,
		completionTokens,
		cacheRead,
		cacheCreation,
		cacheCreation5m,
		cacheCreation1h,
		modelRatio,
		groupRatio,
		completionRatio,
		cacheRatio,
		cacheCreationRatio,
		cacheCreationRatio5m,
		cacheCreationRatio1h,
	)

	candidate.TextTokens = textTokens
	candidate.CacheCreation = cacheCreation
	candidate.CacheRead = cacheRead
	candidate.NewPromptTokens = textTokens
	candidate.NewQuota = newQuota
	candidate.QuotaDelta = newQuota - quota
	candidate.Method = "existing_cache_creation_quota_fix_v1"
	if candidate.NewPromptTokens == candidate.OldPromptTokens && candidate.QuotaDelta == 0 {
		aggregatedPrompt := textTokens + cacheCreation + cacheRead
		wrongQuota := RecalculateAnthropicConsumeQuota(
			aggregatedPrompt,
			completionTokens,
			0,
			0,
			0,
			0,
			modelRatio,
			groupRatio,
			completionRatio,
			cacheRatio,
			1,
			1,
			1,
		)
		if quota > wrongQuota {
			candidate.QuotaDelta = quota - wrongQuota
			candidate.Method = "user_quota_catchup_v1"
		} else {
			candidate.Skipped = true
			candidate.SkipReason = "existing_cache_creation_already_correct"
		}
	}
	return candidate
}

func ApplyLogCacheBackfillOther(otherJSON string, candidate LogCacheBackfillCandidate, backfillAt int64) (string, error) {
	otherMap, err := common.StrToMap(otherJSON)
	if err != nil || otherMap == nil {
		return "", fmt.Errorf("invalid other json for log %d", candidate.LogID)
	}

	otherMap["cache_creation_tokens"] = candidate.CacheCreation
	otherMap["cache_creation_ratio"] = gjson.Get(otherJSON, "cache_creation_ratio").Float()
	if otherMap["cache_creation_ratio"] == nil || otherMap["cache_creation_ratio"] == 0 {
		otherMap["cache_creation_ratio"] = 1.25
	}
	otherMap["cache_write_tokens"] = candidate.CacheCreation
	otherMap["cache_backfill"] = map[string]interface{}{
		"version":             LogCacheBackfillVersion,
		"at":                  backfillAt,
		"method":              candidate.Method,
		"old_prompt_tokens":   candidate.OldPromptTokens,
		"old_quota":           candidate.OldQuota,
		"estimated_text_tokens": candidate.TextTokens,
		"cache_creation_tokens": candidate.CacheCreation,
		"quota_delta":         candidate.QuotaDelta,
	}

	return common.MapToJsonStr(otherMap), nil
}

func SummarizeLogCacheBackfill(candidates []LogCacheBackfillCandidate) map[string]int64 {
	summary := map[string]int64{
		"total":           int64(len(candidates)),
		"updated":         0,
		"skipped":         0,
		"old_quota_sum":   0,
		"new_quota_sum":   0,
		"quota_delta_sum": 0,
	}
	for _, c := range candidates {
		if c.Skipped {
			summary["skipped"]++
			continue
		}
		summary["updated"]++
		summary["old_quota_sum"] += int64(c.OldQuota)
		summary["new_quota_sum"] += int64(c.NewQuota)
		summary["quota_delta_sum"] += int64(c.QuotaDelta)
	}
	return summary
}

func FormatLogCacheBackfillMoney(quotaDelta int) string {
	return fmt.Sprintf("%.6f", float64(quotaDelta)/common.QuotaPerUnit)
}

func AbsInt(v int) int {
	if v < 0 {
		return -v
	}
	return v
}

func SafeQuotaDeltaPercent(oldQuota, newQuota int) float64 {
	if oldQuota == 0 {
		return math.Inf(1)
	}
	return (float64(newQuota-oldQuota) / float64(oldQuota)) * 100
}

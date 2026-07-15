package main

import (
	"flag"
	"fmt"
	"os"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/joho/godotenv"
)

func main() {
	apply := flag.Bool("apply", false, "apply updates to logs table")
	limit := flag.Int("limit", 0, "max rows to process (0 = all)")
	since := flag.String("since", "2026-06-01", "only process logs created on/after this date (YYYY-MM-DD)")
	flag.Parse()

	_ = godotenv.Load(".env")
	common.InitEnv()

	if err := model.InitDB(); err != nil {
		fmt.Fprintf(os.Stderr, "init db failed: %v\n", err)
		os.Exit(1)
	}
	defer model.CloseDB()

	sinceTs, err := time.ParseInLocation("2006-01-02", *since, time.Local)
	if err != nil {
		fmt.Fprintf(os.Stderr, "invalid since date: %v\n", err)
		os.Exit(1)
	}

	query := model.LOG_DB.Model(&model.Log{}).
		Where("type = ?", model.LogTypeConsume).
		Where("created_at >= ?", sinceTs.Unix()).
		Where("model_name LIKE ?", "claude%").
		Where("prompt_tokens > ?", 1000).
		Where("COALESCE(JSON_UNQUOTE(JSON_EXTRACT(other, '$.claude')), 'false') = 'true'").
		Where("COALESCE(CAST(JSON_UNQUOTE(JSON_EXTRACT(other, '$.cache_creation_tokens')) AS SIGNED), 0) = 0").
		Where("COALESCE(CAST(JSON_UNQUOTE(JSON_EXTRACT(other, '$.cache_tokens')) AS SIGNED), 0) = 0").
		Where("COALESCE(CAST(JSON_UNQUOTE(JSON_EXTRACT(other, '$.cache_creation_ratio')) AS DECIMAL(10,4)), 1) > 1").
		Where("JSON_UNQUOTE(JSON_EXTRACT(other, '$.cache_billing_backfill')) IS NULL").
		Order("id ASC")
	if *limit > 0 {
		query = query.Limit(*limit)
	}

	var logs []model.Log
	if err := query.Find(&logs).Error; err != nil {
		fmt.Fprintf(os.Stderr, "query logs failed: %v\n", err)
		os.Exit(1)
	}

	var candidates []model.Log
	var results []service.ClaudeCacheBillingBackfillResult
	for _, log := range logs {
		other, rawMap, err := service.ParseClaudeCacheBillingBackfillOther(log.Other)
		if err != nil {
			continue
		}
		if !service.ShouldBackfillClaudeCacheBillingLog(log.PromptTokens, other, log.ModelName) {
			continue
		}
		result := service.RecalculateClaudeCacheBillingFromAggregatedPrompt(
			log.PromptTokens,
			log.CompletionTokens,
			log.Quota,
			service.ClaudeCacheBillingBackfillRatios{
				ModelRatio:         other.ModelRatio,
				GroupRatio:         other.GroupRatio,
				CompletionRatio:    other.CompletionRatio,
				CacheCreationRatio: other.CacheCreationRatio,
			},
		)
		if result.QuotaDelta <= 0 {
			continue
		}
		candidates = append(candidates, log)
		results = append(results, result)
	}

	totalDelta, maxDelta := service.SummarizeClaudeCacheBillingBackfill(results)
	fmt.Printf("matched logs: %d\n", len(candidates))
	fmt.Printf("total quota delta: %d (%s)\n", totalDelta, service.FormatQuotaUSD(totalDelta))
	fmt.Printf("max single delta: %d (%s)\n", maxDelta, service.FormatQuotaUSD(maxDelta))

	if len(candidates) == 0 {
		return
	}

	fmt.Println("sample rows:")
	sample := len(candidates)
	if sample > 5 {
		sample = 5
	}
	for i := 0; i < sample; i++ {
		log := candidates[i]
		result := results[i]
		fmt.Printf("  id=%d request_id=%s prompt %d -> text=%d cache_create=%d quota %d -> %d (+%d)\n",
			log.Id, log.RequestId, log.PromptTokens, result.TextInputTokens, result.CacheCreationTokens,
			log.Quota, result.Quota, result.QuotaDelta)
	}

	if !*apply {
		fmt.Println("dry-run only; re-run with --apply to update logs")
		return
	}

	updated := 0
	for i, log := range candidates {
		result := results[i]
		_, rawMap, err := service.ParseClaudeCacheBillingBackfillOther(log.Other)
		if err != nil {
			fmt.Fprintf(os.Stderr, "skip id=%d parse other failed: %v\n", log.Id, err)
			continue
		}
		otherJSON, err := service.ApplyClaudeCacheBillingBackfillToOtherMap(rawMap, result, log.PromptTokens, log.Quota)
		if err != nil {
			fmt.Fprintf(os.Stderr, "skip id=%d marshal other failed: %v\n", log.Id, err)
			continue
		}
		if err := model.LOG_DB.Model(&model.Log{}).Where("id = ?", log.Id).Updates(map[string]interface{}{
			"prompt_tokens": result.TextInputTokens,
			"quota":         result.Quota,
			"other":         string(otherJSON),
		}).Error; err != nil {
			fmt.Fprintf(os.Stderr, "skip id=%d update failed: %v\n", log.Id, err)
			continue
		}
		updated++
	}

	fmt.Printf("updated logs: %d\n", updated)
}

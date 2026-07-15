package service

import (
	"fmt"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
)

type LogUsageReconcileSummary struct {
	Scanned         int
	Applied         int
	Skipped         int
	Failed          int
	OldQuotaTotal   int64
	NewQuotaTotal   int64
	QuotaDelta      int64
	CreationCount   int
	CacheReadCount  int
	UserChargeDelta int64
	UserDeltas      map[int]int
	Failures        []string
}

func RunClaudeLogUsageReconcile(apply bool, batchSize int) (*LogUsageReconcileSummary, error) {
	if batchSize <= 0 {
		batchSize = 500
	}

	summary := &LogUsageReconcileSummary{
		UserDeltas: make(map[int]int),
	}
	afterID := 0
	for {
		rows, err := model.ListClaudeLogsNeedingUsageReconcile(batchSize, afterID)
		if err != nil {
			return summary, err
		}
		if len(rows) == 0 {
			break
		}
		afterID = rows[len(rows)-1].ID

		for _, row := range rows {
			summary.Scanned++
			other := map[string]interface{}{}
			if row.Other != "" {
				if err := common.UnmarshalJsonStr(row.Other, &other); err != nil {
					summary.Failed++
					summary.Failures = append(summary.Failures, fmt.Sprintf("log %d: parse other failed: %v", row.ID, err))
					continue
				}
			}

			result, err := ReconcileClaudeLogUsage(LogUsageReconcileCandidate{
				LogID:            row.ID,
				RequestID:        row.RequestID,
				ModelName:        row.ModelName,
				PromptTokens:     row.PromptTokens,
				CompletionTokens: row.CompletionTokens,
				Quota:            row.Quota,
				Other:            other,
			})
			if err != nil {
				summary.Failed++
				summary.Failures = append(summary.Failures, fmt.Sprintf("log %d (%s): %v", row.ID, row.RequestID, err))
				continue
			}
			if !result.Applied {
				summary.Skipped++
				continue
			}

			summary.Applied++
			summary.OldQuotaTotal += int64(result.OldQuota)
			summary.NewQuotaTotal += int64(result.NewQuota)
			summary.QuotaDelta += int64(result.QuotaDelta)
			switch result.Category {
			case "cache_creation":
				summary.CreationCount++
			case "cache_read":
				summary.CacheReadCount++
			}

			if apply {
				if err := model.UpdateConsumeLogReconcile(row.ID, result.PromptTokens, result.CompletionTokens, result.NewQuota, result.Other); err != nil {
					summary.Failed++
					summary.Applied--
					summary.Failures = append(summary.Failures, fmt.Sprintf("log %d update failed: %v", row.ID, err))
					continue
				}
				if result.QuotaDelta != 0 && row.UserID > 0 {
					if err := model.DeltaUpdateUserQuota(row.UserID, result.QuotaDelta); err != nil {
						summary.Failed++
						summary.Applied--
						summary.Failures = append(summary.Failures, fmt.Sprintf("log %d user %d charge failed: %v", row.ID, row.UserID, err))
						continue
					}
					model.UpdateUserUsedQuota(row.UserID, result.QuotaDelta)
					summary.UserChargeDelta += int64(result.QuotaDelta)
					summary.UserDeltas[row.UserID] += result.QuotaDelta
				}
			}
		}

		if len(rows) < batchSize {
			break
		}
	}

	return summary, nil
}

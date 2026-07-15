package backfill

import (
	"fmt"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"gorm.io/gorm"
)

type ClaudeCacheLogBackfillResult struct {
	Scanned       int
	Updated       int
	Skipped       int
	OldQuotaSum   int64
	NewQuotaSum   int64
	QuotaDeltaSum int64
	UserDeltas    map[int]int
	Samples       []ClaudeCacheLogBackfillSample
}

type ClaudeCacheLogBackfillSample struct {
	LogID           int
	RequestID       string
	OldPromptTokens int
	NewPromptTokens int
	CacheCreation   int
	OldQuota        int
	NewQuota        int
	QuotaDelta      int
}

type logCacheBackfillApplyItem struct {
	Candidate service.LogCacheBackfillCandidate
	OtherJSON string
	ChannelID int
}

func RunClaudeCacheLogBackfill(opts service.LogCacheBackfillOptions, requestID string) (*ClaudeCacheLogBackfillResult, error) {
	if model.LOG_DB == nil {
		return nil, fmt.Errorf("log db not initialized")
	}

	result := &ClaudeCacheLogBackfillResult{
		UserDeltas: make(map[int]int),
	}

	query := model.LOG_DB.Model(&model.Log{}).
		Where("type = ?", model.LogTypeConsume).
		Where("model_name LIKE ?", "claude%").
		Where("prompt_tokens >= ?", opts.MinPromptTokens).
		Order("id ASC")
	if opts.SinceUnix > 0 {
		query = query.Where("created_at >= ?", opts.SinceUnix)
	}
	if requestID != "" {
		query = query.Where("request_id = ?", requestID)
	}
	if opts.Limit > 0 {
		query = query.Limit(opts.Limit)
	}

	var logs []model.Log
	if err := query.Find(&logs).Error; err != nil {
		return nil, err
	}

	now := common.GetTimestamp()
	var toApply []logCacheBackfillApplyItem

	for _, log := range logs {
		result.Scanned++
		candidate := service.BuildLogCacheBackfillCandidate(
			log.Id,
			log.UserId,
			log.RequestId,
			log.ModelName,
			log.PromptTokens,
			log.CompletionTokens,
			log.Quota,
			log.Other,
			opts,
		)
		if candidate.Skipped {
			result.Skipped++
			continue
		}
		if candidate.QuotaDelta <= 0 {
			result.Skipped++
			continue
		}

		result.OldQuotaSum += int64(candidate.OldQuota)
		result.NewQuotaSum += int64(candidate.NewQuota)
		result.QuotaDeltaSum += int64(candidate.QuotaDelta)
		result.UserDeltas[candidate.UserID] += candidate.QuotaDelta

		if len(result.Samples) < 10 {
			result.Samples = append(result.Samples, ClaudeCacheLogBackfillSample{
				LogID:           candidate.LogID,
				RequestID:       candidate.RequestID,
				OldPromptTokens: candidate.OldPromptTokens,
				NewPromptTokens: candidate.NewPromptTokens,
				CacheCreation:   candidate.CacheCreation,
				OldQuota:        candidate.OldQuota,
				NewQuota:        candidate.NewQuota,
				QuotaDelta:      candidate.QuotaDelta,
			})
		}

		toApply = append(toApply, logCacheBackfillApplyItem{
			Candidate: candidate,
			OtherJSON: log.Other,
			ChannelID: log.ChannelId,
		})
	}

	if opts.DryRun || len(toApply) == 0 {
		result.Updated = len(toApply)
		return result, nil
	}

	err := model.LOG_DB.Transaction(func(tx *gorm.DB) error {
		for _, item := range toApply {
			otherJSON, err := service.ApplyLogCacheBackfillOther(item.OtherJSON, item.Candidate, now)
			if err != nil {
				return err
			}
			if err := tx.Model(&model.Log{}).Where("id = ?", item.Candidate.LogID).Updates(map[string]interface{}{
				"prompt_tokens": item.Candidate.NewPromptTokens,
				"quota":         item.Candidate.NewQuota,
				"other":         otherJSON,
			}).Error; err != nil {
				return err
			}
		}
		return nil
	})
	if err != nil {
		return result, err
	}

	for _, item := range toApply {
		candidate := item.Candidate
		if candidate.QuotaDelta <= 0 {
			continue
		}
		if err := model.DecreaseUserQuota(candidate.UserID, candidate.QuotaDelta, true); err != nil {
			return result, fmt.Errorf("decrease user %d quota for log %d: %w", candidate.UserID, candidate.LogID, err)
		}
		model.UpdateUserUsedQuotaExported(candidate.UserID, candidate.QuotaDelta)
		if item.ChannelID > 0 {
			model.UpdateChannelUsedQuota(item.ChannelID, candidate.QuotaDelta)
		}
	}

	result.Updated = len(toApply)
	return result, nil
}

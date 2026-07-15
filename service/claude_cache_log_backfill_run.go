package service

import (
	"fmt"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
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
	Candidate LogCacheBackfillCandidate
	OtherJSON string
	ChannelID int
}

func RunClaudeCacheLogBackfill(opts LogCacheBackfillOptions, requestID string) (*ClaudeCacheLogBackfillResult, error) {
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
		candidate := BuildLogCacheBackfillCandidate(
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
		if candidate.QuotaDelta == 0 && candidate.NewPromptTokens == candidate.OldPromptTokens && candidate.NewQuota == candidate.OldQuota {
			result.Skipped++
			continue
		}

		result.OldQuotaSum += int64(candidate.OldQuota)
		result.NewQuotaSum += int64(candidate.NewQuota)
		result.QuotaDeltaSum += int64(candidate.QuotaDelta)
		if candidate.QuotaDelta > 0 {
			result.UserDeltas[candidate.UserID] += candidate.QuotaDelta
		}

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
			updates := map[string]interface{}{}
			if item.Candidate.NewPromptTokens != item.Candidate.OldPromptTokens {
				updates["prompt_tokens"] = item.Candidate.NewPromptTokens
			}
			if item.Candidate.NewQuota != item.Candidate.OldQuota {
				updates["quota"] = item.Candidate.NewQuota
			}
			if len(updates) == 0 && item.Candidate.QuotaDelta <= 0 {
				continue
			}
			otherJSON, err := ApplyLogCacheBackfillOther(item.OtherJSON, item.Candidate, now)
			if err != nil {
				return err
			}
			updates["other"] = otherJSON
			if err := tx.Model(&model.Log{}).Where("id = ?", item.Candidate.LogID).Updates(updates).Error; err != nil {
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
		model.UpdateUserUsedQuota(candidate.UserID, candidate.QuotaDelta)
		if item.ChannelID > 0 {
			model.UpdateChannelUsedQuota(item.ChannelID, candidate.QuotaDelta)
		}
	}

	result.Updated = len(toApply)
	return result, nil
}

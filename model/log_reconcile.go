package model

import (
	"github.com/QuantumNous/new-api/common"
)

type ConsumeLogReconcileRow struct {
	ID               int    `gorm:"column:id"`
	UserID           int    `gorm:"column:user_id"`
	RequestID        string `gorm:"column:request_id"`
	ModelName        string `gorm:"column:model_name"`
	PromptTokens     int    `gorm:"column:prompt_tokens"`
	CompletionTokens int    `gorm:"column:completion_tokens"`
	Quota            int    `gorm:"column:quota"`
	Other            string `gorm:"column:other"`
}

func ListClaudeLogsNeedingUsageReconcile(limit int, afterID int) ([]ConsumeLogReconcileRow, error) {
	if limit <= 0 {
		limit = 500
	}

	query := LOG_DB.Model(&Log{}).
		Select("id, user_id, request_id, model_name, prompt_tokens, completion_tokens, quota, other").
		Where("type = ?", LogTypeConsume).
		Where("prompt_tokens > ?", 5000).
		Where("id > ?", afterID).
		Order("id ASC").
		Limit(limit)

	switch {
	case common.UsingLogDatabase(common.DatabaseTypePostgreSQL):
		query = query.
			Where("(other IS NULL OR other = '' OR (other::json->>'claude') = 'true')").
			Where("(other IS NULL OR other = '' OR other::json->>'usage_reconciled' IS NULL OR other::json->>'usage_reconciled' = 'false')").
			Where("(other IS NULL OR other = '' OR COALESCE((other::json->>'cache_creation_tokens')::bigint, 0) = 0)")
	case common.UsingLogDatabase(common.DatabaseTypeSQLite):
		query = query.
			Where("(other IS NULL OR other = '' OR json_extract(other, '$.claude') = 1)").
			Where("(other IS NULL OR other = '' OR json_extract(other, '$.usage_reconciled') IS NULL OR json_extract(other, '$.usage_reconciled') = 0)").
			Where("(other IS NULL OR other = '' OR IFNULL(json_extract(other, '$.cache_creation_tokens'), 0) = 0)")
	default:
		query = query.
			Where("(other IS NULL OR other = '' OR (JSON_VALID(other) AND JSON_EXTRACT(other, '$.claude') = true))").
			Where("(other IS NULL OR other = '' OR JSON_EXTRACT(other, '$.usage_reconciled') IS NULL OR JSON_EXTRACT(other, '$.usage_reconciled') = false)").
			Where("(other IS NULL OR other = '' OR JSON_EXTRACT(other, '$.cache_creation_tokens') IS NULL OR JSON_EXTRACT(other, '$.cache_creation_tokens') = 0)")
	}

	var rows []ConsumeLogReconcileRow
	err := query.Find(&rows).Error
	return rows, err
}

func UpdateConsumeLogReconcile(id int, promptTokens int, completionTokens int, quota int, other map[string]interface{}) error {
	return LOG_DB.Model(&Log{}).Where("id = ?", id).Updates(map[string]interface{}{
		"prompt_tokens":     promptTokens,
		"completion_tokens": completionTokens,
		"quota":             quota,
		"other":             common.MapToJsonStr(other),
	}).Error
}

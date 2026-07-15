package model

import (
	"fmt"
	"math"
	"sort"

	"github.com/QuantumNous/new-api/common"
	"gorm.io/gorm"
)

type UserModelBillingItem struct {
	UserId           int     `json:"user_id"`
	Username         string  `json:"username"`
	ModelName        string  `json:"model_name"`
	RequestCount     int     `json:"request_count"`
	PromptTokens     int64   `json:"prompt_tokens"`
	CompletionTokens int64   `json:"completion_tokens"`
	CacheReadTokens      int64   `json:"cache_read_tokens"`
	CacheCreationTokens  int64   `json:"cache_creation_tokens"`
	PromptCost           float64 `json:"prompt_cost"`
	CompletionCost   float64 `json:"completion_cost"`
	CacheReadCost    float64 `json:"cache_read_cost"`
	ConsumedQuota    int64   `json:"consumed_quota"`
	EstimatedCost    float64 `json:"estimated_cost"`
	CostCurrency     string  `json:"cost_currency"`
}

type UserBillingSummaryItem struct {
	UserId           int     `json:"user_id"`
	Username         string  `json:"username"`
	RequestCount     int     `json:"request_count"`
	PromptTokens     int64   `json:"prompt_tokens"`
	CompletionTokens int64   `json:"completion_tokens"`
	CacheReadTokens      int64   `json:"cache_read_tokens"`
	CacheCreationTokens  int64   `json:"cache_creation_tokens"`
	PromptCost           float64 `json:"prompt_cost"`
	CompletionCost   float64 `json:"completion_cost"`
	CacheReadCost    float64 `json:"cache_read_cost"`
	ConsumedQuota    int64   `json:"consumed_quota"`
	EstimatedCost    float64 `json:"estimated_cost"`
	CostCurrency     string  `json:"cost_currency"`
}

type ModelBillingRankingItem struct {
	ModelName        string  `json:"model_name"`
	RequestCount     int     `json:"request_count"`
	PromptTokens     int64   `json:"prompt_tokens"`
	CompletionTokens int64   `json:"completion_tokens"`
	CacheReadTokens      int64   `json:"cache_read_tokens"`
	CacheCreationTokens  int64   `json:"cache_creation_tokens"`
	PromptCost           float64 `json:"prompt_cost"`
	CompletionCost   float64 `json:"completion_cost"`
	CacheReadCost    float64 `json:"cache_read_cost"`
	ConsumedQuota    int64   `json:"consumed_quota"`
	EstimatedCost    float64 `json:"estimated_cost"`
	CostCurrency     string  `json:"cost_currency"`
}

type UserModelBillingResponse struct {
	Items        []*UserModelBillingItem    `json:"items"`
	All          []*UserModelBillingItem    `json:"all"`
	Total        int64                      `json:"total"`
	UserCount    int64                      `json:"user_count"`
	UserSummary  []*UserBillingSummaryItem  `json:"user_summary"`
	ModelRanking []*ModelBillingRankingItem `json:"model_ranking"`
	GrandTotal   *UserBillingSummaryItem    `json:"grand_total"`
}

type userModelBillingAggregateRow struct {
	UserId           int    `gorm:"column:user_id"`
	Username         string `gorm:"column:username"`
	ModelName        string `gorm:"column:model_name"`
	RequestCount     int64  `gorm:"column:request_count"`
	PromptTokens     int64  `gorm:"column:prompt_tokens"`
	CompletionTokens int64  `gorm:"column:completion_tokens"`
	CacheReadTokens      int64  `gorm:"column:cache_read_tokens"`
	CacheCreationTokens  int64  `gorm:"column:cache_creation_tokens"`
	ConsumedQuota        int64  `gorm:"column:consumed_quota"`
}

type userModelBillingTotalsRow struct {
	RequestCount     int64 `gorm:"column:request_count"`
	PromptTokens     int64 `gorm:"column:prompt_tokens"`
	CompletionTokens int64 `gorm:"column:completion_tokens"`
	CacheReadTokens  int64 `gorm:"column:cache_read_tokens"`
	ConsumedQuota    int64 `gorm:"column:consumed_quota"`
}

func cacheCreationTokensSumExpr() string {
	if common.UsingLogDatabase(common.DatabaseTypePostgreSQL) {
		return `COALESCE(SUM(
			CASE
				WHEN other IS NOT NULL AND other <> '' AND left(trim(other), 1) = '{'
				THEN COALESCE(NULLIF(other::json->>'cache_creation_tokens', '')::bigint, 0)
				ELSE 0
			END
		), 0) AS cache_creation_tokens`
	}
	if common.UsingLogDatabase(common.DatabaseTypeMySQL) {
		return `COALESCE(SUM(CAST(JSON_UNQUOTE(JSON_EXTRACT(other, '$.cache_creation_tokens')) AS SIGNED)), 0) AS cache_creation_tokens`
	}
	return `COALESCE(SUM(CAST(json_extract(other, '$.cache_creation_tokens') AS INTEGER)), 0) AS cache_creation_tokens`
}

func cacheReadTokensSumExpr() string {
	if common.UsingLogDatabase(common.DatabaseTypePostgreSQL) {
		return `COALESCE(SUM(
			CASE
				WHEN other IS NOT NULL AND other <> '' AND left(trim(other), 1) = '{'
				THEN COALESCE(NULLIF(other::json->>'cache_tokens', '')::bigint, 0)
				ELSE 0
			END
		), 0) AS cache_read_tokens`
	}
	if common.UsingLogDatabase(common.DatabaseTypeMySQL) {
		return `COALESCE(SUM(CAST(JSON_UNQUOTE(JSON_EXTRACT(other, '$.cache_tokens')) AS SIGNED)), 0) AS cache_read_tokens`
	}
	return `COALESCE(SUM(CAST(json_extract(other, '$.cache_tokens') AS INTEGER)), 0) AS cache_read_tokens`
}

func userModelBillingSelectSQL() string {
	return fmt.Sprintf(`user_id, username, model_name,
		COUNT(*) AS request_count,
		COALESCE(SUM(prompt_tokens), 0) AS prompt_tokens,
		COALESCE(SUM(completion_tokens), 0) AS completion_tokens,
		%s,
		%s,
		COALESCE(SUM(quota), 0) AS consumed_quota`, cacheReadTokensSumExpr(), cacheCreationTokensSumExpr())
}

func userModelBillingTotalsSelectSQL() string {
	return fmt.Sprintf(`COUNT(*) AS request_count,
		COALESCE(SUM(prompt_tokens), 0) AS prompt_tokens,
		COALESCE(SUM(completion_tokens), 0) AS completion_tokens,
		%s,
		%s,
		COALESCE(SUM(quota), 0) AS consumed_quota`, cacheReadTokensSumExpr(), cacheCreationTokensSumExpr())
}

func applyUserModelBillingFilters(query *gorm.DB, startTimestamp int64, endTimestamp int64, keyword string) *gorm.DB {
	query = query.Where("type = ?", LogTypeConsume)
	if startTimestamp > 0 {
		query = query.Where("created_at >= ?", startTimestamp)
	}
	if endTimestamp > 0 {
		query = query.Where("created_at <= ?", endTimestamp)
	}
	if keyword != "" {
		query = query.Where("(username LIKE ? OR model_name LIKE ?)", "%"+keyword+"%", "%"+keyword+"%")
	}
	return query
}

func queryUserModelBillingAggregates(startTimestamp int64, endTimestamp int64, keyword string) ([]userModelBillingAggregateRow, error) {
	query := applyUserModelBillingFilters(LOG_DB.Model(&Log{}), startTimestamp, endTimestamp, keyword).
		Select(userModelBillingSelectSQL()).
		Group("user_id, username, model_name").
		Order("username ASC, model_name ASC")

	var rows []userModelBillingAggregateRow
	if err := query.Find(&rows).Error; err != nil {
		return nil, err
	}
	return rows, nil
}

func queryUserModelBillingAggregatesPaginated(startTimestamp int64, endTimestamp int64, keyword string, startIdx int, pageSize int) ([]userModelBillingAggregateRow, error) {
	query := applyUserModelBillingFilters(LOG_DB.Model(&Log{}), startTimestamp, endTimestamp, keyword).
		Select(userModelBillingSelectSQL()).
		Group("user_id, username, model_name").
		Order("username ASC, model_name ASC")

	if pageSize > 0 {
		query = query.Offset(startIdx).Limit(pageSize)
	}

	var rows []userModelBillingAggregateRow
	if err := query.Find(&rows).Error; err != nil {
		return nil, err
	}
	return rows, nil
}

func queryUserModelBillingGroupedCount(startTimestamp int64, endTimestamp int64, keyword string) (int64, error) {
	subQuery := applyUserModelBillingFilters(LOG_DB.Model(&Log{}), startTimestamp, endTimestamp, keyword).
		Select("user_id, username, model_name").
		Group("user_id, username, model_name")

	var count int64
	if err := LOG_DB.Table("(?) AS grouped", subQuery).Count(&count).Error; err != nil {
		return 0, err
	}
	return count, nil
}

func queryUserModelBillingUserCount(startTimestamp int64, endTimestamp int64, keyword string) (int64, error) {
	var count int64
	query := applyUserModelBillingFilters(LOG_DB.Model(&Log{}), startTimestamp, endTimestamp, keyword)
	if err := query.Select("COUNT(DISTINCT user_id)").Scan(&count).Error; err != nil {
		return 0, err
	}
	return count, nil
}

func queryUserModelBillingGrandTotal(startTimestamp int64, endTimestamp int64, keyword string) (*UserBillingSummaryItem, error) {
	var row userModelBillingTotalsRow
	query := applyUserModelBillingFilters(LOG_DB.Model(&Log{}), startTimestamp, endTimestamp, keyword)
	if err := query.Select(userModelBillingTotalsSelectSQL()).Scan(&row).Error; err != nil {
		return nil, err
	}

	estimatedCost := estimateCostFromConsumedQuota(row.ConsumedQuota)
	return &UserBillingSummaryItem{
		UserId:           0,
		Username:         "ALL",
		RequestCount:     int(row.RequestCount),
		PromptTokens:     row.PromptTokens,
		CompletionTokens: row.CompletionTokens,
		CacheReadTokens:  row.CacheReadTokens,
		ConsumedQuota:    row.ConsumedQuota,
		EstimatedCost:    estimatedCost,
		CostCurrency:     costCurrencyFromQuota(row.ConsumedQuota, estimatedCost),
	}, nil
}

func estimateCostFromConsumedQuota(consumedQuota int64) float64 {
	if consumedQuota <= 0 || common.QuotaPerUnit <= 0 {
		return 0
	}
	return math.Round((float64(consumedQuota)/common.QuotaPerUnit)*1000000) / 1000000
}

func costCurrencyFromQuota(consumedQuota int64, estimatedCost float64) string {
	if consumedQuota > 0 && estimatedCost > 0 {
		return "QUOTA"
	}
	return "USD"
}

func estimateCostBreakdownFromTokens(promptTokens int64, completionTokens int64, cacheReadTokens int64, pricing *Pricing) (float64, float64, float64, float64) {
	if pricing == nil || !(pricing.QuotaType == 1 && pricing.ModelPrice > 0) {
		return 0, 0, 0, 0
	}
	cacheRatio := 1.0
	if pricing.CacheRatio != nil && *pricing.CacheRatio > 0 {
		cacheRatio = *pricing.CacheRatio
	}
	completionRatio := pricing.CompletionRatio
	if completionRatio <= 0 {
		completionRatio = 1
	}
	nonCachePrompt := promptTokens - cacheReadTokens
	if nonCachePrompt < 0 {
		nonCachePrompt = 0
	}
	inputCost := (float64(nonCachePrompt) / 1000000.0) * pricing.ModelPrice
	cacheCost := (float64(cacheReadTokens) / 1000000.0) * pricing.ModelPrice * cacheRatio
	completionCost := (float64(completionTokens) / 1000000.0) * pricing.ModelPrice * completionRatio
	return inputCost, completionCost, cacheCost, inputCost + completionCost + cacheCost
}

func buildUserModelBillingPricingMap() map[string]*Pricing {
	pricingMap := map[string]*Pricing{}
	for _, pricing := range GetPricing() {
		item := pricing
		pricingMap[item.ModelName] = &item
	}
	return pricingMap
}

func buildUserModelBillingItems(rows []userModelBillingAggregateRow) []*UserModelBillingItem {
	pricingMap := buildUserModelBillingPricingMap()

	all := make([]*UserModelBillingItem, 0, len(rows))
	for _, row := range rows {
		item := &UserModelBillingItem{
			UserId:           row.UserId,
			Username:         row.Username,
			ModelName:        row.ModelName,
			RequestCount:     int(row.RequestCount),
			PromptTokens:     row.PromptTokens,
			CompletionTokens: row.CompletionTokens,
			CacheReadTokens:  row.CacheReadTokens,
			ConsumedQuota:    row.ConsumedQuota,
			CostCurrency:     "USD",
		}

		promptCost, completionCost, cacheReadCost, estimatedCost := estimateCostBreakdownFromTokens(
			item.PromptTokens,
			item.CompletionTokens,
			item.CacheReadTokens,
			pricingMap[item.ModelName],
		)
		if estimatedCost <= 0 && item.ConsumedQuota > 0 && common.QuotaPerUnit > 0 {
			estimatedCost = float64(item.ConsumedQuota) / common.QuotaPerUnit
			item.CostCurrency = "QUOTA"
			nonCachePrompt := item.PromptTokens - item.CacheReadTokens
			if nonCachePrompt < 0 {
				nonCachePrompt = 0
			}
			partsTotal := nonCachePrompt + item.CompletionTokens + item.CacheReadTokens
			if partsTotal > 0 {
				promptCost = estimatedCost * float64(nonCachePrompt) / float64(partsTotal)
				completionCost = estimatedCost * float64(item.CompletionTokens) / float64(partsTotal)
				cacheReadCost = estimatedCost * float64(item.CacheReadTokens) / float64(partsTotal)
			}
		}
		item.PromptCost = math.Round(promptCost*1000000) / 1000000
		item.CompletionCost = math.Round(completionCost*1000000) / 1000000
		item.CacheReadCost = math.Round(cacheReadCost*1000000) / 1000000
		item.EstimatedCost = math.Round(estimatedCost*1000000) / 1000000
		all = append(all, item)
	}

	return all
}

func buildUserModelBillingSummaries(all []*UserModelBillingItem) ([]*UserBillingSummaryItem, []*ModelBillingRankingItem, *UserBillingSummaryItem) {
	userAgg := map[int]*UserBillingSummaryItem{}
	modelAgg := map[string]*ModelBillingRankingItem{}
	grand := &UserBillingSummaryItem{UserId: 0, Username: "ALL", CostCurrency: "USD"}

	for _, item := range all {
		u, ok := userAgg[item.UserId]
		if !ok {
			u = &UserBillingSummaryItem{
				UserId:       item.UserId,
				Username:     item.Username,
				CostCurrency: "USD",
			}
			userAgg[item.UserId] = u
		}
		u.RequestCount += item.RequestCount
		u.PromptTokens += item.PromptTokens
		u.CompletionTokens += item.CompletionTokens
		u.CacheReadTokens += item.CacheReadTokens
		u.PromptCost += item.PromptCost
		u.CompletionCost += item.CompletionCost
		u.CacheReadCost += item.CacheReadCost
		u.ConsumedQuota += item.ConsumedQuota
		u.EstimatedCost += item.EstimatedCost
		if item.CostCurrency == "QUOTA" {
			u.CostCurrency = "QUOTA"
		}

		m, ok := modelAgg[item.ModelName]
		if !ok {
			m = &ModelBillingRankingItem{
				ModelName:    item.ModelName,
				CostCurrency: "USD",
			}
			modelAgg[item.ModelName] = m
		}
		m.RequestCount += item.RequestCount
		m.PromptTokens += item.PromptTokens
		m.CompletionTokens += item.CompletionTokens
		m.CacheReadTokens += item.CacheReadTokens
		m.PromptCost += item.PromptCost
		m.CompletionCost += item.CompletionCost
		m.CacheReadCost += item.CacheReadCost
		m.ConsumedQuota += item.ConsumedQuota
		m.EstimatedCost += item.EstimatedCost
		if item.CostCurrency == "QUOTA" {
			m.CostCurrency = "QUOTA"
		}

		grand.RequestCount += item.RequestCount
		grand.PromptTokens += item.PromptTokens
		grand.CompletionTokens += item.CompletionTokens
		grand.CacheReadTokens += item.CacheReadTokens
		grand.PromptCost += item.PromptCost
		grand.CompletionCost += item.CompletionCost
		grand.CacheReadCost += item.CacheReadCost
		grand.ConsumedQuota += item.ConsumedQuota
		grand.EstimatedCost += item.EstimatedCost
		if item.CostCurrency == "QUOTA" {
			grand.CostCurrency = "QUOTA"
		}
	}

	grand.PromptCost = math.Round(grand.PromptCost*1000000) / 1000000
	grand.CompletionCost = math.Round(grand.CompletionCost*1000000) / 1000000
	grand.CacheReadCost = math.Round(grand.CacheReadCost*1000000) / 1000000
	grand.EstimatedCost = math.Round(grand.EstimatedCost*1000000) / 1000000

	userSummary := make([]*UserBillingSummaryItem, 0, len(userAgg))
	for _, v := range userAgg {
		v.PromptCost = math.Round(v.PromptCost*1000000) / 1000000
		v.CompletionCost = math.Round(v.CompletionCost*1000000) / 1000000
		v.CacheReadCost = math.Round(v.CacheReadCost*1000000) / 1000000
		v.EstimatedCost = math.Round(v.EstimatedCost*1000000) / 1000000
		userSummary = append(userSummary, v)
	}
	sort.Slice(userSummary, func(i, j int) bool { return userSummary[i].EstimatedCost > userSummary[j].EstimatedCost })

	modelRanking := make([]*ModelBillingRankingItem, 0, len(modelAgg))
	for _, v := range modelAgg {
		v.PromptCost = math.Round(v.PromptCost*1000000) / 1000000
		v.CompletionCost = math.Round(v.CompletionCost*1000000) / 1000000
		v.CacheReadCost = math.Round(v.CacheReadCost*1000000) / 1000000
		v.EstimatedCost = math.Round(v.EstimatedCost*1000000) / 1000000
		modelRanking = append(modelRanking, v)
	}
	sort.Slice(modelRanking, func(i, j int) bool { return modelRanking[i].EstimatedCost > modelRanking[j].EstimatedCost })

	return userSummary, modelRanking, grand
}

func GetUserModelBillingSummary(startTimestamp int64, endTimestamp int64, keyword string, startIdx int, pageSize int) (UserModelBillingResponse, error) {
	grand, err := queryUserModelBillingGrandTotal(startTimestamp, endTimestamp, keyword)
	if err != nil {
		return UserModelBillingResponse{}, err
	}

	total, err := queryUserModelBillingGroupedCount(startTimestamp, endTimestamp, keyword)
	if err != nil {
		return UserModelBillingResponse{}, err
	}

	userCount, err := queryUserModelBillingUserCount(startTimestamp, endTimestamp, keyword)
	if err != nil {
		return UserModelBillingResponse{}, err
	}

	rows, err := queryUserModelBillingAggregatesPaginated(startTimestamp, endTimestamp, keyword, startIdx, pageSize)
	if err != nil {
		return UserModelBillingResponse{}, err
	}

	return UserModelBillingResponse{
		Items:      buildUserModelBillingItems(rows),
		Total:      total,
		UserCount:  userCount,
		GrandTotal: grand,
	}, nil
}

func GetAllUserModelBillingItems(startTimestamp int64, endTimestamp int64, keyword string) ([]*UserModelBillingItem, error) {
	rows, err := queryUserModelBillingAggregates(startTimestamp, endTimestamp, keyword)
	if err != nil {
		return nil, err
	}
	items := buildUserModelBillingItems(rows)
	sort.Slice(items, func(i, j int) bool {
		if items[i].Username == items[j].Username {
			return items[i].ModelName < items[j].ModelName
		}
		return items[i].Username < items[j].Username
	})
	return items, nil
}

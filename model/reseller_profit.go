package model

import (
	"errors"

	"github.com/QuantumNous/new-api/common"
)

type ResellerProfit struct {
	Id          int     `json:"id"`
	ResellerId  int     `json:"reseller_id" gorm:"index"`
	UserId      int     `json:"user_id" gorm:"index"`
	BaseQuota   int     `json:"base_quota"`
	MarkupQuota int     `json:"markup_quota"`
	MarkupRate  float64 `json:"markup_rate" gorm:"type:decimal(10,4)"`
	Remark      string  `json:"remark" gorm:"type:varchar(255);default:''"`
	CreatedAt   int64   `json:"created_at" gorm:"autoCreateTime:milli;index"`
}

func CreateResellerProfit(record *ResellerProfit) error {
	if record == nil {
		return errors.New("nil profit record")
	}
	if err := DB.Create(record).Error; err != nil {
		return err
	}
	if record.MarkupQuota > 0 {
		_ = AddResellerProfit(record.ResellerId, int64(record.MarkupQuota))
	}
	return nil
}

func GetResellerProfits(resellerId int, pageInfo *common.PageInfo) ([]*ResellerProfit, int64, error) {
	var items []*ResellerProfit
	var total int64
	query := DB.Model(&ResellerProfit{}).Where("reseller_id = ?", resellerId)
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	if err := query.Order("id desc").Limit(pageInfo.GetPageSize()).Offset(pageInfo.GetStartIdx()).Find(&items).Error; err != nil {
		return nil, 0, err
	}
	return items, total, nil
}

func GetResellerProfitsWithFilters(resellerId int, userId int, startAt int64, endAt int64, pageInfo *common.PageInfo) ([]*ResellerProfit, int64, error) {
	var items []*ResellerProfit
	var total int64
	query := DB.Model(&ResellerProfit{}).Where("reseller_id = ?", resellerId)
	if userId > 0 {
		query = query.Where("user_id = ?", userId)
	}
	if startAt > 0 {
		query = query.Where("created_at >= ?", startAt)
	}
	if endAt > 0 {
		query = query.Where("created_at <= ?", endAt)
	}
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	if err := query.Order("id desc").Limit(pageInfo.GetPageSize()).Offset(pageInfo.GetStartIdx()).Find(&items).Error; err != nil {
		return nil, 0, err
	}
	return items, total, nil
}

func GetResellerProfitSummary(resellerId int) (int64, int64, int64, error) {
	var result struct {
		Base   int64 `json:"base"`
		Markup int64 `json:"markup"`
	}
	err := DB.Model(&ResellerProfit{}).
		Where("reseller_id = ?", resellerId).
		Select("COALESCE(SUM(base_quota),0) AS base, COALESCE(SUM(markup_quota),0) AS markup").
		Scan(&result).Error
	if err != nil {
		return 0, 0, 0, err
	}
	return result.Base + result.Markup, result.Base, result.Markup, nil
}

func GetResellerProfitTotalByTimeRange(resellerId int, startAt int64, endAt int64) (int64, error) {
	var total int64
	query := DB.Model(&ResellerProfit{}).Where("reseller_id = ?", resellerId)
	if startAt > 0 {
		query = query.Where("created_at >= ?", startAt)
	}
	if endAt > 0 {
		query = query.Where("created_at <= ?", endAt)
	}
	if err := query.Select("COALESCE(SUM(markup_quota),0)").Scan(&total).Error; err != nil {
		return 0, err
	}
	return total, nil
}

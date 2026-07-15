package model

import (
	"errors"

	"github.com/QuantumNous/new-api/common"
	"gorm.io/gorm"
)

const (
	ResellerWithdrawalPending  = "pending"
	ResellerWithdrawalApproved = "approved"
	ResellerWithdrawalRejected = "rejected"
	ResellerWithdrawalPaid     = "paid"
)

type ResellerWithdrawal struct {
	Id         int    `json:"id"`
	ResellerId int    `json:"reseller_id" gorm:"index"`
	UserId     int    `json:"user_id" gorm:"index"`
	Amount     int64  `json:"amount"`
	Status     string `json:"status" gorm:"type:varchar(32);default:'pending';index"`
	Account    string `json:"account" gorm:"type:varchar(255);default:''"`
	ReviewerId int    `json:"reviewer_id" gorm:"default:0"`
	PaymentRef string `json:"payment_ref" gorm:"type:varchar(128);default:''"`
	PaidAt     int64  `json:"paid_at" gorm:"default:0"`
	Remark     string `json:"remark" gorm:"type:varchar(255);default:''"`
	CreatedAt  int64  `json:"created_at" gorm:"autoCreateTime:milli;index"`
	UpdatedAt  int64  `json:"updated_at" gorm:"autoUpdateTime:milli"`
}

func CreateResellerWithdrawal(item *ResellerWithdrawal) error {
	if item == nil {
		return errors.New("nil withdrawal")
	}
	item.Status = ResellerWithdrawalPending
	return DB.Transaction(func(tx *gorm.DB) error {
		var reseller Reseller
		if err := lockForUpdate(tx).First(&reseller, "id = ?", item.ResellerId).Error; err != nil {
			return err
		}
		if reseller.Profit < item.Amount {
			return errors.New("profit not enough")
		}
		if err := tx.Create(item).Error; err != nil {
			return err
		}
		return tx.Model(&Reseller{}).Where("id = ?", item.ResellerId).Update("profit", gorm.Expr("profit - ?", item.Amount)).Error
	})
}

func GetResellerWithdrawals(resellerId int, pageInfo *common.PageInfo) ([]*ResellerWithdrawal, int64, error) {
	var items []*ResellerWithdrawal
	var total int64
	query := DB.Model(&ResellerWithdrawal{})
	if resellerId > 0 {
		query = query.Where("reseller_id = ?", resellerId)
	}
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	if err := query.Order("id desc").Limit(pageInfo.GetPageSize()).Offset(pageInfo.GetStartIdx()).Find(&items).Error; err != nil {
		return nil, 0, err
	}
	return items, total, nil
}

func GetResellerPendingWithdrawalAmount(resellerId int) (int64, error) {
	var pendingAmount int64
	err := DB.Model(&ResellerWithdrawal{}).
		Where("reseller_id = ? AND status IN ?", resellerId, []string{ResellerWithdrawalPending, ResellerWithdrawalApproved}).
		Select("COALESCE(SUM(amount), 0)").
		Scan(&pendingAmount).Error
	return pendingAmount, err
}

func AuditResellerWithdrawal(id int, reviewerId int, approve bool, remark string) error {
	return DB.Transaction(func(tx *gorm.DB) error {
		var item ResellerWithdrawal
		if err := lockForUpdate(tx).First(&item, "id = ?", id).Error; err != nil {
			return err
		}
		if item.Status != ResellerWithdrawalPending {
			return errors.New("withdrawal already audited")
		}
		if approve {
			item.Status = ResellerWithdrawalApproved
		} else {
			item.Status = ResellerWithdrawalRejected
			if err := tx.Model(&Reseller{}).Where("id = ?", item.ResellerId).Update("profit", gorm.Expr("profit + ?", item.Amount)).Error; err != nil {
				return err
			}
		}
		item.ReviewerId = reviewerId
		item.Remark = remark
		return tx.Save(&item).Error
	})
}

func MarkResellerWithdrawalPaid(id int, reviewerId int, paymentRef string, remark string) error {
	return DB.Transaction(func(tx *gorm.DB) error {
		var item ResellerWithdrawal
		if err := lockForUpdate(tx).First(&item, "id = ?", id).Error; err != nil {
			return err
		}
		if item.Status != ResellerWithdrawalApproved {
			return errors.New("withdrawal is not approved")
		}
		item.Status = ResellerWithdrawalPaid
		item.ReviewerId = reviewerId
		item.PaymentRef = paymentRef
		item.PaidAt = common.GetTimestamp()
		if remark != "" {
			item.Remark = remark
		}
		return tx.Save(&item).Error
	})
}

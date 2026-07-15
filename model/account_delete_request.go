package model

import (
	"errors"

	"github.com/QuantumNous/new-api/common"
)

const (
	AccountDeleteStatusPending  = "pending"
	AccountDeleteStatusApproved = "approved"
	AccountDeleteStatusRejected = "rejected"
	AccountDeleteStatusCanceled = "canceled"
)

type AccountDeleteRequest struct {
	Id           int    `json:"id"`
	UserId       int    `json:"user_id" gorm:"index;uniqueIndex:idx_delete_request_user_pending"`
	Username     string `json:"username" gorm:"index;type:varchar(64)"`
	Status       string `json:"status" gorm:"type:varchar(32);index;default:'pending';uniqueIndex:idx_delete_request_user_pending"`
	Reason       string `json:"reason" gorm:"type:varchar(255);default:''"`
	RequestedAt  int64  `json:"requested_at" gorm:"bigint;index"`
	ReviewedAt   int64  `json:"reviewed_at" gorm:"bigint;default:0"`
	ReviewerId   int    `json:"reviewer_id" gorm:"default:0"`
	ReviewerName string `json:"reviewer_name" gorm:"type:varchar(64);default:''"`
}

func (AccountDeleteRequest) TableName() string {
	return "account_delete_requests"
}

func CreateOrGetPendingDeleteRequest(userId int, username string, reason string) (*AccountDeleteRequest, bool, error) {
	var existed AccountDeleteRequest
	err := DB.Where("user_id = ? AND status = ?", userId, AccountDeleteStatusPending).First(&existed).Error
	if err == nil {
		return &existed, true, nil
	}
	request := &AccountDeleteRequest{
		UserId:      userId,
		Username:    username,
		Status:      AccountDeleteStatusPending,
		Reason:      reason,
		RequestedAt: common.GetTimestamp(),
	}
	if err := DB.Create(request).Error; err != nil {
		return nil, false, err
	}
	return request, false, nil
}

func GetLatestDeleteRequestByUserId(userId int) (*AccountDeleteRequest, error) {
	var request AccountDeleteRequest
	err := DB.Where("user_id = ?", userId).Order("id desc").First(&request).Error
	if err != nil {
		return nil, err
	}
	return &request, nil
}

func GetPendingDeleteRequestById(id int) (*AccountDeleteRequest, error) {
	var request AccountDeleteRequest
	err := DB.Where("id = ? AND status = ?", id, AccountDeleteStatusPending).First(&request).Error
	if err != nil {
		return nil, err
	}
	return &request, nil
}

func ListAccountDeleteRequests(status string, startIdx int, pageSize int) ([]*AccountDeleteRequest, int64, error) {
	query := DB.Model(&AccountDeleteRequest{})
	if status != "" {
		query = query.Where("status = ?", status)
	}
	var total int64
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	var list []*AccountDeleteRequest
	if err := query.Order("id desc").Offset(startIdx).Limit(pageSize).Find(&list).Error; err != nil {
		return nil, 0, err
	}
	return list, total, nil
}

func ApproveDeleteRequest(requestId int, reviewerId int, reviewerName string) error {
	request, err := GetPendingDeleteRequestById(requestId)
	if err != nil {
		return err
	}
	user, err := GetUserById(request.UserId, false)
	if err != nil {
		return err
	}
	if user.Role == common.RoleRootUser {
		return errors.New("不能删除 root 用户")
	}
	now := common.GetTimestamp()
	if err := DB.Model(&AccountDeleteRequest{}).Where("id = ?", request.Id).Updates(map[string]any{
		"status":        AccountDeleteStatusApproved,
		"reviewed_at":   now,
		"reviewer_id":   reviewerId,
		"reviewer_name": reviewerName,
	}).Error; err != nil {
		return err
	}
	return HardDeleteUserById(request.UserId)
}

func RejectDeleteRequest(requestId int, reviewerId int, reviewerName string, reason string) error {
	request, err := GetPendingDeleteRequestById(requestId)
	if err != nil {
		return err
	}
	return DB.Model(&AccountDeleteRequest{}).Where("id = ?", request.Id).Updates(map[string]any{
		"status":        AccountDeleteStatusRejected,
		"reason":        reason,
		"reviewed_at":   common.GetTimestamp(),
		"reviewer_id":   reviewerId,
		"reviewer_name": reviewerName,
	}).Error
}

func CancelDeleteRequestByUser(userId int) error {
	request, err := GetLatestDeleteRequestByUserId(userId)
	if err != nil {
		return err
	}
	if request.Status != AccountDeleteStatusPending {
		return errors.New("当前没有待处理的删除申请")
	}
	return DB.Model(&AccountDeleteRequest{}).Where("id = ?", request.Id).Updates(map[string]any{
		"status":      AccountDeleteStatusCanceled,
		"reviewed_at": common.GetTimestamp(),
	}).Error
}

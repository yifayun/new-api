package model

import (
	"errors"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"gorm.io/gorm"
)

// ErrResellerPortalNotAllowed is returned when the user is not allowed to use reseller portal APIs.
var ErrResellerPortalNotAllowed = errors.New("reseller portal not allowed for this user")

const (
	ResellerStatusEnabled  = 1
	ResellerStatusDisabled = 0
)

type Reseller struct {
	Id         int     `json:"id"`
	UserId     int     `json:"user_id" gorm:"uniqueIndex"`
	Name       string  `json:"name" gorm:"type:varchar(64);default:''"`
	Host       string  `json:"host" gorm:"type:varchar(255);uniqueIndex;default:''"`
	Logo       string  `json:"logo" gorm:"type:text"`
	SiteName   string  `json:"site_name" gorm:"type:varchar(128);default:''"`
	MarkupRate float64 `json:"markup_rate" gorm:"type:decimal(10,4);default:0"`
	Profit     int64   `json:"profit" gorm:"type:bigint;default:0"`
	Status     int     `json:"status" gorm:"type:int;default:1"`
	CreatedAt  int64   `json:"created_at" gorm:"autoCreateTime:milli"`
	UpdatedAt  int64   `json:"updated_at" gorm:"autoUpdateTime:milli"`
}

func normalizeHost(host string) string {
	host = strings.TrimSpace(strings.ToLower(host))
	host = strings.TrimPrefix(host, "http://")
	host = strings.TrimPrefix(host, "https://")
	host = strings.TrimSuffix(host, "/")
	host = strings.Split(host, ":")[0]
	return host
}

func GetResellerByHost(host string) (*Reseller, error) {
	host = normalizeHost(host)
	if host == "" {
		return nil, errors.New("host is empty")
	}
	var reseller Reseller
	err := DB.Where("host = ? AND status = ?", host, ResellerStatusEnabled).First(&reseller).Error
	if err != nil {
		return nil, err
	}
	return &reseller, nil
}

func GetResellerByUserID(userId int) (*Reseller, error) {
	if userId <= 0 {
		return nil, errors.New("invalid user id")
	}
	var reseller Reseller
	err := DB.Where("user_id = ?", userId).First(&reseller).Error
	if err != nil {
		return nil, err
	}
	return &reseller, nil
}

func GetResellerByID(id int) (*Reseller, error) {
	if id <= 0 {
		return nil, errors.New("invalid reseller id")
	}
	var reseller Reseller
	err := DB.First(&reseller, "id = ?", id).Error
	if err != nil {
		return nil, err
	}
	return &reseller, nil
}

func GetResellerByUserOrCreate(userId int) (*Reseller, error) {
	reseller, err := GetResellerByUserID(userId)
	if err == nil {
		return reseller, nil
	}
	reseller = &Reseller{
		UserId: userId,
		Status: ResellerStatusEnabled,
	}
	if createErr := DB.Create(reseller).Error; createErr != nil {
		return nil, createErr
	}
	return reseller, nil
}

// GetResellerByUserOrCreateIfAllowed loads or creates the reseller row only if the user has portal permission.
func GetResellerByUserOrCreateIfAllowed(userId int) (*Reseller, error) {
	var u User
	if err := DB.First(&u, userId).Error; err != nil {
		return nil, err
	}
	if !u.ResellerPortalAllowed {
		return nil, ErrResellerPortalNotAllowed
	}
	return GetResellerByUserOrCreate(userId)
}

func AddResellerProfit(resellerId int, delta int64) error {
	if resellerId <= 0 || delta == 0 {
		return nil
	}
	return DB.Model(&Reseller{}).Where("id = ?", resellerId).Update("profit", gorm.Expr("profit + ?", delta)).Error
}

func GetResellerMarkupByUserID(userId int) (int, float64) {
	if userId <= 0 {
		return 0, 1
	}
	resellerId, err := GetUserResellerId(userId)
	if err != nil || resellerId <= 0 {
		return 0, 1
	}
	reseller, err := GetResellerByID(resellerId)
	if err != nil || reseller == nil || reseller.Status != ResellerStatusEnabled {
		return 0, 1
	}
	// MarkupRate is incremental rate. e.g. 0.1 => +10%.
	effectiveMarkupRate := reseller.MarkupRate
	if effectiveMarkupRate < 0 {
		effectiveMarkupRate = 0
	}
	if common.ResellerMarkupMaxDelta >= 0 && effectiveMarkupRate > common.ResellerMarkupMaxDelta {
		effectiveMarkupRate = common.ResellerMarkupMaxDelta
	}
	if effectiveMarkupRate <= 0 {
		return reseller.Id, 1
	}
	return reseller.Id, 1 + effectiveMarkupRate
}

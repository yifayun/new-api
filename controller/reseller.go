package controller

import (
	"errors"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/i18n"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
)

type resellerWithdrawalReq struct {
	Amount  int64  `json:"amount"`
	Account string `json:"account"`
	Remark  string `json:"remark"`
}

type adminPaidReq struct {
	PaymentRef string `json:"payment_ref"`
	Remark     string `json:"remark"`
}

type resellerProfileUpdateReq struct {
	Host       string  `json:"host"`
	Logo       string  `json:"logo"`
	SiteName   string  `json:"site_name"`
	MarkupRate float64 `json:"markup_rate"`
	Name       string  `json:"name"`
}

func GetResellerProfile(c *gin.Context) {
	userId := c.GetInt("id")
	reseller, err := model.GetResellerByUserOrCreateIfAllowed(userId)
	if err != nil {
		if errors.Is(err, model.ErrResellerPortalNotAllowed) {
			common.ApiErrorI18n(c, i18n.MsgUserResellerPortalNotAllowed)
			return
		}
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, reseller)
}

func UpdateResellerProfile(c *gin.Context) {
	userId := c.GetInt("id")
	reseller, err := model.GetResellerByUserOrCreateIfAllowed(userId)
	if err != nil {
		if errors.Is(err, model.ErrResellerPortalNotAllowed) {
			common.ApiErrorI18n(c, i18n.MsgUserResellerPortalNotAllowed)
			return
		}
		common.ApiError(c, err)
		return
	}
	var req resellerProfileUpdateReq
	if err = c.ShouldBindJSON(&req); err != nil {
		common.ApiError(c, err)
		return
	}
	updates := map[string]interface{}{
		"host":      strings.TrimSpace(req.Host),
		"logo":      strings.TrimSpace(req.Logo),
		"site_name": strings.TrimSpace(req.SiteName),
		"name":      strings.TrimSpace(req.Name),
	}
	// MarkupRate is incremental ratio, >=0 means only up-pricing.
	if req.MarkupRate < 0 {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": "markup_rate must be >= 0"})
		return
	}
	if common.ResellerMarkupMaxDelta >= 0 && req.MarkupRate > common.ResellerMarkupMaxDelta {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": "markup_rate exceeds system limit"})
		return
	}
	updates["markup_rate"] = req.MarkupRate
	if err = model.DB.Model(&model.Reseller{}).Where("id = ?", reseller.Id).Updates(updates).Error; err != nil {
		common.ApiError(c, err)
		return
	}
	reseller, _ = model.GetResellerByID(reseller.Id)
	common.ApiSuccess(c, reseller)
}

func GetResellerProfitLogs(c *gin.Context) {
	userId := c.GetInt("id")
	reseller, err := model.GetResellerByUserOrCreateIfAllowed(userId)
	if err != nil {
		if errors.Is(err, model.ErrResellerPortalNotAllowed) {
			common.ApiErrorI18n(c, i18n.MsgUserResellerPortalNotAllowed)
			return
		}
		common.ApiError(c, err)
		return
	}
	userFilter, _ := strconv.Atoi(strings.TrimSpace(c.Query("user_id")))
	startAt, _ := strconv.ParseInt(strings.TrimSpace(c.Query("start_at")), 10, 64)
	endAt, _ := strconv.ParseInt(strings.TrimSpace(c.Query("end_at")), 10, 64)
	pageInfo := common.GetPageQuery(c)
	items, total, err := model.GetResellerProfitsWithFilters(reseller.Id, userFilter, startAt, endAt, pageInfo)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	pageInfo.SetTotal(int(total))
	pageInfo.SetItems(items)
	common.ApiSuccess(c, pageInfo)
}

func GetResellerProfitSummary(c *gin.Context) {
	userId := c.GetInt("id")
	reseller, err := model.GetResellerByUserOrCreateIfAllowed(userId)
	if err != nil {
		if errors.Is(err, model.ErrResellerPortalNotAllowed) {
			common.ApiErrorI18n(c, i18n.MsgUserResellerPortalNotAllowed)
			return
		}
		common.ApiError(c, err)
		return
	}
	totalSale, totalBase, totalProfit, err := model.GetResellerProfitSummary(reseller.Id)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	now := time.Now()
	startOfDay := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, now.Location()).UnixMilli()
	todayProfit, err := model.GetResellerProfitTotalByTimeRange(reseller.Id, startOfDay, 0)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	pendingWithdrawal, err := model.GetResellerPendingWithdrawalAmount(reseller.Id)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, gin.H{
		"reseller_id":       reseller.Id,
		"total_sale":        totalSale,
		"total_base_cost":   totalBase,
		"total_profit":      totalProfit,
		"today_profit":      todayProfit,
		"withdrawable":      reseller.Profit,
		"pending_withdrawal": pendingWithdrawal,
		"markup_rate":       reseller.MarkupRate,
		"markup_multiplier": 1 + reseller.MarkupRate,
	})
}

func GetResellerWithdrawals(c *gin.Context) {
	userId := c.GetInt("id")
	reseller, err := model.GetResellerByUserOrCreateIfAllowed(userId)
	if err != nil {
		if errors.Is(err, model.ErrResellerPortalNotAllowed) {
			common.ApiErrorI18n(c, i18n.MsgUserResellerPortalNotAllowed)
			return
		}
		common.ApiError(c, err)
		return
	}
	pageInfo := common.GetPageQuery(c)
	items, total, err := model.GetResellerWithdrawals(reseller.Id, pageInfo)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	pageInfo.SetTotal(int(total))
	pageInfo.SetItems(items)
	common.ApiSuccess(c, pageInfo)
}

func CreateResellerWithdrawal(c *gin.Context) {
	userId := c.GetInt("id")
	reseller, err := model.GetResellerByUserOrCreateIfAllowed(userId)
	if err != nil {
		if errors.Is(err, model.ErrResellerPortalNotAllowed) {
			common.ApiErrorI18n(c, i18n.MsgUserResellerPortalNotAllowed)
			return
		}
		common.ApiError(c, err)
		return
	}
	var req resellerWithdrawalReq
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiError(c, err)
		return
	}
	item := &model.ResellerWithdrawal{
		ResellerId: reseller.Id,
		UserId:     userId,
		Amount:     req.Amount,
		Account:    strings.TrimSpace(req.Account),
		Remark:     strings.TrimSpace(req.Remark),
	}
	if err := model.CreateResellerWithdrawal(item); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, item)
}

func GetResellerUsers(c *gin.Context) {
	userId := c.GetInt("id")
	reseller, err := model.GetResellerByUserOrCreateIfAllowed(userId)
	if err != nil {
		if errors.Is(err, model.ErrResellerPortalNotAllowed) {
			common.ApiErrorI18n(c, i18n.MsgUserResellerPortalNotAllowed)
			return
		}
		common.ApiError(c, err)
		return
	}
	pageInfo := common.GetPageQuery(c)
	users, total, err := model.GetUsersByResellerID(reseller.Id, pageInfo)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	for _, u := range users {
		u.Email = common.MaskEmail(u.Email)
		u.Phone = common.MaskPhone(u.Phone)
		u.Username = common.MaskName(u.Username)
		u.RealNameVerified = false
		u.RealNameStatus = "hidden"
		u.RealNameType = ""
		u.RealNameName = ""
		u.RealNameIdCard = ""
		u.RealNameCompanyName = ""
		u.RealNameCompanyTaxNo = ""
		u.RealNameBusinessLicenseImage = ""
		u.ZhimaBizNo = ""
		u.ZhimaCertifyID = ""
		u.RealNameManualReviewerId = 0
		u.RealNameManualReviewAt = 0
		u.RealNameManualReviewRemark = ""
	}
	pageInfo.SetTotal(int(total))
	pageInfo.SetItems(users)
	common.ApiSuccess(c, pageInfo)
}

func AdminGetResellerWithdrawals(c *gin.Context) {
	pageInfo := common.GetPageQuery(c)
	items, total, err := model.GetResellerWithdrawals(0, pageInfo)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	pageInfo.SetTotal(int(total))
	pageInfo.SetItems(items)
	common.ApiSuccess(c, pageInfo)
}

func AdminApproveResellerWithdrawal(c *gin.Context) {
	id, _ := strconv.Atoi(c.Param("id"))
	reviewerId := c.GetInt("id")
	if err := model.AuditResellerWithdrawal(id, reviewerId, true, ""); err != nil {
		common.ApiError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "message": ""})
}

func AdminRejectResellerWithdrawal(c *gin.Context) {
	id, _ := strconv.Atoi(c.Param("id"))
	reviewerId := c.GetInt("id")
	if err := model.AuditResellerWithdrawal(id, reviewerId, false, strings.TrimSpace(c.Query("remark"))); err != nil {
		common.ApiError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "message": ""})
}

func AdminPaidResellerWithdrawal(c *gin.Context) {
	id, _ := strconv.Atoi(c.Param("id"))
	reviewerId := c.GetInt("id")
	var req adminPaidReq
	_ = c.ShouldBindJSON(&req)
	if err := model.MarkResellerWithdrawalPaid(id, reviewerId, strings.TrimSpace(req.PaymentRef), strings.TrimSpace(req.Remark)); err != nil {
		common.ApiError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "message": ""})
}

package controller

import (
	"errors"
	"strconv"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type accountDeleteReviewRequest struct {
	Reason string `json:"reason"`
}

func CreateAccountDeleteRequest(c *gin.Context) {
	userId := c.GetInt("id")
	username := c.GetString("username")
	if userId == 0 {
		common.ApiErrorMsg(c, "用户未登录")
		return
	}
	user, err := model.GetUserById(userId, false)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if user.Role == common.RoleRootUser {
		common.ApiErrorMsg(c, "root 用户不允许删除")
		return
	}
	request, existed, err := model.CreateOrGetPendingDeleteRequest(userId, username, "")
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if existed {
		common.ApiSuccess(c, gin.H{
			"already_pending": true,
			"request":         request,
		})
		return
	}
	common.ApiSuccess(c, gin.H{
		"already_pending": false,
		"request":         request,
	})
}

func GetMyAccountDeleteRequest(c *gin.Context) {
	userId := c.GetInt("id")
	request, err := model.GetLatestDeleteRequestByUserId(userId)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			common.ApiSuccess(c, nil)
			return
		}
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, request)
}

func CancelMyAccountDeleteRequest(c *gin.Context) {
	userId := c.GetInt("id")
	if err := model.CancelDeleteRequestByUser(userId); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, nil)
}

func AdminListAccountDeleteRequests(c *gin.Context) {
	pageInfo := common.GetPageQuery(c)
	status := c.Query("status")
	list, total, err := model.ListAccountDeleteRequests(status, pageInfo.GetStartIdx(), pageInfo.GetPageSize())
	if err != nil {
		common.ApiError(c, err)
		return
	}
	pageInfo.SetTotal(int(total))
	pageInfo.SetItems(list)
	common.ApiSuccess(c, pageInfo)
}

func AdminApproveAccountDeleteRequest(c *gin.Context) {
	requestId, err := strconv.Atoi(c.Param("id"))
	if err != nil || requestId <= 0 {
		common.ApiErrorMsg(c, "参数错误")
		return
	}
	reviewerId := c.GetInt("id")
	reviewerName := c.GetString("username")
	reviewerRole := c.GetInt("role")
	if err := model.ApproveDeleteRequest(requestId, reviewerId, reviewerName, reviewerRole); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, nil)
}

func AdminRejectAccountDeleteRequest(c *gin.Context) {
	requestId, err := strconv.Atoi(c.Param("id"))
	if err != nil || requestId <= 0 {
		common.ApiErrorMsg(c, "参数错误")
		return
	}
	var req accountDeleteReviewRequest
	_ = c.ShouldBindJSON(&req)
	reviewerId := c.GetInt("id")
	reviewerName := c.GetString("username")
	if err := model.RejectDeleteRequest(requestId, reviewerId, reviewerName, req.Reason); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, nil)
}

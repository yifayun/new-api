package controller

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/gin-gonic/gin"
)

var phoneRegex = regexp.MustCompile(`^1[3-9]\d{9}$`)

type realNameRequest struct {
	RealName             string `json:"real_name"`
	IdCard               string `json:"id_card"`
	RealNameType         string `json:"real_name_type"`
	CompanyName          string `json:"company_name"`
	CompanyTaxNo         string `json:"company_tax_no"`
	BusinessLicenseImage string `json:"business_license_image"`
}

func SendPhoneVerification(c *gin.Context) {
	phone := strings.TrimSpace(c.Query("phone"))
	if !phoneRegex.MatchString(phone) {
		common.ApiError(c, errors.New("手机号格式错误"))
		return
	}
	if model.IsPhoneAlreadyTaken(phone) {
		common.ApiError(c, errors.New("手机号已被占用"))
		return
	}
	code := common.GenerateVerificationCode(6)
	common.RegisterVerificationCodeWithKey(phone, code, common.PhoneVerificationPurpose)
	if err := common.SendAliyunSMS(phone, code); err != nil {
		common.ApiError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "message": ""})
}

func InitiateRealName(c *gin.Context) {
	if !common.RealNameVerificationEnabled {
		common.ApiError(c, errors.New("实名认证未启用"))
		return
	}
	var req realNameRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiError(c, errors.New("请求参数错误"))
		return
	}
	req.RealName = strings.TrimSpace(req.RealName)
	req.IdCard = strings.TrimSpace(req.IdCard)
	req.RealNameType = strings.TrimSpace(strings.ToLower(req.RealNameType))
	req.CompanyName = strings.TrimSpace(req.CompanyName)
	req.CompanyTaxNo = strings.TrimSpace(req.CompanyTaxNo)
	req.BusinessLicenseImage = strings.TrimSpace(req.BusinessLicenseImage)
	if req.RealName == "" || req.IdCard == "" {
		common.ApiError(c, errors.New("姓名和身份证号不能为空"))
		return
	}

	id := c.GetInt("id")
	user, err := model.GetUserById(id, true)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	currentType := strings.TrimSpace(strings.ToLower(user.RealNameType))
	if currentType == "" {
		currentType = "personal"
	}
	if req.RealNameType == "" {
		// Keep current type by default to avoid accidental downgrade.
		req.RealNameType = currentType
	}
	// Support personal -> enterprise upgrade, but forbid enterprise -> personal downgrade.
	if currentType == "enterprise" && req.RealNameType == "personal" {
		common.ApiError(c, errors.New("不支持企业认证降级为个人认证"))
		return
	}

	// 企业实名：也必须先通过芝麻扫脸，扫脸通过后再进入管理员审核。
	if req.RealNameType == "enterprise" {
		if req.CompanyName == "" || req.CompanyTaxNo == "" || req.BusinessLicenseImage == "" {
			common.ApiError(c, errors.New("企业实名需填写企业名称、企业税号并上传营业执照"))
			return
		}
	}

	outerOrderNo := fmt.Sprintf("newapi_rm_%d_%d", id, time.Now().UnixNano())
	returnURL := service.PaymentReturnURL("/realname-guide")
	biz := map[string]any{
		"biz_code":       "SMART_FACE",
		"outer_order_no": outerOrderNo,
		"identity_param": map[string]any{
			"identity_type": "CERT_INFO",
			"cert_type":     "IDENTITY_CARD",
			"cert_name":     req.RealName,
			"cert_no":       req.IdCard,
		},
		"merchant_config": map[string]any{
			"face_reserve_strategy": "reserve",
			"return_url":            returnURL,
		},
	}
	bizStr, _ := json.Marshal(biz)
	resp, err := common.CallZhimaInit(string(bizStr))
	if err != nil {
		common.ApiError(c, err)
		return
	}
	user.RealNameStatus = "pending"
	user.RealNameVerified = false
	user.RealNameType = req.RealNameType
	if user.RealNameType == "" {
		user.RealNameType = "personal"
	}
	user.RealNameName = req.RealName
	user.RealNameIdCard = req.IdCard
	if user.RealNameType == "enterprise" {
		user.RealNameCompanyName = req.CompanyName
		user.RealNameCompanyTaxNo = req.CompanyTaxNo
		user.RealNameBusinessLicenseImage = req.BusinessLicenseImage
	} else {
		user.RealNameCompanyName = ""
		user.RealNameCompanyTaxNo = ""
		user.RealNameBusinessLicenseImage = ""
	}
	user.RealNameManualReviewerId = 0
	user.RealNameManualReviewAt = 0
	user.RealNameManualReviewRemark = ""
	user.ZhimaBizNo = outerOrderNo
	user.ZhimaCertifyID = resp.CertifyID
	if err = user.UpdateRealNameState(); err != nil {
		common.ApiError(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data": gin.H{
			"certify_id":         resp.CertifyID,
			"certify_url":        resp.CertifyURL,
			"certify_alipays_url": resp.CertifyAppURL,
			"certify_form": resp.CertifyForm,
			"status":             user.RealNameStatus,
		},
	})
}

func RefreshRealName(c *gin.Context) {
	id := c.GetInt("id")
	user, err := model.GetUserById(id, true)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if strings.ToLower(user.RealNameType) == "enterprise" {
		if user.RealNameStatus == "pending" || user.RealNameStatus == "none" || user.RealNameStatus == "" {
			if user.ZhimaCertifyID == "" {
				common.ApiError(c, errors.New("未发起实名认证"))
				return
			}
			result, queryErr := common.CallZhimaQuery(user.ZhimaCertifyID)
			if queryErr != nil {
				common.ApiError(c, queryErr)
				return
			}
			switch strings.ToUpper(result.Passed) {
			case "T":
				// Face verification passed, now wait for admin enterprise review.
				user.RealNameVerified = false
				user.RealNameStatus = "enterprise_pending"
			case "F":
				user.RealNameVerified = false
				user.RealNameStatus = "rejected"
			default:
				user.RealNameVerified = false
				user.RealNameStatus = "pending"
			}
			if err = user.UpdateRealNameState(); err != nil {
				common.ApiError(c, err)
				return
			}
		}
		paidTotal, paidErr := model.GetUserSuccessfulTopupTotalMoney(id)
		if paidErr != nil {
			common.ApiError(c, paidErr)
			return
		}
		requiredPayment := common.RealNameRequiredPayment
		paymentSatisfied := requiredPayment <= 0 || paidTotal >= requiredPayment
		c.JSON(http.StatusOK, gin.H{"success": true, "message": "", "data": gin.H{
			"real_name_verified":             user.RealNameVerified,
			"real_name_status":               user.RealNameStatus,
			"real_name_type":                 user.RealNameType,
			"real_name_company_name":         user.RealNameCompanyName,
			"real_name_company_tax_no":       user.RealNameCompanyTaxNo,
			"real_name_manual_review_remark": user.RealNameManualReviewRemark,
			"realname_required_payment":      requiredPayment,
			"realname_paid_total":            paidTotal,
			"realname_payment_satisfied":     paymentSatisfied,
		}})
		return
	}
	// Personal real-name terminal states should not query Zhima again.
	// The remote certify id may expire and return CERTIFY_ID_EXPIRED,
	// while local final status is already authoritative.
	if user.RealNameStatus == "passed" || user.RealNameStatus == "rejected" {
		paidTotal, paidErr := model.GetUserSuccessfulTopupTotalMoney(id)
		if paidErr != nil {
			common.ApiError(c, paidErr)
			return
		}
		requiredPayment := common.RealNameRequiredPayment
		paymentSatisfied := requiredPayment <= 0 || paidTotal >= requiredPayment
		c.JSON(http.StatusOK, gin.H{"success": true, "message": "", "data": gin.H{
			"real_name_verified":             user.RealNameVerified,
			"real_name_status":               user.RealNameStatus,
			"real_name_type":                 user.RealNameType,
			"real_name_company_name":         user.RealNameCompanyName,
			"real_name_company_tax_no":       user.RealNameCompanyTaxNo,
			"real_name_manual_review_remark": user.RealNameManualReviewRemark,
			"realname_required_payment":      requiredPayment,
			"realname_paid_total":            paidTotal,
			"realname_payment_satisfied":     paymentSatisfied,
		}})
		return
	}
	if user.ZhimaCertifyID == "" {
		common.ApiError(c, errors.New("未发起实名认证"))
		return
	}
	result, err := common.CallZhimaQuery(user.ZhimaCertifyID)
	if err != nil {
		common.ApiError(c, err)
		return
	}

	switch strings.ToUpper(result.Passed) {
	case "T":
		user.RealNameVerified = true
		user.RealNameStatus = "passed"
	case "F":
		user.RealNameVerified = false
		user.RealNameStatus = "rejected"
	default:
		user.RealNameStatus = "pending"
	}
	if err = user.UpdateRealNameState(); err != nil {
		common.ApiError(c, err)
		return
	}
	paidTotal, paidErr := model.GetUserSuccessfulTopupTotalMoney(id)
	if paidErr != nil {
		common.ApiError(c, paidErr)
		return
	}
	requiredPayment := common.RealNameRequiredPayment
	paymentSatisfied := requiredPayment <= 0 || paidTotal >= requiredPayment
	c.JSON(http.StatusOK, gin.H{"success": true, "message": "", "data": gin.H{
		"real_name_verified":             user.RealNameVerified,
		"real_name_status":               user.RealNameStatus,
		"real_name_type":                 user.RealNameType,
		"real_name_company_name":         user.RealNameCompanyName,
		"real_name_company_tax_no":       user.RealNameCompanyTaxNo,
		"real_name_manual_review_remark": user.RealNameManualReviewRemark,
		"realname_required_payment":      requiredPayment,
		"realname_paid_total":            paidTotal,
		"realname_payment_satisfied":     paymentSatisfied,
	}})
}

func GetEnterpriseRealNameReviewList(c *gin.Context) {
	pageInfo := common.GetPageQuery(c)
	status := strings.TrimSpace(c.Query("status"))
	if status == "" {
		status = "enterprise_pending"
	}
	if status != "enterprise_pending" && status != "enterprise_rejected" {
		common.ApiError(c, errors.New("无效的状态参数"))
		return
	}
	users, total, err := model.ListEnterpriseRealNameReviewUsers(status, pageInfo)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	pageInfo.SetTotal(int(total))
	pageInfo.SetItems(users)
	common.ApiSuccess(c, pageInfo)
}

func GetRealNameStatus(c *gin.Context) {
	id := c.GetInt("id")
	user, err := model.GetUserById(id, false)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	paidTotal, paidErr := model.GetUserSuccessfulTopupTotalMoney(id)
	if paidErr != nil {
		common.ApiError(c, paidErr)
		return
	}
	requiredPayment := common.RealNameRequiredPayment
	paymentSatisfied := requiredPayment <= 0 || paidTotal >= requiredPayment
	c.JSON(http.StatusOK, gin.H{"success": true, "message": "", "data": gin.H{
		"real_name_verified":           user.RealNameVerified,
		"real_name_status":             user.RealNameStatus,
		"real_name_type":               user.RealNameType,
		"real_name_company_name":       user.RealNameCompanyName,
		"real_name_company_tax_no":     user.RealNameCompanyTaxNo,
		"real_name_business_license_image": user.RealNameBusinessLicenseImage,
		"real_name_manual_review_remark":   user.RealNameManualReviewRemark,
		"realname_required_payment":    requiredPayment,
		"realname_paid_total":          paidTotal,
		"realname_payment_satisfied":   paymentSatisfied,
	}})
}

type manualRealNameReviewRequest struct {
	Remark string `json:"remark"`
}

func AdminApproveEnterpriseRealName(c *gin.Context) {
	id, _ := strconv.Atoi(c.Param("id"))
	user, err := model.GetUserById(id, true)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if strings.ToLower(user.RealNameType) != "enterprise" || user.RealNameStatus != "enterprise_pending" {
		common.ApiError(c, errors.New("当前用户不是待审核的企业实名状态"))
		return
	}
	var req manualRealNameReviewRequest
	_ = c.ShouldBindJSON(&req)
	user.RealNameVerified = true
	user.RealNameStatus = "passed"
	user.RealNameManualReviewerId = c.GetInt("id")
	user.RealNameManualReviewAt = time.Now().Unix()
	user.RealNameManualReviewRemark = strings.TrimSpace(req.Remark)
	if err = user.UpdateRealNameState(); err != nil {
		common.ApiError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "message": ""})
}

func AdminRejectEnterpriseRealName(c *gin.Context) {
	id, _ := strconv.Atoi(c.Param("id"))
	user, err := model.GetUserById(id, true)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if strings.ToLower(user.RealNameType) != "enterprise" || user.RealNameStatus != "enterprise_pending" {
		common.ApiError(c, errors.New("当前用户不是待审核的企业实名状态"))
		return
	}
	var req manualRealNameReviewRequest
	_ = c.ShouldBindJSON(&req)
	user.RealNameVerified = false
	user.RealNameStatus = "enterprise_rejected"
	user.RealNameManualReviewerId = c.GetInt("id")
	user.RealNameManualReviewAt = time.Now().Unix()
	user.RealNameManualReviewRemark = strings.TrimSpace(req.Remark)
	if err = user.UpdateRealNameState(); err != nil {
		common.ApiError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "message": ""})
}

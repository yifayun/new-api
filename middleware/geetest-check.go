package middleware

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"net/http"
	"net/url"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/gin-gonic/gin"
)

type geetestValidateResponse struct {
	Result string `json:"result"`
	Reason string `json:"reason"`
}

func GeetestCheck() gin.HandlerFunc {
	return func(c *gin.Context) {
		if !common.GeetestVerifyEnabled {
			c.Next()
			return
		}
		if common.GeetestCaptchaID == "" || common.GeetestCaptchaKey == "" {
			c.JSON(http.StatusOK, gin.H{
				"success": false,
				"message": "极验未完成配置，请联系管理员",
			})
			c.Abort()
			return
		}

		lotNumber := strings.TrimSpace(c.Query("geetest_lot_number"))
		captchaOutput := strings.TrimSpace(c.Query("geetest_captcha_output"))
		passToken := strings.TrimSpace(c.Query("geetest_pass_token"))
		genTime := strings.TrimSpace(c.Query("geetest_gen_time"))

		if lotNumber == "" || captchaOutput == "" || passToken == "" || genTime == "" {
			c.JSON(http.StatusOK, gin.H{
				"success": false,
				"message": "请先完成极验人机验证",
			})
			c.Abort()
			return
		}

		mac := hmac.New(sha256.New, []byte(common.GeetestCaptchaKey))
		mac.Write([]byte(lotNumber))
		signToken := hex.EncodeToString(mac.Sum(nil))

		rawRes, err := http.PostForm("https://gcaptcha4.geetest.com/validate", url.Values{
			"captcha_id":     {common.GeetestCaptchaID},
			"lot_number":     {lotNumber},
			"captcha_output": {captchaOutput},
			"pass_token":     {passToken},
			"gen_time":       {genTime},
			"sign_token":     {signToken},
		})
		if err != nil {
			common.SysLog("geetest validate request failed: " + err.Error())
			c.JSON(http.StatusOK, gin.H{
				"success": false,
				"message": "极验校验失败，请稍后重试",
			})
			c.Abort()
			return
		}
		defer rawRes.Body.Close()

		var res geetestValidateResponse
		if err = json.NewDecoder(rawRes.Body).Decode(&res); err != nil {
			common.SysLog("geetest validate parse failed: " + err.Error())
			c.JSON(http.StatusOK, gin.H{
				"success": false,
				"message": "极验校验失败，请稍后重试",
			})
			c.Abort()
			return
		}

		if strings.ToLower(res.Result) != "success" {
			common.SysLog("geetest validate rejected: " + res.Reason)
			c.JSON(http.StatusOK, gin.H{
				"success": false,
				"message": "极验校验未通过，请重试",
			})
			c.Abort()
			return
		}

		c.Next()
	}
}

package common

import (
	"bytes"
	"crypto"
	"crypto/rand"
	"crypto/rsa"
	"crypto/sha256"
	"crypto/x509"
	"encoding/base64"
	"encoding/json"
	"encoding/pem"
	"errors"
	"fmt"
	"html"
	"io"
	"net"
	"net/http"
	"net/url"
	"sort"
	"strings"
	"time"
)

func normalizePrivateKeyPEM(raw string) string {
	s := strings.TrimSpace(raw)
	if s == "" {
		return s
	}
	// 兼容在后台输入框保存后的转义换行
	s = strings.ReplaceAll(s, "\\r\\n", "\n")
	s = strings.ReplaceAll(s, "\\n", "\n")
	s = strings.ReplaceAll(s, "\r\n", "\n")
	s = strings.ReplaceAll(s, "\r", "\n")

	if strings.Contains(s, "-----BEGIN") {
		return s
	}
	// 兼容仅粘贴了 base64 私钥体的场景
	s = strings.ReplaceAll(s, " ", "")
	s = strings.ReplaceAll(s, "\n", "")
	if s == "" {
		return s
	}
	var wrapped strings.Builder
	for i := 0; i < len(s); i += 64 {
		end := i + 64
		if end > len(s) {
			end = len(s)
		}
		wrapped.WriteString(s[i:end])
		wrapped.WriteString("\n")
	}
	return "-----BEGIN PRIVATE KEY-----\n" + wrapped.String() + "-----END PRIVATE KEY-----"
}

func parseRSAPrivateKey(raw string) (*rsa.PrivateKey, error) {
	normalized := normalizePrivateKeyPEM(raw)
	block, _ := pem.Decode([]byte(normalized))
	if block == nil {
		return nil, fmt.Errorf("无效的私钥 PEM")
	}
	key, err := x509.ParsePKCS8PrivateKey(block.Bytes)
	if err == nil {
		rsaKey, ok := key.(*rsa.PrivateKey)
		if !ok {
			return nil, fmt.Errorf("私钥类型错误")
		}
		return rsaKey, nil
	}
	rsaKey, err2 := x509.ParsePKCS1PrivateKey(block.Bytes)
	if err2 != nil {
		return nil, err
	}
	return rsaKey, nil
}

func signAlipayParams(params map[string]string, privateKey string) (string, error) {
	keys := make([]string, 0, len(params))
	for k := range params {
		if k == "sign" || params[k] == "" {
			continue
		}
		keys = append(keys, k)
	}
	sort.Strings(keys)
	parts := make([]string, 0, len(keys))
	for _, k := range keys {
		parts = append(parts, k+"="+params[k])
	}
	content := strings.Join(parts, "&")

	rsaKey, err := parseRSAPrivateKey(privateKey)
	if err != nil {
		return "", err
	}
	hash := sha256.Sum256([]byte(content))
	signature, err := rsa.SignPKCS1v15(rand.Reader, rsaKey, crypto.SHA256, hash[:])
	if err != nil {
		return "", err
	}
	return base64.StdEncoding.EncodeToString(signature), nil
}

func buildAlipayOpenParams(method string, bizContent string) (string, map[string]string, error) {
	if ZhimaAppId == "" || ZhimaPrivateKey == "" {
		return "", nil, fmt.Errorf("芝麻实名认证配置不完整")
	}
	gateway := ZhimaGatewayURL
	if gateway == "" {
		gateway = "https://openapi.alipay.com/gateway.do"
	}
	params := map[string]string{
		"app_id":      ZhimaAppId,
		"method":      method,
		"format":      "JSON",
		"charset":     "UTF-8",
		"sign_type":   "RSA2",
		"timestamp":   time.Now().Format("2006-01-02 15:04:05"),
		"version":     "1.0",
		"biz_content": bizContent,
	}
	if strings.TrimSpace(ZhimaAppAuthToken) != "" {
		// 支持服务商第三方代调用场景
		params["app_auth_token"] = strings.TrimSpace(ZhimaAppAuthToken)
	}
	sign, err := signAlipayParams(params, ZhimaPrivateKey)
	if err != nil {
		return "", nil, err
	}
	params["sign"] = sign
	return gateway, params, nil
}

func callZhima(method string, bizContent string) (map[string]any, error) {
	// External network/Alipay gateway can jitter in production.
	// Retry a few times before failing the real-name flow.
	//
	// IMPORTANT: Always re-sign on retry (timestamp/sign changes).
	client := &http.Client{Timeout: 20 * time.Second}

	var (
		lastErr      error
		lastRespBody []byte
	)

	for attempt := 1; attempt <= 3; attempt++ {
		gateway, params, err := buildAlipayOpenParams(method, bizContent)
		if err != nil {
			return nil, err
		}

		// Keep parameter ordering deterministic to avoid any charset/signature mismatch
		// caused by map iteration differences across runtimes.
		keys := make([]string, 0, len(params))
		for k := range params {
			keys = append(keys, k)
		}
		sort.Strings(keys)
		values := url.Values{}
		for _, k := range keys {
			values.Set(k, params[k])
		}
		payload := values.Encode()

		req, reqErr := http.NewRequest(http.MethodPost, gateway, bytes.NewBufferString(payload))
		if reqErr != nil {
			return nil, reqErr
		}
		req.Header.Set("Content-Type", "application/x-www-form-urlencoded; charset=UTF-8")
		req.Header.Set("Accept-Charset", "UTF-8")

		resp, requestErr := client.Do(req)
		if requestErr != nil {
			lastErr = requestErr
			var netErr net.Error
			if errors.As(lastErr, &netErr) && netErr.Timeout() {
				lastErr = fmt.Errorf("连接芝麻实名认证服务超时，请稍后重试")
			}
		} else {
			defer resp.Body.Close()
			lastRespBody, _ = io.ReadAll(resp.Body)

			if resp.StatusCode >= http.StatusInternalServerError {
				lastErr = fmt.Errorf("芝麻实名认证服务不可用，状态码: %d", resp.StatusCode)
			} else {
				var data map[string]any
				if err := json.Unmarshal(lastRespBody, &data); err != nil {
					lastErr = err
				} else {
					// Retry on common Alipay "system busy/unknown" business failures.
					// Response key varies by method; we scan the top-level response object.
					var respRaw map[string]any
					for k, v := range data {
						if strings.HasSuffix(k, "_response") {
							if m, ok := v.(map[string]any); ok {
								respRaw = m
								break
							}
						}
					}
					if respRaw != nil {
						code, _ := respRaw["code"].(string)
						subCode, _ := respRaw["sub_code"].(string)
						if code != "" && code != "10000" && (subCode == "UNKNOWN_ERROR" || subCode == "SYSTEM_ERROR") {
							lastErr = fmt.Errorf("芝麻实名认证服务繁忙，请稍后重试 (%s)", subCode)
						} else {
							return data, nil
						}
					} else {
						return data, nil
					}
				}
			}
		}

		if attempt < 3 {
			time.Sleep(time.Duration(attempt) * 800 * time.Millisecond)
		}
	}

	// If we got here, retries exhausted. Emit response body to logs for diagnosis.
	if len(lastRespBody) > 0 {
		SysLog("alipay gateway response: " + string(lastRespBody))
	}
	if lastErr != nil {
		return nil, lastErr
	}
	return nil, fmt.Errorf("芝麻实名认证调用失败")
}

func buildOpenCertifyURL(certifyID string) (string, error) {
	biz := map[string]any{"certify_id": certifyID}
	bizBytes, _ := json.Marshal(biz)
	gateway, params, err := buildAlipayOpenParams("alipay.user.certify.open.certify", string(bizBytes))
	if err != nil {
		return "", err
	}
	values := url.Values{}
	keys := make([]string, 0, len(params))
	for k := range params {
		keys = append(keys, k)
	}
	sort.Strings(keys)
	for _, k := range keys {
		values.Set(k, params[k])
	}
	return gateway + "?" + values.Encode(), nil
}

func buildOpenCertifyForm(certifyID string) (string, error) {
	biz := map[string]any{"certify_id": certifyID}
	bizBytes, _ := json.Marshal(biz)
	gateway, params, err := buildAlipayOpenParams("alipay.user.certify.open.certify", string(bizBytes))
	if err != nil {
		return "", err
	}
	// Match Alipay SDK pageExecute output:
	// - public params in form action query
	// - biz_content as hidden field in POST body
	actionValues := url.Values{}
	actionKeys := []string{
		"charset",
		"method",
		"format",
		"sign",
		"version",
		"app_id",
		"sign_type",
		"timestamp",
	}
	for _, k := range actionKeys {
		if v, ok := params[k]; ok && strings.TrimSpace(v) != "" {
			actionValues.Set(k, v)
		}
	}
	if v := strings.TrimSpace(params["return_url"]); v != "" {
		actionValues.Set("return_url", v)
	}
	if v := strings.TrimSpace(params["app_auth_token"]); v != "" {
		actionValues.Set("app_auth_token", v)
	}

	actionURL := gateway
	if encoded := actionValues.Encode(); encoded != "" {
		actionURL = gateway + "?" + encoded
	}

	var b strings.Builder
	b.WriteString("<!doctype html><html><head><meta charset=\"UTF-8\"><title>Redirecting...</title></head><body>")
	b.WriteString("<form id=\"alipay_certify_form\" method=\"post\" action=\"")
	b.WriteString(html.EscapeString(actionURL))
	b.WriteString("\">")
	b.WriteString("<input type=\"hidden\" name=\"biz_content\" value=\"")
	b.WriteString(html.EscapeString(params["biz_content"]))
	b.WriteString("\"/>")
	b.WriteString("</form><script>document.getElementById('alipay_certify_form').submit();</script></body></html>")
	return b.String(), nil
}

type ZhimaInitResponse struct {
	CertifyID      string
	CertifyURL     string
	CertifyAppURL  string
	CertifyForm string
}

type ZhimaQueryResponse struct {
	Passed string
}

func CallZhimaInit(bizContent string) (*ZhimaInitResponse, error) {
	data, err := callZhima("alipay.user.certify.open.initialize", bizContent)
	if err != nil {
		return nil, err
	}
	respRaw, ok := data["alipay_user_certify_open_initialize_response"].(map[string]any)
	if !ok {
		return nil, fmt.Errorf("芝麻初始化返回异常")
	}
	code, _ := respRaw["code"].(string)
	msg, _ := respRaw["msg"].(string)
	subCode, _ := respRaw["sub_code"].(string)
	subMsg, _ := respRaw["sub_msg"].(string)
	SysLog(fmt.Sprintf("zhima init result code=%s msg=%s sub_code=%s sub_msg=%s", code, msg, subCode, subMsg))
	if code != "10000" {
		if subCode != "" || subMsg != "" {
			return nil, fmt.Errorf("芝麻初始化失败: %s (%s: %s)", msg, subCode, subMsg)
		}
		return nil, fmt.Errorf("芝麻初始化失败: %s", msg)
	}
	certifyID, _ := respRaw["certify_id"].(string)
	certifyURL, err := buildOpenCertifyURL(certifyID)
	if err != nil {
		return nil, err
	}
	certifyForm, err := buildOpenCertifyForm(certifyID)
	if err != nil {
		return nil, err
	}
	certifyAppURL := "alipays://platformapi/startapp?appId=20000067&url=" + url.QueryEscape(certifyURL)
	return &ZhimaInitResponse{
		CertifyID:     certifyID,
		CertifyURL:    certifyURL,
		CertifyAppURL: certifyAppURL,
		CertifyForm:   certifyForm,
	}, nil
}

func CallZhimaQuery(certifyID string) (*ZhimaQueryResponse, error) {
	biz := map[string]any{"certify_id": certifyID}
	bizBytes, _ := json.Marshal(biz)
	data, err := callZhima("alipay.user.certify.open.query", string(bizBytes))
	if err != nil {
		return nil, err
	}
	respRaw, ok := data["alipay_user_certify_open_query_response"].(map[string]any)
	if !ok {
		return nil, fmt.Errorf("芝麻查询返回异常")
	}
	code, _ := respRaw["code"].(string)
	if code != "10000" {
		msg, _ := respRaw["msg"].(string)
		subCode, _ := respRaw["sub_code"].(string)
		subMsg, _ := respRaw["sub_msg"].(string)
		if subCode != "" || subMsg != "" {
			return nil, fmt.Errorf("芝麻查询失败: %s (%s: %s)", msg, subCode, subMsg)
		}
		return nil, fmt.Errorf("芝麻查询失败: %s", msg)
	}
	passed, _ := respRaw["passed"].(string)
	return &ZhimaQueryResponse{Passed: passed}, nil
}

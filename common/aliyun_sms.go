package common

import (
	"crypto/hmac"
	"crypto/sha1"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"sort"
	"strings"
	"time"
)

func percentEncode(input string) string {
	escaped := url.QueryEscape(input)
	escaped = strings.ReplaceAll(escaped, "+", "%20")
	escaped = strings.ReplaceAll(escaped, "*", "%2A")
	escaped = strings.ReplaceAll(escaped, "%7E", "~")
	return escaped
}

func randomHexNonce() string {
	return hex.EncodeToString([]byte(GenerateVerificationCode(16)))
}

func SendAliyunSMS(phone string, code string) error {
	if AliyunSMSAccessKeyId == "" || AliyunSMSAccessKeySecret == "" || AliyunSMSSignName == "" || AliyunSMSTemplateCode == "" {
		return fmt.Errorf("阿里云短信配置不完整")
	}
	params := map[string]string{
		"AccessKeyId":      AliyunSMSAccessKeyId,
		"Action":           "SendSms",
		"Format":           "JSON",
		"OutId":            "newapi-register",
		"PhoneNumbers":     phone,
		"RegionId":         "cn-hangzhou",
		"SignName":         AliyunSMSSignName,
		"SignatureMethod":  "HMAC-SHA1",
		"SignatureNonce":   randomHexNonce(),
		"SignatureVersion": "1.0",
		"TemplateCode":     AliyunSMSTemplateCode,
		"TemplateParam":    fmt.Sprintf(`{"code":"%s"}`, code),
		"Timestamp":        time.Now().UTC().Format("2006-01-02T15:04:05Z"),
		"Version":          "2017-05-25",
	}
	keys := make([]string, 0, len(params))
	for k := range params {
		keys = append(keys, k)
	}
	sort.Strings(keys)
	parts := make([]string, 0, len(keys))
	for _, k := range keys {
		parts = append(parts, percentEncode(k)+"="+percentEncode(params[k]))
	}
	canonicalized := strings.Join(parts, "&")
	stringToSign := "GET&%2F&" + percentEncode(canonicalized)
	mac := hmac.New(sha1.New, []byte(AliyunSMSAccessKeySecret+"&"))
	_, _ = mac.Write([]byte(stringToSign))
	signature := base64.StdEncoding.EncodeToString(mac.Sum(nil))
	params["Signature"] = signature

	values := url.Values{}
	for k, v := range params {
		values.Set(k, v)
	}
	endpoint := "https://dysmsapi.aliyuncs.com/?" + values.Encode()
	resp, err := http.Get(endpoint)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(resp.Body)
	var data map[string]any
	if err = json.Unmarshal(body, &data); err != nil {
		return fmt.Errorf("解析阿里云短信响应失败: %v", err)
	}
	if codeVal, ok := data["Code"].(string); !ok || codeVal != "OK" {
		msg, _ := data["Message"].(string)
		if msg == "" {
			msg = "发送失败"
		}
		return fmt.Errorf("阿里云短信发送失败: %s", msg)
	}
	return nil
}

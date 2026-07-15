package common

import (
	"fmt"
	"net/url"
	"os"
	"strings"
)

var weakSecretValues = map[string]struct{}{
	"":              {},
	"123456":        {},
	"12345678":      {},
	"password":      {},
	"passwd":        {},
	"admin":         {},
	"root":          {},
	"default":       {},
	"changeme":      {},
	"change_me":     {},
	"random_string": {},
	"secret":        {},
	"test":          {},
}

func SecurityL3StrictEnabled() bool {
	if raw, ok := os.LookupEnv("SECURITY_L3_STRICT"); ok {
		return strings.EqualFold(strings.TrimSpace(raw), "true")
	}
	return isProductionLikeRuntime()
}

func isProductionLikeRuntime() bool {
	for _, key := range []string{"APP_ENV", "ENV", "GO_ENV", "NODE_ENV", "GIN_MODE"} {
		v := strings.ToLower(strings.TrimSpace(os.Getenv(key)))
		if v == "" {
			continue
		}
		if v == "prod" || v == "production" || v == "release" {
			return true
		}
	}
	return false
}

func ValidateSecurityBaselineL3() error {
	strict := SecurityL3StrictEnabled()

	sessionSecret := os.Getenv("SESSION_SECRET")
	if strict && sessionSecret == "" {
		return fmt.Errorf("SECURITY_L3_STRICT=true requires explicit SESSION_SECRET")
	}
	if sessionSecret != "" {
		if isWeakSecret(sessionSecret) {
			return fmt.Errorf("SESSION_SECRET uses weak/default value")
		}
		if strict && len(sessionSecret) < 24 {
			return fmt.Errorf("SESSION_SECRET must be at least 24 characters when SECURITY_L3_STRICT=true")
		}
	}

	cryptoSecret := os.Getenv("CRYPTO_SECRET")
	if cryptoSecret != "" && isWeakSecret(cryptoSecret) {
		return fmt.Errorf("CRYPTO_SECRET uses weak/default value")
	}
	if strict && cryptoSecret != "" && len(cryptoSecret) < 24 {
		return fmt.Errorf("CRYPTO_SECRET must be at least 24 characters when SECURITY_L3_STRICT=true")
	}

	sqlDSN := strings.ToLower(strings.TrimSpace(os.Getenv("SQL_DSN")))
	if sqlDSN != "" && hasWeakDSNPassword(sqlDSN) {
		return fmt.Errorf("SQL_DSN contains weak/default password")
	}

	if os.Getenv("ENABLE_PPROF") == "true" {
		if strict {
			return fmt.Errorf("ENABLE_PPROF must be disabled when SECURITY_L3_STRICT=true")
		}
		SysError("security warning: ENABLE_PPROF=true, do not expose debug interfaces in production")
	}

	if DebugEnabled {
		if strict {
			return fmt.Errorf("DEBUG must be disabled when SECURITY_L3_STRICT=true")
		}
		SysError("security warning: DEBUG=true increases information exposure")
	}

	if TLSInsecureSkipVerify {
		if strict {
			return fmt.Errorf("TLS_INSECURE_SKIP_VERIFY must be false when SECURITY_L3_STRICT=true")
		}
		SysError("security warning: TLS_INSECURE_SKIP_VERIFY=true disables certificate verification")
	}

	corsAllowOrigins := strings.TrimSpace(os.Getenv("CORS_ALLOW_ORIGINS"))
	if strict && (corsAllowOrigins == "" || corsAllowOrigins == "*") {
		return fmt.Errorf("CORS_ALLOW_ORIGINS must be explicitly configured when SECURITY_L3_STRICT=true")
	}

	if strict && !GetEnvOrDefaultBool("SESSION_COOKIE_SECURE", false) {
		return fmt.Errorf("SESSION_COOKIE_SECURE must be true when SECURITY_L3_STRICT=true")
	}

	return nil
}

type SecurityBaselineSnapshot struct {
	StrictMode            bool
	ProductionLike        bool
	SessionSecretSet      bool
	CryptoSecretSet       bool
	EnablePprof           bool
	DebugEnabled          bool
	TLSInsecureSkipVerify bool
	SessionCookieSecure   bool
	CORSAllowOrigins      string
}

func BuildSecurityBaselineSnapshot() SecurityBaselineSnapshot {
	corsAllowOrigins := strings.TrimSpace(os.Getenv("CORS_ALLOW_ORIGINS"))
	if corsAllowOrigins == "" {
		corsAllowOrigins = "(empty)"
	}
	return SecurityBaselineSnapshot{
		StrictMode:            SecurityL3StrictEnabled(),
		ProductionLike:        isProductionLikeRuntime(),
		SessionSecretSet:      strings.TrimSpace(os.Getenv("SESSION_SECRET")) != "",
		CryptoSecretSet:       strings.TrimSpace(os.Getenv("CRYPTO_SECRET")) != "",
		EnablePprof:           strings.EqualFold(strings.TrimSpace(os.Getenv("ENABLE_PPROF")), "true"),
		DebugEnabled:          DebugEnabled,
		TLSInsecureSkipVerify: TLSInsecureSkipVerify,
		SessionCookieSecure:   GetEnvOrDefaultBool("SESSION_COOKIE_SECURE", false),
		CORSAllowOrigins:      corsAllowOrigins,
	}
}

func LogSecurityBaselineSnapshot(level string) {
	s := BuildSecurityBaselineSnapshot()
	msg := fmt.Sprintf(
		"security baseline snapshot strict=%t production_like=%t session_secret_set=%t crypto_secret_set=%t enable_pprof=%t debug=%t tls_insecure_skip_verify=%t session_cookie_secure=%t cors_allow_origins=%q",
		s.StrictMode,
		s.ProductionLike,
		s.SessionSecretSet,
		s.CryptoSecretSet,
		s.EnablePprof,
		s.DebugEnabled,
		s.TLSInsecureSkipVerify,
		s.SessionCookieSecure,
		s.CORSAllowOrigins,
	)
	if strings.EqualFold(strings.TrimSpace(level), "error") {
		SysError(msg)
		return
	}
	SysLog(msg)
}

func IsSecureCookiePreferred() bool {
	if GetEnvOrDefaultBool("SESSION_COOKIE_SECURE", false) {
		return true
	}
	frontendBaseURL := strings.TrimSpace(os.Getenv("FRONTEND_BASE_URL"))
	if frontendBaseURL == "" {
		return false
	}
	u, err := url.Parse(frontendBaseURL)
	if err != nil {
		return false
	}
	return strings.EqualFold(u.Scheme, "https")
}

func isWeakSecret(secret string) bool {
	_, ok := weakSecretValues[strings.ToLower(strings.TrimSpace(secret))]
	return ok
}

func hasWeakDSNPassword(dsn string) bool {
	weakMarkers := []string{
		":123456@",
		":password@",
		":root@",
		":admin@",
		":changeme@",
		":default@",
		"password=123456",
		"password=password",
		"password=root",
		"password=admin",
		"password=changeme",
		"password=default",
	}
	for _, marker := range weakMarkers {
		if strings.Contains(dsn, marker) {
			return true
		}
	}
	return false
}

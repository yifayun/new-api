package common

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestConsumeCodeWithKeyIsSingleUse(t *testing.T) {
	key := "user@example.com"
	code := "123456"
	RegisterVerificationCodeWithKey(key, code, EmailVerificationPurpose)

	assert.True(t, ConsumeCodeWithKey(key, code, EmailVerificationPurpose))
	assert.False(t, ConsumeCodeWithKey(key, code, EmailVerificationPurpose))
	assert.False(t, VerifyCodeWithKey(key, code, EmailVerificationPurpose))
}

func TestConsumeCodeWithKeyRejectsWrongCode(t *testing.T) {
	key := "phone-13800138000"
	RegisterVerificationCodeWithKey(key, "111111", PhoneVerificationPurpose)

	assert.False(t, ConsumeCodeWithKey(key, "000000", PhoneVerificationPurpose))
	assert.True(t, VerifyCodeWithKey(key, "111111", PhoneVerificationPurpose))
}

import { useState } from 'react'
import i18next from 'i18next'
import { toast } from 'sonner'
import { useCountdown } from '@/hooks/use-countdown'
import { executeGeetestVerification } from '@/lib/geetest'
import { sendEmailVerification } from '../api'
import { EMAIL_VERIFICATION_COUNTDOWN } from '../constants'

interface UseEmailVerificationOptions {
  turnstileToken?: string
  validateTurnstile?: () => boolean
  geetestEnabled?: boolean
  geetestCaptchaId?: string
}

/**
 * Hook for managing email verification code sending
 */
export function useEmailVerification(options?: UseEmailVerificationOptions) {
  const [isSending, setIsSending] = useState(false)
  const {
    secondsLeft,
    isActive,
    start: startCountdown,
  } = useCountdown({ initialSeconds: EMAIL_VERIFICATION_COUNTDOWN })

  /**
   * Send verification code to email
   */
  const sendCode = async (email: string) => {
    if (!email) {
      toast.error(i18next.t('Please enter your email first'))
      return false
    }

    // Validate turnstile if validation function is provided
    if (options?.validateTurnstile && !options.validateTurnstile()) {
      return false
    }

    setIsSending(true)
    try {
      let geetestParams:
        | {
            geetest_lot_number: string
            geetest_captcha_output: string
            geetest_pass_token: string
            geetest_gen_time: string
          }
        | undefined

      if (options?.geetestEnabled) {
        geetestParams = await executeGeetestVerification(
          options?.geetestCaptchaId || ''
        )
      }

      const res = await sendEmailVerification(
        email,
        options?.turnstileToken,
        geetestParams
      )
      if (res?.success) {
        startCountdown()
        toast.success(i18next.t('Verification email sent'))
        return true
      }
      return false
    } catch (_error) {
      // Errors are handled by global interceptor
      return false
    } finally {
      setIsSending(false)
    }
  }

  return {
    isSending,
    secondsLeft,
    isActive,
    sendCode,
  }
}

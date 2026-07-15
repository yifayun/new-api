const GEETEST_SCRIPT_URL = 'https://static.geetest.com/v4/gt4.js'

let geetestScriptPromise: Promise<void> | null = null

function loadGeetestScript(): Promise<void> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Geetest is not supported in this environment'))
  }
  if ((window as typeof window & { initGeetest4?: unknown }).initGeetest4) {
    return Promise.resolve()
  }
  if (geetestScriptPromise) {
    return geetestScriptPromise
  }

  geetestScriptPromise = new Promise<void>((resolve, reject) => {
    const script = document.createElement('script')
    script.src = GEETEST_SCRIPT_URL
    script.async = true
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('Failed to load Geetest script'))
    document.head.appendChild(script)
  })

  return geetestScriptPromise
}

export type GeetestVerificationParams = {
  geetest_lot_number: string
  geetest_captcha_output: string
  geetest_pass_token: string
  geetest_gen_time: string
}

export async function executeGeetestVerification(
  captchaId: string
): Promise<GeetestVerificationParams> {
  if (!captchaId) {
    throw new Error('Geetest captcha_id is not configured')
  }

  await loadGeetestScript()

  return await new Promise<GeetestVerificationParams>((resolve, reject) => {
    const init = (window as typeof window & {
      initGeetest4?: (
        config: { captchaId: string; product: 'bind' },
        onReady: {
          (
            captcha: {
              onSuccess: (cb: () => void) => void
              onError: (cb: () => void) => void
              getValidate: () => {
                lot_number?: string
                captcha_output?: string
                pass_token?: string
                gen_time?: string
              }
              showCaptcha: () => void
            }
          ): void
        }
      ) => void
    }).initGeetest4

    if (!init) {
      reject(new Error('Failed to initialize Geetest'))
      return
    }

    init(
      {
        captchaId,
        product: 'bind',
      },
      (captcha) => {
        captcha.onSuccess(() => {
          const result = captcha.getValidate()
          if (
            !result?.lot_number ||
            !result?.captcha_output ||
            !result?.pass_token ||
            !result?.gen_time
          ) {
            reject(new Error('Invalid Geetest result'))
            return
          }
          resolve({
            geetest_lot_number: result.lot_number,
            geetest_captcha_output: result.captcha_output,
            geetest_pass_token: result.pass_token,
            geetest_gen_time: result.gen_time,
          })
        })
        captcha.onError(() => reject(new Error('Geetest verification failed')))
        captcha.showCaptcha()
      }
    )
  })
}

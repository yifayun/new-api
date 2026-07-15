/*
Copyright (C) 2025 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/

const GEETEST_SCRIPT_URL = 'https://static.geetest.com/v4/gt4.js';

let geetestScriptPromise = null;

const loadGeetestScript = () => {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('当前环境不支持极验'));
  }
  if (window.initGeetest4) {
    return Promise.resolve();
  }
  if (geetestScriptPromise) {
    return geetestScriptPromise;
  }

  geetestScriptPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = GEETEST_SCRIPT_URL;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('极验脚本加载失败'));
    document.head.appendChild(script);
  });

  return geetestScriptPromise;
};

export const executeGeetestVerification = async (captchaId) => {
  if (!captchaId) {
    throw new Error('极验未配置 captcha_id');
  }
  await loadGeetestScript();

  return new Promise((resolve, reject) => {
    if (!window.initGeetest4) {
      reject(new Error('极验初始化失败'));
      return;
    }
    window.initGeetest4(
      {
        captchaId,
        product: 'bind',
      },
      (captcha) => {
        captcha.onSuccess(() => {
          const result = captcha.getValidate();
          if (
            !result?.lot_number ||
            !result?.captcha_output ||
            !result?.pass_token ||
            !result?.gen_time
          ) {
            reject(new Error('极验结果无效'));
            return;
          }
          resolve({
            geetest_lot_number: result.lot_number,
            geetest_captcha_output: result.captcha_output,
            geetest_pass_token: result.pass_token,
            geetest_gen_time: result.gen_time,
          });
        });
        captcha.onError(() => reject(new Error('极验校验失败，请重试')));
        captcha.showCaptcha();
      },
    );
  });
};

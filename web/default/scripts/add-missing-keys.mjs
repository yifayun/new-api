import fs from 'node:fs/promises'
import path from 'node:path'

const LOCALES_DIR = path.resolve('src/i18n/locales')

function stableStringify(obj) {
  return JSON.stringify(obj, null, 2) + '\n'
}

const newKeys = {
  en: {
    'Account verification': 'Account verification',
    'Alipay public key': 'Alipay public key',
    'Aliyun SMS settings': 'Aliyun SMS settings',
    Breadcrumb: 'Breadcrumb',
    'Company name': 'Company name',
    'Configure Doubao video prices by resolution, including video_input_price and no_video_input_price.':
      'Configure Doubao video prices by resolution, including video_input_price and no_video_input_price.',
    'Doubao video billing dimension prices':
      'Doubao video billing dimension prices',
    'Enter your phone number': 'Enter your phone number',
    'Failed to send phone verification code':
      'Failed to send phone verification code',
    'Filing & compliance bar': 'Filing & compliance bar',
    'Gateway URL': 'Gateway URL',
    'Geetest verification failed': 'Geetest verification failed',
    'Go to verify': 'Go to verify',
    'How filing information is arranged in the site footer':
      'How filing information is arranged in the site footer',
    'ICP filing link': 'ICP filing link',
    'ICP filing number': 'ICP filing number',
    'Minimum paid top-up amount required after real-name approval (0 to disable)':
      'Minimum paid top-up amount required after real-name approval (0 to disable)',
    'Must be greater than or equal to 0': 'Must be greater than or equal to 0',
    'Phone & real-name verification': 'Phone & real-name verification',
    'Phone number': 'Phone number',
    'Phone verification': 'Phone verification',
    'Phone verification code': 'Phone verification code',
    'Phone verification code sent': 'Phone verification code sent',
    'Please enter the phone verification code':
      'Please enter the phone verification code',
    'Please enter your phone number': 'Please enter your phone number',
    'Private key': 'Private key',
    'Public security filing link': 'Public security filing link',
    'Public security filing number': 'Public security filing number',
    'Real-name verification': 'Real-name verification',
    'Record bar layout': 'Record bar layout',
    'Require SMS verification code when registering with a phone number':
      'Require SMS verification code when registering with a phone number',
    'Require users to complete real-name verification before using the API':
      'Require users to complete real-name verification before using the API',
    'Reseller branding, profit, and withdrawals (per-user access is still required).':
      'Reseller branding, profit, and withdrawals (per-user access is still required).',
    'Resize column': 'Resize column',
    'Review and complete reseller withdrawal requests.':
      'Review and complete reseller withdrawal requests.',
    'Review enterprise real-name verification requests.':
      'Review enterprise real-name verification requests.',
    'Single line': 'Single line',
    'SMS sign name': 'SMS sign name',
    'SMS template code': 'SMS template code',
    'Start and track your personal or enterprise verification.':
      'Start and track your personal or enterprise verification.',
    'Submit failed': 'Submit failed',
    'Telecom value-added license': 'Telecom value-added license',
    'Telecom value-added license link': 'Telecom value-added license link',
    Verified: 'Verified',
    'View / upgrade': 'View / upgrade',
    'Withdrawal request submitted': 'Withdrawal request submitted',
    Wrap: 'Wrap',
    'Zhima (Alipay) real-name settings': 'Zhima (Alipay) real-name settings',
  },
  zh: {
    'Account verification': '账号核验',
    'Alipay public key': '支付宝公钥',
    'Aliyun SMS settings': '阿里云短信设置',
    Breadcrumb: '面包屑',
    'Company name': '公司名称',
    'Configure Doubao video prices by resolution, including video_input_price and no_video_input_price.':
      '按分辨率配置豆包视频价格，包括 video_input_price 与 no_video_input_price。',
    'Doubao video billing dimension prices': '豆包视频计费维度价格',
    'Enter your phone number': '请输入手机号',
    'Failed to send phone verification code': '发送手机验证码失败',
    'Filing & compliance bar': '备案与合规信息栏',
    'Gateway URL': '网关地址',
    'Geetest verification failed': '极验验证失败',
    'Go to verify': '去认证',
    'How filing information is arranged in the site footer':
      '页脚备案信息的排列方式',
    'ICP filing link': 'ICP 备案链接',
    'ICP filing number': 'ICP 备案号',
    'Minimum paid top-up amount required after real-name approval (0 to disable)':
      '实名通过后需达到的最低充值金额（0 表示不限制）',
    'Must be greater than or equal to 0': '必须大于或等于 0',
    'Phone & real-name verification': '手机与实名认证',
    'Phone number': '手机号',
    'Phone verification': '手机验证',
    'Phone verification code': '手机验证码',
    'Phone verification code sent': '手机验证码已发送',
    'Please enter the phone verification code': '请输入手机验证码',
    'Please enter your phone number': '请输入手机号',
    'Private key': '私钥',
    'Public security filing link': '公安备案链接',
    'Public security filing number': '公安备案号',
    'Real-name verification': '实名认证',
    'Record bar layout': '备案栏布局',
    'Require SMS verification code when registering with a phone number':
      '使用手机号注册时需要短信验证码',
    'Require users to complete real-name verification before using the API':
      '用户使用 API 前须完成实名认证',
    'Reseller branding, profit, and withdrawals (per-user access is still required).':
      '代理商品牌、利润与提现（仍需单独开通用户权限）。',
    'Resize column': '调整列宽',
    'Review and complete reseller withdrawal requests.': '审核并完成代理商提现申请。',
    'Review enterprise real-name verification requests.': '审核企业实名认证申请。',
    'Single line': '单行',
    'SMS sign name': '短信签名',
    'SMS template code': '短信模板代码',
    'Start and track your personal or enterprise verification.':
      '发起并跟踪个人或企业认证进度。',
    'Submit failed': '提交失败',
    'Telecom value-added license': '电信增值业务许可证',
    'Telecom value-added license link': '电信增值业务许可证链接',
    Verified: '已验证',
    'View / upgrade': '查看 / 升级',
    'Withdrawal request submitted': '提现申请已提交',
    Wrap: '自动换行',
    'Zhima (Alipay) real-name settings': '芝麻（支付宝）实名设置',
  },
  fr: {
    'Account verification': 'Vérification du compte',
    'Alipay public key': 'Clé publique Alipay',
    'Aliyun SMS settings': 'Paramètres SMS Aliyun',
    Breadcrumb: 'Fil d’Ariane',
    'Company name': 'Nom de l’entreprise',
    'Configure Doubao video prices by resolution, including video_input_price and no_video_input_price.':
      'Configurer les prix vidéo Doubao par résolution, y compris video_input_price et no_video_input_price.',
    'Doubao video billing dimension prices':
      'Prix des dimensions de facturation vidéo Doubao',
    'Enter your phone number': 'Saisissez votre numéro de téléphone',
    'Failed to send phone verification code':
      'Échec de l’envoi du code de vérification téléphonique',
    'Filing & compliance bar': 'Barre de dépôt et de conformité',
    'Gateway URL': 'URL de la passerelle',
    'Geetest verification failed': 'Échec de la vérification Geetest',
    'Go to verify': 'Aller vérifier',
    'How filing information is arranged in the site footer':
      'Disposition des informations de dépôt dans le pied de page',
    'ICP filing link': 'Lien de dépôt ICP',
    'ICP filing number': 'Numéro de dépôt ICP',
    'Minimum paid top-up amount required after real-name approval (0 to disable)':
      'Montant minimum de recharge payée requis après l’approbation d’identité (0 pour désactiver)',
    'Must be greater than or equal to 0': 'Doit être supérieur ou égal à 0',
    'Phone & real-name verification': 'Vérification téléphone et identité',
    'Phone number': 'Numéro de téléphone',
    'Phone verification': 'Vérification téléphonique',
    'Phone verification code': 'Code de vérification téléphonique',
    'Phone verification code sent': 'Code de vérification téléphonique envoyé',
    'Please enter the phone verification code':
      'Veuillez saisir le code de vérification téléphonique',
    'Please enter your phone number': 'Veuillez saisir votre numéro de téléphone',
    'Private key': 'Clé privée',
    'Public security filing link': 'Lien de dépôt de sécurité publique',
    'Public security filing number': 'Numéro de dépôt de sécurité publique',
    'Real-name verification': 'Vérification d’identité',
    'Record bar layout': 'Disposition de la barre de dépôt',
    'Require SMS verification code when registering with a phone number':
      'Exiger un code SMS lors de l’inscription avec un numéro de téléphone',
    'Require users to complete real-name verification before using the API':
      'Exiger la vérification d’identité avant d’utiliser l’API',
    'Reseller branding, profit, and withdrawals (per-user access is still required).':
      'Marque, marge et retraits revendeur (l’accès par utilisateur reste requis).',
    'Resize column': 'Redimensionner la colonne',
    'Review and complete reseller withdrawal requests.':
      'Examiner et finaliser les demandes de retrait des revendeurs.',
    'Review enterprise real-name verification requests.':
      'Examiner les demandes de vérification d’identité entreprise.',
    'Single line': 'Une seule ligne',
    'SMS sign name': 'Nom de signature SMS',
    'SMS template code': 'Code du modèle SMS',
    'Start and track your personal or enterprise verification.':
      'Lancer et suivre votre vérification personnelle ou entreprise.',
    'Submit failed': 'Échec de l’envoi',
    'Telecom value-added license': 'Licence de télécoms à valeur ajoutée',
    'Telecom value-added license link':
      'Lien de la licence de télécoms à valeur ajoutée',
    Verified: 'Vérifié',
    'View / upgrade': 'Voir / mettre à niveau',
    'Withdrawal request submitted': 'Demande de retrait envoyée',
    Wrap: 'Retour à la ligne',
    'Zhima (Alipay) real-name settings':
      'Paramètres d’identité Zhima (Alipay)',
  },
  ja: {
    'Account verification': 'アカウント認証',
    'Alipay public key': 'Alipay 公開鍵',
    'Aliyun SMS settings': 'Aliyun SMS 設定',
    Breadcrumb: 'パンくずリスト',
    'Company name': '会社名',
    'Configure Doubao video prices by resolution, including video_input_price and no_video_input_price.':
      '解像度ごとに Doubao 動画価格（video_input_price / no_video_input_price）を設定します。',
    'Doubao video billing dimension prices': 'Doubao 動画の課金ディメンション価格',
    'Enter your phone number': '電話番号を入力',
    'Failed to send phone verification code': '電話確認コードの送信に失敗しました',
    'Filing & compliance bar': '届出・コンプライアンスバー',
    'Gateway URL': 'ゲートウェイ URL',
    'Geetest verification failed': 'Geetest 認証に失敗しました',
    'Go to verify': '認証へ',
    'How filing information is arranged in the site footer':
      'フッターでの届出情報の並び方',
    'ICP filing link': 'ICP 届出リンク',
    'ICP filing number': 'ICP 届出番号',
    'Minimum paid top-up amount required after real-name approval (0 to disable)':
      '実名承認後に必要な最低チャージ額（0 で無効）',
    'Must be greater than or equal to 0': '0 以上である必要があります',
    'Phone & real-name verification': '電話・実名認証',
    'Phone number': '電話番号',
    'Phone verification': '電話認証',
    'Phone verification code': '電話確認コード',
    'Phone verification code sent': '電話確認コードを送信しました',
    'Please enter the phone verification code': '電話確認コードを入力してください',
    'Please enter your phone number': '電話番号を入力してください',
    'Private key': '秘密鍵',
    'Public security filing link': '公安届出リンク',
    'Public security filing number': '公安届出番号',
    'Real-name verification': '実名認証',
    'Record bar layout': '届出バーのレイアウト',
    'Require SMS verification code when registering with a phone number':
      '電話番号での登録時に SMS 確認コードを必須にする',
    'Require users to complete real-name verification before using the API':
      'API 利用前に実名認証を必須にする',
    'Reseller branding, profit, and withdrawals (per-user access is still required).':
      'リセラーのブランド・利益・出金（ユーザーごとの権限は別途必要）。',
    'Resize column': '列幅を変更',
    'Review and complete reseller withdrawal requests.':
      'リセラー出金申請を審査して完了します。',
    'Review enterprise real-name verification requests.':
      '企業実名認証申請を審査します。',
    'Single line': '一行表示',
    'SMS sign name': 'SMS 署名名',
    'SMS template code': 'SMS テンプレートコード',
    'Start and track your personal or enterprise verification.':
      '個人または企業認証を開始し、進捗を確認します。',
    'Submit failed': '送信に失敗しました',
    'Telecom value-added license': '電気通信付加価値業務許可',
    'Telecom value-added license link': '電気通信付加価値業務許可のリンク',
    Verified: '認証済み',
    'View / upgrade': '表示 / アップグレード',
    'Withdrawal request submitted': '出金申請を送信しました',
    Wrap: '折り返し',
    'Zhima (Alipay) real-name settings': 'Zhima（Alipay）実名設定',
  },
  ru: {
    'Account verification': 'Проверка аккаунта',
    'Alipay public key': 'Публичный ключ Alipay',
    'Aliyun SMS settings': 'Настройки SMS Aliyun',
    Breadcrumb: 'Навигационная цепочка',
    'Company name': 'Название компании',
    'Configure Doubao video prices by resolution, including video_input_price and no_video_input_price.':
      'Настройте цены видео Doubao по разрешению, включая video_input_price и no_video_input_price.',
    'Doubao video billing dimension prices':
      'Цены измерений биллинга видео Doubao',
    'Enter your phone number': 'Введите номер телефона',
    'Failed to send phone verification code':
      'Не удалось отправить код подтверждения телефона',
    'Filing & compliance bar': 'Панель регистрации и соответствия',
    'Gateway URL': 'URL шлюза',
    'Geetest verification failed': 'Проверка Geetest не удалась',
    'Go to verify': 'Перейти к проверке',
    'How filing information is arranged in the site footer':
      'Как сведения о регистрации располагаются в подвале сайта',
    'ICP filing link': 'Ссылка ICP-регистрации',
    'ICP filing number': 'Номер ICP-регистрации',
    'Minimum paid top-up amount required after real-name approval (0 to disable)':
      'Минимальная сумма платного пополнения после одобрения реальных данных (0 — отключить)',
    'Must be greater than or equal to 0': 'Должно быть больше или равно 0',
    'Phone & real-name verification': 'Проверка телефона и личности',
    'Phone number': 'Номер телефона',
    'Phone verification': 'Проверка телефона',
    'Phone verification code': 'Код подтверждения телефона',
    'Phone verification code sent': 'Код подтверждения телефона отправлен',
    'Please enter the phone verification code':
      'Пожалуйста, введите код подтверждения телефона',
    'Please enter your phone number': 'Пожалуйста, введите номер телефона',
    'Private key': 'Закрытый ключ',
    'Public security filing link': 'Ссылка регистрации общественной безопасности',
    'Public security filing number':
      'Номер регистрации общественной безопасности',
    'Real-name verification': 'Проверка личности',
    'Record bar layout': 'Макет панели регистрации',
    'Require SMS verification code when registering with a phone number':
      'Требовать SMS-код при регистрации по номеру телефона',
    'Require users to complete real-name verification before using the API':
      'Требовать проверку личности перед использованием API',
    'Reseller branding, profit, and withdrawals (per-user access is still required).':
      'Бренд, прибыль и выводы реселлера (доступ по пользователям всё ещё нужен).',
    'Resize column': 'Изменить ширину столбца',
    'Review and complete reseller withdrawal requests.':
      'Проверьте и завершите заявки на вывод средств реселлеров.',
    'Review enterprise real-name verification requests.':
      'Проверьте заявки на корпоративную проверку личности.',
    'Single line': 'В одну строку',
    'SMS sign name': 'Имя подписи SMS',
    'SMS template code': 'Код шаблона SMS',
    'Start and track your personal or enterprise verification.':
      'Начните и отслеживайте личную или корпоративную проверку.',
    'Submit failed': 'Отправка не удалась',
    'Telecom value-added license': 'Лицензия на доп. услуги связи',
    'Telecom value-added license link': 'Ссылка на лицензию доп. услуг связи',
    Verified: 'Проверено',
    'View / upgrade': 'Просмотр / повышение',
    'Withdrawal request submitted': 'Заявка на вывод отправлена',
    Wrap: 'С переносом',
    'Zhima (Alipay) real-name settings': 'Настройки личности Zhima (Alipay)',
  },
  vi: {
    'Account verification': 'Xác minh tài khoản',
    'Alipay public key': 'Khóa công khai Alipay',
    'Aliyun SMS settings': 'Cài đặt SMS Aliyun',
    Breadcrumb: 'Đường dẫn',
    'Company name': 'Tên công ty',
    'Configure Doubao video prices by resolution, including video_input_price and no_video_input_price.':
      'Cấu hình giá video Doubao theo độ phân giải, gồm video_input_price và no_video_input_price.',
    'Doubao video billing dimension prices':
      'Giá theo chiều thanh toán video Doubao',
    'Enter your phone number': 'Nhập số điện thoại',
    'Failed to send phone verification code':
      'Gửi mã xác minh điện thoại thất bại',
    'Filing & compliance bar': 'Thanh đăng ký & tuân thủ',
    'Gateway URL': 'URL cổng',
    'Geetest verification failed': 'Xác minh Geetest thất bại',
    'Go to verify': 'Đi xác minh',
    'How filing information is arranged in the site footer':
      'Cách sắp xếp thông tin đăng ký ở chân trang',
    'ICP filing link': 'Liên kết đăng ký ICP',
    'ICP filing number': 'Số đăng ký ICP',
    'Minimum paid top-up amount required after real-name approval (0 to disable)':
      'Số tiền nạp tối thiểu sau khi duyệt định danh (0 để tắt)',
    'Must be greater than or equal to 0': 'Phải lớn hơn hoặc bằng 0',
    'Phone & real-name verification': 'Xác minh điện thoại & định danh',
    'Phone number': 'Số điện thoại',
    'Phone verification': 'Xác minh điện thoại',
    'Phone verification code': 'Mã xác minh điện thoại',
    'Phone verification code sent': 'Đã gửi mã xác minh điện thoại',
    'Please enter the phone verification code':
      'Vui lòng nhập mã xác minh điện thoại',
    'Please enter your phone number': 'Vui lòng nhập số điện thoại',
    'Private key': 'Khóa riêng',
    'Public security filing link': 'Liên kết đăng ký an ninh công cộng',
    'Public security filing number': 'Số đăng ký an ninh công cộng',
    'Real-name verification': 'Xác minh định danh',
    'Record bar layout': 'Bố cục thanh đăng ký',
    'Require SMS verification code when registering with a phone number':
      'Yêu cầu mã SMS khi đăng ký bằng số điện thoại',
    'Require users to complete real-name verification before using the API':
      'Yêu cầu người dùng hoàn tất định danh trước khi dùng API',
    'Reseller branding, profit, and withdrawals (per-user access is still required).':
      'Thương hiệu, lợi nhuận và rút tiền đại lý (vẫn cần quyền theo từng người dùng).',
    'Resize column': 'Đổi kích thước cột',
    'Review and complete reseller withdrawal requests.':
      'Xem xét và hoàn tất yêu cầu rút tiền của đại lý.',
    'Review enterprise real-name verification requests.':
      'Xem xét yêu cầu xác minh định danh doanh nghiệp.',
    'Single line': 'Một dòng',
    'SMS sign name': 'Tên chữ ký SMS',
    'SMS template code': 'Mã mẫu SMS',
    'Start and track your personal or enterprise verification.':
      'Bắt đầu và theo dõi xác minh cá nhân hoặc doanh nghiệp.',
    'Submit failed': 'Gửi thất bại',
    'Telecom value-added license': 'Giấy phép dịch vụ viễn thông giá trị gia tăng',
    'Telecom value-added license link':
      'Liên kết giấy phép dịch vụ viễn thông giá trị gia tăng',
    Verified: 'Đã xác minh',
    'View / upgrade': 'Xem / nâng cấp',
    'Withdrawal request submitted': 'Đã gửi yêu cầu rút tiền',
    Wrap: 'Xuống dòng',
    'Zhima (Alipay) real-name settings': 'Cài đặt định danh Zhima (Alipay)',
  },
}

async function main() {
  let totalAdded = 0
  for (const [locale, trans] of Object.entries(newKeys)) {
    const filePath = path.join(LOCALES_DIR, `${locale}.json`)
    const json = JSON.parse(await fs.readFile(filePath, 'utf8'))
    let count = 0
    for (const [key, value] of Object.entries(trans)) {
      if (!Object.prototype.hasOwnProperty.call(json.translation, key)) {
        json.translation[key] = value
        count++
      } else if (json.translation[key] !== value) {
        json.translation[key] = value
        count++
      }
    }
    if (count > 0) {
      json.translation = Object.fromEntries(
        Object.entries(json.translation).sort(([a], [b]) => a.localeCompare(b))
      )
      await fs.writeFile(filePath, stableStringify(json), 'utf8')
    }
    console.log(`${locale}: ${count} translations applied`)
    totalAdded += count
  }
  console.log(`\nTotal: ${totalAdded} translations applied`)
}

main().catch((err) => {
  console.error(err)
  process.exitCode = 1
})

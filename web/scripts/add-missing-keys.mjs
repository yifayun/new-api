import fs from 'node:fs/promises'
import path from 'node:path'

const LOCALES_DIR = path.resolve('src/i18n/locales')

function stableStringify(obj) {
  return JSON.stringify(obj, null, 2) + '\n'
}

const newKeys = {
  en: {
    'All group names live here. Ratio applies when calls are billed as this group; top-up ratio applies to users whose account is in this group. Visible to selected users hides a group from everyone except the listed user IDs.':
      'All group names live here. Ratio applies when calls are billed as this group; top-up ratio applies to users whose account is in this group. Visible to selected users hides a group from everyone except the listed user IDs.',
    'JSON map of group → user ID list. Example: {"vip":[1,2,3]}. Groups not listed stay visible to everyone.':
      'JSON map of group → user ID list. Example: {"vip":[1,2,3]}. Groups not listed stay visible to everyone.',
    'Leave empty for everyone. Example: 1,2,3':
      'Leave empty for everyone. Example: 1,2,3',
    'Visible to selected users': 'Visible to selected users',
  },
  zh: {
    'All group names live here. Ratio applies when calls are billed as this group; top-up ratio applies to users whose account is in this group. Visible to selected users hides a group from everyone except the listed user IDs.':
      '所有分组名称都在这里维护。倍率用于该分组计费；充值倍率用于账户所属分组。填写「指定用户可见」后，仅列出的用户 ID 能看到该分组，其他人不可见。',
    'JSON map of group → user ID list. Example: {"vip":[1,2,3]}. Groups not listed stay visible to everyone.':
      'JSON：分组 → 用户 ID 列表。例如 {"vip":[1,2,3]}。未配置的分组默认对所有用户可见。',
    'Leave empty for everyone. Example: 1,2,3':
      '留空为全部可见，例：1,2,3',
    'Visible to selected users': '指定用户可见',
  },
  'zh-TW': {
    'All group names live here. Ratio applies when calls are billed as this group; top-up ratio applies to users whose account is in this group. Visible to selected users hides a group from everyone except the listed user IDs.':
      '所有分組名稱都在這裡維護。倍率用於該分組計費；儲值倍率用於帳戶所屬分組。填寫「指定使用者可見」後，僅列出的使用者 ID 能看到該分組，其他人不可見。',
    'JSON map of group → user ID list. Example: {"vip":[1,2,3]}. Groups not listed stay visible to everyone.':
      'JSON：分組 → 使用者 ID 列表。例如 {"vip":[1,2,3]}。未設定的分組預設對所有使用者可見。',
    'Leave empty for everyone. Example: 1,2,3':
      '留空為全部可見，例：1,2,3',
    'Visible to selected users': '指定使用者可見',
  },
  fr: {
    'All group names live here. Ratio applies when calls are billed as this group; top-up ratio applies to users whose account is in this group. Visible to selected users hides a group from everyone except the listed user IDs.':
      'Tous les noms de groupe sont gérés ici. Le ratio s’applique à la facturation du groupe ; le ratio de recharge s’applique au groupe du compte. « Visible pour les utilisateurs sélectionnés » masque le groupe à tous sauf les ID listés.',
    'JSON map of group → user ID list. Example: {"vip":[1,2,3]}. Groups not listed stay visible to everyone.':
      'JSON : groupe → liste d’ID utilisateur. Exemple : {"vip":[1,2,3]}. Les groupes non listés restent visibles pour tous.',
    'Leave empty for everyone. Example: 1,2,3':
      'Laisser vide pour tout le monde. Exemple : 1,2,3',
    'Visible to selected users': 'Visible pour les utilisateurs sélectionnés',
  },
  ja: {
    'All group names live here. Ratio applies when calls are billed as this group; top-up ratio applies to users whose account is in this group. Visible to selected users hides a group from everyone except the listed user IDs.':
      'グループ名はここで管理します。倍率は課金グループに、チャージ倍率はアカウントのグループに適用されます。「指定ユーザーに表示」を設定すると、記載したユーザー ID 以外にはグループが非表示になります。',
    'JSON map of group → user ID list. Example: {"vip":[1,2,3]}. Groups not listed stay visible to everyone.':
      'JSON：グループ → ユーザー ID 一覧。例：{"vip":[1,2,3]}。未設定のグループは全員に表示されます。',
    'Leave empty for everyone. Example: 1,2,3':
      '空欄＝全員に表示。例：1,2,3',
    'Visible to selected users': '指定ユーザーに表示',
  },
  ru: {
    'All group names live here. Ratio applies when calls are billed as this group; top-up ratio applies to users whose account is in this group. Visible to selected users hides a group from everyone except the listed user IDs.':
      'Имена групп задаются здесь. Коэффициент применяется к группе биллинга; коэффициент пополнения — к группе аккаунта. «Видно выбранным пользователям» скрывает группу от всех, кроме указанных ID.',
    'JSON map of group → user ID list. Example: {"vip":[1,2,3]}. Groups not listed stay visible to everyone.':
      'JSON: группа → список ID пользователей. Пример: {"vip":[1,2,3]}. Не указанные группы видны всем.',
    'Leave empty for everyone. Example: 1,2,3':
      'Пусто = видно всем. Пример: 1,2,3',
    'Visible to selected users': 'Видно выбранным пользователям',
  },
  vi: {
    'All group names live here. Ratio applies when calls are billed as this group; top-up ratio applies to users whose account is in this group. Visible to selected users hides a group from everyone except the listed user IDs.':
      'Tên nhóm được quản lý tại đây. Hệ số áp dụng khi tính phí theo nhóm; hệ số nạp tiền áp dụng theo nhóm tài khoản. «Hiển thị cho người dùng được chọn» ẩn nhóm với mọi người trừ các ID đã liệt kê.',
    'JSON map of group → user ID list. Example: {"vip":[1,2,3]}. Groups not listed stay visible to everyone.':
      'JSON: nhóm → danh sách ID người dùng. Ví dụ: {"vip":[1,2,3]}. Nhóm không cấu hình vẫn hiện với mọi người.',
    'Leave empty for everyone. Example: 1,2,3':
      'Để trống = hiện với mọi người. Ví dụ: 1,2,3',
    'Visible to selected users': 'Hiển thị cho người dùng được chọn',
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

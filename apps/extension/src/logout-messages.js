const messages = {
  'en-US': {
    summary: 'Platform login cookies',
    help: 'Open tabs for the selected platform share these login cookies.',
    label: 'Platform',
    placeholder: 'Select a platform',
    confirm:
      'Log out of {platform} in this browser? Open tabs for this platform share its login cookies.',
    confirmShared:
      'Log out of {platform} in this browser? This clears {account} login cookies and may also sign you out of other sites or products that use that account.',
    cleared: 'Login cookies cleared. Refresh MD after switching accounts.',
    missing: 'No login cookies found.',
    remaining: 'Some login cookies remain. Sign out on the platform website.',
    failed: 'Could not clear login cookies. Sign out on the platform website.',
  },
  'zh-CN': {
    summary: '平台登录 Cookie',
    help: '所选平台已打开的标签页共用这份登录 Cookie。',
    label: '平台',
    placeholder: '请选择平台',
    confirm: '在当前浏览器中退出 {platform}？该平台已打开的标签页共用这份登录 Cookie。',
    confirmShared:
      '在当前浏览器中退出 {platform}？这会清除 {account} 的共享登录 Cookie，使用同一账号的其他网站或产品也可能退出登录。',
    cleared: '已清理登录 Cookie。切换账号后，请刷新 MD。',
    missing: '未找到登录 Cookie。',
    remaining: '仍有登录 Cookie，请在平台官网退出。',
    failed: '无法清理登录 Cookie，请在平台官网退出。',
  },
  'zh-TW': {
    summary: '平台登入 Cookie',
    help: '所選平台已開啟的分頁共用這份登入 Cookie。',
    label: '平台',
    placeholder: '請選擇平台',
    confirm: '要在目前的瀏覽器中登出 {platform} 嗎？該平台已開啟的分頁共用這份登入 Cookie。',
    confirmShared:
      '要在目前的瀏覽器中登出 {platform} 嗎？這會清除 {account} 的共用登入 Cookie，使用同一帳號的其他網站或產品也可能登出。',
    cleared: '已清除登入 Cookie。切換帳號後，請重新整理 MD。',
    missing: '找不到登入 Cookie。',
    remaining: '仍有登入 Cookie，請在平台官網登出。',
    failed: '無法清除登入 Cookie，請在平台官網登出。',
  },
  'ja-JP': {
    summary: 'プラットフォームのログイン Cookie',
    help: '選択したサイトのタブはログイン Cookie を共有します。',
    label: 'プラットフォーム',
    placeholder: 'プラットフォームを選択',
    confirm:
      'このブラウザーで {platform} からログアウトしますか？このサイトのタブはログイン Cookie を共有します。',
    confirmShared:
      'このブラウザーで {platform} からログアウトしますか？{account} の共有ログイン Cookie が削除され、同じアカウントを使う他のサイトや製品からもログアウトする場合があります。',
    cleared:
      'ログイン Cookie を削除しました。アカウントを切り替えた後、MD を再読み込みしてください。',
    missing: 'ログイン Cookie が見つかりませんでした。',
    remaining: 'ログイン Cookie が残っています。公式サイトでログアウトしてください。',
    failed: 'ログイン Cookie を削除できませんでした。公式サイトでログアウトしてください。',
  },
}

export function logoutMessages(locale) {
  if (locale === 'zh-TW' || locale === 'zh-HK') return messages['zh-TW']
  if (typeof locale === 'string' && locale.startsWith('zh')) return messages['zh-CN']
  if (typeof locale === 'string' && locale.startsWith('ja')) return messages['ja-JP']
  return messages['en-US']
}

const sharedAccountNames = {
  Toutiao: ['今日头条', '今日頭條'],
  Volcengine: ['火山引擎', '火山引擎'],
  Alipay: ['支付宝', '支付寶'],
  Baidu: ['百度通行证', '百度通行證'],
  'Tencent Cloud': ['腾讯云', '騰訊雲'],
  Sohu: ['搜狐通行证', '搜狐通行證'],
  Weibo: ['微博', '微博'],
  'Alibaba Cloud': ['阿里云', '阿里雲'],
  'Huawei Cloud': ['华为云', '華為雲'],
  'Baidu AI Cloud': ['百度智能云', '百度智能雲'],
}

export function logoutConfirmation(platform, locale) {
  const copy = logoutMessages(locale)
  const names = sharedAccountNames[platform.sharedLogin]
  const account =
    (copy === messages['zh-CN'] && names?.[0]) ||
    (copy === messages['zh-TW'] && names?.[1]) ||
    platform.sharedLogin
  return (account ? copy.confirmShared : copy.confirm)
    .replace('{platform}', platform.name)
    .replace('{account}', account ?? '')
}

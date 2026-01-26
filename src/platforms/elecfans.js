// 电子发烧友平台配置

export const ElecfansPlatform = {
  id: 'elecfans',
  name: '电子发烧友',
  icon: 'https://www.elecfans.com/favicon.ico',
  publishUrl: 'https://www.elecfans.com/d/article/md/',
  loginUrl: 'https://bbs.elecfans.com/member.php?mod=logging&action=login',
}

export const ElecfansLoginConfig = {
  type: 'api',
  apiUrl: 'https://www.elecfans.com/webapi/passport/checklogin',
  checkLoggedIn: (data) => {
    // API 返回格式: {"uid":"6999925","username":"jf_50493572","avatar":"https://..."}
    if (data && data.uid) {
      return {
        loggedIn: true,
        username: data.username || '',
        avatar: data.avatar || '',
      }
    }
    return { loggedIn: false }
  },
}

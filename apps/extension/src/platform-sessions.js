export const platformSessions = [
  {
    id: 'volcengine',
    name: '火山引擎开发者社区',
    sharedLogin: 'Volcengine',
    partitionKey: { topLevelSite: 'https://volcengine.com' },
    cookieScopes: [
      { domain: 'volcengine.com', lookupUrl: 'https://www.volcengine.com/', cookies: ['digest'] },
      {
        domain: 'developer.volcengine.com',
        lookupUrl: 'https://developer.volcengine.com/',
        cookies: ['third.digest'],
      },
    ],
  },
  {
    id: 'alipayopen',
    name: '支付宝开放平台',
    sharedLogin: 'Alipay',
    cookieScopes: [
      {
        domain: 'alipay.com',
        lookupUrl: 'https://developerportal.alipay.com/',
        cookies: ['ALIPAYJSESSIONID'],
      },
    ],
  },
  {
    id: 'cto51',
    name: '51CTO',
    sharedLogin: '51CTO',
    cookieScopes: [
      {
        domain: '51cto.com',
        lookupUrl: 'https://51cto.com/',
        cookies: ['pub_sauth1', 'pub_sauth2'],
      },
      {
        domain: 'home.51cto.com',
        lookupUrl: 'https://home.51cto.com/',
        cookies: ['_identity', 'PHPSESSID'],
      },
    ],
  },
  {
    id: 'baijiahao',
    name: '百家号',
    sharedLogin: 'Baidu',
    cookieScopes: [
      { domain: 'baidu.com', lookupUrl: 'https://baidu.com/', cookies: ['BDUSS', 'BDUSS_BFESS'] },
    ],
  },
  {
    id: 'tencentcloud',
    name: '腾讯云开发者社区',
    sharedLogin: 'Tencent Cloud',
    cookieScopes: [
      {
        domain: 'cloud.tencent.com',
        lookupUrl: 'https://cloud.tencent.com/',
        cookies: ['skey', 'refreshSession', 'qcommunity_session'],
      },
    ],
  },
  {
    id: 'sohu',
    name: '搜狐号',
    sharedLogin: 'Sohu',
    cookieScopes: [
      {
        domain: 'sohu.com',
        lookupUrl: 'https://sohu.com/',
        cookies: ['pprdig', 'umab_access_token'],
      },
    ],
  },
  {
    id: 'weibo',
    name: '微博头条',
    sharedLogin: 'Weibo',
    cookieScopes: [{ domain: 'weibo.com', cookies: ['SUB'] }],
  },
  {
    id: 'aliyun',
    name: '阿里云开发者社区',
    sharedLogin: 'Alibaba Cloud',
    cookieScopes: [
      {
        domain: 'aliyun.com',
        lookupUrl: 'https://developer.aliyun.com/',
        cookies: ['login_aliyunid_ticket'],
      },
    ],
  },
  {
    id: 'huaweicloud',
    name: '华为云开发者博客',
    sharedLogin: 'Huawei Cloud',
    cookieScopes: [
      {
        domain: 'huaweicloud.com',
        lookupUrl: 'https://devdata.huaweicloud.com/',
        cookies: ['ECO_CN_ID'],
      },
      // The auth service uses this ticket to silently issue a new ECO_CN_ID.
      {
        domain: 'auth.huaweicloud.com',
        lookupUrl: 'https://auth.huaweicloud.com/authui/login',
        cookies: ['SSOTGC'],
      },
    ],
  },
  {
    id: 'qianfan',
    name: '百度云千帆',
    sharedLogin: 'Baidu AI Cloud',
    cookieScopes: [
      { domain: 'baidu.com', lookupUrl: 'https://baidu.com/', cookies: ['bce-sessionid'] },
      {
        domain: 'bce.baidu.com',
        lookupUrl: 'https://bce.baidu.com/',
        cookies: ['bce-sessionid', 'bce-long-term-sessionid'],
      },
    ],
  },
  {
    id: 'huaweidev',
    name: '华为开发者文章',
    domain: 'developer.huawei.com',
    lookupUrl: 'https://developer.huawei.com/',
    cookies: ['authInfo', 'authdata'],
    includeSubdomains: false,
  },
  {
    id: 'douban',
    name: '豆瓣',
    domain: 'douban.com',
    lookupUrl: 'https://www.douban.com/',
    cookies: ['dbcl2'],
    includeSubdomains: false,
  },
  {
    id: 'segmentfault',
    name: '思否',
    domain: 'segmentfault.com',
    lookupUrl: 'https://segmentfault.com/',
    cookies: ['PHPSESSID'],
    includeSubdomains: false,
  },
  {
    id: 'xueqiu',
    name: '雪球',
    domain: 'xueqiu.com',
    lookupUrl: 'https://mp.xueqiu.com/',
    cookies: ['xq_a_token', 'xqat', 'xq_r_token'],
    includeSubdomains: false,
  },
  {
    id: 'cnblogs',
    name: '博客园',
    domain: 'cnblogs.com',
    lookupUrl: 'https://account.cnblogs.com/',
    cookies: ['.Cnblogs.AspNetCore.Cookies'],
  },
  {
    id: 'elecfans',
    name: '电子发烧友',
    domain: 'elecfans.com',
    lookupUrl: 'https://www.elecfans.com/',
    cookies: ['auth', 'auth_www'],
    includeSubdomains: false,
  },
  {
    id: 'csdn',
    name: 'CSDN',
    domain: 'csdn.net',
    lookupUrl: 'https://www.csdn.net/',
    cookies: ['UserToken'],
    includeSubdomains: false,
  },
  {
    id: 'infoq',
    name: 'InfoQ',
    domain: 'infoq.cn',
    lookupUrl: 'https://xie.infoq.cn/',
    cookies: ['GCESS'],
    includeSubdomains: false,
  },
  {
    id: 'oschina',
    name: '开源中国',
    domain: 'oschina.net',
    lookupUrl: 'https://www.oschina.net/',
    cookies: ['oscid'],
    includeSubdomains: false,
  },
  {
    id: 'douyin',
    name: '抖音',
    domain: 'douyin.com',
    cookies: ['sessionid', 'sessionid_ss', 'sid_tt', 'sid_guard'],
  },
  { id: 'wechat', name: '微信公众号', domain: 'mp.weixin.qq.com', cookies: ['slave_sid'] },
  {
    id: 'juejin',
    name: '掘金',
    domain: 'juejin.cn',
    lookupUrl: 'https://juejin.cn/',
    cookies: ['sessionid', 'sessionid_ss', 'sid_guard', 'sid_tt'],
  },
  {
    id: 'toutiao',
    name: '今日头条',
    sharedLogin: 'Toutiao',
    domain: 'toutiao.com',
    lookupUrl: 'https://toutiao.com/',
    cookies: [
      'sessionid',
      'sessionid_ss',
      'sid_guard',
      'sid_tt',
      'toutiao_sso_user',
      'toutiao_sso_user_ss',
    ],
  },
  {
    id: 'jianshu',
    name: '简书',
    domain: 'jianshu.com',
    lookupUrl: 'https://www.jianshu.com/',
    cookies: ['remember_user_token', '_m7e_session_core'],
  },
  {
    id: 'xiaohongshu',
    name: '小红书（国内）',
    domain: 'xiaohongshu.com',
    lookupUrl: 'https://creator.xiaohongshu.com/',
    cookies: ['web_session'],
  },
  {
    id: 'modelscope',
    name: 'ModelScope',
    domain: 'modelscope.cn',
    lookupUrl: 'https://modelscope.cn/',
    cookies: ['m_session_id'],
  },
  { id: 'zhihu', name: '知乎', domain: 'zhihu.com', cookies: ['z_c0'] },
  { id: 'bilibili', name: 'B站专栏', domain: 'bilibili.com', cookies: ['SESSDATA'] },
  { id: 'twitter', name: 'X', domain: 'x.com', cookies: ['auth_token', 'ct0'] },
  {
    id: 'medium',
    name: 'Medium',
    domain: 'medium.com',
    lookupUrl: 'https://medium.com/',
    cookies: ['sid', 'uid'],
  },
  {
    id: 'sspai',
    name: '少数派',
    domain: 'sspai.com',
    lookupUrl: 'https://sspai.com/',
    cookies: ['sspai_jwt_token', 'sspai_cross_token'],
  },
]

export async function clearPlatformSession(platform, clearSiteStorage) {
  if (platform.id === 'sspai' && !(await clearSiteStorage?.())) return 'failed'
  const scopes = platform.cookieScopes ?? [platform]
  const matchingCookies = async () => {
    const matches = await Promise.all(
      scopes.map(async scope => {
        const query = { domain: scope.domain }
        const matchesScope = cookie => {
          const domain = cookie.domain.replace(/^\./, '')
          return (
            scope.cookies.includes(cookie.name) &&
            (domain === scope.domain ||
              (!platform.cookieScopes &&
                scope.includeSubdomains !== false &&
                domain.endsWith(`.${scope.domain}`)))
          )
        }
        const candidates = (await chrome.cookies.getAll(query)).filter(matchesScope)
        if (scope.lookupUrl) {
          // Some credentials are visible to get() but omitted from getAll().
          const undiscovered = scope.cookies.filter(
            name => !candidates.some(cookie => cookie.name === name && !cookie.partitionKey)
          )
          const cookies = await Promise.all(
            undiscovered.map(name => chrome.cookies.get({ url: scope.lookupUrl, name }))
          )
          candidates.push(...cookies.filter(cookie => cookie && matchesScope(cookie)))
        }
        if (platform.partitionKey) {
          // A query with no partitionKey only sees unpartitioned cookies.
          const partitioned = await chrome.cookies.getAll({
            ...query,
            partitionKey: platform.partitionKey,
          })
          candidates.push(
            ...partitioned.filter(
              cookie =>
                cookie.partitionKey?.topLevelSite === platform.partitionKey.topLevelSite &&
                matchesScope(cookie)
            )
          )
        }
        return candidates
      })
    )
    return matches.flat()
  }

  const cookies = await matchingCookies()
  // Remove more specific paths first when cookies share the same name.
  cookies.sort((a, b) => b.path.length - a.path.length)
  for (const cookie of cookies) {
    const host = cookie.domain.replace(/^\./, '')
    const url = new URL(`https://${host}`)
    url.pathname = cookie.path
    await chrome.cookies.remove({
      url: url.href,
      name: cookie.name,
      storeId: cookie.storeId,
      ...(cookie.partitionKey && { partitionKey: cookie.partitionKey }),
      ...(cookie.firstPartyDomain !== undefined && { firstPartyDomain: cookie.firstPartyDomain }),
    })
  }

  if ((await matchingCookies()).length) return 'remaining'
  return cookies.length ? 'cleared' : 'missing'
}

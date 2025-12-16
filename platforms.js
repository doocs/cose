// 平台配置
const PLATFORMS = [
  {
    id: 'csdn',
    name: 'CSDN',
    icon: 'https://g.csdnimg.cn/static/logo/favicon32.ico',
    url: 'https://blog.csdn.net',
    publishUrl: 'https://editor.csdn.net/md/',
  },
  {
    id: 'juejin',
    name: 'Juejin',
    icon: 'https://lf-web-assets.juejin.cn/obj/juejin-web/xitu_juejin_web/static/favicons/favicon-32x32.png',
    url: 'https://juejin.cn',
    publishUrl: 'https://juejin.cn/editor/drafts/new',
  },
  {
    id: 'wechat',
    name: 'WeChat',
    icon: 'https://res.wx.qq.com/a/wx_fed/assets/res/NTI4MWU5.ico',
    url: 'https://mp.weixin.qq.com',
    // 先打开草稿箱，再自动点击新建
    publishUrl: 'https://mp.weixin.qq.com/cgi-bin/appmsg?t=media/appmsg_edit_v2&action=edit&isNew=1&type=10',
  },
  {
    id: 'zhihu',
    name: 'Zhihu',
    icon: 'https://static.zhihu.com/heifetz/favicon.ico',
    url: 'https://www.zhihu.com',
    publishUrl: 'https://zhuanlan.zhihu.com/write',
  },
]

// 导出供其他脚本使用
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { PLATFORMS }
}

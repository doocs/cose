// 搜狐号平台配置
const SohuPlatform = {
  id: 'sohu',
  name: 'Sohu',
  icon: 'https://statics.itc.cn/mp-new/icon/1.1/favicon.ico',
  url: 'https://mp.sohu.com',
  publishUrl: 'https://mp.sohu.com/mpfe/v4/contentManagement/news/addarticle?contentStatus=1',
  title: '搜狐号',
  type: 'sohu',
}

// 搜狐号内容填充函数
// 注意：搜狐号由 syncToPlatform 单独处理，此函数作为备用
async function fillSohuContent(content, waitFor) {
  console.log('[COSE] 搜狐号由 syncToPlatform 处理')
}

// 导出
export { SohuPlatform, fillSohuContent }

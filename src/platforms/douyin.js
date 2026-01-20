// 抖音创作者平台配置
const DouyinPlatform = {
  id: 'douyin',
  name: 'Douyin',
  icon: 'https://lf3-static.bytednsdoc.com/obj/eden-cn/yvahlyj_upfbvk_zlp/ljhwZthlaukjlkulzlp/pc_creator/favicon_v2_7145ff0.ico',
  url: 'https://creator.douyin.com/',
  publishUrl: 'https://creator.douyin.com/creator-micro/content/post/article?default-tab=5&enter_from=publish_page&media_type=article&type=new',
  title: '抖音',
  type: 'douyin',
}

// 抖音登录检测配置
// 使用 API 检测登录状态
const DouyinLoginConfig = {
  api: 'https://creator.douyin.com/web/api/media/user/info/',
  method: 'GET',
  checkLogin: (response) => response?.status_code === 0 && response?.user,
  getUserInfo: (response) => ({
    username: response?.user?.nickname || '',
    avatar: response?.user?.avatar_thumb?.url_list?.[0] || '',
  }),
}

// 导出
export { DouyinPlatform, DouyinLoginConfig }

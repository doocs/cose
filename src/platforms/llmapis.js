/**
 * LLMAPIS 平台配置
 * GitHub: https://github.com/holdno/llmapis
 *
 * 本站使用 Garden Post (动态) 系统作为内容发布目标
 * 发布页面: /garden/post/new
 *
 * 填充逻辑在 background.js 的 fillContentOnPage 函数中实现
 */

// LLMAPIS 平台配置
const LLMAPIsPlatform = {
  id: 'llmapis',
  name: 'LLMAPIS',
  icon: 'https://llmapis.com/favicon.ico',
  url: 'https://llmapis.com',
  publishUrl: 'https://llmapis.com/garden/post/new',
  title: 'LLMAPIS',
  type: 'llmapis.com',
}

// LLMAPIS 登录检测配置
const LLMAPIsLoginConfig = {
  api: 'https://llmapis.com/api/auth/session',
  method: 'GET',
  checkLogin: (response) => !!response?.session?.user?.id,
  getUserInfo: (response) => ({
    username: response?.profile?.username,
    avatar: response?.profile?.avatar_url,
  }),
}

export { LLMAPIsPlatform, LLMAPIsLoginConfig }

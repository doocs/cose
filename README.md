<div align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="assets/headerDark.svg" />
    <img src="assets/headerLight.svg" alt="COSE" />
  </picture>

*Create Once Sync Everywhere*

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Chrome Web Store](https://img.shields.io/badge/Install-Chrome%20Web%20Store-4285F4?logo=googlechrome&logoColor=white)](https://chromewebstore.google.com/detail/)
[![YouTube](https://img.shields.io/badge/Video-YouTube-FF0000?logo=youtube&logoColor=white)](https://www.youtube.com/watch?v=KTskiA8Xaj4)
[![Bilibili](https://img.shields.io/badge/Video-Bilibili-00A1D6?logo=bilibili&logoColor=white)](https://www.bilibili.com/video/BV1ZxqnB1E2C/)

</div>

配合 [doocs/md](https://github.com/doocs/md) 微信 Markdown 编辑器使用的浏览器扩展，支持一键将文章同步到多个内容平台。

## 特性

- 编辑一次，同步到多个平台
- 自动检测各平台登录状态
- 同步的标签页自动归入分组，便于管理
- 微信公众号同步时完整保留渲染样式并自动保存为草稿


## 支持的平台

| 平台 | 说明 |
|------|------|
| CSDN | 自动填充 Markdown 内容 |
| 掘金 | 自动填充 Markdown 内容 |
| 微信公众号 | 保留完整样式，自动保存草稿 |
| 知乎 | 自动填充 Markdown 内容 |
| 今日头条 | 自动填充 Markdown 内容 |

更多想要添加的平台欢迎提 [issue](https://github.com/doocs/cose/issues) 。

## 使用方法

> 点击观看视频：[![Bilibili](https://img.shields.io/badge/Video-Bilibili-00A1D6?logo=bilibili&logoColor=white)](https://www.bilibili.com/video/BV1ZxqnB1E2C/) [![YouTube](https://img.shields.io/badge/Video-YouTube-FF0000?logo=youtube&logoColor=white)](https://www.youtube.com/watch?v=KTskiA8Xaj4) 

1. 先点击安装扩展 [![Chrome Web Store](https://img.shields.io/badge/Install-Chrome%20Web%20Store-4285F4?logo=googlechrome&logoColor=white)](https://chromewebstore.google.com/detail/) 然后打开 [md.doocs.org](https://md.doocs.org) 或本地开发服务器
2. 编辑 Markdown 内容
3. 点击顶部的 **发布** 按钮
4. 在弹出的对话框中选择要同步的平台
5. 点击 **确定** 开始同步

## 开发者模式安装测试

1. 克隆或下载本项目
2. 打开 Chrome 浏览器，进入 `chrome://extensions/`
3. 开启右上角的 **开发者模式**
4. 点击 **加载已解压的扩展程序**
5. 选择 `cose` 目录
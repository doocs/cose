<div align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="assets/headerDark.svg" />
    <img src="assets/headerLight.svg" alt="COSE" />
  </picture>

_**C**reate **O**nce **S**ync **E**verywhere_

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Chrome Web Store](https://img.shields.io/badge/Install-Chrome%20Web%20Store-4285F4?logo=googlechrome&logoColor=white)](https://chromewebstore.google.com/detail/ilhikcdphhpjofhlnbojifbihhfmmhfk)
[![YouTube](https://img.shields.io/badge/Video-YouTube-FF0000?logo=youtube&logoColor=white)](https://www.youtube.com/watch?v=KTskiA8Xaj4)
[![Bilibili](https://img.shields.io/badge/Video-Bilibili-00A1D6?logo=bilibili&logoColor=white)](https://www.bilibili.com/video/BV1ZxqnB1E2C/)

</div>

配合 [doocs/md](https://github.com/doocs/md) Markdown 编辑器使用的浏览器扩展，支持一键将文章同步到多个内容平台。

> 本插件完全本地运行，不收集、不存储任何用户信息。**如需添加更多平台或改善同步准确度，欢迎提 [Issue](https://github.com/doocs/cose/issues) 或 [PR](https://github.com/doocs/cose/pulls)**。

## 使用方法

> 点击观看视频：[![Bilibili](https://img.shields.io/badge/Video-Bilibili-00A1D6?logo=bilibili&logoColor=white)](https://www.bilibili.com/video/BV1ZxqnB1E2C/) [![YouTube](https://img.shields.io/badge/Video-YouTube-FF0000?logo=youtube&logoColor=white)](https://www.youtube.com/watch?v=KTskiA8Xaj4) 

1. 先点击安装扩展 [![Chrome Web Store](https://img.shields.io/badge/Install-Chrome%20Web%20Store-4285F4?logo=googlechrome&logoColor=white)](https://chromewebstore.google.com/detail/ilhikcdphhpjofhlnbojifbihhfmmhfk) 然后打开 [md.doocs.org](https://md.doocs.org) 或本地开发环境
2. 编辑 Markdown 内容
3. 点击顶部的 **发布** 按钮
4. 在弹出的对话框中选择要同步的平台
5. 点击 **确定** 开始同步

## 特性

- 编辑一次，同步到多个平台
- 自动检测各平台登录状态
- 同步的标签页自动归入分组，便于管理
- 微信公众号同步时完整保留渲染样式并自动保存为草稿


## 已支持的平台

- 微信公众号
- 今日头条
- 知乎
- 博客园
- CSDN
- 掘金
- 思否
- 开源中国
- 51CTO
- InfoQ

更多想要添加的平台欢迎提 [Issue](https://github.com/doocs/cose/issues) ！

## 开发者模式测试

1. 克隆或下载本项目
2. 打开 Chrome 浏览器，进入 `chrome://extensions/`
3. 开启右上角的 **开发者模式**
4. 点击 **加载已解压的扩展程序**
5. 选择 `cose` 目录
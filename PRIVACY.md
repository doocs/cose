# Privacy Policy for COSE - 多平台文章同步

**Last Updated: December 13, 2025**

## Overview

COSE (Create Once, Sync Everywhere) is a browser extension that helps users sync articles from the md.doocs.org Markdown editor to multiple publishing platforms. We are committed to protecting your privacy.

## Data Collection

**We do not collect any personal data.**

COSE operates entirely locally within your browser. The extension:

- Does **NOT** collect personally identifiable information
- Does **NOT** collect health, financial, or authentication information
- Does **NOT** track your browsing history or web activity
- Does **NOT** send any data to external servers
- Does **NOT** use analytics or tracking services

## Data Usage

All data processed by COSE remains on your local device:

- **Article Content**: Your article title, body, and formatting are only read from md.doocs.org and transferred directly to the target publishing platforms within your browser.
- **Login Status**: The extension checks login cookies on target platforms (CSDN, Juejin, WeChat, etc.) solely to verify if you are logged in. This information is not stored or transmitted.
- **User Preferences**: COSE does not persist user preferences or settings.

## Permissions Explained

| Permission | Purpose |
|------------|---------|
| `tabGroups` | Organize sync tabs into groups |
| `activeTab` | Temporarily access the current tab when you initiate a sync |
| `scripting` | Fill article content into platform editors |
| `cookies` | Check platform login status |
| `debugger` | Simulate paste events for WeChat editor |
| `clipboardRead` | Read formatted content (HTML) from the clipboard for syncing |
| `clipboardWrite` | Write content to the clipboard when needed for syncing |

## Third-Party Services

COSE interacts with the following third-party publishing platforms only when you explicitly initiate a sync:

- CSDN (csdn.net)
- Juejin (juejin.cn)
- WeChat Official Account (mp.weixin.qq.com)
- And other supported platforms

These interactions are solely for the purpose of publishing your content. We have no control over the privacy practices of these platforms.

## Data Security

Since no data is collected or transmitted to our servers, there is no risk of data breach from our end. All operations occur locally in your browser.

## Children's Privacy

COSE is not directed at children under 13 years of age, and we do not knowingly collect information from children.

## Changes to This Policy

We may update this Privacy Policy from time to time. Any changes will be posted on this page with an updated revision date.

## Contact

If you have questions about this Privacy Policy, please open an issue at:

https://github.com/doocs/md/issues

## Open Source

COSE is open source. You can review the complete source code at:

https://github.com/doocs/md

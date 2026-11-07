# Privacy Policy for COSE - 多平台文章同步

**Last Updated: December 13, 2025**

## Overview

COSE (Create Once, Sync Everywhere) is a browser extension that helps users sync articles from the md.doocs.org Markdown editor to multiple publishing platforms. We are committed to protecting your privacy.

## Data Collection

COSE runs in your browser and has no COSE-operated collection server, analytics, or tracking. It communicates directly with the publishing platforms to check login status and sync articles.

## Data Usage

- **Article Content**: Your article title, body, and formatting are only read from md.doocs.org and transferred directly to the target publishing platforms within your browser.
- **Login Status**: The extension checks platform cookies and may use existing session credentials in requests to the corresponding platform to identify the signed-in account or fill a draft. COSE does not send these credentials to a COSE-operated server.
- **User Preferences**: COSE does not persist user preferences or settings.

## Permissions Explained

| Permission       | Purpose                                                      |
| ---------------- | ------------------------------------------------------------ |
| `tabGroups`      | Organize sync tabs into groups                               |
| `activeTab`      | Temporarily access the current tab when you initiate a sync  |
| `scripting`      | Fill article content into platform editors                   |
| `cookies`        | Check platform login status                                  |
| `debugger`       | Simulate paste events for WeChat editor                      |
| `clipboardRead`  | Read formatted content (HTML) from the clipboard for syncing |
| `clipboardWrite` | Write content to the clipboard when needed for syncing       |

## Third-Party Services

COSE interacts with publishing platforms to check login status or when you initiate a sync, including:

- CSDN (csdn.net)
- Juejin (juejin.cn)
- WeChat Official Account (mp.weixin.qq.com)
- And other supported platforms

The publishing platforms handle the data they receive under their own privacy policies.

## Data Security

COSE does not store your articles or credentials on a COSE-operated server.

## Children's Privacy

COSE is not directed at children under 13 years of age, and we do not knowingly collect information from children.

## Changes to This Policy

We may update this Privacy Policy from time to time. Any changes will be posted on this page with an updated revision date.

## Contact

If you have questions about this Privacy Policy, please open an issue at:

https://github.com/doocs/cose/issues

## Open Source

COSE is open source. You can review the complete source code at:

https://github.com/doocs/cose

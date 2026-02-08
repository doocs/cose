/**
 * Bilibili platform detection logic
 * Strategy:
 * 1. Call https://api.bilibili.com/x/web-interface/nav API
 * 2. Extract username (uname) and avatar (face)
 * 3. Convert hdslb.com avatar to base64 data URL to bypass CORS/ORB
 */
export async function detectBilibiliUser() {
    try {
        const response = await fetch('https://api.bilibili.com/x/web-interface/nav', {
            method: 'GET',
            credentials: 'include',
            headers: {
                'Accept': 'application/json',
                'Cache-Control': 'no-cache',
            },
        })
        const data = await response.json()

        if (data?.code !== 0 || !data?.data?.isLogin) {
            return { loggedIn: false }
        }

        const username = data.data.uname || ''
        let avatar = data.data.face || ''

        // Convert hdslb.com avatar to base64 data URL to bypass CORS/ORB
        if (avatar && avatar.includes('hdslb.com')) {
            try {
                const imgResp = await fetch(avatar, {
                    headers: { 'Referer': 'https://www.bilibili.com/' }
                })
                if (imgResp.ok) {
                    const blob = await imgResp.blob()
                    const buffer = await blob.arrayBuffer()
                    const bytes = new Uint8Array(buffer)
                    let binary = ''
                    for (let i = 0; i < bytes.length; i++) {
                        binary += String.fromCharCode(bytes[i])
                    }
                    const base64 = btoa(binary)
                    const mime = blob.type || 'image/jpeg'
                    avatar = `data:${mime};base64,${base64}`
                }
            } catch (e) {
                console.log('[COSE] bilibili avatar base64 conversion failed:', e.message)
            }
        }

        return { loggedIn: true, username, avatar }
    } catch (e) {
        console.log(`[COSE] bilibili 检测失败:`, e.message)
        return { loggedIn: false }
    }
}

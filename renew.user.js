// ==UserScript==
// @name         Extend VPS Expiration
// @namespace    http://tampermonkey.net/
// @version      2025-07-17
// @description  Auto Renew Free VPS Expiration
// @author       You
// @match        https://secure.xserver.ne.jp/xapanel*/xvps*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=xserver.ne.jp
// @grant        GM_getValue
// @grant        GM_setValue
// @updateURL    https://raw.githubusercontent.com/GitHub30/extend-vps-exp/refs/heads/main/renew.user.js
// @downloadURL  https://raw.githubusercontent.com/GitHub30/extend-vps-exp/refs/heads/main/renew.user.js
// @supportURL   https://github.com/GitHub30/extend-vps-exp
// ==/UserScript==

// Usage:
//   1. Please bookmark https://secure.xserver.ne.jp/xapanel/login/xvps/
//   2. Open the URL everyday
//   3. (option) Save email and password on Login page

// Login
if (location.pathname.startsWith('/xapanel/login/xvps')) {
    const memberid = GM_getValue('memberid')
    const user_password = GM_getValue('user_password')
    if (memberid && user_password && !document.querySelector('.errorMessage')) {
        unsafeWindow.memberid.value = memberid
        unsafeWindow.user_password.value = user_password
        unsafeWindow.loginFunc()
    }
    // eslint-disable-next-line no-undef
    $('#login_area').on('submit', () => {
        GM_setValue('memberid', unsafeWindow.memberid.value)
        GM_setValue('user_password', unsafeWindow.user_password.value)
    })
}

// Check expiration date
if (location.pathname.startsWith('/xapanel/xvps/index')) {
    const tomorrow = new Date(Date.now() + 864e5).toLocaleDateString('sv')
    const expireDate = document.querySelector('tr:has(.freeServerIco) .contract__term')?.textContent
    if (expireDate === tomorrow) {
        const href = document.querySelector('tr:has(.freeServerIco) a[href^="/xapanel/xvps/server/detail?id="]').href
        location = href.replace('detail?id', 'freevps/extend/index?id_vps')
    }
}

// Extend expiration date
if (location.pathname.startsWith('/xapanel/xvps/server/freevps/extend/index')) {
    document.querySelector('[formaction="/xapanel/xvps/server/freevps/extend/conf"]').click()
}

// Solve CAPTCHA
if ((location.pathname.startsWith('/xapanel/xvps/server/freevps/extend/conf') || location.pathname.startsWith('/xapanel/xvps/server/freevps/extend/do')) && unsafeWindow.submit_button) {
    const body = document.querySelector('img[src^="data:"]').src
    const code = await fetch('https://captcha-120546510085.asia-northeast1.run.app', { method: 'POST', body }).then(r => r.text())
    document.querySelector('[placeholder="上の画像の数字を入力"]').value = code
    setInterval(() => {
        if (document.querySelector('[name=cf-turnstile-response]').value) unsafeWindow.submit_button.click()
    }, 1000)
}

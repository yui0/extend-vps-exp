// ==UserScript==
// @name         Extend VPS Expiration
// @name:zh-CN   Xserver VPS 自动续期脚本
// @namespace    http://tampermonkey.net/
// @version      2025-07-21
// @description  Automatically renews the expiration date of free Xserver VPS.
// @description:zh-CN 自动为 Xserver 的免费 VPS 续期。
// @author       You
// @match        https://secure.xserver.ne.jp/xapanel*/xvps*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=xserver.ne.jp
// @grant        GM_getValue
// @grant        GM_setValue
// @updateURL    https://raw.githubusercontent.com/GitHub30/extend-vps-exp/refs/heads/main/renew.user.js
// @downloadURL  https://raw.githubusercontent.com/GitHub30/extend-vps-exp/refs/heads/main/renew.user.js
// @supportURL   https://github.com/GitHub30/extend-vps-exp
// ==/UserScript==

/*
 * =================================================================================================
 * 使用说明 (Usage Instructions)
 * =================================================================================================
 * 1. 请将登录页面设为浏览器书签： https://secure.xserver.ne.jp/xapanel/login/xvps/
 * (Bookmark the login page)
 *
 * 2. 每天访问一次该书签。
 * (Visit the bookmark once every day.)
 *
 * 3. (可选) 首次访问时，在登录页面输入您的邮箱和密码，脚本会自动保存。之后访问将自动填充和登录。
 * (Optional) On your first visit, enter your email and password on the login page.
 * The script will save them automatically for future auto-login.
 *
 * =================================================================================================
 * 工作流程 (Workflow)
 * =================================================================================================
 * 1. 登录页面: 自动填充已保存的凭据并提交。
 * (Login Page: Auto-fills saved credentials and submits.)
 *
 * 2. VPS管理主页: 检查免费VPS的到期日期。如果明天到期，则跳转到续期页面。
 * (VPS Dashboard: Checks the expiration date. If it expires tomorrow, it navigates to the renewal page.)
 *
 * 3. 续期申请页: 自动点击“确认”按钮，进入验证码页面。
 * (Renewal Page: Clicks the confirmation button to proceed to the CAPTCHA page.)
 *
 * 4. 验证码页:
 * a. 提取验证码图片。
 * b. 发送到外部API服务进行识别。
 * c. 自动填充识别结果。
 * d. 监听 Cloudflare Turnstile (一种人机验证) 的令牌生成，一旦生成，立即提交表单。
 * (CAPTCHA Page: Extracts the CAPTCHA image, sends it to a recognition service,
 * fills the result, and submits the form once the Cloudflare Turnstile token is ready.)
 * =================================================================================================
 */

(function() {
    'use strict';

    /**
     * @description 登录页面逻辑：自动填充并保存用户凭据。
     */
    if (location.pathname.startsWith('/xapanel/login/xvps')) {
        const memberid = GM_getValue('memberid');
        const user_password = GM_getValue('user_password');

        // 如果存在已保存的凭据且页面没有显示错误消息，则自动填充并登录
        if (memberid && user_password && !document.querySelector('.errorMessage')) {
            unsafeWindow.memberid.value = memberid;
            unsafeWindow.user_password.value = user_password;
            // 调用页面自带的登录函数
            unsafeWindow.loginFunc();
        }

        // 监听登录表单的提交事件，以便保存用户输入的凭据
        // 确保 jQuery 已加载
        if (typeof $ !== 'undefined') {
            $('#login_area').on('submit', () => {
                GM_setValue('memberid', unsafeWindow.memberid.value);
                GM_setValue('user_password', unsafeWindow.user_password.value);
            });
        }
    }

    /**
     * @description VPS 管理主页逻辑：检查到期时间并跳转。
     */
    if (location.pathname.startsWith('/xapanel/xvps/index')) {
        // 计算明天的日期，格式为 YYYY-MM-DD (瑞典时区格式)
        const tomorrow = new Date(Date.now() + 86400000).toLocaleDateString('sv');
        const expireDate = document.querySelector('tr:has(.freeServerIco) .contract__term')?.textContent;

        // 如果到期日是明天，则准备续期
        if (expireDate === tomorrow) {
            const href = document.querySelector('tr:has(.freeServerIco) a[href^="/xapanel/xvps/server/detail?id="]').href;
            // 跳转到续期页面
            location.href = href.replace('detail?id', 'freevps/extend/index?id_vps');
        }
    }

    /**
     * @description 续期申请页面逻辑：自动点击确认按钮。
     */
    if (location.pathname.startsWith('/xapanel/xvps/server/freevps/extend/index')) {
        const extendButton = document.querySelector('[formaction="/xapanel/xvps/server/freevps/extend/conf"]');
        if (extendButton) {
            extendButton.click();
        }
    }

    /**
     * @description 验证码页面逻辑：识别并提交验证码。
     * 使用 IIFE (立即调用的函数表达式) 来创建异步上下文，以便使用 await。
     */
    if ((location.pathname.startsWith('/xapanel/xvps/server/freevps/extend/conf') || location.pathname.startsWith('/xapanel/xvps/server/freevps/extend/do')) && unsafeWindow.submit_button) {
        (async function() {
            try {
                const img = document.querySelector('img[src^="data:"]');
                if (!img) {
                    console.log('CAPTCHA image not found.');
                    return;
                }

                const body = img.src;
                // 调用外部API来识别验证码图片
                const code = await fetch('https://captcha-120546510085.asia-northeast1.run.app', { method: 'POST', body }).then(r => r.text());

                const input = document.querySelector('[placeholder="上の画像の数字を入力"]');
                if (input) {
                    input.value = code;
                }

                // 处理 Cloudflare Turnstile 人机验证
                const cf = document.querySelector('.cf-turnstile [name=cf-turnstile-response]');
                if (cf) {
                    // 如果令牌已经存在，直接点击提交
                    if (cf.value) {
                        unsafeWindow.submit_button.click();
                        return;
                    }
                    // 如果令牌尚不存在，则使用 MutationObserver 监听其值的变化
                    // 一旦 cf-turnstile-response 的 value 被填充，就立即点击提交按钮
                    new MutationObserver((mutationsList, observer) => {
                        for(const mutation of mutationsList) {
                            if (mutation.type === 'attributes' && mutation.attributeName === 'value' && cf.value) {
                                unsafeWindow.submit_button.click();
                                observer.disconnect(); // 任务完成，停止监听
                            }
                        }
                    }).observe(cf, { attributes: true, attributeFilter: ['value'] });
                }
            } catch (error) {
                console.error('Error solving CAPTCHA:', error);
            }
        })();
    }
})();

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
        console.log(`[VPS续期脚本] 当前在登录页面。`);
        const memberid = GM_getValue('memberid');
        const user_password = GM_getValue('user_password');

        // 如果存在已保存的凭据且页面没有显示错误消息，则自动填充并登录
        if (memberid && user_password && !document.querySelector('.errorMessage')) {
            console.log(`[VPS续期脚本] 发现已保存的凭据，正在尝试自动登录...`);
            unsafeWindow.memberid.value = memberid;
            unsafeWindow.user_password.value = user_password;
            // 调用页面自带的登录函数
            unsafeWindow.loginFunc();
        } else {
            console.log(`[VPS续期脚本] 未发现凭据或页面有错误信息，等待用户手动操作。`);
        }

        // 监听登录表单的提交事件，以便保存用户输入的凭据
        if (typeof $ !== 'undefined') {
            $('#login_area').on('submit', () => {
                GM_setValue('memberid', unsafeWindow.memberid.value);
                GM_setValue('user_password', unsafeWindow.user_password.value);
                console.log(`[VPS续期脚本] 已保存新的用户凭据。`);
            });
        }
    }

    /**
     * @description VPS 管理主页逻辑：检查到期时间并跳转。
     */
    if (location.pathname.startsWith('/xapanel/xvps/index')) {
        // 计算明天的日期，格式为 YYYY-MM-DD (瑞典时区格式)
        const tomorrow = new Date(Date.now() + 86400000).toLocaleDateString('sv', { timeZone: 'Asia/Tokyo' });
        const expireDate = document.querySelector('tr:has(.freeServerIco) .contract__term')?.textContent;
        
        console.log(`[VPS续期脚本] 检查到期时间...`);
        console.log(`[VPS续期脚本] 页面上的到期日: ${expireDate || '未找到'}`);
        console.log(`[VPS续期脚本] 明天的日期: ${tomorrow}`);

        // 如果到期日是明天，则准备续期
        if (expireDate === tomorrow) {
            console.log(`[VPS续期脚本] 条件满足：到期日为明天。正在跳转到续期页面...`);
            const href = document.querySelector('tr:has(.freeServerIco) a[href^="/xapanel/xvps/server/detail?id="]').href;
            // 跳转到续期页面
            location.href = href.replace('detail?id', 'freevps/extend/index?id_vps');
        } else {
            console.log(`[VPS续期脚本] 条件不满足：无需执行续期操作。`);
        }
    }

    /**
     * @description 续期申请页面逻辑：自动点击确认按钮。
     */
    if (location.pathname.startsWith('/xapanel/xvps/server/freevps/extend/index')) {
        console.log(`[VPS续期脚本] 当前在续期申请页面。`);
        const extendButton = document.querySelector('[formaction="/xapanel/xvps/server/freevps/extend/conf"]');
        if (extendButton) {
            console.log(`[VPS续期脚本] 找到续期按钮，正在点击...`);
            extendButton.click();
        } else {
            console.log(`[VPS续期脚本] 未找到续期按钮。`);
        }
    }

    /**
     * @description 验证码页面逻辑：识别并提交验证码。
     * 使用 IIFE (立即调用的函数表达式) 来创建异步上下文，以便使用 await。
     */
    if ((location.pathname.startsWith('/xapanel/xvps/server/freevps/extend/conf') || location.pathname.startsWith('/xapanel/xvps/server/freevps/extend/do')) && unsafeWindow.submit_button) {
        (async function() {
            console.log(`[VPS续期脚本] 当前在验证码页面，开始处理验证码...`);
            try {
                const img = document.querySelector('img[src^="data:"]');
                if (!img) {
                    console.log('[VPS续期脚本] 未找到验证码图片。');
                    return;
                }
                console.log('[VPS续期脚本] 已找到验证码图片，正在发送到API进行识别...');

                const body = img.src;
                // 调用外部API来识别验证码图片
                const code = await fetch('https://captcha-120546510085.asia-northeast1.run.app', { method: 'POST', body }).then(r => r.text());
                console.log(`[VPS续期脚本] API返回验证码: ${code}`);

                const input = document.querySelector('[placeholder="上の画像の数字を入力"]');
                if (input) {
                    input.value = code;
                    console.log(`[VPS续期脚本] 已将验证码填入输入框。`);
                }

                // 处理 Cloudflare Turnstile 人机验证
                const cf = document.querySelector('.cf-turnstile [name=cf-turnstile-response]');
                if (cf) {
                    console.log(`[VPS续期脚本] 正在处理 Cloudflare Turnstile...`);
                    if (cf.value) {
                        console.log(`[VPS续期脚本] Cloudflare 令牌已存在，直接提交表单。`);
                        unsafeWindow.submit_button.click();
                        return;
                    }
                    console.log(`[VPS续期脚本] Cloudflare 令牌不存在，设置监听器等待生成...`);
                    // 一旦 cf-turnstile-response 的 value 被填充，就立即点击提交按钮
                    new MutationObserver((mutationsList, observer) => {
                        for(const mutation of mutationsList) {
                            if (mutation.type === 'attributes' && mutation.attributeName === 'value' && cf.value) {
                                console.log(`[VPS续期脚本] Cloudflare 令牌已生成，正在提交表单...`);
                                unsafeWindow.submit_button.click();
                                observer.disconnect(); // 任务完成，停止监听
                            }
                        }
                    }).observe(cf, { attributes: true, attributeFilter: ['value'] });
                }
            } catch (error) {
                console.error('[VPS续期脚本] 处理验证码时发生错误:', error);
            }
        })();
    }
})();

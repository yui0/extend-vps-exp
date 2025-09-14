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
// @grant        GM_addStyle
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

// 翻訳
function t(text) {
    const translations = {
        '正在处理登录...': { en: 'Processing login...', ja: 'ログインを処理しています...', },
        '已检测到保存凭据，正在自动登录...': { en: 'Saved credentials detected, automatically logging in...', ja: '保存された認証情報を検出しました。自動ログイン中...', },
        '警告：登录函数异常，请手动登录。': { en: 'Warning: login function error, please log in manually.', ja: '警告：ログイン機能に異常が発生しました。手動でログインしてください。', },
        '自动登录失败，请手动登录。': { en: 'Automatic login failed, please log in manually.', ja: '自動ログインに失敗しました。手動でログインしてください。', },
        '正在检查续期状态...': { en: 'Checking renewal status...', ja: '更新状況を確認しています...', },
        '未找到免费VPS。': { en: 'No free VPS found.', ja: '無料VPSが見つかりませんでした。', },
        '检测到即将过期，正在续期...': { en: 'Detected imminent expiration, renewing...', ja: '期限切れが間近であることを検出しました。更新中...', },
        '当前VPS无需续期。': { en: 'Current VPS does not require renewal.', ja: '現在のVPSは更新不要です。', },
        '检查续期状态出错，请刷新页面重试。': { en: 'Error checking renewal status, please refresh the page and try again.', ja: '更新状況の確認中にエラーが発生しました。ページをリロードして再試行してください。', },
        '正在准备续期申请...': { en: 'Preparing renewal request...', ja: '更新リクエストを準備しています...', },
        '正在确认续期协议...': { en: 'Confirming renewal agreement...', ja: '更新契約を確認しています...', },
        '续期申请页面交互失败。': { en: 'Failed to interact with the renewal request page.', ja: '更新申請ページの操作に失敗しました。', },
        '正在识别并输入验证码...': { en: 'Recognizing and entering CAPTCHA...', ja: 'CAPTCHAを認識して入力しています...', },
        '正在识别验证码，请稍候...': { en: 'Recognizing CAPTCHA, please wait...', ja: 'CAPTCHAを認識しています。しばらくお待ちください...', },
        '验证码识别完成，准备提交表单...': { en: 'CAPTCHA recognition complete, preparing to submit form...', ja: 'CAPTCHAの認識が完了しました。フォームを送信する準備をしています...', },
        '已完成验证码填写，正在处理人机验证...': { en: 'CAPTCHA entry complete, processing human verification...', ja: 'CAPTCHAの入力が完了しました。人間認証を処理中...', },
        '等待人机验证令牌生成...': { en: 'Waiting for human verification token generation...', ja: '人間認証トークンの生成を待っています...', },
        '人机验证响应超时，强制提交...': { en: 'Human verification response timed out, forcing submission...', ja: '人間認証の応答がタイムアウトしました。強制送信中...', },
        '验证码处理异常，请刷新页面重试。': { en: 'CAPTCHA processing error, please refresh the page and try again.', ja: 'CAPTCHA処理でエラーが発生しました。ページをリロードして再試行してください。', },
        '所有验证已完成，准备提交...': { en: 'All verifications completed, preparing to submit...', ja: 'すべての認証が完了しました。送信準備中...', },
        '找不到提交按钮，请手动提交表单': { en: 'Submit button not found, please submit the form manually.', ja: '送信ボタンが見つかりません。手動でフォームを送信してください。', },
        'Cloudflare Turnstileのチェックボックスをクリックできませんでした。手動でチェックボックスをクリックしてください。': { en: 'Failed to click Cloudflare Turnstile checkbox. Please click it manually.', ja: 'Cloudflare Turnstileのチェックボックスをクリックできませんでした。手動でチェックボックスをクリックしてください。', }
    }
    if (!navigator?.language) return text
    return translations[text]?.[navigator.language.slice(0, 2)] ?? text
}

(function () {
    'use strict';

    // 給脚本日志添加統一前缀，便於識別
    const LOG_PREFIX = "[VPS续期脚本]";

    let isRunning = false;

    GM_addStyle(`
        #vps-renewal-progress {
            position: fixed;
            top: 10px;
            right: 10px;
            z-index: 10000;
            background: #333;
            color: white;
            padding: 10px;
            border-radius: 5px;
            font-size: 12px;
            box-shadow: 0 0 10px rgba(0,0,0,0.5);
        }
    `);

    // 等待DOM加载完成
    function waitForDOMReady() {
        return new Promise(resolve => {
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', resolve);
            } else {
                resolve();
            }
        });
    }

    // 等待jQuery加载完成
    function waitForjQuery() {
        return new Promise(resolve => {
            if (typeof $ !== 'undefined') {
                resolve();
            } else {
                const checkjQuery = setInterval(() => {
                    if (typeof $ !== 'undefined') {
                        clearInterval(checkjQuery);
                        resolve();
                    }
                }, 50);
            }
        });
    }

    /**
     * 創建一個狀態提示元素並顯示消息
     */
    function createStatusElement(message) {
        removeStatusElement(); // 先移除已有的元素
        const statusEl = document.createElement('div');
        statusEl.id = 'vps-renewal-progress';
        statusEl.textContent = t(message);
        document.body.appendChild(statusEl);
    }

    /**
     * 更新或移除狀態提示元素
     */
    function updateStatusElement(message) {
        const statusEl = document.getElementById('vps-renewal-progress');
        if (statusEl) {
            statusEl.textContent = t(message);
        } else {
            createStatusElement(message);
        }
    }

    function removeStatusElement() {
        const statusEl = document.getElementById('vps-renewal-progress');
        if (statusEl) {
            statusEl.remove();
        }
    }

    /**
     * 登錄頁面邏輯：自動填充並保存用戶憑據
     */
    async function handleLogin() {
        console.log(`${LOG_PREFIX} 当前在登录页面。`);
        updateStatusElement("正在处理登录...");

        const memberid = GM_getValue('memberid');
        const user_password = GM_getValue('user_password');

        // 判斷是否可以進行自動登錄（存在保存的憑據並且沒有錯誤）
        if (memberid && user_password && !document.querySelector('.errorMessage')) {
            console.log(`${LOG_PREFIX} 發現已保存的憑據，正在嘗試自動登錄...`);
            try {
                // 確保表單元素存在再進行賦值
                if (unsafeWindow.memberid && unsafeWindow.user_password) {
                    unsafeWindow.memberid.value = memberid;
                    unsafeWindow.user_password.value = user_password;
                    updateStatusElement("已检测到保存凭据，正在自动登录...");
                    // 延遲調用避免頁面未完全渲染的問題
                    setTimeout(() => {
                        if (typeof unsafeWindow.loginFunc === 'function') {
                            unsafeWindow.loginFunc();
                        } else {
                            console.warn(`${LOG_PREFIX} 頁面登錄函數 loginFunc 不存在或不是函數。`);
                            updateStatusElement("警告：登录函数异常，请手动登录。");
                        }
                    }, 500);
                } else {
                    throw new Error('登錄表單元素不存在');
                }
            } catch (e) {
                console.error(`${LOG_PREFIX} 自動登錄失敗: `, e);
                updateStatusElement("自动登录失败，请手动登录。");
            }
        } else {
            console.log(`${LOG_PREFIX} 未發現憑據或頁面有錯誤信息，等待用戶手動操作。`);
            // 監聽用戶提交登錄表單以保存數據
            await waitForjQuery();
            if (typeof $ !== 'undefined') {
                $('#login_area').on('submit', function () {
                    try {
                        // 防止重複保存
                        if (unsafeWindow.memberid && unsafeWindow.user_password) {
                            GM_setValue('memberid', unsafeWindow.memberid.value);
                            GM_setValue('user_password', unsafeWindow.user_password.value);
                            console.log(`${LOG_PREFIX} 已保存新的用戶憑據。`);
                        }
                    } catch (e) {
                        console.error(`${LOG_PREFIX} 保存憑據時出錯:`, e);
                    }
                });
            }
        }
    }

    /**
     * VPS管理主頁邏輯：檢查到期時間和跳轉
     */
    function handleVPSDashboard() {
        console.log(`${LOG_PREFIX} 当前在VPS管理主页。`);
        updateStatusElement("正在检查续期状态...");

        try {
            // 計算明天的日期，格式為 yyyy-mm-dd (瑞典時區格式更穩定)
            const tomorrow = new Date(Date.now() + 86400000).toLocaleDateString('sv', { timeZone: 'Asia/Tokyo' });
            const row = document.querySelector('tr:has(.freeServerIco)');

            if (!row) {
                console.log(`${LOG_PREFIX} 未找到免费VPS条目。`);
                updateStatusElement("未找到免费VPS。");
                return;
            }

            const expireSpan = row.querySelector('.contract__term');
            const expireDate = expireSpan ? expireSpan.textContent.trim() : null;

            console.log(`${LOG_PREFIX} 页面上的到期日: ${expireDate || '未找到'}`);
            console.log(`${LOG_PREFIX} 明天的日期: ${tomorrow}`);

            if (expireDate === tomorrow) {
                console.log(`${LOG_PREFIX} 條件滿足：到期日為明天。正在跳轉到續期頁面...`);
                const detailLink = row.querySelector('a[href^="/xapanel/xvps/server/detail?id="]');
                if (detailLink && detailLink.href) {
                    updateStatusElement("检测到即将过期，正在续期...");
                    setTimeout(() => {
                        location.href = detailLink.href.replace('detail?id', 'freevps/extend/index?id_vps');
                    }, 1000);
                } else {
                    throw new Error('無法定位續期鏈接');
                }
            } else {
                console.log(`${LOG_PREFIX} 條件不滿足：無需執行續期操作。`);
                updateStatusElement("当前VPS无需续期。");
                setTimeout(removeStatusElement, 3000);
            }
        } catch (e) {
            console.error(`${LOG_PREFIX} 在VPS管理主頁處理出現錯誤:`, e);
            updateStatusElement("检查续期状态出错，请刷新页面重试。");
        }
    }

    /**
     * 續期申請頁面邏輯：自動點擊確認按鈕
     */
    function handleRenewalPage() {
        console.log(`${LOG_PREFIX} 当前在续期申请页面。`);
        updateStatusElement("正在准备续期申请...");

        try {
            // 延遲一下確保頁面內容穩定
            setTimeout(() => {
                const extendButton = document.querySelector('[formaction="/xapanel/xvps/server/freevps/extend/conf"]');
                if (extendButton) {
                    console.log(`${LOG_PREFIX} 找到續期按鈕，正在點擊...`);
                    updateStatusElement("正在确认续期协议...");
                    setTimeout(() => {
                        extendButton.click();
                    }, 800);
                } else {
                    throw new Error('未找到續期按鈕');
                }
            }, 1000);
        } catch (e) {
            console.error(`${LOG_PREFIX} 續期確認按鈕處理異常:`, e);
            updateStatusElement("续期申请页面交互失败。");
        }
    }

    /**
     * 驗證碼頁面邏輯：識別並提交驗證碼
     */
    async function handleCaptchaPage() {
        console.log(`${LOG_PREFIX} 当前在验证码页面，开始处理验证码...`);
        updateStatusElement("正在识别并输入验证码...");

        try {
            // 等待DOM加载完成
            await waitForDOMReady();

            // 查找验证码图片（确保是base64编码）
            const img = document.querySelector('img[src^="data:image"]') || document.querySelector('img[src^="data:"]');
            if (!img || !img.src) {
                throw new Error('未找到验证码图片');
            }

            console.log(`${LOG_PREFIX} 已找到验证码图片，正在发送到API进行识别...`);
            updateStatusElement("正在识别验证码，请稍候...");

            // 调用外部API识别验证码
            let codeResponse;
            const maxRetries = 3;
            let retryCount = 0;

            while (retryCount < maxRetries) {
                try {
                    const response = await fetch('https://captcha-120546510085.asia-northeast1.run.app', {
                        method: 'POST',
                        body: img.src,
                        headers: {
                            'Content-Type': 'text/plain'
                        }
                    });

                    if (!response.ok) {
                        throw new Error(`API请求失败: ${response.status}`);
                    }

                    codeResponse = await response.text();
                    if (codeResponse && codeResponse.length >= 4) break;

                    throw new Error('API返回无效验证码');
                } catch (err) {
                    retryCount++;
                    if (retryCount >= maxRetries) {
                        throw err;
                    }
                    console.log(`${LOG_PREFIX} 验证码识别失败，正在进行第${retryCount}次重试...`);
                }
            }

            const code = codeResponse.trim();
            if (!code || code.length < 4) {
                throw new Error('未接收到有效验证码或验证码太短');
            }

            console.log(`${LOG_PREFIX} API返回验证码: ${code}`);
            updateStatusElement("验证码识别完成，准备提交表单...");

            // 将验证码填入输入框
            const input = document.querySelector('[placeholder*="上の画像"]');
            if (!input) {
                throw new Error('未找到验证码输入框');
            }

            input.value = code;
            input.dispatchEvent(new Event('input', { bubbles: true }));
            console.log(`${LOG_PREFIX} 已将验证码填入输入框。`);
            updateStatusElement("已完成验证码填写，正在处理人机验证...");

            // Cloudflare Turnstileチェックボックスを待機
            async function waitForTurnstileCheckbox() {
                return new Promise((resolve) => {
                    const checkExist = setInterval(() => {
                        const turnstileCheckbox = document.querySelector('.cf-turnstile .ctp-checkbox-label, .cf-turnstile [type="checkbox"]');
                        if (turnstileCheckbox) {
                            clearInterval(checkExist);
                            resolve(turnstileCheckbox);
                        }
                    }, 500);
                    setTimeout(() => {
                        clearInterval(checkExist);
                        resolve(null); // 10秒後にタイムアウト
                    }, 10000);
                });
            }

            // クリックイベントのシミュレーション
            function simulateClick(element) {
                const event = new MouseEvent('click', {
                    view: window,
                    bubbles: true,
                    cancelable: true
                });
                element.dispatchEvent(event);
            }

            // Cloudflare Turnstileのチェックボックス処理
            console.log(`${LOG_PREFIX} Cloudflare Turnstileのコンテナを確認:`, document.querySelector('.cf-turnstile')?.outerHTML);
            const turnstileCheckbox = await waitForTurnstileCheckbox();
            if (turnstileCheckbox) {
                console.log(`${LOG_PREFIX} Cloudflare Turnstileのチェックボックスを検出しました。クリックを試みます...`);
                simulateClick(turnstileCheckbox);
            } else {
                console.log(`${LOG_PREFIX} Cloudflare Turnstileのチェックボックスが見つかりませんでした。非インタラクティブモードの可能性があります。`);
                updateStatusElement("Cloudflare Turnstileのチェックボックスをクリックできませんでした。手動でチェックボックスをクリックしてください。");
            }

            // Cloudflare Turnstileのトークン処理
            const cfContainer = document.querySelector('.cf-turnstile');
            if (!cfContainer) {
                console.warn(`${LOG_PREFIX} 未検到Cloudflare组件，可能页面结构变化。`);
                submitForm();
                return;
            }

            const cf = cfContainer.querySelector('[name=cf-turnstile-response]');
            if (cf && cf.value) {
                console.log(`${LOG_PREFIX} Cloudflare 令牌已存在，直接提交表单。`);
                submitForm();
                return;
            }

            console.log(`${LOG_PREFIX} Cloudflare 令牌不存在，设置监听器等待生成...`);
            updateStatusElement("等待人机验证令牌生成...");

            // タイムアウト設定
            const timeoutId = setTimeout(() => {
                console.error(`${LOG_PREFIX} Cloudflare Turnstile令牌生成超时，强制提交表单。`);
                updateStatusElement("人机验证响应超时，强制提交...");
                submitForm();
            }, 15000);

            // cf-turnstile-responseの監視
            const observer = new MutationObserver((mutationsList) => {
                for (const mutation of mutationsList) {
                    if (
                        mutation.type === 'attributes' &&
                        mutation.attributeName === 'value' &&
                        cf.value
                    ) {
                        console.log(`${LOG_PREFIX} Cloudflare 令牌已生成，正在提交表单...`);
                        clearTimeout(timeoutId);
                        observer.disconnect();
                        submitForm();
                        return;
                    }
                }
            });

            observer.observe(cf, { attributes: true, attributeFilter: ['value'] });

        } catch (error) {
            console.error(`${LOG_PREFIX} 处理验证码时发生错误:`, error);
            updateStatusElement("验证码处理异常，请刷新页面重试。");
        }

        // フォーム送信ロジック
        function submitForm() {
            updateStatusElement("所有验证已完成，准备提交...");
            setTimeout(() => {
                if (typeof unsafeWindow.submit_button !== 'undefined' &&
                    unsafeWindow.submit_button &&
                    typeof unsafeWindow.submit_button.click === 'function') {
                    unsafeWindow.submit_button.click();
                } else {
                    const submitBtn = document.querySelector('input[type="submit"], button[type="submit"]');
                    if (submitBtn) {
                        submitBtn.click();
                    } else {
                        console.error(`${LOG_PREFIX} 未找到可点击的提交按钮`);
                        updateStatusElement("找不到提交按钮，请手动提交表单");
                    }
                }
            }, 1000);
        }
    }

    /**
     * 主流程分發
     */
    function main() {
        if (isRunning) return; // 防止多重運行
        isRunning = true;

        const path = window.location.pathname;

        if (path.startsWith('/xapanel/login/xvps')) {
            handleLogin();
        } else if (path.includes('/xapanel/xvps/index')) {
            handleVPSDashboard();
        } else if (path.includes('/xapanel/xvps/server/freevps/extend/index')) {
            handleRenewalPage();
        } else if (
            path.includes('/xapanel/xvps/server/freevps/extend/conf') ||
            path.includes('/xapanel/xvps/server/freevps/extend/do')
        ) {
            handleCaptchaPage();
        } else {
            console.log(`${LOG_PREFIX} 当前不在已支持的路径中，脚本不会执行任何操作。`);
            isRunning = false;
        }
    }

    // 入口調用
    main();

})();

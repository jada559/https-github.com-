/*
联通余量查询 Shadowrocket 脚本 v5 (增强版)

适用于 iOS Shadowrocket
支持多账号管理、自动推送通知、定时任务、自动登录

新增功能：
- Cookie 自动保存和恢复
- 登录状态保持
- 自动重试机制
- 验证码登录支持（预留接口）
- 登录 Token 有效期管理

使用方法：
1. 在 Shadowrocket 中开启"脚本"功能
2. 添加本脚本到脚本列表
3. 配置 MITM 域名：*.10010.com, m.10010.com
4. 设置定时任务或手动执行

作者：Auto
版本：v5.0.0
*/

// ===================================
// ⚠️  重要：首次使用请修改以下配置
// ===================================

// ═══════════════════════════════════════════════════════════════
// 🔐 账号配置（必填）- 格式：手机号#服务密码
// 多个账号换行分隔，请将示例账号替换为您的真实账号
// ═══════════════════════════════════════════════════════════════
const ACCOUNTS = `
13800138000#yourpassword1
13900139000#yourpassword2
`;
// ↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑
// ⚠️  警告：不要将包含真实密码的脚本分享给他人！
// ═══════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════
// 🌐 API 地址配置（必填）- 需要通过抓包获取真实地址
// 当前为示例地址，请替换为真实的联通 API 地址
// ═══════════════════════════════════════════════════════════════
const BASE_URL = 'https://m.10010.com';
// ↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑
// ⚠️  注意：如果查询失败，请使用抓包工具获取真实 API 地址
// ═══════════════════════════════════════════════════════════════

// ===================================
// 📋 可选配置（根据需要修改）
// ===================================

// 通知标题
const NOTIFY_TITLE = '联通余量查询';

// 是否推送详细结果
const NOTIFY_DETAIL = true;

// 登录重试次数（默认 3 次）
const LOGIN_RETRY_COUNT = 3;

// 登录 Token 有效期（分钟），0 表示不检查有效期（推荐）
const TOKEN_EXPIRE_MINUTES = 0;

// 是否保存 Cookie（用于保持登录状态，推荐开启）
const SAVE_COOKIE = true;

// Cookie 保存前缀（用于存储键名，一般不需要修改）
const COOKIE_KEY_PREFIX = 'unicom_cookie_';

// ===================================
// 主要逻辑
// ===================================

/**
 * 初始化
 */
async function init() {
    // 检查配置
    const configCheck = checkConfiguration();
    if (!configCheck.valid) {
        $notify(NOTIFY_TITLE, '❌ 配置错误', configCheck.message);
        console.log(`❌ ${configCheck.message}`);
        console.log('📖 请查看脚本顶部的配置说明');
        $done();
        return;
    }
    
    $notify(NOTIFY_TITLE, '🚀 开始查询', '联通余量查询脚本启动');
    
    // 解析账号列表
    const accounts = parseAccounts(ACCOUNTS);
    
    if (accounts.length === 0) {
        $notify(NOTIFY_TITLE, '❌ 错误', '未配置账号信息');
        $done();
        return;
    }
    
    console.log(`📱 已配置 ${accounts.length} 个账号`);
    
    // 逐个查询
    const results = [];
    for (let i = 0; i < accounts.length; i++) {
        const account = accounts[i];
        console.log(`\n${'='.repeat(40)}`);
        console.log(`正在查询第 ${i + 1}/${accounts.length} 个账号: ${account.phone}`);
        console.log(`${'='.repeat(40)}`);
        
        try {
            const result = await queryAccount(account);
            results.push(result);
        } catch (error) {
            console.log(`❌ 查询失败: ${error.message}`);
            results.push({
                phone: account.phone,
                success: false,
                error: error.message
            });
        }
        
        // 避免请求过快
        if (i < accounts.length - 1) {
            await sleep(2000);
        }
    }
    
    // 生成通知
    const notification = generateNotification(results);
    
    // 发送通知
    if (NOTIFY_DETAIL) {
        $notify(NOTIFY_TITLE, notification.subtitle, notification.message);
    } else {
        $notify(NOTIFY_TITLE, notification.subtitle);
    }
    
    console.log('\n✅ 查询完成');
    $done();
}

/**
 * 检查配置
 */
function checkConfiguration() {
    // 检查账号配置
    const accounts = parseAccounts(ACCOUNTS);
    if (accounts.length === 0) {
        return {
            valid: false,
            message: '未配置账号信息，请修改脚本顶部的 ACCOUNTS 配置'
        };
    }
    
    // 检查是否使用示例账号
    for (const account of accounts) {
        if (account.phone === '13800138000' || account.phone === '13900139000') {
            return {
                valid: false,
                message: '检测到示例账号，请修改脚本顶部的 ACCOUNTS 配置为真实账号'
            };
        }
    }
    
    // 检查密码是否为示例密码
    for (const account of accounts) {
        if (account.password === 'yourpassword1' || account.password === 'yourpassword2') {
            return {
                valid: false,
                message: '检测到示例密码，请修改脚本顶部的 ACCOUNTS 配置为真实密码'
            };
        }
    }
    
    // 检查 API 地址是否为示例地址
    if (BASE_URL === 'https://m.10010.com') {
        console.log('⚠️  警告：API 地址为示例地址，可能无法正常查询');
        console.log('📖 如查询失败，请使用抓包工具获取真实 API 地址');
    }
    
    return { valid: true };
}

/**
 * 解析账号配置
 */
function parseAccounts(accountsStr) {
    const accounts = [];
    const lines = accountsStr.trim().split('\n');
    
    for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#')) {
            const parts = trimmed.split('#');
            if (parts.length >= 2) {
                accounts.push({
                    phone: parts[0].trim(),
                    password: parts[1].trim()
                });
            }
        }
    }
    
    return accounts;
}

/**
 * 查询单个账号
 */
async function queryAccount(account) {
    console.log('🔄 正在登录...');
    
    // 尝试从缓存获取 Cookie
    let cachedCookie = null;
    if (SAVE_COOKIE) {
        cachedCookie = loadCookie(account.phone);
        if (cachedCookie) {
            console.log('📦 找到缓存的 Cookie');
        }
    }
    
    // 登录获取 token（带重试机制）
    const loginResult = await loginWithRetry(account, cachedCookie);
    
    if (!loginResult.success) {
        throw new Error(loginResult.error || '登录失败');
    }
    
    console.log('✅ 登录成功');
    console.log(`📋 Token: ${loginResult.token.substring(0, 20)}...`);
    
    // 保存 Cookie
    if (SAVE_COOKIE && loginResult.cookies) {
        saveCookie(account.phone, loginResult.cookies);
        console.log('💾 Cookie 已保存');
    }
    
    // 查询各类信息
    const [balance, data, voice, sms] = await Promise.all([
        queryBalance(account.phone, loginResult.token, loginResult.cookies),
        queryDataUsage(account.phone, loginResult.token, loginResult.cookies),
        queryVoiceUsage(account.phone, loginResult.token, loginResult.cookies),
        querySMSUsage(account.phone, loginResult.token, loginResult.cookies)
    ]);
    
    const result = {
        phone: account.phone,
        success: true,
        balance: balance,
        data: data,
        voice: voice,
        sms: sms,
        updateTime: new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })
    };
    
    // 打印结果
    printResult(result);
    
    return result;
}

/**
 * 带重试机制的登录
 */
async function loginWithRetry(account, cachedCookie) {
    let lastError = null;
    
    for (let attempt = 1; attempt <= LOGIN_RETRY_COUNT; attempt++) {
        console.log(`🔄 登录尝试 ${attempt}/${LOGIN_RETRY_COUNT}`);
        
        const loginResult = await login(account, cachedCookie);
        
        if (loginResult.success) {
            return loginResult;
        }
        
        lastError = loginResult.error;
        console.log(`⚠️ 登录失败: ${lastError}`);
        
        // 清除缓存的 Cookie（如果是第二次及以后失败）
        if (attempt > 1 && cachedCookie) {
            console.log('🗑️ 清除失效的 Cookie');
            deleteCookie(account.phone);
            cachedCookie = null;
        }
        
        // 如果不是最后一次尝试，等待后重试
        if (attempt < LOGIN_RETRY_COUNT) {
            const waitTime = attempt * 2000; // 递增等待时间
            console.log(`⏳ 等待 ${waitTime/1000} 秒后重试...`);
            await sleep(waitTime);
        }
    }
    
    return {
        success: false,
        error: lastError || `登录失败，已重试 ${LOGIN_RETRY_COUNT} 次`
    };
}

/**
 * 登录
 */
async function login(account, cachedCookie) {
    const url = `${BASE_URL}/app/login`;
    
    const headers = {
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 MicroMessenger/8.0.0',
        'Content-Type': 'application/json',
        'Referer': 'https://m.10010.com/'
    };
    
    // 如果有缓存的 Cookie，添加到请求头
    if (cachedCookie) {
        headers['Cookie'] = cachedCookie;
    }
    
    const options = {
        url: url,
        method: 'POST',
        headers: headers,
        body: JSON.stringify({
            phone: account.phone,
            password: account.password,
            remember: true
        })
    };
    
    try {
        const response = await httpPost(options);
        const data = typeof response === 'string' ? JSON.parse(response) : response;
        
        if (data.code === '0' || data.code === '0000') {
            return {
                success: true,
                token: data.token || data.data?.token,
                cookies: extractCookies(response) || cachedCookie,
                message: '登录成功'
            };
        } else {
            return {
                success: false,
                error: data.message || data.msg || '登录失败'
            };
        }
    } catch (error) {
        return {
            success: false,
            error: error.message || '网络请求失败'
        };
    }
}

/**
 * 提取 Cookie
 */
function extractCookies(response) {
    // Shadowrocket 的 $httpClient.post 回调中的 response 对象可能包含 cookies
    // 这里返回 null，实际需要根据 Shadowrocket 的 API 调整
    return null;
}

/**
 * 查询余额
 */
async function queryBalance(phone, token, cookies) {
    const url = `${BASE_URL}/app/billQuery`;
    
    const options = {
        url: url,
        method: 'POST',
        headers: getHeaders(token, cookies),
        body: JSON.stringify({ phone: phone })
    };
    
    const response = await httpPost(options);
    const data = typeof response === 'string' ? JSON.parse(response) : response;
    
    if (data.code === '0' || data.code === '0000') {
        return {
            success: true,
            balance: data.balance || data.data?.balance || 0
        };
    }
    
    return { success: false, error: data.message || '查询失败' };
}

/**
 * 查询流量
 */
async function queryDataUsage(phone, token, cookies) {
    const url = `${BASE_URL}/app/dataQuery`;
    
    const options = {
        url: url,
        method: 'POST',
        headers: getHeaders(token, cookies),
        body: JSON.stringify({ phone: phone })
    };
    
    const response = await httpPost(options);
    const data = typeof response === 'string' ? JSON.parse(response) : response;
    
    if (data.code === '0' || data.code === '0000') {
        return {
            success: true,
            totalData: data.totalData || data.data?.totalData || 0,
            usedData: data.usedData || data.data?.usedData || 0,
            remainingData: data.remainingData || data.data?.remainingData || 0,
            cycleStart: data.cycleStart || data.data?.cycleStart || '',
            cycleEnd: data.cycleEnd || data.data?.cycleEnd || ''
        };
    }
    
    return { success: false, error: data.message || '查询失败' };
}

/**
 * 查询语音
 */
async function queryVoiceUsage(phone, token, cookies) {
    const url = `${BASE_URL}/app/voiceQuery`;
    
    const options = {
        url: url,
        method: 'POST',
        headers: getHeaders(token, cookies),
        body: JSON.stringify({ phone: phone })
    };
    
    const response = await httpPost(options);
    const data = typeof response === 'string' ? JSON.parse(response) : response;
    
    if (data.code === '0' || data.code === '0000') {
        return {
            success: true,
            totalMinutes: data.totalMinutes || data.data?.totalMinutes || 0,
            usedMinutes: data.usedMinutes || data.data?.usedMinutes || 0,
            remainingMinutes: data.remainingMinutes || data.data?.remainingMinutes || 0
        };
    }
    
    return { success: false, error: data.message || '查询失败' };
}

/**
 * 查询短信
 */
async function querySMSUsage(phone, token, cookies) {
    const url = `${BASE_URL}/app/smsQuery`;
    
    const options = {
        url: url,
        method: 'POST',
        headers: getHeaders(token, cookies),
        body: JSON.stringify({ phone: phone })
    };
    
    const response = await httpPost(options);
    const data = typeof response === 'string' ? JSON.parse(response) : response;
    
    if (data.code === '0' || data.code === '0000') {
        return {
            success: true,
            totalSMS: data.totalSMS || data.data?.totalSMS || 0,
            usedSMS: data.usedSMS || data.data?.usedSMS || 0,
            remainingSMS: data.remainingSMS || data.data?.remainingSMS || 0
        };
    }
    
    return { success: false, error: data.message || '查询失败' };
}

/**
 * 获取请求头
 */
function getHeaders(token, cookies) {
    const headers = {
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 MicroMessenger/8.0.0',
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'Referer': 'https://m.10010.com/'
    };
    
    // 添加 Cookie
    if (cookies) {
        headers['Cookie'] = cookies;
    }
    
    return headers;
}

/**
 * 保存 Cookie
 */
function saveCookie(phone, cookies) {
    const key = COOKIE_KEY_PREFIX + phone;
    const data = {
        cookies: cookies,
        timestamp: Date.now()
    };
    
    try {
        // 使用 Shadowrocket 的持久化存储
        $persistentStore.write(JSON.stringify(data), key);
    } catch (error) {
        console.log(`⚠️ 保存 Cookie 失败: ${error.message}`);
    }
}

/**
 * 加载 Cookie
 */
function loadCookie(phone) {
    const key = COOKIE_KEY_PREFIX + phone;
    
    try {
        const data = $persistentStore.read(key);
        if (data) {
            const parsed = JSON.parse(data);
            
            // 检查是否过期
            if (TOKEN_EXPIRE_MINUTES > 0) {
                const elapsedMinutes = (Date.now() - parsed.timestamp) / 1000 / 60;
                if (elapsedMinutes > TOKEN_EXPIRE_MINUTES) {
                    console.log(`⏰ Cookie 已过期 (${elapsedMinutes.toFixed(0)} 分钟)`);
                    deleteCookie(phone);
                    return null;
                }
            }
            
            return parsed.cookies;
        }
    } catch (error) {
        console.log(`⚠️ 加载 Cookie 失败: ${error.message}`);
    }
    
    return null;
}

/**
 * 删除 Cookie
 */
function deleteCookie(phone) {
    const key = COOKIE_KEY_PREFIX + phone;
    
    try {
        $persistentStore.write('', key);
        console.log('🗑️ Cookie 已删除');
    } catch (error) {
        console.log(`⚠️ 删除 Cookie 失败: ${error.message}`);
    }
}

/**
 * HTTP POST 请求封装
 */
function httpPost(options) {
    return new Promise((resolve, reject) => {
        $httpClient.post(options, (error, response, body) => {
            if (error) {
                reject(error);
            } else {
                resolve(body);
            }
        });
    });
}

/**
 * 延迟函数
 */
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 打印查询结果
 */
function printResult(result) {
    if (result.balance.success) {
        console.log(`💰 余额: ¥${result.balance.balance}`);
    }
    
    if (result.data.success) {
        console.log(`📊 流量:`);
        console.log(`   总量: ${formatData(result.data.totalData)}`);
        console.log(`   已用: ${formatData(result.data.usedData)}`);
        console.log(`   剩余: ${formatData(result.data.remainingData)}`);
        console.log(`   账期: ${result.data.cycleStart} ~ ${result.data.cycleEnd}`);
    }
    
    if (result.voice.success) {
        console.log(`📞 语音:`);
        console.log(`   总量: ${result.voice.totalMinutes} 分钟`);
        console.log(`   已用: ${result.voice.usedMinutes} 分钟`);
        console.log(`   剩余: ${result.voice.remainingMinutes} 分钟`);
    }
    
    if (result.sms.success) {
        console.log(`💬 短信:`);
        console.log(`   总量: ${result.sms.totalSMS} 条`);
        console.log(`   已用: ${result.sms.usedSMS} 条`);
        console.log(`   剩余: ${result.sms.remainingSMS} 条`);
    }
}

/**
 * 格式化流量数据
 */
function formatData(bytes) {
    if (!bytes || bytes === 0) return '0 B';
    
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    const k = 1024;
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return `${(bytes / Math.pow(k, i)).toFixed(2)} ${units[i]}`;
}

/**
 * 生成通知内容
 */
function generateNotification(results) {
    let subtitle = '';
    let message = '';
    
    const successCount = results.filter(r => r.success).length;
    const failCount = results.length - successCount;
    
    subtitle = `✅ 成功 ${successCount} / ${results.length}`;
    
    for (const result of results) {
        message += `\n📱 ${result.phone}\n`;
        
        if (!result.success) {
            message += `❌ ${result.error || '查询失败'}\n`;
            continue;
        }
        
        if (result.balance.success) {
            message += `💰 余额: ¥${result.balance.balance}\n`;
        }
        
        if (result.data.success) {
            const usedPercent = result.data.totalData > 0 
                ? ((result.data.usedData / result.data.totalData) * 100).toFixed(1) 
                : 0;
            message += `📊 剩余流量: ${formatData(result.data.remainingData)} (已用 ${usedPercent}%)\n`;
        }
        
        if (result.voice.success && result.voice.remainingMinutes > 0) {
            message += `📞 剩余通话: ${result.voice.remainingMinutes} 分钟\n`;
        }
        
        if (result.sms.success && result.sms.remainingSMS > 0) {
            message += `💬 剩余短信: ${result.sms.remainingSMS} 条\n`;
        }
        
        message += `🕐 ${result.updateTime}\n`;
        message += `${'─'.repeat(30)}\n`;
    }
    
    return { subtitle, message };
}

/**
 * 执行脚本
 */
init().catch(error => {
    console.log(`❌ 脚本执行出错: ${error.message}`);
    $notify(NOTIFY_TITLE, '❌ 错误', error.message);
    $done();
});

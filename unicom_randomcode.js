/**
 * 中国联通流量查询 - BoxJS 整合版
 * 
 * 功能：
 * - 随机密码（短信验证码）登录
 * - 自动查询流量余量
 * - 定时推送通知
 * 
 * BoxJS 订阅地址：
 * https://raw.githubusercontent.com/你的repo/main/unicom/unicom_randomcode.js
 */

const $ = new Env('联通流量查询');

// ═══════════════════════════════════════════════════════════════════
//   配置区域（可在 BoxJS 面板中修改）
// ═══════════════════════════════════════════════════════════════════

const CONFIG = {
  phone: $persistentStore.read('unicom_phone') || '',
  token: $persistentStore.read('unicom_token') || '',
  tokenTime: $persistentStore.read('unicom_token_time') || 0,
};

// 联通登录 API
const API = {
  sendCode: 'https://m.client.10010.com/mobileService/login/sendMsgCode',
  loginByCode: 'https://m.client.10010.com/mobileService/login/loginByRandom',
  queryFlow: 'https://m.client.10010.com/mobileService/queryflow/queryflow',
};

// ═══════════════════════════════════════════════════════════════════
//   主入口
// ═══════════════════════════════════════════════════════════════════

!(async () => {
  try {
    // 检查参数
    const args = getArgs();
    
    // BoxJS 面板模式
    if (args.box) {
      await showBoxPanel();
      return;
    }
    
    // 发送验证码
    if (args.sendcode) {
      await sendVerifyCode();
      return;
    }
    
    // 验证登录
    if (args.login) {
      await loginByCode(args.code);
      return;
    }
    
    // 默认：查询流量
    await queryTraffic();
    
  } catch (e) {
    $.msg('❌ 脚本异常', '', String(e));
    $.log('异常：' + e.message);
  } finally {
    $.done();
  }
})();

// ═══════════════════════════════════════════════════════════════════
//   BoxJS 面板
// ═══════════════════════════════════════════════════════════════════

async function showBoxPanel() {
  const phone = CONFIG.phone;
  const hasToken = !!CONFIG.token;
  const tokenAge = hasToken ? Math.round((Date.now() - CONFIG.tokenTime) / 60000) : 0;
  
  const title = '📶 联通流量查询';
  const subTitle = hasToken ? `已登录 (token ${tokenAge}分钟前)` : '未登录';
  
  // 渲染选项
  const opts = [
    {
      title: '📱 发送验证码',
      description: phone ? `发送到 ${phone.slice(0,3)}****${phone.slice(-4)}` : '请先设置手机号',
      props: { 'action': 'sendcode' },
    },
    {
      title: '🔐 验证登录',
      description: hasToken ? 'token 有效，可直接查询' : '使用验证码登录',
      props: { 'action': 'login', 'code': '' },
    },
    {
      title: '📊 查询流量',
      description: hasToken ? '使用缓存 token 查询' : '需要先登录',
      props: { 'action': 'query' },
    },
    {
      title: '⚙️ 设置手机号',
      description: phone || '未设置',
      props: { 'action': 'setphone' },
    },
    {
      title: '📋 使用说明',
      description: '查看详细配置步骤',
      props: { 'action': 'help' },
    },
  ];
  
  // 显示通知
  $.msg(title, subTitle, '选择一个操作');
  
  // 在 Loon/Shadowrocket 环境渲染选项
  if (typeof $panel !== 'undefined') {
    $panel.post({
      title,
      subTitle,
      content: opts.map(o => `▸ ${o.title}\n  ${o.description}`).join('\n\n'),
      buttons: opts.map(o => ({ title: o.title, action: `boxjs://action/${o.props.action}` })),
    });
  }
}

// ═══════════════════════════════════════════════════════════════════
//   发送验证码
// ═══════════════════════════════════════════════════════════════════

async function sendVerifyCode() {
  const phone = CONFIG.phone;
  
  if (!phone) {
    $.msg('⚠️ 未设置手机号', '', '请先在 BoxJS 中设置 unicom_phone');
    return;
  }
  
  $.log(`发送验证码到 ${phone.slice(0,3)}****${phone.slice(-4)}...`);
  
  const body = JSON.stringify({
    loginType: '3',
    loginName: phone,
    appType: '10010',
    version: '9.0',
  });
  
  const opts = {
    url: API.sendCode,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json;charset=UTF-8',
      'User-Agent': 'ChinaUnicom/9.0 (iPhone; iOS 17.0; Scale/3.00)',
      'Accept': 'application/json',
      'Accept-Language': 'zh-Hans-CN;q=1',
      'loginName': phone,
    },
    body,
  };
  
  const resp = await httpRequest(opts);
  
  if (resp.code === '0' || resp.resultCode === '0000') {
    $.msg('📱 验证码已发送', `${phone.slice(0,3)}****${phone.slice(-4)}`, '请查收短信，然后在脚本中填入验证码');
  } else {
    const msg = resp.message || resp.msg || resp.resultMsg || '未知错误';
    $.msg('❌ 发送失败', `错误码：${resp.code || resp.resultCode}`, msg);
  }
}

// ═══════════════════════════════════════════════════════════════════
//   验证码登录
// ═══════════════════════════════════════════════════════════════════

async function loginByCode(code) {
  const phone = CONFIG.phone;
  
  if (!phone) {
    $.msg('⚠️ 未设置手机号', '', '请先在 BoxJS 中设置 unicom_phone');
    return;
  }
  
  if (!code) {
    $.msg('⚠️ 未填验证码', '', '请先运行发送验证码，然后将收到的验证码填入参数');
    return;
  }
  
  $.log(`使用验证码 ${code} 登录...`);
  
  const body = JSON.stringify({
    loginType: '3',
    loginName: phone,
    loginPasswd: code,
    appType: '10010',
    version: '9.0',
  });
  
  const opts = {
    url: API.loginByCode,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json;charset=UTF-8',
      'User-Agent': 'ChinaUnicom/9.0 (iPhone; iOS 17.0; Scale/3.00)',
      'Accept': 'application/json',
      'Accept-Language': 'zh-Hans-CN;q=1',
      'loginName': phone,
    },
    body,
  };
  
  const resp = await httpRequest(opts);
  
  if (resp.code === '0' || resp.resultCode === '0000') {
    const token = resp.data?.token || resp.token || resp.result?.token;
    
    if (token) {
      $persistentStore.write(token, 'unicom_token');
      $persistentStore.write(Date.now().toString(), 'unicom_token_time');
      
      $.msg('✅ 登录成功', `${phone.slice(0,3)}****${phone.slice(-4)}`, 'token 已缓存，可用于后续查询');
    } else {
      $.msg('❌ 登录失败', '', '响应中无 token');
    }
  } else {
    const msg = resp.message || resp.msg || resp.resultMsg || '未知错误';
    $.msg('❌ 登录失败', `${msg}（错误码：${resp.code || resp.resultCode}）`, '');
  }
}

// ═══════════════════════════════════════════════════════════════════
//   查询流量
// ═══════════════════════════════════════════════════════════════════

async function queryTraffic() {
  const phone = CONFIG.phone;
  let token = CONFIG.token;
  
  // 检查 token 有效性（7天过期）
  const TOKEN_EXPIRE = 7 * 24 * 60 * 60 * 1000;
  if (!token || (Date.now() - CONFIG.tokenTime > TOKEN_EXPIRE)) {
    $.msg('⚠️ Token 无效或已过期', '', '请重新运行发送验证码并登录');
    return;
  }
  
  $.log('使用缓存 token 查询流量...');
  
  const opts = {
    url: `${API.queryFlow}?loginName=${phone}`,
    method: 'GET',
    headers: {
      'Content-Type': 'application/json;charset=UTF-8',
      'User-Agent': 'ChinaUnicom/9.0 (iPhone; iOS 17.0; Scale/3.00)',
      'Accept': 'application/json',
      'Accept-Language': 'zh-Hans-CN;q=1',
      'Authorization': token,
      'token': token,
    },
  };
  
  const resp = await httpRequest(opts);
  
  if (resp.code === '0' || resp.resultCode === '0000') {
    const data = resp.data || resp.result || {};
    formatAndNotify(phone, data);
  } else {
    const msg = resp.message || resp.msg || resp.resultMsg || '未知错误';
    $.msg('❌ 查询失败', `${msg}（token 可能已过期）`, '');
  }
}

// ═══════════════════════════════════════════════════════════════════
//   格式化通知
// ═══════════════════════════════════════════════════════════════════

function formatAndNotify(phone, data) {
  const list = data.flowPackageList || data.packageList || data.flowList || [];
  const lines = [];
  let totalRemainMB = 0;
  
  if (list.length > 0) {
    list.forEach(pkg => {
      const name = pkg.packageName || pkg.name || '流量包';
      const total = pkg.totalFlow || pkg.total || '?';
      const remain = pkg.remainFlow || pkg.remain || pkg.balance || '?';
      const unit = pkg.unit || 'MB';
      const expire = pkg.expireTime || pkg.endTime || '';
      
      const n = parseFloat(remain);
      if (!isNaN(n)) {
        totalRemainMB += unit.toUpperCase() === 'GB' ? n * 1024 : n;
      }
      
      const expireStr = expire ? `  到期 ${expire}` : '';
      lines.push(`📦 ${name}\n   剩余 ${remain}${unit} / ${total}${unit}${expireStr}`);
    });
  } else {
    const remain = data.remainFlow || data.remainByte || data.balance || '未知';
    const total = data.totalFlow || data.totalByte || '未知';
    lines.push(`剩余：${remain}  /  总量：${total}`);
  }
  
  const totalStr = totalRemainMB > 0
    ? totalRemainMB >= 1024
      ? `合计剩余约 ${(totalRemainMB / 1024).toFixed(2)} GB`
      : `合计剩余约 ${totalRemainMB.toFixed(0)} MB`
    : '查询成功';
  
  const title = `📶 联通流量 ${phone.slice(0,3)}****${phone.slice(-4)}`;
  $.msg(title, totalStr, lines.join('\n') || '暂无流量包数据');
}

// ═══════════════════════════════════════════════════════════════════
//   工具函数
// ═══════════════════════════════════════════════════════════════════

function httpRequest(opts) {
  return new Promise((resolve) => {
    const method = opts.method || 'GET';
    
    if (method === 'GET') {
      $httpClient.get(opts, (err, resp, body) => {
        if (err) {
          $.log('请求错误：' + err);
          resolve({ code: '-1', message: String(err) });
          return;
        }
        try {
          resolve(typeof body === 'string' ? JSON.parse(body) : body);
        } catch (e) {
          resolve({ code: '-1', message: '响应解析失败' });
        }
      });
    } else {
      $httpClient.post(opts, (err, resp, body) => {
        if (err) {
          $.log('请求错误：' + err);
          resolve({ code: '-1', message: String(err) });
          return;
        }
        try {
          resolve(typeof body === 'string' ? JSON.parse(body) : body);
        } catch (e) {
          resolve({ code: '-1', message: '响应解析失败' });
        }
      });
    }
  });
}

function getArgs() {
  const args = {};
  try {
    const arg = $argument || '';
    arg.split('&').forEach(item => {
      const [key, val] = item.split('=');
      if (key) args[key] = decodeURIComponent(val || '');
    });
  } catch (e) {}
  return args;
}

// ═══════════════════════════════════════════════════════════════════
//   Env 兼容层
// ═══════════════════════════════════════════════════════════════════

function Env(name) {
  this.name = name;
  
  this.log = (...args) => console.log(`[${name}] ${args.join(' ')}`);
  
  this.msg = (title, subtitle, body) => {
    try { $notification.post(title, subtitle, body); } catch (e) {}
    this.log(`通知 → ${title} | ${subtitle} | ${body}`);
  };
  
  this.getdata = (key) => {
    try { return $persistentStore.read(key) || ''; } catch (e) { return ''; }
  };
  
  this.setdata = (val, key) => {
    try { $persistentStore.write(val, key); } catch (e) {}
  };
  
  this.done = (val = {}) => $done(val);
}

// ── BoxJS 数据兼容 ──
$.box = $.getdata('unicom_box') || '{}';
try { $.box = JSON.parse($.box); } catch (e) { $.box = {}; }
$.setdata = (val, key) => $persistentStore.write(val, key);
$.getdata = (key) => $persistentStore.read(key);

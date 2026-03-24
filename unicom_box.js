/**
 * 中国联通流量查询 - BoxJS 面板版
 *
 * 支持 MITM 拦截流量查询接口，自动推送通知
 *
 * 使用步骤：
 * 1. 在 BoxJS 中添加此脚本
 * 2. 配置 MITM（见下方说明）
 * 3. 在联通 APP 查询流量，自动推送通知
 */

// ─────────────────────────────────────────────────────────────
//   BoxJS 订阅地址（将此脚本复制到 BoxJS 订阅源）
// ─────────────────────────────────────────────────────────────

const $ = new Env('联通流量查询');

!(async () => {
  try {
    // BoxJS 数据初始化
    $.box = $.getdata('unicom_box') || '{}';
    $.box = typeof $.box === 'string' ? JSON.parse($.box) : $.box;
    $.setdata(JSON.stringify($.box), 'unicom_box');

    // 显示 BoxJS 面板
    await showBox();

  } catch (e) {
    $.msg($.name, '❌ 脚本异常', e.message || e);
  } finally {
    $.done();
  }
})();

// ── BoxJS 面板 ─────────────────────────────────────────────────────
async function showBox() {
  const title = `📶 中国联通流量查询`;
  const subTitle = `MITM 拦截方式`;
  const desc = '在联通 APP 查询流量时自动拦截并推送通知';

  const options = [
    {
      title: '📋 使用说明',
      description: '配置步骤和注意事项',
      action: () => showHelp(),
    },
    {
      title: '🔧 MITM 配置',
      description: '一键复制 MITM 配置到剪贴板',
      action: () => copyMITM(),
    },
    {
      title: '🧪 测试拦截',
      description: '配置好后打开联通 APP 查询流量',
      action: () => testIntercept(),
    },
  ];

  $.msg(title, subTitle, desc);

  // 如果在 BoxJS 环境，渲染选项
  if (typeof $app !== 'undefined') {
    const result = await $.options(options);
    if (result) {
      result.action();
    }
  }
}

// ── 显示帮助 ──────────────────────────────────────────────────────
function showHelp() {
  const help = `
【使用步骤】

1️⃣ 配置 MITM
   - 在 Shadowrocket 中开启 HTTPS MITM
   - 添加 MITM 主机名：m.client.10010.com
   - 添加脚本：
     type = http-response
     pattern = ^https://m.client.10010.com/mobileService/queryflow/queryflow
     script-path = unicom_box.js

2️⃣ 安装证书
   - 生成 MITM 证书并安装到系统
   - 在 设置 → 通用 → 关于本机 → 证书信任设置 中信任

3️⃣ 查询流量
   - 打开联通 APP → 我的 → 流量查询
   - 脚本会自动拦截并推送通知

【注意】
- 需要联通 APP 已登录
- token 有效期约 7 天，过期需重新打开 APP
`;

  $.msg('📋 使用说明', '', help);
  $.log(help);
}

// ── 复制 MITM 配置 ────────────────────────────────────────────────
function copyMITM() {
  const config = `
[Script]
unicom-flow = type=http-response,pattern=^https://m.client.10010.com/mobileService/queryflow/queryflow,script-path=unicom_box.js

[MITM]
hostname = m.client.10010.com
`.trim();

  // 复制到剪贴板（Shadowrocket 环境可能不支持，显示给用户手动复制）
  $.msg('🔧 MITM 配置', '', '请手动复制以下内容到 Shadowrocket 配置：\n\n' + config);
  $.log('MITM 配置：' + config);
}

// ── 测试拦截 ──────────────────────────────────────────────────────
function testIntercept() {
  $.msg('🧪 测试拦截', '', '请在联通 APP 中点击"流量查询"，脚本会自动拦截');
}

// ─────────────────────────────────────────────────────────────
//   MITM 拦截入口（BoxJS 脚本可同时支持面板 + MITM）
// ─────────────────────────────────────────────────────────────

if (typeof $response !== 'undefined') {
  // MITM 模式：拦截响应
  (async () => {
    try {
      const body = typeof $response.body === 'string' ? $response.body : '';

      $.log('拦截到流量查询响应，长度：' + body.length);

      const data = JSON.parse(body);

      if (data.code !== '0' && data.resultCode !== '0000') {
        $.log('响应 code 不为 0：' + data.code + ',' + data.resultCode);
        $done({});
        return;
      }

      const flowData = data.data || data.result || {};
      $.log('流量数据：' + JSON.stringify(flowData));

      const list = flowData.flowPackageList || flowData.packageList || flowData.flowList || [];
      const lines = [];
      let totalRemainMB = 0;

      if (list.length > 0) {
        list.forEach(pkg => {
          const name   = pkg.packageName || pkg.name    || '流量包';
          const total  = pkg.totalFlow   || pkg.total   || '?';
          const remain = pkg.remainFlow  || pkg.remain  || pkg.balance || '?';
          const unit   = pkg.unit        || 'MB';
          const expire = pkg.expireTime  || pkg.endTime || '';

          const n = parseFloat(remain);
          if (!isNaN(n)) {
            totalRemainMB += unit.toUpperCase() === 'GB' ? n * 1024 : n;
          }

          const expireStr = expire ? `  到期 ${expire}` : '';
          lines.push(`📦 ${name}\n   剩余 ${remain}${unit} / ${total}${unit}${expireStr}`);
        });
      } else {
        const remain = flowData.remainFlow || flowData.remainByte || flowData.balance || '未知';
        const total  = flowData.totalFlow  || flowData.totalByte  || '未知';
        lines.push(`剩余：${remain}  /  总量：${total}`);
      }

      const totalStr = totalRemainMB > 0
        ? totalRemainMB >= 1024
          ? `合计剩余约 ${(totalRemainMB / 1024).toFixed(2)} GB`
          : `合计剩余约 ${totalRemainMB.toFixed(0)} MB`
        : '查询成功';

      const title = `📶 联通流量余量`;
      $.msg(title, totalStr, lines.join('\n') || '暂无流量包数据');

      $done({});

    } catch (e) {
      $.msg('❌ 解析失败', '', String(e));
      $.log('异常：', e);
      $done({});
    }
  })();
}

// ─────────────────────────────────────────────────────────────
//   Env 工具类
// ─────────────────────────────────────────────────────────────

function Env(name) {
  this.name = name;

  this.log = (...args) => console.log(`[${name}] ${args.join(' ')}`);

  this.msg = (title, subtitle, body) => {
    try { $notification.post(title, subtitle, body); } catch(e) {}
    this.log(`通知 → ${title} | ${subtitle} | ${body}`);
  };

  this.getdata = (key) => {
    try { return $persistentStore.read(key) || ''; } catch(e) { return ''; }
  };

  this.setdata = (val, key) => {
    try { $persistentStore.write(val, key); } catch(e) {}
  };

  this.done = (val = {}) => $done(val);
}

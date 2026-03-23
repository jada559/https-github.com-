// 联通余量查询 BoxJS 脚本
// 作者: WorkBuddy
// 版本: 1.0.0
// 更新时间: 2026-03-24

const $ = new API("unicom-query", true);

// ==================== 配置区域 ====================
const CONFIG = {
    // 联通手机营业厅 App 相关配置
    UNICOM_APPID: $.read("unicom_appid") || "",
    UNICOM_TOKEN: $.read("unicom_token") || "",
    UNICOM_MOBILE: $.read("unicom_mobile") || "",
    
    // 推送配置
    SHOW_DETAIL: $.read("show_detail") === "true" || true,
    SHOW_REMAIN_PERCENT: $.read("show_remain_percent") === "true" || true,
};

// ==================== 联通 API 配置 ====================
const UNICOM_API = {
    BASE_URL: "https://m.client.10010.com",
    // 余量查询接口
    QUERY_URL: "/mobileservicequery/balancenew/accountBalancenew.htm",
    // 用户信息接口
    USER_INFO_URL: "/mobileservicequery/customerService/queryUserInfo",
};

// ==================== 主函数 ====================
(async () => {
    try {
        // 检查必要配置
        if (!CONFIG.UNICOM_MOBILE) {
            $.notify("联通余量查询", "❌ 配置缺失", "请先在 BoxJS 中配置联通手机号");
            $.done();
            return;
        }

        $.log("开始查询联通余量...");
        
        // 获取余量信息
        const balanceInfo = await queryBalance();
        
        // 格式化并输出结果
        const result = formatResult(balanceInfo);
        
        // 通知推送
        $.notify("联通余量查询", result.title, result.content);
        
        // 输出到日志
        $.log(result.content);
        
    } catch (error) {
        $.log("查询失败: " + error.message);
        $.notify("联通余量查询", "❌ 查询失败", error.message);
    } finally {
        $.done();
    }
})();

// ==================== 查询函数 ====================

/**
 * 查询余量信息
 */
async function queryBalance() {
    const url = UNICOM_API.BASE_URL + UNICOM_API.QUERY_URL;
    
    const headers = {
        "Accept": "application/json, text/plain, */*",
        "Accept-Encoding": "gzip, deflate, br",
        "Accept-Language": "zh-CN,zh-Hans;q=0.9",
        "Connection": "keep-alive",
        "Content-Type": "application/x-www-form-urlencoded",
        "Cookie": `c_mobile=${CONFIG.UNICOM_MOBILE}`,
        "User-Agent": "ChinaUnicom4.x/1.0 CFNetwork/1402.0.8 Darwin/22.2.0",
        "Referer": "https://m.client.10010.com/",
    };

    const body = `mobile=${CONFIG.UNICOM_MOBILE}&version=iphone_c@8.0100`;

    try {
        const response = await $.http.post({
            url: url,
            headers: headers,
            body: body,
        });

        const data = JSON.parse(response.body);
        
        if (data.code !== "200" && data.code !== "0" && data.code !== "Y") {
            throw new Error(data.message || "查询失败");
        }

        return data;
    } catch (error) {
        throw new Error("请求失败: " + error.message);
    }
}

// ==================== 格式化函数 ====================

/**
 * 格式化查询结果
 */
function formatResult(data) {
    let title = `📱 ${CONFIG.UNICOM_MOBILE}`;
    let content = [];

    // 解析流量信息
    if (data.dataList && data.dataList.length > 0) {
        data.dataList.forEach(item => {
            const typeName = item.typeName || item.remainTitle || "未知";
            const total = item.total || item.totalResource || "0";
            const used = item.used || item.usedResource || "0";
            const remain = item.remain || item.remainResource || "0";
            const unit = item.unit || item.unitName || "";
            
            // 计算百分比
            let percent = 0;
            if (parseFloat(total) > 0) {
                percent = ((parseFloat(remain) / parseFloat(total)) * 100).toFixed(1);
            }

            // 根据余量比例设置图标
            let icon = "🟢";
            if (percent < 20) icon = "🔴";
            else if (percent < 50) icon = "🟡";

            let line = `${icon} ${typeName}: ${remain}${unit}`;
            
            if (CONFIG.SHOW_DETAIL) {
                line += ` (总${total}${unit}/用${used}${unit})`;
            }
            
            if (CONFIG.SHOW_REMAIN_PERCENT && percent > 0) {
                line += ` ${percent}%`;
            }
            
            content.push(line);
        });
    }

    // 解析话费信息
    if (data.curFee) {
        content.push(`💰 当前话费: ${data.curFee}元`);
    }

    // 解析积分信息
    if (data.score) {
        content.push(`🎁 可用积分: ${data.score}`);
    }

    if (content.length === 0) {
        content.push("暂无余量信息");
    }

    return {
        title: title,
        content: content.join("\n"),
    };
}

// ==================== BoxJS 配置 ====================
/**
 * BoxJS 配置说明:
 * 
 * 应用名称: 联通余量查询
 * 应用描述: 查询联通套餐余量（流量、通话、短信等）
 * 
 * 配置项:
 * 1. unicom_mobile - 联通手机号 (必填)
 * 2. unicom_appid - 联通AppID (可选)
 * 3. unicom_token - 联通Token (可选)
 * 4. show_detail - 显示详细信息 (默认: true)
 * 5. show_remain_percent - 显示余量百分比 (默认: true)
 * 
 * 获取 Cookie 方法:
 * 1. 打开联通手机营业厅 App
 * 2. 登录后进入"我的"页面
 * 3. 使用脚本获取 Cookie
 * 4. 或在 BoxJS 中手动填写手机号
 */

// ==================== API 封装 ====================
function API(name = "untitled", debug = false) {
    return new (class {
        constructor(name, debug) {
            this.name = name;
            this.debug = debug;
            this.isQX = typeof $task !== "undefined";
            this.isLoon = typeof $loon !== "undefined";
            this.isSurge = typeof $httpClient !== "undefined" && !this.isLoon;
            this.isNode = typeof require == "function";
            this.isJSBox = this.isNode ? false : typeof $jsbox !== "undefined";
            this.isRequest = this.isQX || this.isLoon || this.isSurge;
            this.initCache();
            
            const delay = (t, v) =>
                new Promise(function (resolve) {
                    setTimeout(resolve.bind(null, v), t);
                });
            
            this.node = (() => {
                if (this.isNode) {
                    const request = require("request");
                    return {
                        request,
                    };
                } else {
                    return null;
                }
            })();
            
            this.initCache();
            
            const Promise = require("bluebird");
            this.delay = delay;
        }

        initCache() {
            if (this.isQX) this.cache = JSON.parse($prefs.valueForKey(this.name) || "{}");
            if (this.isLoon || this.isSurge)
                this.cache = JSON.parse($persistentStore.read(this.name) || "{}");
            if (this.isNode) {
                let fpath = "root.json";
                if (!this.node) this.node = {};
                if (this.node.fs) {
                    try {
                        this.cache = JSON.parse(this.node.fs.readFileSync(fpath));
                    } catch (e) {
                        this.cache = {};
                    }
                }
            }
        }

        persistCache() {
            const data = JSON.stringify(this.cache);
            if (this.isQX) $prefs.setValueForKey(data, this.name);
            if (this.isLoon || this.isSurge) $persistentStore.write(data, this.name);
            if (this.isNode) {
                this.node.fs.writeFileSync("root.json", data, { flag: "w" }, (err) =>
                    console.log(err)
                );
            }
        }

        write(data, key) {
            this.log(`SET ${key}`);
            if (key.indexOf("#") !== -1) {
                key = key.substr(1);
                if (this.isSurge || this.isLoon) {
                    return $persistentStore.write(data, key);
                }
                if (this.isQX) {
                    return $prefs.setValueForKey(data, key);
                }
                if (this.isNode) {
                    this.root[key] = data;
                }
            } else {
                this.cache[key] = data;
            }
            this.persistCache();
        }

        read(key) {
            this.log(`READ ${key}`);
            if (key.indexOf("#") !== -1) {
                key = key.substr(1);
                if (this.isSurge || this.isLoon) {
                    return $persistentStore.read(key);
                }
                if (this.isQX) {
                    return $prefs.valueForKey(key);
                }
                if (this.isNode) {
                    return this.root[key];
                }
            } else {
                return this.cache[key];
            }
        }

        delete(key) {
            this.log(`DELETE ${key}`);
            if (key.indexOf("#") !== -1) {
                key = key.substr(1);
                if (this.isSurge || this.isLoon) {
                    return $persistentStore.write(null, key);
                }
                if (this.isQX) {
                    return $prefs.removeValueForKey(key);
                }
                if (this.isNode) {
                    delete this.root[key];
                }
            } else {
                delete this.cache[key];
            }
            this.persistCache();
        }

        notify(title, subtitle, content, options) {
            const openURL = options["open-url"] || options["openUrl"] || "";
            const mediaURL = options["media-url"] || options["mediaUrl"] || "";
            const copyURL = options["copy"] || "";
            
            if (this.isSurge) {
                let opts = {};
                if (openURL) opts["url"] = openURL;
                if (mediaURL) opts["mediaUrl"] = mediaURL;
                $notification.post(title, subtitle, content, opts);
            }
            if (this.isQX) {
                let opts = {};
                if (openURL || mediaURL) {
                    opts["open-url"] = openURL;
                    opts["media-url"] = mediaURL;
                }
                if (copyURL) opts["copy"] = copyURL;
                $notify(title, subtitle, content, opts);
            }
            if (this.isLoon) {
                let opts = {};
                if (openURL) opts["openUrl"] = openURL;
                if (mediaURL) opts["mediaUrl"] = mediaURL;
                if (copyURL) opts["copy"] = copyURL;
                $notification.post(title, subtitle, content, opts);
            }
            if (this.isNode) {
                console.log(`${title}\n${subtitle}\n${content}`);
            }
        }

        log(msg) {
            if (this.debug) console.log(msg);
        }

        info(msg) {
            console.log(msg);
        }

        error(msg) {
            console.log("ERROR: " + msg);
        }

        wait(millisec) {
            return new Promise((resolve) => setTimeout(resolve, millisec));
        }

        done(value = {}) {
            if (this.isQX || this.isLoon || this.isSurge) {
                $done(value);
            } else if (this.isNode && !this.isJSBox) {
                if (typeof $context !== "undefined") {
                    $context.headers = value.headers;
                    $context.statusCode = value.statusCode;
                    $context.body = value.body;
                }
            }
        }

        get(options, callback) {
            this.log("HTTP GET");
            if (this.isQX) {
                $task.fetch(options).then(
                    (resp) => callback(null, resp, resp.body),
                    (reason) => callback(reason.error, null, null)
                );
            }
            if (this.isSurge || this.isLoon) {
                $httpClient.get(options, callback);
            }
            if (this.isNode) {
                this.node.request(options, (error, response, body) => {
                    callback(error, response, body);
                });
            }
        }

        post(options, callback) {
            this.log("HTTP POST");
            if (this.isQX) {
                $task.fetch(options).then(
                    (resp) => callback(null, resp, resp.body),
                    (reason) => callback(reason.error, null, null)
                );
            }
            if (this.isSurge || this.isLoon) {
                $httpClient.post(options, callback);
            }
            if (this.isNode) {
                this.node.request.post(options, (error, response, body) => {
                    callback(error, response, body);
                });
            }
        }

        put(options, callback) {
            this.log("HTTP PUT");
            if (this.isQX) {
                $task.fetch(options).then(
                    (resp) => callback(null, resp, resp.body),
                    (reason) => callback(reason.error, null, null)
                );
            }
            if (this.isSurge || this.isLoon) {
                $httpClient.put(options, callback);
            }
            if (this.isNode) {
                this.node.request.put(options, (error, response, body) => {
                    callback(error, response, body);
                });
            }
        }

        get http() {
            return {
                get: (options, callback) => {
                    return new Promise((resolve, reject) => {
                        this.get(options, (error, response, body) => {
                            if (error) {
                                reject(error);
                            } else {
                                resolve({ error, response, body });
                            }
                            if (callback) callback(error, response, body);
                        });
                    });
                },
                post: (options, callback) => {
                    return new Promise((resolve, reject) => {
                        this.post(options, (error, response, body) => {
                            if (error) {
                                reject(error);
                            } else {
                                resolve({ error, response, body });
                            }
                            if (callback) callback(error, response, body);
                        });
                    });
                },
                put: (options, callback) => {
                    return new Promise((resolve, reject) => {
                        this.put(options, (error, response, body) => {
                            if (error) {
                                reject(error);
                            } else {
                                resolve({ error, response, body });
                            }
                            if (callback) callback(error, response, body);
                        });
                    });
                },
            };
        }
    })(name, debug);
}

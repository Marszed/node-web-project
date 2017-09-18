var df = require('../lib/date.format');
var little_logger = require('./little-logger');
var conf = require('../conf');
var request = require('request');
var ma = require('mobile-agent');//判断移动端的工具
var printer = require('../res/printer');//打印机服务
var hash = require('./md5');
var API = require('wechat').API;

var accounter = require('../controllers/accounter');

var iconv = require('iconv-lite'),
    path = require('path'),
    vm = require('vm'),
    fs = require('fs'),
    artTmpl = require('art-template'),
    dao = require('../models/dao');

var sureAry, sureObj;

var JPush = require("jpush-sdk");
var client = JPush.buildClient('2f6f0f69924c5fe559bbb3b8', 'e26dc7b2a07f0593afb4ad0e');//加载app推送需要的模块

exports.getSettingValueByKey = function (ary, key) {
    var value = null;
    ary.forEach(function (obj, i) {
        if (obj.settingKey == key) {
            value = obj.settingValue;
            return false;
        }
    });
    return value;
};
exports.settingArrayToObj = function (ary) {
    var ret = {};
    ary.forEach(function (setting, i) {
        ret[setting.settingKey] = setting.settingValue;
    });
    return ret;
};

exports.isPlainObj = function (obj) {
    for (var p in obj) {
        if (p) return false;
    }
    return true;
};

exports.isToady = function (timestamp) {
    var d = new Date(timestamp);
    var now = new Date();
    if (d.getFullYear() == now.getFullYear() && d.getDate() == now.getDate() && d.getMonth() == now.getMonth()) {
        return true;
    }
    return false;
};
exports.isToday = exports.isToady;

exports.isObjInArray = function (obj, ary) {
    var yes = false;
    ary.forEach(function (v) {
        if (v == obj) {
            yes = true;
            return false;
        }
    });
    return yes;
};

var isInDevelopment = function () {
    return (process.env.NODE_ENV == 'development' || process.env.NODE_ENV == 'deployment');
};
exports.isInDevelopment = isInDevelopment;

exports.objToArray = function (obj) {
    var ret = [];
    for (var p in obj) {
        if (obj.hasOwnProperty(p)) {
            ret.push(obj[p])
        }
    }
    return ret;
};

exports.getLogger = function (level, tag, options) {
    tag = tag || '';
    var p = {
        color: true,
        format: '%Y-%m-%d %H:%M:%S %l: %a',
        writer: function (msg) {
            var args = arguments;
            console.log(tag + ' >>', msg);
        }
    };
    for (pname in options) {
        p[pname] = options[pname];
    }
    return new little_logger.Logger(level, p);
};

exports.getChineseDay = function (timestamp) {
    var d = null;
    if (typeof timestamp == 'number') {
        d = new Date(timestamp);
    } else {
        d = timestamp;
    }

    d = d.getDay();
    switch (d) {
        case 0:
            return '星期天';
        case 1:
            return '星期一';
        case 2:
            return '星期二';
        case 3:
            return '星期三';
        case 4:
            return '星期四';
        case 5:
            return '星期五';
        case 6:
            return '星期六';
    }
};
exports.getDateTextByTimeStamp = function (time_stamp) {
    return new Date(time_stamp).format('yyyy-mm-dd HH:MM:ss');
};
exports.getTimeTxt = function (timeStamp) {
    var deta_time = new Date().getTime() - timeStamp;
    if (deta_time < 1000 * 60) {
        return '刚刚';
    } else if (deta_time < 1000 * 60 * 60) {//一个小时之内
        return (deta_time / (1000 * 60) ).toFixed(0) + '分钟前';
    } else if (deta_time < 1000 * 60 * 60 * 24) {//一天内显示 "n小时前"
        return ( deta_time / (1000 * 60 * 60) ).toFixed(0) + '小时前';
    } else if (deta_time < 1000 * 60 * 60 * 24 * 30) {//一个月内显示 "n天前"
        return ( deta_time / (1000 * 60 * 60 * 24) ).toFixed(0) + '天前';
    } else if (deta_time < 1000 * 60 * 60 * 24 * 30 * 365) {//一年内显示 约n个月前
        return '约' + ( deta_time / (1000 * 60 * 60 * 24 * 30) ).toFixed(0) + '个月前';
    } else {
        return 'n久以前';
    }

};

//用最近的一个order的时间来判断一下用户现在的状态：正常, 即将流失, 流失
exports.getUserActiveStatus = function (timeStamp) {
    var deta_time = new Date().getTime() - timeStamp;
    if (deta_time < 1000 * 60 * 60 * 24 * 20) {//20天以内有下单子, 证明这个客户是活跃的
        return 0;//活跃
    } else if (deta_time < 1000 * 60 * 60 * 24 * 30) {//超过20天没下单了,
        return 1;//危险
    } else {//超过1个月没有下单的人, 我们认为是流失的
        return 2;//流失
    }
};


//获取某一天的开始和结束，这两个timeStamp
exports.getDateStartAndEndTimeStamp = function (y, m, d) {
    var dt = new Date();
    var dt2 = new Date();
    if (typeof y == 'number') {//如果传入的是一个timestamp, 就用这个timestamp直接标示具体的一天
        dt = new Date(y);
    } else {
        if (y && m && d) {//指定一天
            dt.setFullYear(y - 0);
            dt.setMonth(m - 0 - 1);
            dt.setDate(d - 0);
        } else {//今天
            y = dt.getFullYear();
            m = dt.getMonth() + 1;
            d = dt.getDate();
        }
    }

    //从0点开始
    dt.setHours(0);
    dt.setMinutes(0);
    dt.setSeconds(0);

    var time_stamp_start = dt.getTime();
    dt.setHours(23);
    dt.setMinutes(59);
    dt.setSeconds(59);
    var time_stamp_end = dt.getTime();
    var time_stamp_the_date_now = time_stamp_start + dt2.getHours() * 60 * 60 * 1000 + dt2.getMinutes() * 60 * 1000 + dt2.getSeconds() * 1000 + dt2.getMilliseconds();

    return {
        time_stamp_start: time_stamp_start,//这天的开始那个时刻的时间戳
        time_stamp_end: time_stamp_end,//这天的结束那个时刻的时间戳
        time_stamp_the_date_now: time_stamp_the_date_now //当日此时
    };
};

//获取当前时间 num_days天 以前的时间戳, 比如说, 你想获得5天前这个时候的时间戳, 可以使用这个
exports.getTimeStampDaysBefore = function (num_days) {
    var now = new Date().getTime();
    var the_timestamp = now - num_days * 24 * 60 * 60 * 1000;
    return the_timestamp;
};


exports.$extend = function (a, b) {
    for (var p in b) {
        if (b[p] !== undefined) {
            a[p] = b[p];
        }
    }
    return a;
};
exports.random = function (min, max) {
    return Math.floor(min + Math.random() * (max - min));
};
exports.trim = function (str) {
    var regx = /(^[\s\n\r]*)|([\s\n\r]*$)/ig;
    return str.replace(regx, '');
};


var is_admin_page = {
    'admin/shop_list': true,
    'admin/list_orders': true,
    'admin/msg_list': true
};


exports.isAdminPage = function (templateName) {
    if (is_admin_page[templateName]) return true;
};

//为art-template写的render方法
var views = path.join(__dirname, '../views');
var compile = exports.compile = function (template, ops) {
    var html = '';
    //使用了layout
    if (ops.layout) {
        var layout = fs.readFileSync(views + '/' + ops.layout + '.htm', 'utf-8');
        html = artTmpl.compile(layout.replace('${include}', '{{include "' + template + '"}}'))(ops);
    } else { //没使用layout，直接解析模版
        html = artTmpl(template, ops);
    }
    return html;
};

//判断一下用户使用的是简洁版还是普通版，req.cookies.dsx : 第一个数字表示使用的版本（简洁版或普通版），1为普通版，0为简单版(默认使用此版本)
exports.getCookieVersion = function (req) {
    var cookie_dsx = req.cookies.hjdsx || '',
        dsx_ver = '_simple';
    console.log(cookie_dsx.substr(0, 1) == 0);
    if (cookie_dsx.substr(0, 1) === '0') dsx_ver = '';
    return dsx_ver;
};
var load = function (url, projectName) {
    var static_config = {},
        maps = [],
        production = false;
    projectName = projectName || 'store';

    try {
        static_config = fs.readFileSync(conf.path.static_config_dir + projectName + '/static_config.js', {encoding: 'utf8'}) || '';
        vm.runInThisContext(static_config);
        maps = global.static_config.maps;
        production = global.static_config.production;
        if (url.indexOf('global/') == -1) {
            if (process.env.NODE_ENV == 'development' || process.env.NODE_ENV == 'deployment') { //测试用
                url = conf.env.assets + projectName + '/src/' + url;
            } else {
                url = conf.env.assets + projectName + '/dist/' + url;
            }
//            url = conf.env.assets+ projectName + ( production ? '/dist/' : '/src/' ) + url;
        } else {
            url = conf.env.assets + url;
        }

        //有配置信息，对url做映射处理
        if (maps && maps.length) {
            maps.forEach(function (v, i) {
                url = url.replace.apply(url, v);
            });
        }
    } catch (e) {
        //加载项目资源
        if (url.indexOf('global/') == -1) {
            url = conf.env.assets + projectName + '/src/' + url;
        } else { //加载全局资源
            url = conf.env.assets + url;
        }
        console.log(e);
        console.log('There must be something wrong with static_config.js');
    }

    if (url.indexOf('.css') != -1) {
        return '<link rel="stylesheet" type="text/css" href="' + url + '" />';
    }
    if (url.indexOf('.js') != -1) {
        return '<script type="text/javascript" src="' + url + '"></script>';
    }
    return '';
};
exports.artRender = function (req, res, templateName, params) {
    var agent = ma(req.headers['user-agent']) || {},
        html = '';
    var s_time = new Date().getTime();
    params.staticHost = 's.ksmimi.com';

    //商店的默认类型设置为小卖部
    req.user.shopType || (req.user.shopType = 'store');

    exports.$extend(params, {
        env: conf.env,
        query: req.query,
        userId: req.cookies.opuserid,
        user: req.user,
        dsx_ver: exports.getCookieVersion(req),
        power: req.user ? req.user.power : 0, //获取这个用户的权限, 普通用户不会有这个权限的
        agent: agent.Mobile,
        require: load
    });

    //如果是来自安卓的请求，直接相应json数据
    if (req.query.android) {
        res.end(JSON.stringify(params));
        return;
    }

    html = compile(templateName, params);
    res.setHeader('Content-Type', 'text/html; charset=utf8');
    console.log('加载静态文件耗时：' + (new Date().getTime() - s_time + '毫秒。'));
    res.end(html);
};

exports.render = function (req, res, templateName, params) {
    var agent = ma(req.headers['user-agent']) || {};

    params.staticHost = 's.ksmimi.com';

    exports.$extend(params, {
        env: conf.env,
        query: req.query,
        userId: req.cookies.opuserid,
        shop_id: req.params.shop_id,
        user: req.user,
        open: req.open,
        power: req.user ? req.user.power : 0, //获取这个用户的权限, 普通用户不会有这个权限的
        agent: agent.Mobile
    });

    //如果是来自安卓的请求，直接相应json数据
    if (req.query.android) {
        res.end(JSON.stringify(params));
        return;
    }

    //var templateName = templateName.replace('admin/', 'admin/mobile/');
    //if( params.layout ){
    //    params.layout = params.layout.replace('admin/', 'admin/mobile/');
    //}
    //res.render(templateName, params);
    //return;

    //配置一下，如果处于开发环境，请求静态资源时，使用本地的静态服务器（自己搭的）
    if (exports.isInDevelopment() && conf.changeToLocal) params.staticHost = req.host + ':8090';

    var is_admin = templateName.indexOf('admim');
    //如果是手机  登录的是 admin/  并且有手机页面
    if (agent.Mobile === true && is_admin < 0 && exports.isAdminPage(templateName)) {
        if (params.layout) {
            params.layout = params.layout.replace('admin/', 'admin/mobile/');
        }
        var templateName = templateName.replace('admin/', 'admin/mobile/');
        res.render(templateName, params);
        return;
    }

    res.render(templateName, params);
};

exports.end = function (res, obj) {
    if (typeof obj == 'string') {
        res.setHeader('Content-Type', 'text/plain; charset=utf8');
        res.end(obj);
        return;
    }

    res.setHeader('Content-Type', 'text/json; charset=utf8');
    res.end(JSON.stringify(obj));
};
exports.endErr = function (res, err) {
    ld.debug(err);
    exports.end(res, err);
};
//-------------------Push App----------------
exports.pushApp = function (p) {
    //if( exports.isInDevelopment() ) return; //开发环境不推送消息，免得导致socket hang up的错误
    var tmp = p.section_id + "";
    if (tmp == '0') return;
    //=======================
    client.push().setPlatform("all")//必填，推送平台设置--android,ios,winphone
        .setAudience(JPush.alias(tmp))//必填，推送设备指定--JPush.alias("2")指定发送设备的别名
        //.setNotification("Hi, App", JPush.ios("ios alert"), JPush.android("android alert"))
        .setMessage("大师兄好帅啊！", "刘善广", "中文")
        .setOptions(null, 0)//推送可选项，sendno：推送序号，api的调用标识(int)-time_to_live:离线消息保留时长,默认86400(1天),最长10天，设置0表示不保留离线消息，只有当前在线用户可收到
        //override_msg_id:(long)要覆盖的消息ID，覆盖有效时长1天-apns_production:(boolean)APNs是否生产环境，False表示推送开发环境,JPush官方(SDK)默认设置为推送开发环境
        //big_push_furation:(int)又名缓慢推送，在给定n分钟内，均匀的想这次推送的目标用户推送.最大值1440,未设置则不是定速推送
        .send(function (err, res) {
            if (err) {
                console.log(err.message);
            } else {
                console.log("Sendno: " + res.sendno);
                console.log("Msg_id: " + res.msg_id);
            }
        });
    //========================
};

//----------------- Notify -------------------//
exports.pushNotify = function (notify) {
    if (exports.isInDevelopment()) return; //开发环境不推送消息，免得导致socket hang up的错误
    notify.type = notify.type || 'order come';
    var notify_url = 'http://www.ksmimi.com:6889/dashixiongwx/notify/deliver';
    /*
     if(process.env.NODE_ENV == 'development'){ //测试用
     notify_url = 'http://dashixiong.com:6889/dashixiongwx/notify/deliver';
     }
     */
    li.info('=============广播通知===== ' + notify.shop_id);
    request.post(notify_url, {
        form: notify
    });
    //通知 0 号店，所有消息页面接收推送消息
    var notify_all = exports.$extend({}, notify);
    notify_all.shop_id = 0;
    request.post(notify_url, {
        form: notify_all
    });
};

exports.alarmAdmin = function (obj) {
    var p = {
        shop_id: obj.shop_id,
        title: obj.name + '下了一个单, 别让人家等太久',
        message: '地址是: ' + obj.address + ', 赶快送货呀~'
    };
    exports.$extend(p, obj);
    exports.pushNotify(p);
    if (!(obj.wechat)) exports.pushApp(p);
};

exports.pushVoice = function (obj) {
    exports.pushNotify(obj);
};

//----------------- cookie ----------------- //
exports.clearCookies = function (ary_cookie_names, res) {
    ary_cookie_names.forEach(function (cookie_name, i) {
        exports.setCookie(cookie_name, '', res);
    });
};
exports.setCookie = function (name, value, res) {
    res.cookie(name, value, {
        path: '/'
    });
};
exports.getOrderDetailInText = function (order, wx_id) {
    if (!order)return '你貌似还没有下过单咧~ 回复“大师兄”然后按照提示进入小卖部首页下单即可。';
    var dt = new Date(order.timeStamp);
    var txt = [
        '你最新一个订单如下:\n',
        '(当前状态:' + order.statusText + ')\n',
        '订单号: ' + order.id + '\n',
        '时间: ' + dt.getFullYear() + '-' + (dt.getMonth() + 1) + '-' + dt.getDate() + ' ' + dt.getHours() + ':' + dt.getMinutes() + ':' + dt.getSeconds() + '(' + exports.getTimeTxt(order.timeStamp) + ')\n',
        '姓名: ' + order.name + '\n',
        '手机: ' + order.mobile + '\n',
        '地址: ' + order.address + '\n'

    ];
    txt.push('\n');
    //------------- 邮费 ------------------- //
    var deliver_info_txt = '';
    var deliver_info = exports.getDeliverFeeByOrder(order);
    if (deliver_info) {
        deliver_info_txt = '(含' + deliver_info.price + '元跑腿费)\n';
        order.snapshot.total_pay += deliver_info.price;
    }
    //----------------------------------------//
    txt.push('共' + order.snapshot.total_pay.toFixed(1) + ' 元 ----------\n');
    if (deliver_info) {
        txt.push(deliver_info_txt);
    }
    order.snapshot.products_bought.forEach(function (product, i) {
        txt.push((i + 1) + ' ' + product.title + ' x' + product.count + '\n');
    });

//---添加菜品评论链接--start--//
    if (order.shopType == 'restaurant') {
        txt.push('<a href="http://www.ksmimi.com/dashixiongwx/my/orders?wx_id=' + wx_id + '">订单评论</a>\n');
    }

//---添加菜品评论链接--end--//

    txt = txt.join('');
    li.info(txt);
    return txt;
};

var getShopsByIds = function (ids, fn) {
    dao.getShopsByIds(ids, function (err, ret) {
        if (!err) {
            fn && fn(sureAry(ret));
            return;
        }
        ld.debug(err);
    });
};

exports.getEntranceResMsgBody = function (msg, fn) {
    var resMsg;
    var articles = [],
        marker = {},
        user = msg.user || {},
        relation = user.relation;

    accounter.getUserFromCacheById(user.id, function (err, user_in_cache) {
        if (err) console.log(err);
        var shop_id = user.shopId;
        dao.getSettingsByShopId(shop_id, function (err_s, ret_s) {
            if (err_s) console.log(err_s);
            var condiction = '',
                shop_conf = exports.settingArrayToObj(ret_s);
            if (msg.content == '大师兄芝麻开门') {
                condiction = 'zhimakaimen=1';
            }

            msg.user = user_in_cache;

            resMsg = {
                fromUserName: msg.toUserName,
                toUserName: msg.fromUserName,
                msgType: "news",
                funcFlag: 0,
                articles: [
                    /*{
                     title : '大师兄娱乐城',
                     description : '',
                     picUrl : 'http://img.ksmimi.com/uploads/articles/c29e9a0d145e8215192c3915cf02905b.png',
                     url : 'http://www.ksmimi.com/dashixiongwx/game/guess?wx_id='+msg.fromUserName+'&user_id='+ user.id + '&ticket='+msg.user.wx_dsx_ticket.ticket
                     },*/
                ]
            };

            if (shop_id == 1 || shop_id == 2) {
                resMsg.articles.push({
                    title: '招兵买马',
                    description: '',
                    picUrl: 'http://img.ksmimi.com/uploads/articles/aac479581b21b8a01eb2b8e69976fa0d.png',
                    url: 'http://www.ksmimi.com/dashixiongwx/shop/1/article/508' + (condiction ? '?' + condiction : '')
                });
            }

            var none = {
                //title : '',
                //description : '',
                //picUrl : 'http://img.ksmimi.com/uploads/articles/567dba274985f66a2b6db6d8ac560404.png',
                //url : 'http://www.ksmimi.com/dashixiongwx/shop/0?wx_id='+msg.fromUserName
            };

            //如果还没选学校，让它选学校去
            if (!user.shopId) {
                //articles.push(none);
                //resMsg.articles = articles;
                fn && fn({
                    fromUserName: msg.toUserName,
                    toUserName: msg.fromUserName,
                    msgType: 'text',
                    content: 'Hi，先<a href="http://www.ksmimi.com/dashixiongwx/shop/0/rd/index?wx_id=' + msg.fromUserName + '">点击我</a>，选择离你最近的分店吧！'
                });
                return;
            }

            var shopIds = relation ? relation.split(',') : [0];
            getShopsByIds(shopIds, function (shops) {
                var restaurant_id,
                    shop_id,
                    article_for_restaurant,
                    article_for_store,
                    hire;

                //标记一下本店都关联了哪些店铺
                shops.forEach(function (shop, index) {
                    if (shop.shopType == 'restaurant') restaurant_id = shop.id;
                    if (shop.shopType == 'store') shop_id = shop.id;
                    marker[shop.shopType] = shop.id;
                });

                //如果有餐厅就添加一个餐厅的入口
                if (restaurant_id) {
                    resMsg.articles.unshift({
                        title: '进入餐厅',
                        description: '',
                        picUrl: 'http://img.ksmimi.com/uploads/articles/5fad406ec8eee94290e9c92935f2b901.png',
                        url: 'http://www.ksmimi.com/dashixiongwx/shop/' + restaurant_id + '?wx_id=' + msg.fromUserName + (condiction ? '&' + condiction : '')
                    });
                }

                if (shop_id) {
                    if (shop_id == 3) shop_id = 2;
                    var picUrl = shop_conf.WCDnamicPictureUrl || 'http://img.ksmimi.com/uploads/articles/544e656f6d1c7eb50bb1d61f6bf25467.png'; //猩猩拿着手机，右边有一堆东西的那张
                    //因为第一项看起来很像广告图，所以要再添加一个餐厅的入口
                    resMsg.articles.unshift({
                        title: '进入便利店',
                        description: '',
                        picUrl: 'http://img.ksmimi.com/uploads/articles/4b9f5ff44a594d161aa67e55dccf9066.png', //八戒的头像
                        url: 'http://www.ksmimi.com/dashixiongwx/shop/' + shop_id + '/rd/index?wx_id=' + msg.fromUserName + (condiction ? '&' + condiction : '')
                    });
                    //添加一个banner入口
                    //34 临时修改文案
                    article_for_store = {
                        title: (shop_id == 34) ? ('点击进入便利店') : (shop_conf.shopName || '呼叫大师兄便利店'),
                        description: '点击图片进入' + (shop_conf.shopName || '便利店'),
                        picUrl: picUrl,
                        url: 'http://www.ksmimi.com/dashixiongwx/shop/' + shop_id + '/rd/index?wx_id=' + msg.fromUserName + (condiction ? '&' + condiction : '')
                    };
                    resMsg.articles.unshift(article_for_store);
                }


                fn && fn(resMsg)
            });
        });
    });
};

exports.selectShop = function (wx_id) {
    exports.render(req, res, 'wx/select_shop', {
        layout: true,
        wx_id: wx_id
    });
};

exports.sendWxMsg = function (weixin, resMsg, msg) {
    msg = msg || {};
    var res = msg.res;
    //非开发环境才发送微信消息
    if (exports.isInDevelopment()) {
        console.log('');
        console.log('');
        console.log('resMsg:');
        console.log(resMsg);
        console.log('');
        console.log('');
        res && res.redirect('/dashixiongwx/weixin/test');
    } else {
        weixin.sendMsg(resMsg);
    }
};

exports.getTakeawayListMsg = function (msg) {
    var articles = [];
    var resMsg;
    articles.push({
        title: '点击查看外卖单!',
        description: '快点呀! ',
        picUrl: 'http://s.ksmimi.com/dashixiong_static/img/takeaway_list.jpg',
        url: 'http://www.ksmimi.com/dashixiongwx/takeaway/list?wx_id=' + msg.fromUserName + '&ver=1#mp.weixin.qq.com'
    });

    resMsg = {
        fromUserName: msg.toUserName,
        toUserName: msg.fromUserName,
        msgType: "news",
        articles: articles,
        funcFlag: 0
    };
    return resMsg;

};

exports.getQrMsgRes = function (msg, weixin) {
    dashixiong.getUserByWxId(msg.fromUserName, function (err, ret) {
        var user = ret[0];
        dashixiong.getSettingValueByKey('qr', user.shopId, function (err, value) {
            var articles = [];
            var resMsg;
            articles.push({
                title: '扫码二维码，分享大师兄',
                description: '或者搜索公众账号: 大师兄小卖部',
                picUrl: value,
                url: value
            });

            resMsg = {
                fromUserName: msg.toUserName,
                toUserName: msg.fromUserName,
                msgType: "news",
                articles: articles,
                funcFlag: 0
            };
            weixin.sendMsg(resMsg);
        });
    });
    //return resMsg;
};
exports.getCommunityEntranceRes = function (msg, fn) {
    var articles = [];
    var resMsg;
    articles.push({
        title: '点击进入我们的社区',
        description: '请不要放弃治疗！',
        picUrl: 'http://s.ksmimi.com/dashixiong_static/img/community.jpg',
        url: 'http://www.ksmimi.com/dashixiongwx/community/' + msg.fromUserName
    });

    resMsg = {
        fromUserName: msg.toUserName,
        toUserName: msg.fromUserName,
        msgType: "news",
        articles: articles,
        funcFlag: 0
    };
    return resMsg;
};
exports.parseImgsInMarkdown = function (str) {
    if (!str)return null;
    var regx = /http:[^)]+(?=\))/ig;
    return str.match(regx);
};
exports.chinese_map = {
    '零': 0,
    '一': 1,
    '二': 2,
    '三': 3,
    '四': 4,
    '五': 5,
    '六': 6,
    '七': 7,
    '八': 8,
    '九': 9,
    '十': 10
};

//获取邮费, 根据业务返回合适的邮费( 跑腿费 )
//目前需要计算运费的地方大致有: listall.html上的前端js, order_detail_store.html, order_sus.html下单成功后告诉用户订单总价, weixin_service.js里key_my_order用户微信查单得显示总价
var r_deliver = /寄件|快递|维修/;
exports.getDeliverFee = function (products, total_pay, shop_id, config) {
    var fee = 0;
    var bought_deliver = false; //默认没有购买跑腿业务
    fee = (config.deliverFee - 0); //跑腿费，默认1元，大学城店为2元

    /*if(shop_id>=28 && shop_id<=32){
     return null;
     }

     if(shop_id>=5 && shop_id!=7 && shop_id!=8){
     fee = (config.deliverFee - 0) ;
     }else{
     fee = (config.deliverFee - 0) ;
     }*/

    if (!products || !products.length) {
        return null;
    }

    if (total_pay == 0) {
        return {
            title: '【跑腿】小费',
            price: fee
        };
    }

    if (!total_pay) {
        total_pay = 0;
        products.forEach(function (product) {
            total_pay += product.price;
        });
    }

    var total_pay_fake = total_pay;
    var cigarette_num = 0;
    var product_count = 1;
    products.forEach(function (product) {
        product_count = 1;
        if (product.count !== undefined && product.count > 1) {//有的时候, 传入进来的product对象是没有count属性的, 默认就是一个
            product_count = product.count;
        }

        if (product.title.indexOf('香烟') != -1) {
            cigarette_num += product_count;
            if (product.price_deal === undefined) {
                total_pay_fake -= product.price * product_count;//把香烟的价格从总价中减去, 下一行把就香烟的售价看做1元, 以此来计算邮费
            } else {
                total_pay_fake -= product.price_deal * product_count;//把香烟的价格从总价中减去, 下一行把就香烟的售价看做1元, 以此来计算邮费
            }
            total_pay_fake += 1 * product_count;//香烟在计算"邮费"的时候都当1元
        }

        //检查有没购买跑腿业务
        if (r_deliver.test(product.title)) bought_deliver = true;
    });

    //小于10元的订单，同时没有购买跑腿业务，要加收跑腿费
    if (total_pay < 10 && !bought_deliver) {
        return {
            title: '【跑腿】小费',
            price: fee
        };
    }

    //对烟一视同仁，满10元就不用跑腿费，所以下面的代码暂时注释掉
    /*
     if( products.length == 1 && cigarette_num == 1 ){//只买一包烟需要加收1元跑腿费, 其余情况不需要加跑腿费
     return {
     title : '【跑腿】小费',
     price : fee
     };
     }
     */

    return null;

};


exports.getDeliverFeeByOrder = function (order) {
    var snapshot = order.snapshot;
    var products = [];
    if (typeof snapshot == 'string') {
        try {
            snapshot = JSON.parse(order.snapshot);
        } catch (e) {
            snapshot = {};
        }
    }
    products = snapshot.products_bought;
    dao.getSettingsByShopId(order.shop_id, function (err2, ret2) {
        if (err2) {
            console.log(err2);
            return;
        }
        var config = exports.settingArrayToObj(ret2);
        return exports.getDeliverFee(products, snapshot.total_pay, order.shopId, config);
    });

};
exports.makeSig = function (obj, secret) {
    var raw = '';
    var keys = [];
    for (var p in obj) {
        keys.push(p);
    }

    //keys按照字典序升序排列
    keys.sort(function (a, b) {
        if (a > b) return 1;
        return -1;
    });

    //拼接待hash的字符串
    keys.forEach(function (key) {
        console.log(key);
        raw += obj[key];
    })

    //在待hash的字符串后面再加上secret组成最后的待hash串
    raw += secret;
    return hash.md5(raw);//返回签名
};
exports.strSnapshotToObj = function (str_snapshot) {
    try {
        return JSON.parse(str_snapshot);
    } catch (e) {
        ld.debug(e);
        str_snapshot += '"]}';//TODO: 有的订单的snapshot的字符串会莫名其妙地少一截, 这里补上, 临时修复一下
        return JSON.parse(str_snapshot);
    }
};

exports.strProductIdsToArr = function (str_productIds) {
    try {
        return JSON.parse(str_productIds);
    } catch (e) {
        console.log('***订单productIds非法');
        console.log(e);
        str_productIds += ']';
        return JSON.parse(str_productIds);
    }
};

exports.two = function (num) {
    if (num < 10) {
        return '0' + num;
    }
    return num;
};

exports.printTime = function (base_time, tag) {
    var tag = tag || '';
    var now = new Date().getTime();
    var t_deta = now - base_time;
    console.log('=================================================================================================' + tag + '【' + t_deta / 1000 + '】秒');
};
//获取某个时间的前一天和后一天的timeStamp
var getDates = function (time_stamp) {
    var time_stamp_pre_day = time_stamp - 24 * 60 * 60 * 1000;
    var time_stamp_next_day = time_stamp + 24 * 60 * 60 * 1000;
    return {
        pre: new Date(time_stamp_pre_day),
        next: new Date(time_stamp_next_day)
    }
};
exports.getPreDayAndNextDay = function (timeStamp) {
    var dt;
    if (timeStamp) {
        dt = new Date(timeStamp);
    } else {
        dt = new Date();
    }

    var pre_date = getDates(dt.getTime()).pre;
    var next_date = getDates(dt.getTime()).next;

    return {
        pre_date: pre_date,
        next_date: next_date,
        the_date: dt
    }
};

exports.sureObj = sureObj = function (ary) {
    return ary && ary.length > 0 ? ary[0] : {};
};

exports.sureAry = sureAry = function (ary) {
    return ary && ary.length > 0 ? ary : [];
};

//调用微信的api向用户推送消息，因为现在没法确定某个用户来自哪个公众号，所以最简单的做法是，两个api都用上，总有一个成功
//用户分组，发送消息，更新头像
exports.sendWxText = function (to_user_id, msg) {
    var wxs = conf.wxs,
        api;
    api = new API(wxs['hjdsx'].wx_app_id, wxs['hjdsx'].wx_app_secret);
    api.sendText(to_user_id, msg, function (err, ret) {
        li.info(ret);
        li.info('消息已经推送给id为' + to_user_id + '的用户');
    });
};

//获取指定日期的timeStamp
exports.getTimeStamp = function (start, end) {
    var timeStamp = {},
        dt = new Date();
    if (start && end) {
        start = start.replace(/T/ig, ' ');
        end = end.replace(/T/g, ' ');
        var start_ary = start.split('-'),
            end_ary = end.split('-');
        //开始时间
        dt.setFullYear(start_ary[0] - 0);
        dt.setMonth(start_ary[1] - 1);
        dt.setDate(start_ary[2] - 0);
        dt.setHours(0);
        dt.setMinutes(0);
        dt.setSeconds(0);
        timeStamp.start = dt.getTime();
        //结束时间
        dt.setFullYear(end_ary[0] - 0);
        dt.setMonth(end_ary[1] - 1);
        dt.setDate(end_ary[2] - 0);
        dt.setHours(23);
        dt.setMinutes(59);
        dt.setSeconds(59);
        timeStamp.end = dt.getTime()
    }
    return timeStamp;
};

//根据时间戳获取日期，根据getTime判断是否需要添加时间，即时、分、秒
exports.getDateByTimestamp = function (timeStamp, getTime) {
    var dt = new Date(timeStamp),
        m = dt.getMonth() + 1,
        d = dt.getDate(),
        h = dt.getHours(),
        minus = dt.getMinutes(),
        s = dt.getSeconds();
    if (m < 10) m = '0' + m;
    if (d < 10) d = '0' + d;
    if (h < 10) h = '0' + h;
    if (minus < 10) minus = '0' + minus;
    if (s < 10) s = '0' + s;
    var date = dt.getFullYear() + '-' + m + '-' + d + (getTime ? (' ' + h + ':' + minus + ':' + s) : '');
    return date;
};

//获取打折后的价格，暂时就是7号店的要求
exports.getDiscount = function (snapshot) {
    snapshot = snapshot || {};
    var num = snapshot.total_num,
        total = snapshot.total_pay;
    if (num >= 3 && num < 6) {
        snapshot.discount = total * 0.9; //打折后的价格
        snapshot.discountRate = 0.9; //折扣
        return;
    }
    if (num >= 6) {
        snapshot.discount = total * 0.85;
        snapshot.discountRate = 0.85;
    }
};

exports.dataFormat = function (data) {
    var r = /<script>.*<\/script>/img,
        r_on = /on\w+=.+\s/img,
        r_js = /javascript:/;

    var formater = function (str) {
        return str.replace(r, '').replace(r_on, '').replace(r_js, '');
    };

    if (data && typeof data == 'object') {
        data = JSON.stringify(data);
        return formater(data);
    }

    if (data && typeof data == 'string') {
        return formater(data);
    }
};

exports.quchong = function (arr) {
    var temp = [];
    for (var i = 0; i < arr.length; i++) {
        if (temp.indexOf(arr[i]) == -1) {
            temp.push(arr[i]);
        }
    }
    return temp;
};
//取出重复数据
exports.getSameNumByArr = function (a, b) {
    var ai = 0, bi = 0;
    var result = new Array();
    while (ai < a.length && bi < b.length) {
        if (a[ai] < b[bi]) {
            ai++;
        }
        else if (a[ai] > b[bi]) {
            bi++;
        }
        else {
            result.push(a[ai]);
            ai++;
            bi++;
        }
    }
    return result;
};

//--------------------------- 日志配置 ---------------------------//
var li = exports.getLogger('INFO', 'lib/util.js');
var ld = exports.getLogger('DEBUG', 'lib/util.js');

exports.orderReturnRP = function (total_pay) {
    if (total_pay - 0 > 15.9) {
        return Math.floor(total_pay * 1.5);
    }
    return 0;
};




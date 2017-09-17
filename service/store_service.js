var asyncMgr = require('../lib/asyncMgr');
var uutil = require('../lib/util');
var dashixiong = require('../controllers/dashixiong'),
    store = require('../controllers/store');
var md = require('node-markdown').Markdown;
var logger = require('../controllers/logger');
var food = require('../res/food');
var conf = require('../conf');
var request = require('request');
var wx_qr_creator = require('../lib/wx_qr_creator');
var hash = require('../lib/md5');
var order_printer = require('../res/order_printer');
var tools = require('../lib/tools');
var city = require('../res/city'),
    admin = require('../controllers/admin');
var section_strategy = require('../res/section_strategy'); //通过货架策略(section_strategy.js)模块, 一些跟各个店铺相关的货架策略(如, 不许卖烟)将会被应用

var middleware_load_products_map = require('../lib/middleware_load_products_map_of_shop');
var middleware_load_user_by_user_id = require('../lib/middleware_load_user_by_user_id');
var middleware_load_user_by_wx_id = require('../lib/middleware_load_user_by_wx_id');

var schedule = require('node-schedule');
var tokener = require('../res/weixin_token'),
    accessToken = tokener.accessToken;

//检测是否有资格拥有真爱
var love_require = {
    'houses': {
        '12': true,
        '13': true
    },
    'cars': {
        '4': true,
        '5': true,
        '8': true,
        '9': true
    },
    'qiegao': {
        '7': true
    }
};
var middleware_get_user_wealth_by_user_id = function (req, res, next) {
    var user = req.user || {},
        userId = user.id || 0;
    dashixiong.canIBuyLove({userId: userId, love_require: love_require}, function (can_i_buy) {

        req.can_i_buy_love = can_i_buy;
        console.log('----------------------------- can_i_buy -------------------------------------');
        console.log(can_i_buy);
        next();
    });
};


//--------------------------- 日志配置 ---------------------------//
var li = uutil.getLogger('INFO', 'store_service.js');
var ld = uutil.getLogger('DEBUG', 'store_service.js');


//=============== 常用的工具方法 =================
var render = uutil.render;
var end = uutil.end;
var endErr = uutil.endErr;
var alarmAdmin = uutil.alarmAdmin,
    artRender = uutil.artRender,
    sureAry = uutil.sureAry;
    sureObj = uutil.sureObj;

//黑名单, 专门玩我们的人屏蔽他们
var black_list_map = {
    'oXvPNjoRt9zKArdH8hWD8KQlVj9s': true,
    'oXvPNjpfZdWrGtDpTr4gQDp7kWAY': true,
    'oXvPNjrqDB47gM5TM6XbXu4MHzfU': true,
    'oXvPNjg2Y3UfTb9IFvNk3Tw-oF7I': true,
    //'oXvPNjllfRhMAVnCu5Uauz3Rn0bU' : true,
    'oXvPNjhgRWYybDJUThkfNmrnIooo': true,
    'ocB9asxZSmPq4ryFrx6aqh-1Qz1w': true
};
var isBlackUser = function (wx_id) {
    return black_list_map[ wx_id ];
};
var isTimeToClose = function (configObj, req) {
    if (req.cookies.zhimakaimen || req.query.zhimakaimen)return false;//暗号, 只有自己人知道
    if (configObj && configObj.closeTime) {
        var closeTime = configObj.closeTime;
        var now = new Date();
        var now_minutes = now.getMinutes();
        var now_hours = now.getHours();

        //确保格式正确
        if (now_minutes < 10) now_minutes = '0' + now_minutes;
        if (now_hours < 10) now_hours = '0' + now_hours;

        var str_now = now_hours + '' + now_minutes;

        closeTime = closeTime.replace('｜', '|'); //以防某些B哥用中文的符号
        //一天当中只有一个时间段营业
        if( closeTime.indexOf('|') == -1 ){
            var t = configObj.closeTime.split(',');
            var start = t[0];
            var end = t[1];
            if( end < start ){
                return (end < str_now && str_now < start);
            }else{
                return (str_now > end || str_now < start);
            }
        }
        //一天当中有两个时间段营业
        var time = configObj.closeTime.split('|');
        var t1 = time[0].trim();
        var t2 = time[1].trim();
        t1 = t1.split(',');
        t2 = t2.split(',');
        return ( str_now < t1[0] || (t1[1] < str_now && str_now < t2[0]) || str_now > t2[1] );
    }
    //如果没有设置开店时间，默认是8:00～23:00营业
    return (new Date().getHours() >= 23 || new Date().getHours() < 8 );
};


exports.route = function (app) {

//显示打烊页面
    app.get('/dashixiongwx/shop/closing', function (req, res) {
        render(req, res, 'wx/show_closing', {
            layout: true
        });
    });

    var ary_admin = [
        'oXvPNjlryKUzMZPrq6GFN-x_ueqo',
        'oXvPNjnotQIX_p1aSAkptigiCACY',
        'oXvPNjnGi834RmRgfbtSyt5jhFFo'
        //'oXvPNjv6ZxctraFq85u4ro2m04S4'
        //'wx_323mmdiVsds2fbklsdopwvMMn'
    ];


    var middleware_force_black_users = function (req, res, next) {
        /*var wx_id = req.query.wx_id || req.cookies.wx_id || 'wx_323mmdiVsds2fbklsdopwvMMn';
        if(req.cookies.zhimakaimen){
            req.query.zhimakaimen = req.cookies.zhimakaimen;
        }else if(req.query.zhimakaimen){
            req.cookies.zhimakaimen = req.query.zhimakaimen;
        }else{

        }*/
        var wx_id = req.cookies.wx_id || req.query.wx_id;
//        req.query.wx_id = req.cookies.wx_id;
        //------------------ 黑名单用户 ------------------//
        if (isBlackUser(wx_id)) {
            render(req, res, 'wx/black_user_fuck_you', {
                layout: false
            });
            return;
        }
        next();
    };

    var middleware_get_config_of_shop = function (req, res, next) {
        var user = req.user,
            a = new asyncMgr.AsyncAction();
        var shop_id = req.params.shop_id || user.shopId;//每个用户是会和具体的一个分店绑定在一起的

        //3号店的用户强制转换为2号店的用户
        if( shop_id == 3 ) shop_id = 2;

        a.register('get_setting_of_shop');
        a.register('get_cur_shop');

        a.onAllDone = function(){
            console.log('done');
            next();
        };

        //好, 接下来继续获取这个店的所有配置
        dashixiong.getConfigOfShop(shop_id, function (err, config) {
            if (err) {
                ld.debug(err);
            }
            if( !req.shop_id ) req.shop_id = shop_id;
            req.config = config;
            req.config_obj = uutil.settingArrayToObj(config);
            li.info('========= 读取店铺' + shop_id + '的配置 ======== ');
            a.thisDone('get_setting_of_shop');
            console.log('get_setting_of_shop');
        });
        //获取当前店铺的店铺信息
        dashixiong.getShopById(shop_id, function(err, ret){
            if( !err ){
                req.curShop = sureObj(ret);
                a.thisDone('get_cur_shop');
                return;
            }
            ld.debug(err);
            a.thisDone('get_cur_shop');
        });
    };

    var middleware_is_time_to_close = function (req, res, next) {
        var wx_id = req.query.wx_id || req.cookies.wx_id;
        var config = req.config;
        var user = req.user;
        //------------------ TODO: 打烊, 可能需要读取配置 ------------------------//
        var base_time = new Date().getTime();
        var timestr = uutil.getDateTextByTimeStamp(base_time).substring(0,10);

        var p = {
            wx_id: wx_id,
            wx_app_token: conf.wx.wx_app_token,
            timestamp: new Date().getTime()
        };
        var sig = uutil.makeSig(p, conf.wx.wx_app_token);
        var dt = new Date();
        //从0点开始
        dt.setHours(0);
        dt.setMinutes(0);
        dt.setSeconds(0);
        var time_stamp_start = dt.getTime();

        var sigObj = {};
        sigObj.sig = sig;
        sigObj.timestamp = p.timestamp;
        req.sigObj = sigObj;

        //如果是访问餐厅，把打烊信息传过去就行了，不用跳到打烊页面
        if( req.curShop.shopType == 'restaurant' ){
            req.isTimeToClose =  isTimeToClose(uutil.settingArrayToObj(config), req);
            next();
            return;
        }

        if (isTimeToClose(uutil.settingArrayToObj(config), req)) {
            //打烊了, 响应一个打烊的页面
            render(req, res, 'wx/show_closing', {
                layout: true,
                sigObj: sigObj,
                config: uutil.settingArrayToObj(config)
            });
            if(user.shopId == 3) {
                user.shopId = 2;
            }
            //到店str
            var str = user ? user.id + '___' + timestr + '-' + user.shopId : timestr;
            //统计到店人数
            var log_str = user ? user.id + '___' + wx_id : wx_id;
            //大于2015-1-29 0时0分0秒就插入到新记录到店数表NewLog
            if(time_stamp_start >= 1422460800000){
                logger.logNew('enter_store', log_str, user.shopId, str, user.id);
            }else{
                logger.log('enter_store', log_str, user.shopId);
            }
            return;
        }
        next();
    };

//中间件, 生成订单快照. 必须在middleware_load_products_map_of_shop 之后使用, 不然没有req.products_map
    var middleware_make_order_snapshot = function (req, res, next) {
        var total = null;//订单的汇总信息
        var products = req.body.products;

        store.checkProduct(products, function(status){
            products = JSON.parse(products);
            dashixiong.setCostForProducts(products, req.products_map);//获取一下这些产品的成本, 以便生成spanshot
            dashixiong.setCodeForProducts(products, req.products_map);//获取一下这些产品条形码, 以便在Store表中扣除
            req.total = dashixiong.countTotal(products, req.body.shop_id);//结算一下这个订单, total.snapshot就是订单快照
            req.products = products;

            if (req.body.express_info_fetch) {//如果有快递取件信息, 就把这个信息记录进快照里
                req.total.snapshot.express_info_fetch = req.body.express_info_fetch;
            }
            if (req.express_info_sent) {//寄件信息
                req.total.snapshot.express_info_sent = req.express_info_sent;
            }
            next();
        });
    };

//中间件, 用户道具使用
    var middleware_check_user_tools = function (req, res, next) {
        console.log('=================== 使用道具中间件 ==========================');
        if (!req.body.tool_ids) {//没有优惠券
            next();
            return;
        }
        var ids = req.body.tool_ids.split(',');
        var user_id = req.body.user_id;

        if (ids.length > 1) {
            end(res, '只能使用一个道具~');
            return;
        }


        dashixiong.getUserToolsByIds(ids, function (err, ret) {

            if (err || !ret.length) {
                next();
                return;
            }
            var ret_tools = [];
            ret.forEach(function (user_tool) {
                //检查是否有权使用
                if (user_tool.userId != user_id) {
                    console.log('无权使用 ');
                    return;//不是这个用户的道具
                }

                //是否过期
                if (user_tool.timeStamp + user_tool.expires < new Date().getTime()) {
                    console.log('过期了 ');
                    return;//过期了
                }

                //是否只用过
                if (!user_tool.isAvailable) {
                    console.log('用过了 ');
                    return;//过期了
                }

                ret_tools.push(user_tool);
            });

            if (!ret_tools.length) {//没有一个可用的道具, next()
                next();
                return;
            }

            //开始使用这些优惠券
            var ret;
            var tool_ids = [];

            var wealth = {};
            wealth.val = 0;
            wealth.u_id = user_id;

            ret_tools.forEach(function (tool) {
                if (tool.type != 'coupon')return;//目前只支持代金券类型的道具
                ret = tools[ tool.type ](tool, req.products, req.total.total_num, req.total.total_pay);
                req.products = ret.products;
                req.total.total_num = ret.total_num;
                req.total.total_pay = ret.total_pay;
                req.total.snapshot.total_pay = ret.total_pay;
                req.total.snapshot.actual_income -= ret.RP2RMB;//实际收入减去使用代金券---add by lufeng
                req.total.snapshot.total_num = ret.total_num;
                if (!req.total.snapshot.tool_ids) {
                    req.total.snapshot.tool_ids = [];
                }
                req.total.snapshot.tool_ids.push(tool.id);
                tool_ids.push(tool.id);//把用过的道具的id记录下来, 待会一起disable掉

                //等于0说明该道具已经使用过
                if (tool.isAvailable - 0 !== 0) {
                    wealth.val += (tool.cValue - 0);
                }
            });

            //使用道具应该是减掉财富 所以用负值
            wealth.val = -(wealth.val);
            if (req.total.total_pay < 0) {
                req.total.total_pay = 0;
            }

            dashixiong.disableUserTools(tool_ids, function (err, ret) {
                if (err) {
                    end(res, '道具使用出现问题, 返回重试一下咯~');
                    return;
                }
                dashixiong.updateUserWealth(wealth, function (err, re) {
                    if (err) {
                        end(res, '道具使用出现问题, 返回重试一下咯~');
                        ld.debug(err);
                        return;
                    }
                    console.log(req.user);

                    li.info('========================TA(' + user_id + ')结账使用道具更新财富成功====================================');
                    req.tools = ret_tools;
                    next();
                });
            });
        });

    };

//判断该订单是否返还RP
    var middleware_check_rp = function (req, res, next) {
        if( req.body.shop_id != 15 ){
            var rp = 0,
                shop_type = req.body.shop_type;
            req.rp = rp;

            li.info('========================判断该订单是否返还RP====================');
            if (req.total.total_pay > 15.9 && !req.tools) {
                req.rp = uutil.orderReturnRP(req.total.total_pay);
                li.info('========== 没有使用道具 结账价格 total_pay=' + req.total.total_pay + ' 返还RP=' + req.rp + ' ==============');
                next();
                return;
            }

            li.info('total_pay=' + req.total.total_pay + '  道具=' + req.tools + '  undefined 就是是没用道具,  不给TA返还RP');
        }
        next();
    };

    var middleware_check_express = function (req, res, next) {
        var products = req.body.products;

        try {
            products = JSON.parse(products);
        } catch (e) {
            li.info('================================  try catch 快递数据 ========================================');
            ld.debug(e);
            ld.debug(products);
            products = JSON.parse(products + ']');
            console.log(products);
        }
        products.forEach(function (product) {
            if (product.title.indexOf('拿快递') != -1) {
                req.express_fetch = true;
                return;
            }
            if (product.title.indexOf('寄件') != -1) {
                req.express_sent = true;
            }
        });

        if (!req.express_fetch && !req.express_sent) {//没有快递产品直接next
            next();
            return;
        }

        //代码运行到这里, 说明用户选购了取件或者寄件服务, 读取一些数据
        var a = new asyncMgr.AsyncAction();
        a.onAllDone = function () {
            next();
        };
        //-------------- 注册异步操作 ---------------//
        if (req.express_fetch) {//取件
            a.register('express_info_fetch');
        }
        if (req.express_sent) {//寄件
            a.register('express_info_sent');
        }

        //-------------- 开始执行 ---------------//
        if (req.express_fetch) {//取件
            //获取这个用户的常用取件信息, 如 申通快递 学校前门美宜佳后面 电话13588996539
            dashixiong.getUserExpressFetchInfo(req.user.id, function (err, ret) {
                req.express = {
                    type: 'express_fetch',
                    fetch_infos: ret
                };
                a.thisDone('express_info_fetch');
            });//getUserExpressFetchInfo
        }
        if (req.express_sent) {//寄件
            a.thisDone('express_info_sent');
        }
    };

//用户取件信息，发送模板消息----快递下单成功通知
    var sendWxExressInfoTemplateInfo = function(to_wx_id,addr){
        if(uutil.isInDevelopment()){
            return;
        }
          tokener.accessToken_hjdsx(function(err, obj){
              var date = new Date(),
                  month = (date.getMonth() - 0) + 1,
                  day = date.getDate(),
                  hour = ""+date.getHours(),
                  minute = ""+date.getMinutes();
              if(minute.length<2){
                  minute = "0"+minute;
              }
              request({
                  url: 'https://api.weixin.qq.com/cgi-bin/message/template/send?access_token='+obj.access_token,
                  method: 'POST',
                  form: JSON.stringify({
                      "touser": to_wx_id,
                      "template_id": "hj8jHWgMZxlyAaYh7srn2_aHDfcSw0nP9Ao8ug7jEhE",
                      "url": "",
                      "topcolor": "#42c83a",
                      "data": {
                          "first": {
                              "value": "您好，我们已经收到您的订单",
                              "color": "#173177"
                          },
                          "keyword1": {
                              "value": month+"月"+day+"日 " + hour + ":" + minute,
                              "color": "#173177"
                          },
                          "keyword2": {
                              "value": addr,
                              "color": "#173177"
                          },
                          "remark":{
                              "value":"感谢您选择呼叫大师兄！",
                              "color":"#173177"
                          }
                      }
                  })
              },function(err, res, body){
                  try{
                      var obj = JSON.parse( body );
                      if( obj.errcode ){
                          console.log( '~~~~~~~~~~~~~~~操作失败~~~~~~~~~~~~~~~~~~~~~~~' );
                      }
                      console.log( '======================微信用户取件信息(wx_id=)下单成功提醒========================================');
                  }catch (e){
                      console.log(e);
                  }
              });
          });
    };

//取件业务, 检查如果有新的 取件信息(ExressInfo), 在数据库里记录下来(saveExpressFetchInfo)
    var middleware_check_express_fetch_new_info = function (req, res, next) {
        //取件信息

        if (req.body.express_info_fetch && req.body.is_express_info_fetch_new) {//有新的取件信息, 保存一下
            dashixiong.saveExpressFetchInfo(req.body.user_id, req.body.express_info_fetch, function (err, ret) {
                next();
            });//保存这个取件信息
        }else{
            next();
        }

    };

//寄件业务, 看看用户使用了新地址, 还是已有地址作为寄件人的信息
    var middleware_check_express_sent_info = function (req, res, next) {
        //取件信息
        console.log('================ 取件信息>>> '+req.body.sent_info+' <<<是没有取件信息========================');
        var si = req.body.sent_info;
        if (!si) {//没有寄送快件的需求
            next();
            return;
        }
        //广州市 天河区	龙洞 渔兴路西大街16巷4号，510006，林惠华，18611661498
        req.body.sent_info.str_receiver_info = si.receiver_prov + ' ' + si.receiver_city + ' ' + si.receiver_dist + ' ' + si.receiver_street + '，' + si.receiver_name + '，' + si.receiver_mobile;
        req.body.sent_info.str_sender_info = si.sender_prov + ' ' + si.sender_city + ' ' + si.sender_dist + ' ' + si.sender_street + '，' + si.sender_name + '，' + si.sender_mobile;

        req.express_info_sent = {
            company: req.body.sent_info.company,
            receiver: req.body.sent_info.str_receiver_info,
            sender: req.body.sent_info.str_sender_info,
            weight: req.body.express_weight
        };

        next();
    };

//首页，最重要的业务。列出小卖部里现在所有的产品，供客户挑选
    var productListAll = function (req, res) {
        var base_time = new Date().getTime();
        var startStamp = base_time;//保存刚开始进来的时间戳
        var wx_id = req.query.wx_id || 'wx_323mmdiVsds2fbklsdopwvMMn';
        var user = req.user || {};
        var config = req.config,
            shop = req.curShop || {}; //当前访问的店铺的信息
        var shop_id = req.params.shop_id || user.shopId;//每个用户是会和具体的一个分店绑定在一起的

        var ajaxStamp;//发送异步请求的时间
        var transStamp;//访问首页所花费的时间

        //temp test
        var orderNum = req.query.orderNum;


        var timestr = uutil.getDateTextByTimeStamp(base_time).substring(0,10);

        //3号店的用户强制转换为2号店的用户
        if( shop_id == 3 ) shop_id = 2;

        //如果已经选择了学校，但仍然访问0号店，直接跳到他关注的店
        if( user.shopId && req.params.shop_id == 0 ){
            res.redirect('/dashixiongwx/shop/' + user.shopId + '?wx_id=' + wx_id);
            return;
        }

        //------------------ 运行到这里, 说明就是要正常显示小卖部的首页---------------- //
        var shot = '';//0元限购标示
        var notice = null;
        var sections = [];
        var filter_sections = [];//过滤餐厅补充的空对象产品
        var shops = [];
        var cur_shop = {};
        var cur_warehouse_id = uutil.getSettingValueByKey(config, 'curWarehouseId');//当前仓库的id, 小卖部首页显示的就是这个仓库的物品, 客户下单时用的也就是这个仓库的库存

        var a = new asyncMgr.AsyncAction(),
            newClient = false,
            showDeliverInfo = true;
        var purchaseProducts = [],
            dynamicStyles = [],
            dynamicJS = [];
        var versionMark = {};//版本使用记录--id
        var dt = new Date();
        //从0点开始
        dt.setHours(0);
        dt.setMinutes(0);
        dt.setSeconds(0);
        var time_stamp_start = dt.getTime();

        a.register('get_notice');
        a.register('get_sections');
        a.register('check_newClient');
        a.register('get_limit_pIds');
        a.register('get_dynamic_styles');
        a.register('insert_version_use_status');//用户访问首页时，记录当前版本使用状态，默认为0<简单版>
//        a.register('get_section_strategy');

        a.onAllDone = function () {
            var map_limit = {};
            purchaseProducts.forEach(function(limitProduct, i){
                map_limit[limitProduct.pId] = true;
            });

            //循环判断限购产品用户是否已买过
            sections.forEach(function(section, i){
                if(section.className=='zero'){
                    shot = section.className;
                }
                section.products.forEach(function(product, i){
                    product.limit = !!(map_limit[product.id]);
                });
            });

            var tmpl = shop.shopType || 'store',
                sections_obj = store.formatSectionsToObj(sections, req);

            sections = sections_obj.sections;

            //获取完公告、货架等信息之后就可以渲染首页啦
            uutil.printTime(base_time, '客户访问小卖部首页耗时');

            if( !req.isTimeToClose ) req.isTimeToClose = false;

            //循环过滤餐厅补充的空的产品对象
            if(req.curShop.shopType == 'restaurant'){//如果是餐厅去掉补充的空产品对象
                sections.forEach(function(section, i){
                    section.products.forEach(function(product, i){
                        if(product.id){
                            filter_sections.push(product);
                        }
                    });
                    section.products = filter_sections;
                });
            }
            var cookie_dsx = req.cookies.hjdsx || '';
            artRender(req, res, 'wx/' + tmpl, {
                layout: 'wx/layout',
                user: user,
                sections: sections,
                section_types : sections_obj.section_types,
                sections_json: JSON.stringify(sections_obj.sections_json),
                sigObj: req.sigObj,
                shops: shops,
                curShop : shop,
                notice: notice,
                onRight : cookie_dsx.substr(1, 1),
                zhimakaimen : req.query.zhimakaimen,
                notice_timeStamp : notice.timeStamp ? notice.timeStamp.getTime() : '10',
                shop_id : shop_id || 0,
                cur_shop: cur_shop,
                shop_name: cur_shop.name,
                timeStamp : Math.random(),
                config_obj: req.config_obj,
                showNotice : notice.timeStamp ? req.cookies.version == notice.timeStamp.getTime() : 'true',
                isNewClient :  !!(orderNum) || newClient.toString(),
                showDeliverInfo : showDeliverInfo.toString(),
                isTimeToClose : req.isTimeToClose.toString(),
                cur_warehouse_id: cur_warehouse_id || 0,
                dynamicStyles: dynamicStyles,
                dynamicJS:dynamicJS,
                versionMark:versionMark,
                shot : shot
            });

            //到店str
            var str = user ? user.id + '___' + timestr +'-' + shop_id : timestr;

            //统计到店人数
            var log_str = user ? user.id + '___' + wx_id : wx_id;
            //大于2015-1-29 0时0分0秒就插入到新记录到店数表NewLog
            if(time_stamp_start >= 1422460800000){
                logger.logNew('enter_store', log_str, shop_id, str, user.id);
            }else{
                logger.log('enter_store', log_str, shop_id);
            }
            var endStamp = new Date().getTime();
            if( !req.query.isAjax ){
                if( user.power==0 ){
                    logger.visitStore({userId: user.id, startTimeStamp: startStamp, endTimeStamp: endStamp, shopId: shop_id});
                }
            }
            //发送异步请求统计用户打开首页时间
            if( req.query.isAjax ){
                logger.getMaxId( {userId: user.id}, function(err, ret){
                    if(err){
                        console.log(err);
                        res.end(err);
                        return;
                    }
                    if(ret && ret.length>0) {
                        var maxId = ret[0].id;
                        var endTimeStamp = ret[0].endTimeStamp;
                        var transTime = (startStamp-endTimeStamp)/1000;
                        if( user.power==0 ){
                            logger.updateVisitStore({startStamp: startStamp, transTime: transTime, maxId: maxId}, function(err, ret){
                                if(err){
                                    console.log(err);
                                    res.end(err);
                                    return;
                                }
                                res.end('');
                            });
                        }
                    }else{
                        res.end('');
                    }
                });
            }

        };

        //记录用户当前正在使用的版本状态
        dashixiong.selectVersionUseStatus({userId:user.id},function(err,ret){
            if(!err){
                if(ret.length==0){
                    dashixiong.insertVersionUseStatus({shopId:shop_id,userId:user.id,status:0},function(err,ret){
                        if(!err){
                            versionMark = {
                                'id':ret.insertId,
                                'status':0
                            };
                            a.thisDone('insert_version_use_status');
                            return;
                        }
                        console.log(err);
                        a.thisDone('insert_version_use_status');
                        return;
                    });
                    return;
                }
                         versionMark = {
                                'id':ret[0].id,
                                'status':ret[0].status
                         };
                     a.thisDone('insert_version_use_status');
                     return;
            }
            console.log(err);
            a.thisDone('insert_version_use_status');
        });


        //查询用户已买过的限购产品
        dashixiong.getlimitPIdsByUserId(user.id, function(err, ret){
            if (!err){
                purchaseProducts = ret;
                a.thisDone('get_limit_pIds');
                return;
            }
            console.log(err);
            a.thisDone('get_limit_pIds');
        });


        //获取用户下单数，以判断是否新用户
        dashixiong.getOrderNumOfUsers({user_ids:[user.id]}, function(err, ret){
            if (!err) {
                var order = sureObj(ret),
                    config = req.config_obj;
                if( !order.orderNum ) newClient = true;
                if( (newClient && config.payFeeOnFirst == 'no') || config.needToPayFee == 'no' ) showDeliverInfo = false;
                a.thisDone('check_newClient');
                return;
            }
            ld.debug(err);
            a.thisDone('check_newClient');
        });

        //获取公告
        dashixiong.getCurNotice(shop_id, function (err, ret) {
            if (!err) {
                notice = sureObj(ret);
                //处理一下公告的内容，如果只是纯文本，使用默认样式，否则原样输出
                if( shop.shopType=='store' && notice.content && !/^<div/.test(notice.content ) ){ //纯文本，使用默认样式
                    notice.content = [
                        '<div class="notice-content">',
                            '<p class="notice-content-title">'+ req.config_obj.shopName +'</p>',
                            '<p class="notice-text">'+ notice.content +'</p>',
                        '</div>'
                    ].join('');
                }
                a.thisDone('get_notice');
                return;
            }
            ld.debug(err);
            a.thisDone('get_notice');
        });

        //TODO: 产品信息和货架信息本不应该 每次请求都读数据库的, 要改进
        dashixiong.getSectionsWithProducts(shop_id, user.id, function (err, _sections, user_orders) {//user_orders 为用户的过往订单
            //获取货架信息, 货架信息上含有商品信息
            if (!err) {
                //如果是餐厅，去掉“我最常买”这个货架
                if( shop.shopType == 'restaurant' ){
                    if( _sections[0] && _sections[0].tagId == -1 ){ //tagId为-1说明是“我最常买”
                        _sections.shift();
                    }
                }
                //通过货架策略(section_strategy.js)模块, 一些跟各个店铺相关的货架策略(如, 不许卖烟)将会被应用
                sections = _sections;
                sections = section_strategy.doit(req, res, shop_id, sections, user_orders);
            }
            a.thisDone('get_sections');
        }, {cur_warehouse_id:cur_warehouse_id, req:req});

        //TODO: 动态修改首页样式--已修改banner为第一次，慢慢改进
        var argsObj = {
                shopId :   shop_id
        };
        dashixiong.getDynamicStyles(argsObj, function(err, rows, fields){
            if(!err){
                rows.forEach(function(row, i){
                    var shopIdArr = row.applyShopIds.split(',');
                    rows[i].applyShopIds = shopIdArr;
                    if((row.fileName).indexOf('.js')!=-1){
                        dynamicJS.push(row);
                    }else if((row.fileName).indexOf('.css')!=-1){
                        dynamicStyles.push(row);
                    }else{

                    }
                });
                a.thisDone('get_dynamic_styles');
                return;
            }
            console.log(err);
            a.thisDone('get_dynamic_styles');
        });

    };

//微信--发送模板消息
    var sendWXTemplateMsg = function(objMsg){
        if(uutil.isInDevelopment()) return;
        var date = new Date();
        var newDAte = new Date(date.getTime()+60*60*1000);
        var j = schedule.scheduleJob(newDAte, function(){

        //调用微信接口发送模板消息
        tokener.accessToken_hjdsx(function(err, obj){
            request({
                url: 'https://api.weixin.qq.com/cgi-bin/message/template/send?access_token='+obj.access_token,
                method: 'POST',
                form: JSON.stringify({
                    "touser":objMsg.openId,
                    "template_id":"E-lKVKtmXDSH8Qvf7NX4-4YaSXBJIa_f_MUq55QMzl4",
                    "url":'http://www.ksmimi.com/dashixiongwx/api/push/template/msg?wx_id='+objMsg.openId+'&orderId='+objMsg.orderId,
                    "topcolor":"#42c83a",
                    "data":{
                        "first": {
                            "value":"来, 赏脸给个评价。只需10秒钟, 配送员的奖金就掌握在你手上。(点击本消息,进入评价页面)\n",
                            "color":"#173177"
                        },
                        "keyword1":{
                            "value":"大师兄\n",
                            "color":"#173177"
                        },
                        "keyword2": {
                            "value":'呼叫大师兄\n',
                            "color":"#173177"
                        },
                        "remark":{
                            "value":"小孩子不要呼叫大师兄！",
                            "color":"#173177"
                        }
                    }
                })
            },function(err,res,body){
                try{
                    var obj = JSON.parse( body );
                    if( obj.errcode ){
                        console.log( '~~~~~~~~~~~~~~~操作失败~~~~~~~~~~~~~~~~~~~' );
                    }
                    console.log( '===========微信客户(wx_id=)评价================');
                }catch (e){
                    console.log(e);
                }

            });
        });

      });

    };
    app.get('/dashixiongwx/product/list/all',
        middleware_force_black_users,
        middleware_load_user_by_wx_id,
        middleware_get_config_of_shop,
        middleware_is_time_to_close,
        productListAll);
    app.get('/dashixiongwx/shop/:shop_id/rd/index',
        function(req, res){
        //把wx_id保存到req.cookies里
            if(req.query.wx_id){
                res.cookie('wx_id', req.query.wx_id,{maxAge: 365*24*60*60*1000, httpOnly: true});
            }

            if(req.query.zhimakaimen){
                res.cookie('zhimakaimen', req.query.zhimakaimen,{maxAge: 1*60*60*1000, httpOnly: true});
            }

            req.query.wx_id = null;
            var shop_id = req.params.shop_id;
            if(req.query.zhimakaimen){
                res.redirect('/dashixiongwx/shop/'+shop_id+'?zhimakaimen='+req.query.zhimakaimen);
            }else{
                res.redirect('/dashixiongwx/shop/'+shop_id);
            }

    });

    app.get('/dashixiongwx/index',
        middleware_force_black_users,
        middleware_load_user_by_wx_id,
        middleware_get_config_of_shop,
        middleware_is_time_to_close,
        productListAll);
    app.get('/dashixiongwx/shop/:shop_id',
        middleware_force_black_users, //阻挡黑名单客户
        middleware_load_user_by_wx_id,  //通过微信id获取用户对象
        middleware_get_config_of_shop,  //获取用户所在店铺的配置
        middleware_is_time_to_close,   //是否关门
        productListAll);   // 首页货架列表

    app.post('/dashixiongwx/shop/addr',
        middleware_load_user_by_wx_id,//获取用户对象
        middleware_check_express,//如果用户选购了快递相关服务, 有一个标志变量
        middleware_get_config_of_shop,
        function (req, res) {
            var sign_result_id = req.body.sign_result_id || 0;
            var sign_id = req.body.sign_id || 0;
            var sign_title = req.body.sign_title || '';
            var user_id = req.body.user_id || 0;
            var products = req.body.products;
            var w_id = req.body.cur_warehouse_id;//店面当前使用的仓库id
            var shop_id = req.body.shop_id, //当前店面的id
                section_id = req.body.section_id;//外卖所在货架的id，仅当shopType=restaurant时才有用
            var shop_name = req.body.shop_name;//当前店面的名称
            var new_order_id = null;
            var wx_id = req.query.wx_id;
            var total_num = req.body.total_num; //双拼订单需要做分开处理记录*****************************************************************
            var total_pay = req.body.total_pay,
                is_booking = req.body.is_booking,
                user = req.user,
                shopType = req.body.shopType || user.shopType,
                isNewUser,
                shop_config,
                section_type = req.body.section_type || '',
                possibleReach = {}; //记录“预计到达”的信息
            var shop_config_addr_arr = [];//店铺默认送货地址

            li.info(shop_id + '号店的TA(' + user_id + ')到收银台结账了, 看看丫买了什么东西:');

            products = JSON.parse(products);


            var order = {
                shop_id: shop_id,
                user_id: user_id,
                section_id : section_id || 0,
                address_id: null //下一个页面(步骤)会把这个address_id给创建或者更新, 这里先置为空
            };

            //记录这个家伙买了什么
            var ids = [];
            products.forEach(function (product, i) {
                ids.push(product.id);
            });

            order.product_ids = JSON.stringify(ids);

            //下单时间可以通过时间戳计算出来
            order.time_stamp = new Date().getTime();

            //-------------------------------------- 异步任务 ------------------------ //
            var a = new asyncMgr.AsyncAction();
            a.tools = [];
            a.register('insert order');
            a.register('get address');
            a.register('get tools');
            a.register('check products');
            a.register('get order nums');
            a.register('get possibleReach');
            a.register('get shop config');
            a.onAllDone = function () {
                if (!new_order_id) {
                    res.end('sorry, error.. please try again later...');
                    return;
                }

                possibleReach.isShow = possibleReach.isShow || 0;

                //设定各店自己的模版
                var tpl = 'addr_' + (shopType || 'store');
                //获取跑腿费信息
                var deliver_info = uutil.getDeliverFee(products, null, shop_id, shop_config);

                render(req, res, 'wx/'+tpl, {
                    sign_result_id:sign_result_id,
                    sign_id:sign_id,
                    sign_title:sign_title,
                    user_id: user_id,
                    layout: true,
                    order_id: new_order_id,          //双拼订单需要做分开处理记录*****************************************************************
                    shop_id: shop_id,
                    section_id : section_id,
                    shop_type : shopType,
                    shop_name: shop_name,
                    wx_id: wx_id,
                    w_id: w_id,//当前仓库的id
                    products: products,
                    close_time : shop_config.closeTime,
                    possibleReach : possibleReach,
                    deliver_info : deliver_info,
                    cur_shop : req.curShop,
                    section_type : section_type,
                    express: req.express,//有收件需求
                    express_info_sent: req.express_sent,//有寄件需求
                    address: address,
                    tools: this.tools,//道具,
                    total_num: total_num,
                    is_booking : is_booking || 0,
                    total_pay: total_pay,
                    isNewUser : isNewUser,
                    detailedAddress: shop_config_addr_arr,
                    power: user.power
                });
            };

            //--------------------------------------- 异步任务设置完毕 -----------------//
            //获取用户的订单信息，用以判断是否新用户
            dashixiong.getOrderNumOfUsers({user_ids:[user_id]}, function (err, ret) {
                var order = sureObj(ret);
                isNewUser = !!(!order.orderNum);
                a.thisDone('get order nums');
            });

            //获取店铺设置
            dashixiong.getConfigOfShop(shop_id, function(err, config){
                if(err){
                    ld.debug(err);
                    shop_config = {};
                    a.thisDone('get shop config');
                    return;
                }
                shop_config = uutil.settingArrayToObj( config );
                //判断有没有默认的送货地址
                if(shop_config.detailedAddress){
                    shop_config.detailedAddress = shop_config.detailedAddress.replace(/，/img,',');
                    shop_config_addr_arr = (shop_config.detailedAddress).split(',');
                }
                a.thisDone('get shop config');
            });

            //插入一个order
            dashixiong.insertOrder(order, function (err, ret) {
                if (!err) {
                    //插入订单数据
                    new_order_id = ret.insertId;//获取新插入的订单的id
                }

                a.thisDone('insert order');
            });

            //根据ids从后台获取产品价格，防止用户在前端修改价格
            var checkPrice = {
                w_id: w_id
            };
            store.checkProduct(products, function(status, total){
                ld.info('从后台获取产品价格，状态为：' + status);
                if( status === 'sus' ) total_pay = total;
                a.thisDone('check products');
            },checkPrice);

            //TODO: 要排一下, 最新的地址应该在首位
            var address = [];
            if (user_id) {//老用户, 查数据库获得地址本数据
                dashixiong.getAddress(user_id, function (err, ret) {
                    if (!err) {
                        //查询用户最近使用的一个地址
                        dashixiong.getCurrentAddr(user_id, function(err2, ret2){
                            if(err2){
                                console.log(err2);
                                return ;
                            }
                            var curAddrId = 0;
                            if(ret2 && ret2[0] && ret2[0].addressId ){
                                curAddrId = ret2[0].addressId;
                            }
                            var sortRet = [];
                            if(ret && ret.length >= 2){
                                ret.forEach(function(addr, i){
                                    if(addr.id==curAddrId){
                                        sortRet.unshift(addr);
                                    }else{
                                        sortRet.push(addr);
                                    }
                                });
                                address = sortRet;
                            }else{
                                address = ret;
                            }
                            a.thisDone('get address');
                        });
                    }
                });
            } else {//新用户
                a.thisDone('get address');
            }
            dashixiong.getUserTools(user_id, function (err, ret) {
                a.tools = ret;
                a.thisDone('get tools');
            });

            admin.getPossibleReach(shop_id, function(err, ret){
                if( !err ){
                    possibleReach = sureObj(ret);
                    a.thisDone('get possibleReach');
                    return;
                }
                endErr(res, err);
                a.thisDone('get possibleReach');
            });


        });

//订单完成
    app.post('/dashixiongwx/order/finish',
        middleware_load_products_map,
        middleware_check_express_fetch_new_info,//检查是否有新的取件信息需要保存
        middleware_check_express_sent_info,//检查是否有寄件业务需要完成
        middleware_make_order_snapshot,//生成订单快照
        middleware_check_user_tools,//检查用户的道具
        middleware_check_rp,//检查用户的是否返还人品
        function (req, res) {
            var addr = req.body.addr;
            var user_id = req.body.user_id;
            var order_id = req.body.order_id;
            var shop_id = req.body.shop_id,
                section_id = req.body.section_id;
            var shop_name = req.body.shop_name;
            var products = req.products;
            var wx_id = req.body.wx_id,
                shop_type = req.body.shop_type;
            var w_id = req.body.w_id;//当前仓库的id

            var order_date = req.body.order_date;//订单预定的时间

            var pay_way = req.body.wechat_pay;//支付方式：1、默认货到付款(afterpay)；2、微信支付(wcpay)
            console.log('>>>>>>>>>>用户的支付方式<<<<<<<<<<<<' + pay_way);

            //调用微信接口：发送模板消息
            var objMsg = {
                openId: wx_id,
                orderId: order_id
            };

            //在线支付什么时候发送模板消息,暂时定位不发消息，等支付成功后发送消息
            if(wx_id && order_id){
                sendWXTemplateMsg(objMsg);
            }

            //把用户的取件信息直接插入到数据库
            if(req.body.express_info_fetch){
             //            sendWxExressInfoTemplateInfo(req.body.wx_id,req.body.express_info_fetch);//TODO 需求迭代
                var ExpArgObj = {
                    shop_id: req.body.shop_id || "",
                    name: req.body.name || "",
                    mobile: req.body.mobile || "",
                    otherInfo: JSON.stringify({data:req.body.express_info_fetch,wx_id:req.body.wx_id}),
                    company: req.body.company || "",
                    orderId: order_id
                };
                dashixiong.getExpressByUserOrderId(order_id,function(error,rows){//根据用户订单自动插入快递，防止重复插入
                    try{
                        if(error){
                            console.log(err);
                        }else{
                            if(rows && rows.length==0){
                                dashixiong.insertExpressInfoFetch(ExpArgObj,function(err){
                                    if(err){
                                        console.log(err);
                                    }
                                });
                            }
                        }
                    }catch (e){
                        console.log(e);
                    }
                });
             }


            //记录用户买了那些限购产品
            var limit_pids = [];
            req.products.forEach(function (product, i) {
                //记录用户买了的限购产品的PID
                if(product.islimit=='limit'){
                    limit_pids.push(product.id);
                }
            });
            //存入用户买过的限购产品记录
            var obj_params = {
                shopId : shop_id,
                userId : user_id
            };
            dashixiong.insterPurchase(obj_params, limit_pids);


            //订单快照
            if (addr.requirements) {
                req.total.snapshot.requirements = addr.requirements.split('\n');//客户额外要求, 即特别吩咐
            }

            addr.snapshot = JSON.stringify(req.total.snapshot);
            addr.snapshot_obj = req.total.snapshot;
            addr.w_id = w_id;//仓库id
            addr.order_id = order_id;//订单id
            addr.section_id = section_id || 0;//订单id
            addr.time_stamp = new Date().getTime();
            if(order_date == '明天'){
                var dt = new Date();
                dt = new Date(dt.getTime() + 3600*24*1000);
                dt.setHours(0);
                dt.setMinutes(0);
                dt.setSeconds(1);
                var year = dt.getFullYear();
                var month = dt.getMonth()+1;
                var day = dt.getDate();
                addr.time_stamp = dt.getTime();
            }
            console.log("addr.time_stamp = " + addr.time_stamp);
            addr.total_pay = addr.snapshot_obj.total_pay; //订单总价
            addr.shortTel = addr.shortTel || 0;

            //更新order, 会根据是否是新地址创建地址本
            var updateOrder = function (o_id, u_id, add, fn) {
                var argObj = {
                    pay_way: pay_way  //微信支付---到这里用户还没支付成功，所以必须把订单状态改成-1（orderStatus=-1) add by lufeng
                };
                //判断一下add是不是一个新地址, 如果是新地址就要插入新数据获取id了
                if (add.id) {//旧地址, 直接更新
                    dashixiong.updateOrder(o_id, u_id, add, function (err, ret) {
                        fn(err, ret);
                        add.shop_id = shop_id;
                        if(pay_way!='wcpay'){
                            alarmAdmin(add);//推送通知给管理员, 好尽快送货
                        }
                        var total_pay = add ? (add.snapshot_obj ? ( add.snapshot_obj.total_pay || 0 ) : 0) : 0;
                        //order_printer.printOrderById( shop_id, order_id );//打印小票
                        //达到下架库存的产品，自动下架
                        dashixiong.checkSecureCount(req.total.snapshot, shop_type, function (err, ret) {
                            if (err) endErr(res, err)
                        });
                    },argObj);
                    return;
                }

                //能运行到这里, 说明是一个新地址, 需先插入一个新地址然后才updateOrder
                dashixiong.insertAddress(u_id, add, function (err, new_addr_id) {
                    if (!err) {
                        add.id = new_addr_id;
                        dashixiong.updateOrder(o_id, u_id, add, function (err, ret) {
                            fn(err, ret);
                            add.shop_id = shop_id;
                            if(pay_way!='wcpay'){
                                alarmAdmin(add);//推送通知给管理员, 好尽快送货
                            }
                            var total_pay = add ? (add.snapshot ? add.snapshot.total_pay : 0) : 0;
                            //order_printer.printOrderById( shop_id, order_id );//打印小票
                            //达到下架库存的产品，自动下架
                            dashixiong.checkSecureCount(req.total.snapshot, shop_type, function (err, ret) {
                                if (err) endErr(res, err)
                            });
                        }, argObj);
                        return;
                    }
                    ld.debug(err);

                });
            };
            var response = function () {
                dashixiong.getOrderNumByOrderId(order_id, function(err, ret){
                    ret = sureObj(ret);
                    dashixiong.getConfigOfShop(shop_id, function (err_conf, config) {
                        if (err_conf) {
                            ld.debug(err_conf);
                        }
                        config = uutil.settingArrayToObj(config);
                        var deliver_info = uutil.getDeliverFee(products, null, shop_id,config);
                        if (deliver_info) {
                            if( (ret.orderNum == 1 && config.payFeeOnFirst == 'no') || config.needToPayFee == 'no' ){ //如果是第一单，并且设置了首单免费，则不收取跑腿费
                                deliver_info = null;
                            }else{
                                //餐厅不需要跑腿费
                                if( shop_type != 'restaurant' ) req.total.total_pay += deliver_info.price; //把跑腿费加上去
                            }
                        }

                        dashixiong.getUserById(user_id, function(err, ret){
                            var user = sureObj(ret);
                            if( !err ){
                                //更新用户参加猜奖领取状态------------zed
   /*                             dashixiong.updateGuess(user_id,function(err,ret){
                                    if(!err){
                                        console.log('=============更新用户猜奖领取状态成功==================');
                                    }else{
                                        console.log(err);
                                    }
                                });*/
                                var tmpl = 'order_sus_' + (shop_type || user.shopType);

                                //微信支付在前台set一个sign签名--add by lufeng
                                var wechatPay_orderId = {
                                    order_id: order_id,
                                    wx_id: wx_id,
                                    pay_way: pay_way,
                                    shop_id: shop_id,
                                    total_pay: req.total.total_pay,//包含跑腿费
                                    appToken: conf.wxs.hjdsx.wx_app_token,
                                    appId: conf.wxs.hjdsx.wx_app_id
                                };
                                var wechatPay_secret = "dashixiong_store";
                                var wechatsign = uutil.makeSig(wechatPay_orderId,wechatPay_secret);
                                res.cookie('wechatsign', wechatsign,{httpOnly: true});

                                render(req, res, 'wx/'+tmpl, {
                                    layout: true,
                                    user_id: user_id,
                                    order_id: order_id,
                                    wx_id: wx_id,
                                    rp: req.rp,
                                    shop_id: shop_id,
                                    shop_name: shop_name,
                                    products: products, //产品
                                    total: req.total,//订单详情
                                    address: addr,//地址信息
                                    tools: req.tools,//道具信息
                                    deliver_info: deliver_info,//跑腿费信息
                                    express_info_fetch: req.body.express_info_fetch,//取件信息
                                    express_info_sent: req.express_info_sent,//寄件信息
                                    pay_way: pay_way//订单付款方式
                                });

                                return;
                            }
                            ld.debug(err);
                        });

                    });
                });
            };

            //检查一下用户是不是注册了(自动注册的)
            if (user_id) {//注册过的
                updateOrder(order_id, user_id, addr, function (err, ret) {
                    if( err ) ld.debug(err);
                    response();//向用户展示下单成功的提示
                });
                return;
            }

        });


    app.get('/dashixiongwx/city', function (req, res) {
        end(res, city);
    });


    app.get('/dashixiongwx/rp/:wx_id',
        middleware_load_user_by_wx_id,
        function (req, res) {

            var u_id = req.user.id;
            var timestamp = req.query.timestamp;
            var sig = req.query.sig;

            //没有微信id不给他看
            if (!u_id) {
                res.end('请用微信登陆');
                return;
            }

            var obj = {};
            var sigObj = {};
            sigObj.sig = sig;
            sigObj.timestamp = timestamp;

            var a = new asyncMgr.AsyncAction();
            a.register('get UserRP');
            a.register('get tools');
            a.onAllDone = function () {
                li.info('==============Ta(' + req.user.nick + ') 访问了人品页面==========================');
                render(req, res, 'wx/rp', {
                    layout: 'wx/rp_layout',
                    sigObj: sigObj,
                    web_tit: '我的人品',
                    ret: obj
                });
            };
            //获取用户有多少RP
            dashixiong.getUserRPByUserId(u_id, function (err, ret) {
                if (!err && ret) {
                    ret = ret[0] || {};
                    obj.rp = ret.val || 0;
                    if (obj.rp - 0 < 0) {
                        obj.rp = 0;
                        ld.debug('============================= TA(' + u_id + ') 的专户RP为负值,赶紧看看是怎么会是  紧急处理!!!!!!!   ==============================');
                    }
                    a.thisDone('get UserRP');
                    return;
                }
                ld.debug(err);
                a.thisDone('get UserRP');

            });

            //道具列表
            dashixiong.listAllTools(function (err, ret) {
                if (!err) {
                    obj.tools = ret || [];
                    a.thisDone('get tools');
                    return;
                }
                ld.debug(err);
                a.thisDone('get tools');
            });
        });

    app.get('/dashixiongwx/getuserwealthRank/:wx_id',
        middleware_load_user_by_wx_id,
        function (req, res) {
            var u_id = req.user.id;
            var shop_id = req.user.shopId;
            dashixiong.getUserWealthRank(shop_id, u_id, function (err, ret) {
                if (!err) {
                    ret = ret && ret.length > 0 ? ret[0] : {};
                    console.log(ret);
                    end(res, ret);
                    return;
                }
                endErr(res, err);
            });
        });


    app.get('/dashixiongwx/listWealth/:wx_id',
        middleware_load_user_by_wx_id,
        function (req, res) {
            var u_id = req.user.id;
            var shop_id = req.user.shopId;

            var timestamp = req.query.timestamp;
            var sig = req.query.sig;

            var sigObj = {};
            sigObj.sig = sig;
            sigObj.timestamp = timestamp;

            console.log(req.user);
            dashixiong.listUserWealth(shop_id, function (err, ret) {
                if (!err) {
                    li.info('==============Ta(' + req.user.nick + ') 访问了财富排行榜==========================');
                    render(req, res, 'wx/wealth', {
                        layout: 'wx/rp_layout',
                        sigObj: sigObj,
                        web_tit: '福布斯财富榜',
                        staticheads : 'http://img.ksmimi.com/uploads/heads/',//本地配置路径http://img.ksmimi.com/grab_img/
                        defaultheads : 'http://s.ksmimi.com/dashixiong_static/img/default-p-pic.jpg',
                        ret: ret
                    });
                    return;
                }
                end(res, '服务器繁忙, 返回重试一下咯~');
                ld.debug(err);
            });
        });

    app.get('/dashixiongwx/myWealth/:wx_id',
        middleware_load_user_by_wx_id,
        function (req, res) {

            var timestamp = req.query.timestamp;
            var sig = req.query.sig;
            var sigObj = {};
            sigObj.sig = sig;
            sigObj.timestamp = timestamp;

            var u_id = req.user.id;
            dashixiong.myWealth(u_id, function (err, ret) {
                if (!err) {
                    render(req, res, 'wx/myWealth', {
                        layout: 'wx/rp_layout',
                        sigObj: sigObj,
                        web_tit: '我的财富',
                        ret: ret
                    });
                    return;
                }
                end(res, '服务器繁忙, 返回重试一下咯~');
                ld.debug(err);
            });
        });

    app.post('/dashixiongwx/exchange/:wx_id',
        middleware_load_user_by_wx_id,
        middleware_get_user_wealth_by_user_id,
        function (req, res) {

            var nick = req.user.nick;
            var t_id = req.body.id;
            var u_id = req.user.id;
            var url_sig = req.query.sig;
            var p = {
                wx_id: req.user.openId,
                wx_app_token: conf.wx.wx_app_token,
                timestamp: req.query.timestamp
            };
            var sig = uutil.makeSig(p, conf.wx.wx_app_token);

            if (url_sig != sig) {
                ld.debug('================== TA(' + nick + ')这个地址不是有效的兑换地址 ' + req.url + ' ======================');
                res.end(JSON.stringify({code: 2, msg: '大神不要乱来啊'}));
                return;
            }

            if (t_id == 15 && !req.can_i_buy_love) {
                end(res, {code: 2, msg: '有房有车才能有真爱! 请先兑换<a class="f50">房子</a>和<a class="f50">车子</a>......或者你有一块<a class="f50">切糕</a>!'});
                return;
            }

            var obj = {};
            var a = new asyncMgr.AsyncAction();
            a.register('get rp');
            a.register('get cValue');

            var o = {};
            a.onAllDone = function () {
                o.u_id = u_id;
                o.val = -(obj.cValue);

                if (obj.cValue < 1) {
                    res.end(JSON.stringify({code: 2, msg: '这个道具过期了'}));
                    ld.debug('============================= TA(' + nick + ')兑换的道具的RP价值为0 或负值 需要处理  赶紧处理======================================');
                    return;
                }
                if (obj.rp - obj.cValue < 0) {
                    res.end(JSON.stringify({code: 2, msg: '人品不够啊 ~亲'}));
                    ld.debug('============================= TA(' + nick + ')人品不够,想兑换道具 ======================================');
                    return;
                }

                var as = new asyncMgr.AsyncAction();
                as.register('insert exchange');
                as.register('insert RP');

                as.onAllDone = function () {

                    //兑换道具后账户RP更新
                    obj.t_id = t_id;
                    obj.user_id = u_id;

                    dashixiong.insertUserTool(obj, function (err, ret) {
                        if (!err) {
                            li.info('================TA(' + nick + ') 兑换 ' + obj.title + '  道具成功===========');
                            var wealth = {};
                            wealth.u_id = u_id;
                            wealth.val = obj.cValue; //获得的财富值

                            dashixiong.updateUserWealth(wealth, function (er, re) {
                                if (!er) {
                                    li.info('================TA(' + nick + ') 兑换 ' + obj.title + '  道具成功后更新财富成功===========');
                                    res.end(JSON.stringify({code: 0, msg: '兑换成功'}));
                                    return;
                                }
                                ld.debug(er);
                                res.end(JSON.stringify({code: 1, msg: er}));
                            });
                            return;
                        }
                        res.end(JSON.stringify({code: 1, msg: err}));
                    });
                };

                //兑换道具后账户RP更新
                dashixiong.updateUserRP(o, function (err, ret) {
                    if (!err) {
                        li.info('================TA(' + nick + ') 兑换道具后RP更新成功 ===========');
                        as.thisDone('insert RP');
                        return;
                    }
                    ld.debug(err);
                    as.thisDone('insert RP');
                });

                //记录用户兑换信息
                dashixiong.exchange(u_id, t_id, obj.cValue, function (err, ret) {
                    if (!err) {
                        li.info('=============== 记录 TA(' + nick + ')兑换了 RP=' + obj.cValue + ' 的道具---> ' + obj.title + ' ===================');
                        as.thisDone('insert exchange');
                        return;
                    }
                    ld.debug(err);
                    as.thisDone('insert exchange');
                });

            };

            //获取用户RP
            dashixiong.getUserRPByUserId(u_id, function (err, ret) {
                if (!err && ret) {
                    ret = ret[0] || {};
                    obj.rp = ret.val || 0;
                    a.thisDone('get rp');
                    return;
                }
                ld.debug(err);
                a.thisDone('get rp');
            });

            //获取道具信息
            dashixiong.getToolById(t_id, function (err, ret) {
                if (!err) {
                    li.info('=============== TA(' + nick + ') 要兑换的道具信息 ===================');
                    console.log(JSON.stringify(ret));
                    obj.cValue = ret.cValue - 0;
                    obj.title = ret.title;
                    a.thisDone('get cValue');
                    return;
                }
                ld.debug(err);
                a.thisDone('get cValue');
            });

        });

    app.post('/dashixiongwx/doSign/:wx_id/:g_id',
        middleware_load_user_by_wx_id,
        function (req, res) {
            var o = {};

            o.u_id = req.user.id;
            o.rp = Math.floor(Math.random() * 10) + 1;
            o.g_id = req.params.g_id;

            dashixiong.doSign(o, function (err, ret) {
                if (!err) {
                    end(res, ret);
                    return;
                }
                endErr(res, err);
            });

        });


    app.get('/dashixiongwx/getRankAndWealth/:wx_id',
        middleware_load_user_by_wx_id,
        function (req, res) {
            var o = {};
            o.u_id = req.user.id;
            o.shop_id = req.user.shopId;

            dashixiong.getRankAndWealth(o, function (err, ret) {
                if (!err) {
                    end(res, ret);
                    return;
                }
                ld.debug(err);
                endErr(res, {code: 1, msg: err});
            });
        });

//初始化RP表 只能运行一次
//app.get('/dashixiongwx/updateUserRPByXiexie/oXvPNjpP_553vWCT8AM3qXadnehs/gogogo', function(req, res){
//    dashixiong.getAllUserOrder(function(err, ret){
//        if(!err){
//            ret.forEach(function(re,i){
//                var obj = {};
//                obj.u_id = re.userId;
//                obj.val = re.cValue -0;
//            });
//            return;
//        }
//        ld.debug(err);
//    });
//});
//-------------------------- 更改用户绑定的店铺 --------------//
//    系统好像没有用到此路由
    app.post('/dashixiongwx/shopbind/:wx_id', function (req, res) {
        var wx_id = req.params.wx_id;
        var shop_id = req.body.shop_select;

        dashixiong.getUserByWxId(wx_id, function (err, ret) {
            if (err) {
                res.end('出了点小问题, 歇会等下再来, 如何？');
                return;
            }

            var user = ret.length ? ret[0] : null;
            if (!user) {//没注册过, 那就给他注册一下, 顺便把用户的店铺的信息绑定了
                console.log('===== 新用户, 自动给TA注册一个号 ~~~~~');
                dashixiong.newUser({shop_id: shop_id, qId: 0}, function (err, new_user_id) {
                    //获得新用户id之后, 绑定微信id, 然后跟注册过的是一个流程了
                    //TODO: 绑定流程就不管他是不是成功了, 有空可以改进
                    dashixiong.bindUser(new_user_id, wx_id, function () {
                        req.query.wx_id = wx_id;
                        productListAll(req, res);
                    });
                });
                return;
            }// end if(!user)

            //运行到这里为有用户的情况, 需要更改他在数据库中的shopId
            dashixiong.updateUser({
                id: user.id,
                shopId: shop_id
            }, function (err, ret) {
                ld.debug(err);
                ld.debug(ret);
            });

        });

        res.end(wx_id + '  ' + shop_id);

    });

//-----------------------饿了么订单数据解析并封装成对象------------------//
    app.get('/dashixiongwx/elm/order',function(req, res){
        //获取解析传递过来的数据
        console.log(req.query.shop_name);

        console.log("test");
        //封装成对象

        //请求
        /*request.post('http://www.ksmimi.com:6889/dashixiongwx/notify/deliver',{
            form : notify
        });*/
    });
//-----------zed_guess--------猜中抽奖----start
    app.post('/dashixiongwx/player/shop/guess/join',function(req,res){
        var data = req.body.data;
        dashixiong.insertGuess(data,function(err){
            if(err){
                console.log('------insert guess error--------');
                console.log(err);
                res.end('failure');
            }else{
                res.end('success');
            }
        });
    });
    app.post('/dashixiongwx/player/shop/guess/join/qualification',function(req,res){
        var userId = req.body.userId;
        dashixiong.selectGuess(userId,function(err,ret){
            var obj = '';
            if(err){
                console.log(err);
                obj = 'failure'
            }else{
                if(!ret[0]){//为参加活动
                    obj = 'null';
                }else if(ret[0].type=='success'&&ret[0].status=='0'){//猜中，未领取
                    obj = 'undraw'
                }else if(ret[0].type=='success'&&ret[0].status=='1'){//猜中，已领取
                    obj = 'draw';
                }else if(ret[0].type=='failure'){//没猜中
                    obj = 'draw_failure';
                }else{
                    obj = 'failure'
                }
            }
            res.end(obj);
        });
    });
    app.post('/dashixiongwx/player/shop/guess/result',function(req,res){
        var data = req.body.data;
        //开始发放道具
        dashixiong.grantTool({
            user_id: data.userId,
            t_id: data.tId,
            msg: '客户猜新品获得道具'}
        ,function(err,ret){
            if(!err){
                //记录抽奖抽中道具
                li.info('======================猜新品送道具往SystemMonitor插入记录开始==========================');
                var type = "tool_rp",
                    content = {
                        "userId": data.userId,
                        "toolTitle": data.tTitle,//道具名称
                        "qd": "guessTool"
                    },
                    timeStamp = uutil.getDateTextByTimeStamp(new Date());
                var contentStr = JSON.stringify(content);
                admin.tool_rp(contentStr, timeStamp, type, function(err, ret){
                    if(!err){
                        li.info('======================猜新品送道具往SystemMonitor插入记录成功==========================');
                        return;
                    }
                    ld.debug(err);
                });
                res.end('success');
                return;
            }else{
                li.info('======================猜新品送道具,系统发放道具出错==========================');
                res.end('failure');
            }
        });
    });
//-----------zed--------猜中抽奖----end





//-----------lufeng-----签到抽奖-----start

    app.post('/dashixiongwx/player/shop/draw/generate/result',function(req, res){
        var args = req.body.args;
        //根据奖品类别和shopId，随机产生一个奖品，并且保存起来
         dashixiong.getAllDrawByShopIdType(args,function(err, ret){
             console.log('getAllDrawByShopIdType');
             console.log(ret);
             if(!err && ret.length>0){
                 //从ret中随机选择一个奖品给用户
                 var ret_length = ret.length,
                     max = ret_length;
                 var index = Math.floor(Math.random()*max);
                //--保存产生的奖品到数据库
                 var resultDraw = {
                        'userId' : args.userId,
                        'signDrawId' : ret[index].id,
                        'type' : ret[index].type,
                        'timeStamp' : new Date().getTime()
                 };

                 //--减少被抽中的奖品的库存==count-1
                 dashixiong.updateSignDrawCount(resultDraw, function(err4, ret4){
                     dashixiong.saveGenerateDraw(resultDraw,function(err2, ret2){
                         //输出错误，如果存在
                         if( err4 ){
                             console.log('err4=');
                             ld.debug('err4',err4);
                         }
                         if( err2 ){
                             console.log('err2=');
                             console.log(err2);
                             ld.debug(err2);
                         }

                         //根据不同的类别做不同的处理
                         switch( args.kind ){
                             case '0' : //抽奖抽中的是道具，给客户发放道具
                                 console.log('抽到道具');
                                 dashixiong.grantTool({
                                     user_id: args.userId,
                                     t_id: ret[index].val,
                                     msg: '客户抽奖发放道具'
                                 },function(err_tool,ret_tool){
                                     if(!err_tool){
                                         res.end(JSON.stringify({
                                             text : '恭喜你获得道具<span style="color: #ff0000;">'+ ret[index].title + '</span>！'
                                         }));
                                         console.log('道具发放成功～');
                                         //记录抽奖抽中道具
                                         li.info('======================抽奖送道具往SystemMonitor插入记录开始==========================');
                                         var type = "tool_rp",
                                             content = {
                                                 "userId": args.userId,
                                                 "toolTitle": ret[index].title,
                                                 "qd": "drawTool"
                                             },
                                             timeStamp = uutil.getDateTextByTimeStamp(new Date());
                                         var contentStr = JSON.stringify(content);
                                         admin.tool_rp(contentStr, timeStamp, type, function(err, ret){
                                             if(!err){
                                                 li.info('======================抽奖送道具往SystemMonitor插入记录成功==========================');
                                                 return;
                                             }
                                             ld.debug(err);
                                         });
                                         return;
                                     }
                                     console.log('grantTool err:');
                                     ld.debug(err_tool);
                                     res.end('道具发放失败.');
                                 });
                                 break;
                             case '1' : //抽到人品
                                 var drawRP ={};
                                 drawRP.u_id = args.userId;
                                 drawRP.val = ret[index].val;
                                 console.log('抽到人品');
                                 dashixiong.insertDrawRP(drawRP, function(err3, ret3){
                                     if( !err3 ){
                                         res.end(JSON.stringify({
                                             text : '恭喜你获得 <span style="color: #ff0000;">' + ret[index].val + '个人品</span>'
                                         }));
                                         console.log('人品发放成功');
                                         //记录抽奖抽中人品
                                         li.info('======================抽奖送人品往SystemMonitor插入记录开始==========================');
                                         var type = "tool_rp",
                                             content = {
                                                 "userId": args.userId,
                                                 "rpVal": ret[index].val,
                                                 "qd": "drawRP"
                                             },
                                             timeStamp = uutil.getDateTextByTimeStamp(new Date());
                                         var contentStr = JSON.stringify(content);
                                         admin.tool_rp(contentStr, timeStamp, type, function(err, ret){
                                             if(!err){
                                                 li.info('======================抽奖送人品往SystemMonitor插入记录成功==========================');
                                                 return;
                                             }
                                             ld.debug(err);
                                         });
                                         return;
                                     }
                                     console.log('rp err:');
                                     ld.debug(err3);
                                     res.end('人品领取失败.');
                                 });
                                 break;
                             case '2' :
                                 res.end(JSON.stringify({
                                     text : '恭喜你获得 <span style="color: #ff0000;"">' + ret[index].title+'</span>，下单满10元即可领取',
                                     sign_id : ret[index].id,
                                     sign_title : ret[index].title,
                                     sign_result_id : ret2.insertId
                                 }));
                                 break;
                         }
                     });
                 });


             }else{ //放上去抽奖的东西被抽完了
                 console.log(err);
                 res.end(JSON.stringify({
                     text : '啥也没有呢，欢迎下次再来～'
                 }));
             }
         });
    });

    //查询用户最新抽到食物还没领取的是什么
    app.post('/dashixiongwx/look/shop/draw/look/result',function(req, res){
        var userId = req.body.userId;
        dashixiong.findSignResult(userId, function(err, ret){
            if(!err && ret.length>0){
                var returnResult = {
                    'userId' : userId,
                    'signResultTitle' : ret[0].title,
                    'signResultId' : ret[0].id,
                    'signDrawId' : ret[0].signDrawId
                };
                res.end('{"successData":'+ JSON.stringify(returnResult) +'}');
            }else{
                res.end('no');
            }
        });
    });

    app.post('/dashixiongwx/player/shop/draw/delete/result',function(req, res){
        var deleteSignResult = req.body.deleteSignResult;
        dashixiong.updateSignResultStatusById(deleteSignResult,function(err, ret){
            if(!err){
                res.end('success');
            }else{
                console.log(err);
                res.end('failure');
            }
        });
    });

    //----获取签到时服务器时间-----//
    app.post('/dashixiongwx/signServerTime',function(req,res){
        //产生服务器端时间res.end('{"successData":'+ JSON.stringify(returnResult) +'}');

        //从SignResult查出userId上次签到的时间戳
        var userId = req.body.userId;
        dashixiong.getLastSignTimeStamp(userId,function(err, ret){
            if( !err ){
                var lastTimeStamp = 0;
                if(ret.length){
                    lastTimeStamp = ret[0].timeStamp;
                }
                var dt = new Date();
                res.end('{"time":'+JSON.stringify(dt.getTime())+',"lastTimeStamp":'+lastTimeStamp+'}');
            }
        });

        //        res.end('{"time":'+JSON.stringify(dt.getTime())+'}');
    });
//-----------lufeng-----签到抽奖-----end

};//end exports.route

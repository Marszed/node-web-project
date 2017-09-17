var util = require('util');
var gm = require('gm'); //lufeng
var conf = require( '../conf' );
var pool = conf.getPool();  //打开数据库链接
var fs = require('fs');
var uutil = require('../lib/util');
var asyncMgr = require('../lib/asyncMgr');
var dashixiong = require('../controllers/dashixiong');
var admin = require('../controllers/admin');
var accounter = require('../controllers/accounter');
var md = require('node-markdown').Markdown;
var request = require('request');
var hash = require('../lib/md5');
var conf = require('../conf');
var wx_qr_creator = require('../lib/wx_qr_creator');
var API = require('wechat').API;
var api = new API(conf.wx.wx_app_id, conf.wx.wx_app_secret);
var api_hjdsx = new API(conf.wxs['hjdsx'].wx_app_id, conf.wxs['hjdsx'].wx_app_secret);
var printer = require('../res/printer');//打印机服务
var order_printer = require('../res/order_printer');
var formidable = require('formidable'),
    community = require('../controllers/community'),
    apis = require('../controllers/apis');

var fdb = require('../lib/fdb');

var dao = require('../models/dao'),
    dao_admin = require('../models/dao_admin'),
    app_routes = require('../lib/app_routes');
var tokener = require('../res/weixin_token'),
    accessToken = tokener.accessToken;

//--------------------------- 中间件 ----------------------------//
var middleware_load_products_map = require('../lib/middleware_load_products_map_of_shop');
var middleware_load_user_by_user_id = require('../lib/middleware_load_user_by_user_id');
var middleware_get_config_of_shop = require('../lib/middleware_get_config_of_shop');
var middleware_power = require('../lib/middleware_power');//这个模块里面有各种权限的中间件

//--------------------------- 日志配置 ---------------------------//
var li = uutil.getLogger('INFO', 'admin_service.js');
var ld = uutil.getLogger('DEBUG', 'admin_service.js');

//=============== 常用的工具方法 =================
var render = uutil.render;
var end = uutil.end;
var endErr = uutil.endErr,
    sureAry = uutil.sureAry,
    sureObj = uutil.sureObj;

//================微信接口名临时变量==========
var selectTemp = api_hjdsx;

//================利润排行榜排序变量=======================
var sortRoleTemp = 1;

exports.route = function (app) {

//类中间件: 看到路由中含有的shop_id, 就直接加载shop 的各种参数
    var get_shop_info_middleware = function (req, res, next) {
        var shop_id = req.params.shop_id;
        var shop = {};
        var config = null;
        var a = new asyncMgr.AsyncAction();
        a.register('get_shop');
        a.register('get_shop_config');
        a.onAllDone = function () {
            shop.config = config;
            //将配置做成obj的形式
            shop.conf = {};
            config.forEach(function (obj, i) {
                shop.conf[ obj.settingKey ] = obj.settingValue;
            });
            req.shop = shop;
            next();
        };

        dashixiong.getShopById(shop_id, function (err, ret) {
            if (err) {
                ld.debug(err);
            }
            shop = ret[0] || {};
            a.thisDone('get_shop');
        });

        dashixiong.getConfigOfShop(shop_id, function (err, _config) {
            if (err) {
                ld.debug(err);
            }
            config = _config;
            a.thisDone('get_shop_config');
        });
    };

    app.all('/dashixiongwx/admin/*', app_routes.load_open_info);

    app.get('/dashixiongwx/admin', function (req, res) {
        //res.redirect('/dashixiongwx/admin/shop/'+ req.params.shop_id +'/product/list/all');
        res.redirect('/dashixiongwx/admin/login');
    });
    //
    app.get('/admin/login', function (req, res) {
        res.redirect('/dashixiongwx/admin/login');
    });
    //登录页面
    app.get('/dashixiongwx/admin/login', function (req, res) {
        //var ticket = req.cookies.dsx_wx_t;
        var ticket = req.cookies.wx_dsx_ticket;
        var user_id = req.cookies.user_id;

        console.log(hash.md5('xiexie'));

        //检查用户的登录状态, 如果登录过的用户就引导TA到其他功能页面. 没有logout是不能直接访问这个页面的
        accounter.getUserFromCacheById(user_id, function (err, user) {

            console.log(user);

            if (accounter.isTicketAvailableForUser(ticket, user)) {
                //============ 根据用户的等级redirect到不同的页面 ===============//
                if (!user.power) {//普通用户竟然在这里登录了, 把TA redirect 到店铺首页
                    res.redirect('/dashixiongwx/product/list/all');
                    return;
                }

                if (user.power >= 5) {//权限大于5的可以查看多店铺数据
                    res.redirect('/dashixiongwx/admin/shop/list/all');
                    return;
                }
                res.redirect('/dashixiongwx/admin/shop/' + user.shopId + '/order/list');
                return;
            }

            //没有登录的用户才会运行下面的代码
            render(req, res, 'admin/login', {
                layout: false
            });
        });

    });
    app.post('/dashixiongwx/admin/dologin', function (req, res) {
        var email = req.body.email;
        var pwd = req.body.pwd,
            loginType = req.body.loginType;

        //TODO 在缓存中删除掉原来的ticket, 防止在没有logout的情况下重新登录而造成的老票没有被清除的情况

        accounter.login({
            pwd: pwd,
            email: email,
            type: 'email'
        }, function (err, isLogin, user_in_cache, ticket, sectionId) {
            if (!err) {
                //没错的话就开始处理业务
                if (isLogin) {//登录成功
                    //往cookie里set user_id, 以便后续操作能够通过user_id来获取正确的user对象, 以便验证
                    uutil.setCookie('user_id', user_in_cache.id, res);
                    //uutil.setCookie('dsx_wx_t', ticket, res);
                    uutil.setCookie('wx_dsx_ticket', ticket, res);
                    uutil.setCookie('bindto', sectionId, res);

                    //根据用户登录的类型
                    /*
                     if( loginType == 'seller' ){ //说明用户是卖家
                     res.redirect('/dashixiongwx/admin/seller/list/all');
                     return;
                     }
                     */

                    //============ 根据用户的等级redirect到不同的页面 ===============//
                    if (!user_in_cache.power) {//普通用户竟然在这里登录了, 把TA redirect 到店铺首页
                        res.redirect('/dashixiongwx/product/list/all');
                        return;
                    }

                    if (user_in_cache.power == 1) {//兼职
                        console.log(user_in_cache);
                        res.redirect('/dashixiongwx/admin/shop/' + user_in_cache.shopId + '/expressinfofetch/list#mp.weixin.qq.com');//qq.com那个锚点是为了解决在微信中访问本链接, 手机终端点击号码可以直接拨打. 没有这个锚点在微信中节节拨打不了
                        return;
                    }

                    if (user_in_cache.power >= 6) {//权限大于3的可以查看多店铺数据
                        res.redirect('/dashixiongwx/admin/shop/list/all');
                        return;
                    }
                    //-----lufeng---start--
                    var bindToArr = new Array();
                    if( typeof user_in_cache.bindTo == 'number' ) user_in_cache.bindTo += '';
                    bindToArr = user_in_cache.bindTo.split(',');
                    //-----lufeng---end---
//                    res.redirect('/dashixiongwx/admin/shop/' + user_in_cache.bindTo + '/order/list');
                    res.redirect('/dashixiongwx/admin/shop/' + bindToArr[0] + '/order/list');
                    return;
                }
                //运行到这里说明登录失败, 可能是用户名密码不对
                res.redirect('/dashixiongwx/admin/');
                return;
            }

            //运行到这里, 说明出现了系统错误
            end(res, '出了点小问题...查看一下日志吧~');
            ld.debug(err);
            return;
        });
    });

    app.get('/dashixiongwx/admin/logout', function (req, res) {
        //var t = req.cookies.dsx_wx_t;
        var t = req.cookies.wx_dsx_ticket;
        var user_id = req.cookies.user_id;

        accounter.removeTicketByUserId(t, user_id, function (err) {
            //清空掉这些cookies
            uutil.clearCookies([
                'tmpt',
                'pwd_hash',
                'user_id',
                'dsx_wx_t',//废弃
                'wx_dsx_ticket'
            ], res);
            res.redirect('/dashixiongwx/admin/login');
        });

    });

//测试一下添加好友的情况, 测试结果: 会被redirect到微信下载而不是关注
    app.get('/dashixiongwx/follow', function (req, res) {
        res.redirect('http://weixin.qq.com/r/iHUvNxfEREo7rVNU9yCa');
    });

//每日进店客户的明细
    app.get('/dashixiongwx/admin/shop/:shop_id/visitor/detail/:y/:m/:d',
        middleware_power.worker,
        function (req, res) {
            var y = req.params.y;
            var m = req.params.m;
            var d = req.params.d;
            var dt = new Date();
            var shop_id = req.params.shop_id;

            dt.setFullYear(y - 0);
            dt.setMonth(m - 0 - 1);
            dt.setDate(d - 0);
            //---------------------- 获取y-m-d这一天的时间戳起点和终点 -----------------------//
            var obj = dashixiong.getDateStartAndEndTimeStamp(y, m, d);
            // -------------------------------------------------------------------------------//

            dashixiong.getVisitorDetails(shop_id, obj.time_stamp_start, obj.time_stamp_end, function (err, visitors, visitors_distinct, obj_counts) {

                var pre_date = dashixiong.getDates(dt.getTime()).pre;
                var next_date = dashixiong.getDates(dt.getTime()).next;
                render(req, res, 'admin/visitor_list', {
                    layout: 'admin/layout',
                    y: y,
                    m: m,
                    d: d,
                    pre_date_y: pre_date.getFullYear(),
                    pre_date_m: pre_date.getMonth() + 1,
                    pre_date_d: pre_date.getDate(),

                    next_date_y: next_date.getFullYear(),
                    next_date_m: next_date.getMonth() + 1,
                    next_date_d: next_date.getDate(),
                    visitors: visitors,
                    visitors_distinct: visitors_distinct,
                    obj_counts: obj_counts
                });

            });

        });

//ajax接口, 获取某一天的业绩概要数据
    app.get('/dashixiongwx/admin/shop/:shop_id/resume/:y/:m/:d',
        middleware_power.shopkeeper,
        function (req, res) {
            var y = req.params.y;
            var m = req.params.m;
            var d = req.params.d;

            dashixiong.getResumeOfDate(y, m, d, function (err, obj) {
                obj.y = y;
                obj.m = m;
                obj.d = d;
                end(res, obj);
            });

        });

//显示最近nums_of_day某产品的销量
    app.get('/dashixiongwx/admin/shop/:shop_id/product/:p_id/trend/:nums_of_day',
        middleware_power.shopkeeper,
        function (req, res) {
            var p_id = req.params.p_id;
            var num = req.params.nums_of_day - 0;

            var timestamp = uutil.getTimeStampDaysBefore(num);
            var obj = uutil.getDateStartAndEndTimeStamp(timestamp);

            //获取num 天前到现在的所有订单, 然后从这些订单中统计某产品的销售数据
            dashixiong.listValidOrders(req.params.shop_id, obj.time_stamp_start, new Date().getTime(), 0, function (err, orders) {
                var ret = [];
                var snapshot;
                //挨个订单看看他们都买了什么
                orders.forEach(function (order, i) {
                    try {
                        snapshot = JSON.parse(order.snapshot);
                        snapshot.products_bought.forEach(function (product, i) {
                            if (product.id == p_id - 0) {//在这个订单中看到目标产品, 记下来
                                ret.push({
                                    time_stamp: order.timeStamp,
                                    count: product.count
                                });
                            }
                        });
                    } catch (e) {
                    }
                });

                //统计每一天, 这个产品的销量
                var map = {};
                var label_date = null;
                ret.forEach(function (v, i) {
                    label_date = new Date(v.time_stamp).format('mm-dd');
                    if (!map[ label_date ]) {
                        map[ label_date ] = {
                            label: label_date,
                            num: 0
                        }
                    }
                    map[ label_date ].num += v.count;
                });

                var data_obj = [];
                for (p in map) {
                    data_obj.push(map[p]);
                }
                //按照时间先后排序
                data_obj.sort(function (a, b) {
                    if (a.label > b.label)return 1;
                    if (a.label < b.label)return -1;
                });


                //---------------- 按照图标插件的格式, 组织一下数据 -------------------//
                var labels = [];
                var nums = [];
                data_obj.forEach(function (v, i) {
                    labels.push(v.label);
                    nums.push(v.num);
                });

                //好, 终于可以渲染页面了
                render(req, res, 'admin/product_trend', {
                    layout: 'admin/layout',
                    labels: labels,
                    nums: nums,
                    day_num: num
                });


            });

        });

//=======排行榜利润排序=======
    app.get('/dashixiongwx/admin/shop/:shop_id/product/sold/:y/:m/:d/sort',
        middleware_power.shopkeeper,
        function(req, res){
            var sortRole = req.query.sortRole;
            if(sortRole == 1) {
                sortRoleTemp = sortRole;
                res.end('success');
            } else if(sortRole == 2){
                sortRoleTemp = sortRole;
                res.end('success');
            } else {
                return;
            }
        });

//====================================================================================================查看某天销售的产品
    app.get('/dashixiongwx/admin/shop/:shop_id/product/sold/:y/:m/:d',
        middleware_power.shopkeeper,
        function (req, res) {
            var y = req.params.y;
            var m = req.params.m;
            var d = req.params.d;
            var dt = new Date();
            var shop_id = req.params.shop_id;
            var daylimit = req.query.daylimit;

            //---------------------- 繁琐的时间设置 -----------------------//
            if (y && m && d) {
                dt.setFullYear(y - 0);
                dt.setMonth(m - 0 - 1);
                dt.setDate(d - 0);

            } else {
                y = dt.getFullYear();
                m = dt.getMonth() + 1;
                d = dt.getDate();
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

            if (daylimit) {//如果需要查看n天前到现在的产品销售量以及业绩, daylimit就会有值
                time_stamp_start = uutil.getTimeStampDaysBefore(daylimit - 0);
            }
            // ---------------------- end时间设置 ------------------------------//

            //如果手动指定区间
            if( req.query.start_time && req.query.end_time ){
                var ts = uutil.getTimeStamp(req.query.start_time, req.query.end_time);
                time_stamp_start = ts.start;
                time_stamp_end = ts.end;
            }

            if( time_stamp_start == undefined && time_stamp_end == undefined ){
                time_stamp_start = 0;
                time_stamp_end = 0;
            }
            var a = new asyncMgr.AsyncOrder();
            a.myTurn(function () {//先将本店的产品信息读出来
                dashixiong.listProducts(req.params.shop_id, function (err, ret) {
                    if (err)ret = [];
                    a.next(ret);
                });
            }).myTurn(function (ary_products_info) {

                dashixiong.listValidOrders(shop_id, time_stamp_start, time_stamp_end, 0, function (err, orders) {
                    if (!err) {
                        var all_products_sold = [];
                        //检查每一个
                        var products = null;
                        var snapshot = null;
                        var test_ary = [];
                        var actual_income = 0;//利润排行榜中的实际收入
                        //=========================================zed========================================
                        orders.forEach(function (order, i) {
                            var pids_ary = JSON.parse(order.productIds),
                                id_str;
                            var ids_ary = [];
                            //pids_ary = [2122, '2121+2130'] => [2122, 2121, 2130];
                            pids_ary.forEach(function(v, i){
                                if( typeof v == 'number'){   //如果数组的元素的类型是数字直接加入ids_ary数组
                                    ids_ary.push(v);
                                    return;
                                }
                                var tmp_ary = v.split('+'); //如果是字符串，1:以“+”分割成子字符串入数组【'1212'.'2327','6589'】
                                tmp_ary.forEach(function(v2, i2){ //循环将子数组的元素的类型转换成数字
                                    ids_ary.push(v2-0);
                                });
                            });
                            //=========================================zed========================================
                            products = dashixiong.getProductsWithIds(ids_ary, ary_products_info);//products内的产品现在是具体的product对象
                            try {
                                snapshot = JSON.parse(order.snapshot);
                                //利润排行榜中的实际收入
                                if(snapshot.actual_income){
                                    actual_income += snapshot.actual_income;
                                }
                            } catch (e) {
                                return;
                            }
                            dashixiong.recoverProductsFromSnapshot(products, snapshot);//从snapshot里获取当时的价格和当时成本
                            all_products_sold = all_products_sold.concat(products);
                        });

                        var total = dashixiong.countTotal(all_products_sold);
                        var totalCount=0;
                        total.list.forEach(function (product_type, i) {
                            var price = product_type.promotePrice || product_type.price;
                            product_type.profit = (price - product_type.cost) * product_type.set.length;
                            product_type.profit = product_type.profit.toFixed(1) - 0;
                            totalCount +=  product_type.set.length;
                        });
                        //----------------- 数量从高到低排序,之前是按照profit排序，但好像没什么用 --------------------- //
                        var price_a;
                        var price_b;
                        if(sortRoleTemp == 1) {
                            //货架排序
                            total.list.sort(function (a_product_type, b_product_type) {
                                return  a_product_type.sid - b_product_type.sid;
                            });

                            //同一货架上的产品，按数量排序
                            for(var i= 0,len = total.list.length;i<len;i++){
                                for(var j= 0,len = total.list.length;j<len;j++){
                                    if(total.list[i].sid==total.list[j].sid&&total.list[i].count>total.list[j].count){
                                        var t = total.list[i];
                                        total.list[i] = total.list[j];
                                        total.list[j] = t;
                                    }
                                }
                            };

                            var total_sold = 0;
                            var total_profit = 0;
                            var _temp  = {};
                            var ratearry = [];
                            var tlen = total.list.length;
                            var finalrate = 0;
                            if(tlen!=0){
                                var mark = total.list[tlen-1].sid;
                            }

                            for(var i= 0,len = total.list.length;i<len;i++){
                                //计算每个产品的利率，利润/售价=利率 利润=成交价-成本
                                var senction_arry = total.list[i];
                                var Profit = senction_arry.price_deal - senction_arry.cost;
                                var rate = (Profit/senction_arry.price_deal)*100;
                                total.list[i].rate = rate.toFixed(2);//将每个产品的利率挂载在产品上

                                //计算总的毛利率
                                if(_temp.sid){
                                    if (total.list[i].sid != _temp.sid) {
                                        total.list[i].srate = ((total_profit / total_sold) * 100).toFixed(2);
                                        total_profit = 0;
                                        total_sold = 0;
                                    }
                                    total_profit += (total.list[i].price_deal - total.list[i].cost) * total.list[i].count;//总利润
                                    total_sold += total.list[i].price_deal * total.list[i].count;//总售价
                                }
                                _temp = total.list[i];
                                if(total.list[i].sid  == mark){
                                    total_profit += (total.list[i].price_deal - total.list[i].cost) * total.list[i].count;//总利润
                                    total_sold += total.list[i].price_deal * total.list[i].count;//总售价
                                    finalrate = ((total_profit / total_sold) * 100).toFixed(2);
                                }
                            }
                            //拼的一个完整数组
                            for(var i= 0,len = total.list.length;i<len;i++){
                                if(total.list[i].srate){
                                    var sid = total.list[i-1].sid;
                                    var obj = {};
                                    obj[sid] = total.list[i].srate;
                                    ratearry.push(obj);
                                }
                                if(total.list[i].sid  == mark){
                                    total.list[i].srate = finalrate;
                                }
                            }
                            var tempobj = {};
                            tempobj[mark] = finalrate;
                            ratearry.push(tempobj);
                            //定义一个map,将数组转换成对象{1:2,3:4,5:6}
                            var tempMap = {};
                            ratearry.forEach(function(v,i){
                                for(p in v){
                                    if(!tempMap[p]){tempMap[p] = v[p]}
                                }
                            });
                            //对像取key
                            total.list.forEach(function(v,i){
                                for(p in tempMap){
                                    if(v.sid == p){
                                        v.srate = tempMap[v.sid];
                                    }
                                }
                            });

                        }else if(sortRoleTemp == 2){
                            total.list.sort(function (a_product_type, b_product_type) {
                                return  b_product_type.profit - a_product_type.profit;
                            });
                        }
                        /*total.list.sort(function (a_product_type, b_product_type) {
                         return  b_product_type.count - a_product_type.count;
                         });*/


                        //---------------------------------------------------------//
                        var pre_date = dashixiong.getDates(dt.getTime()).pre;
                        var next_date = dashixiong.getDates(dt.getTime()).next;
                        render(req, res, 'admin/products_sold', {
                            layout: 'admin/layout',
                            total: total,
                            Count:totalCount,
                            y: y,
                            m: m,
                            d: d,
                            start_time : req.query.start_time,
                            end_time : req.query.end_time,
                            pre_date_y: pre_date.getFullYear(),
                            pre_date_m: pre_date.getMonth() + 1,
                            pre_date_d: pre_date.getDate(),

                            next_date_y: next_date.getFullYear(),
                            next_date_m: next_date.getMonth() + 1,
                            next_date_d: next_date.getDate(),

                            daylimit: daylimit,
                            actual_income: actual_income
                        });

                    }
                });//end dashixiong.listValidOrders
            }).go();
        });



    //查看来自所有店铺已取消的订单@wuyong
    var getListCanceledOrdersHandler = function (template_name, group_by_section_id) {
        template_name = template_name || 'admin/list_canceled_orders';
        return function (req, res) {
            console.log('================================================================================================= getListOrdersHandler');
            console.log('url= ' + req.originalUrl);
            var t_start = new Date().getTime();
            var type = req.query.type;
            var y = req.query.y;
            var m = req.query.m;
            var d = req.query.d;
            var user_id = req.query.user_id;
            var shop_id = req.params.shop_id,
                section_id = req.params.section_id;
            var power = req.query.p;
            var dt = new Date();
            var isToady = false;

            var dt_one_day_before;
            var resume_yestoday = null;
            var dayIds = [];
            var dayTempIds = [];

            //如果权限小于3，则只能看到属于自己铺位的订单
            if( req.user && req.user.power < 3 ) section_id = req.user.sectionId;

            //---------------------- 繁琐的时间设置 -----------------------//
            if (y && m && d) {
                dt.setFullYear(y - 0);
                dt.setMonth(m - 0 - 1);
                dt.setDate(d - 0);

            } else {
                y = dt.getFullYear();
                m = dt.getMonth() + 1;
                d = dt.getDate();
            }

            isToady = uutil.isToady(dt);//判断一下数据是不是今天的, 如果不是今天的, 就没有必要显示昨天的数据了

            //从0点开始
            dt.setHours(0);
            dt.setMinutes(0);
            dt.setSeconds(0);

            var time_stamp_start = dt.getTime();
            console.log('time start = ');
            console.log(time_stamp_start);
            dt.setHours(23);
            dt.setMinutes(59);
            dt.setSeconds(59);
            var time_stamp_end = dt.getTime();
            // ---------------------- end时间设置 ------------------------------//
            var pre_date = dashixiong.getDates(dt.getTime()).pre;//前一天
            var next_date = dashixiong.getDates(dt.getTime()).next;//后一天

            var orders = [];
            var user_is_new_map = {};
            var user_order_num_map = {};//记录用户最近的一个订单的id, 用来判断用户是否是新客户
            var visitor_count = 0;
            var todos = [];

            var a = new asyncMgr.AsyncAction();
            a.register('get_orders');
            a.register('get_logs');
            a.register('get_resume_yestoday');
            a.register('get_todos');
            a.onAllDone = function () {
                //计算一下销售额和利润
                var total_in = 0;
                var total_cost = 0;

                orders.forEach(function (order, i) {
                    order.shop_id = order.shopId;
                    order.intime = new Date(order.timeStamp - 0).format('yyyy-mm-dd HH:MM:ss');
                    order.intime_hours = new Date(order.timeStamp - 0).format('HH:MM:ss');
                    order.intime_text2 = order.intime_hours + '(' + uutil.getTimeTxt(order.timeStamp) + ')';
                    order.intime_text = uutil.getTimeTxt(order.timeStamp);//形如 15分钟前
                    order.deta_time = new Date().getTime() - order.timeStamp;
                    //order.isNewClient = user_is_new_map[ order.userId ];
                    order.isNewClient = !!(user_order_num_map[order.userId] == 1);

                    var test_tmp;
                    var test_tmp_order;
                    try {
                        test_tmp_order = order;
                        test_tmp = order.snapshot;
                        //order.snapshot = JSON.parse(order.snapshot);
                        order.snapshot = uutil.strSnapshotToObj(order.snapshot);

                        //把错误的数据改过来
                        order.snapshot.products_bought.forEach(function (product, i) {
                            if (!product.cost) {
                                order.broken = true;
                            }
                        });

                        total_in += order.snapshot.total_pay;
                        total_cost += order.snapshot.total_cost;
                    } catch (e) {
                        ld.debug('=====================出现错误,错误的订单信息是========================= ');
                        console.log(test_tmp);
                        console.log(test_tmp_order);
                        ld.debug('======================================================================= ');
                    }
                });

                var t_end = new Date().getTime();
                var t_deta = t_end - t_start;
                uutil.printTime(t_start, '业绩查询 总体耗时');
                render(req, res, template_name, {
                    layout: 'admin/layout',
                    //订单集合
                    orders: orders,
                    type: type,
                    y: y,
                    m: m,
                    d: d,
                    section_id : section_id || 0,
                    isToady: isToady,//拼错了, 懒得改...
                    isToday: isToady,
                    pre_date_y: pre_date.getFullYear(),
                    pre_date_m: pre_date.getMonth() + 1,
                    pre_date_d: pre_date.getDate(),

                    next_date_y: next_date.getFullYear(),
                    next_date_m: next_date.getMonth() + 1,
                    next_date_d: next_date.getDate(),

                    //总收入
                    total_in: total_in,

                    //总成本
                    total_cost: total_cost,

                    //利润率
                    profit_rate: dashixiong.comput_profit_rate(total_in, total_cost) + '%',

                    //今日到店顾客总数
//                    visitor_count: visitor_count,
                    visitor_count: dayTempIds.length,

                    //昨天业绩概括
                    resume_yestoday: resume_yestoday,

                    //星期几
                    xingqi: uutil.getChineseDay(dt),

                    //待办事宜
                    todos: todos,
                    //导航标识
                    order_list: 'ui-state-active',

                    //客服对用户的备注
                    comments_map: this.comments_map || {},

                    //用户最近的一个order id, 有助于判断客户是不是新客户
                    user_order_num_map: user_order_num_map
                });
            };

            console.log(pre_date.getFullYear(), pre_date.getMonth() + 1, pre_date.getDate());

            //获取昨天业绩的概要数据
            dashixiong.getResumeOfDate(shop_id, pre_date.getFullYear(), pre_date.getMonth() + 1, pre_date.getDate(), function (err, obj) {
                uutil.printTime(t_start, '获取昨日概况 耗时');
                //obj = JSON.parse( obj[0].dataStr );
                //obj.total_in -= 0;
                if (!err) {
                    obj.time_of_data = pre_date.format('yyyy-mm-dd HH:MM:ss');
                    resume_yestoday = obj;
                    //console.log( resume_yestoday );
                }
                a.thisDone('get_resume_yestoday');
            });

            //获取待办事宜Todo
            dashixiong.getTodos(shop_id, function (err, _todos) {
                uutil.printTime(t_start, '获取待办事宜 耗时');
                if (!err) {
                    todos = _todos;
                    todos.forEach(function (todo) {
                        todo.intime_text = uutil.getTimeTxt(todo.timeStamp);
                    });
                }
                a.thisDone('get_todos');
            });

            //获取某天某店到店的用户ID
            dashixiong.getUserIds(shop_id, time_stamp_start, time_stamp_end, function (err, _ids) {
                if(!err) {
                    for(var i=0;i<_ids.length;i++) {
                        var idArray = _ids[i].lValue.split('___');
                        dayIds.push(parseInt(idArray[0]));//某天到店用户ids
                    }
                }
                dashixiong.getPowerByUserId(dayIds, shop_id, function(err, _powers) {
                    if (!err && _powers) {
                        _powers.forEach(function (doEle, i) {
                            if ( doEle.power == 0 ) {
                                dayTempIds.push(doEle.id);//power为0的用户ids
                            }
                        });
                    }
                    a.thisDone('get_logs');
                });
            });

            /*dashixiong.getVisitorCount(shop_id, time_stamp_start, time_stamp_end, function (err, _count) {
                uutil.printTime(t_start, '获取访客数 耗时');
                if (!err) {
                    visitor_count = _count;
                }
                a.thisDone('get_logs');
            });*/

            //查看来自所有店铺已取消的订单@wuyong
            dashixiong.listCanceledOrders(shop_id, time_stamp_start, time_stamp_end, 0, section_id, function (err, _orders) {
                uutil.printTime(t_start, '获取订单 耗时');
                if (!err) {
                    orders = _orders;
                    var user_ids = [];
                    orders.forEach(function (order, i) {
                        user_ids.push(order.userId);
                    });
                    var aa = new asyncMgr.AsyncAction();
                    aa.register('get_orders_get_users_comment');//获取客服对用户的备注信息



                    //aa.register('get_users_order_nums');


                    aa.onAllDone = function () {
                        a.comments_map = this.comments_map;//comments的数据最后需要在页面上显示, 因此在这里将comments的引用传递给上一级的 AsyncAction 实例 a
                        a.thisDone('get_orders');
                    };

                    //获取user_ids 里的用的最近的一个订单id. 主要是用来判断用户是否为新客户. 如果最近一个订单id是listValidOrders返回的那个订单的id, 就说明这个客户是新客户
                    /*
                     dashixiong.getOrderNumOfUsers({user_ids:user_ids}, function (err, objs) {
                     if (objs) {
                     objs.forEach(function (obj, i) {
                     user_order_num_map[ obj.userId ] = obj.orderNum;
                     });
                     }
                     aa.thisDone('get_users_order_nums');
                     });
                     */



                    //利用user_ids获取客服对用户的备注, 以便配货/送货人员更个性化服务我们的客户
                    admin.listUsersComments(user_ids, function (err, comments) {
                        if (!err) {
                            var comments_map = {};
                            //好好把每一个客户的备注按照userId分类
                            comments.forEach(function (comment) {
                                if (!comments_map[ comment.userId ]) {
                                    comments_map[ comment.userId ] = [];
                                }
                                comment.timeTxt = uutil.getTimeTxt(comment.timeStamp);
                                comments_map[ comment.userId ].push(comment);
                            });
                            aa.comments_map = comments_map;
                        }
                        aa.thisDone('get_orders_get_users_comment');
                    });

                    return;
                }
                a.thisDone('get_orders');
            });

        };
    }

    //查看来自所有店铺未确认的订单---------------zed
    var getListUnconfirmOrdersHandler = function (template_name, group_by_section_id) {
        template_name = template_name || 'admin/list_unconfirmed_orders';
        return function (req, res) {
            console.log('================================================================================================= getListOrdersHandler');
            console.log('url= ' + req.originalUrl);
            var t_start = new Date().getTime();
            var type = req.query.type;
            var y = req.query.y;
            var m = req.query.m;
            var d = req.query.d;
            var user_id = req.query.user_id;
            var shop_id = req.params.shop_id,
                section_id = req.params.section_id;
            var power = req.query.p;
            var dt = new Date();
            var isToady = false;

            var dt_one_day_before;
            var resume_yestoday = null;
            var dayIds = [];
            var dayTempIds = [];

            //如果权限小于3，则只能看到属于自己铺位的订单
            if( req.user && req.user.power < 3 ) section_id = req.user.sectionId;

            //---------------------- 繁琐的时间设置 -----------------------//
            if (y && m && d) {
                dt.setFullYear(y - 0);
                dt.setMonth(m - 0 - 1);
                dt.setDate(d - 0);

            } else {
                y = dt.getFullYear();
                m = dt.getMonth() + 1;
                d = dt.getDate();
            }

            isToady = uutil.isToady(dt);//判断一下数据是不是今天的, 如果不是今天的, 就没有必要显示昨天的数据了

            //从0点开始
            dt.setHours(0);
            dt.setMinutes(0);
            dt.setSeconds(0);

            var time_stamp_start = dt.getTime();
            dt.setHours(23);
            dt.setMinutes(59);
            dt.setSeconds(59);
            var time_stamp_end = dt.getTime();
            // ---------------------- end时间设置 ------------------------------//
            var pre_date = dashixiong.getDates(dt.getTime()).pre;//前一天
            var next_date = dashixiong.getDates(dt.getTime()).next;//后一天

            var orders = [];
            var user_is_new_map = {};
            var user_order_num_map = {};//记录用户最近的一个订单的id, 用来判断用户是否是新客户
            var visitor_count = 0;
            var todos = [];
            var a = new asyncMgr.AsyncAction();
            a.register('get_orders');
            a.register('get_logs');
            a.register('get_resume_yestoday');
            a.register('get_todos');

            a.onAllDone = function () {
                //计算一下销售额和利润
                var total_in = 0;
                var total_cost = 0;

                orders.forEach(function (order, i) {
                    order.shop_id = order.shopId;
                    order.intime = new Date(order.timeStamp - 0).format('yyyy-mm-dd HH:MM:ss');
                    order.intime_hours = new Date(order.timeStamp - 0).format('HH:MM:ss');
                    order.intime_text2 = order.intime_hours + '(' + uutil.getTimeTxt(order.timeStamp) + ')';
                    order.intime_text = uutil.getTimeTxt(order.timeStamp);//形如 15分钟前
                    order.deta_time = new Date().getTime() - order.timeStamp;
                    //order.isNewClient = user_is_new_map[ order.userId ];
                    order.isNewClient = !!(user_order_num_map[order.userId] == 1);

                    var test_tmp;
                    var test_tmp_order;
                    try {
                        test_tmp_order = order;
                        test_tmp = order.snapshot;
                        //order.snapshot = JSON.parse(order.snapshot);
                        order.snapshot = uutil.strSnapshotToObj(order.snapshot);

                        //把错误的数据改过来
                        order.snapshot.products_bought.forEach(function (product, i) {
                            if (!product.cost) {
                                order.broken = true;
                            }
                        });

                        total_in += order.snapshot.total_pay;
                        total_cost += order.snapshot.total_cost;
                    } catch (e) {
                        ld.debug('=====================出现错误,错误的订单信息是========================= ');
                        console.log(test_tmp);
                        console.log(test_tmp_order);
                        ld.debug('======================================================================= ');
                    }
                });

                var t_end = new Date().getTime();
                var t_deta = t_end - t_start;
                uutil.printTime(t_start, '业绩查询 总体耗时');
                render(req, res, template_name, {
                    layout: 'admin/layout',
                    //订单集合
                    orders: orders,
                    type: type,
                    y: y,
                    m: m,
                    d: d,
                    section_id : section_id || 0,
                    isToady: isToady,//拼错了, 懒得改...
                    isToday: isToady,
                    pre_date_y: pre_date.getFullYear(),
                    pre_date_m: pre_date.getMonth() + 1,
                    pre_date_d: pre_date.getDate(),

                    next_date_y: next_date.getFullYear(),
                    next_date_m: next_date.getMonth() + 1,
                    next_date_d: next_date.getDate(),

                    //总收入
                    total_in: total_in,

                    //总成本
                    total_cost: total_cost,

                    //利润率
                    profit_rate: dashixiong.comput_profit_rate(total_in, total_cost) + '%',

                    //今日到店顾客总数
//                    visitor_count: visitor_count,
                    visitor_count: dayTempIds.length,

                    //昨天业绩概括
                    resume_yestoday: resume_yestoday,

                    //星期几
                    xingqi: uutil.getChineseDay(dt),

                    //待办事宜
                    todos: todos,
                    //导航标识
                    order_list: 'ui-state-active',

                    //客服对用户的备注
                    comments_map: this.comments_map || {},

                    //用户最近的一个order id, 有助于判断客户是不是新客户
                    user_order_num_map: user_order_num_map

                });
            };

            console.log(pre_date.getFullYear(), pre_date.getMonth() + 1, pre_date.getDate());
            //获取昨天业绩的概要数据
            dashixiong.getResumeOfDate(shop_id, pre_date.getFullYear(), pre_date.getMonth() + 1, pre_date.getDate(), function (err, obj) {
                uutil.printTime(t_start, '获取昨日概况 耗时');
                //obj = JSON.parse( obj[0].dataStr );
                //obj.total_in -= 0;
                if (!err) {
                    obj.time_of_data = pre_date.format('yyyy-mm-dd HH:MM:ss');
                    resume_yestoday = obj;
                    //console.log( resume_yestoday );
                }
                a.thisDone('get_resume_yestoday');
            });

            //获取待办事宜Todo
            dashixiong.getTodos(shop_id, function (err, _todos) {
                uutil.printTime(t_start, '获取待办事宜 耗时');
                if (!err) {
                    todos = _todos;
                    todos.forEach(function (todo) {
                        todo.intime_text = uutil.getTimeTxt(todo.timeStamp);
                    });
                }
                a.thisDone('get_todos');
            });

            //获取某天某店到店的用户ID
            dashixiong.getUserIds(shop_id, time_stamp_start, time_stamp_end, function (err, _ids) {
                if(!err) {
                    for(var i=0;i<_ids.length;i++) {
                        var idArray = _ids[i].lValue.split('___');
                        dayIds.push(parseInt(idArray[0]));//某天到店用户ids
                    }
                }
                dashixiong.getPowerByUserId(dayIds, shop_id, function(err, _powers) {
                    if (!err && _powers) {
                        _powers.forEach(function (doEle, i) {
                            if ( doEle.power == 0 ) {
                                dayTempIds.push(doEle.id);//power为0的用户ids
                            }
                        });
                    }
                    a.thisDone('get_logs');
                });
            });

            /*dashixiong.getVisitorCount(shop_id, time_stamp_start, time_stamp_end, function (err, _count) {
                uutil.printTime(t_start, '获取访客数 耗时');
                if (!err) {
                    visitor_count = _count;
                }
                a.thisDone('get_logs');
            });*/

            //查看来自所有店铺未确认的订单---------------zed
            dashixiong.listValidUnconfirmOrders(shop_id, time_stamp_start, time_stamp_end, 0, section_id, function (err, _orders) {
                uutil.printTime(t_start, '获取订单 耗时');
                if (!err) {
                    orders = _orders;
                    var user_ids = [];
                    var section_names = [];
                    orders.forEach(function (order, i) {
                        user_ids.push(order.userId);
                    });
                    /*orders.forEach(function (order, i) {
                     section_names.push(order.name);
                     });*/


                    var aa = new asyncMgr.AsyncAction();
                    aa.register('get_orders_get_users_comment');//获取客服对用户的备注信息
                    //aa.register('get_users_order_nums');
                    aa.onAllDone = function () {
                        a.comments_map = this.comments_map;//comments的数据最后需要在页面上显示, 因此在这里将comments的引用传递给上一级的 AsyncAction 实例 a
                        a.thisDone('get_orders');
                    };

                    //获取user_ids 里的用的最近的一个订单id. 主要是用来判断用户是否为新客户. 如果最近一个订单id是listValidOrders返回的那个订单的id, 就说明这个客户是新客户
                    /*
                     dashixiong.getOrderNumOfUsers({user_ids:user_ids}, function (err, objs) {
                     if (objs) {
                     objs.forEach(function (obj, i) {
                     user_order_num_map[ obj.userId ] = obj.orderNum;
                     });
                     }
                     aa.thisDone('get_users_order_nums');
                     });
                     */

                    //利用user_ids获取客服对用户的备注, 以便配货/送货人员更个性化服务我们的客户
                    admin.listUsersComments(user_ids, function (err, comments) {
                        if (!err) {
                            var comments_map = {};
                            //好好把每一个客户的备注按照userId分类
                            comments.forEach(function (comment) {
                                if (!comments_map[ comment.userId ]) {
                                    comments_map[ comment.userId ] = [];
                                }
                                comment.timeTxt = uutil.getTimeTxt(comment.timeStamp);
                                comments_map[ comment.userId ].push(comment);
                            });
                            aa.comments_map = comments_map;
                        }
                        aa.thisDone('get_orders_get_users_comment');
                    });

                    return;
                }
                a.thisDone('get_orders');
            });

        };
    };
    //管理员查看订单handler
    var getListOrdersHandler = function (template_name, group_by_section_id) {
        template_name = template_name || 'admin/list_orders';
        return function (req, res) {
            console.log('================================================================================================= getListOrdersHandler');
            console.log('url= ' + req.originalUrl);
            var t_start = new Date().getTime();
            var type = req.query.type;
            var y = req.query.y;
            var m = req.query.m;
            var d = req.query.d;
            var user_id = req.query.user_id;
            var shop_id = req.params.shop_id,
                section_id = req.params.section_id;
            var power = req.query.p;
            var dt = new Date();
            var isToady = false;

            var dt_one_day_before;
            var resume_yestoday = null;
            var dayIds = [];//一天到店ids
            var dayTempIds = [];//power为0的用户ids
            var ordersTwo = [];
            var user_visit_len = 0;
            var count1 = [];
            var count2 = [];
            var tmpArr = [];
            var tmpArrays = [];
            var appVisitCount = 0;
            var appOrderNum = 0;
            var appVisitCountPre = 0;
            var appVisitCountNext = 0;
            var appOrderNumPre = 0;
            var appOrderNumNext = 0;

            //如果权限小于3，则只能看到属于自己铺位的订单
            if( req.user && req.user.power < 3 ) section_id = req.user.sectionId;

            //---------------------- 繁琐的时间设置 -----------------------//
            if (y && m && d) {
                dt.setFullYear(y - 0);
                dt.setMonth(m - 0 - 1);
                dt.setDate(d - 0);

            } else {
                y = dt.getFullYear();
                m = dt.getMonth() + 1;
                d = dt.getDate();
            }

            isToady = uutil.isToady(dt);//判断一下数据是不是今天的, 如果不是今天的, 就没有必要显示昨天的数据了

            //从0点开始
            dt.setHours(0);
            dt.setMinutes(0);
            dt.setSeconds(0);

            var time_stamp_start = dt.getTime();
            dt.setHours(23);
            dt.setMinutes(59);
            dt.setSeconds(59);
            var time_stamp_end = dt.getTime();
            // ---------------------- end时间设置 ------------------------------//
            var pre_date = dashixiong.getDates(dt.getTime()).pre;//前一天
            var next_date = dashixiong.getDates(dt.getTime()).next;//后一天

            var orders = [];
            var user_is_new_map = {};
            var user_order_num_map = {};//记录用户最近的一个订单的id, 用来判断用户是否是新客户
            var visitor_count = 0;
            var todos = [];
            var a = new asyncMgr.AsyncAction();
            a.register('get_orders');
            a.register('get_logs');
            a.register('get_resume_yestoday');
            a.register('get_todos');
            a.register('get_orderstwo');
            a.register('get_newuser_visitcount');
            a.register('get_visit_count1');
            a.register('get_visit_count2');
            a.register('get_app_visit_count');
            a.register('get_app_visit_countpre');
            a.register('get_app_visit_countnext');

            a.onAllDone = function () {
                //计算一下销售额和利润
                var total_in = 0;
                var total_cost = 0,
                    actual_income = 0;//实际收入 add by lufeng
                orders.forEach(function (order, i) {
                    order.intime = new Date(order.timeStamp - 0).format('yyyy-mm-dd HH:MM:ss');
                    order.intime_hours = new Date(order.timeStamp - 0).format('HH:MM:ss');
                    order.intime_text2 = order.intime_hours + '(' + uutil.getTimeTxt(order.timeStamp) + ')';
                    order.intime_text = uutil.getTimeTxt(order.timeStamp);//形如 15分钟前
                    order.deta_time = new Date().getTime() - order.timeStamp;
                    //order.isNewClient = user_is_new_map[ order.userId ];
                    order.isNewClient = !!(user_order_num_map[order.userId] == 1);

                    var test_tmp;
                    var test_tmp_order;
                    try {
                        test_tmp_order = order;
                        test_tmp = order.snapshot;
                        //order.snapshot = JSON.parse(order.snapshot);
                        order.snapshot = uutil.strSnapshotToObj(order.snapshot);

                        //把错误的数据改过来
                        order.snapshot.products_bought.forEach(function (product, i) {
                            if (!product.cost) {
                                order.broken = true;
                            }
                        });

                        total_in += order.snapshot.total_pay;
                        total_cost += order.snapshot.total_cost;
                        if(order.snapshot.actual_income){
                            actual_income += order.snapshot.actual_income;
                        }

                        //捕获productIds错误--added by lufeng
                        order.productIds = uutil.strProductIdsToArr(order.productIds);
                    } catch (e) {
                        ld.debug('=====================出现错误,错误的订单信息是========================= ');
                        console.log(test_tmp);
                        console.log(test_tmp_order);
                        ld.debug('======================================================================= ');
                    }
                });
                //统计一天有两个营业时间段的到店数
                if(count1.length>0 && count2.length>0) {
                    tmpArr = count1.concat(count2);
                    for (var i = 0; i < tmpArr.length; i++) {
                        if (tmpArrays.indexOf(tmpArr[i]) == -1) {
                            tmpArrays.push(tmpArr[i]);
                        }
                    }
                    user_visit_len = tmpArrays.length;
                }
                if(appVisitCountPre || appVisitCountNext || appOrderNumPre || appOrderNumNext) {
                    appVisitCount = appVisitCountPre+appVisitCountNext;
                    appOrderNum = appOrderNumPre+appOrderNumNext;
                }

                var t_end = new Date().getTime();
                var t_deta = t_end - t_start;
                uutil.printTime(t_start, '业绩查询 总体耗时');
                render(req, res, template_name, {
                    layout: 'admin/layout',
                    //订单集合
                    orders: orders,
                    ordersTwo: ordersTwo,
                    type: type,
                    y: y,
                    m: m,
                    d: d,
                    section_id : section_id || 0,
                    isToady: isToady,//拼错了, 懒得改...
                    isToday: isToady,
                    pre_date_y: pre_date.getFullYear(),
                    pre_date_m: pre_date.getMonth() + 1,
                    pre_date_d: pre_date.getDate(),

                    next_date_y: next_date.getFullYear(),
                    next_date_m: next_date.getMonth() + 1,
                    next_date_d: next_date.getDate(),

                    //总收入
                    total_in: total_in,

                    //实际收入
                    actual_income: actual_income || 0,

                    //总成本
                    total_cost: total_cost,

                    //利润率
                    profit_rate: dashixiong.comput_profit_rate(total_in, total_cost) + '%',

                    //今日到店顾客总数
//                    visitor_count: visitor_count,
                    visitor_count: dayTempIds.length,
                    //营业时间到店顾客数
                    user_visit_len: user_visit_len || 0,

                    //昨天业绩概括
                    resume_yestoday: resume_yestoday,

                    //星期几
                    xingqi: uutil.getChineseDay(dt),

                    //待办事宜
                    todos: todos,
                    //导航标识
                    order_list: 'ui-state-active',

                    //客服对用户的备注
                    comments_map: this.comments_map || {},

                    //用户最近的一个order id, 有助于判断客户是不是新客户
                    user_order_num_map: user_order_num_map,
                    //app营业时间到店数
                    appVisitCount: appVisitCount,
                    //app下单数
                    appOrderNum: appOrderNum

                });


                //统计功能. 管理员每访问一次这个页面, 就往数据库中插入或更新(upsert)一条当日的业绩统计数据.调用是否成功均不影响实际使用
                dashixiong.upsertResumeOfDate(shop_id, y + '-' + m + '-' + d, {
//                    visitor_count: visitor_count,
                    visitor_count: dayTempIds.length,
                    order_num: orders.length,
                    profit_rate: dashixiong.comput_profit_rate(total_in, total_cost),
                    total_in: total_in.toFixed(1),
                    total_cost: total_cost.toFixed(1)
                }, function (err, ret) {
                    err && console.log(err);
                });
            };

            console.log(pre_date.getFullYear(), pre_date.getMonth() + 1, pre_date.getDate());
            //获取昨天业绩的概要数据
            dashixiong.getResumeOfDate(shop_id, pre_date.getFullYear(), pre_date.getMonth() + 1, pre_date.getDate(), function (err, obj) {
                uutil.printTime(t_start, '获取昨日概况 耗时');
                if (!err) {
                    obj.time_of_data = pre_date.format('yyyy-mm-dd HH:MM:ss');
                    resume_yestoday = obj;
                }
                a.thisDone('get_resume_yestoday');
            });

            //获取待办事宜Todo
            dashixiong.getTodos(shop_id, function (err, _todos) {
                uutil.printTime(t_start, '获取待办事宜 耗时');
                if (!err) {
                    todos = _todos;
                    todos.forEach(function (todo) {
                        todo.intime_text = uutil.getTimeTxt(todo.timeStamp);
                    });
                }
                a.thisDone('get_todos');
            });

            //获取某天某店到店的用户ID
            dashixiong.getUserIds(shop_id, time_stamp_start, time_stamp_end, function (err, _ids) {
                if(!err) {
                    for(var i=0;i<_ids.length;i++) {
                        var idArray = _ids[i].lValue.split('___');
                        dayIds.push(parseInt(idArray[0]));//某天到店用户ids
                    }
                }
                dashixiong.getPowerByUserId(dayIds, shop_id, function(err, _powers) {
                    if (!err && _powers) {
                        _powers.forEach(function (doEle, i) {
                            if ( doEle.power == 0 ) {
                                dayTempIds.push(doEle.id);//power为0的用户ids
                            }
                        });
                    }
                    a.thisDone('get_logs');
                });
            });

            //获取营业时间内的到店数
            dashixiong.getCloseTime(shop_id, function(err, _close){
                console.log('***********get_business_hourse_visitcount_start**********');
                var settingValueStr = '';
                if(err){
                    console.log(err);
                    return;
                }
                _close.forEach(function(doEle, i){
                    settingValueStr = doEle.settingValue;
                });
                //一天当中只有一个时间段营业
                if(settingValueStr.indexOf('|') == -1) {
                    var t = settingValueStr.split(',');
                    var start = t[0];
                    var end = t[1];
                    var start_hours;
                    var start_minutes;
                    var end_hours;
                    var end_minutes;
                    if(start){
                        start_hours = start.substr(0,2)-0;
                        start_minutes = start.substr(2,4)-0;
                    }else{
                        start_hours = 00;
                        start_minutes = 00;
                    }
                    if(end){
                        end_hours = end.substr(0,2);
                        end_minutes = end.substr(2,4);
                    }else{
                        end_hours = 00;
                        end_minutes = 00;
                    }
                    if(end_hours == 24) {
                        end_hours = 23;
                        end_minutes = 59;
                    }
                    var t1 = y+'-'+m+'-'+d+' '+start_hours+':'+start_minutes+':'+'00';
                    var t2 = y+'-'+m+'-'+d+' '+end_hours+':'+end_minutes+':'+'00';
                    var timeStr1 = new Date(t1).getTime();
                    var timeStr2 = new Date(t2).getTime();

                    admin.getYinYeVisCount(shop_id, timeStr1, timeStr2, function(err,ret){
                        if(err){
                            console.log(err);
                            a.thisDone('get_newuser_visitcount');
                            return;
                        }
                        if(ret && ret.length>0) {
                            user_visit_len = ret.length;
                        }
                        a.thisDone('get_newuser_visitcount');
                        return;
                    });
                }else{
                    a.thisDone('get_newuser_visitcount');
                }
                //一天当中有两个时间段营业
                if(settingValueStr.indexOf('|') > 0) {
                    var time = settingValueStr.split('|');
                    var t1 = time[0];//上一段时间
                    var t2 = time[1];//下一段时间

                    var t1Arr = t1.split(',');
                    var t1Arr_start = t1Arr[0];//上一段时间的开始时间
                    var t1Arr_end = t1Arr[1];//上一段时间的结束时间
                    var t1_startTimeStamp = y+'-'+m+'-'+d+' '+t1Arr_start.substr(0,2)+':'+t1Arr_start.substr(2,4)+':'+'00';
                    var t1_endTimeStamp = y+'-'+m+'-'+d+' '+t1Arr_end.substr(0,2)+':'+t1Arr_end.substr(2,4)+':'+'00';
                    var timeStr1 = new Date(t1_startTimeStamp).getTime();//上一段时间的开始时间戳
                    var timeStr2 = new Date(t1_endTimeStamp).getTime();//上一段时间的结束时间戳

                    var t2Arr = t2.split(',');
                    var t2Arr_start = t2Arr[0];//下一段时间的开始时间
                    var t2Arr_end = t2Arr[1];//下一段时间的结束时间
                    var t2_startTimeStamp = y+'-'+m+'-'+d+' '+t2Arr_start.substr(0,2)+':'+t2Arr_start.substr(2,4)+':'+'00';
                    var t2_endTimeStamp = y+'-'+m+'-'+d+' '+t2Arr_end.substr(0,2)+':'+t2Arr_end.substr(2,4)+':'+'00';
                    var timeStr3 = new Date(t2_startTimeStamp).getTime();//下一段时间的开始时间戳
                    var timeStr4 = new Date(t2_endTimeStamp).getTime();//下一段时间的结束时间戳

                    admin.getYinYeVisCount(shop_id, timeStr1, timeStr2,function(err,ret1){
                        if(err){
                            console.log(err);
                            a.thisDone('get_visit_count1');
                            return;
                        }
                        if(ret1 && ret1.length>0) {
                            count1 = ret1;
                        }else{
                            a.thisDone('get_visit_count1');
                        }
                        a.thisDone('get_visit_count1');
                    });
                    admin.getYinYeVisCount(shop_id, timeStr3, timeStr4,function(err,ret2){
                        if(err){
                            console.log(err);
                            a.thisDone('get_visit_count2');
                            return;
                        }
                        if(ret2 && ret2.length>0) {
                            count2 = ret2;
                        }else{
                            a.thisDone('get_visit_count2');
                        }
                        a.thisDone('get_visit_count2');
                    });
                }else{
                    a.thisDone('get_visit_count1');
                    a.thisDone('get_visit_count2');
                }
                console.log('*********get_business_hourse_visitcount_end*********');
            });

            //获取app营业时间到店数和下单数
            admin.getBusinessTime(y, m, d, shop_id, function(err, business_count){
                if(err){
                    console.log(err);
                    end(res, 'get business time err');
                    return;
                }
                if(business_count && business_count.length == 2){
                    var stamp_start = business_count[0];
                    var stamp_end = business_count[1];
                    admin.getAppUserInfo(shop_id, stamp_start, stamp_end, function(err, ret){
                        if(err){
                            console.log(err);
                            a.thisDone('get_app_visit_count');
                            return;
                        }
                        if(ret){
                            appVisitCount = ret.visitcount;
                            appOrderNum = ret.appOrderNum;
                        }
                        a.thisDone('get_app_visit_count');
                    });
                }else{
                    a.thisDone('get_app_visit_count');
                }
                if(business_count && business_count.length == 4){
                    var preStampStart = business_count[0];
                    var preStampEnd = business_count[1];
                    admin.getAppUserInfo(shop_id, preStampStart, preStampEnd, function(err, ret){
                        if(err){
                            console.log(err);
                            a.thisDone('get_app_visit_countpre');
                            return;
                        }
                        if(ret){
                            appVisitCountPre = ret.visitcount;
                            appOrderNumPre = ret.appOrderNum;
                        }
                        a.thisDone('get_app_visit_countpre');
                    });
                    var nextStampStart = business_count[2];
                    var nextStampEnd = business_count[3];
                    admin.getAppUserInfo(shop_id, nextStampStart, nextStampEnd, function(err, ret){
                        if(err){
                            console.log(err);
                            a.thisDone('get_app_visit_countnext');
                            return;
                        }
                        if(ret){
                            appVisitCountNext = ret.visitcount;
                            appOrderNumNext = ret.appOrderNum;
                        }
                        a.thisDone('get_app_visit_countnext');
                    });
                }else{
                    a.thisDone('get_app_visit_countpre');
                    a.thisDone('get_app_visit_countnext');
                }
            });

            /*dashixiong.getVisitorCount(shop_id, time_stamp_start, time_stamp_end, function (err, _count) {
                uutil.printTime(t_start, '获取访客数 耗时');
                if (!err) {
                    visitor_count = _count;
                }
                a.thisDone('get_logs');
            });*/

            dashixiong.listValidOrdersTwo(shop_id, time_stamp_start, time_stamp_end, 0, section_id, function (err, _orders) {
                uutil.printTime(t_start, '获取订单 耗时');
                if (!err) {
                    ordersTwo = _orders;
                }
                a.thisDone('get_orderstwo');
            });

            //获取所有人的订单
            dashixiong.listValidOrders(shop_id, time_stamp_start, time_stamp_end, 0, section_id, function (err, _orders) {
                uutil.printTime(t_start, '获取订单 耗时');
                if (!err) {
                    orders = _orders;
                    var user_ids = [];
                    orders.forEach(function (order, i) {
                        user_ids.push(order.userId);
                    });

                    var aa = new asyncMgr.AsyncAction();
                    aa.register('get_orders_get_users_comment');//获取客服对用户的备注信息
                    //aa.register('get_users_order_nums');
                    aa.onAllDone = function () {
                        a.comments_map = this.comments_map;//comments的数据最后需要在页面上显示, 因此在这里将comments的引用传递给上一级的 AsyncAction 实例 a
                        a.thisDone('get_orders');
                    };

                    //获取user_ids 里的用的最近的一个订单id. 主要是用来判断用户是否为新客户. 如果最近一个订单id是listValidOrders返回的那个订单的id, 就说明这个客户是新客户
                    /*
                     dashixiong.getOrderNumOfUsers({user_ids:user_ids}, function (err, objs) {
                     if (objs) {
                     objs.forEach(function (obj, i) {
                     user_order_num_map[ obj.userId ] = obj.orderNum;
                     });
                     }
                     aa.thisDone('get_users_order_nums');
                     });
                     */

                    //利用user_ids获取客服对用户的备注, 以便配货/送货人员更个性化服务我们的客户
                    admin.listUsersComments(user_ids, function (err, comments) {
                        if (!err) {
                            var comments_map = {};
                            //好好把每一个客户的备注按照userId分类
                            comments.forEach(function (comment) {
                                if (!comments_map[ comment.userId ]) {
                                    comments_map[ comment.userId ] = [];
                                }
                                comment.timeTxt = uutil.getTimeTxt(comment.timeStamp);
                                comments_map[ comment.userId ].push(comment);
                            });
                            aa.comments_map = comments_map;
                        }
                        aa.thisDone('get_orders_get_users_comment');
                    });

                    return;
                }
                a.thisDone('get_orders');
            });

        };
    };

    //管理员查看订单handler，最他妈快的一个刷单页了，再出不来，就没救了～已经简化了好多。。。
    var getListOrdersQuickly = function (template_name) {
        template_name = template_name || 'admin/list_orders_quickly';
        return function (req, res) {
            end(res, '');
            ld.debug('handler接收到来自用户的请求!注意看看是不是一刷新页面就有log出现');
            var t_start = new Date().getTime();
            var type = req.query.type;

            var y = req.query.y;
            var m = req.query.m;
            var d = req.query.d;
            var user_id = req.query.user_id;
            var shop_id = req.params.shop_id;
            var power = req.query.p;
            var dt = new Date();
            var isToady = false;

            var dt_one_day_before;
            var resume_yestoday = null;

            //---------------------- 繁琐的时间设置 -----------------------//
            if (y && m && d) {
                dt.setFullYear(y - 0);
                dt.setMonth(m - 0 - 1);
                dt.setDate(d - 0);

            } else {
                y = dt.getFullYear();
                m = dt.getMonth() + 1;
                d = dt.getDate();
            }

            isToady = uutil.isToady(dt);//判断一下数据是不是今天的, 如果不是今天的, 就没有必要显示昨天的数据了

            //从0点开始
            dt.setHours(0);
            dt.setMinutes(0);
            dt.setSeconds(0);

            var time_stamp_start = dt.getTime();
            dt.setHours(23);
            dt.setMinutes(59);
            dt.setSeconds(59);
            var time_stamp_end = dt.getTime();
            // ---------------------- end时间设置 ------------------------------//
            var pre_date = dashixiong.getDates(dt.getTime()).pre;//前一天
            var next_date = dashixiong.getDates(dt.getTime()).next;//后一天

            var orders = [];
            var user_is_new_map = {};
            var user_order_num_map = {};//记录用户最近的一个订单的id, 用来判断用户是否是新客户
            var visitor_count = 0;
            var todos = [];
            var a = new asyncMgr.AsyncAction();
            a.register('get_orders');
            //a.register('get_logs');
            //a.register('get_resume_yestoday');
            a.register('get_todos');

            a.onAllDone = function () {
                //计算一下销售额和利润
                var total_in = 0;
                var total_cost = 0;
                orders.forEach(function (order, i) {
                    order.intime = new Date(order.timeStamp - 0).format('yyyy-mm-dd HH:MM:ss');
                    order.intime_hours = new Date(order.timeStamp - 0).format('HH:MM:ss');
                    order.intime_text2 = order.intime_hours + '(' + uutil.getTimeTxt(order.timeStamp) + ')';
                    order.intime_text = uutil.getTimeTxt(order.timeStamp);//形如 15分钟前
                    order.deta_time = new Date().getTime() - order.timeStamp;
                    //order.isNewClient = user_is_new_map[ order.userId ];
                    order.isNewClient = ( user_order_num_map[order.userId] == 1 );

                    var test_tmp;
                    var test_tmp_order;
                    try {
                        test_tmp_order = order;
                        test_tmp = order.snapshot;
                        //order.snapshot = JSON.parse(order.snapshot);
                        order.snapshot = uutil.strSnapshotToObj(order.snapshot);

                        //把错误的数据改过来
                        order.snapshot.products_bought.forEach(function (product, i) {
                            if (!product.cost) {
                                order.broken = true;
                            }
                        });

                        total_in += order.snapshot.total_pay;
                        total_cost += order.snapshot.total_cost;
                    } catch (e) {
                        ld.debug('=====================出现错误,错误的订单信息是========================= ');
                        console.log(test_tmp);
                        console.log(test_tmp_order);
                        ld.debug('======================================================================= ');
                    }
                });

                var t_end = new Date().getTime();
                var t_deta = t_end - t_start;
                uutil.printTime(t_start, '业绩查询 总体耗时');
                render(req, res, template_name, {
                    layout: 'admin/layout_quickly',
                    //订单集合
                    orders: orders,
                    type: type,
                    y: y,
                    m: m,
                    d: d,
                    isToady: isToady,//拼错了, 懒得改...
                    isToday: isToady,
                    pre_date_y: pre_date.getFullYear(),
                    pre_date_m: pre_date.getMonth() + 1,
                    pre_date_d: pre_date.getDate(),

                    next_date_y: next_date.getFullYear(),
                    next_date_m: next_date.getMonth() + 1,
                    next_date_d: next_date.getDate(),

                    //总收入
                    total_in: total_in,

                    //总成本
                    total_cost: total_cost,

                    //利润率
                    profit_rate: dashixiong.comput_profit_rate(total_in, total_cost) + '%',

                    //今日到店顾客总数
                    visitor_count: visitor_count,

                    //昨天业绩概括
                    resume_yestoday: resume_yestoday,

                    //星期几
                    xingqi: uutil.getChineseDay(dt),

                    //待办事宜
                    todos: todos,
                    //导航标识
                    order_list: 'ui-state-active',

                    //客服对用户的备注
                    comments_map: this.comments_map || {},

                    //用户最近的一个order id, 有助于判断客户是不是新客户
                    user_order_num_map: user_order_num_map

                });

            };


            console.log(pre_date.getFullYear(), pre_date.getMonth() + 1, pre_date.getDate());

            //获取待办事宜Todo
            dashixiong.getTodos(shop_id, function (err, _todos) {
                uutil.printTime(t_start, '获取待办事宜 耗时');
                if (!err) {
                    todos = _todos;
                    todos.forEach(function (todo) {
                        todo.intime_text = uutil.getTimeTxt(todo.timeStamp);
                    });
                }
                a.thisDone('get_todos');
            });


            //获取所有人的订单
            dashixiong.listValidOrdersQuickly(shop_id, time_stamp_start, time_stamp_end, 0, function (err, _orders) {
                uutil.printTime(t_start, '获取订单 耗时');
                if (!err) {
                    orders = _orders;
                    var user_ids = [];
                    orders.forEach(function (order, i) {
                        user_ids.push(order.userId);
                    });

                    var aa = new asyncMgr.AsyncAction();
                    aa.register('get_orders_get_users_comment');//获取客服对用户的备注信息
                    //aa.register('get_users_order_nums');//获取客服对用户的备注信息
                    aa.onAllDone = function () {
                        a.comments_map = this.comments_map;//comments的数据最后需要在页面上显示, 因此在这里将comments的引用传递给上一级的 AsyncAction 实例 a
                        a.thisDone('get_orders');
                    };

                    //获取user_ids 里的用的最近的一个订单id. 主要是用来判断用户是否为新客户. 如果最近一个订单id是listValidOrders返回的那个订单的id, 就说明这个客户是新客户
                    /*
                     dashixiong.getOrderNumOfUsers({user_ids:user_ids}, function (err, objs) {
                     if (objs) {
                     objs.forEach(function (obj, i) {
                     user_order_num_map[ obj.userId ] = obj.orderNum;
                     });
                     }
                     aa.thisDone('get_users_order_nums');
                     });
                     */

                    //利用user_ids获取客服对用户的备注, 以便配货/送货人员更个性化服务我们的客户
                    admin.listUsersComments(user_ids, function (err, comments) {
                        if (!err) {
                            var comments_map = {};
                            //好好把每一个客户的备注按照userId分类
                            comments.forEach(function (comment) {
                                if (!comments_map[ comment.userId ]) {
                                    comments_map[ comment.userId ] = [];
                                }
                                comment.timeTxt = uutil.getTimeTxt(comment.timeStamp);
                                comments_map[ comment.userId ].push(comment);
                            });
                            aa.comments_map = comments_map;
                        }
                        aa.thisDone('get_orders_get_users_comment');
                    });

                    return;
                }
                a.thisDone('get_orders');
            });
        };
    };

    //这个中间是为了确保类似 /shop/数字 才被相应的handler处理, 像 /shop/[String] 类型的路由则由下一个handle处理
    var middle_only_id = function (req, res, next) {
        console.log('========================================================= middle_only_id');
        if (/^[0-9]+$/.test(req.params.shop_id)) {//这种路由是我们需要的
            next();
            return;
        }
        next('route');
    };
    //管理员查看订单
    //史上最快的刷单页面
    app.get('/dashixiongwx/admin/shop/order/list_quickly',
        getListOrdersQuickly());
    app.get('/dashixiongwx/admin/shop/:shop_id',
        middle_only_id,
        middleware_power.parttime_senior,//高级兼职及以上才能查看
        getListOrdersHandler());
    app.get('/dashixiongwx/admin/shop/:shop_id/order/list',
        middleware_power.parttime_senior,//高级兼职及以上才能查看
        getListOrdersHandler());
    //查看来自所有店铺已取消的订单---------------fanxing
    app.get('/dashixiongwx/admin/shop/:shop_id/canceledorder/list',
        middleware_power.parttime_senior,//高级兼职及以上才能查看已取消的订单
        getListCanceledOrdersHandler());

    //查看来自所有店铺未确认的订单---------------zed
    app.get('/dashixiongwx/admin/shop/:shop_id/unconfirmorder/list',
        middleware_power.parttime_senior,//高级兼职及以上才能查看未确认的订单
        getListUnconfirmOrdersHandler());

    //将每个店的订单按照section_id分类
    app.get('/dashixiongwx/admin/shop/:shop_id/:section_id/order/list',
        middleware_power.parttime_senior,//高级兼职及以上才能查看
        getListOrdersHandler(null, true)); //第二个参数表示订单需要按照section_id分类

    //获取用户下单的单数，用于判断是否新用户
    app.post('/dashixiongwx/admin/shop/:shop_id/get/order_nums',
        function(req, res){
            var user_ids = req.query.user_ids || req.body.user_ids,
                user_order_num_map = {},
                y = req.body.y,
                m = req.body.m,
                d = req.body.d;
            user_ids = user_ids || [];
            dashixiong.getOrderNumOfUsers({user_ids:user_ids, y:y, m:m, d:d}, function (err, objs) {
                if (objs) {
                    objs.forEach(function (obj, i) {
                        user_order_num_map[ obj.userId ] = obj.orderNum;
                    });
                }
                user_ids.forEach(function(id, i){
                    if( !user_order_num_map[id] ) user_order_num_map[id] = 0;
                });
                end(res, user_order_num_map);
            });
        });

    app.get('/dashixiongwx/order/list/auscar/temp/check',
        middleware_power.parttime_senior,//高级兼职及以上才能查看
        getListOrdersHandler('admin/list_orders_low_power'));


    //查看订单使用的道具
    app.get('/dashixiongwx/admin/shop/:shop_id/order/:order_id/tool',
        middleware_power.parttime_senior,
        function (req, res) {
            var ids = req.query.ids;
            ids = ids.split(',');
            dashixiong.getUserToolsByIds(ids, function (err, ret) {
                render(req, res, 'admin/order_tool_list', {
                    order_id: req.params.order_id,
                    tools: ret
                });
            });
        });


    app.post('/dashixiongwx/admin/shop/:shop_id/order/commit', middleware_load_products_map, middleware_get_config_of_shop,
        middleware_power.parttime_senior,
        function (req, res) {
            var str_products = req.body.products;
            var products = [];
            var shop_id = req.params.shop_id;
            var user_id = req.cookies.user_id;

            try {
                products = JSON.parse(str_products);
            } catch (e) {

            }

            var order = {
                shop_id: shop_id,
                user_id: user_id,
                address_id: req.config_obj.addressIdSellInShop //这个配置就是说, 使用哪个地址作为本店下单地址
            };

            //---------------- 记录一下买了什么产品 ---------------//
            var ids = [];
            products.forEach(function (product) {
                if (product.count > 1) {
                    for (var i = 0; i < product.count; i++) {
                        ids.push(product.id);
                    }
                    return;
                }
                ids.push(product.id);
            });
            order.product_ids = JSON.stringify(ids);
            //-----------------------------------------------------//

            //----------------- 下单时间可以通过时间戳计算出来 ----//
            order.time_stamp = new Date().getTime();

            //----------------- 生成快照 --------------------------//
            dashixiong.setCostForProducts(products, req.products_map);//获取一下这些产品的成本, 以便生成spanshot. req.products_map 由中间件middleware_load_products_map_of_shop 加载

            var total = dashixiong.countTotal2(products);
            order.snapshot = JSON.stringify(total.snapshot);

            //----------------- 插入订单 ------------------------//
            dashixiong.insertOrder(order, function (err, ret) {
                if (err) {
                    end(res, {
                        code: 1,
                        msg: ' dao error',
                        err: err
                    });
                    return;
                }
                end(res, {
                    code: 0,
                    msg: 'sus'
                });
            });

            var now = new Date();
            y = now.getFullYear();
            m = now.getMonth() + 1;
            d = now.getDate();
            var dts = Date.UTC(y - 0, m - 1, d - 0);

            dashixiong.getResumesOfDate(y, m, d, function(err, ret){
                var all = {
                    visitor_count : 0,
                    order_num : 0,
                    total_in : 0,
                    total_cost : 0
                };
                ret.forEach(function (obj) {
                    if( !obj.dataStr ){
                        obj.resume = {
                            profit_rate : 0,
                            visitor_count : 0,
                            order_num : 0,
                            total_in : 0,
                            total_cost : 0
                        };
                        return;
                    }
                    obj.resume = JSON.parse( obj.dataStr );
                    all.visitor_count += obj.resume.visitor_count;
                    all.order_num += obj.resume.order_num;
                    all.total_in += (obj.resume.total_in-0);
                    all.total_cost += (obj.resume.total_cost-0);
                });
                all.profit = all.total_in - all.total_cost;
                all.profit_rate = all.profit/all.total_in;

                all.total_in = all.total_in.toFixed(1);
                all.total_cost = all.total_cost.toFixed(1);
                all.profit = all.profit.toFixed(1);

                var obj = uutil.getPreDayAndNextDay( dts );//获取前一天和后一天

                //统计功能. 管理员每访问一次这个页面, 就往数据库中插入或更新(upsert)一条当日的业绩统计数据.调用是否成功均不影响实际使用
                dashixiong.upsertResumeOfDate( 0, y+'-'+m+'-'+d, all, function(err, ret){
                    err&&ld.debug(err);
                });

            });


        });
    app.get('/dashixiongwx/admin/shop/add',
        middleware_power.boss,
        function(req, res){
            render(req, res, 'admin/shop_add', {
                layout : 'admin/layout_super'
            });
        });
    app.post('/dashixiongwx/admin/shop/doadd',
        middleware_power.boss,
        function(req, res){
            var shop = req.body.shop;

            dashixiong.insertShop(shop, function(err, ret){
                res.redirect('/dashixiongwx/admin/shop/list/all');
            });

        });
    app.get('/dashixiongwx/admin/shop/:id/edit',
        middleware_power.boss,
        function(req, res){
            var shop_id = req.params.id;

            dashixiong.getShopById(shop_id, function(err, ret){
                render(req, res, 'admin/shop_edit', {
                    layout : true,
                    shop : ret[0]
                });
            });

        });
    app.post('/dashixiongwx/admin/shop/:id/doedit',
        middleware_power.boss,
        function(req, res){
            var shop = req.body.shop;
            dashixiong.updateShop(shop, function(err, ret){
                if(err) console.log(err);
                res.redirect('/dashixiongwx/admin/shop/list/all');
            });

        });


    app.get('/dashixiongwx/admin/shop/:shop_id/order/:id/fix',
        middleware_load_products_map,
        middleware_power.parttime_senior,
        function (req, res) {
            var order_id = req.params.id;

            //获取这个产品的所有的信息
            dashixiong.getOrderById(order_id, function (err, ret) {
                if ((!err) && ret && ret[0]) {
                    var order = ret[0];

                    var products = dashixiong.getProductsWithIds(JSON.parse(order.productIds));
                    dashixiong.setCostForProducts(products, req.products_map);//获取一下这些产品的成本, 以便生成spanshot
                    var total = dashixiong.countTotal(products);//结算一下这个订单

                    var snapshot = JSON.stringify(total.snapshot);//订单快照

                    dashixiong.updateOrderObj({
                        id: order.id,
                        snapshot: snapshot
                    }, function (err, ret) {
                        res.redirect(req.headers.referer);
                    });

                    return;
                }
                res.end('error while getting product info ... ', err);
            });

        });

    //显示订单添加备注
    app.get('/dashixiongwx/admin/shop/:shop_id/order/:order_id/remark',
        middleware_power.parttime_senior,
        function(req, res){
            var order_id = req.params.order_id,
                power = req.user;
            dashixiong.getOrderById(order_id, function (err, ret) {
                if ( !err ){
                    order = sureObj(ret);
                    order.intime = new Date(order.timeStamp).format('yyyy-mm-dd HH:MM');
                    var snapshot = uutil.strSnapshotToObj(order.snapshot);
                    render(req, res, 'admin/product_remark', {
                        snapshot : snapshot,
                        shop_id : req.params.shop_id,
                        order_id : req.params.order_id,
                        power : power
                    });
                    return;
                }
                ld.debug(err);
            });
        });

    //为订单添加或修改备注
    app.post('/dashixiongwx/admin/shop/:shop_id/order/:order_id/remark/doupdate',
        middleware_power.parttime_senior,
        function(req, res){
            var order_id = req.params.order_id,
                shop_id = req.params.shop_id,
                remark = req.body.remark || {};
            admin.setRemarkByRemark(remark, function(err, ret){
                if( !err ){
                    res.redirect('/dashixiongwx/admin/shop/'+ shop_id +'/order/list?type=Valid');
                    return;
                }
                ld.debug(err);
            });
        });

    app.get('/dashixiongwx/admin/shop/:shop_id/order/:order_id/detail',
        middleware_power.parttime_senior,
        function (req, res) {
            var order_id = req.params.order_id;
            var shop_id = req.params.shop_id - 0;
            var order = null;
            var snapshot = null;
            var motto = null;
            var config = {};
            var id = req.query.id;
            var a = new asyncMgr.AsyncAction(),
                isAjax = req.query.isAjax;
            a.register('get_order');
            a.register('get_cur_motto');
            a.register('get_shop_config');
            a.onAllDone = function () {
                var p = {
                    layout: true,
                    order: order,
                    shop_id : shop_id,
                    order_snapshot: snapshot,
                    motto: motto,
                    id : id,
                    config: config
                };

                //格式化一下特殊吩咐，防止注入
                if( snapshot.requirements ){
                    console.log(snapshot.requirements);
                    snapshot.requirements.forEach(function(v, i){
                        console.log(v);
                        snapshot.requirements[i] = uutil.dataFormat(v);
                        console.log(v);
                    });
                }

                var deliver_info = uutil.getDeliverFee(snapshot.products_bought, snapshot.total_pay, shop_id,config);

                dashixiong.getOrderNumByOrderId(order_id, function(err, ret){
                    ret = sureObj(ret);
                    dashixiong.getConfigOfShop(shop_id, function (err_conf, config) {
                        if (err_conf) {
                            ld.debug(err_conf);
                        }
                        config = uutil.settingArrayToObj(config);
                        dashixiong.getShopById(shop_id, function(err, ret){
                            var shop = sureObj(ret),
                                shopType = shop.shopType || 'store',
                                tpl = 'order_detail_' + shopType;
                            if( deliver_info ) {//有跑腿费信息
                                if( (ret.orderNum == 1 && config.payFeeOnFirst == 'no') || config.needToPayFee == 'no' ){ //如果是第一单，并且设置了首单免费，则不收取跑腿费
                                    p.deliver_info = null;
                                }else{
                                    p.deliver_info = deliver_info;
                                    if( shopType != 'restaurant' ){
                                        snapshot.total_pay += deliver_info.price;
                                    }else{
                                        p.deliver_info = null; //餐厅不显示跑腿费
                                    }
                                }
                            }
                            //前台需要的是JSON数据，直接吧数据返回
                            if( isAjax ){
                                end(res, p);
                                return;
                            }
                            //html页面
                            render(req, res, 'admin/'+tpl, p);
                        });
                    });
                });
            };

            dashixiong.getOrderById(order_id, function (err, ret) {
                if (!err && ret) {
                    order = ret[0];
                    order.intime = new Date(order.timeStamp).format('yyyy-mm-dd HH:MM');
                    snapshot = uutil.strSnapshotToObj(order.snapshot);
                    snapshot.products_bought.sort(function (a, b) {
                        return a.section - b.section;
                    });
                }
                a.thisDone('get_order');
            });

            dashixiong.getCurMotto(shop_id, function (err, _motto) {
                if (!err) {
                    motto = _motto;
                }
                a.thisDone('get_cur_motto');
            });

            dashixiong.getConfigOfShop(shop_id, function (err, ret) {
                if (err) {
                    ld.debug(err);
                } else {
                    config = uutil.settingArrayToObj(ret);
                }
                a.thisDone('get_shop_config');
            });


        });

    app.get('/dashixiongwx/admin/shop/:shop_id/order/list/:user_id',
        middleware_power.parttime_senior,
        function (req, res) {
            res.redirect(req.path + '看不到名字,请跟技术联系');
        });

//管理员查看某个用户的订单
    app.get('/dashixiongwx/admin/shop/:shop_id/order/list/:user_id/:user_name',
        middleware_power.parttime_senior,
        function (req, res) {
            var user_id = req.params.user_id;
            var user_name = req.params.user_name;
            var total_in = 0;
            var total_cost = 0,
                id = req.body.id-0,
                shop_id = req.params.shop_id;
            dashixiong.listUserValidOrders(user_id, shop_id, 0, function (err, _orders) {
                _orders.forEach(function (order, i) {

                    if (order.id == 54797) {
                        console.log(order);
                    }

                    order.intime = new Date(order.timeStamp - 0).format('yyyy-mm-dd HH:MM:ss');
                    order.timeTxt = dashixiong.getTimeTxt(order.timeStamp - 0);
                    order.snapshot = uutil.strSnapshotToObj(order.snapshot);

                    total_in += order.snapshot.total_pay;
                    total_cost += order.snapshot.total_cost;
                });
                if (!err) {
                    render(req, res, 'admin/list_user_orders', {
                        layout: true,
                        orders: _orders,
                        user_id: user_id,
                        user_name: user_name,
                        total_in: total_in,
                        total_cost: total_cost,
                        profit_rate: dashixiong.comput_profit_rate(total_in, total_cost)
                    });
                    return;
                }
                endErr(res, err);
            });

        });

//这个是一个ajax的接口
    app.get('/dashixiongwx/admin/shop/:shop_id/order/:order_id/status/update/:status_code',
        middleware_power.parttime_senior,
        function (req, res) {
            var order_id = req.params.order_id;
            var status_code = req.params.status_code;

            dashixiong.updateOrderStatus(order_id, status_code, function (err, ret) {
                if (!err) {
                    //算是更新成功了
                    res.end(JSON.stringify({
                        code: 0,
                        msg: 'sus'
                    }));
                    return;
                }
                ld.debug(err);
                res.end(JSON.stringify({
                    code: 1,
                    msg: err
                }));
            });

        });
    //ajax接口, 取消订单
    app.get('/dashixiongwx/admin/shop/:shop_id/order/:order_id/cancel', get_shop_info_middleware,
        middleware_power.parttime_senior,//取消订单, 那可是不见钱的操作呀, 肯定要店长以上才能操作
        function (req, res) {
            var order_id = req.params.order_id;
            var shop = req.shop;

            dashixiong.cancelOrder(order_id, shop.conf.curWarehouseId, function (err, ret) {
                if (!err) {
                    end(res, {
                        code: 0,
                        msg: 'sus'
                    });
                    return;
                }
                err.code = -1;
                endErr(res, err);
            });
        });


    app.get('/dashixiongwx/admin/shop/:shop_id/product/add',
        middleware_power.worker,
        function (req, res) {
            render(req, res, 'admin/product_add', {
                layout: true
            });
        });

    app.post('/dashixiongwx/admin/shop/:shop_id/product/:id/updateimg',
        //middleware_power.worker,  //TODO: 这个请求是没有经过UserAuth 检测的, 原因是formidable经过中间件会有bug
        function (req, res) {
            console.log('=========handler');
            var id = req.params.id;
            //formidable获取整个产品数据，包括图片

            var dir = '/home/uploads/dashixiong/products/HDP/',
                HDDir = '/home/uploads/dashixiong/products/';
            if ( uutil.isInDevelopment() ) {//开发环境如果是MacOS, 竟然叫做'darwin'
                dir = '/home/lufeng/uploads/dashixiong/products/HDP/',
                HDDir = '/home/lufeng/uploads/dashixiong/products/';
            }

            var form = new formidable.IncomingForm();

            console.log('=========dir');
            form.uploadDir = dir;
            form.keepExtensions = true;
            form.on('file',function (field, file) {
            }).on('error',function (e) {
                ld.debug('upload error!' + e);
            }).on('end', function (data) {
            });


            console.log('=========handler');
            //解析表单数据, 最主要是从parse函数里获取图片的文件名
            form.parse(req, function (err, fields, files) {
                if (err) {
                    ld.debug('err' + err);
                }

                var imgName = files.img.path;

                imgName = imgName.substring(dir.length);

                //用gm压缩图片:fs读取图片、gm处理图片、fs再写图片
                var readStream = fs.createReadStream(files.img.path);
                gm(readStream, imgName)
                    .resize(120,120)
                    .compress('None')
                    .quality(80)
                    .write(HDDir+imgName, function(err){
                        if(err){
                            console.log('gm----------->erro:');
                            console.log(err);
                            return;
                        }else{
                            console.log('************高清图片压缩成功*************');

                        }

                    });

                dashixiong.updateProductImg(id, imgName, function (err, ret) {
                    if (!err) {
                        //成功
                        res.redirect('/dashixiongwx/admin/shop/' + req.params.shop_id + '/product/list/all#' + id);
                        //把图片同步到七牛
                        /*if (imgName) {
                            dao.sendImgToQiniu({pid: id, name: imgName}, function (result) {
                                console.log('图片同步成功...');
                            });
                        }*/
                        return;
                    }

                    ld.debug(err);

                });

            });

        });


    app.post('/dashixiongwx/admin/shop/:shop_id/product/doadd',
        //middleware_power.worker,
        function (req, res) {
            //formidable获取整个产品数据，包括图片
            var dir = '/home/uploads/dashixiong/products/';
            if ( uutil.isInDevelopment() ) {//开发环境如果是MacOS, 竟然叫做'darwin'
                //dir = '/Users/auscar/uploads/dashixiong/products/';
                dir = '/Users/beetle/projects/uploads/dashixiong/products/';
            }
            var form = new formidable.IncomingForm();
            form.uploadDir = dir;
            form.keepExtensions = true;
            form.on('file',function (field, file) {

            }).on('error',function (e) {
                ld.debug('upload error!' + e);
            }).on('end', function () {
                //res.end(JSON.stringify({code:0,msg : 'sus'}));
            });


            //解析表单数据, 最主要是从parse函数里获取图片的文件名
            form.parse(req, function (err, fields, files) {

                var imgName = files.img.path;
                imgName = imgName.substring(dir.length);
                console.log(fields);

                var product = {
                    title: fields.title,
                    img: imgName,
                    code: fields.code,
                    price: fields.price,
                    promotePrice: fields.promotePrice,
                    cost: fields.cost,
                    unit: fields.unit,
                    productStatus: fields.productStatus,
                    shopId: req.params.shop_id - 0,
                    safety: fields.safety,
                    offShelves: fields.offShelves,
                    timeStamp: new Date().getTime()
                };


                if (!product.title || !product.img || !product.price || !product.cost || !product.unit || product.productStatus == '') {
                    res.end('all fields are needed...');
                    return;
                }

                if (!err) {
                    dashixiong.insertProduct(product, function (err, ret) {
                        if (!err) {
                            res.redirect('/dashixiongwx/admin/shop/' + req.params.shop_id + '/product/list/all');
                            //把图片同步到七牛
                            /*if (imgName) {
                                dao.sendImgToQiniu({pid: ret.insertId, name: imgName}, function (result) {
                                    console.log('图片同步成功...');
                                });
                            }*/
                            return;
                        }
                        ld.debug(err);
                    });
                    return;
                }
                res.end(JSON.stringify({code: 1, msg: 'upload error'}));
            });

        });

    var getListProductFn = function (req, res, status_type) {
        return function (err, products) {
            var pIds = [];
            var secIds = [];
            var shop_id = req.params.shop_id;
            var product_section = [];
            if (!err) {
                //判断某店在货架上的产品ID
                admin.getProductIdsByShopId(shop_id, function(err, ret){
                    if(err){
                        console.log(err);
                        return;
                    }
                    if(ret[0].pids){
                        ret[0].pids.forEach(function(doEle, i){
                            secIds.push(doEle);
                        });
                    }

                    //去重产品
                    var price = 0;
                    products.forEach(function (product, i) {
                        pIds.push(product.id);
                        price = product.promote_price || product.price;
                        product.profit_rate = ( (price - product.cost) / price * 100 ).toFixed(1) + '%';
                        //给在货架上的产品添加属性isexit=true
                        secIds.forEach(function(secId, i){
                            if(secId == product.id) {
                                product.isexit = 'true';
                            }
                        });
                    });

                    render(req, res, 'admin/product_list_all', {
                        layout: true,
                        products: products,
                        status_type: status_type
                    });
                    return;
                });
            }
            ld.debug(err);
        };
    };

    var getListProductSort = function (req, res) {
        return function (err, products) {
            var pIds = [];
            var secIds = [];
            var shop_id = req.params.shop_id;
            var product_section = [];
            if (!err) {
                //判断某店在货架上的产品ID
                admin.getProductIdsByShopId(shop_id, function(err, ret){
                    if(err){
                        console.log(err);
                        return;
                    }
                    if(ret[0].pids){
                        ret[0].pids.forEach(function(doEle, i){
                            secIds.push(doEle);
                        });
                    }

                    //去重产品
                    var price = 0;
                    products.forEach(function (product, i) {
                        pIds.push(product.id);
                        price = product.promote_price || product.price;
                        product.profit_rate = ( (price - product.cost) / price * 100 ).toFixed(1) + '%';
                        //给在货架上的产品添加属性isexit=true
                        secIds.forEach(function(secId, i){
                            if(secId == product.id) {
                                product.isexit = 'true';
                            }
                        });
                    });
                    //将每个产品挂载货架信息
                    products.forEach(function(pro,i){
                        ret.forEach(function(sc,i){
                            var str = sc.content;
                            str = str.substr(1,str.length-2);
                            var arry = str.split(',');
                            arry.forEach(function(si,i){
                                if(si == '"'+pro.id+'"'){
                                    pro.sid =sc.id;
                                    pro.sna = sc.name;
                                    product_section.push(pro);
                                }
                            });
                        });
                    });

                     //按货架id排序
                     product_section.sort(function (a_product_type, b_product_type) {
                            return  a_product_type.sid - b_product_type.sid;
                     });

                    render(req, res, 'admin/product_list_all_sort', {
                        layout: true,
                        products: products,
                        status_type: 'all',
                        product_section: product_section
                    });
                    return;
                });
            }
            ld.debug(err);
        };
    };



    //管理员功能, 显示所有的产品
    app.get('/dashixiongwx/admin/shop/:shop_id/product/list/:status_type',
        middleware_power.worker,
        function (req, res) {
            var status_type = req.params.status_type;//显示的产品的类型: 已上架, 已下架, 全部, 或者是售罄
            var shop_id = req.params.shop_id;
            var fn = getListProductFn(req, res, status_type);

            switch (status_type) {
                case '':
                case 'all':
                    //获取数据库中的产品数据, 然后返回, 以便管理员编辑
                    dashixiong.listProducts(shop_id, fn);
                    break;
                case 'onsale':
                    //获取数据库中的产品数据, 然后返回, 以便管理员编辑
                    dashixiong.listOnSaleProducts(fn);
                    break;
                case 'offsale':
                    //获取数据库中的产品数据, 然后返回, 以便管理员编辑
                    dashixiong.listOffSaleProducts(fn);
                    break;
                case 'section_sort':
                    //获取数据库中的产品货架数据, 然后返回, 以便管理员编辑
                    dashixiong.listProducts(shop_id, fn);
                    break;
            }

        });
    //管理员功能, 显示所有的产品,按货架排序
    app.get('/dashixiongwx/admin/shop/:shop_id/product/sort/by/sectionid',
        middleware_power.worker,
        function (req, res) {
            var shop_id = req.params.shop_id;
            var fn = getListProductSort(req, res);
            //获取数据库中的产品数据按货架排序, 然后返回, 以便管理员编辑
            dashixiong.listProducts(shop_id, fn);
        });

    app.get('/dashixiongwx/admin/shop/:shop_id/product/:id/status/update/:code',
        middleware_power.worker,
        function (req, res) {
            var product_id = req.params.id;
            var status_code = req.params.code;
            var isAjax = req.query.isAjax;
            dashixiong.updateProductStatus(product_id, status_code, function (err, ret) {
                if (!err) {//没有err就简单默认操作成功
                    res.end(JSON.stringify({
                        code: 0,
                        msg: 'sus'
                    }));
                    return;
                }
                res.end(JSON.stringify({
                    code: 1,
                    msg: 'err' + err
                }));
            });
        });

    app.get('/dashixiongwx/admin/shop/:shop_id/product/:id/update',
        middleware_power.worker,
        function (req, res) {
            var product_id = req.params.id;

            //获取这个产品的所有的信息提用户修改
            dashixiong.getProductById(product_id, function (err, ret) {
                if (!err) {
                    render(req, res, 'admin/product_update', {
                        layout: true,
                        product: ret[0]
                    });
                    return;
                }
                res.end('error while getting product info ... ', err);
            });
        });

    app.get('/dashixiongwx/admin/shop/:shop_id/product/:id/delete',
        middleware_power.worker,
        function (req, res) {
            var product_id = req.params.id,
                shop_id = req.params.shop_id;

            //获取这个产品的所有的信息提用户修改
            dashixiong.delProductByPd({pid:product_id}, function (err, ret) {
                if (!err) {
                    res.redirect('/dashixiongwx/admin/shop/'+ shop_id +'/product/list/all');
                    return;
                }
                res.end('error while deleting product ... ', err);
            });
        });

    app.post('/dashixiongwx/admin/shop/:shop_id/product/:id/doupdate',
        middleware_power.worker,
        function (req, res) {
            var product = req.body.product;

            console.dir(product);

            //获取这个产品的所有的信息提用户修改
            dashixiong.updateProduct(product, function (err, ret) {
                if (!err) {
                    res.redirect('/dashixiongwx/admin/shop/' + req.params.shop_id + '/product/list/all');
                    return;
                }
                res.end('error when getting product info ... ', err);
            });
        });


    //导入某个店铺(from_shop_id)的产品数据到另外一个店铺(shop_id)里, 用于店铺的产品数据初始化
    app.post('/dashixiongwx/admin/shop/:shop_id/product/import',
        middleware_power.worker,
        function(req, res){
            var from_shop_id = req.body.from_shop_id;
            var shop_id = req.params.shop_id;

            //将from_shop_id 店铺里的所有产品导入到shop_id里头
            dashixiong.importProductsFromTo(from_shop_id, shop_id, function(err, ret){
                if(!err){
                    res.redirect('/dashixiongwx/admin/shop/'+ req.params.shop_id +'/product/list/all');
                    return;
                }
                res.end('error when importing product info ... ', err);
            });
        });

    //导出某个店铺(shop_id)的产品数据(在body里用ids标识)到另外一个店铺(body.to_shop_id)里, 用于店铺的产品数据初始化
    app.post('/dashixiongwx/admin/shop/:shop_id/product/export',
        middleware_power.worker,
        admin.getWarehouseIds,
        function(req, res){
            var shop_id = req.params.shop_id;
            var to_w_id = req.body.to_w_id;//目标仓库的id
            var to_shop_id = req.body.to_shop_id;//目标分店的id
            var ids = req.body.ids,
                warehouseIds = req.warehouseIds,
                status = {
                    code : 0,
                    msg : 'sus'
                },
                allow = false;
            ids = ids.split( ',' );

            if( to_w_id ){//有to_w_id参数说明是要导入到仓库
                warehouseIds.forEach(function(id, i){
                    if( id == to_w_id ){
                        allow = true;
                        return false;
                    }
                });

                if( !allow ){ //不允许直接导到非本店的仓库
                    status.code = 1;
                    status.msg = '';
                    end(res, status);
                    return;
                }

                dashixiong.exportProductsToWarehouse(ids, to_w_id, function(err, ret){
                    if(!err){
                        end( res, status);
                        return;
                    }
                    res.end('error when exporting product info ... ', err);
                });
                return;
            }

            //运行到这里, 说明要将产品导入到某个分店的产品列表
            dashixiong.exportProductsToShop(ids, to_shop_id, function(err, ret){
                if(!err){
                    end( res, status);
                    return;
                }
                res.end('error when exporting product info ... ', err);
            });
            return;
        });



    //更新“预计送达”的公告
    app.post('/dashixiongwx/admin/shop/:shop_id/possibleReach/doupdate',
        middleware_power.worker,
        function(req, res){
            var possibleReach = req.body.possibleReach;

            admin.updatePossibleReach(possibleReach, function (err, ret) {
                if (!err) {
                    res.redirect('/dashixiongwx/admin/shop/' + req.params.shop_id + '/setting/list');
                    return;
                }
                res.end('error when updating poosibleReach info ... ', err);
            });
        });

    //用户权限管理
    app.get('/dashixiongwx/admin/shop/:shop_id/members',
        middleware_power.boss,
        function(req, res){
            var a = new asyncMgr.AsyncAction(),
                members,
                sections;
            a.register('get members');
            a.register('get sections');

            a.onAllDone = function(){
                render(req, res, 'admin/members', {
                    layout : 'admin/layout',
                    users : members,
                    sections : sections,
                    shop_id : req.params.shop_id
                });
            };

            admin.getMembers(function (err, ret) {
                if (!err) {
                    members = sureAry(ret);
                    a.thisDone('get members');
                    return;
                }
                endErr(res, err);
                a.thisDone('get members');
            });
            admin.getAllSections(function(err, ret){
                if (!err) {
                    sections = sureAry(ret);
                    a.thisDone('get sections');
                    return;
                }
                endErr(res, err);
                a.thisDone('get sections');
            });
        });


    //修改用户密码
    app.post('/dashixiongwx/admin/shop/:shop_id/pwd/change',
        middleware_power.boss,
        function(req,res){
            var user = req.body.pwd,
                shop_id = req.params.shop_id;
            user.password = hash.md5(user.password);
            dashixiong.updatePwd(user, function(err, ret){
                if( !err ){
                    res.redirect('/dashixiongwx/admin/shop/'+ shop_id +'/members');
                    return;
                }
                endErr(res, err);
            });
        });

    //更新管理员权限
    app.post('/dashixiongwx/admin/members/doupdate',
        middleware_power.boss,
        function(req, res){
            var member = req.body.member,
                shop_id = member.shop_id;
            delete member.shop_id;
            dashixiong.updateUser(member, function(err, ret){
                if( !err ){
                    res.redirect('/dashixiongwx/admin/shop/'+ shop_id +'/members');
                    return;
                }
                endErr(res, err);
            });
        });

    //添加新用户
    app.post('/dashixiongwx/admin/shop/:shop_id/user/doadd',
        middleware_power.boss,
        function(req, res){
            var user = req.body.user;
            //注册一个新用户
            dashixiong.newUser({shop_id:user.shopId, qId:0}, function(err, new_user_id){
                //用当前时间搓模仿一个wx_id
                var dt = (new Date()).getTime().toString(),
                    wx_id = hash.md5(dt);
                dashixiong.bindUser(new_user_id, wx_id, function(err, ret){
                    var user_id = ret.insertId;
                    dashixiong.updateUser({id:new_user_id, shopId:user.shopId, email:user.name, nick:user.name, power:user.power, bindTo:user.shopId, pwdHash:hash.md5(user.password)}, function(){
                        res.redirect('/dashixiongwx/admin/shop/'+ req.params.shop_id +'/members');
                    })
                });
            });
        });

    var listFinanceRecordsHandler = function (req, res) {
        var y = req.params.y;
        var m = req.params.m;
        var d = req.params.d;
        var shop_id = req.params.shop_id;


        var obj_date = dashixiong.getDateStartAndEndTimeStamp(y, m, d);


        var dt = new Date(obj_date.time_stamp_the_date_now);//获取当日此时的Date对象
        y = dt.getFullYear();
        m = dt.getMonth() + 1;
        d = dt.getDate();

        var pre_date = dashixiong.getDates(dt.getTime()).pre;
        var next_date = dashixiong.getDates(dt.getTime()).next;


        //获取y年m月d日的财务数据
        dashixiong.listFinanceRecords(obj_date.time_stamp_start, obj_date.time_stamp_end, shop_id, function (err, records) {
            if (!err) {
                render(req, res, 'admin/finance_record', {
                    layout: true,
                    records: records,
                    y: y,
                    m: m,
                    d: d,
                    pre_date_y: pre_date.getFullYear(),
                    pre_date_m: pre_date.getMonth() + 1,
                    pre_date_d: pre_date.getDate(),

                    next_date_y: next_date.getFullYear(),
                    next_date_m: next_date.getMonth() + 1,
                    next_date_d: next_date.getDate()
                });
                return;
            }

            ld.debug(err);

        });

    };

//获取某一天的财务记录
    app.get('/dashixiongwx/admin/shop/:shop_id/finance/:y/:m/:d',
        middleware_power.worker,
        listFinanceRecordsHandler);
    app.get('/dashixiongwx/admin/shop/:shop_id/finance',
        middleware_power.worker,
        listFinanceRecordsHandler);

//添加一条财务记录
    app.get('/dashixiongwx/admin/shop/:shop_id/finance/add/:y/:m/:d',
        middleware_power.shopkeeper,
        function (req, res) {
            var y = req.params.y;
            var m = req.params.m;
            var d = req.params.d;

            render(req, res, 'admin/finance_record_add', {
                layout: true,
                y: y,
                m: m,
                d: d
            });

        });
    app.post('/dashixiongwx/admin/shop/:shop_id/finance/doadd/:y/:m/:d',
        middleware_power.worker,
        function (req, res) {
            var y = req.params.y;
            var m = req.params.m;
            var d = req.params.d;
            var record = req.body.record;

            var dt = new Date();
            dt.setFullYear(y - 0);
            dt.setMonth(m - 1);
            dt.setDate(d - 0);

            record.recordTimeStamp = dt.getTime();

            dashixiong.addFinanceRecord(record, req.params.shop_id,function (err, ret) {
                res.redirect('/dashixiongwx/admin/shop/' + req.params.shop_id + '/finance/' + y + '/' + m + '/' + d);
            });

        });

    app.get('/dashixiongwx/admin/shop/:shop_id/finance/edit/:y/:m/:d/:id',
        middleware_power.worker,
        function (req, res) {
            var record_id = req.params.id;

            dashixiong.getRecordById(record_id, function (err, ret) {
                var r = ret[0] || {};
                render(req, res, 'admin/finance_record_edit', {
                    layout: true,
                    record: r,
                    y: req.params.y,
                    m: req.params.m,
                    d: req.params.d
                });
            });

        });
    app.post('/dashixiongwx/admin/shop/:shop_id/finance/doedit/:y/:m/:d/:record_id',
        middleware_power.worker,
        function (req, res) {
            var record = req.body.record;

            dashixiong.updateFinanceRecord(record, function (err, ret) {
                res.redirect('/dashixiongwx/admin/shop/' + req.params.shop_id + '/finance/' + req.params.y + '/' + req.params.m + '/' + req.params.d);
            });

        });

    app.get('/dashixiongwx/admin/shop/:shop_id/finance/del/:id',
        middleware_power.worker,
        function (req, res) {
            var record_id = req.params.id;

            dashixiong.delFinanceRecord(record_id, function (err, ret) {
                res.redirect(req.headers.referer);
            });

        });


//-------------------------------- DateResume 数据统计功能 -------------------- //
    app.get('/dashixiongwx/admin/shop/:shop_id/dateresume',
        middleware_power.operator,
        function (req, res) {
            var limit = req.query.limit || 30;
            limit -= 0;
            dashixiong.listDateResume(req.params.shop_id, limit, function (err, resumes) {
                var labels = [];
                var labels_show = [];
                var data_total_in = [];
                var data_profit = [];
                var data_visitor_count = [];
                var data_order_num = [];

                var tmp_resume_data = null;
                resumes.forEach(function (resume, i) {
                    tmp_resume_data = JSON.parse(resume.dataStr);
                    labels.push({
                        date_txt: resume.dateStr.format('mm月dd日'),
                        date_day: uutil.getChineseDay(new Date(resume.dateStr))
                    });
                    labels_show.push('');//TODO: 这个图标插件好傻逼, label多了竟然会重叠在一起, 只能显示空的, 不让它那么难看
                    data_total_in.push(tmp_resume_data.total_in - 0);
                    data_profit.push((tmp_resume_data.total_in - tmp_resume_data.total_cost).toFixed(1))
                    data_visitor_count.push(tmp_resume_data.visitor_count);
                    data_order_num.push(tmp_resume_data.order_num);
                });


                render(req, res, 'admin/date_resume', {
                    layout: 'admin/layout',
                    limit: limit,
                    labels: labels,
                    labels_show: labels_show,
                    data_total_in: data_total_in,
                    data_profit: data_profit,
                    data_visitor_count: data_visitor_count,
                    data_order_num: data_order_num
                });
            });

        });


//----------------------------------------- 货架管理 ----------------------------------------//

//添加货架
    app.get('/dashixiongwx/admin/shop/:shop_id/section/add',
        middleware_power.shopkeeper,//店长及以上权限才能操作
        function (req, res) {
            render(req, res, 'admin/section_add', {
                layout: 'admin/layout'
            });
        });

//删除货架
    app.get('/dashixiongwx/admin/shop/:shop_id/section/:id/del',
        middleware_power.shopkeeper,//店长及以上权限才能操作
        function (req, res) {
            var id = req.params.id;
            dashixiong.delSectionById(id, function (err, ret) {
                if (!err) {
                    res.redirect('/dashixiongwx/admin/shop/' + req.params.shop_id + '/section/list');
                    return;
                }
                endErr(res, err);
            });

        });

//添加货架, 提交数据
    app.post('/dashixiongwx/admin/shop/:shop_id/section/doadd',
        middleware_power.shopkeeper,//店长及以上权限才能操作
        function (req, res) {
            var section = req.body.section;
            section.content = section.content.replace(/\s|\t|\n/g, '');
            dashixiong.insertSection(section, req.params.shop_id, function (err, ret) {
                if (!err) {
                    res.redirect('/dashixiongwx/admin/shop/' + req.params.shop_id + '/section/list');
                    return;
                }
                ld.debug(err);
            });
        });


//货架管理
    app.get('/dashixiongwx/admin/shop/:shop_id/section/list',
        middleware_power.parttime_senior,
        get_shop_info_middleware,
        function (req, res) {
            var shop = req.shop;//这个shop 是通过中间件获取的, 详情请在本文件中搜索 "类中间件"
            var sections = null;
            var products_in_warehouse = null;
            var cur_warehouse_id = uutil.getSettingValueByKey(shop.config, 'curWarehouseId');
            var a = new asyncMgr.AsyncAction(),
                shop_id = req.params.shop_id,
                section_id;
            a.register('get_sections');
            a.register('get_products');
            a.onAllDone = function () {
                var ary_ids = null;
                var section_order = [];
                var section_product_order_map = {};
                sections.forEach(function (section, i) {
                    section_order.push(section.id);//货架的顺序
                    section_product_order_map[section.id] = section.content;//每一个货架上产品的顺序
                    try {
                        ary_ids = JSON.parse(section.content);
                    } catch (e) {
                        ary_ids = [];
                    }
                    //每个货架上具体是什么产品, 把它们设置到products属性上
                    section.products = dashixiong.getProductsWithIds(ary_ids, products_in_warehouse);
                });
                render(req, res, 'admin/section_list_sortable', {
                    layout: 'admin/layout',
                    sections: sections,
                    section_order: section_order,
                    power : req.user.power,
                    section_product_order_map: section_product_order_map,
                    products_in_warehouse: products_in_warehouse,
                    cur_warehouse_id: cur_warehouse_id,
                    shop: req.shop
                });
            };

            //如果权限小于2，只能管理所在店铺中属于自己的货架
            if( req.user && req.user.power < 2 ) section_id = req.user.sectionId;


            //获取这个分店的货架信息
            dashixiong.listAllSections({shop_id:shop_id, section_id:section_id}, function (err, _sections) {
                if (err) {
                    ld.debug(err);
                }
                _sections.forEach(function(section, i){
                    if (section.name)
                        section.name = section.name.replace(/<[^>]*>/img, '');
                });
                sections = _sections;
                a.thisDone('get_sections');
            });

            //获取这个分店的当前仓库中的产品信息
            dashixiong.listProductsInWarehouse(cur_warehouse_id, null, function (err, _products) {
                if (err) {
                    ld.debug(err);
                }
                products_in_warehouse = _products;
                a.thisDone('get_products');
            });
        });

    //编辑货架
    app.get('/dashixiongwx/admin/shop/:shop_id/section/:id/edit',
        middleware_power.worker,//正式员工及以上才能操作
        function (req, res) {
            var id = req.params.id;
            //获取section信息, 以便编辑
            dashixiong.getSectionById(id, function (err, ret) {
                if (!err) {
                    render(req, res, 'admin/section_edit', {
                        layout: 'admin/layout',
                        section: ret[0]
                    });
                    return;
                }
                endErr(res, err);
            });
        });
    app.post('/dashixiongwx/admin/shop/:shop_id/section/doupdate',
        middleware_power.worker,
        function (req, res) {
            var section = req.body.section;
            section.content = section.content.replace(/\s|\t|\n/g, '');

            dashixiong.updateSection(section, function (err, ret) {
                if (!err) {
                    res.redirect('/dashixiongwx/admin/shop/' + req.params.shop_id + '/section/list');
                    return;
                }
                endErr(res, err);
            });
        });

    app.post('/dashixiongwx/admin/shop/:shop_id/section/:section_id/doUpdateSectionAd', function(req, res){
        var dir = '/home/uploads/dashixiong/products/ad',
            shop_id = req.params.shop_id,
            section_id= req.params.section_id;

        if ( uutil.isInDevelopment() ) {//开发环境如果是MacOS, 竟然叫做'darwin'
            dir = '/Users/beetle/projects/uploads/dashixiong/products/ad';
        }

        var form = new formidable.IncomingForm();

        form.uploadDir = dir;
        form.keepExtensions = true;
        form.on('file',function (field, file) {
        }).on('error',function (e) {
            ld.debug('upload error!' + e);
        }).on('end', function(data){});

        //解析表单数据, 最主要是从parse函数里获取图片的文件名
        form.parse(req, function (err, fields, files) {
            if (err) {
                ld.debug('err' + err);
            }

            var imgName = files.section_ad.path;
            imgName = imgName.substring(dir.length);
            if( imgName ) imgName = imgName.replace('/', '');

            dashixiong.updateSectionAd({ad:imgName, id:section_id}, function(err, ret){
                res.redirect('/dashixiongwx/admin/shop/'+ shop_id +'/section/'+ section_id +'/edit');
            });
        });
    });

    /*section-strategy----add by lufeng*/
    app.get('/dashixiongwx/admin/shop/:shop_id/section/strategy',
        middleware_power.operator,
        function(req, res){
            dashixiong.getAllSectionStrategy(function(err,rows){
                rows.forEach(function(row, i){
                    row.content = JSON.parse(row.content).rate*10+'折';
                });
                var flag = req.query.isAjax;
                if(flag && !err){
                    res.end(JSON.stringify(rows));
                    return ;
                }else{
                    if(!err){
                        render(req, res, 'admin/section_strategy',{
                            layout: true,
                            strategies: rows,
                            shopId: req.params.shop_id
                        });
                        return;
                    }
                    console.log(err);
                }

            });
        });
    app.post('/dashixiongwx/admin/shop/:shop_id/section/strategy/add',
        middleware_power.operator,
        function(req, res){
            var obj = req.body.paramObj,
                tempContet = {
                    rate: obj.content,
                    nPin: obj.nPin
                };
            obj.content = JSON.stringify(tempContet);
            dashixiong.insertSectionStrategy(obj, function(err){
               if(!err){
                   res.end('success');
               }
            });
    });
    app.post('/dashixiongwx/admin/shop/:shop_id/section/strategy/del',
        middleware_power.operator,
        function(req, res){
        var arg = req.body.arg;
            dashixiong.deleteSectionStrategyById(arg, function(err){
                if(!err){
                    res.end('sus');
                }
                console.log(err);
            });

    });
    app.post('/dashixiongwx/admin/shop/:shop_id/update/product/section',
        middleware_power.worker,
        function (req, res) {
            var s_id = req.body.sectionid,
                p_ids = [];

            p_ids.push(req.body.p_id);

            dashixiong.updateProductSection(s_id, p_ids, function (err, ret) {
                if (!err) {
                    li.info('分类成功');
                    end(res, { code: 0, msg: 'sus' });
                    return;
                }
                endErr(res, { code: 1, msg: '分类失败' })
            });
        });


//这是一个ajax 请求
    app.post('/dashixiongwx/admin/shop/:shop_id/section/orderchange',
        middleware_power.parttime_senior,
        function (req, res) {
            var change = req.body.change;
            dashixiong.updateSectionOrder(req.params.shop_id, JSON.parse(change), function (err, ret) {
                if (err) {
                    err.code = -1;
                    end(res, err);
                    return;
                }
                end(res, { code: 0, msg: 'sus' });
            });
        });

//---------------------------------------- 公告管理 ----------------------------------------//
    app.get('/dashixiongwx/admin/shop/:shop_id/notice/add',
        middleware_power.parttime_senior,
        function (req, res) {
            render(req, res, 'admin/notice_add', {
                layout: 'admin/layout'
            });
        });

    app.post('/dashixiongwx/admin/shop/:shop_id/notice/doadd',
        middleware_power.parttime_senior,
        function (req, res) {
            var content = req.body.content;
            var shop_id = req.params.shop_id;

            if (!content) {
                res.end(JSON.stringify({
                    code: 1,
                    sus: 'content is needed'
                }));
                return;
            }

            dashixiong.insertNotice(content, shop_id, function (err, ret) {
                if (!err) {
                    res.redirect('/dashixiongwx/admin/shop/' + req.params.shop_id + '/notice/list');
                    return;
                }
                ld.debug(err);
            });

        });


    app.get('/dashixiongwx/admin/shop/:shop_id/notice/list',
        middleware_power.parttime_senior,
        function (req, res) {
            var a = new asyncMgr.AsyncAction();
            a.register('get_setting');
            a.register('list_notice');

            var obj_cur_notice_setting = null;
            var notices = [];
            var cur_notice = null;
            var shop_id = req.params.shop_id;
            a.onAllDone = function () {
                notices.forEach(function (notice, i) {
                    if (notice.id == obj_cur_notice_setting.settingValue - 0) {
                        cur_notice = notice;
                    }
                });
                render(req, res, 'admin/notice_list', {
                    layout: 'admin/layout',
                    notices: notices,
                    cur_notice: cur_notice
                });
            };

            //获取当前公告
            dashixiong.getSettingByKey('curNoticeId', shop_id, function (err, ret) {
                if (!err) {
                    obj_cur_notice_setting = ret[0];
                    a.thisDone('get_setting');
                    return;
                }
                ld.debug(err);
                a.thisDone('get_setting');
            });


            //获取所有公告列表
            dashixiong.listNotices(shop_id, function (err, _notices) {
                if (!err) {
                    if (_notices.length) {
                        _notices.forEach(function (notice, v) {
                            notice.intime = new Date(notice.timeStamp).format('yyyy-mm-dd HH:MM:ss');
                        });
                    }
                    notices = _notices;
                    a.thisDone('list_notice');
                    return;
                }
                ld.debug(err);
                a.thisDone('list_notice');
            });
        });
    //根据公告的id更新公告
    app.post('/dashixiongwx/admin/shop/:shop_id/notice/:id/update',
        middleware_power.parttime_senior,
        function(req,res) {
            var content = req.body.content,//前台页面数post传过来只能用req.body或req.params(处理/xxxx的路由)
                id = req.body.id-0;//转成int
            dashixiong.updateNoticeById(content, id, function (err, ret) {
                res.redirect('/dashixiongwx/admin/shop/' + req.params.shop_id + '/notice/list');
            });
        });
    app.get('/dashixiongwx/admin/shop/:shop_id/notice/:id/del',
        middleware_power.parttime_senior,
        function (req, res) {
            var id = req.params.id;
            dashixiong.delNoticeById(id, function (err, notices) {
                res.redirect('/dashixiongwx/admin/shop/' + req.params.shop_id + '/notice/list');
            });
        });
    app.get('/dashixiongwx/admin/shop/:shop_id/notice/:id/cur',
        middleware_power.parttime_senior,
        function (req, res) {
            var id = req.params.id;
            var shop_id = req.params.shop_id;
            dashixiong.setCurNotice(id, shop_id, function (err, ret) {
                res.redirect('/dashixiongwx/admin/shop/' + req.params.shop_id + '/notice/list');
            });
        });
    app.get('/dashixiongwx/admin/shop/:shop_id/notice/curclear',
        middleware_power.parttime_senior,
        function (req, res) {
            dashixiong.clearCurNotice(req.params.shop_id, function (err, ret) {
                res.redirect('/dashixiongwx/admin/shop/' + req.params.shop_id + '/notice/list');
            });
        });

//--------------------------------- leave status, 离开状态, 当用户通过微信询问时, 显示预先设置好的消息 ----------------//
    app.get('/dashixiongwx/admin/shop/:shop_id/leavestatus/add',
        middleware_power.worker,
        function (req, res) {
            render(req, res, 'admin/leave_status_add', {
                layout: 'admin/layout'
            });
        });

    app.post('/dashixiongwx/admin/shop/:shop_id/leavestatus/doadd',
        middleware_power.worker,
        function (req, res) {
            var content = req.body.content;
            var shop_id = req.params.shop_id;

            if (!content) {
                res.end(JSON.stringify({
                    code: 1,
                    sus: 'content is needed'
                }));
                return;
            }

            dashixiong.insertLeaveStatus(content, shop_id, function (err, ret) {
                if (!err) {
                    res.redirect('/dashixiongwx/admin/shop/' + req.params.shop_id + '/leavestatus');
                    return;
                }
                ld.debug(err);
            });

        });

    app.get('/dashixiongwx/admin/shop/:shop_id/leavestatus/:id/cur',
        middleware_power.parttime_senior,
        function (req, res) {
            var id = req.params.id;
            var shop_id = req.params.shop_id;
            var arrays = req.query.arrays;
            dashixiong.setCurLeaveStatus(id, arrays, function (err, ret) {
                //res.redirect('/dashixiongwx/admin/shop/' + req.params.shop_id + '/leavestatus');
                res.end('success');
            });
        });
    app.get('/dashixiongwx/admin/shop/:shop_id/leavestatus/curclear',
        middleware_power.parttime_senior,
        function (req, res) {
            dashixiong.clearCurLeaveStatus(req.params.shop_id, function (err, ret) {
                res.redirect('/dashixiongwx/admin/shop/' + req.params.shop_id + '/leavestatus');
            });
        });

    app.get('/dashixiongwx/admin/shop/:shop_id/leavestatus/curclear/set',
        middleware_power.parttime_senior,
        function (req, res) {
            var arrays = req.query.arrays;
            dashixiong.clearSetCurLeaveStatus(arrays, function (err, ret) {
                res.end('success');
            });
        });

    app.get('/dashixiongwx/admin/shop/:shop_id/leavestatus/:id/del',
        middleware_power.parttime_senior,
        function (req, res) {
            var id = req.params.id;
            dashixiong.delLeaveStatusById(id, function (err) {
                res.redirect('/dashixiongwx/admin/shop/' + req.params.shop_id + '/leavestatus');
            });
        });


    app.get('/dashixiongwx/admin/shop/:shop_id/leavestatus',
        middleware_power.parttime_senior,
        function (req, res) {
            var a = new asyncMgr.AsyncAction();
            a.register('get_cur_leave_status');
            a.register('list_leave_status');

            var obj_cur_leave_status_setting = null;
            var leave_status = [];
            var cur_leave_status = null;
            var shop_id = req.params.shop_id;
            a.onAllDone = function () {
                leave_status.forEach(function (sta, i) {
                    if (sta.id == obj_cur_leave_status_setting.settingValue - 0) {//找出当前是哪个离开状态
                        cur_leave_status = sta;
                    }
                });
                render(req, res, 'admin/leave_status', {
                    layout: 'admin/layout',
                    leave_status: leave_status,
                    cur_leave_status: cur_leave_status//当前显示的离开状态
                });
            };

            //获取当前公告
            dashixiong.getSettingByKey('curLeaveStatusId', shop_id, function (err, ret) {
                if (!err) {
                    obj_cur_leave_status_setting = ret[0];
                    obj_cur_leave_status_setting = obj_cur_leave_status_setting || {};
                    a.thisDone('get_cur_leave_status');
                    return;
                }
                ld.debug(err);
                a.thisDone('get_cur_leave_status');
            });


            //获取所有的离开状态
            dashixiong.listLeaveStatus(shop_id, function (err, _status) {
                if (!err) {
                    if (_status.length) {
                        _status.forEach(function (sta, v) {
                            sta.intime = new Date(sta.timeStamp).format('yyyy-mm-dd HH:MM:ss');
                        });
                    }
                    leave_status = _status;
                    a.thisDone('list_leave_status');
                    return;
                }
                ld.debug(err);
                a.thisDone('list_leave_status');
            });

        });

//------------------------------------------------------------- motto 小票箴言 --------------------//
    app.get('/dashixiongwx/admin/shop/:shop_id/motto/add',
        middleware_power.worker,
        function (req, res) {
            render(req, res, 'admin/motto_add', {
                layout: 'admin/layout'
            });
        });
    app.post('/dashixiongwx/admin/shop/:shop_id/motto/doadd',
        middleware_power.worker,
        function (req, res) {
            var content = req.body.content;
            var shop_id = req.params.shop_id;

            if (!content) {
                res.end(JSON.stringify({
                    code: 1,
                    sus: 'content is needed'
                }));
                return;
            }

            dashixiong.insertMotto(content, shop_id, function (err, ret) {
                if (!err) {
                    res.redirect('/dashixiongwx/admin/shop/' + req.params.shop_id + '/motto/list/all');
                    return;
                }
                ld.debug(err);
            });
        });
    app.get('/dashixiongwx/admin/shop/:shop_id/motto/:id/cur',
        middleware_power.worker,
        function (req, res) {
            var id = req.params.id;
            var shop_id = req.params.shop_id;//暂时没用到
            var arrays = req.query.arrays;
            dashixiong.setCurMotto(id, arrays, function (err, ret) {
                //res.redirect('/dashixiongwx/admin/shop/' + req.params.shop_id + '/motto/list/all');
                res.end('success');
            });
        });

    app.get('/dashixiongwx/admin/shop/:shop_id/motto/curclear/set',
        middleware_power.worker,
        function (req, res) {
            var arrays = req.query.arrays;
            dashixiong.cancelCurMotto(arrays, function (err, ret) {
                res.end('success');
            });
        });

    app.get('/dashixiongwx/admin/shop/:shop_id/motto/curclear',
        middleware_power.worker,
        function (req, res) {
            dashixiong.clearCurMotto(req.params.shop_id, function (err, ret) {
                res.redirect('/dashixiongwx/admin/shop/' + req.params.shop_id + '/motto/list/all');
            });
        });
    app.get('/dashixiongwx/admin/shop/:shop_id/motto/:id/del',
        middleware_power.worker,
        function (req, res) {
            var id = req.params.id;
            dashixiong.delMottoById(id, function (err) {
                res.redirect('/dashixiongwx/admin/shop/' + req.params.shop_id + '/motto/list/all');
            });
        });


    app.get('/dashixiongwx/admin/shop/:shop_id/motto/list/all',
        middleware_power.worker,
        function (req, res) {
            var a = new asyncMgr.AsyncAction();
            a.register('get_cur_motto');
            a.register('list_mottos');

            var obj_cur_motto_setting = null;
            var mottos = [];
            var cur_motto = null;
            var shop_id = req.params.shop_id;
            a.onAllDone = function () {
                mottos.forEach(function (motto, i) {
                    if (motto.id == obj_cur_motto_setting.settingValue - 0) {//找出当前是哪个离开状态
                        cur_motto = motto;
                    }
                });
                render(req, res, 'admin/mottos_list', {
                    layout: 'admin/layout',
                    mottos: mottos,
                    cur_motto: cur_motto//当前显示的离开状态
                });
            };

            //获取当前箴言
            dashixiong.getSettingByKey('curMottoId', shop_id, function (err, ret) {
                if (!err) {
                    obj_cur_motto_setting = ret[0];
                    obj_cur_motto_setting = obj_cur_motto_setting || {};
                    a.thisDone('get_cur_motto');
                    return;
                }
                ld.debug(err);
                a.thisDone('get_cur_motto');
            });


            //获取所有的 箴言
            dashixiong.listMottos(shop_id, function (err, _mottos) {
                if (!err) {
                    if (_mottos.length) {
                        _mottos.forEach(function (motto, i) {
                            motto.intime = new Date(motto.timeStamp).format('yyyy-mm-dd HH:MM:ss');
                        });
                    }
                    mottos = _mottos;
                    a.thisDone('list_mottos');
                    return;
                }
                ld.debug(err);
                a.thisDone('list_mottos');
            });

        });


//列出某个店铺的仓库
    app.get('/dashixiongwx/admin/shop/:shop_id/warehouse/list',
        middleware_power.worker,
        function (req, res) {
            var shop_id = req.params.shop_id;
            var warehouses = null;
            var cur_warehouse = null;

            var a = new asyncMgr.AsyncAction();
            a.register('get_warehouses');
            a.register('get_cur_warehouse');
            a.onAllDone = function () {
                render(req, res, 'admin/warehouse_list', {
                    layout: 'admin/layout',
                    shop_id: shop_id,
                    cur_warehouse: cur_warehouse,
                    warehouses: warehouses
                });

            };
            dashixiong.listWarehousesOfShop(shop_id, function (err, _warehouses) {
                warehouses = _warehouses;
                a.thisDone('get_warehouses');
            });
            dashixiong.getCurWarehouse(shop_id, function (err, ret) {
                ld.debug(err);
                if (!err) {
                    cur_warehouse = ret[0];
                    a.thisDone('get_cur_warehouse');
                    return;
                }
                ld.debug(err);
                a.thisDone('get_cur_warehouse');
            });
        });


    app.get('/dashixiongwx/admin/shop/:shop_id/warehouse/add',
        middleware_power.shopkeeper,
        function (req, res) {
            render(req, res, 'admin/warehouse_add', {
                layout: true,
                shop_id: req.params.shop_id
            });

        });

    app.post('/dashixiongwx/admin/shop/:shop_id/warehouse/doadd',
        middleware_power.shopkeeper,
        function (req, res) {
            var name = req.body.name;
            var shop_id = req.params.shop_id;
            dashixiong.insertWarehouse({
                    name: name,
                    shop_id: shop_id
                },
                function (err, ret) {
                    res.redirect('/dashixiongwx/admin/shop/' + req.params.shop_id + '/warehouse/list');
                });

        });
    app.get('/dashixiongwx/admin/shop/:shop_id/warehouse/:w_id/del',
        middleware_power.shopkeeper,
        function (req, res) {
            var w_id = req.params.w_id;
            var shop_id = req.params.shop_id;
            dashixiong.delWarehouse(w_id, function (err, ret) {
                res.redirect('/dashixiongwx/admin/shop/' + req.params.shop_id + '/warehouse/list');
            });
        });
    app.get('/dashixiongwx/admin/shop/:shop_id/warehouse/:w_id/cur',
        middleware_power.shopkeeper,
        function (req, res) {
            var w_id = req.params.w_id;
            var shop_id = req.params.shop_id;
            dashixiong.setCurWarehouse(shop_id, w_id, function (err, ret) {
                res.redirect('/dashixiongwx/admin/shop/' + req.params.shop_id + '/warehouse/list');
            });
        });

    app.get('/dashixiongwx/admin/shop/:shop_id/warehouse/:w_id',
        middleware_power.worker,
        function (req, res) {
            var w_id = req.params.w_id;
            dashixiong.getProductsInWarehouse(w_id, function (err, products) {

            });
        });

    var inproducts = function (req, res) {
        render(req, res, 'admin/warehouse_inproduct', {
            layout: true,
            w_id: req.params.w_id,
            w_name: req.params.w_name
        });
    }
//进货页面
    app.get('/dashixiongwx/admin/shop/:shop_id/warehouse/:w_id/:w_name/inproducts',
        middleware_power.worker,
        inproducts);
    app.get('/dashixiongwx/admin/shop/:shop_id/warehouse/:w_id/inproducts',
        middleware_power.worker,
        inproducts);

    app.post('/dashixiongwx/admin/shop/:shop_id/warehouse/:w_id/doinproducts',
        middleware_power.worker,
        function (req, res) {
            var product_counts = req.body.counts;
            var ary_product_counts = product_counts.split('\n');

            console.log(req.body.inproducts_type);

            var tmp = null;
            var ary = [];
            for (var i = 0; i < ary_product_counts.length; i++) {
                ary_product_counts[ i ] = ary_product_counts[ i ].trim();

                if (!ary_product_counts[ i ]) {
                    continue;
                }

                tmp = ary_product_counts[ i ].split(',');
                ary.push({
                    code: tmp[ 0 ],
                    count: tmp[ 1 ]
                });
            }

            //进货
            dashixiong[ 'inproducts' + req.body.inproducts_type  ](req.params.w_id, ary, function (err, ret) {
                ld.debug(err);
                res.redirect('/dashixiongwx/admin/shop/' + req.params.shop_id + '/warehouse/' + req.params.w_id + '/inproducts?w_name=' + req.body.w_name)
            });
        });


//列出这个仓库的所有产品
    app.get('/dashixiongwx/admin/shop/:shop_id/warehouse/:w_id/product/list/:status_code',
        middleware_power.worker,
        function (req, res) {
            var status_type = req.params.status_code;
            var status_code = null;
            var existpid_arry = [];//存放这个店铺中所有货架上存在的产品id
            var value = 0;//存货成本
            var value_sale = 0;//账面价值
            switch (status_type) {
                //case '':
                case 'all':
                    break;
                case 'onsale':
                    status_code = 0;
                    break;
                case 'offsale':
                    status_code = 1;
                    break;
            }

            dashixiong.getAllProductId(req.param('shop_id'),function(err,ret){
                if(err){
                    console.log(err);
                }
               var exittpid_str = '';
               ret.forEach(function(temp,i){
                   exittpid_str += temp.content.substring(1,temp.content.length-1)+',';
               });
               exittpid_str = exittpid_str.substring(0,exittpid_str.length-1);
               existpid_arry = exittpid_str.split(',');

                var listProductsInWarehouseFn = function (err, products) {
                    if (!err) {
                        products.forEach(function (product,i) {
                            value += product.cost * product.count;
                            if (product.cost != 0) {//特殊服务, 成本为0
                                value_sale += product.price * product.count;
                            }
                            //仓库中的所有产品id与这个店铺货架上存在的所有产品id进行配对，若有则添加给这个产品添加一个exit属性
                            existpid_arry.forEach(function(exitpid,j){
                                if('"'+product.id+'"' == exitpid){
                                    product.exit = 'true';
                                }
                            });
                        });
                        render(req, res, 'admin/warehouse_product_list', {
                            layout: true,
                            w_id: req.params.w_id,
                            products: products,
                            value: value,
                            value_sale: value_sale
                        });
                    }else{
                        ld.debug(err);
                        res.end('Something wrong...check log');
                        return;
                    }
                };
                dashixiong.listProductsInWarehouse(req.params.w_id, status_code, listProductsInWarehouseFn);
            });
        });

//获取某个产品的信息
    app.get('/dashixiongwx/admin/shop/:shop_id/product/:code',
        middleware_power.worker,
        function (req, res) {
            var shop_id = req.params.shop_id;
            var code = req.params.code;
            dashixiong.getProductByCode(code, shop_id, function (err, ret) {
                end(res, ret);
            });

        });


//删除某个产品在仓库中的储存信息
    app.get('/dashixiongwx/admin/shop/:shop_id/warehouse/:w_id/product/:p_id/del',
        middleware_power.worker,
        function (req, res) {
            dashixiong.delStore(req.params.p_id, req.params.w_id, function (err, ret) {
                if (!err) {
                    res.redirect('/dashixiongwx/admin/shop/' + req.params.shop_id + '/warehouse/' + req.params.w_id + '/product/list/all')
                    return;
                }
                endErr(err);
            });


        });

//编辑仓库中某个产品的库存, 下架库存, 上下架状态等
    app.get('/dashixiongwx/admin/shop/:shop_id/warehouse/:w_id/product/:code/update/:title',
        middleware_power.parttime_senior,
        function (req, res) {
            dashixiong.getStoreOfProductInWarehouse(req.params.code, req.params.w_id, function (err, ret) {
                if (!err && ret[0]) {
                    var prdct = ret[0];
                    prdct.title = req.params.title;
                    render(req, res, 'admin/warehouse_product_update', {
                        layout: 'admin/layout',
                        w_id: req.params.w_id,
                        product: prdct
                    });
                    return;
                }
                ld.debug(err);
                res.end('err');
            });


        });

    app.post('/dashixiongwx/admin/shop/:shop_id/warehouse/:w_id/product/:code/doupdate',
        middleware_power.parttime_senior,
        function (req, res) {
            var product = req.body.product;
            dashixiong.updateProductInStore(product, req.params.w_id, function (err, ret) {
                if (!err) {//没有err就简单默认操作成功
                    res.redirect('/dashixiongwx/admin/shop/' + req.params.shop_id + '/warehouse/' + req.params.w_id + '/product/list/all')
                    return;
                }
                ld.debug(err);
                res.send(502);
            });
        });
    //取消产品则折扣 add by boy@lufeng
    app.post('/dashixiongwx/admin/shop/:shop_id/warehouse/:w_id/product/:code/cancelDiscount',
        middleware_power.parttime_senior,
        function(req, res){
            var wId = req.params.w_id,
                code = req.params.code;
            dashixiong.cancelDiscountInStore(wId,code,function(err){
                if(err){
                    console.log(err);
                    res.end('xx');
                    return;
                }
                res.end('sus')
            });

    });


    //仓库里的产品上下架
    app.get('/dashixiongwx/admin/shop/:shop_id/warehouse/:w_id/product/:code/status/update/:status_code',
        middleware_power.worker,
        get_shop_info_middleware,
        function (req, res) {
            var code = req.params.status_code - 0,
                product = {
                    code: req.params.code,
                    productStatus: code
                };
            //放出小卖部的售罄功能
//            if( code == 2 && req.shop && req.shop.shopType == 'store' ) product.productStatus = 1;

            dashixiong.updateProductInStore(product, req.params.w_id - 0, function (err, ret) {
                if (!err) {//没有err就简单默认操作成功
                    res.end(JSON.stringify({
                        code: 0,
                        msg: 'sus'
                    }));
                    return;
                }
                ld.debug(err);
                res.end(JSON.stringify({
                    code: 1,
                    msg: 'err' + err
                }));
            });
        });

    app.get('/dashixiongwx/admin/shop/:shop_id/warehouse/:w_id/product/import',
        middleware_power.worker,
        function (req, res) {
            var shop_id = req.params.shop_id;//TODO shop_id应该从cookie当中获得
            var w_id = req.params.w_id;
            //从产品列表导入相应的产品信息到仓库
            dashixiong.importProducts(shop_id, w_id, function (err, ret) {
                res.redirect('/dashixiongwx/admin/shop/' + req.params.shop_id + '/warehouse/' + w_id + '/product/list/all');
            });
        });

    app.get('/dashixiongwx/admin/shop/:shop_id/merrychristmas/:userid/:username/:mobile/:address',
        middleware_power.worker,
        function (req, res) {
            var user_id = req.params.userid;
            var user_name = req.params.username;
            dashixiong.getLuckyByUserId(user_id, function (err, ret) {
                var luck = ret[0];
                var ls;
                try {
                    ls = luck.luckys.split(',');
                } catch (e) {
                }

                render(req, res, 'admin/merrychristmas', {
                    layout: false,
                    ls: ls,
                    user_id: user_id,
                    user_name: user_name,
                    mobile: req.params.mobile,
                    address: req.params.address,
                    luck: luck
                });

            });
        });

    //================================ 设置给各个店推送什么声音 ==================================//
    app.get('/dashixiongwx/admin/shop/:shop_id/set/voice',
        middleware_power.worker,
        function(req, res){
            var shop_id = req.params.shop_id,
                ids = [shop_id, 0],
                isAjax = req.query.isAjax;

            dashixiong.getVoiceByShopId(ids, function(err, ret){
                var voices = sureAry(ret);

                //如果是前端请求，直接返回
                if( isAjax ){
                    end(res, voices);
                    return;
                }

                if( !err){
                    render(req, res, 'admin/set_voice', {
                        layout: 'admin/layout',
                        btns : voices
                    });
                    return;
                }
                ld.debug(err);
            });
        });
    app.post('/dashixiongwx/admin/shop/:shop_id/push/voice',
        middleware_power.boss,
        function(req, res){
            var p = req.body.p;
            uutil.pushVoice(p);
        });
    app.post('/dashixiongwx/admin/shop/:shop_id/product/doadd/voice',
        function(req, res){
            var dir = conf.path.voice_upload_dir;

            var form = new formidable.IncomingForm();
            form.uploadDir = dir;
            form.keepExtensions = true;
            form.on('file',function (field, file) {

            }).on('error',function (e) {
                ld.debug('upload error!', e);
            }).on('end', function () {

            });

            //解析表单数据, 最主要是从parse函数里获取图片的文件名
            form.parse(req, function (err, fields, files) {
                var file_name = files.voice.size ? files.voice.path : '',
                    title = fields.title,
                    v_id = fields.v_id,
                    shop_id = fields.shopId || 0,
                    cur_shop = req.params.shop_id;
                file_name = file_name.substring(dir.length);
                console.log(fields);

                //更新数据库
                if( v_id ){
                    dashixiong.updateVoice({title:title, voice:file_name, shop_id:shop_id, v_id:v_id}, function (err, ret) {
                        if( !err ){
                            res.redirect('/dashixiongwx/admin/shop/'+ cur_shop +'/edit/voice/'+ v_id);
                            return;
                        }
                        ld.debug(err);
                    });
                    return;
                }
                //把声音文件存进数据库
                dashixiong.insertVoice({title:title, voice:file_name, shop_id:shop_id}, function (err, ret) {
                    if( !err ){
                        res.redirect('/dashixiongwx/admin/shop/'+ cur_shop +'/set/voice');
                        return;
                    }
                    ld.debug(err);
                });
            });
        });
    app.get('/dashixiongwx/admin/shop/:shop_id/del/voice/:voice_id',
        middleware_power.boss,
        function(req, res){
            var v_id = req.params.voice_id,
                shop_id = req.params.shop_id;
            dashixiong.delVoiceById(v_id, function(err, ret){
                if( !err ){
                    res.redirect('/dashixiongwx/admin/shop/'+ shop_id +'/set/voice');
                    return;
                }
                console.log(err);
            });
        });
    app.get('/dashixiongwx/admin/shop/:shop_id/edit/voice/:voice_id',
        middleware_power.boss,function(req, res){
            var v_id = req.params.voice_id,
                shop_id = req.params.shop_id;
            dashixiong.getVoiceById(v_id, function(err, ret){
                var voice = sureObj(ret);
                if( !err){
                    render(req, res, 'admin/edit_voice', {
                        layout: 'admin/layout',
                        voice : voice,
                        v_id : v_id
                    });
                    return;
                }
                ld.debug(err);
            });
        });

    //================================== 店铺管理 ============================= //
    app.get('/dashixiongwx/admin/shop/list/all',
        middleware_power.customer_service,
        function (req, res) {
            var y = req.query.y;
            var m = req.query.m;
            var d = req.query.d;

            if (!y) {
                var now = new Date();
                y = now.getFullYear();
                m = now.getMonth() + 1;
                d = now.getDate();
            }

            var dts = Date.UTC(y - 0, m - 1, d - 0);


            dashixiong.getResumesOfDate(y, m, d, function (err, ret) {
                var all = {
                    visitor_count: 0,
                    order_num: 0,
                    total_in: 0,
                    total_cost: 0
                };
                ret.forEach(function (obj) {
                    if (!obj.dataStr) {
                        obj.resume = {
                            profit_rate: 0,
                            visitor_count: 0,
                            order_num: 0,
                            total_in: 0,
                            total_cost: 0
                        };
                        return;
                    }
                    obj.resume = JSON.parse(obj.dataStr);
                    all.visitor_count += obj.resume.visitor_count;
                    all.order_num += obj.resume.order_num;
                    all.total_in += (obj.resume.total_in - 0);
                    all.total_cost += (obj.resume.total_cost - 0);
                });
                all.profit = all.total_in - all.total_cost;
                all.profit_rate = all.profit / all.total_in;

                all.total_in = all.total_in.toFixed(1);
                all.total_cost = all.total_cost.toFixed(1);
                all.profit = all.profit.toFixed(1);

                var obj = uutil.getPreDayAndNextDay(dts);//获取前一天和后一天

                //------lufeng----start-- 拦截权限小于5的只显示他被绑定到的店铺
                var ret2 = [];
                if(req.user.power<3 && req.user.power!=5){
                    var bindToArr = new Array();
                    if( typeof req.user.bindTo == 'number' ) req.user.bindTo += '';
                    bindToArr = req.user.bindTo.split(',');
                    ret.forEach(function(item){
                        for(var i=0; i<bindToArr.length;i++){
                            if(item.id==bindToArr[i]){
                                ret2.push(item);
                            }
                        }
                    });
                }else{
                    ret2 = ret;
                }
                //------lufeng----end -- 拦截权限小于5的只显示他被绑定到的店铺

                render(req, res, 'admin/shop_list', {
                    layout: 'admin/layout_super',
                    shops: ret2,
                    all: all,
                    the_date_y: obj.the_date.getFullYear(),
                    the_date_m: obj.the_date.getMonth() + 1,
                    the_date_d: obj.the_date.getDate(),

                    pre_date_y: obj.pre_date.getFullYear(),
                    pre_date_m: obj.pre_date.getMonth() + 1,
                    pre_date_d: obj.pre_date.getDate(),

                    next_date_y: obj.next_date.getFullYear(),
                    next_date_m: obj.next_date.getMonth() + 1,
                    next_date_d: obj.next_date.getDate()
                });

                //统计功能. 管理员每访问一次这个页面, 就往数据库中插入或更新(upsert)一条当日的业绩统计数据.调用是否成功均不影响实际使用
                dashixiong.upsertResumeOfDate(0, obj.the_date.getFullYear() + '-' + (obj.the_date.getMonth()+1) + '-' + obj.the_date.getDate(), {
                    visitor_count: all.visitor_count,
                    order_num: all.order_num,
                    profit_rate: dashixiong.comput_profit_rate(all.total_in, all.total_cost),
                    total_in: all.total_in,
                    total_cost: all.total_cost
                }, function (err, ret) {
                    err && ld.debug(err);
                });
            });


        });
    app.get('/dashixiongwx/admin/shop/add',
        middleware_power.boss,
        function (req, res) {
            render(req, res, 'admin/shop_add', {
                layout: 'admin/layout_super'
            });
        });
    app.post('/dashixiongwx/admin/shop/doadd',
        middleware_power.boss,
        function (req, res) {
            var shop = req.body.shop;
            dashixiong.insertShop(shop, function (err, ret) {
                res.redirect('/dashixiongwx/admin/shop/list/all');
            });

        });
    app.get('/dashixiongwx/admin/shop/:id/edit',
        middleware_power.boss,
        function (req, res) {
            var shop_id = req.params.id;

            dashixiong.getShopById(shop_id, function (err, ret) {
                render(req, res, 'admin/shop_edit', {
                    layout: true,
                    shop: ret[0]
                });
            });

        });
    app.post('/dashixiongwx/admin/shop/:id/doedit',
        middleware_power.boss,
        function (req, res) {
            var shop = req.body.shop;
            dashixiong.updateShop(shop, function (err, ret) {
                res.redirect('/dashixiongwx/admin/shop/list/all');
            });

        });

//------------------------ Article 文章 ------------------------ //
    //文章类别删除
    app.get('/dashixiongwx/admin/shop/:shop_id/article/del/category/:id',
        middleware_power.worker,
        function (req, res) {
            var id = req.params.id;
            dashixiong.delArticleCategory(id, function (err, ret) {
                if (!err) {
                    res.redirect('/dashixiongwx/admin/shop/' + req.params.shop_id + '/article/list');
                    return;
                }
                res.end(err.toString());
            });
        });
    //文章加权
    app.post('/dashixiongwx/admin/shop/:shop_id/article/sort/category',
        middleware_power.worker,
        function(req,res){
            var sort = req.body.sort,
                id = req.body.id-0;
            dashixiong.sortArticleCategory(sort, id, function (err, ret) {
                if (!err) {
                    res.redirect('/dashixiongwx/admin/shop/' + req.params.shop_id + '/article/list');
                    return;
                }
                res.end(err.toString());
            });

        });

    //文章类别更新
    app.post('/dashixiongwx/admin/shop/:shop_id/article/update/category',
        middleware_power.worker,
        function(req,res){
            var name = req.body.name,
                id = req.body.id-0;
            dashixiong._updateArticleCategory(name, id, function (err, ret) {
                if (!err) {
                    res.redirect('/dashixiongwx/admin/shop/' + req.params.shop_id + '/article/list');
                    return;
                }
                res.end(err.toString());
            });

        });
    app.get('/dashixiongwx/admin/shop/:shop_id/article/post',
        middleware_power.worker,
        function (req, res) {
            var a = new asyncMgr.AsyncAction(),
                ArticleCategory;
            a.register('get category');
            a.onAllDone = function(){
                render(req, res, 'admin/post', {
                    layout: true,
                    ArticleCategory:ArticleCategory
                });
            };
            dashixiong.selectArticleCategory(function(err,_ArticleCategory){
                if (err) {
                    return;
                }
                ArticleCategory = _ArticleCategory;
                a.thisDone('get category');
            });
        });

    app.get('/dashixiongwx/admin/shop/:shop_id/article/img/add',
        middleware_power.worker,
        function (req, res) {
            render(req, res, 'admin/article_img_add', {
                layout: true
            });
        });

    app.post('/dashixiongwx/admin/shop/:shop_id/article/img/doadd',
        //middleware_power.worker,
        function (req, res) {

            var dir = '/home/uploads/dashixiong/articles/';
            if( uutil.isInDevelopment() ){//开发环境如果是MacOS, 竟然叫做'darwin'
                dir = '/Users/auscar/uploads/dashixiong/articles/';
            }
            var dir = conf.path.article_img_upload_dir;

            var form = new formidable.IncomingForm();
            form.uploadDir = dir;
            form.keepExtensions = true;
            form.on('file',function (field, file) {

            }).on('error',function (e) {
                ld.debug('upload error!', e);
            }).on('end', function () {

            });

            //解析表单数据, 最主要是从parse函数里获取图片的文件名
            form.parse(req, function (err, fields, files) {
                var img_name = files.img.path;
                img_name = img_name.substring(dir.length);

                //添加一条关于这张图片的数据库记录, 以后好删除, 或者引用
                dashixiong.insertArticleImg(img_name, function (err, ret) {
                    res.redirect('/dashixiongwx/admin/shop/' + req.params.shop_id + '/article/img/list');
                });
            });

        });
    app.get('/dashixiongwx/admin/shop/:shop_id/article/img/list',
        middleware_power.worker,
        function (req, res) {

            dashixiong.listArticleImgs(function (err, imgs) {
                render(req, res, 'admin/article_img_list', {
                    layout: true,
                    imgs: imgs
                });
            });

        });

    app.get('/dashixiongwx/admin/shop/:shop_id/article/img/:imgid/del/:imgname',
        middleware_power.worker,
        function (req, res) {
            dashixiong.delArticleImg(req.params.imgid, req.params.imgname, function (err, ret) {
                res.redirect('/dashixiongwx/admin/shop/' + req.params.shop_id + '/article/img/list');
            });
        });


    app.get('/dashixiongwx/admin/shop/:shop_id/article/list',
        middleware_power.worker,
        function (req, res) {
            var a = new asyncMgr.AsyncAction(),
                articles,ArticleCategory;
            a.register('get articles');
            a.register('get category');
            a.onAllDone = function(){
                render(req, res, 'admin/article_list', {
                    layout: true,
                    articles: articles,
                    ArticleCategory:ArticleCategory
                });
            };
            dashixiong.listArticles(req.params.shop_id, function (err, _articles) {
                if( err ) console.log(err);
                _articles.forEach(function (article, i) {
                    article.intime = new Date(article.timeStamp).format('yyyy-mm-dd HH:MM:ss');
                });
                articles = _articles;
                a.thisDone('get articles');
            });
            dashixiong.selectArticleCategory(function(err,_ArticleCategory){
                if (err) {
                    return;
                }
                ArticleCategory = _ArticleCategory;
                a.thisDone('get category');
            });
        });

    app.post('/dashixiongwx/admin/shop/:shop_id/article/doedit/:id',
        middleware_power.worker,
        function (req, res) {
            var article = req.body.article;

            dashixiong.updateArticle(article, function (err, ret) {
                if (!err) {
                    res.redirect('/dashixiongwx/admin/shop/' + req.params.shop_id + '/article/list');
                    return;
                }
                res.end(err.toString());
            });

        });

    app.post('/dashixiongwx/admin/shop/:shop_id/article/preview',
        middleware_power.worker,
        function (req, res) {
            var article = {
                id: 0,
                title: req.body.title,
                content: md(req.body.content)
            };
            render(req, res, 'wx/article_detail', {
                layout: true,
                title: article.title + ' - 预览',
                article: article,
                likes: [],
                comments: []
            });
        });
    //向数据表ArticleCategory中插入文章类别
    app.post('/dashixiongwx/admin/shop/:shop_id/article/insertCategory',
        middleware_power.worker,
        function(req,res){
            var name =req.body.name;
            dashixiong.insertArticleCategory(name,function(err,ret){
                if (!err) {
                    res.redirect('/dashixiongwx/admin/shop/' + req.params.shop_id + '/article/list');
                    return;
                }
                ld.debug(err);
            });
        });

    app.post('/dashixiongwx/admin/shop/:shop_id/article/dopost',
        middleware_power.worker,
        function (req, res) {
            var title = req.body.title;
            var content = req.body.content;
            var shop_id = req.body.shop_id-0;
            var categoryid = req.body.categoryid-0;
            var user_id = req.cookies.user_id - 0;

            dashixiong.getUserById(user_id, function (err, ret) {
                if (err) {
                    end(res, err);
                    return;
                }
                var user = ret[0];
                var article = {
                    user_id: user_id,
                    author: user.nick,
                    shop_id: shop_id,
                    categoryid: categoryid,
                    title: title,
                    content: content,
                    intime: new Date().getTime()
                };

                //存数据库啦
                dashixiong.insertArticle(article, function (err, ret) {
                    if (!err) {
                        var id_insert = ret.insertId;
                        res.redirect('/dashixiongwx/admin/shop/' + req.params.shop_id + '/article/list');
                        return;
                    }
                });
            });


        });

//------------------------------- Msg 业务 -----------------------------------//
    //----------------zed------------所有Msg---------start-----
    app.get('/dashixiongwx/admin/shop/:shop_id/msg/listall',
        middleware_power.parttime_senior,//高级兼职及以上权限可查看
        get_shop_info_middleware,
        function (req, res) {
            var shop_id = req.params.shop_id;
            dashixiong.listallMsgs(shop_id, 30, function (err, msgs) {
                var ids = [];
                msgs.forEach(function (msg, i) {
                    msg.intime = uutil.getTimeTxt(msg.timeStamp);
                    if (msg.fromUserId.indexOf('s_') == -1) {//非's_'开头的id就是普通用户的id
                        var temp_id = msg.fromUserId.substr(2) - 0;
                        if(temp_id) ids.push(temp_id);
                    }
                    if (msg.ext) {
                        try {
                            msg.ext = JSON.parse(msg.ext);
                        } catch (e) {
                        }
                    }
                });
                dashixiong.getUsersWithIds(ids, function (err, users) {
                    render(req, res, 'admin/msg_all_list', {
                        layout: 'admin/layout',
                        msgs: msgs,
                        users: users,
                        msg_list: 'ui-state-active'
                    });
                });
            });

        });
    //----------------zed------------所有Msg----------end----
    app.get('/dashixiongwx/admin/shop/:shop_id/msg/list',
        middleware_power.parttime_senior,//高级兼职及以上权限可查看
        get_shop_info_middleware,
        function (req, res) {
            var shop_id = req.params.shop_id;
            dashixiong.listMsgs(shop_id, 30, function (err, msgs) {
                var ids = [];
                msgs.forEach(function (msg, i) {
                    msg.intime = uutil.getTimeTxt(msg.timeStamp);
                    if (msg.fromUserId.indexOf('s_') == -1) {//非's_'开头的id就是普通用户的id
                        ids.push(msg.fromUserId.substr(2) - 0);
                    }
                    if (msg.ext) {
                        try {
                            msg.ext = JSON.parse(msg.ext);
                        } catch (e) {
                        }
                    }
                });

                dashixiong.getUsersWithIds(ids, function (err, users) {
                    render(req, res, 'admin/msg_list', {
                        layout: 'admin/layout',
                        msgs: msgs,
                        users: users,
                        msg_list: 'ui-state-active'
                    });
                });
            });

        });

//显示与某个用户之间的对话内容
    app.get('/dashixiongwx/admin/shop/:shop_id/msg/:user_id/list', get_shop_info_middleware,
        middleware_power.parttime_senior,
        function (req, res) {
            var shop_id = req.params.shop_id;
            var user_id = req.params.user_id;

            dashixiong.listUserMsgs(shop_id - 0, user_id - 0, 30, function (err, msgs) {
                var ids = [];
                var session_user = {};//用户对象. 这个web请求查看的就是小卖部客服煜这个用户之间的对话
                var from_user_id = null;
                msgs.forEach(function (msg, i) {
                    msg.intime = uutil.getTimeTxt(msg.timeStamp);
                    from_user_id = msg.fromUserId;
                    if (from_user_id.indexOf('s_') == -1) {//非's_'开头的id就是普通用户的id
                        ids.push(from_user_id.substr(2) - 0);

                    }
                    if (msg.ext) {//消息的额外信息. 非文本消息才有. 如图片消息, 则这里面是图片地址. 如果是声音消息则是mediaId, 可以通过这个id到微信上去取
                        try {
                            msg.ext = JSON.parse(msg.ext);
                        } catch (e) {
                        }
                    }
                });

                dashixiong.getUserById(user_id, function (err, ret) {
                    session_user = ret[0];
                    api.getUser(session_user.openId, function (err, wx_user) {
                        if (err) {
                            render(req, res, 'admin/msg_user_list', {
                                layout: 'admin/layout',
                                msgs: msgs,
                                session_user: session_user
                            });//end render
                            return;
                        }
                        session_user.head = wx_user.headimgurl;
                        dashixiong.updateUser({
                            id: session_user.id,
                            head: wx_user.headimgurl
                        }, function (err, ret) {
                            render(req, res, 'admin/msg_user_list', {
                                layout: 'admin/layout',
                                msgs: msgs,
                                session_user: session_user
                            });//end render
                        });//end updateUser
                    });//end api.getUser
                });//end getUserById

            });

        });
//ajax 显示id小于msg_id的消息-----zed----加载所有用户消息
    app.get('/dashixiongwx/admin/shop/:shop_id/msg/list/all/:msg_id/:limit',
        middleware_power.parttime_senior,
        function (req, res) {
            var shop_id = req.params.shop_id - 0;
            var msg_id = req.params.msg_id - 0;
            var limit = req.params.limit - 0;

            dashixiong.getSomeMsgsallLaterThan(shop_id, limit, msg_id, function (err, msgs) {
                if (err) {
                    end(res, {
                        code: 1,
                        msgs: [],
                        msg: err.toString()
                    });
                    return;
                }
                var ids = [];
                var from_user_id;
                msgs.forEach(function (msg, i) {
                    from_user_id = msg.fromUserId;
                    if (from_user_id.indexOf('s_') == -1) {//非's_'开头的id就是普通用户的id
                        ids.push(from_user_id.substr(2) - 0);
                    }
                    msg.intime = uutil.getTimeTxt(msg.timeStamp);
                    if (msg.ext) {
                        try {
                            msg.ext = JSON.parse(msg.ext);
                        } catch (e) {
                        }
                    }
                });

                dashixiong.getUsersWithIds(ids, function (err, users) {
                    end(res, {
                        code: 0,
                        msgs: msgs,
                        users: users
                    });
                });


            });

        });

//ajax 显示id小于msg_id的消息
    app.get('/dashixiongwx/admin/shop/:shop_id/msg/list/:msg_id/:limit',
        middleware_power.parttime_senior,
        function (req, res) {
            var shop_id = req.params.shop_id - 0;
            var msg_id = req.params.msg_id - 0;
            var limit = req.params.limit - 0;

            dashixiong.getSomeMsgsLaterThan(shop_id, limit, msg_id, function (err, msgs) {
                if (err) {
                    end(res, {
                        code: 1,
                        msgs: [],
                        msg: err.toString()
                    });
                    return;
                }
                var ids = [];
                var from_user_id;
                msgs.forEach(function (msg, i) {
                    from_user_id = msg.fromUserId;
                    if (from_user_id.indexOf('s_') == -1) {//非's_'开头的id就是普通用户的id
                        ids.push(from_user_id.substr(2) - 0);
                    }
                    msg.intime = uutil.getTimeTxt(msg.timeStamp);
                    if (msg.ext) {
                        try {
                            msg.ext = JSON.parse(msg.ext);
                        } catch (e) {
                        }
                    }
                });

                dashixiong.getUsersWithIds(ids, function (err, users) {
                    end(res, {
                        code: 0,
                        msgs: msgs,
                        users: users
                    });
                });


            });

        });

//ajax获取与某个人(:session_user_id所标示)之间的对话（<msg_id）
    app.get('/dashixiongwx/admin/shop/:shop_id/msg/:session_user_id/list/:msg_id/:limit',
        middleware_power.parttime_senior,
        function (req, res) {
            var shop_id = req.params.shop_id - 0;
            var msg_id = req.params.msg_id - 0;
            var limit = req.params.limit - 0;
            var session_user_id = req.params.session_user_id;

            dashixiong.getSomeUserMsgsLaterThan(shop_id, limit, session_user_id, msg_id, function (err, msgs) {
                if (err) {
                    end(res, {
                        code: 1,
                        msgs: [],
                        msg: err.toString()
                    });
                    return;
                }
                msgs.forEach(function (msg, i) {
                    msg.intime = uutil.getTimeTxt(msg.timeStamp);
                    if (msg.ext) {
                        try {
                            msg.ext = JSON.parse(msg.ext);
                        } catch (e) {
                        }
                    }
                });

                end(res, {
                    code: 0,
                    msgs: msgs
                });

            });

        });


    app.get('/dashixiongwx/shop/:shop_id/download/media/:media_id', function (req, res) {
        var wx_app_id = conf.wx.wx_app_id;
        var wx_app_secret = conf.wx.wx_app_secret;
        var media_id = req.params.media_id;

        request({
            url: 'https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=' + wx_app_id + '&secret=' + wx_app_secret
        }, function (err, res_obj, body) {
            var obj = JSON.parse(body);
            var access_token = obj.access_token;
            var url = 'http://file.api.weixin.qq.com/cgi-bin/media/get?access_token=' + access_token + '&media_id=' + media_id;
            //request( url ).pipe( res );//pipe不知道为什么不好使
            end(res, {
                code: 0,
                url: url
            });
        });

    });
//微信接口选择路由@wuyong
    app.post('/dashixiongwx/admin/shop/:shop_id/reply/grantSelect',
        middleware_power.parttime_senior,
        function (req, res) {
            var grantSelect = req.body.grantSelect;
            if(grantSelect == 0) {
                selectTemp = api_hjdsx;
            } else if(grantSelect == 1){
                selectTemp = api;
            } else{
                return;
            }
        });



//通过微信接口回复用户
    app.post('/dashixiongwx/admin/shop/:shop_id/reply',
        middleware_power.parttime_senior,
        function (req, res) {
            var shop_id = req.params.shop_id;
            var msg = req.body.msg;
            var to_user_id = msg.toUserId;
            to_user_id = to_user_id.substr(2);

            //获取这些个用户微信id
            dashixiong.getUserById(to_user_id - 0, function (err, ret) {
                if (err) {
                    end(res, {
                        code: 1,
                        err: err,
                        msg: 'db error'
                    });
                    return;
                }
                var user = ret[0];

                dashixiong.getToReadNoticeForUser(user, function (err, notice_content) {
                    if (notice_content) {
                        msg.content += '\n\n==== 华丽的公告 ====\n';
                        msg.content += notice_content;
                    }
                    console.log('========= to ' + user.openId + ' =============');
                    console.log(msg.content);
                    console.log('=====================================================');
//                    api_hjdsx.sendText(user.openId, msg.content, function (err, ret) {
                    selectTemp.sendText(user.openId, msg.content, function (err, ret) {
                        if (err) {
                            console.log(err);
                            end(res, {
                                code: 2,
                                err: err + ' 【可能两天没交互】',
                                msg: 'weixin error'
                            });
                            return;
                        }

                        if (ret.errcode) {//微信那边返回失败状态码
                            console.log(ret);
                            end(res, {
                                code: 3,
                                msg: ret.errmsg + '【可能两天没交互】'
                            });
                            return;
                        }

                        //发送成功
                        end(res, {
                            code: 0,
                            msg: 'sus'
                        });
                        dashixiong.insertMsg(msg, function (err, ret) {
                            var p = {
                                msg_id: msg.targetId - 0,
                                reply: ret.insertId
                            };
                            dashixiong.updateMsg(p, function (err, ret) {
                            });
                        });

                    });//end setText
                });//end getToReadNoticeForUser
            });//end getUserById
        });
    app.get('/dashixiongwx/shop/:shop_id/products',
        middleware_power.worker,
        function (req, res) {
            dashixiong.listProducts(req.params.shop_id, function (err, ret) {
                render(req, res, 'admin/product_list_all_inproduct', {
                    layout: true,
                    products: ret
                });
            });
        });

    app.get('/dashixiongwx/admin/shop/:shop_id/setting/list',
        middleware_power.worker,
        function (req, res) {
            var settings = [];
            var users = [];
            var num_takeway = 0;
            var y = req.params.y,
                m = req.params.m,
                d = req.params.d,
                dt = new Date();

            if (y && m && d) {
                dt.setFullYear(y - 0);
                dt.setMonth(m - 0 - 1);
                dt.setDate(d - 0);
            } else {
                y = dt.getFullYear();
                m = dt.getMonth() + 1;
                d = dt.getDate();
            }

            //从0点开始
            dt.setHours(0);
            dt.setMinutes(0);
            dt.setSeconds(0);

            var time_stamp_start = dt.getTime();

            var a = new asyncMgr.AsyncAction();
            a.register('get_shop_users');
            a.register('get_shop_settings');
            a.register('get_takeaway_num');

            a.onAllDone = function () {
                var new_users_today_num = 0;

                users.forEach(function (user, i) {
                    if (uutil.isToday(user.timeStamp)) {
                        ++new_users_today_num;
                    }
                });

                render(req, res, 'admin/setting_list', {
                    layout: 'admin/layout',
                    sets: settings,
                    users_num: users.length,
                    users_num_today: new_users_today_num,
                    num_takeway: num_takeway
                });
            };

            //获取店铺的用户数
            dashixiong.getUsersOfShop(req.params.shop_id - 0, function (err, _users) {
                _users && ( users = _users );
                a.thisDone('get_shop_users');
            });

            //店铺设置
            dashixiong.listSettings(req.params.shop_id, function (err, ret) {
                ret && ( settings = ret );
                a.thisDone('get_shop_settings');
            });

            //外卖单查看数
            dashixiong.getTodayLogNumOfLogKey('enter_takeaway', req.params.shop_id - 0, time_stamp_start, function (err, ret) {
                ret = sureAry(ret);
                console.log('num===>>>enter_takeaway', err, ret[0] ? ret[0].num : 0);
                ret && ( num_takeway = (ret[0] ? ret[0].num : 0) );
                a.thisDone('get_takeaway_num');
            });

        });

//店铺更改自己的店的设置, ajax请求
    app.post('/dashixiongwx/admin/shop/:shop_id/setting/doedit',
        middleware_power.worker,
        function (req, res) {
            dashixiong.updateSettingOfShop(req.body.setting_key, req.body.setting_value.replace(/\s*/g, ''), req.body.shop_id - 0, function (err, ret) {
                if (err) {
                    end(res, {
                        code: 1,
                        msg: 'fail',
                        err: err
                    });
                    return;
                }
                end(res, {
                    code: 0,
                    msg: 'sus'
                });
            });
        });

//最大的管理员每个分店的配置, 主要是随着业务的发展, 可能需要新的配置, 那就在这这个页面进行管理
    app.get('/dashixiongwx/admin/setting/list',
        middleware_power.boss,
        function (req, res) {
            //每个店铺拥有的配置是一样的, 所以采用1号店的配置来展示配置列表
            dashixiong.listSettings(1, function (err, ret) {
                render(req, res, 'admin/setting_list_super', {
                    layout: 'admin/layout_super',
                    sets: ret
                });
            });


        });

    app.get('/dashixiongwx/admin/setting/add',
        middleware_power.boss,
        function (req, res) {
            render(req, res, 'admin/setting_add_super', {
                layout: 'admin/layout_super'
            });
        });

//列出当前每个店铺(每个店铺拥有的配置项相同,但是值不同)的配置
    app.post('/dashixiongwx/admin/setting/doadd',
        middleware_power.boss,
        function (req, res) {
            var setting_name = req.body.name;
            dashixiong.addSettingForAllShops(setting_name, function (err, ret) {
                res.redirect('/dashixiongwx/admin/setting/list');
            });
        });
    app.get('/dashixiongwx/admin/setting/del/:setting_name',
        middleware_power.boss,
        function (req, res) {
            dashixiong.delSettingByName(req.params.setting_name, function () {
                res.redirect('/dashixiongwx/admin/setting/list');
            });
        });


//------------------------------------------------ Todo ------------------------------//
    app.get('/dashixiongwx/admin/shop/:shop_id/todo/add',
        middleware_power.worker,
        function (req, res) {
            render(req, res, 'admin/todo_add', {
                layout: 'admin/layout'
            });
        });
    app.post('/dashixiongwx/admin/shop/:shop_id/todo/doadd',
        middleware_power.worker,
        function (req, res) {
            var content = req.body.content;
            if (!content) {
                end(res, 'content is needed!');
                return;
            }

            dashixiong.addTodo({
                content: content,
                shop_id: req.params.shop_id
            }, function () {
                res.redirect('/dashixiongwx/admin/shop/' + req.params.shop_id + '/order/list');
            });
        });

    app.get('/dashixiongwx/admin/shop/:shop_id/todo/list',
        middleware_power.parttime_senior,
        function (req, res) {
            render(req, res, 'admin/todo_add', {
                layout: 'admin/layout'
            });
        });

//ajax 删除todo接口
    app.get('/dashixiongwx/admin/shop/:shop_id/todo/del/:todo_id',
        middleware_power.worker,
        function (req, res) {
            dashixiong.delTodo(req.params.todo_id, function (err, ret) {
                if (err) {
                    end(res, {
                        code: 1,
                        msg: err
                    });
                    return;
                }
                end(res, {
                    code: 0,
                    msg: 'sus'
                });
            });
        });

//---------------------------------------------- QR 二维码 --------------------------------//
//本店的二维码管理
    app.get('/dashixiongwx/admin/shop/:shop_id/qr',
        middleware_power.worker,
        function (req, res) {
            render(req, res, 'admin/qr_manage', {
                layout: 'admin/layout_super'
            });
        });

//查看本店二维码
    app.get('/dashixiongwx/admin/shop/:shop_id/qr',
        middleware_power.worker,
        function (req, res) {
            var shop_id = req.params.shop_id;

            wx_qr_creator.getQRURL(shop_id, function (err, url) {
                request.get(url).pipe(res);
            });

        });

//返回任意scene_id 的二维码
    app.get('/dashixiongwx/admin/qr/make',
        middleware_power.parttime_senior,
        function (req, res) {
            var scene_id = req.query.scene_id;
            var shopId = req.query.shopId;

            wx_qr_creator.getQRURL(scene_id, function (err, url) {
                render(req, res, 'wx/qr', {
                    layout: 'admin/layout_super',
                    img_url: url,
                    scene_id: scene_id,
                    shopId: shopId
                });
            });

        });


//--------------------------------------------------------------- 测试 ----------------------------------------//
    app.get('/upload', function (req, res) {
        render(req, res, 'admin/test_upload', {
            layout: false

        });
    });

    app.post('/dashixiongwx/admin/shop/:shop_id/doupload',
        middleware_power.worker,
        function (req, res) {
            var id = req.params.id;
            //formidable获取整个产品数据，包括图片

            var dir = '/home/uploads/dashixiong/products/';
            if( uutil.isInDevelopment() ) {//开发环境如果是MacOS, 竟然叫做'darwin'
                //dir = '/Users/auscar/uploads/dashixiong/products/';
                dir = '/Users/beetle/projects/uploads/dashixiong/products/';
            }


            var form = new formidable.IncomingForm();
            form.uploadDir = dir;
            form.keepExtensions = true;
            form.on('file',function (field, file) {
            }).on('error',function (e) {
                ld.debug('upload error!' + e);
            }).on('end', function (data) {
            });


            //解析表单数据, 最主要是从parse函数里获取图片的文件名
            form.parse(req, function (err, fields, files) {
                end(res, files);
            });

        });


//------------------------ 合作伙伴可以看到产品的销量
    app.get('/dashixiongwx/shop/:shop_id/product/trend/:p_id/:nums_of_day', function (req, res) {
        var p_id = req.params.p_id - 0;
        var num = req.params.nums_of_day - 0;

        if (p_id != 513) {
            end(res, '不能查看其他产品的销量哦');
            return;
        }

        var timestamp = uutil.getTimeStampDaysBefore(num);
        var obj = uutil.getDateStartAndEndTimeStamp(timestamp);

        console.log(p_id, num, obj.time_stamp_start);

        //获取num 天前到现在的所有订单, 然后从这些订单中统计某产品的销售数据
        dashixiong.listValidOrders(req.params.shop_id, obj.time_stamp_start, new Date().getTime(), 0, function (err, orders) {
            var ret = [];
            var snapshot;
            //挨个订单看看他们都买了什么
            orders.forEach(function (order, i) {
                try {
                    snapshot = JSON.parse(order.snapshot);
                    snapshot.products_bought.forEach(function (product, i) {
                        if (product.id == p_id) {//在这个订单中看到目标产品, 记下来
                            ret.push({
                                time_stamp: order.timeStamp,
                                count: product.count,
                                title: product.title
                            });
                        }
                    });
                } catch (e) {
                    ld.debug(e);
                }
            });

            //统计每一天, 这个产品的销量
            var map = {};
            var label_date = null;
            ret.forEach(function (v, i) {
                label_date = new Date(v.time_stamp).format('mm-dd');
                if (!map[ label_date ]) {
                    map[ label_date ] = {
                        label: label_date,
                        num: 0
                    }
                }
                map[ label_date ].num += v.count;
            });

            var data_obj = [];
            var total = 0;
            for (p in map) {
                console.log(map[p]);
                total += map[p].num;
                data_obj.push(map[p]);
            }
            //按照时间先后排序
            data_obj.sort(function (a, b) {
                if (a.label > b.label)return -1;
                if (a.label < b.label)return 1;
            });

            render(req, res, 'wx/product_trend', {
                ary_data: data_obj,//每天的销量多少, 是一个数组
                product: ret[0],//产品信息
                nums_of_day: num,//最近n天
                total: total//最近$nums_of_day天的总销量
            });

        });


    });


//--------------------------- user ------------------------//
//管理用户功能
    app.get('/dashixiongwx/admin/shop/:shop_id/user/list/all',
        middleware_power.customer_service,
        function (req, res) {

            var last_orders = null;
            var address_map = {};
            var shop_id = req.params.shop_id;

            var a = new asyncMgr.AsyncAction();
            a.register('get_user_address');
            a.register('get_last_orders');
            a.onAllDone = function () {
                render(req, res, 'admin/user_list', {
                    layout: true,
                    last_orders: last_orders,
                    address_map: address_map
                });

            };

            dashixiong.getLastOrdersOfUsers(shop_id, function (err, orders) {
                if (!err) {
                    last_orders = orders;
                    orders.forEach(function (order, i) {
                        order.intime = uutil.getDateTextByTimeStamp(order.timeStamp);
                        order.time_text = uutil.getTimeTxt(order.timeStamp);
                        order.user_active_status = uutil.getUserActiveStatus(order.timeStamp);
                    });
                    a.thisDone('get_last_orders');
                    return;
                }
                a.thisDone('get_last_orders');
                ld.debug(err);
            });

            dashixiong.getAddress(null, function (err, address) {
                if (!err) {
                    address.forEach(function (addr, i) {
                        if (!address_map[ addr.userId ]) {
                            address_map[ addr.userId ] = [];
                        }
                        address_map[ addr.userId ].push(addr);
                    });
                    a.thisDone('get_user_address');
                    return;
                }
                a.thisDone('get_user_address');
                ld.debug(err);
            });

        });

    app.get('/dashixiongwx/admin/shop/:shop_id/user/assignment', function (req, res) {
        render(req, res, 'admin/assignment', {
            layout: true
        });
    });

    app.get('/dashixiongwx/admin/shop/:shop_id/order/assignment', function (req, res) {
        var a = new asyncMgr.AsyncAction(),
            shop;
        a.register('get shop');
        a.onAllDone = function(){
            render(req, res, 'admin/assignment_order', {
                layout: true,
                shop : shop
            });
        };
        dashixiong.selectShop(function(err,_shop){
            if (err) {
                return;
            }
            shop = _shop;
            a.thisDone('get shop');
        });

    });


    var check_number = function (val) {
        if (!val || val - 0 < 1 || isNaN(val)) {
            return true;
        }
        return false;
    };

    app.post('/dashixiongwx/admin/user/doassignment', function (req, res) {
        var id = req.body.userId || 0;
        var shop_id = req.body.shopId || 0;
        // userId 存在, 是数字, 大于0
        if (check_number(id)) {
            end(res, '请输入正确用户Id');
            return;
        }

        var user = {};
        user.id = id;
        user.shopId = shop_id;
        user.bindTo = shop_id;
        dashixiong.updateUser(user, function (err, ret) {
            if (!err) {
                end(res, '客户转店成功');
                return
            }
            endErr(res, err);
        });
    });

    app.post('/dashixiongwx/admin/order/doassignment', function (req, res) {

        var id = req.body.orderId;
        var shop_id = req.body.shopId;
        // userId 存在, 是数字, 大于0
        if (check_number(id)) {
            end(res, '请输入正确订单Id');
            return;
        }

        // shopId存在, 是数字, 大于0
        if (check_number(shop_id)) {
            end(res, '请选择店铺');
            return;
        }

        var order = {};
        order.id = id;
        order.shopId = shop_id;
        dashixiong.updateOrderShopId(order, function (err, ret) {
            if (!err) {
                end(res, '订单转店成功,请通知==> ' + shop_id + '号店的成员配送订单 ');
                return
            }
            endErr(res, err);
        });
    });

//显示出用户的相关的信息
    app.get('/dashixiongwx/admin/shop/:shop_id/user/profile/:target_user_id',
        middleware_power.parttime_senior,
        function (req, res) {
            var target_user_id = req.params.target_user_id - 0;
            var user_id = req.cookies.user_id - 0;
            var comments = [];
            var user = {};
            var target_user = {};

            var a = new asyncMgr.AsyncAction();
            a.register('get_target_user_info');//目标用户, 即你需要给他写备注的那个用户
            a.register('get_user_info');//当前查看这个数据的用户数据
            a.register('list_comments');

            a.onAllDone = function () {
                render(req, res, 'admin/user_profile', {
                    target_user_id: target_user_id,
                    user: user,
                    target_user: target_user,
                    comments: comments
                });//end render
            };

            dashixiong.getUserById(user_id, function (err, ret) {
                if (!err && ret[0]) {
                    user = ret[0];
                }
                a.thisDone('get_user_info');
            });

            dashixiong.getUserById(target_user_id, function (err, ret) {
                if (!err && ret[0]) {
                    target_user = ret[0];
                }
                a.thisDone('get_target_user_info');
            });


            admin.listUserComments(target_user_id, function (err, user_comments) {
                if (user_comments && user_comments.length) {
                    user_comments.forEach(function (comment) {
                        comment.timeTxt = uutil.getTimeTxt(comment.timeStamp);
                    });
                    comments = user_comments;
                }
                a.thisDone('list_comments');
            });//end listUserComments


        });

//添加一条对用户的备注
    app.post('/dashixiongwx/admin/shop/:shop_id/user/comment/doadd',
        middleware_power.parttime_senior,
        function (req, res) {
            var comment = {
                content: req.body.content,
                target_user_id: req.body.target_user_id,
                author_name: req.body.author_name
            };
            admin.insertComment(comment, function (err, ret) {
                res.redirect('/dashixiongwx/admin/shop/' + req.params.shop_id + '/user/profile/' + req.body.target_user_id)
            });

        });

//删除一条用户的备注
    app.get('/dashixiongwx/admin/shop/:shop_id/user/:target_user_id/comment/del/:comment_id',
        middleware_power.parttime_senior,
        function (req, res) {
            admin.delUserComment(req.params.comment_id - 0, function (err, ret) {
                res.redirect('/dashixiongwx/admin/shop/' + req.params.shop_id + '/user/profile/' + req.params.target_user_id);
            });
        });

//显示用户排行榜, 主要是按照利润/销售额进行排序
    app.get('/dashixiongwx/admin/shop/:shop_id/user/sort',
        middleware_power.shopkeeper,
        function (req, res) {
            var shop_id = req.params.shop_id;
            dashixiong.listUsersProfit(shop_id, function (err, ret) {
                var ids = [];
                ret.forEach(function (user_profit) {
                    ids.push(user_profit.userId);
                });

                dashixiong.getAllAddress(ids, function (err, address) {
                    var users_addr_map = {};
                    //归类地址
                    address.forEach(function (addr) {
                        if (!users_addr_map[ addr.userId ]) {
                            users_addr_map[ addr.userId ] = [];
                        }
                        users_addr_map[ addr.userId ].push(addr);
                    });

                    //只取一个地址
                    for (var p in users_addr_map) {
                        //users_addr_map[ p ] = users_addr_map[ p ][ users_addr_map[ p ].length-1 ];
                        users_addr_map[ p ] = users_addr_map[ p ][ 0 ];
                    }
                    console.log(users_addr_map[2519])
                    render(req, res, 'admin/user_sort', {
                        user_profits: ret,
                        users_addr_map: users_addr_map
                    });
                });


            });

        });

//排行榜数据更新. 重新算一次数据然后存起来
    app.get('/dashixiongwx/admin/shop/:shop_id/user/sort/update',
        middleware_power.shopkeeper,
        function (req, res) {
            var shop_id = req.params.shop_id - 0;
            dashixiong.delUserProfits(shop_id, function (err, ret) {//先删除掉
                dashixiong.makeUserSoldData(shop_id, function (err, ret) {
                    console.log(err, ret);
                    res.redirect('/dashixiongwx/admin/shop/' + req.params.shop_id + '/user/sort');
                });
            });

        });


    var two = function (num) {
        if (num < 10) {
            return '0' + num;
        }
        return num;
    };

//显示出我们的服务的覆盖范围, 用table 表示出来: 绿色的格子就是下过单的宿舍(无论是买东西下单, 还是搞活动下单)
    app.get('/dashixiongwx/admin/shop/:shop_id/user/distribution',
        middleware_power.shopkeeper,
        function (req, res) {
            var shop_id = req.params.shop_id - 0;
            var p = require('../res/room_parsers/shop_' + shop_id);

            var addressParser = p.parser;//这个学校的宿舍
            var buildings = p.buildings;

            dashixiong.getAddressOfShop(shop_id, function (err, address) {
                var tmp;
                var address_map = {};
                address.forEach(function (add, i) {
                    tmp = addressParser(add.address);
                    if (tmp) {
                        address_map[ tmp.building + '-' + two(tmp.room) ] = tmp;
                    }
                });

                var ret = [];
                var tmp_ary_build;
                var tmp_ary_row;
                var tmp_room_num;
                buildings.forEach(function (building, b_i) {
                    tmp_ary_build = [];
                    for (var i = building.row - 1; i >= 0; i--) {
                        tmp_ary_row = [];
                        for (var j = 0; j < building.col; j++) {
                            tmp_room_num = (b_i + 1) + '-' + (i + 1) + two(j + 1);
                            tmp_ary_row.push({
                                row: i + 1,
                                col: two(j + 1),
                                has_bought: address_map[ tmp_room_num ]
                            });
                        }
                        tmp_ary_build.push(tmp_ary_row);
                    }
                    ret.push(tmp_ary_build);
                });


                //用这些数据渲染页面
                render(req, res, 'admin/user_distribution', {
                    address_map: address_map,
                    buildings: ret
                });
            });

        });

    //打印进货单
    app.get('/dashixiongwx/admin/shop/:shop_id/show/warningList',
        middleware_power.worker,
        function (req, res) {
            var shop_id = req.params.shop_id || 0;
            var str = '';
            var newStr ;
            var arr ;//本店所有货架上的产品ID
            var tmp = [];
            dashixiong.getProIdsByShopId(shop_id, function(err, pIds){
                if(err){
                    console.log(err);
                    return;
                }
                pIds.forEach(function(doEle, i){
                    if(doEle.content.substr(0,1) == '['){
                        doEle.content = doEle.content.substr(1);
                    }
                    doEle.content = doEle.content.substring(0,doEle.content.length-1)+',';
                    str += doEle.content;
                });
                str = str.substring(0,str.lastIndexOf(','));
                newStr = str.replace(/\"/g,"");
                arr = newStr.split(',');
                //排重
                for(var i=0;i<arr.length;i++) {
                    if(arr[i]) {
                        if(tmp.indexOf(arr[i]) == -1){
                            tmp.push(arr[i]);
                        }
                    }
                }
                admin.getWarningList(shop_id, tmp, function (err, ret) {
                    if(err){
                        console.log(err);
                        return;
                    }
                    if (!err) {
                        //用这些数据渲染页面
                        render(req, res, 'admin/show_warningList', {
                            lists: sureAry(ret)
                        });
                        return;
                    }
                   /* endErr(res, err);*/

                });
            });


        });

    //查询兼职推广情况
    var getRatio = function( num, ratio ){
        var ary = [],
            marker = {},
            n = 0,
            returnVal = 1;
        ratio = ratio || conf.promotion_info.ratio;
        ratio.forEach(function(v, i){
            for(var p in v){
                var key = p,
                    value = v[p];
                ary.push(key);
                marker[key] = value;
            }
        });
        var maxNum = ary[ary.length-1];
        for(var i = 0, len = ary.length; i < len; i++){
            var val = ary[i];
            if( num > maxNum ){
                returnVal = marker[maxNum];
                break;
            }
            if( num == val ){
                returnVal = marker[val];
                break;
            }
            if( num < val ){
                returnVal = marker[ary[i-1]];
                break;
            }
        }
        return returnVal;
    };
    app.get('/dashixiongwx/admin/shop/:shop_id/show/promotionList',
        middleware_power.worker,
        function (req, res) {
            var shop_id = req.params.shop_id || 0,
                promotion = req.query.promotion || {},
                rules = promotion.rules,
                ratio = null;

            if( rules ){
                rules = JSON.parse(rules);
                ratio = rules.ratio;
            }

            if( promotion.isPost && (!promotion.start_time || !promotion.end_time) ){
                end(res, '请输入开始时间或截止时间');
                return;
            }

            promotion['shop_id'] = shop_id;
            promotion['start_int'] = new Date(promotion.start_time).getTime();
            promotion['end_int'] = new Date(promotion.end_time).getTime();

            admin.getPromotionList(promotion, function (err, ret, follow) {
                if (!err) {
                    //用这些数据渲染页面
                    render(req, res, 'admin/show_promotionList', {
                        orders: sureAry(ret),
                        follow : follow,
                        shop_id : shop_id,
                        base : rules ? rules.base : conf.promotion_info.base,
                        ratio : getRatio(sureAry(ret).length, ratio),
                        ratioInfo : JSON.stringify(rules || conf.promotion_info),
                        word : promotion.word,
                        start_time : promotion.start_time || '2014-08-09 00:00:00',
                        end_time : promotion.end_time || '2014-08-12 00:00:00'
                    });
                    return;
                }
                endErr(res, err);
            });
        });

    //合并仓库(其实就是拷贝货架信息)
    app.post('/dashixiongwx/admin/shop/:shop_id/copy/sections',
        middleware_power.shopkeeper,
        function(req, res){
            var from_shop_id = req.body.from_shop_id,
                need_to_del = req.body.need_to_del,
                cur_shop_id = req.params.shop_id;
            admin.copySectionsInfo({cur_shop_id:cur_shop_id, from_shop_id:from_shop_id, need_to_del:need_to_del}, function(err, ret){
                if( !err ){
                    res.end('done');
                }
            })
        });

    //读取店铺关联
    app.get('/dashixiongwx/admin/shop/:shop_id/show/shopRelation',
        middleware_power.shopkeeper,
        function(req, res){
            var shop_id = req.params.shop_id;
            admin.getShopRelation(shop_id, function(shop){
                render(req, res, 'admin/shopRelation', {
                    layout: 'admin/layout',
                    shop_id : shop_id,
                    shop : shop
                });
            });
        });
    //更新店铺的关联信息
    app.post('/dashixiongwx/admin/shop/:shop_id/update/shopRelation',
        middleware_power.shopkeeper,
        function(req, res){
            var shop_id = req.params.shop_id,
                shop_type = req.body.shop_type,
                setting_value = req.body.setting_value;
            admin.updateShopRelation({shop_id:shop_id, value:setting_value, type:shop_type}, function(err, setting){
                var status = true;
                if( err ) status = false;
                end(res, {status:status});
            })
        });

    //管理“预计送达”公告内容
    app.get('/dashixiongwx/admin/shop/:shop_id/show/possibleReach',
        middleware_power.worker,
        function (req, res) {
            var shop_id = req.params.shop_id || 0;
            admin.getPossibleReach(shop_id, function (err, ret) {
                if (!err) {
                    //用这些数据渲染页面
                    render(req, res, 'admin/show_possibleReach', {
                        possibleReach: sureObj(ret),
                        shop_id: shop_id
                    });
                    return;
                }
                endErr(res, err);
            });
        });


    //显示因活动产生的订单, 这些订单并非因为销售而产生
    app.get('/dashixiongwx/admin/activity/shop/:shop_id/order/list',
        middleware_power.worker,
        function (req, res) {
            var shop_id = req.params.shop_id - 0;
            var extra = req.query.extra || 'activity_women_day';
            var is_group_by = req.query.is_group_by;
            dashixiong.listOrdersByExtra(shop_id, extra, function (err, orders) {
                var total_lost = 0;
                var total_cost = 0;
                orders.forEach(function (order) {
                    order.intime = new Date(order.timeStamp - 0).format('yyyy-mm-dd HH:MM:ss');
                    order.intime_text = order.intime + '(' + uutil.getTimeTxt(order.timeStamp) + ')';
                    order.snapshot = JSON.parse(order.snapshot);
                    total_lost += order.snapshot.total_pay;
                    total_cost += order.snapshot.total_cost;
                });

                render(req, res, 'wx/activity/order_list', {
                    layout: 'admin/layout',
                    orders: orders,
                    extra: extra,
                    total_lost: total_lost,
                    total_cost: total_cost
                });
            }, is_group_by);

        });

    app.get('/dashixiongwx/admin/activity/shop/:shop_id/order/:order_id/detail',
        middleware_power.parttime_senior,
        function (req, res) {
            var order_id = req.params.order_id;
            var shop_id = req.params.shop_id;
            var order = null;
            var snapshot = null;
            var motto = null;
            var a = new asyncMgr.AsyncAction();
            a.register('get_order');
            a.register('get_cur_motto');
            a.onAllDone = function () {
                var p = {
                    layout: true,
                    order: order,
                    order_snapshot: snapshot,
                    motto: motto
                };
                //小于10元的订单要加收1元跑腿费
                if (snapshot.total_pay < 10) {
                    snapshot.total_pay += 1;
                    p.deliver_info = {
                        title: '【跑腿】小费',
                        price: 1
                    };
                }

                render(req, res, 'wx/activity/ac_4/order_detail', p);
            };

            dashixiong.getOrderById(order_id, function (err, ret) {
                if (!err && ret) {
                    order = ret[0];
                    order.intime = new Date(order.timeStamp).format('yyyy-mm-dd HH:MM');
                    snapshot = JSON.parse(order.snapshot);

                }
                a.thisDone('get_order');

            });

            dashixiong.getCurMotto(shop_id, function (err, _motto) {
                if (!err) {
                    motto = _motto;
                }
                a.thisDone('get_cur_motto');
            });


        });

    //新增道具
    app.post('/dashixiongwx/admin/shop/:shop_id/tool/add',
        middleware_power.boss,
        function(req,res){
            var img = req.body.img,
                title = req.body.title,
                type = req.body.type,
                cValue = req.body.cValue,
                description = req.body.description,
                expires = req.body.expires;
            var tool = {
                img: img,
                title: title,
                type: type,
                cValue: cValue,
                description: description,
                expires: expires
            };
            //存数据库啦
            dashixiong.insertAllTools(tool,function (err, ret) {
                if (!err) {
                    res.redirect('/dashixiongwx/admin/shop/' + req.params.shop_id + '/tool_list');
                    return;
                }
                res.end(err.toString());
            });
        });

    //编辑道具
    app.post('/dashixiongwx/admin/shop/:shop_id/tool/update',
        middleware_load_user_by_user_id,
        middleware_power.operator,
        function(req,res){
            var tool = req.body.tool;
            dashixiong.updateTools(tool,function(err,ret){
                if(!err){
                    console.log(err);
                }
                res.end('update tools success');
            });
        });

    //删除道具
    app.post('/dashixiongwx/admin/shop/:shop_id/tool/delete',
        middleware_load_user_by_user_id,
        middleware_power.operator,
        function(req,res){
            var id = req.body.id;
            dashixiong.deleteTools(id,function(err,ret){
                if(!err){
                    console.log(err);
                }
                res.end('delete tools success');
            });
        });

    //客服给用户发放道具页面
    app.get('/dashixiongwx/admin/shop/:shop_id/tool/grant',
        middleware_power.customer_service,
        function (req, res) {
            dashixiong.listAllTools(function (err, ret) {
                render(req, res, 'admin/tool_list', {
                    layout: 'admin/layout',
                    tools: ret
                });
            });
        });

    //ajax客服将具体的某个道具发放给某个用户
    app.get('/dashixiongwx/admin/shop/:shop_id/tool/grant/:user_id/:tool_id',
        middleware_load_user_by_user_id,
        middleware_power.boss,
        function (req, res) {
            var to_user_id = req.params.user_id,
                to_open_id = req.user.openId,
                tool_id = req.params.tool_id;
            var currentUser = req.cookies.user_id;
            dashixiong.grantTool({
                user_id: to_user_id,
                t_id: tool_id,
                msg: '客服发放道具'
            }, function (err, ret) {
                if (err) {
                    end(res, {
                        code: 1,
                        msg: 'db error'
                    });
                    return;
                }
                end(res, {
                    code: 0,
                    msg: 'sus'
                });

                dashixiong.getToolById(tool_id, function (err, tool) {
                    if (err || !tool)return;
                    var msg = 'hi~ 恭喜你获得道具“' + tool.title + '”！你怎么可以这么牛B呢!?  回复“道具”可以查看具体信息。';
                    //微信通知一下客户
                    uutil.sendWxText(to_open_id, msg);
                    //记录客服发放道具
                    li.info('======================客服发放道具往SystemMonitor插入记录开始==========================');
                    var type = "tool_rp",
                        content = {
                            "customerId": currentUser,
                            "userId": to_user_id,
                            "toolTitle": tool.title,
                            "qd": "customerTool"
                        },
                        timeStamp = uutil.getDateTextByTimeStamp(new Date());
                    var contentStr = JSON.stringify(content);
                    admin.tool_rp(contentStr, timeStamp, type, function(err, ret){
                        if(!err){
                            li.info('======================客服发放道具往SystemMonitor插入记录成功==========================');
                            return;
                        }
                        ld.debug(err);
                    });
                });

            });
        });

    //ajax客服取消某个用户的道具
    app.get('/dashixiongwx/admin/shop/:shop_id/tool/recover', middleware_load_user_by_user_id,
        middleware_power.boss,
        function (req, res) {
            dashixiong.recoverTool({
                user_id: req.query.user_id,
                t_id: req.query.tool_id
            }, function (err, ret) {
                if (err) {
                    end(res, err);
                    return;
                }
                end(res, {
                    code: 0,
                    msg: 'sus',
                    ret : ret
                });
            });
        });

    // 通过微信接口获取微信用户基本信息
    app.get('/dashixiongwx/admin/user/weixin/:w_id',
        middleware_power.worker,
        function (req, res) {
            api.getUser(req.params.w_id, function (err, wx_user) {
                end(res, wx_user);
            });
        });

// -------------------------- 取快件 -------------------------------
//列出某日需要取的快件任务
    app.get('/dashixiongwx/admin/shop/:shop_id/expressinfofetch/list',
        middleware_power.parttime_primary,//初级兼职
        function (req, res) {
            var y = req.query.y,
                m = req.query.m,
                d = req.query.d;
            var shop_id = req.params.shop_id;
            var dt = new Date();

            if (!y) {
                var now = new Date();
                y = now.getFullYear();
                m = now.getMonth() + 1;
                d = now.getDate();
            } else {
                dt.setFullYear(y - 0);
                dt.setMonth(m - 0 - 1);
                dt.setDate(d - 0);
            }

            var obj = uutil.getDateStartAndEndTimeStamp(y + '', m, d);

            //列出当日所有取件信息
            dashixiong.listExpressInfoFetch(shop_id, obj.time_stamp_start, obj.time_stamp_end, function (err, ret) {
                var pre_date = dashixiong.getDates(dt.getTime()).pre;
                var next_date = dashixiong.getDates(dt.getTime()).next;
                ret.forEach(function(exp,i){
                    try{
                        if((exp.otherInfo).indexOf('wx_id') != -1){
                            var temp = exp.otherInfo;
                            exp.otherInfo = JSON.parse(temp).data || "";
                            exp.wx_id = JSON.parse(temp).wx_id || "";
                        }else{
                            exp.wx_id = "";
                        }
                    }catch (e){
                        console.log('>>>>>>>>>>>>>异常已捕获<<<<<<<<<<<<<<');
                        console.log(e);
                        console.log('>>>>>>>>>>>>>异常已捕获<<<<<<<<<<<<<<');
                    }

                });
                render(req, res, 'admin/express_info_fetch_list', {
                    layout: 'admin/layout',
                    express_info_fetch: ret,
                    today_y: y,
                    today_m: m,
                    today_d: d,

                    pre_y: pre_date.getFullYear(),
                    pre_m: pre_date.getMonth() + 1,
                    pre_d: pre_date.getDate(),

                    next_y: next_date.getFullYear(),
                    next_m: next_date.getMonth() + 1,
                    next_d: next_date.getDate()
                });
            });
        });


//添加一个取件任务
    app.post('/dashixiongwx/admin/shop/:shop_id/expressinfofetch/doadd',
        middleware_power.parttime_senior,//高级兼职
        function (req, res) {
            var express_info_fetch = req.body.express_info_fetch;
            express_info_fetch.shop_id = req.params.shop_id - 0;
            dashixiong.insertExpressInfoFetch(express_info_fetch, function (err, ret) {
                if (err) {
                    ld.debug(err);
                }
                res.redirect('/dashixiongwx/admin/shop/' + req.params.shop_id + '/expressinfofetch/list');
            });
        });

//快递订单确认-微信模板消息
var sendExpressOrderWxTemplate = function(to_wx_id){
//        to_wx_id = "ocB9as_ds8oUpwLCHsMXvcFm3_pk";
        tokener.accessToken_hjdsx(function(err,obj){
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
                    "template_id": "clendyvzmuq9ULGE2irdoKZ_AXHcLwInPM33S3_nynY",
                    "url": "",
                    "topcolor": "#42c83a",
                    "data": {
                        "first": {
                            "value": "Hi~ 大师兄已经取到了你的快递。",
                            "color": "#173177"
                        },
                        "keyword1": {
                            "value": "大师兄",
                            "color": "#173177"
                        },
                        "keyword2": {
                            "value": month+"月"+day+"日 " + hour + ":" + minute,
                            "color": "#173177"
                        },
                        "remark":{
                            "value":"晚些时候会送到你的手上~ 请放心！",
                            "color":"#173177"
                        }
                    }
                })
            },function(err, res, body){
                try{
                    var obj = JSON.parse( body );
                    if( obj.errcode ){
                        console.log( '~~~~~~~~~~~~~~~~~操作失败~~~~~~~~~~~~~~~~~~~' );
                    }
                    console.log( '========微信用户取件信息(wx_id=)下单成功提醒=====');
                }catch (e){
                    console.log(e);
                }
            });
        });
};
//更新取件任务的状态
    app.get('/dashixiongwx/admin/shop/:shop_id/expressinfofetch/:fetch_id/status/update/:code',
        middleware_power.parttime_primary,//初级兼职
        function (req, res) {
            var wx_id = req.query.wx_id;
            if(wx_id){
                sendExpressOrderWxTemplate(wx_id);
            }
            dashixiong.updateExpressInfoFetch(req.params.fetch_id, req.params.code, function (err, ret) {
                if (!err) {
                    end(res, {
                        code: 0,
                        msg: 'sus'
                    });
                    return;
                }
                end(res, {
                    code: 1,
                    msg: JSON.stringify(err)
                });
            });
        });

    app.get('/dashixiongwx/admin/shop/:shop_id/expressinfofetch/del/:fetch_id',
        middleware_power.parttime_senior,
        function (req, res) {
            dashixiong.delExpressInfoFetch(req.params.fetch_id, function (err, ret) {
                if (!err) {
                    end(res, {
                        code: 0,
                        msg: 'sus'
                    });
                    return;
                }
                end(res, {
                    code: 1,
                    msg: JSON.stringify(err)
                });
            });

        });

    var h = function (req, res) {
        console.log(req.body);
        var sms = req.body.sms;
        var sms_origin = sms;
        var shop_id = req.body.shopId || 3;
        shop_id -= 0;

        //sms = '中通 林惠华 18611661498 晚上9点送过来9栋303';

        var express_regx = /申通|中通|圆通|汇通|国通|韵达|优速|天天|信丰|顺丰|银捷|全峰|EMS|邮政|当当|凡客|聚美|天猫|1号店|一号店|京东|易迅|唯品会/ig;

        if (!express_regx.test(sms)) {//不含取件信息的短信
            end(res, {
                code: 1,
                sus: 'not target sms, no express fetch info!'
            });
            return;
        }

        //快递公司信息
        var matches = sms.match(express_regx);
        var company = matches[0];
        sms = sms.replace(express_regx, '');

        //电话号码
        var mobile_regx = /\d{11,}/ig;

        var mobile = sms.match(mobile_regx);
        mobile = mobile[0];
        sms = sms.replace(mobile_regx, '');
        sms = sms.replace(/[,，。]/ig, '');

        var fetch = {
            shop_id: shop_id,
            company: company,
            mobile: mobile,
            otherInfo: sms_origin
        }

        dashixiong.insertExpressInfoFetch(fetch, function (err, ret) {
            if (err) {
                ld.debug(err);
                end(res, {
                    code: 1,
                    sus: 'insert err',
                    err: err
                });
                return;
            }
            end(res, {
                code: 0,
                sus: 'sus'
            });
        });

    };

    app.post('/dashixiongwx/sms/expressinfofetch/task', h);//TODO: 短信接收取件任务app提供的接口, 暂时没有验证, 很危险
    app.get('/dashixiongwx/sms/expressinfofetch/task', h);

    //-------------------------------------------- mobile finance messages --------------------------------------start----- //
    app.post('/dashixiongwx/mobile/finance/messages',
        function(req,res){
            var content = req.body.content;
            var time = req.body.time;
            if(content&&time){
                //记录到数据库
                dashixiong.insertMsgFinance(content,time,function(err){
                    if(!err){
                        var obj = {
                            'status':200,
                            'tips':'upload success'
                        };
                        var root = JSON.stringify(obj);
                        res.end(root);
                    }else{
                        var obj = {
                            'status':250,
                            'tips':'upload failure server error'
                        };
                        var root = JSON.stringify(obj);
                        res.end(root);
                        return;
                    }
                });
            }else{
                var obj = {
                    'status':250,
                    'tips':'upload failure no content&time'
                };
                var root = JSON.stringify(obj);
                res.end(root);
                return;
            }
    });
    app.get('/dashixiongwx/admin/shop/:shop_id/get/finance/messages',
        middleware_power.customer_service,
        function(req,res){
            dashixiong.getMsgFinance(function(err,ret){
                if(!err){
                    render(req, res, 'admin/message_finance', {
                        layout: 'admin/layout',
                        ret : ret
                    });
                }
                console.log(err);
                return;
            });
        });
    app.post('/dashixiongwx/admin/delete/finance/messages',
        middleware_power.customer_service,
        function(req,res){
            var errid = req.body.id;
            console.log(errid);
            dashixiong.deleteMsgFinance(errid,function(err){
                if(err){
                    console.log(err);
                    res.end('failure');
                    return;
                }else{
                    res.end('sucess');
                    return;
                }
            });
        });
    //-------------------------------------------- mobile finance messages -------------------------------------end------ //

    //-------------------------------------------- Employee ------------------------------------------- //

    //--------------------上传和下载财务表------------------//
    app.get('/dashixiongwx/admin/shop/:shop_id/:user_power/finance/statements',
        middleware_power.worker,
        function(req, res){
            //首次进入取出记录
            dashixiong.getAllFinaceExcels(req.params.shop_id, req.params.user_power,function(err, financeExcels){
                //取到数据后渲染
                render(req, res, 'admin/finance_statements', {
                    layout: 'admin/layout',
                    Finance : financeExcels,
                    sort : 1,
                    shop_id : req.params.shop_id
                });
            });
        });

//----------------------------------上传财务报表-----------------//
    app.post('/dashixiongwx/admin/shop/:shop_id/:user_power/upload/finance/statement',
        middleware_power.worker,
        function(req, res){
            var dir = '/home/uploads/dashixiong/finances/';
            if(uutil.isInDevelopment()){
                dir = '/home/lufeng/uploads/dashixiong/finances/';
            }
            var form = new formidable.IncomingForm();
            form.uploadDir = dir;
            form.keepExtensions = true;
            form.parse(req, function(err, fields, files){
                var testName = files.finance.name;
                testName = testName.replace(/_\d{4}.*\d/g,'');
                var fileName = files.finance.path;
                fileName = fileName.substring(dir.length);
                var hashFileName = fileName;
                var fileDateTime = new Date().format("yyyy_mm_dd HH:MM:ss");
//                console.log(fileDateTime);
                //更改磁盘文件名
                oldFileName = dir + fileName;
                if(testName.indexOf(".")>0){
                    testName = testName.replace('.','_'+fileDateTime+'.');
                }else{
                    testName = testName.replace(testName,testName+'_'+fileDateTime);
                }
                newFileName = dir + testName;
                fs.rename(oldFileName, newFileName, function(){
//                    console.log("oldFileName = " + oldFileName);
//                    console.log("newFileName = " + newFileName);
                });
                if(!err){
                    dashixiong.insertFinanceStatements(testName, hashFileName, req.params.shop_id,function(err, ret){
                        res.redirect('/dashixiongwx/admin/shop/'+ req.params.shop_id+'/'+ req.params.user_power +'/finance/statements');
                    });
                    return;
                }
            });

        });

    //添加新用户
    exports.addNewUser =function(){
        dashixiong.newUser({shop_id : shop_id,qId : 0}, function(err, new_user_id){
            //获得新用户id之后, 绑定微信id, 然后跟注册过的是一个流程了
            dashixiong.bindUser(new_user_id, wx_id);
        });
    };


//---------------------------------删除财务报表--------------------//
    app.get('/dashixiongwx/admin/shop/:shop_id/:finance_id/:user_power/finance/statements/delete',
        middleware_power.worker,
        function(req, res){
            //删除记录后后返回到财务报表展示页面
            dashixiong.deleteFinanceExcel(req.params.finance_id, function(err, ret){
                //执行删除后返回页面
//            res.redirect('/dashixiongwx/admin/shop/'+req.params.finance_id+'/finance/statements');

                res.redirect('/dashixiongwx/admin/shop/'+ req.params.shop_id+'/'+ req.params.user_power +'/finance/statements');

            });
            return;
        });



//--------------------------------配送地址--------------------//
//            /dashixiongwx/admin/shop/${shop_id}/school
    app.get('/dashixiongwx/admin/shop/:shop_id/school',
        middleware_power.operator,
        function(req, res){
            //首次加载先查询数据库有无记录
            dashixiong.getAllSchoolAddress(function(err, schoolAddress){
                //取数据后渲染
                render(req, res, 'admin/school_address_list',{
                    layout:'admin/layout',
                    Schools:schoolAddress,
                    shop_id:req.params.shop_id
                });
            });
        });


//----------------------------加入新的配送地址---------------@lufeng---------//
    app.post('/dashixiongwx/admin/shop/:shop_id/school/add',
        middleware_power.operator,
        function(req, res){
            var shopId = req.body.shopId;
            var newSchoolAddress = req.body.address;//获取新增的学校地址
//             console.log(req.body.address);
            dashixiong.insertNewSchooAddress(shopId,newSchoolAddress, function(err, ret){
                res.redirect('/dashixiongwx/admin/shop/'+req.params.shop_id+'/school');
            });
            return;
        });

//----------------------------设置是否是默认地址---------------@lufeng---------//
    app.post('/dashixiongwx/admin/shop/school/updateStatus',
        middleware_power.operator,
        function(req, res){
            var schoolId = req.body.schoolId;
            var shopId = req.body.shopId;
            /*console.log("schoolId = " + schoolId);
             console.log("shopId = " + shopId);*/
            //到数据库更新默认状态
            dashixiong.updateSchoolStatus(schoolId, function(err, ret){
//                 res.redirect('/dashixiongwx/admin/shop/'+shopId+'/school');
                res.end( JSON.stringify({status:1}) );
            });

        });


//----------------------------删除地址---------------@lufeng---------//
    app.post('/dashixiongwx/admin/shop/school/delete',
        middleware_power.operator,
        function(req, res){
            var schoolId = req.body.schoolId;
            var shopId = req.body.shopId;
            //到数据库更新默认状态
            dashixiong.deleteSchoolAddressBySchoolId(schoolId, function(err, ret){
//                res.redirect('/dashixiongwx/admin/shop/'+shopId+'/school');
                res.end(JSON.stringify({status:1}));
            });
        });

    //----------------------------更新地址---------------@lufeng---------//
    app.post('/dashixiongwx/admin/shop/school/update',
        middleware_power.operator,
        function(req,res){
            var schoolId = req.body.schoolId;
            var shopId = req.body.shopId;
            var newAddress = req.body.newSchoolAddress;
            dashixiong.udpateSchoolAddress(schoolId, newAddress, function(err, ret){
                res.end(JSON.stringify({status:1}));
            });
        });

    //--------------------start--------菜品评论---------------@lufeng---------//
    app.get('/dashixiongwx/admin/shop/:shop_id/add/product/comment',
        middleware_power.shopkeeper,
        function(req,res){
            dashixiong.getAllProductByShopId(req.params.shop_id,function(err,ret){
                if(!err){
                    render(req,res,'admin/restaurant_comment',{
                        layout:'admin/layout',
                        shop_id:req.params.shop_id,
                        products:ret
                    });
                }

            });

        });
    //--------------------end--------菜品评论---------------@lufeng---------//



    //--------------------start--------签到抽奖---------------@lufeng---------//

    app.get('/dashixiongwx/admin/shop/:shop_id/manage/draw',
        middleware_power.worker,
        function(req, res){
            var shopId= req.params.shop_id;
            dashixiong.getAllSignDraw(shopId,function(err, signDraw){
                //取数据后渲染
                if(!err){
                    render(req, res, 'admin/sign_draw',{
                        layout:'admin/layout',
                        sing_draw:signDraw,
                        shop_id:req.params.shop_id
                    });
                }

            });
        });

    //更新抽奖数据
    app.post('/dashixiongwx/admin/shop/1/update/draw',
        middleware_power.worker,
        function(req, res){
            var data = req.body.data;
            dashixiong.updateDrawInfo(data, function(err, ret){
                if( !err ){
                    return;
                }
                console.log(err)
            });
        });

    app.post('/dashixiongwx/admin/shop/:shop_id/draw/add',
        middleware_power.shopkeeper,
        function(req, res){
            var signDraw = {
                'name': req.body.name,
                'kind': req.body.kind,
                'shopId' : req.body.shopId,
                'count' : req.body.count,
                'val' : req.body.val
            };
            dashixiong.insertNewDraw(signDraw,function(err, ret){
                if(!err){
                    res.redirect('/dashixiongwx/admin/shop/'+req.body.shopId+'/manage/draw');
                }
            });
        });
    //删除抽奖数据
    app.post('/dashixiongwx/admin/shop/1/delete/draw',
        middleware_power.shopkeeper,
        function(req,res){
            var trId = req.body.trId;
            dashixiong.deleteDrawInfo(trId,function(err,ret){
                if(err) {
                    console.log(err);
                    return;
                }
                res.end("success");
            });
        });

    //--------------------end--------签到抽奖---------------@lufeng---------//

    //记录登录后台用户在业绩查询和未确认订单中的操作@wuyong
    app.post('/dashixiongwx/admin/cancleOrder',
        function (req,res){
            var orderId = req.body.orderid;
            var opration = req.body.opration;
            var userId = req.cookies.user_id;
            var time = new Date().getTime();
            var obj = {};
            var type = 'adminOperation';
            dashixiong.selectNickById(userId,function(err,ret){
                obj = {
                    "userId":userId,
                    "nick":ret[0].nick,
                    "orderId":orderId,
                    "opration":opration,
                    "time":time
                };
                dashixiong.insertData(type, obj, function(err){
                    if(!err){}
                });
            });
            res.end('');
        }
    );

    //查询管理员操作记录@wuyong
    app.get('/dashixiongwx/admin/shop/:shop_id/list_user_opration',
        middleware_power.parttime_senior,
        function(req,res){
            var type = 'adminOperation';
            var objContent;
            var contArray = [];

            dashixiong.selectUserOprationInfo(type,function(err,ret){
                if(err){
                    console.log(err);
                    return;
                }
                for(var i=0;i<ret.length;i++) {
                    objContent = JSON.parse(ret[i].content);
                    contArray.push(objContent);
                }
                for(var j=0;j<contArray.length;j++) {
                    contArray[j].time = new Date(contArray[j].time).format("yyyy-mm-dd HH:MM:ss");
                }
                render(req,res,'admin/list_user_operation',{
                    layout:true,
                    ret:contArray,
                    open:{}
                });
            });
        });

    //恢复已取消订单
    app.get('/dashixiongwx/admin/shop/:shopId/qx/:orderId',
        middleware_power.parttime_senior,
        function(req,res){
            var orderId = req.params.orderId;
            var shopId = req.params.shopId;
            dashixiong.updateUserOrderStatus(shopId,orderId,function(err,ret){
                if(err){
                    return;
                }
                res.redirect('/dashixiongwx/admin/shop/'+shopId+'/order/list');
            });
        });

    app.get('/dashixiongwx/admin/shop/:shop_id/selectUserTools',
        middleware_power.parttime_senior,
        function(req,res){
            var userId = req.query.userId;
            dashixiong.selectUserValTools(userId, function(err,toolsval){
                if(err){
                    console.log(err);
                    return;
                }

                if( req.query.isAjax ){
                    res.end( JSON.stringify(toolsval) );
                    return;
                }

                render(req,res,'admin/list_user_tools',{
                    layout:true,
                    toolsval:toolsval
                });
            });
        });
    app.post('/dashixiongwx/admin/deleteByUserId',
        function(req,res){
            var userId = req.body.userId;
            dashixiong.deleteActByUserId(userId, function(err){
                if(err){
                    console.log(err);
                    return;
                }
                res.end('');
            });
        });

    app.get('/dashixiongwx/admin/shop/:shop_id/selectUserClickNum',
        function(req, res){
            var y = req.query.y;
            var m = req.query.m;
            var d = req.query.d;
            var dt = new Date();

            if (y && m && d) {
                dt.setFullYear(y - 0);
                dt.setMonth(m - 0 - 1);
                dt.setDate(d - 0);

            } else {
                y = dt.getFullYear();
                m = dt.getMonth() + 1;
                d = dt.getDate();
            }

            var pre_date = dashixiong.getDates(dt.getTime()).pre;//前一天
            var next_date = dashixiong.getDates(dt.getTime()).next;//后一天

            var cont = [];
            var tempNums = [];
            var ymdArray = [];
            var ymd = {};
            dashixiong.listUserClickNum(function(err, ret){
                if(err){
                    console.log(err);
                    return;
                }
                for(var i=0;i<ret.length;i++) {
                    cont.push(JSON.parse(ret[i].content));
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

                for(var j=0;j<cont.length;j++) {
                    if(cont[j].timeStamp > time_stamp_start && cont[j].timeStamp < time_stamp_end) {
                        tempNums.push(cont[j].num);
                    }
                }
                ymd.time = y+'年'+m+'月'+d+'日';
                ymd.len = tempNums.length;
                /*ymdArray.push(ymd);*/
                console.log(ymd);
                console.log(y+'年'+m+'月'+d+'日'+' = '+tempNums.length);
                render(req, res, 'admin/list_userclick_num', {
                    layout:true,
                    num:tempNums.length,
                    //ymdArray:ymdArray,
                    ymd:ymd,
                    y:y,
                    m:m,
                    d:d,
                    pre_date_y: pre_date.getFullYear(),
                    pre_date_m: pre_date.getMonth() + 1,
                    pre_date_d: pre_date.getDate(),

                    next_date_y: next_date.getFullYear(),
                    next_date_m: next_date.getMonth() + 1,
                    next_date_d: next_date.getDate()
                });
            });

        });
    //删除当日的用户行为记录
    app.post('/dashixiongwx/admin/shop/:shop_id/del/analysis',
        function(req,res){
            var userIdSet = req.body.userIdSet,
                y = req.body.y,
                m = req.body.m,
                d = req.body.d,
                timeStamps = dashixiong.getDateStartAndEndTimeStamp(y, m, d);

            dashixiong.delAnalysis({userIdSet:userIdSet, timeStamps:timeStamps},function(err){
                if(err){
                    console.log(err);
                    res.end('failure');
                }else{
                    res.end('sus');
                }
            });
        });
    app.get('/dashixiongwx/admin/shop/:shop_id/analysis',
        function(req, res){
            var analysis = apis.analysis,
                img = analysis.imgs;
            var y = req.query.y,
                m = req.query.m,
                d = req.query.d,
                timeStamps = dashixiong.getDateStartAndEndTimeStamp(y, m, d),
                dt = new Date();
            var row = 0;

            if (y && m && d) {
                dt.setFullYear(y - 0);
                dt.setMonth(m - 0 - 1);
                dt.setDate(d - 0);

            } else {
                y = dt.getFullYear();
                m = dt.getMonth() + 1;
                d = dt.getDate();
            }

            var pre_date = dashixiong.getDates(dt.getTime()).pre;//前一天
            var next_date = dashixiong.getDates(dt.getTime()).next;//后一天
            //获取首页监控信息
            var business = 'click'; //默认获取的都是用户点击的信息，用户的监控信息可以按照业务进行划分，现在只有点击
            dashixiong.analysis({shop_id:req.params.shop_id, timeStamps:timeStamps, business:business}, function(err, rets){
                if(err){
                    console.log(err);
                    return;
                }
                var marker = {},
                    data = [],
                    timeMarker = {};
                rets = sureAry(rets);
                rets.forEach(function(ret, i){
                    //记录点击时间
                    if( !timeMarker[ret.userId] ){
                        timeMarker[ret.userId] = ret.timeStamp;
                    }else{
                        timeMarker[ret.userId] = timeMarker[ret.userId] > ret.timeStamp ? timeMarker[ret.userId] : ret.timeStamp;
                    }
                    //同一个人的第一条数据
                    if( !marker[ret.userId] ){
                        marker[ret.userId] = {nick:ret.nick};
                        marker[ret.userId].content = ['<div class="analysis-div">' +analysis.getPosition(ret.position, img)+'<span style="display: block;color:#999999;text-align: center;line-height: 12px;">'+uutil.getTimeTxt(ret.timeStamp)+'</span>'+ '</div>'];
                        marker[ret.userId].ua = JSON.parse(ret.content).ua || '未记录UA';
                        return;
                    }
                    //同一个人的多条数据
                    marker[ret.userId].content.push('<div class="analysis-div">'+ analysis.getPosition(ret.position, img) +'<span style="display: block;color:#999999;text-align: center;line-height: 12px;">'+uutil.getTimeTxt(ret.timeStamp)+'</span>'+ '</div>');
                });

                for(var p in marker){
                    ++row;
                    marker[p].timeStamp = timeMarker[p];
                    marker[p].userId = p;
                    marker[p].content = marker[p].content.join('');
                    data.push( marker[p] );
                }
                data.sort(function(a, b){
                    return b.timeStamp - a.timeStamp;
                });
                render(req,res,'admin/analysis',{
                    rets:data,
                    pre_date_y: pre_date.getFullYear(),
                    pre_date_m: pre_date.getMonth() + 1,
                    pre_date_d: pre_date.getDate(),
                    next_date_y: next_date.getFullYear(),
                    next_date_m: next_date.getMonth() + 1,
                    next_date_d: next_date.getDate(),
                    y : y,
                    m : m,
                    d : d,
                    row : row
                });
            });
        });

    //确认已付款接口--by@lufeng
    app.post('/dashixiongwx/admin/order/payment',
        middleware_power.customer_service,
        function(req, res){
            var args = {
                payStatus : 1,
                orderId : req.body.args.orderId
            };
            dashixiong.updateUserOrderPayStatus(args, function(err){
                if(err){
                    console.log(err);
                    return ;
                }
                res.end('success');
            });
        }
    );

    //恢复已付款
    app.post('/dashixiongwx/admin/order/cancelPay',
        function(req, res){
            var args = {
                payStatus : 0,
                orderId : req.body.cancelPayId
            };
            dashixiong.recoverPay(args, function(err){
                if(err){
                    console.log(err);
                    return;
                }
                res.end('success');
            });
        });
    //版本使用率--快捷版状态为0-cookies-0  简洁版状态为1-cookies-1
    app.get('/dashixiongwx/admin/shop/:shop_id/userVersionRate',
        middleware_power.operator,
        function(req, res){
           var totalNums = '',
               quickNums = '',
               simpleNums = '';

            var a = new asyncMgr.AsyncAction();
            a.register('get_quick_nums');
            a.register('get_total_nums');
            a.register('get_simple');
            a.onAllDone = function(){
                render(req, res, 'admin/version_use_rate',{
                    quickNums:quickNums,
                    simpleNums:simpleNums,
                    quickRate:((quickNums/totalNums)*100).toFixed(2),
                    simpleRate:((simpleNums/totalNums)*100).toFixed(2)
                });
            };
            dashixiong.selectVersionQuick(function(err,ret){
                if(!err){
                    quickNums = ret[0].count;
                    a.thisDone('get_quick_nums');
                }
                console.log(err);
                a.thisDone('get_quick_nums');
            });

            dashixiong.selectVersionSimple(function(err,ret){
                if(!err){
                    simpleNums = ret[0].count;
                    a.thisDone('get_simple');
                }
                console.log(err);
                a.thisDone('get_simple');
            });

            dashixiong.selectVersionTotal(function(err,ret){
                if(!err){
                    totalNums = ret[0].count;
                    a.thisDone('get_total_nums');
                }
                console.log(err);
                a.thisDone('get_total_nums');
            });
        });

    app.get('/dashixiongwx/admin/shop/:shop_id/userOrderRate',
        function(req, res){
            var t_start = new Date().getTime();
            var shop_id = req.params.shop_id;
            var y = req.query.y,
                m = req.query.m,
                d = req.query.d,
                timeStamps = dashixiong.getDateStartAndEndTimeStamp(y, m, d),
                dt = new Date();
            var visitor_count = 0;
            var oldIds = [];//老用户订单ID Array
            var ids = [];
            var dayOldIds = [];//某天老用户ID
            var dayIds = [];//某天订单的用户ID
            var section_id = req.params.section_id;
            var oids = [];//去掉管理员的老用户ID
            var oidOrder = [];//去掉管理员订单人数

            var dayIdsTemp = [];

            var user_ids = req.query.user_ids || req.body.user_ids,
                user_order_num_map = {},
                user_ids = user_ids || [];

            if (y && m && d) {
                dt.setFullYear(y - 0);
                dt.setMonth(m - 0 - 1);
                dt.setDate(d - 0);

            } else {
                y = dt.getFullYear();
                m = dt.getMonth() + 1;
                d = dt.getDate();
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

            var pre_date = dashixiong.getDates(dt.getTime()).pre;//前一天
            var next_date = dashixiong.getDates(dt.getTime()).next;//后一天

            var a = new asyncMgr.AsyncAction();
            a.register('get_visitor_count');
            a.register('get_ids');
            a.register('get_dayOrders');
            a.register('get_oidspower');
            a.register('get_idsorders');
            a.register('get_dayids');
            a.register('get_oidOrderpower');
            a.onAllDone = function(){
                render(req, res, 'admin/user_order_rate',{
                    oldIds: oids.length,//老用户到店数
                    newIds: visitor_count-oldIds.length,//新用户到店数
                    oldOrdersNum: oidOrder.length,//老用户下单人数
                    newOrdersNum: dayIdsTemp.length - dayOldIds.length,//新用户下单人数
                    newProfix: ((dayIdsTemp.length - dayOldIds.length)/(visitor_count-oldIds.length)*100).toFixed(2),//新用户下单率
                    oldProfix: (oidOrder.length/oids.length*100).toFixed(2),//老用户下单率
                    pre_date_y: pre_date.getFullYear(),
                    pre_date_m: pre_date.getMonth() + 1,
                    pre_date_d: pre_date.getDate(),
                    next_date_y: next_date.getFullYear(),
                    next_date_m: next_date.getMonth() + 1,
                    next_date_d: next_date.getDate(),
                    y : y,
                    m : m,
                    d : d
                });
            };
            //获取一天内总的到店数
            dashixiong.getVisitorCount(shop_id, time_stamp_start, time_stamp_end, function (err, _count) {
                uutil.printTime(t_start, '获取访客数 耗时');
                if (!err) {
                    visitor_count = _count;
                }
                a.thisDone('get_visitor_count');
            });

            //获取某天某店到店的用户ID
            dashixiong.getUserIds(shop_id, time_stamp_start, time_stamp_end, function (err, _ids) {
                if(!err) {
                    for(var i=0;i<_ids.length;i++) {
                        var idArray = _ids[i].lValue.split('___');
                        ids.push(parseInt(idArray[0]));
                    }
                }
//                某天某店每个已到店用户这天之前对应的订单数
                dashixiong.getOrdersByIds(ids, shop_id, time_stamp_start, function (err, _orders) {
                    if(!err&&_orders) {
                        _orders.forEach(function(doEle, i){
//                          老用户到店数
                            if(doEle.orderNum > 0) {
                                oldIds.push(doEle.userId);
                            }

                        });

                        dashixiong.getPowerByUserId(oldIds, shop_id, function(err, _powers){
                             if(!err&&_powers) {
                                 _powers.forEach(function(doEle, i){
                                     if(doEle.power == 0) {
                                         oids.push(doEle.id);
                                     }
                                 });
                                 a.thisDone('get_oidspower');
                             } else{
                                 a.thisDone('get_oidspower');
                             }
                        });
                        a.thisDone('get_idsorders');
                    } else{
                        res.setHeader('content-type','text/html;charset=utf-8');
                        res.end('<div style="left: 40%;top: 40%; position: absolute;"><span style="color: #40A0C0;">灰常抱歉，暂时没有新的数据！</span><a style="color: #40A0C0;" href="javascript:history.go(-1)">点击这里返回</a></div>');
                        a.thisDone('get_idsorders');
                    }
                });
                a.thisDone('get_ids');
            });

//                获取某天所有订单者的用户ID
            dashixiong.getOrdersInDay(shop_id, time_stamp_start, time_stamp_end, function (err, _dayOrders) {
                if(err){
                    console.log(err);
                    return;
                }
                if(_dayOrders.length==0){
                    res.setHeader('content-type','text/html;charset=utf-8');
                    res.end('<div style="left: 40%;top: 40%; position: absolute;"><span style="color: #40A0C0;">灰常抱歉，今天还没人下单！</span><a style="color: #40A0C0;" href="javascript:history.go(-1)">点击这里返回</a></div>');
                }else{
                    for(var i=0;i<_dayOrders.length;i++) {
                        dayIds.push(_dayOrders[i].userId);
                    }

                for(var i=0;i<dayIds.length;i++) {
                    if(dayIdsTemp.indexOf(dayIds[i]) == -1) {
                        dayIdsTemp.push(dayIds[i]);
                    }
                }

//                根据用户ID得到订单数
                dashixiong.getOrdersByIds(dayIdsTemp, shop_id, time_stamp_start, function (err, _orders) {
                    if(!err&&_orders) {
                        _orders.forEach(function(doEle, i){
//                          老用户
                            if(doEle.orderNum > 0) {
                                dayOldIds.push(doEle.userId);
                            }
                        });
                        dashixiong.getPowerByUserId(dayOldIds, shop_id, function(err, _powers){
                            if(!err&&_powers) {
                                _powers.forEach(function(doEle, i){
                                    if(doEle.power == 0) {
                                        oidOrder.push(doEle.id);//老用户订单人数
                                    }
                                });
                                a.thisDone('get_oidOrderpower');
                            } else{
                                a.thisDone('get_oidOrderpower');
                            }
                        });
                        a.thisDone('get_dayOrders');
                    } else{
                        a.thisDone('get_dayOrders');
                    }
                });

                a.thisDone('get_dayids');}

            });

        });
    app.get('/dashixiongwx/admin/shop/:shop_id/warehouse/:w_id/product/list/zero/inventory',
        middleware_power.boss,
        function(req, res){
            var obj = {
                shopId: req.params.shop_id,
                wId: req.params.w_id
            };
            dashixiong.zeroinventory(obj, function(err){
                if(err){
                    console.log(err);
                    return;
                }
                res.redirect('/dashixiongwx/admin/shop/' + req.params.shop_id + '/warehouse/' + req.params.w_id + '/product/list/all');
            });
        });

    app.get('/dashixiongwx/admin/shop/:shop_id/:y/:m/:d/user/actived/:status',
        middleware_power.boss,
        function(req, res){
            var shopId = req.params.shop_id;
            var y = req.params.y,
                m = req.params.m,
                d = req.params.d,
                dt = new Date();
            var status = req.params.status;
            var ids = req.query.ids;
            var idsArray = ids.split(',');
            var visitorCounttemp = [];
            var visitorCount = [];
            var orderedIds = [];
            var rate = 0;
            var orderNum = 0;
            var visits = [];//用户到店数

            var dataArray = [];
            var allNum = 0;//继续购买者总的购买数
            var oldUserIds = [];//老用户ID
            var newUserIds = [];
            var orderOnes = [];
            var orderTwos = [];
            var orderOverOnes = [];
            var orderOverZero = [];
            var newUserOrderNUm = [];//新用户总下单数array
            var newNums = 0;//新用户总下单数
            var allorderOnes = [];//所选用户1次购买数
            var allorderTwos = [];//所选用户2次及以上购买数
            var allorderOverOnes = [];//所选用户1次以上购买数
            var datas = [];

            if (y && m && d) {
                dt.setFullYear(y - 0);
                dt.setMonth(m - 0 - 1);
                dt.setDate(d - 0);
            } else {
                y = dt.getFullYear();
                m = dt.getMonth() + 1;
                d = dt.getDate();
            }

            //从0点开始
            dt.setHours(0);
            dt.setMinutes(0);
            dt.setSeconds(0);

            var time_stamp_start = dt.getTime();

            var afterOneWeek = time_stamp_start+1000*60*60*24*7;
            var afterOneMonth = time_stamp_start+1000*60*60*24*30;

            dt.setHours(23);
            dt.setMinutes(59);
            dt.setSeconds(59);
            var time_stamp_end = dt.getTime();

            var obj = {
                startTime: time_stamp_start,
                endTime: time_stamp_end,
                afterOneWeek: afterOneWeek,
                afterOneMonth: afterOneMonth,
                status: status,
                idsArray: idsArray,
                shopId: shopId,
                newUserIds: newUserIds
            };
            var a = new asyncMgr.AsyncAction();
            a.register('get_visitor_count');
            a.register('get_rate');
            a.register('get_orderedUserNum');
            a.register('get_newUserOrder');
            a.register('get_news');

            a.onAllDone = function(){

                for(var i=0;i<dataArray.length;i++) {
                    var data = {};
                    data.userId = dataArray[i].userId;
                    data.row = dataArray[i].row;
                    data.orderNum = dataArray[i].orderNum;
                    for(var j=0;j<visits.length;j++) {
                        if(dataArray[i].userId == visits[j].userId){
                            data.count = visits[j].count;
                        }
                    }
                    datas.push(data);
                }

                render(req, res, 'admin/user_active',{
                    status: status,
                    orderNum: orderNum,
                    idsArray: idsArray,
                    dataArrays: dataArray,
                    visitorCounts: visitorCount,
                    userNum: idsArray.length,
                    continueNum: orderedIds.length,
                    allNum: allNum,
                    newUserIds: newUserIds.length,//新用户ID
                    orderOnes: orderOnes.length,//新用户购买1次人数
                    orderOverOnes: orderOverOnes.length,//新用户购买1次以上的人数
                    orderTwos: orderTwos.length,//新用户购买2次以上的人数
                    orderOverZero: orderOverZero.length,//下过单的新用户人数
                    newNums: newNums,
                    pjOrders: (newNums/orderOverZero.length).toFixed(2),//新用户平均下单数
                    orderTwos: orderTwos.length,//新用户下了2单以上的人数
                    allorderOnes: allorderOnes.length,//所选用户1次购买数
                    allorderTwos: allorderTwos.length,//所选用户2次及以上购买数
                    allorderOverOnes: allorderOverOnes.length,
                    visits: visits,
                    datas: datas
                });
            };

            dashixiong.getVisitorCountByParam(obj, function (err, _count) {
                if(err) {
                    console.log(err);
                    return;
                }
                if(_count && !err) {
                    _count.forEach(function(doEle, i){
                        var obje = {};
                        obje.userId = doEle.userId;
                        obje.count = doEle.count;
                        visits.push(obje);
                    });
                }
                a.thisDone('get_visitor_count');
            });

            dashixiong.getOrderByUserId(obj, function(err, _orders){
                if(err){
                    console.log(err);
                    return;
                }
                if(_orders){
                    var num = 1;
                    _orders.forEach(function(doEle, i){
                        var data = {};
                        data.row = num ++;
                        data.userId = doEle.userId;
                        data.orderNum = doEle.orderNum;
                        dataArray.push(data);//用户ID和对应的购买数

                        if(doEle.orderNum == 1) {
                            allorderOnes.push(doEle.userId);
                        }
                        if(doEle.orderNum >= 1) {
                            allorderOverOnes.push(doEle.userId);
                        }
                        if(doEle.orderNum >= 2) {
                            allorderTwos.push(doEle.userId);
                        }
                    });

                    for(var i=0;i<dataArray.length;i++) {
                        allNum += dataArray[i].orderNum;//继续购买者总的购买数
                    }
                }
                a.thisDone('get_orderedUserNum');
            });

            dashixiong.getUserOrderedNum(obj, function(err, _userNum){
                if(err){
                    console.log(err);
                    return;
                }
                if(_userNum) {
                    _userNum.forEach(function(doEle, i){
                        if(doEle.snapshot != null) {
                            orderedIds.push(doEle.userId);
                        }
                    });
                }
                a.thisDone('get_rate');
            });

            //某店用户这天之前对应的订单数
            dashixiong.getOrdersByIds(obj.idsArray, obj.shopId, obj.startTime, function (err, _orders) {
                if(err){
                    console.log(err);
                    return;
                }
                if(_orders) {
                    _orders.forEach(function(doEle, i){
                        if(doEle.orderNum>0) {
                            oldUserIds.push(doEle.userId);
                        }
                    });

                    var objMap = {};
                    for(var i=0;i<idsArray.length;i++) {
                        objMap[idsArray[i]] = 1;
                    }
                    for(var j=0;j<oldUserIds.length;j++) {
                        if(objMap[oldUserIds[j]]) {//如果存在，将其设置为2
                            objMap[oldUserIds[j]] = 2;
                        }
                    }
                    for(var key in objMap) {
                        if(objMap[key] == 1) {
                            newUserIds.push(key);//拿到新用户ID
                        }
                    }

                    if(newUserIds.length==0){
                        //当只选择老用户时，直接完成
                        a.thisDone('get_newUserOrder');
                    }else{
                        //查看选择的新用户订单数
                        dashixiong.getNewUserOrderByIds(obj, newUserIds, function(err, _newOrders){
                            if(err){
                                console.log(err);
                                return;
                            }
                            if(_newOrders) {
                                _newOrders.forEach(function(doEle, i){
                                    newUserOrderNUm.push(doEle.orderNum);
                                    if(doEle.orderNum >= 0) {
                                        orderOverZero.push(doEle.userId);
                                    }
                                    if(doEle.orderNum == 1) {
                                        orderOnes.push(doEle.userId);
                                    }
                                    if(doEle.orderNum >= 1) {
                                        orderOverOnes.push(doEle.userId);
                                    }
                                    if(doEle.orderNum >= 2) {
                                        orderTwos.push(doEle.userId);
                                    }
                                });

                                for(var i=0;i<newUserOrderNUm.length;i++) {
                                    newNums += newUserOrderNUm[i];//新用户总下单数
                                }
                            }
                            a.thisDone('get_newUserOrder');
                        });
                    }
                }
                a.thisDone('get_news');
            });



        });
//产品兼容统计
    app.get('/dashixiongwx/admin/shop/:shop_id/product/compatible/status/statistics',
        middleware_power.boss,
        function(req, res){
            var type = 'monitorOrder';
            var data = [];
            //显示所有的错误日志
 /*             var dt = new Date(),
                y = req.query.y,
                m = req.query.m,
                d = req.query.d,
                timeStamp = dashixiong.getDateStartAndEndTimeStamp(y,m,d);

            if(y && m && d){
                dt.setFullYear(y-0);
                dt.setMonth(m-0-1);
                dt.setDate(d-0);
            }else{
                y = dt.getFullYear();
                m = dt.getMonth()+1;
                d = dt.getDate();
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

            var pre_date = dashixiong.getDates(dt.getTime()).pre;//前一天
            var next_date = dashixiong.getDates(dt.getTime()).next;//后一天

            dashixiong.getUserOPs(type, time_stamp_start, time_stamp_end, function(err, ret){
                if(err){
                    console.log(err);
                    return;
                }
                ret.forEach(function(doEle, i){
                    var dataObj = {};
                    var con = JSON.parse(doEle.content);
                    dataObj.id = doEle.id
                    dataObj.err = con.err;
                    dataObj.userId = con.userId || '--';
                    dataObj.au = con.au || '--';
                    dataObj.timeStamp = uutil.getDateTextByTimeStamp(doEle.timeStamp);
                    data.push(dataObj);
                });
                render(req, res, 'admin/product_compatible',{
                    datas: data,
                    pre_date_y: pre_date.getFullYear(),
                    pre_date_m: pre_date.getMonth() + 1,
                    pre_date_d: pre_date.getDate(),
                    next_date_y: next_date.getFullYear(),
                    next_date_m: next_date.getMonth() + 1,
                    next_date_d: next_date.getDate(),
                    y : y,
                    m : m,
                    d : d
                });
            });
*/
            dashixiong.getUserByOPs(type,function(err, ret){
                if(err){
                    console.log(err);
                    return;
                }
                ret.forEach(function(doEle, i){
                    var dataObj = {};
                    var con = JSON.parse(doEle.content);
                    console.log('doEle.timeStamp==='+doEle.timeStamp);
                    dataObj.id = doEle.id
                    dataObj.err = con.err;
                    dataObj.userId = con.userId || '--';
                    dataObj.au = con.au || '--';
                    if(doEle.timeStamp=='0000-00-00 00:00:00')
                    {
                        dataObj.timeStamp = doEle.timeStamp;//如果时间为0的就不处理了
                    }else{
                        dataObj.timeStamp = uutil.getDateTextByTimeStamp(doEle.timeStamp);
                    }
                    data.push(dataObj);
                });
                render(req, res, 'admin/product_compatible',{
                    datas: data
                });
            });
        });
  //产品兼容统计删除操作
     app.post('/dashixiongwx/admin/compatible/status/statistics/delete',
         middleware_power.boss,
         function(req,res){
            var errid = req.body.id;
            dashixiong.deleteUserOPs(errid,function(err){
                if(err){
                    console.log(err);
                }
                res.end('delete error log success');
            });

     });

//记录谁发放了道具
    app.post('/dashixiongwx/admin/shop/:shop_id/tool/grant/:user_id/:tool_id/monitor/tools',
        function(req, res){
            var logUser = req.cookies.user_id;//当前登录用户
            var commonUser = req.params.user_id,//普通用户
                toolId = req.params.tool_id;//道具ID
            var type = 'sentTools';
            dashixiong.getToolTitleById(toolId, function(err, ret){
                var toolTitle = {};
                if(err){
                    console.log(err);
                    return;
                }
                if(ret){
                    ret.forEach(function(doEle, i){
                        toolTitle.title = doEle.title;
                    });
                }
                var op = {
                    logUser: logUser,
                    commonUser: commonUser,
                    title: toolTitle.title,
                    timeStamp: uutil.getDateTextByTimeStamp(new Date())
                };
                //将发放道具操作记录到数据库
                dashixiong.insertUserOpToSystemMonitor(type, op, op.timeStamp, function(err, r){
                    if(err){
                        console.log(err);
                        return;
                    }
                    res.end('');
                });
            });

        });

//    查询发放道具操作
    app.get('/dashixiongwx/admin/shop/:shop_id/tool/grant/monitor',
        middleware_power.boss,
        function(req, res){
            var type = 'sentTools';
            var datas = [];
            var dt = new Date(),
                y = req.query.y,
                m = req.query.m,
                d = req.query.d,
                timeStamp = dashixiong.getDateStartAndEndTimeStamp(y,m,d);

            if(y && m && d){
                dt.setFullYear(y-0);
                dt.setMonth(m-0-1);
                dt.setDate(d-0);
            }else{
                y = dt.getFullYear();
                m = dt.getMonth()+1;
                d = dt.getDate();
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

            var pre_date = dashixiong.getDates(dt.getTime()).pre;//前一天
            var next_date = dashixiong.getDates(dt.getTime()).next;//后一天

            dashixiong.getUserOPs(type, time_stamp_start, time_stamp_end, function(err, ret){
                if(err){
                    console.log(err);
                    return;
                }
                if(ret){
                    ret.forEach(function(doEle, i){
                        var obj = {};
                        var json = JSON.parse(doEle.content);
                        obj.logUser = json.logUser;
                        obj.commonUser = json.commonUser;
                        obj.title = json.title;
                        obj.timeStamp = json.timeStamp;
                        datas.push(obj);
                    });
                }
                render(req, res, 'admin/monitor_tools',{
                    datas: datas,
                    pre_date_y: pre_date.getFullYear(),
                    pre_date_m: pre_date.getMonth() + 1,
                    pre_date_d: pre_date.getDate(),
                    next_date_y: next_date.getFullYear(),
                    next_date_m: next_date.getMonth() + 1,
                    next_date_d: next_date.getDate(),
                    y : y,
                    m : m,
                    d : d
                });
            });
        });

//    记录上架、下架、库存操作到数据库
    app.post('/dashixiongwx/admin/shop/:shop_id/productop',
        function(req, res){
            var shopId = req.params.shop_id;
            var text = req.body.text;//操作文本
            var userId = req.cookies.user_id;
            var time = uutil.getDateTextByTimeStamp(new Date());
            var type = 'productOp';
            var $sectionId = req.body.sectionId || '-1000';
            var $pId = req.body.pId || '-1000';
            var $title = req.body.title;

            var op = {
                userId : userId,
                shopId : shopId,
                sectionId : $sectionId,
                pId : $pId,
                title : $title,
                text : text
            };
            //得到货架名
            dashixiong.getSectionNameById($sectionId, function(err, secName){
                if(err){
                    console.log(err);
                    return;
                }
                secName.forEach(function(doEle, i){
                    op.sectionName = doEle.name;
                });
                //得到产品名
                dashixiong.getProNameByProId($pId, function(err, pTitle){
                    if(err){
                        console.log(err);
                        return;
                    }
                    pTitle.forEach(function(doEle, j){
                        op.title = doEle.title;
                    });
                    //得到昵称
                    dashixiong.getNickById(userId, function(err, _nick){
                        if(err){
                            console.log(err);
                            return;
                        }
                        _nick.forEach(function(doEle, k){
                            op.nick = doEle.nick;
                        });

                        dashixiong.insertUserOpToSystemMonitor(type, op, time, function(err, ret){
                            if(err){
                                console.log(err);
                                return;
                            }
                            res.end('');
                        });
                    });
                });
            });
        });

//    查询上架、下架、库存操作
    app.get('/dashixiongwx/admin/shop/:shop_id/sectionop/select',
        middleware_power.boss,
        function(req, res){
            var type = 'productOp';
            var datas = [];
            var _datas = [];
            var dt = new Date(),
                y = req.query.y,
                m = req.query.m,
                d = req.query.d,
                timeStamp = dashixiong.getDateStartAndEndTimeStamp(y,m,d);
            var newStr = req.query.newStr || 'NULL';
            var str = newStr.split(',');

            if(y && m && d){
                dt.setFullYear(y-0);
                dt.setMonth(m-0-1);
                dt.setDate(d-0);
            }else{
                y = dt.getFullYear();
                m = dt.getMonth()+1;
                d = dt.getDate();
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

            var pre_date = dashixiong.getDates(dt.getTime()).pre;//前一天
            var next_date = dashixiong.getDates(dt.getTime()).next;//后一天

            if(newStr != 'NULL'){
                dashixiong.getOpInfoByIds(str, time_stamp_start, time_stamp_end, function(err, info){
                    if(err){
                        console.log(err);
                        return;
                    }
                    info.forEach(function(doEle, i){
                        var obj = {};
                        var json = JSON.parse(doEle.content);
                        obj.id = doEle.id;
                        obj.userId = json.userId;
                        obj.nick = json.nick;
                        obj.shopId = json.shopId;
                        obj.sectionId = json.sectionId;
                        obj.sectionName = json.sectionName;
                        obj.pId = json.pId;
                        obj.title = json.title;
                        obj.text = json.text;
                        obj.time = uutil.getDateTextByTimeStamp(doEle.timeStamp);
                        _datas.push(obj);
                    });

                    if(req.query.ajax){
                        var datas = JSON.stringify(_datas);
                        res.end(datas);
                    }
                });
            }else{
                //得到用户操作记录
                dashixiong.getUserOPs(type, time_stamp_start, time_stamp_end, function(err, ret){
                    if(err){
                        console.log(err);
                        return;
                    }
                    if(ret){
                        ret.forEach(function(doEle, i){
                            var obj = {};
                            var json = JSON.parse(doEle.content);
                            obj.id = JSON.parse(doEle.id);
                            obj.userId = json.userId;
                            obj.nick = json.nick;
                            obj.shopId = json.shopId;
                            obj.sectionId = json.sectionId;
                            obj.sectionName = json.sectionName;
                            obj.pId = json.pId;
                            obj.title = json.title;
                            obj.text = json.text;
                            obj.time = uutil.getDateTextByTimeStamp(doEle.timeStamp);
                            datas.push(obj);
                        });
                    };

                    render(req, res, 'admin/section_op',{
                        datas: datas,
                        pre_date_y: pre_date.getFullYear(),
                        pre_date_m: pre_date.getMonth() + 1,
                        pre_date_d: pre_date.getDate(),
                        next_date_y: next_date.getFullYear(),
                        next_date_m: next_date.getMonth() + 1,
                        next_date_d: next_date.getDate(),
                        y : y,
                        m : m,
                        d : d
                    });
                });
            }


        });


//   记录订单是谁-捡、递、送的barcode****add by@lufeng
    app.get('/dashixiongwx/admin/shop/:shop_id/:user_id/barcode',
        middleware_power.worker,
        function(req, res){
            var shopId = req.params.shop_id,
                idCardNum = req.params.user_id || 0;

        render(req, res,'admin/salesman_draw_barcode', {
            layout: false,
            shop_id: shopId,
            idCardNum: idCardNum
        });
    });
//   保存订单是谁-捡、递、送的barcode****add by@lufeng
    app.post('/dashixiongwx/admin/shop/save/barcode',
        middleware_power.worker,
        function(req, res){
            var paramsVal = req.body.arg;
            //正则拆分barcode
            var barcode = paramsVal.barcode;

            if(barcode.indexOf('\n')!=-1){//有换行符，以换行分割
                var barcodeArr = (barcode+'\n').split('\n');
            }else if(barcode.indexOf(' ')!=-1){//有空格，以空格分割
                var barcodeArr = (barcode+' ').split(' ');
            }else if(barcode.indexOf(' ')==-1){//运行到这里就是只有一个条码咯
                var barcodeArr = (barcode+' ').split(' ');
            }else{
                console.log('姆玩我啦');
            }

            //条码数组去重
            var arrUniq = function(arr){
                var o = {},newArr = [], j;
                for(var i = 0,len = arr.length; i < len; i++){
                    if(typeof (o[arr[i]]) == 'undefined'){
                        o[arr[i]] = "";
                    }
                }
                for(j in o){
                    newArr.push(j);
                }
                return newArr;
            };
            barcodeArr = arrUniq(barcodeArr);
            paramsVal.barcode = barcodeArr;
            //查询是否有重复提交

            dashixiong.findAllRecord(barcodeArr, function(err2, rows2){
                if(err2 || rows2.length>0){
                    if(rows2.length>0){
                        res.end(JSON.stringify(rows2));
                    }
                    return;
                }else{
                    //保存
                    dashixiong.insertIntoBarCode(paramsVal, function(err){
                        if(err){
                            console.log(err);
                            res.end('failure');
                        }else{
                            res.end('sus');
                        }
                    });
                }
            });
    });

//   查询订单是谁-捡、递、送的barcode****add by@lufeng
    app.post('/dashixiongwx/admin/shop/find/barcode',
        middleware_power.worker,
        function(req, res){
            var parmasJson = req.body.arg;
            dashixiong.findBarCodeByUserIdDate(parmasJson, function(err, rows){
                if(err){
                    console.log(err);
                    res.end('failure');
                    return;
                }
                res.end(JSON.stringify(rows));
            });
    });

    //渠道信息
    app.get('/dashixiongwx/admin/shop/:shop_id/active/channel',
        middleware_power.operator,
        function(req, res){
            render(req, res, 'admin/active_channel',{
                layout: 'admin/layout'
            });
        });

    //提交渠道信息
    app.post('/dashixiongwx/admin/shop/:shop_id/active/dochannel',
        middleware_power.operator,
        function(req, res){
            var shopId = req.params.shop_id;
            var channel = req.body.channel;
            var timeStamp = new Date().getTime();

            if(channel.qId && channel.mark && channel.shopId){
                if(channel.qId-0>50000){
                    dashixiong.queryIdFromChannel(channel.qId-0, function(err, ret){
                        if(err){
                            console.log(err);
                            return;
                        }
                        if(!ret[0]){
                            dashixiong.insertChannel(channel, timeStamp, function(err, channel){
                                if(err){
                                    console.log(err);
                                    return;
                                }
                                res.redirect('/dashixiongwx/admin/shop/'+shopId+'/active/channel');
                            });
                        }else{
                            res.setHeader('content-type','text/html;charset=utf-8');
                            res.end('<div style="left: 40%;top: 40%; position: absolute;"><span style="color: #40A0C0;">灰常抱歉，渠道ID已存在！</span><a style="color: #40A0C0;" href="javascript:history.go(-1)">点击这里返回</a></div>');
                        }
                    });

                }else{
                    res.setHeader('content-type','text/html;charset=utf-8');
                    res.end('<div style="left: 40%;top: 40%; position: absolute;"><span style="color: #40A0C0;">灰常抱歉，渠道ID必须大于50000！</span><a style="color: #40A0C0;" href="javascript:history.go(-1)">点击这里返回</a></div>');
                }
            }else{
                res.setHeader('content-type','text/html;charset=utf-8');
                res.end('<div style="left: 40%;top: 40%; position: absolute;"><span style="color: #40A0C0;">灰常抱歉，数据输入不完整！</span><a style="color: #40A0C0;" href="javascript:history.go(-1)">点击这里返回</a></div>');
            }
        });

    //验证渠道ID
    app.post('/dashixiongwx/admin/shop/:shop_id/query/qId',
        function(req, res){
            var id = req.body.id;
            if(id>50000){
                dashixiong.queryIdFromChannel(id, function(err, ret){
                    if(err){
                        console.log(err);
                        return;
                    }
                    if(ret[0]) {
                        res.end('渠道ID已存在');
                    }else{
                        res.end('');
                    }
                });
            }else{
                return;
            }
        });

    //得到最新渠道ID
    app.get('/dashixiongwx/admin/shop/:shop_id/query/lastId',
        middleware_power.operator,
        function(req, res){
            dashixiong.queryLastChannelId(function(err, ret){
                if(err){
                    console.log(err);
                    return;
                }
                if(ret[0]){
                    var lastId = JSON.stringify(ret[0]);
                    res.end(lastId);
                }else{
                    res.end('0');
                }
            });
        });

    //查询所有渠道信息
    app.get('/dashixiongwx/admin/shop/:shop_id/queryChannelInfo',
        middleware_power.operator,
        function(req, res){
            var info = [];
            dashixiong.queryChannelInfo(function(err, ret){
                if(err){
                    console.log(err);
                    return;
                }
                ret.forEach(function(doEle, i){
                    var obj = {};
                    obj.qId = doEle.qId;
                    obj.mark = doEle.mark;
                    obj.shopId = doEle.shopId;
                    obj.count = doEle.count;
                    obj.timeStamp = uutil.getDateTextByTimeStamp(doEle.timeStamp);
                    info.push(obj);
                });
                render(req, res, 'admin/channel_info',{
                    infos : info
                });
            });
        });

    //根据渠道ID得到渠道具体信息
    app.get('/dashixiongwx/admin/shop/:shop_id/queryChannelInfo/qId/:qId',
        middleware_power.operator,
        function(req, res){
            var shopId = req.params.shop_id;
            var qId = req.params.qId;
            var da = new Date();
            var y = da.getFullYear();
            var m = da.getMonth()+1;
            var d = da.getDate();

            var start = y+'-'+m+'-'+d+' '+'00:00:00';
            var startStamp = new Date(start).getTime();
            var end = y+'-'+m+'-'+d+' '+'23:59:59';
            var endStamp = new Date(end).getTime();

            var allAttentionNum = 0;
            var validAttentionNum = 0;
            var cancelAttentionNum = 0;
            var tarObj = {};
            var qCount = {};

            var a = new asyncMgr.AsyncAction();
            a.register('get_count');
            a.register('get_all_attention_num');
            a.register('get_valid_attention_num');
            a.register('get_cancel_attention_num');
            a.onAllDone = function(){
                render(req, res, 'admin/channel_specific_info',{
                    qId: qId,
                    allAttentionNum: allAttentionNum,
                    validAttentionNum: validAttentionNum,
                    cancelAttentionNum: cancelAttentionNum,
                    tarObj: qCount
                });
            };

            var obj = {
                qId: qId,
                start: startStamp,
                end: endStamp
            };
            //该渠道总关注人数
            dashixiong.getAllAttentionNum(obj, function(err, allNum){
                if(err){
                    console.log(err);
                    res.end('');
                    return;
                }
                allAttentionNum = allNum[0].allAttentionNum;
                a.thisDone('get_all_attention_num');
            });
            //该渠道有效关注人数
            dashixiong.getValidAttentionNum(obj, function(err, validNum){
                if(err){
                    console.log(err);
                    res.end('');
                    return;
                }
                validAttentionNum = validNum[0].validAttentionNum;
                a.thisDone('get_valid_attention_num');
            });
            //该渠道取消关注人数
            dashixiong.getCancelAttentionNum(obj, function(err, cancelNum){
                if(err){
                    console.log(err);
                    res.end('');
                    return;
                }
                cancelAttentionNum = cancelNum[0].cancelAttentionNum;
                a.thisDone('get_cancel_attention_num');
            });

            //得到当天数据
            dashixiong.getCountByTimeStamp(obj, function(err, ret){
                if(err){
                    console.log(err);
                    end(res, '区间查询每条渠道人数出错！');
                    return;
                }
                if(ret && ret.length>0){
                    tarObj.qId = ret[0].qId || 0;
                    tarObj.count = ret[0].count || 0;
                }
                qCount = tarObj;
                a.thisDone('get_count');
            });
        });
    //区间查询每条渠道人数
    app.get('/dashixiongwx/admin/shop/:shop_id/queryChannelInfo/qId/:qId/specific_info',
        middleware_power.operator,
        function(req, res){
            var shopId = req.params.shop_id;
            var qId = req.params.qId;
            var start = req.query.start_date;
            var end = req.query.end_date;

            if(!start || !end){
                end(res, '对不起，您没有选择时间');
                return;
            }

            var startDate = start+' '+'00:00:00';
            var startStamp = new Date(startDate).getTime();
            var endDate = end+' '+'00:00:00';
            var endStamp = new Date(endDate).getTime();
            var obj = {
                qId: qId,
                start: startStamp,
                end: endStamp
            };
            dashixiong.getCountByTimeStamp(obj, function(err, ret){
                if(err){
                    console.log(err);
                    end(res, '区间查询每条渠道人数出错！');
                    return;
                }
                if(ret && ret.length>0){
                    var tarObj = {};
                    tarObj.qId = ret[0].qId || 0;
                    tarObj.count = ret[0].count || 0;
                    var infoArrStr = JSON.stringify(tarObj);
                    if(req.query.isAjax){
                        res.end(infoArrStr);
                        return;
                    }
                    res.end('区间查询每条渠道人数出错！');
                }else{
                    end(res, '区间查询每条渠道人数出错！');
                }

            });


        });

    //删除渠道信息
    app.get('/dashixiongwx/admin/shop/:shop_id/queryChannelInfo/del',
        middleware_power.operator,
        function(req, res){
            var qId = req.query.qid;
            var shopId = req.params.shop_id;
            dashixiong.delChannelInfoByQid(qId, function(err, ret){
                if(err){
                    console.log(err);
                    return;
                }
                res.redirect('/dashixiongwx/admin/shop/'+shopId+'/queryChannelInfo');
            });
        });

//  坏货管理******add by@lufeng
    app.get('/dashixiongwx/admin/shop/:shop_id/defectiveGoodsRegistration',
        middleware_power.worker,
        function(req, res){
            var shopId = req.params.shop_id,
                y = req.query.y,
                m = req.query.m,
                d = req.query.d;
            var dt = new Date();
            if(y && m && d){
                dt.setFullYear( y - 0);
                dt.setMonth(m - 0 - 1);
                dt.setDate(d - 0);
            }else{
                y = dt.getFullYear();
                m = dt.getMonth() + 1;
                d = dt.getDate();
            }

            //从0点开始
            dt.setHours(0);
            dt.setMinutes(0);
            dt.setSeconds(0);
            var time_stamp_start =  dt.getTime();
            dt.setHours(23);
            dt.setMinutes(59);
            dt.setSeconds(59);
            var time_stamp_end = dt.getTime();
            // ---------------------- end时间设置 ------------------------------//
            var pre_date = dashixiong.getDates(dt.getTime()).pre;//前一天
            var next_date = dashixiong.getDates(dt.getTime()).next;//后一天
            var argObj = {
                shopId: shopId,
                time_stamp_start: time_stamp_start,
                time_stamp_end: time_stamp_end
            };
            dashixiong.getAllBadGoods(argObj,function(err,rows){
                if(err){
                    console.log(err);
                    res.end(' ');
                    return;
                }
                var allPrice = 0,
                    allCost = 0,
                    allNum = 0;
                rows.forEach(function(row,i){
                   allPrice += row.price * row.num;
                    allCost += row.cost * row.num;
                    allNum += row.num;
                });
                render(req, res, 'admin/defective_goods_registration',{
                    layout: false,
                    badGoods: rows || [],
                    allPrice: allPrice,
                    allCost: allCost,
                    allNum: allNum,
                    shop_id: shopId,
                    y: y,
                    m: m,
                    d: d,
                    pre_date_y: pre_date.getFullYear(),
                    pre_date_m: pre_date.getMonth() + 1,
                    pre_date_d: pre_date.getDate(),

                    next_date_y: next_date.getFullYear(),
                    next_date_m: next_date.getMonth() + 1,
                    next_date_d: next_date.getDate(),

                    //星期几
                    xingqi: uutil.getChineseDay(dt)

                });
            });

    });
//  保存坏货登记******add by@lufeng
    app.post('/dashixiongwx/admin/shop/:shop_id/save/defectiveGoodsRegistration',
        middleware_power.worker,
        function(req, res){
            var shopId = req.params.shop_id,
                argObj = req.body.arg;
            dashixiong.insertBadGoodsRegistration(shopId,argObj, function(err){
                if(err){
                    console.log(err);
                    res.end('failure');
                    return ;
                }
                res.end('sus');
            });
    });

//  查询坏货记录******add by@lufeng
    app.post('/dashixiongwx/admin/shop/:shop_id/find/defectiveGoodsRegistration',
        middleware_power.worker,
        function(req, res){
            var shopId = req.params.shop_id,
                params = req.body.arg;
            var argJson = {
                    shopId: shopId,
                    startDate: new Date(params.startDate).getTime(),
                    endDate: new Date(params.endDate).getTime()
                };
            dashixiong.findBadGoodsByDate(argJson, function(err, rows){
                if(err){
                    console.log(err);
                    res.end('xx');
                    return;
                }
                try{
                    rows.forEach(function(row,i){
                        row['shopId'] = shopId;
                    });
                    res.end(JSON.stringify(rows));
                }catch (e){
                    res.end('xx');
                }

            });
    });

//  删除坏货记录*******add by@lufeng
    app.post('/dashixiongwx/admin/shop/:shop_id/delete/defectiveGoodsRegistration',
        middleware_power.worker,
        function(req, res){
        var id = req.body.id;
            dashixiong.delBadGoodById(id, function(err){
                if(err){
                    console.log(err);
                    res.end(' ');
                    return;
                }
                res.end('sus');
            });
    });
    //新用户分析
    app.get('/dashixiongwx/admin/shop/:shop_id/analysis/new/users',
        middleware_power.operator,
        function(req, res){
            render(req, res, 'admin/analysis_newuser',{
                layout: true
            });

        });

    app.post('/dashixiongwx/admin/shop/:shop_id/analysis/new/users/isAjax',
        middleware_power.operator,
        function(req, res){
            var timeOne = req.body.timeOne;
            var timeTwo = req.body.timeTwo;

            var start = timeOne+' '+'00:00:00';
            var end = timeTwo+' '+'23:59:59';
            var startStamp = new Date(start).getTime();
            var endStamp = new Date(end).getTime();

            var shopId = req.body.shopId;
            var userIds = [];
            var userIdsTmp = [];
            var orderedIds = [];
            var orderedIdsTmp = [];
            var newIds = [];
            //取出区间内所有下单userId
            admin.getUserByRange(startStamp, endStamp, shopId, function(err, ret){
                if(err){
                    console.log(err);
                    return;
                }
                ret.forEach(function(doEle, i){
                    if(doEle.userId){
                        userIds.push(doEle.userId);
                    }
                });

                userIdsTmp = uutil.quchong(userIds);//区间内下单userId

                var obj = {
                    timeOne: startStamp,
                    timeTwo: endStamp,
                    shopId: shopId,
                    userIds: userIds
                };
                //取出在某刻之前用户id
                if(obj.userIds.length>0){
                    dashixiong.getOrderedNum(obj.userIds, obj.shopId, obj.timeOne, function(err, _orderNum){
                        if(err){
                            console.log(err);
                            return;
                        }
                        _orderNum.forEach(function(doEle, i){
                            orderedIds.push(doEle.userId);
                        });

                        orderedIdsTmp = uutil.quchong(orderedIds);//timeOne之前下单userId

                        var allUserIdObj = {};
                        for(var i= 0,len=userIdsTmp.length; i < len; i++){
                            allUserIdObj[userIdsTmp[i]] = '';
                        }
                        for(var j= 0,l=orderedIdsTmp.length; j < l; j++){
                            if(allUserIdObj[orderedIdsTmp[j]]!="undefined"){
                                delete allUserIdObj[orderedIdsTmp[j]];
                            }
                        }
                        for(p in allUserIdObj){
                            newIds.push(p);//新用户id
                        }


                        //根据newIds取出新用户的下单总额
                        if(newIds.length>0){
                            dashixiong.AllNewUsersPay(shopId,startStamp,endStamp,newIds,function(err,rows){
                                if(err){
                                    console.log(err);
                                    res.end('');
                                    return;
                                }
                                //计算总额
                                try{
                                    var orderNum = rows.length,
                                        total_in = 0,
                                        averagePrice = 0;
                                    rows.forEach(function(row, i){
                                        try{
//                                            row.snapshot = uutil.strSnapshotToObj(row.snapshot);
                                            if(row && row.snapshot && JSON.parse(row.snapshot))
                                            total_in += JSON.parse(row.snapshot).total_pay;
                                        }catch (e){
                                            console.log('inner****'+e);
                                        }
                                    });
                                    averagePrice = total_in/orderNum;
                                    var resJson = {
                                        userNum: newIds.length,
                                        total_in: total_in.toFixed(2),
                                        num: orderNum,
                                        price: averagePrice.toFixed(2),
                                        newUserIds: newIds
                                    };
                                    res.end(JSON.stringify(resJson));
                                }catch (e){
                                    res.end('');
                                    console.log(e);
                                }
                            });
                        }else{
                            res.end('xx');
                        }
                    });
                }else{
                    res.end('xx');
                }
            });

        });

    app.post('/dashixiongwx/admin/shop/:shop_id/analysis/new/users/isAjaxTwo',
        middleware_power.operator,
        function(req, res){
            var ids = req.body.newIds;
            var newIds = ids.split(',');
            var timeThree = req.body.timeThree;
            var timeFour = req.body.timeFour;

            var start = timeThree+' '+'00:00:00';
            var end = timeFour+' '+'23:59:59';
            var startStamp = new Date(start).getTime();
            var endStamp = new Date(end).getTime();

            var shopId = req.body.shopId;
            var newIdTmp = [];
            var newUserIds = [];

            admin.getOrderByRange(startStamp, endStamp, shopId, newIds, function(err, ret){
                if(err){
                    console.log(err);
                    return;
                }
                try{
                    var orderNumTwo = ret.length,
                        total_inTwo = 0,
                        averagePriceTwo = 0;
                    ret.forEach(function(doEle, i){
                        newIdTmp.push(doEle.userId);
                        try{
                            if(doEle && doEle.snapshot && JSON.parse(doEle.snapshot) ){
                                total_inTwo += JSON.parse(doEle.snapshot).total_pay;
                            }
                        }catch (e){
                            console.log(e);
                        }
                    });
                    newUserIds = uutil.quchong(newIdTmp);

                    averagePriceTwo = total_inTwo/orderNumTwo;
                    var resJsonTwo = {
                        userNumTwo: newUserIds.length,
                        total_inTwo: total_inTwo.toFixed(2),
                        numTwo: orderNumTwo,
                        priceTwo: averagePriceTwo.toFixed(2),
                        newUserIdsTwo: newIds
                    };
                    res.end(JSON.stringify(resJsonTwo));

                }catch (e){
                    console.log('******isAjaxTwo******'+e);
                }
                res.end('');
            });

        });

    app.post('/dashixiongwx/admin/shop/:shop_id/analysis/new/users/next',
        middleware_power.operator,
        function(req, res){
            var ids = req.body.newIds;
            var v = req.body.v;
            var newIds = ids.split(',');
            var timeThree = req.body.timeThree;
            var timeFour = req.body.timeFour;

            var start_three = timeThree+' '+'00:00:00';
            var end_four = timeFour+' '+'23:59:59';
            var startThreeStamp = new Date(start_three).getTime();
            var endFourStamp = new Date(end_four).getTime();

            var data1 = startThreeStamp+ v*24*60*60*1000;
            var data2 = endFourStamp+ v*24*60*60*1000;
            var shopId = req.body.shopId;
            var newIdTmp = [];
            var newUserIds = [];

            admin.getOrderByRange(data1, data2, shopId, newIds, function(err, ret){
                if(err){
                    console.log(err);
                    return;
                }
                try{
                    var orderNumTwo = ret.length,
                        total_inTwo = 0,
                        averagePriceTwo = 0;
                    ret.forEach(function(doEle, i){
                        newIdTmp.push(doEle.userId);
                        try{
                            if(doEle && doEle.snapshot && JSON.parse(doEle.snapshot) ){
                                total_inTwo += JSON.parse(doEle.snapshot).total_pay;
                            }
                        }catch (e){
                            console.log(e);
                        }
                    });
                    newUserIds = uutil.quchong(newIdTmp);

                    averagePriceTwo = total_inTwo/orderNumTwo;
                    var resJsonTwo = {
                        userNumTwo: newUserIds.length,
                        total_inTwo: total_inTwo.toFixed(2),
                        numTwo: orderNumTwo,
                        priceTwo: averagePriceTwo.toFixed(2),
                        newUserIdsTwo: newIds
                    };
                    res.end(JSON.stringify(resJsonTwo));

                }catch (e){
                    console.log('******next******'+e);
                }
                res.end('');
            });

        });

    //打印产品条形码
    app.get('/dashixiongwx/admin/shop/:shop_id/warehouse/:w_id/product/:pro_code/list/bar/code',
        middleware_power.worker,
        function(req, res){
            var proCode= req.params.pro_code;
            var shopId = req.params.shop_id;
            var arr = [];
            var obj = {
                proCode: proCode,
                shopId: shopId
            };
            dashixiong.getProTitleByCode(obj, function(err, ret){
                if(err){
                    console.log(err);
                    return;
                }
                ret.forEach(function(doEle, i){
                    var tar = {};
                    tar.code = doEle.code;
                    tar.title = doEle.title;
                    arr.push(tar);
                });
                render(req, res, 'admin/product_barcode',{
                    arr : arr
                });
            });

        });

    //统计送道具、人品
    app.get('/dashixiongwx/admin/shop/:shop_id/signdraw/select',
        middleware_power.operator,
        function(req, res){
            var arr = [];
            var dt = new Date(),
                y = req.query.y,
                m = req.query.m,
                d = req.query.d;
            var ids = [];
            var nickInfo = [];
            var infos = [];
            var rpRendVal = 0;

            if(y && m && d){
                dt.setFullYear(y-0);
                dt.setMonth(m-0-1);
                dt.setDate(d-0);
            }else{
                y = dt.getFullYear();
                m = dt.getMonth()+1;
                d = dt.getDate();
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

            var pre_date = dashixiong.getDates(dt.getTime()).pre;//前一天
            var next_date = dashixiong.getDates(dt.getTime()).next;//后一天

            dashixiong.getSignDraws(time_stamp_start, time_stamp_end, function(err, ret){
                if(err){
                    console.log(err);
                    end(res, '统计送道具、人品出错～');
                    return;
                }
                if(ret && ret.length>0){
                    ret.forEach(function(doEle, i){
                        var obj = {};
                        var contentObj = JSON.parse(doEle.content);
                        obj.userId = contentObj.userId;
                        ids.push(contentObj.userId);
                        obj.rp = contentObj.rpVal || '无';
                        obj.tool = contentObj.toolTitle || '无';
                        if( contentObj.rpVal ){
                            rpRendVal += contentObj.rpVal;
                        }
                        if(contentObj.qd == 'customerTool'){
                            obj.qd = '客服发放道具';
                        }
                        if(contentObj.qd == 'orderRP'){
                            obj.qd = '订单获得人品';
                        }
                        if(contentObj.qd == 'drawTool'){
                            obj.qd = '签到获得道具';
                        }
                        if(contentObj.qd == 'drawRP'){
                            obj.qd = '签到获得人品';
                        }
                        if(contentObj.qd == 'closeRP'){
                            obj.qd = '打烊签到获得人品';
                        }
                        if(contentObj.qd == 'guessTool'){
                            obj.qd = '猜奖获得道具';
                        }
                        obj.timeStamp = uutil.getDateTextByTimeStamp(doEle.timeStamp.getTime());
                        arr.push(obj);
                    });

                    dashixiong.getNickById(ids, function(err, nicks){
                        if(err){
                            console.log(err);
                            end(res, '道具/人品统计获取昵称出错～');
                            return;
                        }
                        if(nicks){
                            nicks.forEach(function(doEle, i){
                                var nickArr = {};
                                nickArr.id = doEle.id;
                                nickArr.nick = doEle.nick;
                                nickInfo.push(nickArr);
                            });
                        }
                        for(var i=0;i<arr.length;i++) {
                            for(var j=0;j<nickInfo.length;j++) {
                                if(arr[i].userId == nickInfo[j].id) {
                                    var infoObj = {};
                                    infoObj.userId = arr[i].userId;
                                    infoObj.nick = nickInfo[j].nick || 'null';
                                    infoObj.tool = arr[i].tool;
                                    infoObj.rp = arr[i].rp;
                                    infoObj.qd = arr[i].qd;
                                    infoObj.timeStamp = arr[i].timeStamp;
                                    infos.push(infoObj);
                                }
                            }
                        }
                        render(req, res, 'admin/signdraw_select',{
                            infos : infos,
                            pre_date_y: pre_date.getFullYear(),
                            pre_date_m: pre_date.getMonth() + 1,
                            pre_date_d: pre_date.getDate(),
                            next_date_y: next_date.getFullYear(),
                            next_date_m: next_date.getMonth() + 1,
                            next_date_d: next_date.getDate(),
                            y : y,
                            m : m,
                            d : d,
                            rpRendVal : rpRendVal
                        });
                    });
                }else{
                    res.setHeader('content-type','text/html;charset=utf-8');
                    res.end(y+'年'+m+'月'+d+'日'+'无统计道具、人品数据～');
                }
            });

        });

    //清除产品管理里的产品数据
    app.post('/dashixiongwx/admin/shop/:shop_id/product/clear/data',
        middleware_power.boss,
        function(req, res){
            var shopId = req.params.shop_id;
            dashixiong.clearProDataByShopId(shopId, function(err, ret){
                if(err){
                    console.log(err);
                    res.end('');
                    return;
                }
                res.end(" ");
	    });
	});
    //根据用户ID修改用户昵称
    app.post('/dashixiongwx/admin/shop/:shop_id/members/update/user/nick',
        middleware_power.boss,
        function(req, res){
            var userId = req.body.userId;
            var userNick = req.body.userNick;
            var shopId = req.body.shopId;
            dashixiong.updateNickById({userId: userId, userNick: userNick}, function(err, ret){
                if(err){
                    console.log(err);
                    res.end('更新用户昵称有误～');
                    return;
                }
                res.redirect('/dashixiongwx/admin/shop/'+shopId+'/members');
            });
        });
    //新用户运营统计
    app.get('/dashixiongwx/admin/shop/:shop_id/analysis/new/users/dataresume',
        middleware_power.operator,
        function(req, res){
            render(req, res, 'admin/newuser_dataresume',{
                layout: true
            });
        });

    var get_single_user_dataresume = function(stampArr_start, stampArr_end, shopId, fn){
        dashixiong.getRangUserByTime(stampArr_start, stampArr_end, shopId, function(err, ret){
            if(err){
                console.log(err);
                end(res, '新用户运营统计出错～');
                return;
            }
            var userIds = [];
            var userIdsTmp = [];

            var da_start = new Date(stampArr_start);
            var month_start = da_start.getMonth()+1+'/';
            var day_start = da_start.getDate();

            var da_end = new Date(stampArr_end);
            var month_end = da_end.getMonth()+1+'/';
            var day_end = da_end.getDate();

            var oneDay = month_start+day_start+'-'+month_end+day_end;

            ret.forEach(function(doEle, i){
                if(doEle.userId){
                    userIds.push(doEle.userId);
                }
            });

            userIdsTmp = uutil.quchong(userIds);//区间内下单userId

            var obj = {
                timeOne: stampArr_start,
                timeTwo: stampArr_end,
                shopId: shopId,
                userIds: userIdsTmp
            };
            var objUserIds = obj.userIds;
            var objTimeOne = obj.timeOne;
            var objShopId = obj.shopId;

            //取出在某刻之前用户id
            if(objUserIds.length>0){
                dashixiong.getOrderedNum(objUserIds, objShopId, objTimeOne, function(err, _orderNum){
                    if(err){
                        console.log(err);
                        return;
                    }
                    var orderedIds = [];
                    var newIds = [];
                    var orderedIdsTmp = [];
                    _orderNum.forEach(function(doEle, i){
                        orderedIds.push(doEle.userId);
                    });

                    orderedIdsTmp = uutil.quchong(orderedIds);//timeOne之前下单userId

                    var allUserIdObj = {};
                    for(var z= 0,len=userIdsTmp.length; z < len; z++){
                        allUserIdObj[userIdsTmp[z]] = '';
                    }
                    for(var j= 0,l=orderedIdsTmp.length; j < l; j++){
                        if(allUserIdObj[orderedIdsTmp[j]]!="undefined"){
                            delete allUserIdObj[orderedIdsTmp[j]];
                        }
                    }
                    for(p in allUserIdObj){
                        newIds.push(p);//新用户id
                    }

                    fn && fn({
                        date: oneDay,
                        newIdslen: newIds.length,
                        newUserIds : newIds,
                        userIds: userIdsTmp
                    });
                });
            }else{
                fn && fn({
                    date: oneDay,
                    newIdslen: 0,
                    newUserIds : [],
                    userIds : userIdsTmp
                });
            }
        });
    };

    //获取所有数据点的数据
    app.post('/dashixiongwx/admin/shop/:shop_id/analysis/new/users/dataresume/isAjax',
        middleware_power.operator,
        function(req, res){
            //处理数据
            var shopId = req.params.shop_id;
            var cycle = req.body.cycle;//周期
            var interval = req.body.interval;//间隔天数

            var timeOne = req.body.timeOne;
            var timeTwo = req.body.timeTwo;

            var stampArr = [];

            if( !cycle ) {
                end(res, '新用户运营统计没有输入周期～');
                return;
            }
            if( !interval ) {
                end(res, '新用户运营统计没有输入间隔天数～');
                return;
            }
            if(!timeOne || !timeTwo) {
                end(res, '新用户运营统计没有选择区间～');
                return;
            }

            var start = timeOne+' '+'00:00:00';
            var end = timeTwo+' '+'23:59:59';
            var startStamp = new Date(start).getTime();
            var endStamp = new Date(end).getTime();
            stampArr.push({start: startStamp, end: endStamp});

            for(var i=0;i<cycle;i++) {
                startStamp += interval*24*60*60*1000;
                endStamp += interval*24*60*60*1000;
                var stampObj = {};
                stampObj.start = startStamp;
                stampObj.end = endStamp;
                stampArr.push(stampObj);
            }

            //根据stamprr数组获取所有数据
            var a = new asyncMgr.AsyncOrder();
            var dataArr = [];

            stampArr.forEach(function(point, i){
                a.myTurn(function(data){
                    get_single_user_dataresume(point.start, point.end, shopId, function(resp){
                        if( data ){
                            var data_newIds = data.newUserIds;
                            var nextLen = 0;
                            var respData = resp.date;

                            var transObj = {
                                start: point.start,
                                end: point.end,
                                shopId: shopId,
                                ids: data_newIds
                            };

                            if(transObj.ids.length>0){
                                dashixiong.getOrderByIdArr(transObj, function(err, ret){
                                    if(err) {
                                        console.log(err);
                                        res.end('0');
                                        return;
                                    }
                                    nextLen = ret.length;
                                    dataArr.push({len: nextLen, date: respData});
                                });
                            }else{
                                res.end('0');
                            }

                        }else{
                            data = resp;
                            var resp_newIds = data.newUserIds;
                            var nextLen = resp_newIds.length;
                            var respData = resp.date;
                            dataArr.push({len: nextLen, date: respData});
                        }
                        a.next(data);
                    });
                });
            });

            a.go()
             .finish = function(){
                res.end( JSON.stringify(dataArr) );
            };
        });//end 新用户运营统计
    
    //获取货架上某产品库存
    app.post('/dashixiongwx/admin/shop/:shop_id/warehouse/:wid/product/:pcode/update/count',
        middleware_power.parttime_senior,
        function(req, res){
            var shopId = req.params.shop_id;
            var wid = req.params.wid;
            var pcode = req.params.pcode;
            var count = 0;
            var obj = {
                shopId: shopId,
                wid: wid,
                pcode: pcode
            };
            dashixiong.getProCount(obj, function(err, ret){
                if(err){
                    console.log(err);
                    end(res, 'get product count err');
                    return;
                }
                if(ret && ret.length>0) {
                    count = ret[0].count;
                }else{
                    end(res, 'get product count err');
                }
                if( req.body.isAjax ) {
                    res.end(JSON.stringify({count: count}));
                }
            });
        });
    //input失去焦点更新库存
    app.post('/dashixiongwx/admin/shop/:shop_id/warehouse/:wid/product/:pcode/update/count/doupdate',
        middleware_power.parttime_senior,
        function(req, res){
            var shopId = req.params.shop_id;
            var wid = req.params.wid;
            var pcode = req.params.pcode;
            var count = req.body.count;
            var obj = {
                shopId : shopId,
                wid : wid,
                pcode : pcode,
                count : count
            };
            dashixiong.updateProCount(obj, function(err, ret){
                if(err){
                    console.log(err);
                    end(res, 'update product count err');
                    return;
                }
                res.redirect('/dashixiongwx/admin/shop/'+shopId+'/section/list');
            });
        });
    app.get('/dashixiongwx/admin/shop/:shop_id/visit/store/select',
        middleware_power.operator,
        function(req, res){
            var dt = new Date(),
                y = req.query.y,
                m = req.query.m,
                d = req.query.d;

            if(y && m && d){
                dt.setFullYear(y-0);
                dt.setMonth(m-0-1);
                dt.setDate(d-0);
            }else{
                y = dt.getFullYear();
                m = dt.getMonth()+1;
                d = dt.getDate();
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

            var pre_date = dashixiong.getDates(dt.getTime()).pre;//前一天
            var next_date = dashixiong.getDates(dt.getTime()).next;//后一天

            var shopId = req.params.shop_id;
            var visitStoreArr = [];
            var ids = [];
            var idsArr = [];
            var infoArr = [];
            var transArr = [];
            dashixiong.queryVisitStoreTime( {shopId: shopId, start:time_stamp_start, end:time_stamp_end }, function(err, ret){
                if(err){
                    console.log(err);
                    res.end('queryVisitStoreTime err');
                    return;
                }
                if(ret && ret.length>0){
                    ret.forEach(function(v, i){
                        var visitStoreObj = {};
                        visitStoreObj.userId = v.userId;
                        visitStoreObj.shopId = v.shopId;
                        visitStoreObj.startTimeStamp = v.startTimeStamp;
                        visitStoreObj.transTime = v.transTime;
                        visitStoreArr.push(visitStoreObj);
                        ids.push(v.userId);
                    });
                    idsArr = uutil.quchong(ids);
                    dashixiong.getNickById(idsArr, function(err, infos){
                        if(err){
                            console.log(err);
                            res.end('get user nick err');
                            return;
                        }
                        if(infos && infos.length>0){
                            infos.forEach(function(v, i){
                                var infObj = {};
                                infObj.userId = v.id;
                                infObj.nick = v.nick;
                                infoArr.push(infObj);
                            });
                        }else{
                            res.end('no data');
                        }
                        for(var i= 0,len=visitStoreArr.length;i<len;i++){
                            for(var j=0;j<infoArr.length;j++){
                                if(visitStoreArr[i].userId == infoArr[j].userId){
                                    var transObj = {};
                                    transObj.userId = visitStoreArr[i].userId;
                                    transObj.shopId = visitStoreArr[i].shopId;
                                    transObj.startTimeStamp = uutil.getDateTextByTimeStamp(visitStoreArr[i].startTimeStamp);
                                    transObj.nick = infoArr[j].nick || 'null';
                                    transObj.transTime = visitStoreArr[i].transTime;
                                    transArr.push(transObj);
                                }
                            }
                        }
                        render(req, res, 'admin/get_visitStore_time',{
                            transArr: transArr,
                            pre_date_y: pre_date.getFullYear(),
                            pre_date_m: pre_date.getMonth() + 1,
                            pre_date_d: pre_date.getDate(),
                            next_date_y: next_date.getFullYear(),
                            next_date_m: next_date.getMonth() + 1,
                            next_date_d: next_date.getDate(),
                            y : y,
                            m : m,
                            d : d
                        });
                    });
                }else{
                    res.end('none data');
                }
            });
        });

};//end exports.route











var dashixiong = require('../controllers/dashixiong');

var uutil = require('../lib/util');
var asyncMgr = require('../lib/asyncMgr');
var dao_api = require('../models/dao_api');
var end = uutil.end;
var endErr = uutil.endErr,
    sureAry = uutil.sureAry,
    sureObj = uutil.sureObj;
var request = require('request');

//管理员查看订单handler
exports.getListOrdersHandler = function () {
    return function (req, res) {
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

        console.log(req.config);

        //如果权限小于3，则只能看到属于自己铺位的订单
        //if( req.user && req.user.power < 3 ) section_id = req.user.sectionId;

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
        var user_order_num_map = {};//记录用户最近的一个订单的id, 用来判断用户是否是新客户
        var visitor_count = 0;
        var todos = [];
        var a = new asyncMgr.AsyncAction();
        a.register('get_orders');

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
                order.isNewClient = !!(user_order_num_map[order.userId] == 1);

                try {
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
                    console.log(e);
                    ld.debug('======================================================================= ');
                }
            });

            var t_end = new Date().getTime();
            end(res, {
                orders: orders, //订单集合
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

        //获取所有人的订单
        dashixiong.listValidOrders(shop_id, time_stamp_start, time_stamp_end, 0, section_id, function (err, _orders) {
            uutil.printTime(t_start, '获取订单 耗时');
            if (!err) {
                orders = _orders;
                var user_ids = [];
                orders.forEach(function (order, i) {
                    user_ids.push(order.userId);
                });
                a.thisDone('get_orders');
                return;
            }
            a.thisDone('get_orders');
        });
    };
};

//将数据库返回的结果集按照特定id的顺序排列，key为排序的字段名
exports.sortDataWithIds = function(ids, data, key){
    var marker = {},
        res = [];
    key = key || 'id';
    data.forEach(function(v, i){
        marker[ v[key] ] = v;
    });
    ids.forEach(function(v, i){
        if( marker[v] ) res.push(marker[v]);
    });
    return res;
};

//处理监控的信息
exports.analysis = {
    getPosition : function(position, imgs){
        //如果里面含有“@”符号，说明此数据还需要进行解析
        if( position.indexOf('@') != -1 ){
            //说明这是一个图片地址
            if( position.indexOf('http://') != -1 ){
                return '<img src='+ position.split('@')[1] +'>';
            }
            //如果不是，那就用它里面的文案
            return position.split('@')[1];
        }
        //不属于以上两种情况，使用默认图片
        return '<img src='+imgs[position]+'>';
    },
    imgs : {
        "product":'http://s.ksmimi.com/dsx/img/product.jpg',
        "bag":'http://s.ksmimi.com/dsx/img/bag.jpg',
        "btn-minus":'http://s.ksmimi.com/dsx/img/btn_minus.jpg',
        "btn-add":'http://s.ksmimi.com/dsx/img/btn_add.jpg',
        "maidan":'http://s.ksmimi.com/dsx/img/maidan.jpg',
        "menu":'http://s.ksmimi.com/dsx/img/menu.jpg',
        "menu-li":'http://s.ksmimi.com/dsx/img/menu_li.jpg',
        "rank":'http://s.ksmimi.com/dsx/img/rank.jpg',
        "shopping-back":'http://s.ksmimi.com/dsx/img/shopping_back.jpg',
        "sign":'http://s.ksmimi.com/dsx/img/sign.jpg',
        "submit-btn-head":'http://s.ksmimi.com/dsx/img/submit_btn_head.jpg',
        "submit-btn":'http://s.ksmimi.com/dsx/img/maidan.jpg',
        "more-product":'http://s.ksmimi.com/dsx/img/more-product.png',
        "come-in":'http://s.ksmimi.com/dsx/img/come-in.png',
        "come-addr":'http://s.ksmimi.com/dsx/img/come-addr.png',
        "come-finish":'http://s.ksmimi.com/dsx/img/success.gif',
        "shopping-more-submit":'http://s.ksmimi.com/dsx/img/shopping-more-submit.jpg',
        "click-submit-addr":'http://s.ksmimi.com/dsx/img/click-submit-addr.jpg'
    },
    push : function( info ){
        info.content = '<div class="analysis-div">'+ info.content +'</div>'
        if( uutil.isInDevelopment() ) return; //开发环境不推送消息，免得导致socket hang up的错误
        info.type = info.type || 'push record';
        var notify_url = 'http://www.ksmimi.com:6889/dashixiongwx/notify/deliver';
        //通知 0 号店，所有消息页面接收推送消息
        var notify_all = uutil.$extend({}, info);
        notify_all.shop_id = info.shop_id;
        request.post( notify_url, {
            form : notify_all
        });
    }
};

//保存计划
exports.savePlan = function(data, fn){
    dao_api.savePlan(data, function(err, ret){
        if( err ) console.log(err);
        fn && fn( !!ret.affectedRows );
    });
};
//获取计划数据
exports.getPlans = function(data, fn){
    dao_api.getPlans(data, function(err, ret){
        if( err ) console.log(err);
        fn && fn( ret );
    });
};
//更新计划数据
exports.updatePlan = function(data, fn){
    var fields = [],
        values = [];
    for(var p in data){
        if(p != 'id'){
            fields.push(p+'=?');
            values.push(data[p]);
        }
    }
    values.push( data['id'] );
    data.sql =  'update Plans set '+ fields.join(',') +' where id=?';
    data.values = values;
    console.log(data);
    dao_api.updatePlan(data, function(err, ret){
        if( err ) console.log(err);
        fn && fn( !!ret.affectedRows );
    });
};
//删除计划数据
exports.delPlan = function(data, fn){
    dao_api.delPlan(data, function(err, ret){
        if( err ) console.log(err);
        fn && fn( !!ret.affectedRows );
    });
};
//删除计划数据
exports.updatePlanColor = function(data, fn){
    dao_api.updatePlanColor(data, function(err, ret){
        if( err ) console.log(err);
        fn && fn( !!ret.affectedRows );
    });
};
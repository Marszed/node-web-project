//抢东西活动
var asyncMgr = require('../../lib/asyncMgr');
var uutil = require('../../lib/util');
var dashixiong = require('../../controllers/dashixiong');
var logger = require('../../controllers/logger');
var food = require('../../res/food');
var conf = require('../../conf');
var request = require('request');
var wx_qr_creator = require('../../lib/wx_qr_creator');
var hash = require( '../../lib/md5' );

var middleware_load_products_map = require( '../../lib/middleware_load_products_map_of_shop' );

//--------------------------- 日志配置 ---------------------------//
var li = uutil.getLogger('INFO', 'service/activities/for_one_night.js');
var ld = uutil.getLogger('DEBUG', 'servie/activities/for_one_night.js');

//---------------------- 搞一些中间件来玩一下-------------------//
var middleware_load_user_by_wx_id = require( '../../lib/middleware_load_user_by_wx_id' );
var middleware_get_config_of_shop = require( '../../lib/middleware_get_config_of_shop' );

var middleware_check_only_once = function (req, res, next) {
    next();
    return;
    var user = req.user;

    console.log( '=============== 开抢 =============== ' );
    //读取数据库, 看看这个人有没有参加过活动
	var wx_id = req.query.wx_id || 'wx_323mmdiVsds2fbklsdopwvMMn';
    var config = req.config;
    config = uutil.settingArrayToObj(config);

    dashixiong.getUserActivity( user.id, 6, function (err, ret) {//5 为东区抢货活动
        var userAc = ret[0];
        
        if( req.query.zhimakaimen ){
            console.log( '=== 管理员无限玩 ==' );
            userAc = null;
        }
        if( !userAc ){//没参加过活动, 那就给他参加吧
            next();
            return;
        }

        li.info( '============== 参加过活动了, 不好意思 ============ ');
        render(req, res, 'wx/activity/msg', {
            msg : '只能参加一次哦, 不然我们会破产的~ 做不了土匪, 做土豪也行啊。给我们的微信回复“大师兄”, 然后按照提示进入小卖部买点东西支持一下吧~' 
        });
        return;

    });

};

var middleware_right_user = function (req, res, next) {
    next();
    return;
    var user = req.user;
    console.log( '这个用户抢东西============= ' );
    console.log( user );
    console.log( '=================抢！用户的shopId== ', user.shopId );
    if( user.shopId !=2 ){
        console.log( ' 这个用户有资格参加活动 ' );
        render(req, res, 'wx/activity/msg', {
            msg : '本活动已经结束咯!' 
        });
        return; 
    }
    next();
    
};

var middleware_right_time = function (req, res, next) {
    next();
    return;
    var user = req.user;
    var start_d = Date.UTC(2014, 3, 19, 22, 30);//月份是从0开始数的, UTC时间. 4月19日, four one nine
    var now = new Date().getTime();
    var future = new Date( start_d );//开始日期
    start_d = start_d + future.getTimezoneOffset() * 60 * 1000;

    if( start_d - now >0 && !req.query.zhimakaimen ){//离开始还有时间, 也就是还没开始
        console.log( '======= 还没开始 =========' );
        render(req, res, 'wx/activity/ac_5/waitting', {
            server_timestamp_now : now,
            server_timestamp_start : start_d,
            server_timestamp_deta : start_d - now
        });
        return; 
    }
    next();
};

var middleware_check_num_in_warehouse = function (req, res, next){
	var w_id = req.body.w_id;//当前仓库的id
	var products = JSON.parse(req.body.products);
    var map = {};
    var map_products = {};
    var ids = [];
    var ret_products = [];
    products.forEach(function (product, i) {
        map_products[ product.id ] = product;//记录下产品信息
        if( !map[ product.id ] ){
            map[ product.id ] = 0;
        }
        ++map[ product.id ];//记录下产品的数量
    });
    for( var p in map ){
        ids.push( p -0 );
    }
    console.log('ids-->>', ids, 'w_id', w_id );
    //开始看看这些产品的库存
    dashixiong.getProductsNumsInWareshouse( w_id - 0, ids, function (err, ret) {
        console.log( '====== 产品的库存是 ======' );
        console.log( err, ret );
        if( !ret.length ){
            console.log('========没有这些产品的库存的?========');
            render( req, res, 'wx/activity/msg', {
                msg : '小卖部已经被瞬间抢光光！你们这帮强盗哇！'
            });
            return;
        }

        var store_map = {};
        ret.forEach(function (store) {
            store_map[ store.pId ] = store.count;
        });
       
        //挨个看看产品库存
        ids.forEach(function (id) {
            console.log( id, '库存 ', store_map[id] );
            console.log( id, '需求 ', 1 );
            if( store_map[ id ] >=1 ){
                map[ id ] = 1;
            }else{
                map[ id ] = 0;
            }
        });
        
        for( var p in map ){
            console.log( p, '给他 ', map[p] );
            for( var i=0; i<map[p]; i++){//产品有多少个, 就在ret_products里push 多少个
                ret_products.push( map_products[p] );
            }
        }
        req.body.products = JSON.stringify(ret_products);
        console.log('-----------------');
        console.log(req.products);
        next();
    });
    
};


//=============== 常用的工具方法 =================
var render = uutil.render; 
var end = uutil.end; 
var endErr = uutil.endErr; 
var alarmAdmin = uutil.alarmAdmin;

exports.isStop = true;
exports.route = function(app){


//活动首页
app.get('/dashixiongwx/activity/6', 
        middleware_load_user_by_wx_id, //获取用户的信息
        middleware_get_config_of_shop, //店铺配置
        middleware_right_user,//规定的用户才能才加活动
        middleware_right_time,//规定的时间才能开始活动
        middleware_check_only_once,//只能参加一次活动

function(req, res){
    var config = req.config_obj;

    console.log( '=============== 开搞！ =============== ' );
    li.info( '============== 广东省一夜情活动 ============ shopId=='+req.user.shopId );
    li.info( req.user );
    li.info( '======================================= activityWarehouseId=='+config.activityWarehouseId );
     
    render( req, res, 'wx/activity/ac_6/index', {
        layout : true 
    });

});


};//end exports.route

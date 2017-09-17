//剪刀石头布赢美乐多
var asyncMgr = require('../../lib/asyncMgr');
var uutil = require('../../lib/util');
var dashixiong = require('../../controllers/dashixiong');
var md = require('node-markdown').Markdown;
var logger = require('../../controllers/logger');
var food = require('../../res/food');
var conf = require('../../conf');
var request = require('request');
var wx_qr_creator = require('../../lib/wx_qr_creator');
var hash = require( '../../lib/md5' );

var middleware_load_products_map = require( '../../lib/middleware_load_products_map_of_shop' );

//--------------------------- 日志配置 ---------------------------//
var li = uutil.getLogger('INFO', 'service/activities/jiandaoshitoubu.js');
var ld = uutil.getLogger('DEBUG', 'servie/activities/jiandaoshitoubu.js');

//---------------------- 搞一些中间件来玩一下-------------------//
var middleware_load_user_by_wx_id = require( '../../lib/middleware_load_user_by_wx_id' );
var middleware_get_config_of_shop = require( '../../lib/middleware_get_config_of_shop' );

//=============== 常用的工具方法 =================
var render = uutil.render; 
var end = uutil.end; 
var endErr = uutil.endErr; 
var alarmAdmin = uutil.alarmAdmin;

//=============== middleware ==================
var middleware_make_sure_address = function (req, res, next) {
    var addr = req.body.addr;
	var user_id = req.body.user_id;	

    if( addr.id ){//旧的地址, 直接可以过
        next();
        return;
    }

    //新的地址, 插入生成新的地址本
	dashixiong.insertAddress(user_id, addr, function(err, new_addr_id){
        if( err ){
            render(req, res, 'wx/activity/msg', {
                msg : '出了点小问题, 请返回重试.'
            });
            return;
        }
        req.body.addr.id = new_addr_id;
        next();
    });

    
};


exports.isStop = false;
exports.route = function(app){

//活动首页
app.get('/dashixiongwx/activity/7', middleware_load_user_by_wx_id, middleware_get_config_of_shop, function(req, res){
    //先检查是不是中奖了
    console.log( req.user ) ;
    dashixiong.getUserActivity( req.user.id, 7, function (err, ret) {
        var ac = ret[0];
        if( ac && JSON.parse(ac.data).ret ){//赢了才能兑奖

            dashixiong.getAddress( req.user.id, function (err, ret) {
                //兑取用户地址, 渲染兑奖页面
                render(req, res, 'wx/activity/ac_7/duijiang', {
                    action : '/dashixiongwx/activity/7/order/finish',
                    wx_id : req.query.wx_id,
                    user_id : req.user.id,
                    shop_id : req.user.shopId,
                    msg : '本活动仅限广东工程学院西区的小伙伴们参与!其他地址不送货哦~',
                    address : ret
                });
            });
            return; 
        }

        render(req, res, 'wx/activity/msg', {
            msg :  '参加了猜拳活动并且赢了的同学才能兑奖哦~'
        });
        

    });


});

//订单完成
app.post('/dashixiongwx/activity/7/order/finish', 
         middleware_load_products_map, 
         middleware_make_sure_address,
function(req, res){
    var addr = req.body.addr;
	var user_id = req.body.user_id;	
	var shop_id = req.body.shop_id;
	var wx_id = req.body.wx_id;

    var str_products = req.body.str_products;
    var products = [{
        id : 1058,
        code : '6909780000085',
        title : '【美乐多】肠道好舒服 活性乳酸菌饮料',
        unit : '瓶',
        price : 2,
        cost : 1.39,
        count : 1
    }];


    var order = {
		shop_id : 2,
		user_id : user_id,
        extra : 'activity_7',
		address_id : addr.id
	};

    //---------------- 记录一下买了什么产品 ---------------//
    var ids = [];
    products.forEach(function (product) {
        if( product.count >1 ){
            for(var i=0; i<product.count; i++){
                ids.push( product.id );
            }
            return;
        }
        ids.push( product.id );
    });
    order.product_ids = JSON.stringify(ids);
    //-----------------------------------------------------//

	//----------------- 下单时间可以通过时间戳计算出来 ----//
	order.time_stamp = new Date().getTime();

    //----------------- 生成快照 --------------------------//
	//dashixiong.setCostForProducts(products, req.products_map);//获取一下这些产品的成本, 以便生成spanshot. req.products_map 由中间件middleware_load_products_map_of_shop 加载


    var total = dashixiong.countTotal2( products );
    total.snapshot.requirements = addr.requirements.split('\n');
    //total.snapshot.requirements.push( '送货信息: '+addr.name + ' ' +addr.mobile + ' ' +addr.address );
    order.snapshot = JSON.stringify( total.snapshot );

    //----------------- 插入订单 ------------------------//
    dashixiong.insertOrder( order, function (err, ret) {
        if( err ){
            render( req, res, 'wx/activity/msg',  {
                msg : '不好意思, 出错了. 你可以联系我们的客服提交送货信息' 
            });
            return; 
        }
        render( req, res, 'wx/activity/msg',  {
            msg : 'OK! 大师兄<strong style="color:orange;font-size:24px;">今晚</strong>会给你送货的啦~可能有<strong style="color:orange;font-size:18px;">师姐</strong>送货~不要鸡动哦！要继续支持我们哟~' 
        });
    });


});




};//end route


//抢东西活动
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
var li = uutil.getLogger('INFO', 'service/activities/rubber.js');
var ld = uutil.getLogger('DEBUG', 'servie/activities/rubber.js');

//---------------------- 搞一些中间件来玩一下-------------------//
var middleware_load_user_by_wx_id = require( '../../lib/middleware_load_user_by_wx_id' );
var middleware_get_config_of_shop = require( '../../lib/middleware_get_config_of_shop' );

//=============== 常用的工具方法 =================
var render = uutil.render; 
var end = uutil.end; 
var endErr = uutil.endErr; 
var alarmAdmin = uutil.alarmAdmin;

exports.isStop = true;
exports.route = function(app){


//活动首页
app.get('/dashixiongwx/activity/4', middleware_load_user_by_wx_id, middleware_get_config_of_shop, function(req, res){
    var user = req.user;
    console.log( '这个用户抢东西============= ' );
    console.log( user );
    console.log( '=================抢！用户的shopId== ', user.shopId );
    if( user.shopId !=2 ){
        render(req, res, 'wx/activity/msg', {
            msg : '本活动已经结束咯!' 
        });
        return; 
    }

    console.log( ' 可以参加活动 ' );
    var start_d = Date.UTC(2014, 3, 8, 22, 30);//月份是从0开始数的, UTC时间
    var now = new Date().getTime();
    var future = new Date( start_d );//开始日期
    start_d = start_d + future.getTimezoneOffset() * 60 * 1000;

    if( start_d - now >0 && !req.query.zhimakaimen ){//离开始还有时间, 也就是还没开始
        console.log( '======= 还没开始 =========' );
        render(req, res, 'wx/activity/ac_4/waitting', {
            server_timestamp_now : now,
            server_timestamp_start : start_d,
            server_timestamp_deta : start_d - now
        });
        return; 
    }
    
    console.log( '=============== 开枪 =============== ' );
    //读取数据库, 看看这个人有没有参加过活动
	var wx_id = req.query.wx_id || 'wx_323mmdiVsds2fbklsdopwvMMn';
    var config = req.config;
    config = uutil.settingArrayToObj(config);

    dashixiong.getUserActivity( user.id, 4, function (err, ret) {//4 为2014年4月2日广工程西区
        var userAc = ret[0];
        console.log( '=====' );
        console.log( userAc );
        console.log( '=====' );

        
        if( req.query.zhimakaimen ){
            console.log( '=== 管理员无限玩 ==' );
            userAc = null;
        }
        if( !userAc ){//没参加过活动, 那就给他参加吧
            li.info( '============== 广东工程西区2栋搞活动 ============ shopId=='+req.user.shopId );
            li.info( req.user );
            li.info( '======================================= activityWarehouseId=='+config.activityWarehouseId );
            //req.user.shopId = 2;
            //config.activityWarehouseId = 8;
            var template = 'wx/activity/ac_4/index';
            if( req.user.shopId == 2 ){
                template = 'wx/activity/ac_4/index';
            }
            
            //获取仓库产品信息
	        dashixiong.getSectionsWithProducts(req.user.shopId, req.user.id, function(err, sections){
                render( req, res, template, {
                    layout : false,
                    wx_id : req.query.wx_id,
                    user_id : req.user.id,
                    shop_id : req.user.shopId,
                    sections : sections,
                    cur_warehouse_id : config.activityWarehouseId
                });
	        }, {cur_warehouse_id:config.activityWarehouseId-0});
            return;
        }

        li.info( '============== 参加过活动了, 不好意思 ============ ');
        render(req, res, 'wx/activity/msg', {
            msg : '只能参加一次哦, 不然我们会破产的~ 做不了土匪, 做土豪也行啊。给我们的微信回复“大师兄”, 然后按照提示进入小卖部买点东西支持一下吧~' 
        });
        return;

    });

});





app.post('/dashixiongwx/activity/addr', function(req, res){
    console.log( '=============活动页面================== ' );
	var user_id = req.body.user_id;
	var products = req.body.products;
	var w_id = req.body.cur_warehouse_id;//店面当前使用的仓库id
	var shop_id = req.body.shop_id;//当前店面的id
	var shop_name = req.body.shop_name;//当前店面的名称
	var new_order_id = null;
	var wx_id = req.query.wx_id;

    console.log( ' =========== shop_id ', shop_id );

	li.info('看看丫都抢到了什么东西:');
	li.info( products);

	products = JSON.parse(products);

	var order = {
		shop_id : shop_id,
		user_id : user_id,
		address_id : null,//下一个页面(步骤)会把这个address_id给创建或者更新, 这里先置为空
        //extra : 'activity_women_day'
        extra : 'activity_4'
	};

	//记录这个家伙买了什么
	var ids = [];
	products.forEach(function(product, i){
		ids.push(product.id);
	});
	order.product_ids = JSON.stringify(ids);

	//下单时间可以通过时间戳计算出来
	order.time_stamp = new Date().getTime();

	//-------------------------------------- 异步任务 ------------------------ //	
	var a = new asyncMgr.AsyncAction();
	a.register('insert order');
	a.register('get address');
	a.onAllDone = function(){
		if(!new_order_id){
			res.end('sorry, error.. please try again later...');
			return;
		}
        msg = '下单还没完成的哦, 你的东西还是有可能被人抢走哟~ 快快写送货地址!';
        if( shop_id ==1 ){
            msg += '必须是女生宿舍!';
        }
		render(req, res, 'wx/addr', {
			user_id : user_id,
			layout : true,
			order_id : new_order_id,
            shop_id : shop_id,
			shop_name : shop_name,
			wx_id : wx_id,
			w_id : w_id,//当前仓库的id
			products : products,
			address : address,
            msg : msg,
            action : '/dashixiongwx/activity/order/finish'
		});
	};
	//--------------------------------------- 异步任务设置完毕 -----------------//
	
	//插入一个order
	dashixiong.insertOrder(order, function(err, ret){
		if(!err){
			//插入订单数据		
			new_order_id = ret.insertId;//获取新插入的订单的id
		}
			
		a.thisDone('insert order');
	});


	//TODO: 要排一下, 最新的地址应该在首位
	var address = []; 
	if(user_id){//老用户, 查数据库获得地址本数据
		dashixiong.getAddress(user_id, function(err, ret){ 
			if(!err){
				address = ret;
			}

			a.thisDone('get address')
		});

	}else{//新用户
		a.thisDone('get address');
		
	}

	
});


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

var middleware_force_trickers = function (req, res, next) {
    next();
};


app.post('/dashixiongwx/activity/order/finish', middleware_load_products_map, middleware_check_num_in_warehouse, middleware_force_trickers, function(req, res){
	var addr = req.body.addr;
	var user_id = req.body.user_id;	
	var order_id = req.body.order_id;
	var shop_id = req.body.shop_id;
	var shop_name = req.body.shop_name;
	var products = req.body.products;
	var wx_id = req.body.wx_id;
	var w_id = req.body.w_id;//当前仓库的id
	var total = null;//订单的汇总信息
	products = JSON.parse(products);


	dashixiong.setCostForProducts(products, req.products_map);//获取一下这些产品的成本, 以便生成spanshot
	dashixiong.setCodeForProducts(products, req.products_map);//获取一下这些产品条形码, 以便在Store表中扣除
	total = dashixiong.countTotal(products);//结算一下这个订单
	
	li.info('$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$ '+ wx_id +' 搞定一个单啦！快点送货去！$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$');
	li.info(addr);
	li.info('============订单信息=============');
	li.info(products);
	li.info('=========================================================================================================')

	//订单快照
	if(addr.requirements){
		total.snapshot.requirements = addr.requirements.split('\n');//客户额外要求, 即备注
	}
	addr.snapshot = JSON.stringify(total.snapshot);
	addr.snapshot_obj = total.snapshot;
	addr.w_id = w_id;
	

	//更新order, 会根据是否是新地址创建地址本
	var updateOrder = function(o_id, u_id, add, fn){
		//判断一下add是不是一个新地址, 如果是新地址就要插入新数据获取id了
		if(add.id){//旧地址, 直接更新
			dashixiong.updateOrder(o_id, u_id, add, function(err, ret){
				fn(err, ret);
                add.shop_id = shop_id;
			});
			return;
		}

		//能运行到这里, 说明是一个新地址, 需先插入一个新地址然后才updateOrder
		dashixiong.insertAddress(u_id, add, function(err, new_addr_id){
			if(!err){
				add.id = new_addr_id;
				dashixiong.updateOrder(o_id, u_id, add, function(err, ret){
					fn(err, ret);
                    add.shop_id = shop_id;
				});
				return;
			}
			ld.debug(err);
			
		});
	};
	var response = function(){
		render(req, res, 'wx/activity/ac_4/order_sus', {
			layout : true,
			user_id : user_id,
			order_id : order_id,
			wx_id : wx_id,
			shop_name : shop_name,
			products : products, 
			total : total,
			address : addr  
		});
        //---------------------
        var ids = [];
            products.forEach(function (product, i) {
                ids.push( product.id );
            });
            //记录下来, 这个人已经参加过活动了
            dashixiong.insertUserActivity({
                data : JSON.stringify({
                    ids : ids, 
                    oid : order_id 
                }),
                user_id : user_id,
                shop_id : shop_id,
                ac_id : 4
            }, function (err, ret) {
                console.log(err, ret);
            });
	    };
	
	//检查一下用户是不是注册了(自动注册的)
	if(user_id)	{//注册过的
		updateOrder(order_id, user_id, addr, function(err, ret){
			response();//向用户展示下单成功的提示
		});
		return;
	}

});

//显示因活动产生的订单, 这些订单并非因为销售而产生
app.get('/dashixiongwx/admin/activity/shop/:shop_id/order/list', function(req, res){
    var shop_id = req.params.shop_id-0;
    var extra = req.query.extra || 'activity_women_day';
    dashixiong.listOrdersByExtra( shop_id, extra, function (err, orders) {
        orders.forEach(function (order) {
            order.intime = new Date(order.timeStamp-0).format( 'yyyy-mm-dd HH:MM:ss' );
			order.intime_text = order.intime + '('+ uutil.getTimeTxt(order.timeStamp) +')';
			order.snapshot = JSON.parse(order.snapshot);
        });
                
        render(req, res, 'wx/activity/order_list', {
	    	layout : 'admin/layout',
            orders : orders,
            extra : extra
	    });
    });
	
});

app.get('/dashixiongwx/admin/activity/shop/:shop_id/order/:order_id/detail', function(req, res){
	var order_id = req.params.order_id;
	var order = null;
	var snapshot = null;
	var motto = null;
	var a = new asyncMgr.AsyncAction();
	a.register('get_order');
	a.register('get_cur_motto');
	a.onAllDone = function(){
		var p = {
			layout : true,
			order : order,
			order_snapshot : snapshot,
			motto : motto
		};
		//小于10元的订单要加收1元跑腿费
		if( snapshot.total_pay<10 ){
			snapshot.total_pay += 1;
			p.deliver_info = {
				title : '【跑腿】小费',
				price : 1
			};
		}

		render(req, res, 'wx/activity/ac_4/order_detail', p);
	};

	dashixiong.getOrderById(order_id, function(err, ret){
		if(!err&&ret)	{
			order = ret[0];
			order.intime = new Date(order.timeStamp).format( 'yyyy-mm-dd HH:MM' );
			snapshot = JSON.parse(order.snapshot);
				
		}
		a.thisDone('get_order');
		
	});

	dashixiong.getCurMotto(function(err, _motto){
		if(!err){
			motto = _motto;	
		}
		a.thisDone('get_cur_motto');
	});

	

});



};//end exports.route

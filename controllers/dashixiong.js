//方法名字驼峰写法, 参数名称下划线写法. 数据库采用驼峰写法. 专有名词缩写首字母大写, 其他小写
var request = require('request');
var accounter = require('../controllers/accounter');
var dao = require('../models/dao');
var asyncMgr = require('../lib/asyncMgr');
var hash = require( '../lib/md5' );
var conf = require('../conf');
var products = require('../res/products');
var fs = require('fs');
var df = require( '../lib/date.format' );
var uutil = require('../lib/util');
var admin = require('../controllers/admin');

//--------------------------- 日志配置 ---------------------------//
var li = uutil.getLogger('INFO', 'dashixiong.js');
var ld = uutil.getLogger('DEBUG', 'dashixiong.js');
var sureObj = uutil.sureObj,
    sureAry = uutil.sureAry;

var map = {};

exports.ready = function(fn){
	fn();
	//exports.listProducts(function(err, _products){
	//	if(!err){
	//		_products.forEach(function(product, i){
	//			map[product.id]	= product;
	//		});
	//	}
	//	fn();
	//});
};

var getTimeTxt = function(timeStamp){
	var deta_time = new Date().getTime() - timeStamp;
	if( deta_time < 1000*60  ){
		return '刚刚';
	}else if( deta_time < 1000*60*60 ){//一个小时之内
		return (deta_time/(1000*60) ).toFixed(0)+'分钟前';
	}else if( deta_time < 1000*60*60*24 ){//一天内显示 "n小时前"
		return ( deta_time / (1000*60*60) ).toFixed(0)+'小时前';
	}else if( deta_time < 1000*60*60*24*30 ){//一个月内显示 "n天前"
		return ( deta_time / (1000*60*60*24) ).toFixed(0)+'天前';
	}else if( deta_time < 1000*60*60*24*30*365 ){//一年内显示 约n个月前
		return '约'+( deta_time / (1000*60*60*24*30) ).toFixed(0)+'个月前';
	}else{
		return 'n久以前';
	}

};
//获取某个时间的前一天和后一天的timeStamp
var getDates = function(time_stamp){
	var time_stamp_pre_day = time_stamp - 24*60*60*1000;
	var time_stamp_next_day = time_stamp + 24*60*60*1000;
	return {
		pre : new Date(time_stamp_pre_day),
		next : new Date(time_stamp_next_day)	
	};
};

//获取某一天的开始和结束，这两个timeStamp
var getDateStartAndEndTimeStamp = function(y, m, d){
	var dt = new Date();
	var dt2 = new Date();
	if( y && m && d ){//指定一天
		dt.setFullYear(y-0);
		dt.setMonth(m-0-1);
		dt.setDate(d-0);
	}else{//今天
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
	var time_stamp_the_date_now = time_stamp_start + dt2.getHours()*60*60*1000 + dt2.getMinutes()*60*1000 + dt2.getSeconds()*1000 + dt2.getMilliseconds();

	return {
		time_stamp_start : time_stamp_start,//这天的开始那个时刻的时间戳
		time_stamp_end : time_stamp_end,//这天的结束那个时刻的时间戳
		time_stamp_the_date_now : time_stamp_the_date_now //当日此时
	};
};

//TODO: 这个方法得改
var getProductsWithIds = function(ids, product_ary ){
    if( (!ids) || (!ids.length) )return [];
	var ret = [];
	var product = null;

	//用取回来的数据product_ary更新一下map
	product_ary && product_ary.forEach(function(product, i){
		map[product.id] = product;
	});
	ids.forEach(function(id, i){
		if( map[id] ){
			ret.push(map[id]);
		}
	});
	return ret;
};

//为产品设置成本, 因为客户的购物袋里的产品信息不包含成本信息, 不便于核算利润
var setCostForProducts = function(product_ary, map){
	product_ary.forEach(function(product, i){
        //如果这个订单来自餐馆，需要进行处理一下，因为它的id有可能是“3325+1242”形式的字符串
        if( typeof product.id == 'string' && product.id.indexOf('+') > -1 ){
            product.cost = map[product.id.split('+')[0]].cost;
            return;
        }
		product.cost = map[product.id].cost;
	});
};
//为产品设置条形码数
var setCodeForProducts = function(product_ary, map){
	product_ary.forEach(function(product, i){//如果是来自餐馆，由于是拼餐，id有可能是“2194+2214”的形式
        if( typeof product.id == 'string' && product.id.indexOf('+') > -1 ){
            product.code= map[product.id.split('+')[0]].code;
            return;
        }
		product.code= map[product.id].code;
	});
};

exports.mergeSnapshotProducts = function (products) {
    var map = {};
    var ret = [];
    products.forEach(function (product, i) {
        if( !map[product.id] ){
            map[ product.id ]  = product;
            map[ product.id ].total_earn = (product.price_deal - product.cost) * product.count;
            return;
        }
        map[ product.id ].count += product.count;
        map[ product.id ].total_earn += (product.price_deal - product.cost) * product.count;
    });
    var p;
    for(p in map){
        ret.push( map[p] );
    }
    return ret;
};

//从snapshot中还原回来当时的产品成交价和当时的成本
var recoverProductsFromSnapshot = function(product_ary, snapshot){
	//先搞一个map, 加快性能 
	var snap_map = {};
	snapshot.products_bought.forEach(function(product, i){
		snap_map[product.id] = {
			price_deal_that_time : product.price_deal,
			cost_that_time : product.cost	
		};
	});

    if( uutil.isPlainObj( snap_map ) ){//snapshot里竟然没有产品数据, 这种情况是不正常的, 将传入的产品ary设置成空, 这些数据以后在统计的时候就不纳入统计的范围
        product_ary = [];
        return; 
    }

	//通过snap_map 来获取当时的价格和成本	
	product_ary.forEach(function(product, i){
        if( snap_map[product.id] ) {
            product.price_deal = snap_map[product.id].price_deal_that_time;
            product.cost = snap_map[product.id].cost_that_time;
        }
	});

};

//获取ids所标示的产品的库存数量
exports.getProductsNumsInWareshouse = function (w_id, ids, fn) {
    dao.getProductsNumsInWareshouse( w_id, ids, fn );
};

var getOrderStatusText = function(status_code){
	switch (status_code){
		case 0:
			return '下单成功,等待大师兄送货';
		case 1:
			return '大师兄正乘筋斗云向你奔来~';
		case 2:
			return '已经送达';
        case 3:
            return '已取消';
	
	}
};
var comput_profit_rate = function(money_in, money_cost){
	if(!money_in)return '0';
	var rate = ((money_in-money_cost)/money_in)*100;
	return rate.toFixed(1);
};

exports.keepEnoughSections = function(products, data){
    data = data || {};
    var num = products.length,
        req = data.req,
        n = 3; //每行货架的产品个数

    //如果是"我最常买"的货架，需要限制一下，产品个数必须是3的整数倍，不然太浪费空间了
    if( data.isUsuallyBuy ){
        products.length = Math.floor(num/3)*3;
        return products;
    }

    //如果不是3的整数倍，凑几个空对象进去
    if( num % n != 0 ){
        var nearNum = Math.ceil(num/n)*n;
        for(var i = 0, len = nearNum - num; i < len; i++){
            products.push({});
        }
    }
    return products;
};

//获取在销售的商品，排除掉下架的产品(最后一个参数代表是否为我最常买，如果是，需要限制一下，产品个数必须是3的整数倍，不然太浪费空间了)
var getOnSaleProductsWithIds = function(ids, product_ary, data ){
	var ret = [];
	var product = null;
	var map = {};
    var sold_out = [];

	//用取回来的数据product_ary更新一下map
	if(product_ary){
		product_ary.forEach(function(product, i){
			map[product.id] = product;
		});
		//map.hasData = true;//通过这个属性判断是否要从数据库中加载数据来初始化map
	}
	ids.forEach(function(id, i){
		if( map[id] && map[id].productStatus!=1){//productStatus == 1表示下架了的产品
			if( map[id].productStatus == 2 ){
                sold_out.push(map[id]);
            }else{
                ret.push(map[id]);
            }
		}
	});
    ret = ret.concat(sold_out);
    return exports.keepEnoughSections(ret, data);
};



var countTotal = function(products, shop_id){
	var map = {};
	var snapshot = {};//订单快照, 记录下订单生成时的状态, 防止产品将来改名、改价 从而产生错误的结算
	var total = [];
	var total_pay = 0;
	var total_cost = 0;
	var total_num = 0;
    var actual_income = 0;
	products.forEach(function(product, i){
		if(!map[product.id]){
            var price = product.promotePrice || product.promote_price || product.price || product.price_deal;//优先使用优惠价计价 
            var obj = uutil.$extend( {}, product);
            obj.price = price;
            obj.set = [];
            map[product.id] = obj;
		}
		map[product.id].set.push(product);
	});

	for(p in map){
        map[p].count = map[p].set.length;
		total.push(map[p]);
	}
	
	snapshot.products_bought = [];

	total.forEach(function(product, i){
		total_num += product.set.length;
        if(product.price){//过滤掉产品价格不存在的非法产品
            total_pay += product.price*product.set.length;
        }
		total_cost += product.cost*product.set.length;
        actual_income = actual_income + ((product.islimit=='limit')?(product.price*product.set.length):0);//限购产品不计算在实际收入里面
		//订单快照，记录每件东西卖了多少
		snapshot.products_bought.push({
			id : product.id,
			title : product.title,
			code : product.code,
			unit : product.unit,
            section : product.section,
			price_deal : product.price,//成交价
			cost : product.cost,//成交时的成本, 因为随着时间的推移, 成本可能会发生改变
			count : product.set.length//成交数量
		});
	});

	//订单快照
	snapshot.total_num = total_num;
	snapshot.total_pay = total_pay;	
	snapshot.total_cost = total_cost;
    snapshot.actual_income = total_pay - actual_income;//实际收入

	//看看是否符合打折要求
    if( shop_id && shop_id == 7 ){ //目前只有7号店有打折
        uutil.getDiscount( snapshot );
    }

	return {
		total_num : total_num,
		total_pay : total_pay,
		total_cost : total_cost,
		snapshot : snapshot,//快照
  		list : total		
	};

};

//products内的product有一个属性叫"count", 这样的产品信息用countTotal2来清点产品信息
exports.countTotal2 = function (products) {
    var snapshot = {};
    var total_pay = 0;
	var total_cost = 0;
	var total_num = 0;

    snapshot.products_bought = [];

    products.forEach(function(product, i){
		total_num += product.count;
		total_pay += product.price*product.count;	
		total_cost += product.cost*product.count;	
		
		//订单快照，记录每件东西卖了多少
		snapshot.products_bought.push({
			id : product.id,
			title : product.title,
			code : product.code,
			unit : product.unit,
			price_deal : product.price,//成交价
			cost : product.cost,//成交时的成本, 因为随着时间的推移, 成本可能会发生改变
			count : product.count//成交数量
		});
	});
	
	//订单快照
	snapshot.total_num = total_num;
	snapshot.total_pay = total_pay;	
	snapshot.total_cost = total_cost;	

	return {
		total_num : total_num,
		total_pay : total_pay,
		total_cost : total_cost,
		snapshot : snapshot//快照
	};
    
};

exports.getUserByWxId = function(wx_id, fn){
	dao.getUserByWxId(wx_id, fn);
};
exports.getUserById = function(user_id, fn){
	dao.getUserById(user_id, fn);
};
exports.newUser = function(obj, fn){
	dao.newUser(obj, function(err, ret){
		if(ret)	{
			fn(null, ret.insertId);
			return;
		}
		fn(err);
	});
};

exports.bindUser = function(user_id, wx_id, fn){
	dao.bindUser(user_id, wx_id, fn);
};
//更新User的信息
//exports.updateUser = function(user, fn){
//	dao.updateUser(user, fn);
//};

//查找用户id
exports.getUserByEmail = function(email,fn){
    dao.getUserByEmail(email, fn);
};

//修改User的密码
exports.updatePwd = function(user,fn){
    dao.updatePwd(user, fn);
};


//更新User的信息
exports.updateUser = function(user, fn){
	dao.updateUser(user, function (err, ret) {
        for(var p in user){
            if( user[p] == '' ) delete user[p];
        }
        accounter.updateUserInCache( user, function (err2, ret2) {
            fn( err, ret );
        });
	});
};
exports.updateUserShop = function(user_id, shop_id, fn){
    exports.updateUser({
        id : user_id,
        shopId : shop_id
    }, fn);
	//dao.updateUserShop(user_id, shop_id, fn);
};


//检查库存，自动下架
exports.checkSecureCount = function( snapShot, shop_type ){
    var lists = snapShot.products_bought,
        pIds = [];
    lists.forEach(function(v,i){
        pIds.push(v.id);
    });
    dao.checkSecureCount(pIds.join(','), shop_type, function(err, ret){
        if(err) console.log(err);
    });
};


//-------------------------- UserOrder ------------------------//
exports.insertOrder = function(order, fn){
	dao.insertOrder(order, fn);
};
exports.getOrderById = function(order_id, fn){
	dao.getOrderById(order_id, fn);
};
exports.listOrdersByExtra = function (shop_id, extra, fn, is_group_by) {
    dao.listOrdersByExtra( shop_id, extra, fn, is_group_by);
};
exports.makeUserSoldData = function (shop_id, fn) {
    var orders_map = {};
    //先获取用户的订单数据
    exports.listValidOrders( shop_id, 0, 0, 0, function (err, orders) {
        //接着按照userId 分类
        orders.forEach(function (order) {
            if( !orders_map[ order.userId ] ) {
                orders_map[ order.userId ] = {
                    user_id : order.userId,
                    total_pay : 0,
                    total_cost : 0,
                    total_profit : 0
                };
            }
            
            //parse一下snapshot
            var snapshot = null;
            try {
                snapshot = JSON.parse( order.snapshot );
                orders_map[ order.userId ].total_pay += snapshot.total_pay;
                orders_map[ order.userId ].total_cost += snapshot.total_cost;
                orders_map[ order.userId ].total_profit += (snapshot.total_pay - snapshot.total_cost);
            } catch (e) {
                ld.debug(e);
                ld.debug( 'JSON.parse 出问题的订单的snapshot是: ' );
                ld.debug( order.snapshot );
            }

        });

        var ary = uutil.objToArray( orders_map );
        exports.insertUserProfits( shop_id, ary, fn );
    });//end listValidOrders

};

exports.insertUserProfits = function (shop_id, ary, fn) {
    dao.insertUserProfits( shop_id, ary, fn );
};

exports.delUserProfits = function (shop_id, fn) {
    dao.delUserProfits( shop_id, fn );
};


exports.listUsersProfit = function (shop_id, fn) {
    dao.listUsersProfit( shop_id, fn );
};

exports.getAllUserOrder = function (fn) {
    dao.getAllUserOrder( fn );
};

//------------------------- voice of Push ----------------------------//
exports.insertVoice = function(voice, fn){
    dao.insertVoice(voice, fn);
};
exports.getVoiceByShopId = function(ids, fn){
    dao.getVoiceByShopId(ids, fn);
};
exports.getVoiceById = function(ids, fn){
    dao.getVoiceById(ids, fn);
};
exports.delVoiceById = function(v_id, fn){
    dao.delVoiceById(v_id, fn);
};
exports.updateVoice = function(voice, fn){
    dao.updateVoice(voice, fn);
};

//-------------------------- AddressBook ----------------------//
exports.getAddress = function(user_id, fn){
	dao.getAddress(user_id, fn);
};
exports.getCurrentAddr = function(user_id, fn){
    dao.getCurrentAddr(user_id, fn);
};
exports.getAllAddress = function(user_id, fn){
	dao.getAllAddress(user_id, fn);
};
exports.getAddressOfShop = function(shop_id, fn){
	dao.getAddressOfShop(shop_id, fn);
};

exports.delAddr = function(addr_id, fn){
    dao.disableAddr( addr_id, fn );
};


exports.insertAddress = function(user_id, addr, fn){
	dao.insertAddress(user_id, addr, function(err, ret){
		if(!err){
			fn(null, ret.insertId);
			return;
		}
		ld.debug(err);
		//能运行到这里, 说明出错了
		fn({msg:'error, when inserting address in dao'});
	});
};



exports.sendEmail = function(obj, fn){
    var email = require('mailer'),
        template = obj.template ? obj.template : 'views/email-at.html';

    email.send({
            host : "smtp.126.com",              // smtp server hostname
            port : "25",                     // smtp server port
            domain : "localhost",            // domain used by client to identify itself to server
            to : obj.recieverEmail,
            from : 'haoduojie@126.com',
            subject : obj.subject,
            //body : body,
            template : template,
            data : obj,
            authentication : "login",        // auth login is supported; anything else is no auth
            username : "haoduojie@126.com",       // Base64 encoded username
            password : "1q2w3e."        // Base64 encoded password
        },
        function(err, result){
            //if(err){ util.log(err); }
            if(fn) fn();
        });
};



var luck_objs = [
	{
		id : 0,
		content : '【台湾进口】杏福狼牙棒 1盒',
		weight : 1
	},
	{
		id : 1,
		content : '【蓝岸】卡布奇诺咖啡 1杯',
		weight : 2
	},
	{
		id : 2,
		content : '百事可乐 1罐',
		weight : 50
	},
	{
		id : 3,
		content : '小腿王鸭腿 1根',
		weight : 150
	},
	{
		id : 4,
		content : '咪咪 1包',
		weight : 600
	},
	{
		id : 5,
		content : '运气背了点哦，木有中奖咧~ 期末考试得好好复习了~',
		weight : 200
	}
];
var doLucky = function(adAry){
	var allWeight = []; //把所有广告的权重列成数组
	var subWeight = 0;  //所有广告权重的总和
	var adver;

	adAry.forEach( function( ad , index){
		if( typeof( ad.weight ) != 'number'){
			ad.weight = 0;
		}
		subWeight += ad.weight-0;  
		allWeight.push(ad.weight);
	});

	subWeight = Math.floor( Math.random()*subWeight)+1;  //在小于权重总和取一个随机数
	var getRangeNum = function(i){
		if( i < 0 ) return 0;
		return allWeight[i] + getRangeNum (i-1); 
	};

	var getRange = function(i){ //i为组数，即第几组
		i = i - 1;  
		return { 'start' : getRangeNum(i-1) + 1, 'end' : getRangeNum(i) };
	};

	for(var i = 1, len = allWeight.length; i <= len; i++ ){  
		var pos = getRange(i);
		if( pos.start-0 <= subWeight && pos.end-0 >= subWeight ){
			adver = adAry[i-1];
			break;
		}
	}
	return adver;
};
exports.getLucky = function(wx_id, fn){
	dao.getLucky( wx_id, fn); 
};
exports.getLuckyByUserId = function(user_id, fn){
	dao.getLuckyByUserId( user_id, fn); 
};
//抽奖功能
exports.luckyDraw = function(msg, fn){
	//一个人只能抽奖两次, 先获取看看他的抽奖状态
	dao.getLucky( msg.fromUserName, function(err, ret){
		if( !err )	{
			var l = ret[0];
			if( l && l.count >=2 ){//丫已经抽过两次了, 不能再抽了
				fn(null, {
					code : 1,
					msg : 'already lucky!'//抽过了
				});
				return;	
			}
			var luck = doLucky(luck_objs);
			//运行到这里, 说明还可以继续抽奖
			dao.setLucky({
				wx_id : msg.fromUserName,
				content : luck.content,
				luck : luck
			}, function(err, ret){
				fn(null, {
					code : 0,
					luck : luck,
					content : luck.content
				});
			});
			
			return;
		}
		//运行到这里, 说明出错
		fn(err);
		
	});
};

//-------------------------------------------------------- 管理员功能------------------------------------- //
//向数据表ArticleCategory中插入文章类别-------zed
exports.insertArticleCategory = function(name , fn){
    dao.insertArticleCategory (name,fn);
}
//查询数据库中文章类别
exports.selectArticleCategory = function(fn){
    dao.selectArticleCategory(fn);
}
//加权文章
exports.sortArticleCategory = function(sort , id, fn){
    dao.sortArticleCategory(sort ,id ,fn);
}
//更新数据库中文章类别
exports._updateArticleCategory = function(name, id, fn){
    dao._updateArticleCategory(name, id, fn);
};
//删除数据库中文章类别
exports.delArticleCategory = function(id, fn){
    dao.delArticleCategory(id, fn);
}
//-------------------------------------------- Article ----------//
exports.insertArticle = function(article, fn){
    console.log('');
    console.log('article= ');
    console.log(article);
    console.log('');
	dao.insertArticle(article, fn);
};

exports.listArticles = function(shop_id, fn){
	dao.listArticles(shop_id, fn);
};
exports.listArticlesStartFromByLength = function(shop_id,category, start, length, fn){
	dao.listArticlesStartFromByLength(shop_id,category, start, length, fn);
};


exports.updateArticle = function(article, fn){
	dao.updateArticle(article, fn);
};
exports.insertArticleImg = function(img_name, fn){
	dao.insertArticleImg(img_name, fn);
};
exports.listArticleImgs = function(fn){
	dao.listArticleImgs(fn);
};
exports.delArticleImg = function(img_id, img_name, fn){
	dao.delArticleImg(img_id, function(err, ret){
		//在文件系统上删除文件	
		fs.unlink(conf.path.article_img_upload_dir+'/'+img_name, fn);
	});
};

exports.likeArticle = function (obj, fn) {
    dao.likeArticle( obj, fn );
};
exports.getLikesOfArticle = function (article_id, fn) {
    dao.getLikesOfArticle( article_id, fn );
};

//-------------------------------------------------------- Order ----------------------------------------//
exports.updateOrder = function(order_id, user_id, addr, fn, argObj){
	dao.updateOrder(order_id, user_id, addr, fn, argObj);
};

exports.updateOrderShopId = function(order, fn){
	dao.updateOrderShopId(order, fn);
};
exports.updateOrderRP = function(o_id, rp, fn){
    dao.updateOrderRP(o_id, rp, fn);
};

var operational_RP = function(obj, fn){
    /* 
     * 来到这个就是要计算订单的RP
     *
     * 1. 标记该用户返还状态 是否返还过RP UserOrder表字段orderRP 有值表示返还过,这个值就是该订单的应返还RP数 0为默认值
     * 2. 取回该用户的账户剩余RP getUserRPByUserId
     * 3. 最后计算 用户RP 更新数据库
     * 
     * */

    //有值代表返还过, 写入该订单的RP值, 同时如果这个字段有值的话表明已经返还过RP;  
    //先更新返还状态
    exports.updateOrderRP(obj.orderId, obj.status, function(err, ret){
        if(!err){
            var o = {};
            o.u_id = obj.userId;
            o.val = obj.orderRP;
            //记录用户买东西送人品
            li.info('======================订单送人品往SystemMonitor插入记录开始==========================');
            var type = "tool_rp",
                content = {
                    "userId": obj.userId,
                    "rpVal": obj.orderRP,
                    "qd": "orderRP"
                },
                timeStamp = uutil.getDateTextByTimeStamp(new Date());
            var contentStr = JSON.stringify(content);
            admin.tool_rp(contentStr, timeStamp, type, function(err, ret){
                if(!err){
                    li.info('======================订单送人品往SystemMonitor插入记录成功==========================');
                    fn(err, ret);
                    return;
                }
                fn(err);
                ld.debug(err);
            });
            //最后更新数据库
            exports.updateUserRP(o, function(err, ret){
                if(!err){
                    li.info('======================扣除RP 或 返还RP 成功 ==========================');
                    fn(err, ret);
                    return;
                }
                fn(err);
                ld.debug(err);
            });
            return;
        }
        fn(err);
        ld.debug(err);
    });
};



exports.cancelOrder = function(order_id, w_id, fn){
    var obj = {};
    dao.getOrderById( order_id,  function (err, ret) {
        if(!err){
            var order = ret[0] || {};
            var snapshot = JSON.parse(order.snapshot);
            obj.orderId = order_id;
            obj.userId = order.userId;
            
	        dao.cancelOrder(order, w_id, function(er, re){
                if(!er){
                    //如果为 0 表示没返还过RP, 就不用收回RP
                    if( order.orderRP == 0){
                        fn(er, re);
                        return; 
                    }

                    //该订单要收回的RP 因为是数据库操作val=val+值 所以扣除RP时 值为负值
                    obj.orderRP = -(uutil.orderReturnRP(snapshot.total_pay));
                    //该订单返还RP状态 
                    obj.status = 0;
                    
                    //更新RP返还状态,更新账户RP值
                    operational_RP(obj, fn);
                    return;
                }
                ld.debug(er);
                fn(er);
            })
            return;
        }
        ld.debug(err);
        fn(err);
    });
};

exports.updateOrderObj = function(order, fn){
	dao.updateOrderObj(order, fn);
};


var order_return_RP = function(o_id, fn){
    //先取回订单信息
    var obj = {};
    exports.getOrderById(o_id, function(err, ret){
        if(!err&&ret)	{
            order = ret[0] || {};
            var snapshot = JSON.parse(order.snapshot) || {};

            obj.userId = order.userId;
            obj.orderId = order.id;

            //使用了道具不返还RP 
            if(snapshot.tool_ids&&snapshot.tool_ids.length>0){
                console.log('========== 使用了道具 '+ snapshot.tool_ids +' 不返还RP ==============');
                fn(err, ret);
                return;
            }

            //订单少于16块不返还RP
            if(snapshot.total_pay-0 < 16){
                console.log('========== total_pay '+ snapshot.total_pay +' 价格少于16块,不返还RP ==============');
                fn(err, ret);
                return;
            }
            //有值代码返还过, 写入该订单的RP值, 同时如果这个字段有值的话表明已经返还过RP 默认为0;  
            if( order.orderRP > 0){
                console.log('========== 已经返还过RP ==============');
                fn(err, ret);
                return; 
            }

            obj.orderRP = uutil.orderReturnRP(snapshot.total_pay); //该订单要返还的RP
            obj.status = obj.orderRP; //该订单返还RP状态

            //来到这个就要算RP
            operational_RP(obj, fn);
            return;
        }
        fn(err);
    });
    return;
};

exports.updateOrderStatus = function(order_id, status_code, fn){

    //点击确认收货 要返还RP 取消订单要把该订单RP清0;
	dao.updateOrderStatus(order_id, status_code, function(err, ret){
        if(!err){

            //2确认收货 成功就返还RP
            if(status_code == 2){
                order_return_RP(order_id, fn);
                return;
            }
            //来到这里说明不是确认收货也不是取消订单
            fn(err, ret);
            return;
        }
        fn(err);
    });
};

exports.listOrders = function(time_stamp_start, time_stamp_end, limit, fn){
	var ffn = function(err, orders){//orders里的order的产品都是产品id, 得获得具体数据才行
		if(!err){
			var products = null;
			orders.forEach(function(order, i){
				var ids_ary = JSON.parse(order.productIds);
				products = getProductsWithIds(ids_ary);//products内的产品现在是具体的product对象
				order.total = countTotal(products);
			});
			fn(null, orders);
			return;
		}
		fn(err);
	};

	dao.listOrders(time_stamp_start, time_stamp_end, limit, ffn);
};

//查看来自所有店铺未确认的订单---------------zed
exports.listValidUnconfirmOrders = function(shop_id, time_stamp_start, time_stamp_end, limit, section_id, fn){
    var ffn = function(err, orders){//orders里的order的产品都是产品id, 接下来得获得具体数据才行
        if(!err){
            var products = null;
            orders.forEach(function(order, i){
                var ids_ary = JSON.parse(order.productIds);
                products = getProductsWithIds(ids_ary);//products内的产品现在是具体的product对象
                order.total = countTotal(products);
            });
            fn(null, orders);
            return;
        }
        ld.debug(err);
        fn(err);
    };
    dao.listValidUnconfirmOrders(shop_id, time_stamp_start, time_stamp_end, limit, section_id, ffn);
};

exports.listValidOrders = function(shop_id, time_stamp_start, time_stamp_end, limit, section_id, fn){
	var ffn = function(err, orders){//orders里的order的产品都是产品id, 接下来得获得具体数据才行
		if(!err){
			var products = null;
			orders.forEach(function(order, i){
				var ids_ary = JSON.parse(order.productIds);
				products = getProductsWithIds(ids_ary);//products内的产品现在是具体的product对象
				order.total = countTotal(products);
			});
			fn(null, orders);
			return;
		}
		ld.debug(err);
		fn(err);
	};
	dao.listValidOrders(shop_id, time_stamp_start, time_stamp_end, limit, section_id, ffn);
};

exports.listValidOrdersTwo = function(shop_id, time_stamp_start, time_stamp_end, limit, section_id, fn){
    var ffn = function(err, orders){//orders里的order的产品都是产品id, 接下来得获得具体数据才行
        if(!err){
            var products = null;
            orders.forEach(function(order, i){
                var ids_ary = JSON.parse(order.productIds);
                products = getProductsWithIds(ids_ary);//products内的产品现在是具体的product对象
                order.total = countTotal(products);
            });
            fn(null, orders);
            return;
        }
        ld.debug(err);
        fn(err);
    };
    dao.listValidOrdersTwo(shop_id, time_stamp_start, time_stamp_end, limit, section_id, ffn);
};

exports.listValidOrdersQuickly = function(shop_id, time_stamp_start, time_stamp_end, limit, fn){
	var ffn = function(err, orders){//orders里的order的产品都是产品id, 接下来得获得具体数据才行
		if(!err){
			var products = null;
			orders.forEach(function(order, i){
				var ids_ary = JSON.parse(order.productIds);
				products = getProductsWithIds(ids_ary);//products内的产品现在是具体的product对象
				order.total = countTotal(products);
			});
			fn(null, orders);
			return;
		}
		ld.debug(err);
		fn(err);
	};
	dao.listValidOrdersQ(shop_id, time_stamp_start, time_stamp_end, limit, ffn);
};

exports.listUserValidOrders = function(user_id, shop_id, limit, fn){
	var ffn = function(err, orders){//orders里的order的产品都是产品id, 接下来得获得具体数据才行
		if(!err){
			var products = null;
			orders.forEach(function(order, i){
				var ids_ary = JSON.parse(order.productIds);
				products = getProductsWithIds(ids_ary);//products内的产品现在是具体的product对象
                //countTotalWithSnapshot( order.snapshot );
				order.total = countTotal(products);
			});
			fn(null, orders);
			return;
		}
		ld.debug(err);
		fn(err);
	};
    limit = limit || 1000;
	dao.listUserValidOrders(user_id, shop_id, limit, ffn);
};


//目前这个接口只返回最近的一个订单
exports.listValidOrdersByWxId = function(wx_id, fn){
	
	//从wx_id当中获取用户id
	exports.getUserByWxId(wx_id, function(err, ret){
		if(!err){
			var user = ret[0];
			//有user就运行 listValidOrdersByUserId
			user && dao.listValidOrdersByUserId(user.id, 1, function(err, ret){
				//处理一下order的数据, 计算总价以及列出明细
				if(!err){
					if(ret.length){
						ret.forEach(function(order, i){
							//count列出明细	
							var ids_ary = JSON.parse(order.productIds);
							var products = getProductsWithIds(ids_ary);//products内的产品现在是具体的product对象
							order.total = countTotal(products);
							order.statusText = getOrderStatusText(order.orderStatus);
                            order.snapshot = JSON.parse( order.snapshot );
						});
						fn(null, ret);
						return;
					}
					//这个用户没有order
					fn(null, []);
					return;
				}
				fn({msg:'err in listValidOrdersByUserId'+err});

			});

			//没有user就说明这是一个新用户, 新用户是不会有order的, 直接返回一个空的order列表
			(!user) && fn(null, []);
			return;
		}
		//运行到这里, 说明出错了
		fn({code:1, msg : 'err in dashixiong.getUserByWxId '+err});
	});
};

exports.getLastOrdersOfUsers = function(shop_id, fn){
	dao.getLastOrdersOfUsers(shop_id, fn);
};

exports.getOrderNumOfUsers = function(user, fn){
	dao.getOrderNumOfUsers(user, fn);
};

exports.getOrderNumByOrderId = function(orderId, fn){
    dao.getOrderNumByOrderId(orderId, fn);
};



//------------------------------ section ------------------------- //
exports.insertSection = function(section, shop_id, fn){
	dao.insertSection(section, shop_id, fn);
};
exports.listSections = function(shop_id, fn){
	dao.listSections(shop_id, fn);
};
exports.listAllSections = function(shop_id, fn){
	dao.listAllSections(shop_id, fn);
};
exports.getSectionById = function(id, fn){
	dao.getSectionById(id, fn);
};
exports.updateSection = function(section, fn){
	dao.updateSection(section, fn);
};
exports.updateSectionAd = function(section, fn){
    dao.updateSectionAd(section, fn);
};
exports.getAllSectionStrategy = function(fn){
    dao.getAllSectionStrategy(fn);
};
exports.insertSectionStrategy = function(obj, fn){
    dao.insertSectionStrategy(obj, fn);
};
exports.deleteSectionStrategyById = function(arg, fn){
    dao.deleteSectionStrategyById(arg, fn);
};
//更改section 的排序, 也可以更改section内产品的排序
exports.updateSectionOrder = function(shop_id, change, fn){
	dao.updateSectionOrder(shop_id, change, fn);
};
exports.delSectionById = function(id, fn){
	dao.delSectionById(id, fn);
};
exports.getSectionsWithProducts = function(shop_id, user_id, fn, extraData){
	var a = new asyncMgr.AsyncAction();
	var sections = [];
	var ary_products_info = [];
    var recommand_products = [];
	var ret = [];
	a.register('get_sections');
	a.register('get_products');

    extraData['shop_id'] = shop_id;

	a.onAllDone = function(){
		if(!ary_products_info.length){
			fn({code:1, msg:'no products in database...? '});
			return;
		}

		sections.forEach(function(section, i){
//            if( section.name ) section.name = section.name.replace(/<[^>]*>/img, '');
            var tmp = {
				tagId : section.id,
				tagName : section.name,
                ad : section.ad,
                nPin : section.nPin,
                type : section.type,
                showOrder : section.showOrder,
                className: section.className,
				products : getOnSaleProductsWithIds( JSON.parse(section.content), ary_products_info, extraData ),
                tagShortTitle : section.short_title,
                topTime: section.topTime
			};

            //有产品的货架才添加进结果集
			if( tmp.products.length ) ret.push(tmp);
		});

        //----------------- 添加一个“你最常买”货架 -------------//
        if( recommand_products.length > 6 ){
            recommand_products.length = 6; 
        }
        var recommand_product_ids = [];
        recommand_products.forEach(function (product, i) {
            recommand_product_ids.push( product.id );
        });
        var recommand_section = {
            tagId : -1,//这个货架在数据库中是没有的
			tagName : '我最常买',
            showOrder : 999,//用一个比较高的排序, 如果别的货架需要跑到它前面那可以设置一个比这个数字大的showOrder即可
			products : getOnSaleProductsWithIds( recommand_product_ids, ary_products_info, {isUsuallyBuy:true, req:extraData.req} )
        };
        //把自定义的“我最常买”放到最前面
//        ret.unshift( recommand_section );

        //对货架进行排序
        ret.sort(function (a, b) {
            if( a.showOrder > b.showOrder ) return -1;
            return 1;
        });

        //根据货架置顶时间排序 add by lufeng
        var date = new Date(),
            curTime = date.getTime();

        var retSortByTopTime = [];
        ret.forEach(function(sec, i){
            var topTime = sec.topTime,
                topTimeArr = topTime.split(',');
            var start_hour = topTimeArr[0].substring(0,2),
                start_minute = topTimeArr[0].substring(2,4),
                end_hour = topTimeArr[1].substring(0,2),
                end_minute = topTimeArr[1].substring(2,4);
            date.setHours(start_hour-0);
            date.setMinutes(start_minute-0);
            var start_timeStamp = date.getTime();
            date.setHours(end_hour-0);
            date.setMinutes(end_minute-0);
            var end_timeSTamp = date.getTime();
            if( (start_timeStamp <= curTime) && ( curTime <= end_timeSTamp ) ){
                retSortByTopTime.unshift(sec);
            }else{
                retSortByTopTime.push(sec);
            }
        });
        /*ret.sort(function(a,b){
           return a.topTime - b.topTime;
        });*/

		fn( null, retSortByTopTime, a.user_orders );//TODO: 这种将局部数据a.user_orders返回的做法不值得提倡

	};
    //获取分店的货架信息	
	exports.listSections(shop_id, function(err, _sections){
		if(!err){
			sections = _sections;
		}
		a.thisDone('get_sections');
	});
   
    //获取分店的库存信息
	exports.listProductsInWarehouse(extraData.cur_warehouse_id, [0,2], function(err, _products){ //获取上架和售罄的产品
    //exports.listProducts(shop_id, function (err, _products) {
    	if(err){
            console.log(err);
            ld.debug( err );
		    a.thisDone('get_products');
            return;
		}

        //TODO: 临时--获取所有策略
        dao.getAllSectionStrategy(function(err,rows){
             var strategyMap = {};
             rows.forEach(function(row, i){
                 var temp = {
                     'strategyType': row.type,
                     'rate': JSON.parse((row.content)).rate
                 };
                strategyMap[row.id] = temp;
             });
            _products.forEach(function(product, i){
                product.strategyType = strategyMap[product.productStrategyId]?strategyMap[product.productStrategyId].strategyType:null;
                product.rate = strategyMap[product.productStrategyId]?strategyMap[product.productStrategyId].rate:null;
            });
            ary_products_info = _products;


        //获取用户经常买的产品
        exports.listUserValidOrders(user_id, shop_id, 100, function (err, orders) {
            if(err){
                ld.debug( err );
		        a.thisDone('get_products');
                return; 
            }

            a.user_orders = orders;//在onAllDone里面将orders通过fn返回给上层调用

            var all_products_sold = [];//曾经卖过给这个客户的所有订单里的所有产品, 注意, 会有重复的

	       	//遍历每一个单子, 把每单里的产品拿出来以便统计
	       	var products = null;
	       	var snapshot = null;
	       	orders.forEach(function(order, i){
                try {
                    snapshot = JSON.parse(order.snapshot);
	       		    all_products_sold = all_products_sold.concat(snapshot.products_bought);      
                } catch (e) {
                    ld.debug( e );
                }
	       		
	       	});	
               
	       	var ary = exports.mergeSnapshotProducts(all_products_sold);//统计一下各个产品的销量

            //----------------- 利润从高到低排序 --------------------- //
	    	var price_a;
	    	var price_b;
	    	ary.sort(function( a_product, b_product ){
	    		return  b_product.total_earn - a_product.total_earn;
	    	});
	    	//---------------------------------------------------------//
            recommand_products = ary;
		    a.thisDone('get_products');
        });
    });

    }, extraData);
    

};
exports.updateProductSection = function(s_id, p_ids, fn){
	dao.updateProductSection(s_id, p_ids, fn);
};

exports.getPossibleReach = function(shop_id, fn){
    dao.getPossibleReach(shop_id, fn);
};

//-------------------------------------------- product --------------------------------
exports.insertProduct = function(product, fn){
	dao.insertProduct(product, fn);
};

exports.getProductById = function(product_id, fn){
	dao.getProductById(product_id, fn);
};
exports.delProductByPd = function(product, fn){
	dao.delProductByPd(product, fn);
};
exports.getProductByCode = function(code, shop_id, fn){
	dao.getProductByCode( code, shop_id, fn );
};
exports.listProducts = function(shop_id, fn){
	dao.listProducts(shop_id, fn);
};
exports.importProductsFromTo = function(from_shop_id, shop_id, fn){
	dao.importProductsFromTo(from_shop_id, shop_id, fn);
};
exports.listOnSaleProducts = function(fn){
	dao.listOnSaleProducts(fn);
};
exports.listOffSaleProducts = function(fn){
	dao.listOffSaleProducts(fn);
};
exports.updateProductStatus = function(product_id, status_code, fn){
	dao.updateProductStatus(product_id, status_code, fn);
};
exports.updateProduct = function(product, fn){
	dao.updateProduct(product, fn);
};
exports.updateProductImg = function(product_id, img, fn){
	dao.updateProductImg(product_id, img, fn);
};
exports.exportProductsToWarehouse = function(ids, to_w_id, fn){
	dao.exportProductsToWarehouse(ids, to_w_id, fn);
};
exports.exportProductsToShop = function(ids, to_shop_id, fn){
	dao.exportProductsToShop(ids, to_shop_id, fn);
};
//------------------------- Notice ----------------------------
exports.insertNotice = function(content, shop_id, fn){
	dao.insertNotice(content, shop_id, fn);
};
exports.listNotices = function(shop_id, fn){
	dao.listNotices(shop_id, fn);
};
exports.updateNoticeById = function(content, id, fn){
    dao.updateNoticeById(content, id, fn);
}
exports.delNoticeById = function(id, fn){
	dao.delNoticeById(id, fn);
};
exports.setCurNotice = function(notice_id, shop_id, fn){
	dao.updateSettingOfShop('curNoticeId', notice_id, shop_id, fn);
};
exports.clearCurNotice = function(shop_id, fn){
	dao.updateSettingOfShop('curNoticeId', '', shop_id,fn);
};
exports.getCurNotice = function(shop_id, fn){
	dao.getCurNotice(shop_id, fn);
};



exports.getToReadNoticeForUser = function (user, fn) {
    var cur_notice = {};
    var user_in_cache = {};

    var a = new asyncMgr.AsyncAction();
    a.register( 'get_cur_notice' );
    a.register( 'get_user_from_cache' );
    a.onAllDone = function () {
        if( !cur_notice.content ){//当前没有notice
            fn( null, '' ) ;
            return;
        }
        
        if( user_in_cache.notice == cur_notice.content ){//用户已经看过这个notice了, 返回''
            fn( null, '' );
            return;
        }

        //能够运行到这里, 说明有需要给用户看的公告
        user_in_cache.notice = cur_notice.content;
        accounter.cacheUser( user_in_cache );//在缓存中记录用户已经看过这个notice
        fn( null, cur_notice.content);

    };
    
    exports.getCurNotice( user.shopId, function (err, ret) {
        ret&&ret[0]&&( cur_notice = ret[0] );
        a.thisDone( 'get_cur_notice' );
    });

    accounter.getUserFromCacheById( user.id, function (err, _user_in_cache) {
        _user_in_cache&&( user_in_cache = _user_in_cache );
        a.thisDone( 'get_user_from_cache' );
    });
};
exports.getToReadNoticeForWxUser = function (wx_id, fn) {
    //通过wx_id获得用户对象
    exports.getUserByWxId( wx_id, function (err, ret) {
        if( err ){
            fn( err );
            return;
        }
        var user = ret[0];
        if( !user ){
            fn(null, '');
            return;
        }

        exports.getToReadNoticeForUser( user, fn);
        
        //var cur_notice = {};
        //var user_in_cache = {};

        //var a = new asyncMgr.AsyncAction();
        //a.register( 'get_cur_notice' );
        //a.register( 'get_user_from_cache' );
        //a.onAllDone = function () {
        //    if( !cur_notice || !cur_notice.content ){//当前没有notice
        //        fn( null, '' ) ;
        //        return;
        //    }
        //    
        //    if( user_in_cache.notice == cur_notice.content ){//用户已经看过这个notice了, 返回''
        //        fn( null, '' );
        //        return;
        //    }

        //    //能够运行到这里, 说明有需要给用户看的公告
        //    user_in_cache.notice = cur_notice.content;
        //    accounter.cacheUser( user_in_cache );
        //    fn( null, cur_notice);

        //};
        //
        //exports.getCurNotice( user.shopId, function (err, ret) {
        //    ret&&ret[0]&&( cur_notice = ret[0] );
        //    a.thisDone( 'get_cur_notice' );
        //});

        //accounter.getUserFromCacheById( user.id, function (err, _user_in_cache) {
        //    _user_in_cache&&( user_in_cache = _user_in_cache );
        //    a.thisDone( 'get_user_from_cache' );
        //});


    }); 
};



//---------------------- Setting -------------------------//
exports.listSettings = function(shop_id, fn){
    dao.listSettings( shop_id, fn);
};
exports.getSettingByKey = function(key, shop_id, fn){
	dao.getSettingByKey(key, shop_id, fn);
};
exports.getSettingValueByKey = function(key, shop_id, fn){
	dao.getSettingByKey(key, shop_id, function (err, ret) {
	    if( err ){ 
            fn(err, '');
            ld.debu( err );
            return;
        }
        var setting = ret[0];
        if( !setting ){
            fn(null, '');
            return; 
        }
        fn(null, setting.settingValue);
	});
};
exports.getConfigOfShop = function(shop_id, fn){
	dao.getSettingsByShopId(shop_id, fn);
};
exports.addSettingForAllShops = function(setting_name, fn){
	dao.insertSettingForAllShops(setting_name, fn);
};
exports.delSettingByName = function(setting_name, fn){
	dao.delSettingByName(setting_name, fn);
};
exports.updateSettingOfShop = function (key, value, shop_id, fn) {
    dao.updateSettingOfShop(key, value, shop_id, fn);
};



//-------------------- LeaveStatus ---------------------------//
exports.getLeaveStatus = function(fn){
	dao.getSettingByKey('leaveStatus', fn);
};
exports.listLeaveStatus = function(shop_id, fn){
	dao.listLeaveStatus(shop_id, fn);
};
exports.insertLeaveStatus = function(content, shop_id, fn){
	dao.insertLeaveStatus(content, shop_id, fn);
};
exports.setCurLeaveStatus = function(leave_status_id, arrays, fn){
	dao.updateSettingOfShop('curLeaveStatusId', leave_status_id, arrays, fn);
};
exports.clearCurLeaveStatus = function(shop_id, fn){
	dao.updateSettingOfShop('curLeaveStatusId', '', shop_id, fn);
};
exports.clearSetCurLeaveStatus = function(arrays, fn){
    dao.clearSetCurLeaveStatus('curLeaveStatusId', '', arrays, fn);
};
exports.delLeaveStatusById = function(id, fn){
	dao.delLeaveStatusById(id, fn);
};
exports.getCurLeaveStatus = function(shop_id, fn){
	dao.getCurLeaveStatus(shop_id, function(err, ret){
		if(!err){
			fn(err, ret[0]);
			return;
		}
		fn(err);
	});
};

//-------------------- Mottos ---------------------------//
exports.listMottos = function(shop_id, fn){
	dao.listMottos(shop_id, fn);
};
exports.insertMotto = function(content, shop_id, fn){
	dao.insertMotto(content, shop_id, fn);
};
exports.setCurMotto = function(motto_id, arrays, fn){
	dao.updateSettingOfShop('curMottoId', motto_id, arrays, fn);
};
exports.clearCurMotto = function(shop_id, fn){
	dao.updateSettingOfShop('curMottoId', '', shop_id, fn);
};
exports.cancelCurMotto = function(arrays, fn){
    dao.clearSetCurLeaveStatus('curMottoId', '', arrays, fn);
};
exports.delMottoById = function(id, fn){
	dao.delMottoById(id, fn);
};
exports.getCurMotto = function(shop_id, fn){
	dao.getCurMotto(shop_id, function(err, ret){
		if(!err){
			fn(err, ret[0]);
			return;
		}
		fn(err);
	});
};





//--------------------------- Warehouse ------------------------//
exports.listWarehousesOfShop = function( shop_id, fn){
	dao.listWarehousesOfShop( shop_id, fn);
};
exports.insertWarehouse = function( house, fn){
	dao.insertWarehouse( house, fn);
};
exports.delWarehouse = function( w_id, fn){
	dao.delWarehouse( w_id, fn);
};
exports.setCurWarehouse = function( shop_id, w_id, fn){
	dao.updateSettingOfShop('curWarehouseId', w_id, shop_id, fn);
};
exports.getCurWarehouse = function( shop_id, fn ){
	dao.getCurWarehouse(shop_id, fn);
};
exports.inproductsCover = function( w_id, product_counts, fn ){
	dao.inproductsCover( w_id, product_counts, fn );
};
exports.inproductsAdd = function( w_id, product_counts, fn ){
	dao.inproductsAdd( w_id, product_counts, fn );
};
exports.listProductsInWarehouse = function( w_id, status_code, fn ){
	dao.listProductsInWarehouse( w_id, status_code, fn );
};
exports.getAllProductId = function(shop_id,fn){
    dao.getAllProductId(shop_id,fn);
};
exports.getStoreOfProductInWarehouse = function( code, w_id, fn ){
	dao.getStoreOfProductInWarehouse( code, w_id, fn );
};
exports.delStore = function( p_id, w_id, fn ){
	dao.delStore( p_id, w_id, fn );
};
exports.updateProductInStore = function( product, w_id, fn ){
	dao.updateProductInStore( product, w_id, fn );
};
exports.cancelDiscountInStore = function(wId,code,fn){
    dao.cancelDiscountInStore(wId,code,fn);
};
exports.importProducts = function( shop_id, w_id, fn ){
	dao.importProducts( shop_id, w_id, fn );
};
//---------------------------ding dan zhuan duab ------------zed----------------/
exports.selectShop = function(fn){
    dao.selectShop(fn);
}

// -------------------------- Log ---------------------------//
exports.getVisitorCount = function(shop_id, time_stamp_start, time_stamp_end, fn){
	dao.getVisitorCount(shop_id, time_stamp_start, time_stamp_end, fn);
};
exports.getTodayLogNumOfLogKey = function (key, shop_id, time_stamp_start, fn) {
    dao.getTodayLogNumOfLogKey(key, shop_id, time_stamp_start, fn);
};

exports.getVisitorDetails = function(shop_id, time_stamp_start, time_stamp_end, fn){
	dao.getVisitors(shop_id, time_stamp_start, time_stamp_end, function(err, ret){
		if(err){ 
			fn(err);
			return;
		}
		
		var ret_visitors = [];//这是本方法最终的结果集
		var user_ids = [];
		var wx_ids = [];
		var tmp_user_id = null;
		var tmp_visitor = null;
		var order_map = {};
		var user_is_new_map = {};
		var visitors_distinct = [];
		var distinct_map = {};

		ret.forEach(function(v, i){
			tmp_visitor = {};
			tmp_user_id = v.lValue.match(/^(\d+)___(.*)$/);
			if(tmp_user_id){//这个log记录的是一个老顾客的行为, 因为他有user_id
				//tmp_user_id = ;
				user_ids.push(tmp_user_id[1]);
				tmp_visitor.user_id = tmp_user_id[1];
				tmp_visitor.wx_id = tmp_user_id[2];
			}else{//游客, 整个字符串都是他的wx_id, 没有user_id
				tmp_visitor.wx_id = v.lValue.replace('undefined___', '');//一不小心log数据变成了 undefined___xxx 处理一下
			}
			wx_ids.push(tmp_visitor.wx_id);
			tmp_visitor.timeStamp = new Date(v.timeStamp).format( 'HH:MM:ss' );
			tmp_visitor.timeTxt = getTimeTxt(v.timeStamp);
			ret_visitors.push(tmp_visitor);

		});

		var a = new asyncMgr.AsyncAction();
		a.register( 'get_address' );
		a.register( 'get_orders' );
		a.register( 'get_users' );

		a.onAllDone = function(){
			var obj = {
				old_client_num : 0,
				new_client_num : 0,
				guest_num : 0	
			};
			ret_visitors.forEach(function(visitor, i){
				if( visitor.user_id ){//买过东西的顾客
					//去重, 方便统计新客户/老客户/游客 的数量
					if( !distinct_map[ visitor.user_id ] ){
						distinct_map[ visitor.user_id ] = visitor;
						visitors_distinct.push( visitor );
					}

					//如果在time_stamp_start和time_stamp_end的时间内用户有下订单的话, 把订单数记录到visitor对象上, 以便页面展示出来
					if( order_map[ visitor.user_id ] ){
						visitor.order_count = order_map[visitor.user_id];
					}

					visitor.isNewClient = user_is_new_map[ visitor.user_id ];
					return;
				}

				//--------------- 游客逻辑----------------//
				if( !distinct_map[ visitor.wx_id ] ){
					distinct_map[ visitor.wx_id ] = visitor;
					visitors_distinct.push( visitor );
				}
			});

			visitors_distinct.forEach(function(visitor, i){
				if( visitor.user_id ){//买过东西的顾客
					visitor.isNewClient?(++obj.new_client_num):(++obj.old_client_num);
					return;
				}
				++obj.guest_num;
			});

			fn(null, ret_visitors, visitors_distinct, obj);
		};

		//获取出用户id然后用这些id去拿用户的地址，从而知道具体是谁到了店里		
		dao.getAddress(user_ids, function(err, address){
			if(err){ 
				console.log(err);
				fn(err, null);
				return;
			}
			var address_map = {};
			address.forEach(function(addr, i){
				address_map[addr.userId] = addr;
			});
			
			//挨着检查把老客户的地址记录下来	
			ret_visitors.forEach(function(visitor, i){
				if( visitor.user_id && address_map[visitor.user_id] ){//如果有这个人的地址, 就在visitor对象上设置一下地址, 以便在页面上显示出来
					visitor.address = address_map[visitor.user_id];
				}
			});
			
			a.thisDone( 'get_address' );
		
		});

		//获取今天的所有order, 用以确定每个用户在time_stamp_start和time_stamp_end这个两个时间之间, 到底下了几个单子
		dao.listValidOrders( shop_id, time_stamp_start, time_stamp_end, 0, function(err, orders){
			if(!err){
				orders.forEach(function(order, i){
					if( order_map[ order.userId ] === undefined ){
						order_map[ order.userId ] = 0;
					}
					++order_map[ order.userId ];
				});
			}
			a.thisDone( 'get_orders' );
		});
		
		//获取用户的注册时间, 用以确认用户是什么时候注册, 用以确认是不是新用户
		dao.getUsersWithIds( user_ids, function(err, users){
			if( !err ){
				users.forEach(function(user, i){
					user_is_new_map[ user.id ]	= ( user.timeStamp>= time_stamp_start )&&( user.timeStamp<= time_stamp_end );
				});
				a.thisDone( 'get_users' )	
				return;	
			}
			ld.debug( err );
			a.thisDone( 'get_users' )	
		});

	
	});
};
exports.getUsersWithIds = function(user_ids, fn){
	dao.getUsersWithIds( user_ids, fn );
};
exports.getUsersOfShop = function(shop_id, fn){
	dao.getUsersOfShop( shop_id, fn );
};
exports.getUsersByWxIds = function(wx_ids, fn){
    dao.getUsersByWxIds( wx_ids, fn );
};
exports.getAllUsers = function(fn){
	dao.getAllUsers ( fn );
};

//获取某一天的概要数据, 到店客户数, 利润, 利润率之类
exports.getResumeOfDate = function(shop_id, y, m, d, fn){
    var t_start = new Date().getTime();
	var dt = new Date();
	var obj = getDateStartAndEndTimeStamp(y, m, d);
	
	var orders = [];
	var visitor_count = 0;
	var a = new asyncMgr.AsyncAction();
	a.register('get_orders');
	a.register('get_logs');
	
	a.onAllDone = function(){
		//计算一下销售额和利润
		var total_in = 0;
		var total_cost = 0;
        var snapshot;
		orders.forEach(function(order, i){
            try {
                order.intime = new Date(order.timeStamp-0).format( 'yyyy-mm-dd HH:MM:ss' );
		        snapshot = JSON.parse( order.snapshot );
			    total_in += snapshot.total_pay;
			    total_cost += snapshot.total_cost;     
            } catch (e) {
                ld.debug( e );
            }
			
		});

        uutil.printTime( t_start, '当日概况实际耗时>>>>> ' );
		fn(null, {
			order_num : orders.length,	
			
			//总收入与总成本
			total_in : total_in,
			total_cost : total_cost,
			
			//利润率
			profit_rate : comput_profit_rate(total_in, total_cost),

			//今日到店顾客总数
			visitor_count : visitor_count
		});

		
	};


	//获取访客数
	exports.getVisitorCount( shop_id, obj.time_stamp_start, obj.time_stamp_the_date_now, function(err, _count){
		if(!err){
			visitor_count = _count;
		}
		a.thisDone('get_logs');
	});

	var test_start = new Date(obj.time_stamp_start).format( 'yyyy-mm-dd HH:MM:ss' );
	var test_now = new Date(obj.time_stamp_the_date_now).format( 'yyyy-mm-dd HH:MM:ss' );
	//获取今天所有的订单
	exports.listValidOrders(shop_id, obj.time_stamp_start, obj.time_stamp_the_date_now, 0, function(err, _orders){
		if(!err){
			orders = _orders;	
		}
		a.thisDone('get_orders');
	});
};

//获取某一天的概要数据, 到店客户数, 利润, 利润率之类
//exports.getResumeOfDate = function(shop_id, y, m, d, fn){
//    dao.getResumeOfDate( shop_id, y, m, d, fn );
//};
exports.getResumesOfDate = function(y, m, d, fn){
    dao.getResumesOfDate( y, m, d, fn );
};

//----------------------------------- FinanceRecord
exports.listFinanceRecords = function(time_stamp_start, time_stamp_end, shop_id, fn){
	dao.listFinanceRecords(time_stamp_start, time_stamp_end, shop_id, fn);
};
exports.addFinanceRecord = function(record, shop_id, fn){
	dao.addFinanceRecord(record, shop_id, fn);
};
exports.getRecordById = function(record_id, fn){
	dao.getRecordById(record_id, fn);
};
exports.updateFinanceRecord = function(record, fn){
	dao.updateFinanceRecord(record, fn);
};
exports.delFinanceRecord = function(record_id, fn){
	dao.delFinanceRecord(record_id, fn);
};
//----------------------------------- 每日数据
exports.upsertResumeOfDate = function(shop_id, date_str, obj_data, fn){
	dao.upsertResumeOfDate(shop_id, date_str, obj_data, fn);
};
exports.listDateResume = function(shop_id, limit, fn){
	dao.listDateResume(shop_id, limit, fn);
};

//----------------------------------- Shop 
exports.listShops = function(fn){
	dao.listShops(fn);
};
exports.insertShop = function(shop, fn){
	dao.insertShop(shop, fn);
};
exports.getShopById = function(shop_id, fn){
	dao.getShopById(shop_id, fn);
};
exports.updateShop = function(shop, fn){
	dao.updateShop(shop, fn);
};


//---------------------------------- Msg -------------------------------------//
exports.insertMsg = function (msg, fn) {
    dao.insertMsg( msg, fn);
};
exports.updateMsg = function (obj, fn) {
    dao.updateMsg( obj, fn);
};
//列出所有信息，传过来的shop_id未用到，你懂的！--copy
exports.listallMsgs = function (shop_id, limit, fn) {
    dao.listallMsgs( shop_id, limit, fn);
};
exports.listMsgs = function (shop_id, limit, fn) {
    dao.listMsgs( shop_id, limit, fn);
};
exports.listUserMsgs = function (shop_id, user_id, limit, fn) {
    dao.listUserMsgs( shop_id, user_id, limit, fn);
};
//点击加载更多时所有信息，传过来的shop_id未用到，你懂的！--copy
exports.getSomeMsgsallLaterThan = function (shop_id, limit, msg_id, fn) {
    dao.getSomeMsgsallLaterThan( shop_id, limit, msg_id, fn );
};
exports.getSomeMsgsLaterThan = function (shop_id, limit, msg_id, fn) {
    dao.getSomeMsgsLaterThan( shop_id, limit, msg_id, fn );
};
exports.getSomeUserMsgsLaterThan = function (shop_id, limit, user_id, msg_id, fn) {
    dao.getSomeUserMsgsLaterThan( shop_id, limit, user_id, msg_id, fn);
};

//---------------------------------- Todo -------------------------------------//
exports.addTodo = function (todo, fn) {
    dao.addTodo( todo, fn );
};
exports.getTodos = function (shop_id, fn) {
    dao.getTodos ( shop_id, fn );
};
exports.delTodo = function (todo_id, fn) {
    dao.delTodo( todo_id, fn );
};

//-------------------------- UserActivity ----------------------------//
exports.insertUserActivity = function (obj, fn) {
    dao.insertUserActivity( obj, fn );
};
exports.getUserActivity = function (user_id, ac_id, fn) {
    dao.getUserActivity( user_id, ac_id, fn);
};

//-------------------------- Tool -----------------------------------//
exports.getUserToolByToolId = function( user_id, t_id, fn ){
    dao.getUserToolByToolId( user_id, t_id, fn );
};
exports.getUserToolById = function( user_tool_id, fn ){
    dao.getUserToolById( user_tool_id, fn );
};
exports.getUserTools = function( user_id, fn ){
    dao.getUserTools( user_id, fn );
};
exports.getUserToolsByIds = function( user_tool_ids, fn ){
    dao.getUserToolsByIds( user_tool_ids, fn );
};

//这个取名的时候有点不好其实它的本意是grant tool
exports.getTool = function (tool, fn) {

    //发放道具
    dao.insertUserTool( tool, fn );

    var data = {};
    data.u_id= tool.user_id;

    //获取发放道具信息
    exports.getToolById(tool.t_id, function(err ,ret){
        if(!err){
            data.val = ret.cValue;
            //更新用户财富表
            exports.updateUserWealth(data, function(er, re){
                if(!er){
                    li.info('======================'+ tool.msg +'成功 财富更新成功==========================');
                    return;
                }
                ld.debug('===================='+ tool.msg +'财富更新 不不不不不 成功===========================');
                ld.debug(er);
            });
            return;
        }
        ld.debug('注册用户发放的道具信息获取失败');
        ld.debug(err);
    });

};

exports.grantTool = exports.getTool;//grantTool发放道具, 这个比getTool要更加传神一些

exports.recoverTool = function(recover, fn){
    dao.recoverTool(recover, fn);
};

exports.getToolsWithIds = function (ids, fn) {
    dao.getToolsWithIds( ids, fn );
};
exports.getToolById = function (id, fn) {
    dao.getToolsWithIds( [id],  function (err, ret) {
        if( err ){
            fn(err);
            return;
        }
        if( ret&&ret.length ){//有结果
            fn(null, ret[0]);
            return;
        }
        fn(null, ret);
    });
};
exports.insertAllTools = function(tool,fn){
    dao.insertAllTools(tool,fn);
};
exports.updateTools = function(tool,fn){
    dao.updateTools(tool,fn);
};
exports.deleteTools = function(id,fn){
    dao.deleteTools(id,fn);
};
exports.listAllTools = function (fn) {
    dao.listAllTools( fn );
};
exports.disableUserTool = function (tool_id, fn) {
    dao.disableUserTool( tool_id, fn );
};
exports.disableUserTools = function (ids, fn) {
    dao.disableUserTools( ids, fn );
};

//------------------ ExpressInfo -------------------//
exports.getUserExpressFetchInfo = function (user_id, fn) {
    dao.getUserExpressFetchInfo( user_id, fn );
};
exports.saveExpressFetchInfo = function (user_id, data, fn) {
    dao.saveExpressFetchInfo( user_id, data, fn );
};
exports.delExpressInfo = function (express_id, fn) {
    dao.delExpressInfo( express_id, fn );
};


// 记录有效订单返还RP
exports.insertRpByOrder = function(u_id, o_id, rp, fn){
    dao.insertRpByOrder( u_id, o_id, rp, fn );
};

//根据userId获取该用户所有订单返还的RP
exports.getAllOrderRPByUserId = function(u_id, fn){
    dao.getAllOrderRPByUserId( u_id, fn );
};

//根据orderId获取该订单返还的RP
exports.getOrderRPByOrderId = function(o_id, fn){
    dao.getAllOrderRPByUserId( o_id, fn );
};

//根据orderId获取该订单返还的RP
exports.exchange = function(u_id, t_id, val, fn){
    dao.insertUserExchange( u_id, t_id, val, fn );
};

exports.getAllExchangeRPByUserId = function(u_id, fn){
    dao.getAllExchangeRPByUserId( u_id, fn );
};
//------------------ ExpressInfoFetch -------------------//
exports.listExpressInfoFetch = function (shop_id, time_stamp_start, time_stamp_end, fn) {
    dao.listExpressInfoFetch( shop_id, time_stamp_start, time_stamp_end, fn );
};
exports.insertExpressInfoFetch = function (express_info_fetch, fn) {
    dao.insertExpressInfoFetch( express_info_fetch, fn );
};

//更新一下取件任务的状态
exports.updateExpressInfoFetch = function (fetch_id, status_code, fn) {
    dao.updateExpressInfoFetch( fetch_id, status_code, fn );
};

exports.delExpressInfoFetch = function (fetch_id, fn) {
    dao.delExpressInfoFetch( fetch_id, fn );
};

exports.getExpressByUserOrderId = function(order_id, fn){
    dao.getExpressByUserOrderId(order_id,fn);
};

exports.getUserRPByUserId = function(u_id, fn){
    dao.getUserRPByUserId(u_id, fn);
};

exports.updateUserRP = function(obj, fn){
    dao.updateUserRP(obj, fn);
};

exports.insertUserTool = function(obj, fn){
   dao.insertUserTool(obj, fn) 
};

exports.getUserWealth = function(u_id, fn){
    dao.getUserWealth(u_id, fn);
};

exports.getUserWealthRank = function(shop_id, u_id, fn){
    dao.getUserWealthRank(shop_id, u_id, fn);
};
exports.updateUserWealth = function(data, fn){
    //data 里面有userId 要加or减的财富值val;
    dao.updateUserWealth(data, fn);
}


exports.getUserToolsWithIds = function(ids, fn){

    dao.getUserToolsWithIds(ids,function(err ,tools){
        if( !err ){
            tools =  tools&&tools.length>0 ? tools : [];
            var o = {};
            // 按userId分类
            //[] ====> {} [{a:1,b:10},{a:2,b:10},{a:1},{a:2}] == 以a的值分组 ==> {1:[{a:1,b:10},{a:1}],2:[{a:2,b:10},{a:2}]}
            tools.forEach(function(tool, i){
                if(!o[tool.userId]){
                    o[tool.userId] = [];
                    o[tool.userId].push(tool);
                    return;
                } 
                o[tool.userId].push(tool);
            });
            fn(null, o);
            return;
        }
        fn(err);
        ld.debug(err);
    });
};

exports.getAllUserTools = function(fn){
    dao.getAllUserTools(fn);
};

exports.myWealth = function(u_id,fn){
    exports.getUserToolsWithIds([u_id], function(err, ret){
        if(!err){
            var ary = [];
            var o = {};
            ary = ret[u_id] || [];
            o = ary[0] || {};
            o.tools = ary;
            fn(null, o);
            return;
        }
        fn(err)
        ld.debug(err);
    }) 
};


exports.listUserWealth = function(shop_id, fn){

    var limit = 30; //取出财富前30名

    var t_start = new Date().getTime();
    dao.listUserWealth(shop_id, limit, function(err, ret){
        if( !err && ret ){
            ret = ret.length>0 ? ret : [];
            var ids = [];
            ret.forEach(function(w, i){
                ids.push(w.userId);
            });
            //得到用户Id 取用户当前没有用过的道具
            exports.getUserToolsWithIds(ids, function(err, tools){
                if( !err ){
                    var o = tools || {};
                    //[{userId:1, head:'xsfe'},{userId:2,head:'sdfsdf'}] + {userId:[{},{}], userId[{},{}]} ===>>> [{userId:1, head:'xsfe',userId:[{},{}]},{userId:2,head:'sdfsdf',userId:[{},{}]}]
                    ret.forEach(function(wealth, i){
                        for(var p in o){
                            if(wealth.userId == p){
                                wealth.tools = o[p];
                            } 
                        }
                    });
                    li.info('');
                    var t_end = new Date().getTime();
                    var t_deta = t_end - t_start;
                    uutil.printTime( t_start, '业绩查询 总体耗时' );
                    fn(null, ret);
                    return;
                }
                fn(err);
                ld.debug(err);
            });
            return;
        }
        fn(err);
        ld.debug(err);
    });

   // dao.get
};
//从各个表里拿到用户在  各个环节上获得RP总数 - 兑换RP总数 = 账户剩余RP 
//这个方法在PR数据对不上的时候用到 
///在兑换RP的时候用
exports.getUserRP = function(u_id, fn){

    var obj={};
    var a = new asyncMgr.AsyncAction();
    a.register('getAllOrderRPByUserId');
    a.register('getAllExchangeRPByUserId');
    a.onAllDone = function(){
        var RP = (obj.orderRP-0)-(obj.exchangeRP-0);
        li.info('=========他('+ u_id +')======== (订单返还的RP '+ obj.orderRP +') - (兑换过的总RP '+ obj.exchangeRP +') = (账户剩账户剩余RP '+ RP +') ===========');
        if( RP<0 ) {
            ld.debug('---------优先处理 他('+ u_id +')获得总RP的数量小于他兑换过的总RP值-------'); 
            RP=0;
        }
        fn(RP);
    };
    exports.getAllExchangeRPByUserId( u_id,function(err, ret){
        if(!err){
            var rp = ret.length ? ret[0] : 0;
            rp = rp.rp || 0;
            obj.exchangeRP = rp;
            a.thisDone('getAllExchangeRPByUserId');
            return;
        }
        a.thisDone('getAllExchangeRPByUserId');
        ld.debug(err)
    });
    exports.getAllOrderRPByUserId( u_id,function(err, ret){
        if(!err){
            var rp = ret.length ? ret[0] : 0;
            rp = rp.rp || 0;
            obj.orderRP = rp;
            a.thisDone('getAllOrderRPByUserId');
            return;
        }
        a.thisDone('getAllOrderRPByUserId');
        ld.debug(err)
    });
};


exports.canIBuyLove = function(ops, fn){
    var userId = ops.userId,
        require = ops.love_require,
        hasHouse = false,
        hasCar = false,
        hasQiegao = false;
    dao.getUserTools(userId, function(err, ret){
        if( err ){
            fn && fn(false);
            return;
        }
        
        ret = ret || [];
        ret.forEach(function(v, i){
            if( require.houses[v.tId] ) hasHouse = true;
            if( require.cars[v.tId] ) hasCar = true;
            if( require.qiegao[v.tId] ) hasQiegao = true;
        });
        fn && fn( (hasHouse&&hasCar) || hasQiegao );
    });
};

exports.insertSign = function(o, fn){
    //o.u_id用户id  o.rp 签到获得的RP, o.gId好事的id
    dao.insertSign(o, fn);
};

exports.getLastSignByUserId = function(u_id, fn){
    dao.getLastSignByUserId(u_id, fn);
};

exports.doSign = function(o, fn){

    //插入签到记录并且更新UserRP
    var insertSign = function(){
        exports.insertSign(o, function(err, ret){
            if(!err){
                var obj = {};
                obj.val = o.rp;
                obj.u_id = o.u_id;
                li.info('=====================TA('+ o.u_id +')签到获得RP('+ o.rp +')记录成功============================');
                //签到返还RP
                exports.updateUserRP(obj, function(err, ret){
                    if(!err) {
                        //记录打烊页面签到获得人品
                        li.info('======================打烊页面签到获得人品往SystemMonitor插入记录开始==========================');
                        var type = "tool_rp",
                            content = {
                                "userId": o.u_id,
                                "rpVal": o.rp,
                                "qd": "closeRP"
                            },
                            timeStamp = uutil.getDateTextByTimeStamp(new Date());
                        var contentStr = JSON.stringify(content);
                        admin.tool_rp(contentStr, timeStamp, type, function(err, ret){
                            if(!err){
                                li.info('======================打烊页面签到获得人品往SystemMonitor插入记录成功==========================');
                                return;
                            }
                            ld.debug(err);
                        });
                        //签到更新账户RP成功 
                        li.info('===========================TA('+ o.u_id +')签到更新账户RP成功============================');
                        fn(err, {code:0, msg:'签到成功, 获得'+o.rp+'个人品。每天可以来2次哦，保重身体～'});
                        return
                    }
                    fn(err);
                });
                return;
            }
            fn(err);
        });
    }
    //往数据库插入用户签到一次的统计
    var insertUserCount = function(){
        var timeStamp = new Date().getTime();
        dao.insertUserCount(o.u_id,o.rp,timeStamp,function(err,ret){
            if(err) console.log("统计用户签到有错！");
        });
    }

    //先看看他在4小时内有没有签到过
    exports.getLastSignByUserId(o.u_id, function(err, ret){
        var signTime = 12;//签到时间间隔
        if(!err){
            ret = ret&&ret.length>0 ? ret[0] : {};
            var timeStamp = ret.timeStamp || 0 ; //上次签到时间, 0代表从来没签到过
            var d_value = new Date().getTime() - timeStamp; //现在和上次签到的时间差
            //如果现在的时间戳减去4小时的时间戳 > 数据库里的时间戳  说明签到已经过了4小时
            if(  d_value > signTime*3600000 ){  //大于12小时可以签到
                insertSign();
                insertUserCount();//往数据库插入用户签到一次的统计
                return
            }

            //来到这里说明TA在4小时之内签到过
            var hour = Math.floor( d_value/3600000 )-0 || (d_value/3600000-0).toFixed(1);
            li.info('==========================Ta('+ o.u_id +') '+ hour +'小时之前签到过 现在又想签到 =============================')
            fn(err, {code:0, msg:'你已经签到了, 休息会儿, '+ (signTime-hour) +'小时之后再来吧!' });
            return; 
        }
        fn(err);
    });
};


exports.getRankAndWealth = function(o, fn){


    var obj = {};
    var a = new asyncMgr.AsyncAction();
    a.register('get user tools');
    a.register('get user rank');

    a.onAllDone = function(){
        fn(null, obj);
    };

    exports.getUserToolsWithIds([o.u_id], function(err, ret){
        if(!err){
            obj.tools = ret[o.u_id];
            a.thisDone('get user tools')
            return;
        }
        ld.debug(err)
        a.thisDone('get user tools')
    });
    exports.getUserWealthRank(o.shop_id, o.u_id, function(err, ret){
        if(!err){
            ret = ret&&ret.length>0 ? ret[0] : {};
            obj.rank=ret;
            a.thisDone('get user rank')
            return;
        }
        ld.debug(err)
        a.thisDone('get user rank')
    })

};

//----------------------- Employee ------------------------------ //
exports.listEmployee = function (shop_id, fn ) {
    dao.listEmployee(shop_id, fn );
};
exports.insertEmployee = function ( employee, fn ) {
    dao.insertEmployee( employee, fn );
};
exports.getEmployee = function ( employee, fn ) {
    dao.getEmployee( employee, fn );
};
exports.updateEmployee = function ( employee, fn ) {
    dao.updateEmployee( employee, fn );
};
//----------------------------短信财务接口-------------zed
exports.insertMsgFinance = function(content,time,fn){
    dao.insertMsgFinance(content,time,fn);
};
exports.getMsgFinance = function(fn){
    dao.getMsgFinance(fn);
};
exports.deleteMsgFinance = function(errid,fn){
    dao.deleteMsgFinance(errid,fn);
};
//-------------------------保存财务报表文件名到数据中-lufeng-----//
exports.insertFinanceStatements = function(fileName, hashFileName, shopID, fn){
    dao.insertFinance(fileName, hashFileName, shopID, fn);
};
//-------------------------保存财务报表文件名到数据中-lufeng-----//
exports.getAllFinaceExcels = function(shopID, userPower, fn){
    dao.getFinanceExcels(shopID, userPower,function(err, ret){
        if(err){
            fn(err);
            return;
        }

        var ret_finances = [];//这是最终要返回的结果集
        ret.forEach(function(v, i){
           var tmp_finance = {};
           tmp_finance.id = v.id;
           tmp_finance.timeStamp = new Date(v.timeStamp).format("yyyy-mm-dd HH:MM:ss");
           tmp_finance.name = v.name;
           tmp_finance.hashFileName = v.hashFileName;
           ret_finances.push(tmp_finance);
        });
        fn(null, ret_finances);
    });
};

//-------------------------保存财务报表文件名到数据中-lufeng-----//
exports.deleteFinanceExcel = function(id, fn){
    dao.deleteFinanceExcel(id, function(err, ret){
        if(!err){
            fn(err);
            return;
        }
    });
};


//-------------------插入新的地址到数据库---------------------//
exports.insertNewSchooAddress = function(shopId, newSchoolAddress, fn){
    dao.insertSchoolAddress(shopId, newSchoolAddress,fn);
}

//-------------------查询所有的配送地址---------------------//
exports.getAllSchoolAddress = function(fn){
    dao.getAllSchoolAddress(function(err, ret){
        if(err){
            return;
        }
        var ret_schools = [];//这是最终要返回的结果集
        ret.forEach(function(v, i){
           var tmp_school = {};
            tmp_school.id = v.id;
            tmp_school.shopId = v.shopId;
            tmp_school.status = v.status;
            tmp_school.address = v.address;
            ret_schools.push(tmp_school);
        });
        fn(null, ret_schools);
    });
};


//----------------------------设置是否是默认地址---------------@lufeng---------//
exports.updateSchoolStatus = function(schoolId, fn){
    dao.updateSchoolStatus(schoolId,function(err, ret){
        if(!err){
            fn && fn(ret);
            return;
        }
        console.log(err);
    });
};

//----------------------------删除地址---------------@lufeng---------//
exports.deleteSchoolAddressBySchoolId = function(schoolId, fn){
//    var maxId = 0;

    dao.deleteSchoolAddress(schoolId,function(err, ret){
        if(!err){
            fn && fn(ret);
            return;
        }
        console.log(err);
    });

    //删除默认地址是，系统自动设置最大shopId为默认地址
    /*dao.getMaxId(function(err, ret){
        ret.forEach(function(v,i){
            maxShopId = v.shopId;
            console.log("maxId = " + maxShopId);
        });
    });
    dao.updateSchoolStatus(maxId,function(err,ret){
        console.log("第二次修改默认状态 ： maxId = " + maxId);
        if(!err){
            fn && fn(ret);
            return;
        }
        console.log(err);
    });*/
    //删除默认地址是，系统自动设置最大shopId为默认地址
};


//----------------------------更新地址---------------@lufeng---------//
exports.udpateSchoolAddress = function(schoolId, newAddress, fn){
    dao.updateSchoolAddress(schoolId, newAddress, function(err,ret){
        if(!err){
            fn && fn(ret);
            return;
        }
        console.log(err);
    });
};

//------------------------根据userId从UserOrder中查询timeStamp、productIds-----//
exports.getUserOrderByUserId = function(userId,fn){
   /* dao.getUserOrderByUserId(userId,function(err, ret){
        if(!err){
            fn(err,ret);
        }
        fn(err);
    });*/
    dao.getUserOrderByUserId(userId,fn);
};

//根据查询到的productIds查询Product表中的title、img、price
exports.getProductByProductIds = function(productIds, fn){
    dao.getProductByProductId(productIds,fn);
};
//根据产品id获取对应的产品（从Store表获取记录，不是Product表）
exports.getStoreProducts= function(data, fn){
    dao.getStoreProducts(data,fn);
};
//从ProductComment表中查询订单中的菜品已评论
exports.getCommentStatusByUserOrderIdProductId = function(userOrderId,productIds,fn){
    dao.getCommentStatusByUserOrderIdProductId(userOrderId,productIds,fn);
};

//提交评论到数据库
exports.submitComment = function(userOrderId,userId,productId,content,timeStamp,fn){
    dao.submitComment(userOrderId,userId,productId,content,timeStamp,fn);
};

//根据productId从评论数据库查询每种2条评论信息
exports.getAllProductComment =function(productIdArr,fn){
    dao.getAllProductComment(productIdArr,fn);
};

//根据shopId从数据库查询出产品的img,title,productId
exports.getAllProductByShopId = function(shopId,fn){
    dao.getAllProductByShopId(shopId,fn);
};

//--------------------start--------签到抽奖---------------@lufeng---------//
exports.getAllSignDraw = function(shopId,fn){
  dao.getAllSignDraw(shopId,fn);
};

exports.insertNewDraw = function(signDraw,fn){
    dao.insertNewDraw(signDraw,fn);
};
exports.deleteDrawInfo = function(trId,fn){
    dao.deleteDrawInfo(trId,fn);
};

exports.getAllDrawByShopIdType = function(args, fn){
    dao.getAllDrawByShopIdType(args,fn);
};

exports.saveGenerateDraw = function(resultDraw, fn){
    dao.saveGenerateDraw(resultDraw,fn);
};
exports.updateDrawInfo = function(info, fn){
    dao.updateDrawInfo(info, fn);
};
exports.updateSignDrawCount = function(resultDraw, fn){
  dao.updateSignDrawCount(resultDraw, fn);
};

exports.insertDrawRP = function(drawRP,fn){
    dao.updateUserRP(drawRP,fn);
};

exports.findSignResult = function(userId, fn){
  dao.findSignResult(userId, fn);
};

exports.updateSignResultStatusById = function(deleteSignResult,fn){
    dao.deleteSignResult(deleteSignResult,fn);
};

exports.getLastSignTimeStamp = function(userId, fn){
  dao.getLastSignTimeStamp(userId,fn);
};
//--------------------end--------签到抽奖---------------@lufeng---------//
//------------------guess----------猜中抽奖--------------zed
exports.insertGuess = function(data,fn){
    dao.insertGuess(data,fn);
};
exports.updateGuess = function(data,fn){
    dao.updateGuess(data,fn);
};
exports.selectGuess = function(data,fn){
    dao.selectGuess(data,fn);
};
//------------------guess----------猜中抽奖--------------zed

//记录用户在取消订单中所做的操作  wuyong
exports.insertData = function(type, obj,fn){
    dao.insertData(type, obj,fn);
};

exports.selectUserOprationInfo = function(type,fn){
    dao.selectUserOprationInfo(type,fn);
};

exports.updateUserOrderStatus = function(shopId,orderId,fn){
    dao.updateUserOrderStatus(shopId,orderId,fn);
};
//查看来自所有店铺已取消的订单---------------wuyong
exports.listCanceledOrders = function(shop_id, time_stamp_start, time_stamp_end, limit, section_id, fn){
    var ffn = function(err, orders){//orders里的order的产品都是产品id, 接下来得获得具体数据才行
        if(!err){
            var products = null;
            orders.forEach(function(order, i){
                var ids_ary = JSON.parse(order.productIds);
                products = getProductsWithIds(ids_ary);//products内的产品现在是具体的product对象
                order.total = countTotal(products);
            });
            fn(null, orders);
            return;
        }
        ld.debug(err);
        fn(err);
    };
    dao.listCanceledOrders(shop_id, time_stamp_start, time_stamp_end, limit, section_id, ffn);
};

exports.selectNickById = function(userId, fn){
    dao.selectNickById(userId,fn);
};

exports.selectUserValTools = function(userId, fn){
    dao.selectUserValTools(userId, fn);
};


//lufeng--------------圣诞---

exports.insterChristmasGift = function(objs,fn){
    dao.insterChristmasGift(objs,fn);
};

exports.findChristmasGift = function(obj, fn){
  dao.findChristmasGift(obj, fn);
};

exports.listAllChristmasGifts = function(obj, fn){
  dao.listAllChristmasGifts(obj, fn);
};

exports.updateSendStatus = function(obj, fn){
  dao.updateSendStatus(obj,fn);
};

exports.sendByGiftId = function(obj, fn){
  dao.sendByGiftId(obj, fn);
};
//lufeng--------------圣诞---

exports.monitorOrder = function(obj, time, fn){
  dao.monitorOrder(obj, time, fn);
};

exports.deleteActByUserId = function(userId, fn){
    dao.deleteActByUserId(userId, fn);
};

//------start---限次抢购产品
exports.insterPurchase = function(userInfo, limit_pids){
    dao.insterPurchase(userInfo, limit_pids);
};

exports.getlimitPIdsByUserId = function(userId, fn){
    dao.getlimitPIdsByUserId(userId, fn);
};
//------end-----限次抢购产品

//-------------用户使用版本状态
exports.insertVersionUseStatus = function(data, fn){
    dao.insertVersionUseStatus(data, fn);
};
exports.selectVersionUseStatus = function(data, fn){
    dao.selectVersionUseStatus(data, fn);
};
exports.updateVersionUseStatus = function(status,data,fn){
    dao.updateVersionUseStatus(status,data,fn);
};
exports.updateVersionUseStatusByUserId = function(status,data,fn){
    dao.updateVersionUseStatusByUserId(status,data,fn);
};
exports.selectVersionQuick = function(fn){
    dao.selectVersionQuick(fn);
};
exports.selectVersionSimple = function(fn){
    dao.selectVersionSimple(fn);
};
exports.selectVersionTotal = function(fn){
    dao.selectVersionTotal(fn);
};
//-------------用户使用版本状态

exports.listUserClickNum = function(fn){
    dao.listUserClickNum(fn);
};
exports.analysis = function(id,fn){
    dao.selectAnalysis(id,fn);
};
exports.delAnalysis = function(data,fn){
    dao.delAnalysis(data,fn);
};


//确认已支付状态--by@lufeng
exports.updateUserOrderPayStatus = function(args, fn){
    dao.updateUserOrderPayStatus(args, fn);
};

exports.getUserIds = function(shop_id, time_stamp_start, time_stamp_end, fn){
    dao.getUserIds(shop_id, time_stamp_start, time_stamp_end, fn);
};

exports.getOrdersByIds = function(ids, shop_id, time_stamp_start, fn){
    dao.getOrdersByIds(ids, shop_id, time_stamp_start, fn);
};

exports.getOrdersInDay = function(shop_id, time_stamp_start, time_stamp_end, fn){
    dao.getOrdersInDay(shop_id, time_stamp_start, time_stamp_end, fn);
};

exports.recoverPay = function(args, fn){
    dao.recoverPay(args, fn);
};

//动态添加修改style--by@boylufeng
exports.getDynamicStyles = function(paramObj, fn){
    dao.getDynamicStyles(paramObj, fn);
};
exports.insertDynamicStyle = function(obj,fn){
  dao.insertDynamicStyle(obj,fn);
};
exports.deleteStyleFileById = function(file, fn){
    dao.deleteStyleFileById(file, fn);
};
exports.updateStyleFileStatus = function(file, fn){
    dao.updateStyleFileStatus(file, fn);
};
exports.updateStyleFileShopIds = function(argObj, fn){
    dao.updateStyleFileShopIds(argObj, fn);
};

exports.getPowerByUserId = function(oldIds, shop_id, fn){
    dao.getPowerByUserId(oldIds, shop_id, fn);
};

exports.zeroinventory = function(obj, fn){
    dao.zeroinventory(obj, fn);
};

exports.getVisitorCountByParam = function(obj, fn){
    dao.getVisitorCountByParam(obj, fn);
};

exports.getOrderByUserId = function(obj, fn){
    dao.getOrderByUserId(obj, fn);
};

exports.getUserOrderedNum = function(obj, fn){
    dao.getUserOrderedNum(obj, fn);
};

exports.getNewUserOrderByIds = function(obj, newUserIds, fn){
    dao.getNewUserOrderByIds(obj, newUserIds, fn);
};

exports.getCodeByPids = function(pIds, fn){
    dao.getCodeByPids(pIds, fn);
};

exports.getProIdsByShopId = function(shopId, fn){
    dao.getProIdsByShopId(shopId, fn);
};

exports.getUserWXIDByuserId = function(userIdSet, fn){
    dao.getUserWXIDByuserId(userIdSet, fn);
};
exports.getToolTitleById = function(toolId, fn){
    dao.getToolTitleById(toolId, fn);
};

exports.insertUserOpToSystemMonitor = function(type, op, time, fn){
    dao.insertUserOpToSystemMonitor(type, op, time, fn);
};

exports.getUserOPs = function(type, time_stamp_start, time_stamp_end, fn){
    dao.getUserOPs(type, time_stamp_start, time_stamp_end,fn);
};
exports.getUserByOPs = function(type, fn){
    dao.getUserByOPs(type,fn);
};

exports.getNickById = function(ids, fn){
    dao.getNickById(ids, fn);
};

exports.getSectionNameById = function(sectionIds, fn){
    dao.getSectionNameById(sectionIds, fn);
};

exports.getProNameByProId = function(proIds, fn){
    dao.getProNameByProId(proIds, fn);
};

exports.getOpInfoByIds = function(newStr, time_stamp_start, time_stamp_end, fn){
    dao.getOpInfoByIds(newStr, time_stamp_start, time_stamp_end, fn);
};
exports.deleteUserOPs = function(errid, fn){
    dao.deleteUserOPs(errid, fn);
};

//保存用户评价--added by lufeng
exports.insertIntoCustomerEvaluation = function(evaluationInfo, fn){
    dao.insertIntoCustomerEvaluation(evaluationInfo, fn);
};
//查询所有--added by lufeng
exports.getAllCustomerEvaluation = function(argObj, fn) {
    dao.getAllCustomerEvaluation(argObj, fn);
};
exports.insertChannel = function(channel, timeStamp, fn){
    dao.insertChannel(channel, timeStamp, fn);
};

exports.queryIdFromChannel = function(id, fn){
    dao.queryIdFromChannel(id, fn);
};

exports.queryLastChannelId = function(fn){
    dao.queryLastChannelId(fn);
};

exports.getShopIdByQid = function(qId, fn){
    dao.getShopIdByQid(qId, fn);
};

exports.queryChannelInfo = function(fn){
    dao.queryChannelInfo(fn);
};

exports.delChannelInfoByQid = function(qId, fn){
    dao.delChannelInfoByQid(qId, fn);
};

//保存业务员的配送订单条码
exports.insertIntoBarCode = function(arg,fn){
    dao.insertIntoBarCode(arg,fn);
};
//查询业务员的配送订单条码
exports.findBarCodeByUserIdDate = function(arg, fn){
    dao.findBarCodeByUserIdDate(arg, fn);
};
exports.findAllRecord = function(arg, fn){
   dao.findAllRecord(arg, fn);
};
//  保存坏货登记******add by@lufeng
exports.insertBadGoodsRegistration = function(shopId,arg, fn){
    dao.insertBadGoodsRegistration(shopId, arg, fn);
}
exports.findBadGoodsByDate = function(argJson, fn) {
    dao.findBadGoodsByDate(argJson, fn);
};
exports.getAllBadGoods = function(argObj,fn){
    dao.getAllBadGoods(argObj,fn);
};
exports.delBadGoodById = function(id, fn){
    dao.delBadGoodById(id,fn);
};
exports.getOrderedNum = function(userId, shopId, timeStamp, fn){
    dao.getOrderedNum(userId, shopId, timeStamp, fn);
};

exports.AllNewUsersPay = function(shopId,timeOne,timeTwo,newUserIds,fn){
    dao.AllNewUsersPay(shopId,timeOne,timeTwo,newUserIds,fn);
}
exports.getProTitleByCode = function(obj, fn){
    dao.getProTitleByCode(obj, fn);
};

exports.getCloseTime = function(shopId, fn){
    dao.getCloseTime(shopId, fn);
};

exports.getSignDraws = function(timeStamp1, timeStamp2, fn){
    dao.getSignDraws(timeStamp1, timeStamp2, fn);
};
//app更新用户头像
exports.updateUserHead = function(filename,user_id,fn){
    dao.updateUserHead(filename,user_id,fn);
};
exports.clearProDataByShopId = function(shopId, fn){
    dao.clearProDataByShopId(shopId, fn);
};

exports.updateNickById = function(obj, fn){
    dao.updateNickById(obj, fn);
};

exports.getCountByTimeStamp = function(obj, fn){
    dao.getCountByTimeStamp(obj, fn);
};
exports.getRangUserByTime = function(start, end, shopId, fn){
    dao.getRangUser(start, end, shopId, fn);
};
exports.instertClickAppLink = function(obj, fn){
    dao.instertClickAppLink(obj, fn);
};
exports.getOrderByIdArr = function(transObj, fn){
    dao.getOrderByIdArr(transObj, fn);
};
exports.getProCount = function(obj, fn){
    dao.getProCount(obj, fn);
};
exports.updateProCount = function(obj, fn){
    dao.updateProCount(obj, fn);
};
exports.getAllAttentionNum = function(obj, fn){
    dao.getAllAttentionNum(obj, fn);
};
exports.getValidAttentionNum = function(obj, fn){
    dao.getValidAttentionNum(obj, fn);
};
exports.getCancelAttentionNum = function(obj, fn){
    dao.getCancelAttentionNum(obj, fn);
};
exports.queryVisitStoreTime = function( obj, fn){
    dao.queryVisitStoreTime( obj, fn);
};
exports.weChatPayByOrderId = function(order_id,fn){
    dao.weChatPayByOrderId(order_id, fn);
};


//-------------------------------------------------------------------------------
exports.countTotal = countTotal;
exports.getProductsWithIds = getProductsWithIds;
exports.getTimeTxt = getTimeTxt;
exports.comput_profit_rate = comput_profit_rate;
exports.getDateStartAndEndTimeStamp = getDateStartAndEndTimeStamp;
exports.getDates = getDates;
exports.setCostForProducts = setCostForProducts;
exports.setCodeForProducts = setCodeForProducts;
exports.recoverProductsFromSnapshot = recoverProductsFromSnapshot;

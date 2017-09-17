var conf = require('../conf'),
    fs = require('fs'),
    conn = conf.getConnection(), //获取数据库链接
	pool = conf.getPool(); //获取连接池的实例


//七牛的module
var qn = require('qn');
var qn_client = qn.create({
  accessKey: 'hC90HGK2sef1ukzbH_TlfiAi-G3OzjbOupcklkkc',
  secretKey: 'x6dUQJoLryQHdyOcFfwZwHqKjV4geNGKtEhD6cDA',
  bucket: 'dashixiong',
  domain: 'http://dashixiong.qiniudn.com'
});
var uutil = require('../lib/util');

//获取某一天的开始和结束，这两个timeStamp
var getDateStartAndEndTimeStamp = function(y, m, d){
	var dt = new Date();
	var dt2 = new Date();
	if(typeof y == 'number'){//如果传入的是一个timestamp, 就用这个timestamp直接标示具体的一天
		dt = new Date(y);
	}else{
		if( y && m && d ){//指定一天
			dt.setFullYear(y-0);
			dt.setMonth(m-0-1);
			dt.setDate(d-0);
		}else{//今天
			y = dt.getFullYear();
			m = dt.getMonth()+1;
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
	var time_stamp_the_date_now = time_stamp_start + dt2.getHours()*60*60*1000 + dt2.getMinutes()*60*1000 + dt2.getSeconds()*1000 + dt2.getMilliseconds();

	return {
		time_stamp_start : time_stamp_start,//这天的开始那个时刻的时间戳
		time_stamp_end : time_stamp_end,//这天的结束那个时刻的时间戳
		time_stamp_the_date_now : time_stamp_the_date_now //当日此时
	};
};


var two = function (num) {
    if( num < 10 ) {
        return '0'+num;
    }
    return num;
};


var makeUpdateFieldAndValues = function(obj){
	var fields = [];
	var values = [];
    var p;
	for( p in obj){
		if( obj.hasOwnProperty(p) && p!='id' && (obj[p] || obj[p] == 0) ){
			fields.push(p+'=?');
			values.push(obj[p]);
		}
	}
	return {
		fields : fields,
		values : values	   
	};
};

//上传产品图片的同时，把图片同步到七牛
exports.sendImgToQiniu = function(img, fn){
    var imgPath = conf.path.product_img_upload_dir + img.name;
    qn_client.upload(fs.createReadStream(imgPath), {filename: img.name}, function (err, result) {
        if(err) console.log(err);
        if(result && result.key) conn.query('update Product set imgQN=? where id=?', [result.key, img.pid], function(){});
        fn && fn(result);
    });
};


//根据微信id获取系统中的用户id
exports.getUserByWxId = function(wx_id, fn){
    //conn.query('select * from Open where openId=?', [wx_id], function(err, ret){
    //conn.query('select Open.*,User.shopId,User.timeStamp as newUserTimeStamp from Open,User where Open.userId=User.id and Open.openId=?', [wx_id], function(err, ret){
    conn.query('select Open.openId,Open.openType,Open.accessToken,Open.expires,User.id,User.shopId,User.bindTo,User.sectionId,User.timeStamp as newUserTimeStamp,User.nick,User.power,User.head,User.email,Shop.name,Shop.shopType,Shop.relation from Open inner join User on Open.userId=User.id and Open.openId=? left join Shop on User.shopId=Shop.id', [wx_id], function(err, ret){
        if(fn) fn( err, ret );
    });
};

exports.getUsersByWxIds = function(ary_wx_ids, fn){
    conn.query('select Open.openId,Open.openType,Open.accessToken,Open.expires,User.id,User.shopId,User.bindTo,User.sectionId,User.timeStamp as newUserTimeStamp,User.nick,User.power,User.head,User.email from Open inner join User on Open.userId=User.id and Open.openId in ('+ ary_wx_ids.join() +')', function(err, ret){
        if(fn) fn( err, ret );
    });
};

//根据用户id获取用户对象
exports.getUserById = function(user_id, fn){
    conn.query('select Open.openId,Open.openType,Open.accessToken,Open.expires,User.id,User.shopId,User.bindTo,User.sectionId,User.timeStamp as newUserTimeStamp,User.email,User.nick,User.head,User.power,Shop.name,Shop.shopType,Shop.relation from Open inner join User on Open.userId=User.id and User.id=? left join Shop on User.shopId=Shop.id', [user_id], function(err, ret){
        if(fn) fn( err, ret );
    });
};
//根据用户email获取用户对象
exports.getUserByEmail = function(email, fn){
    conn.query('select id,timeStamp,email,pwdHash,nick,head,shopId,bindTo,sectionId,power from User where email=?', [email], function(err, ret){
        if(fn) fn( err, ret );
    });
};

//创建一个user
exports.newUser = function(obj, fn){
    conn.query('insert into User set timeStamp=?,shopId=?,bindTo=?,qId=?', [new Date().getTime(), obj.shop_id, obj.shop_id, obj.qId], function(err, ret){
        if(fn) fn( err, ret );
    });
};

//绑定一个微信id
exports.bindUser = function(user_id, wx_id, fn){
    conn.query('insert into Open set userId=?,openId=?,openType=?,timeStamp=?', [user_id, wx_id, 5, new Date().getTime()], function(err, ret){
        if(fn) fn( err, ret );
    });
};

exports.getUsersWithIds = function(ary_ids, fn){
	if(!ary_ids.length){
		fn && fn( null, []);
		return;
	}
    conn.query('select id,timeStamp,email,shopId,bindTo,sectionId,pwdHash,nick,power,head from User where id in ('+ ary_ids.join() +')', function(err, ret){
        if(fn) fn( err, ret );
    });
};
exports.getUsersOfShop = function(shop_id, fn){
    //conn.query('select id,timeStamp,email,shopId,pwdHash,nick,power,head from User where shopId=? order by id desc', [shop_id],function(err, ret){
    conn.query('select User.id,User.timeStamp,email,shopId,bindTo,sectionId,pwdHash,nick,power,head,Open.openId from User left join Open on User.id = Open.userId where User.shopId=? and status=? order by id desc', [shop_id, 1],function(err, ret){
        if(fn) fn( err, ret );
    });
};
exports.getAllUsers = function(fn){
    conn.query('select User.id,User.timeStamp,email,shopId,pwdHash,nick,power,head,Open.openId from User left join Open on User.id = Open.userId order by id desc', function(err, ret){
        if(fn) fn( err, ret );
    });
};

exports.updatePwd = function(user, fn){
    conn.query('update User set pwdHash=? where id=?', [user.password, user.id], fn);
};

exports.updateUser = function(user, fn){
  var obj = makeUpdateFieldAndValues(user);
  var query = 'update User set '+ obj.fields.join() +' where id=?';
  obj.values.push(user.id);
  conn.query(query, obj.values, fn);
};
exports.updateUserShop = function(user_id, shop_id, fn){
    conn.query('update User set shopId=? where id=?', [shop_id, user_id], function(err, ret){
        if(fn) fn( err, ret );
    });
};


//----------------------------------------- Warehouse --------------------------------- //
exports.listWarehousesOfShop = function( shop_id, fn){
	conn.query('select id,timeStamp,name,shopId from Warehouse where shopId=?', [shop_id], function(err, ret){
        if(fn) fn( err, ret );
    });

};
exports.insertWarehouse = function( house, fn){
	conn.query('insert into Warehouse set name=?,shopId=?', [house.name, house.shop_id], function(err, ret){
        if(fn) fn( err, ret );
    });
};
exports.delWarehouse = function( w_id, fn){
	conn.query('delete from Warehouse where id=?', [w_id], function(err, ret){
        if(fn) fn( err, ret );
    });
};
exports.getCurWarehouse= function(shop_id, fn){
    conn.query('select id,name,shopId from Warehouse where id in (select settingvalue from Setting where settingkey="curWarehouseId" and shopId=?)', [shop_id], fn);
};

//仓库进货
exports.inproductsAdd = function( w_id, product_counts, fn ){
	//var query = 'LOCK TABLES `Store` WRITE;'
    var query = '';
	query += ' UPDATE Store SET count = count + CASE code ';
    var codes = [];
	product_counts.forEach(function(product, i){
		query += 'WHEN ' + product.code + ' THEN '+product.count+' ';
        codes.push(product.code);
	});
	query += 'END where wId='+ w_id +' and code in ('+ codes.join() +');';//注意where 语句, 这个非常重要, 它把UPDATE的操作限定在了指定仓库的制定几个产品, 否则整个表的产品数据都会被更新
	//query += 'UNLOCK TABLES;'
    conn.query(query, fn);
};
exports.inproductsCover = function( w_id, product_counts, fn ){
	//var query = 'LOCK TABLES `Store` WRITE;'
    var query = '';
	query += ' UPDATE Store SET count = CASE code ';
    var codes = [];
	product_counts.forEach(function(product, i){
		query += 'WHEN ' + product.code + ' THEN '+product.count+' ';
        codes.push(product.code);
	});
	query += 'END where wId='+ w_id +' and code in ('+ codes.join() +');';//注意where 语句, 这个非常重要, 它把UPDATE的操作限定在了指定仓库的制定几个产品, 否则整个表的产品数据都会被更新
	//query += 'UNLOCK TABLES;'
    conn.query(query, fn);
};


exports.listProductsInWarehouse = function( w_id, status_code, fn ){
	var values = [w_id];
    var conditions = '';
	if( status_code !== null ){
        if( typeof status_code.constructor != Array ) status_code = [status_code];
		conditions = ' and Store.productStatus in('+ status_code.join(',') +') and Store.onSelling=?';
        values.push( 1 );
	}

	var query = 'select Product.id,Product.title,Product.img,imgQN,Product.unit,Product.price,Product.promotePrice,Product.cost,Product.timeStamp,Store.pid,Store.productStatus,Store.code,Store.count,Store.secureCount,Store.warningCount,onSelling,limitStatus,Store.productStrategyId from Store left join Product on Store.pid = Product.id where wId=? '+ conditions +' order by Store.count asc';
    conn.query(query, values, fn);
};
exports.getAllProductId = function(shop_id,fn){
    conn.query('select content from Section where shopId =?',[shop_id],fn);
};
exports.getStoreOfProductInWarehouse = function( code, w_id, fn){
    conn.query('select code,wId,count,secureCount,warningCount,onSelling,productStatus,limitStatus,productStrategyId,SectionStrategy.type from Store left join SectionStrategy on Store.productStrategyId=SectionStrategy.id where code=? and wId=?', [code, w_id], fn);
};
exports.getProductsNumsInWareshouse = function( w_id, ids, fn){
    conn.query('select code,wId,count,secureCount,productStatus,pId from Store where wId=? and pId in ('+ ids.join() +')', [w_id], fn);
};
exports.delStore = function( p_id, w_id, fn){
    conn.query('delete from Store where pId=? and wId=?', [p_id, w_id], fn);
};

exports.updateProductInStore = function( product, w_id, fn ){
	var fields = [];
	var values = [];
    var p;
	for( p in product){
		if( product.hasOwnProperty(p) && p!='code' ){
			fields.push(p+'=?');
			values.push(product[p]);
		}
	}
	values.push(product.code);
	values.push(w_id);
	var query = 'update Store set '+ fields.join() +' where code=? and wId=?';
    console.log('**************query = ' + query);
    conn.query( query, values, fn);


    //--start--------------记录产品上下架时库存和SQL--------------//
    conn.query('select * from Store where code=? and wId=?',[product.code,w_id],function(err,ret){
        if(!err && ret ){
            if(ret[0]){
                var sql = 'count: '+ret[0].count+' SQL: update Store set productStatus='+values[0]+' where code='+values[1]+' and wId='+values[2];
                conn.query('insert into SystemMonitor(type,content) values(?,?)',['productOnOffSection',sql]);
            }else{
                return;
            }
        }

    });
    //--end--------------记录产品上下架时库存和SQL--------------//

};

exports.cancelDiscountInStore = function(wId,code,fn){
    var sql = 'update Store set productStrategyId=0 where code='+code+' and wId='+wId;
    conn.query(sql,fn);
};

//将shop_id所标识的门店内的所有产品数据导入到某个仓库(w_id所标示)中, 首页显示的是某个仓库内的产品
exports.importProducts = function( shop_id, w_id, fn){
    conn.query('insert IGNORE into Store(pId,code,wId) select id,code,? from Product where code is not null and code!="" and shopId=?', [w_id, shop_id], fn);
};


//----------------------------------------- Shop ------------------------------------//
exports.listShops = function( fn ){
    conn.query('select id,name,description,address,timeStamp,type from Shop', fn);
};
exports.insertSettingForAllShops = function( setting_name, fn ){
    var query = 'insert into Setting (settingKey,settingValue,shopId) values ';
    exports.listShops(function (err, ret) {
        if(err) {
            fn(err);
            return;
        }

        var str_ary = [];
        ret.forEach(function (shop, i) {
            str_ary.push( '("'+ setting_name +'","",'+ shop.id +')' );
        });
        query += str_ary.join();
        conn.query(query, fn);
    });
};
//ding dan zhuan dian------------zed
exports.selectShop = function(fn){
    conn.query('select id, name from Shop order by id',fn);
};
exports.insertShop = function(shop, fn){
	var query = 'insert into Shop set name=?,description=?,address=?,type=?';
    conn.query(query, [shop.name, shop.description, shop.address, shop.type], function(err, ret){
        exports.getSettingsByShopId( 1, function (err2, ret2) {
            if( err2 ){
                fn(err2);
                return;
            }
            
		    query = 'insert into Setting (settingKey,settingValue,shopId) values ';
            var str_ary = [];
            ret2.forEach(function (setting, i) {
                str_ary.push( '("'+ setting.settingKey +'", "", '+ ret.insertId +')' );
            });
            query += str_ary.join();
		    conn.query(query, fn);
                
        });
		
	});
};

exports.getShopById = function(shop_id, fn){
    conn.query('select id,name,description,address,timeStamp,type,shopType,expandtype,relation from Shop where id=? ', [shop_id], fn);
};

exports.getShopsByIds = function(ids, fn){
    conn.query('select id,name,description,address,timeStamp,type,shopType,relation from Shop where id in ('+ ids.join(',') +')', fn);
};

exports.updateShop = function(shop, fn){
	var fields = [];
	var values = [];
    var p;
	for( p in shop){
		if( shop.hasOwnProperty(p) && p!='id' ){
			fields.push(p+'=?');
			values.push(shop[p]);
		}
        console.log("******"+ p);
	}
	values.push(shop.id);
	var query = 'update Shop set '+ fields.join() +' where id=?';
    conn.query(query, values, fn);
};






//----------------------------------------- order --------------------------------- //
//exports.insertOrder = function(order, fn){
//    conn.query('insert into UserOrder set userId=?,addressId=?,productIds=?,shopId=?,timeStamp=?,extra=?', [order.user_id, order.address_id, order.product_ids, order.shop_id,new Date().getTime(), order.extra], function(err, ret){
//        if(fn) fn( err, ret );
//    });
//};

exports.insertOrder = function(order, fn){
    conn.query('insert into UserOrder set userId=?,addressId=?,productIds=?,shopId=?,timeStamp=?,extra=?,snapshot=?,sectionId=?', [order.user_id, order.address_id, order.product_ids, order.shop_id,new Date().getTime(), order.extra, order.snapshot, order.section_id], function(err, ret){
        if(fn) fn( err, ret );
    });
};

exports.cancelOrder = function(order, w_id, fn){
    if( order.orderStatus == 3 ){
        fn({
            code : -1,
            msg : 'already cancel'
        });
        return;
    }


    pool.getConnection(function(err, connection) {

        connection.beginTransaction(function(err) {
            if (err) { throw err; }
            connection.query('update UserOrder set orderStatus=3 where id=?', [order.id], function(err, ret) {
                if (err) { 
                    connection.rollback(function() {
                        //throw err;
                        fn(err);
                    });
                    return;
                }

                try {
                    var snapshot = JSON.parse( order.snapshot );
                } catch (e) {
                    console.log(e);
                }

                var ids = [];

                //这是一个空订单, 这样的话就直接把订单取消了就好
                if( !snapshot.products_bought || !snapshot.products_bought.length ){
                    conn.query(query, [ order.id ], function(err, ret){
                        if(fn) fn( err, ret );
                    });
                    return; 
                }

                //query = 'begin; ' + query;//代码运行到这行, 说明需要取消的订单里面有需要归还的产品, 用一个事务提交两条sql

                /* 以下代码需要注意的是, 如果运行有误, 导致最后的commit没有被执行, 则会导致"Lock wait timeout exceeded" 错误, 读出来的数据非常莫名其妙 */

                var query = 'update Store set count = count + CASE pId ';

                snapshot.products_bought.forEach(function (product, i) {
                    query += 'WHEN '+product.id + ' THEN '+product.count + ' ';
                    ids.push( product.id );
                });

                query += 'END where wId=? and pId in (' + ids.join() + ')';

                connection.query(query, [w_id], function(err, ret) {
                    if (err) { 
                        console.log(query);
                        connection.rollback(function() {
                            fn(err);
                            //throw err;
                        });
                        return;
                    }  
                    connection.commit(function(err) {
                        if (err) { 
                            connection.rollback(function() {
                                fn(err);
                                //throw err;
                            });
                            return;
                        }
                        fn(null, ret);
                    });
                });
            });
        });
    });



    //var query = 'update UserOrder set orderStatus=3 where id=?;';
   
    ////从订单快照中获得订单里的产品信息, 然后一个一个得从原来的数据库中加回去
    //try {
    //    var snapshot = JSON.parse( order.snapshot );
    //} catch (e) { }

    //var ids = [];
    //
    ////这是一个空订单, 这样的话就直接把订单取消了就好
    //if( !snapshot.products_bought || !snapshot.products_bought.length ){
    //    conn.query(query, [ order.id ], function(err, ret){
    //        if(fn) fn( err, ret );
    //    });
    //    return; 
    //}

    ////query = 'begin; ' + query;//代码运行到这行, 说明需要取消的订单里面有需要归还的产品, 用一个事务提交两条sql

    ///* 以下代码需要注意的是, 如果运行有误, 导致最后的commit没有被执行, 则会导致"Lock wait timeout exceeded" 错误, 读出来的数据非常莫名其妙 */

    //query += 'update Store set count = count + CASE pId ';
    //snapshot.products_bought.forEach(function (product, i) {
    //   query += 'WHEN '+product.id + ' THEN '+product.count + ' ';
    //   ids.push( product.id );
    //});

    //query += 'END where wId=? and pId in (' + ids.join() + ')';
    //
    //conn.query(query, [ order.id, w_id ], function(err, ret){
    //    if(fn) fn( err, ret );
    //});
    
};


exports.checkSecureCount = function(ids, shop_type, fn){
//    var status = shop_type == 'store' ? 1 : 2;
    var status = 2;//放出小卖部的自动售罄
    conn.query('update Store set productStatus=? where count<=secureCount and pid in ('+ ids +')', [status], fn);
};


exports.updateOrder = function(order_id, user_id, addr, fn, argObj){
	addr.id -= 0;
	//fn(null);
    var updateOrderStatusSQL = 'update UserOrder set userId=?,addressId=?,snapshot=?,timeStamp=? where id=?';
    if(argObj.pay_way=='wcpay'){
        updateOrderStatusSQL = 'update UserOrder set userId=?,addressId=?,snapshot=?,timeStamp=?,orderStatus=-1 where id=?';
    }
    conn.query(updateOrderStatusSQL, [user_id, addr.id, addr.snapshot, addr.time_stamp, order_id], function(err, ret){
		var query = '';
        var codes = [];
        if(err) console.log(err);
		query += ' UPDATE Store SET count = count - CASE code ';
		addr.snapshot_obj.products_bought.forEach(function(product, i){
			query += 'WHEN ' + product.code + ' THEN '+product.count+' ';
            codes.push(product.code);
		});
		query += 'END WHERE wId='+ addr.w_id +' and code in ('+ codes.join() +');';

        //扣除库存
		conn.query(query, function(err, ret){
			fn( err, ret );
            //console.log(ret);
            //console.log(ret.affectedRows);
		});
    });

};

exports.updateOrderShopId = function(order, fn){
    conn.query('update UserOrder set shopId=? where id=?', [order.shopId, order.id], function(err, ret){
        if(fn) fn( err, ret );
    });
};

//通过一个Order的obj来更新order的数据
exports.updateOrderObj = function(order, fn){
	var fields = [];
	var values = [];
    var p;
	for(p in order){
		if( order.hasOwnProperty(p) && p!='id' ){
			fields.push(p+'=?');
			values.push(order[p]);
		}
	}
	values.push(order.id);
    conn.query('update UserOrder set '+ fields.join() +' where id=?', values, function(err, ret){
        if(fn) fn( err, ret );
    });
};

exports.getOrderById = function(order_id, fn){
    conn.query('select UserOrder.payStatus, UserOrder.id,UserOrder.timeStamp,UserOrder.orderRP,UserOrder.productIds,UserOrder.orderStatus,UserOrder.userId,UserOrder.snapshot,AddressBook.name,AddressBook.mobile,AddressBook.shortTel,AddressBook.address from UserOrder left join AddressBook on UserOrder.addressId=AddressBook.id where UserOrder.id=?', [order_id], fn);
};

//更新订单状态
exports.updateOrderStatus = function(order_id, status_code, fn){
    conn.query('update UserOrder set orderStatus=? where id=?', [status_code, order_id], function(err, ret){
        if(fn) fn( err, ret );
    });
};

//更新rp是否返还, 0是默认,1是已返还
exports.updateRpStatus = function(order_id, status_code, fn){
    conn.query('update UserOrder set rpStatus=? where id=?', [status_code, order_id], function(err, ret){
        if(fn) fn( err, ret );
    });
};

exports.listOrders = function(time_stamp_start, time_stamp_end, limit, fn){
	if(!limit){
		conn.query('select UserOrder.id,UserOrder.timeStamp,UserOrder.productIds,UserOrder.orderStatus,UserOrder.snapshot,AddressBook.name,AddressBook.mobile,AddressBook.address from UserOrder left join AddressBook on UserOrder.addressId=AddressBook.id where UserOrder.timeStamp>=? and UserOrder.timeStamp<=? order by UserOrder.timeStamp desc', [time_stamp_start, time_stamp_end], function(err, ret){
			if(fn) fn( err, ret );
		});
		return;
	}
	conn.query('select UserOrder.id,UserOrder.timeStamp,UserOrder.productIds,UserOrder.orderStatus,UserOrder.snapshot,AddressBook.name,AddressBook.mobile,AddressBook.address from UserOrder left join AddressBook on UserOrder.addressId=AddressBook.id where UserOrder.timeStamp>=? and UserOrder.timeStamp<=? order by UserOrder.timeStamp desc limit 0,?', [time_stamp_start, time_stamp_end, limit], function(err, ret){
		if(fn) fn( err, ret );
	});
};
//exports.listValidOrders = function(shop_id, time_stamp_start, time_stamp_end, limit, fn){
//	if(!limit){
//		//conn.query('select UserOrder.id,UserOrder.userId,UserOrder.addressId as addressId,UserOrder.timeStamp,UserOrder.productIds,UserOrder.orderStatus,UserOrder.snapshot,AddressBook.name,AddressBook.mobile,AddressBook.address from UserOrder left join AddressBook on UserOrder.addressId=AddressBook.id where addressId>0 and UserOrder.timeStamp>=? and UserOrder.timeStamp<=? and UserOrder.shopId=? and UserOrder.orderStatus!=3 order by UserOrder.timeStamp desc', [time_stamp_start, time_stamp_end, shop_id], function(err, ret){
//		conn.query('select UserOrder.id,UserOrder.userId,UserOrder.addressId as addressId,UserOrder.timeStamp,UserOrder.productIds,UserOrder.orderStatus,UserOrder.snapshot,AddressBook.name,AddressBook.mobile,AddressBook.address from UserOrder left join AddressBook on UserOrder.addressId=AddressBook.id where addressId>0 and UserOrder.timeStamp>=? and UserOrder.timeStamp<=? and UserOrder.shopId=? and UserOrder.orderStatus!=3 order by UserOrder.timeStamp desc', [time_stamp_start, time_stamp_end, shop_id], function(err, ret){
//			if(fn) fn( err, ret );
//		});
//		return;
//	}
//    
//    //TODO 这个sql有问题的. 目前的业务里没有用到下面的sql. 如果需要用, 请先仔细修改
//	conn.query('select UserOrder.id,UserOrder.userId,UserOrder.addressId as addressId,UserOrder.timeStamp,UserOrder.productIds,UserOrder.orderStatus,UserOrder.snapshot,AddressBook.name,AddressBook.mobile,AddressBook.address from UserOrder left join AddressBook on UserOrder.addressId=AddressBook.id where addressId>0 and timeStamp>=? and timeStamp<=? and UserOrder.orderStatus!=3 order by UserOrder.timeStamp desc desc limit 0,?', [time_stamp_start, time_stamp_end, shop_id, limit], function(err, ret){
//		if(fn) fn( err, ret );
//	});
//};

//查看来自所有店铺已取消的订单---------------wuyong
exports.listCanceledOrders = function(shop_id, time_stamp_start, time_stamp_end, limit, section_id, fn){
    if(!limit){
        if( time_stamp_start && time_stamp_end ){
            var condiction = '';
            if( typeof section_id == 'function'){ //没有传递section_id，本店的所有订单
                fn = section_id;
            }else{
                (section_id || section_id == 0) && (condiction = ' and sectionId=' + section_id); //只列出单个货架的订单
            }
            conn.query('select UserOrder.id,UserOrder.userId,UserOrder.shopId,UserOrder.addressId as addressId,UserOrder.timeStamp,UserOrder.productIds,UserOrder.orderStatus,UserOrder.snapshot,AddressBook.name,AddressBook.mobile,AddressBook.shortTel,AddressBook.address from UserOrder left join AddressBook on UserOrder.addressId=AddressBook.id where addressId>0 and UserOrder.timeStamp>=? and UserOrder.timeStamp<=? and shopId=? and UserOrder.orderStatus=3 and (UserOrder.extra is null or UserOrder.extra not like "activity_%")'+ condiction +' order by UserOrder.timeStamp desc', [time_stamp_start, time_stamp_end ,shop_id], function(err, ret){
                if(fn) fn( err, ret );
            });
            return;
        }
        conn.query('select UserOrder.id,UserOrder.userId,UserOrder.shopId,UserOrder.addressId as addressId,UserOrder.timeStamp,UserOrder.productIds,UserOrder.orderStatus,UserOrder.snapshot,AddressBook.name,AddressBook.mobile,AddressBook.shortTel,AddressBook.address from UserOrder left join AddressBook on UserOrder.addressId=AddressBook.id where addressId>0 and UserOrder.orderStatus =3 and (UserOrder.extra is null or UserOrder.extra not like "activity_%") order by UserOrder.timeStamp desc', function(err, ret){
            if(fn) fn( err, ret );
        });
        return;
    }

    //TODO 这个sql有问题的. 目前的业务里没有用到下面的sql. 如果需要用, 请先仔细修改
    conn.query('select UserOrder.id,UserOrder.userId,UserOrder.addressId as addressId,UserOrder.timeStamp,UserOrder.productIds,UserOrder.orderStatus,UserOrder.snapshot,AddressBook.name,AddressBook.mobile,AddressBook.address from UserOrder left join AddressBook on UserOrder.addressId=AddressBook.id where addressId>0 and timeStamp>=? and timeStamp<=? and UserOrder.orderStatus！=3 order by UserOrder.timeStamp desc desc limit 0,?', [time_stamp_start, time_stamp_end, shop_id, limit], function(err, ret){
        if(fn) fn( err, ret );
    });
};

//查看来自所有店铺未确认的订单---------------zed
exports.listValidUnconfirmOrders = function(shop_id, time_stamp_start, time_stamp_end, limit, section_id, fn){
    if(!limit){
        if( time_stamp_start && time_stamp_end ){
            var condiction = '';
            if( typeof section_id == 'function'){ //没有传递section_id，本店的所有订单
                fn = section_id;
            }else{
                (section_id || section_id == 0) && (condiction = ' and sectionId=' + section_id); //只列出单个货架的订单
            }
            conn.query('select UserOrder.id,UserOrder.userId,UserOrder.shopId,UserOrder.addressId as addressId,UserOrder.timeStamp,UserOrder.productIds,UserOrder.orderStatus,UserOrder.snapshot,AddressBook.name,AddressBook.mobile,AddressBook.shortTel,AddressBook.address,Section.name as sectionName from UserOrder left join AddressBook on UserOrder.addressId=AddressBook.id left join Section on UserOrder.sectionId = Section.id where addressId>0 and UserOrder.timeStamp>=? and UserOrder.timeStamp<=? and UserOrder.orderStatus!=3 and (UserOrder.extra is null or UserOrder.extra not like "activity_%")'+ condiction +' order by UserOrder.timeStamp desc', [time_stamp_start, time_stamp_end], function(err, ret){
                if(fn) fn( err, ret );
            });
            return;
        }
        conn.query('select UserOrder.id,UserOrder.userId,UserOrder.shopId,UserOrder.addressId as addressId,UserOrder.timeStamp,UserOrder.productIds,UserOrder.orderStatus,UserOrder.snapshot,AddressBook.name,AddressBook.mobile,AddressBook.shortTel,AddressBook.address,Section.name as sectionName from UserOrder left join AddressBook on UserOrder.addressId=AddressBook.id left join Section on UserOrder.sectionId = Section.id where addressId>0 and UserOrder.orderStatus!=3 and (UserOrder.extra is null or UserOrder.extra not like "activity_%") order by UserOrder.timeStamp desc', function(err, ret){
            if(fn) fn( err, ret );
        });
        return;
    }

    //TODO 这个sql有问题的. 目前的业务里没有用到下面的sql. 如果需要用, 请先仔细修改
    conn.query('select UserOrder.id,UserOrder.userId,UserOrder.addressId as addressId,UserOrder.timeStamp,UserOrder.productIds,UserOrder.orderStatus,UserOrder.snapshot,AddressBook.name,AddressBook.mobile,AddressBook.address from UserOrder left join AddressBook on UserOrder.addressId=AddressBook.id where addressId>0 and timeStamp>=? and timeStamp<=? and UserOrder.orderStatus!=3 order by UserOrder.timeStamp desc desc limit 0,?', [time_stamp_start, time_stamp_end, shop_id, limit], function(err, ret){
        if(fn) fn( err, ret );
    });
};
exports.listValidOrders = function(shop_id, time_stamp_start, time_stamp_end, limit, section_id, fn){
	if(!limit){
        if( time_stamp_start && time_stamp_end ){
            var condiction = '';
            if( typeof section_id == 'function'){ //没有传递section_id，本店的所有订单
                fn = section_id;
            }else{
                (section_id || section_id == 0) && (condiction = ' and sectionId=' + section_id); //只列出单个货架的订单
            }
            conn.query('select tempUserOrder.payStatus, tempUserOrder.id,tempUserOrder.userId,tempUserOrder.addressId as addressId,tempUserOrder.timeStamp,tempUserOrder.productIds,tempUserOrder.orderStatus,tempUserOrder.snapshot,AddressBook.name,AddressBook.mobile,AddressBook.shortTel,AddressBook.address from (select UserOrder.payStatus, UserOrder.id,UserOrder.userId,UserOrder.addressId as addressId,UserOrder.timeStamp,UserOrder.productIds,UserOrder.orderStatus,UserOrder.snapshot from UserOrder where  UserOrder.timeStamp>=? and UserOrder.timeStamp<=? and UserOrder.shopId=? and UserOrder.orderStatus!=3 and UserOrder.orderStatus>-1 and (UserOrder.extra is null or UserOrder.extra not like "activity_%")'+ condiction+' ) as tempUserOrder left join AddressBook on tempUserOrder.addressId=AddressBook.id where addressId>0 order by tempUserOrder.timeStamp desc', [time_stamp_start, time_stamp_end, shop_id], function(err, ret){
                if(fn) fn( err, ret );
		    }); 
            return;
        }
        conn.query('select UserOrder.payStatus, UserOrder.id,UserOrder.userId,UserOrder.addressId as addressId,UserOrder.timeStamp,UserOrder.productIds,UserOrder.orderStatus,UserOrder.snapshot,AddressBook.name,AddressBook.mobile,AddressBook.shortTel,AddressBook.address from UserOrder join AddressBook on UserOrder.addressId=AddressBook.id where addressId>0 and UserOrder.shopId=? and UserOrder.orderStatus!=3  and UserOrder.orderStatus>-1 and (UserOrder.extra is null or UserOrder.extra not like "activity_%") order by UserOrder.timeStamp desc', [ shop_id ], function(err, ret){
		    if(fn) fn( err, ret );
		});
		return;
	}
    
    //TODO 这个sql有问题的. 目前的业务里没有用到下面的sql. 如果需要用, 请先仔细修改
	conn.query('select UserOrder.id,UserOrder.userId,UserOrder.addressId as addressId,UserOrder.timeStamp,UserOrder.productIds,UserOrder.orderStatus,UserOrder.snapshot,AddressBook.name,AddressBook.mobile,AddressBook.address from UserOrder left join AddressBook on UserOrder.addressId=AddressBook.id where addressId>0 and timeStamp>=? and timeStamp<=? and UserOrder.orderStatus!=3 order by UserOrder.timeStamp desc desc limit 0,?', [time_stamp_start, time_stamp_end, shop_id, limit], function(err, ret){
		if(fn) fn( err, ret );
	});
};

exports.listValidOrdersTwo = function(shop_id, time_stamp_start, time_stamp_end, limit, section_id, fn){
    if(!limit){
        if( time_stamp_start && time_stamp_end ){
            var condiction = '';
            if( typeof section_id == 'function'){ //没有传递section_id，本店的所有订单
                fn = section_id;
            }else{
                (section_id || section_id == 0) && (condiction = ' and sectionId=' + section_id); //只列出单个货架的订单
            }
            conn.query('select User.id,User.power,tempUserOrder.payStatus, tempUserOrder.id,tempUserOrder.userId,tempUserOrder.addressId as addressId,tempUserOrder.timeStamp,tempUserOrder.productIds,tempUserOrder.orderStatus,tempUserOrder.snapshot,AddressBook.name,AddressBook.mobile,AddressBook.shortTel,AddressBook.address from (select UserOrder.payStatus, UserOrder.id,UserOrder.userId,UserOrder.addressId as addressId,UserOrder.timeStamp,UserOrder.productIds,UserOrder.orderStatus,UserOrder.snapshot from UserOrder where  UserOrder.timeStamp>=? and UserOrder.timeStamp<=? and UserOrder.shopId=? and UserOrder.orderStatus!=3 and UserOrder.orderStatus>-1 and UserOrder.orderStatus>-1 and (UserOrder.extra is null or UserOrder.extra not like "activity_%")'+condiction+' ) as tempUserOrder left join AddressBook on tempUserOrder.addressId=AddressBook.id left join User on User.id=tempUserOrder.userId where User.power=0 and addressId>0 order by tempUserOrder.timeStamp desc', [time_stamp_start, time_stamp_end, shop_id], function(err, ret){
                if(fn) fn( err, ret );
            });
            return;
        }
        conn.query('select User.id,User.power,UserOrder.payStatus, UserOrder.id,UserOrder.userId,UserOrder.addressId as addressId,UserOrder.timeStamp,UserOrder.productIds,UserOrder.orderStatus,UserOrder.snapshot,AddressBook.name,AddressBook.mobile,AddressBook.shortTel,AddressBook.address from UserOrder join AddressBook on UserOrder.addressId=AddressBook.id left join User on User.id=UserOrder.userId where User.power=0 and addressId>0 and UserOrder.shopId=? and UserOrder.orderStatus!=3 and UserOrder.orderStatus>-1 and (UserOrder.extra is null or UserOrder.extra not like "activity_%") order by UserOrder.timeStamp desc', [ shop_id ], function(err, ret){
            if(fn) fn( err, ret );
        });
        return;
    }

    //TODO 这个sql有问题的. 目前的业务里没有用到下面的sql. 如果需要用, 请先仔细修改
    conn.query('select UserOrder.id,UserOrder.userId,UserOrder.addressId as addressId,UserOrder.timeStamp,UserOrder.productIds,UserOrder.orderStatus,UserOrder.snapshot,AddressBook.name,AddressBook.mobile,AddressBook.address from UserOrder left join AddressBook on UserOrder.addressId=AddressBook.id where addressId>0 and timeStamp>=? and timeStamp<=? and UserOrder.orderStatus!=3 order by UserOrder.timeStamp desc desc limit 0,?', [time_stamp_start, time_stamp_end, shop_id, limit], function(err, ret){
        if(fn) fn( err, ret );
    });
};

exports.listValidOrdersQuickly = function(shop_id, time_stamp_start, time_stamp_end, limit, fn){
	if(!limit){
        if( time_stamp_start && time_stamp_end ){
            conn.query('select UserOrder.id,UserOrder.userId,UserOrder.addressId as addressId,UserOrder.timeStamp,UserOrder.productIds,UserOrder.orderStatus,UserOrder.snapshot,AddressBook.name,AddressBook.mobile,AddressBook.address from UserOrder left join AddressBook on UserOrder.addressId=AddressBook.id where addressId>0 and UserOrder.timeStamp>=? and UserOrder.timeStamp<=? and UserOrder.orderStatus!=3 and (UserOrder.extra is null or UserOrder.extra not like "activity_%") order by UserOrder.timeStamp desc', [time_stamp_start, time_stamp_end], function(err, ret){
                if(fn) fn( err, ret );
		    });
            return;
        }
        conn.query('select UserOrder.id,UserOrder.userId,UserOrder.addressId as addressId,UserOrder.timeStamp,UserOrder.productIds,UserOrder.orderStatus,UserOrder.snapshot,AddressBook.name,AddressBook.mobile,AddressBook.address from UserOrder left join AddressBook on UserOrder.addressId=AddressBook.id where addressId>0 and UserOrder.orderStatus!=3 and (UserOrder.extra is null or UserOrder.extra not like "activity_%") order by UserOrder.timeStamp desc', function(err, ret){
		    if(fn) fn( err, ret );
		});
		return;
	}

    //TODO 这个sql有问题的. 目前的业务里没有用到下面的sql. 如果需要用, 请先仔细修改
	conn.query('select UserOrder.id,UserOrder.userId,UserOrder.addressId as addressId,UserOrder.timeStamp,UserOrder.productIds,UserOrder.orderStatus,UserOrder.snapshot,AddressBook.name,AddressBook.mobile,AddressBook.address from UserOrder left join AddressBook on UserOrder.addressId=AddressBook.id where addressId>0 and timeStamp>=? and timeStamp<=? and UserOrder.orderStatus!=3 order by UserOrder.timeStamp desc desc limit 0,?', [time_stamp_start, time_stamp_end, shop_id, limit], function(err, ret){
		if(fn) fn( err, ret );
	});
};

//--------------------- 貌似以下两个方法的功能一致--------------//
exports.listUserValidOrders = function(user_id, shop_id, limit, fn){
    if(shop_id==25){//来自25号店 的用户，补充查询下他是否在26号点时候有订单记录
        conn.query('select UserOrder.id,UserOrder.userId,UserOrder.addressId as addressId,UserOrder.timeStamp,UserOrder.productIds,UserOrder.orderStatus,UserOrder.snapshot,UserOrder.orderRP,AddressBook.name,AddressBook.mobile,AddressBook.shortTel,AddressBook.address from UserOrder left join AddressBook on UserOrder.addressId=AddressBook.id where addressId>0 and UserOrder.userId=? and UserOrder.shopId in (25,26) order by UserOrder.timeStamp desc limit ?', [user_id,limit], function(err, ret){
            if(fn) fn( err, ret );
        });
    }else{
        conn.query('select UserOrder.id,UserOrder.userId,UserOrder.addressId as addressId,UserOrder.timeStamp,UserOrder.productIds,UserOrder.orderStatus,UserOrder.snapshot,UserOrder.orderRP,AddressBook.name,AddressBook.mobile,AddressBook.shortTel,AddressBook.address from UserOrder left join AddressBook on UserOrder.addressId=AddressBook.id where addressId>0 and UserOrder.userId=? and UserOrder.shopId=? order by UserOrder.timeStamp desc limit ?', [user_id, shop_id, limit], function(err, ret){
            if(fn) fn( err, ret );
        });
    }
    return;
};
exports.listValidOrdersByUserId = function(user_id, limit, fn){
	var _limit =  '';
	if(limit){//TODO: limit参数这个数字不能由用户自己传入, 不然存在sql 注入的风险
		_limit = ' limit '+limit;
	}

	conn.query('select UserOrder.id,UserOrder.userId,UserOrder.addressId as addressId,UserOrder.timeStamp,UserOrder.productIds,UserOrder.orderStatus,UserOrder.snapshot,UserOrder.shopId,shopType,AddressBook.name,AddressBook.mobile,AddressBook.shortTel,AddressBook.address from UserOrder left join AddressBook on UserOrder.addressId=AddressBook.id left join Shop on UserOrder.shopId=Shop.id where UserOrder.userId=? and addressId>0 order by UserOrder.timeStamp desc'+_limit, [user_id], function(err, ret){
		if(fn) fn( err, ret );
	});
};
exports.listOrdersByExtra = function(shop_id, extra, fn, is_group_by){
    var group_by = '';
    if( is_group_by ){
        group_by = ' group by UserOrder.userId';
    }
	conn.query('select UserOrder.id,UserOrder.userId,UserOrder.addressId as addressId,UserOrder.timeStamp,UserOrder.productIds,UserOrder.orderStatus,UserOrder.snapshot,AddressBook.name,AddressBook.mobile,AddressBook.address from UserOrder left join AddressBook on UserOrder.addressId=AddressBook.id where addressId>0 and UserOrder.extra=? and UserOrder.shopId=?'+group_by+ ' order by UserOrder.id desc', [extra, shop_id], function(err, ret){
		if(fn) fn( err, ret );
	});
};
//-------------------------------------------------------------------

exports.getLastOrdersOfUsers = function(shop_id, fn){
    var query = 'select userId,max(timeStamp) as timeStamp, max(id) as maxId from UserOrder where shopId=? group by userId order by userId desc;';
    if( shop_id.constructor == Array ){//shop_id 是一个数组的话, 说明调用者想查特定的一帮人的lastOrders
        query = 'select userId,max(timeStamp) as timeStamp, max(id) as maxId from UserOrder where userId in ('+ shop_id.join() +') group by userId order by userId desc;';
	    conn.query(query, function(err, ret){
	        if(fn) fn( err, ret );
	    });
        return;
    }
	conn.query(query, [shop_id], function(err, ret){
		if(fn) fn( err, ret );
	});
};

exports.getOrderNumOfUsers = function(user, fn){
    var today_start = getDateStartAndEndTimeStamp(user.y, user.m, user.d).time_stamp_start,
        user_ids = user.user_ids || [0];
    var query = 'select userId,count(id) as orderNum from UserOrder where userId in ('+ user_ids.join() +') and addressId is not null and timeStamp<? group by userId';
    conn.query(query, [today_start], function(err, ret){
		if(fn) fn( err, ret );
	});
};

//根据订单id获取下单用户的下单记录数，以此判断是否为新用户
exports.getOrderNumByOrderId = function(orderId, fn){
    conn.query('select userId,count(id) as orderNum from UserOrder where userId in (select userId from UserOrder where id=? and addressId is not null group by userId)', [orderId], fn);
};

//功能和getAddress类似, 只是这里把 isAvailable=0 的数据也去出来了
exports.getAllAddress = function(user_id, fn){
	if(typeof user_id == 'string' || typeof user_id == 'number' ){
		conn.query('select * from AddressBook where userId=?', [user_id], function(err, ret){
			if(fn) fn( err, ret );
		});
		return;
	}
	
	if( !user_id ){
		conn.query('select * from AddressBook', function(err, ret){
			if(fn) fn( err, ret );
		});
		return;
	}

	//运行到这里, 必须保证user_id是数组才行啊
	if( !user_id.length ){
		fn( null, []);
		return;
	}
	//运行到这里, 必须保证user_id是数组才行啊
	conn.query('select * from AddressBook where userId in ('+ user_id.join()  +')', function(err, ret){
		if(fn) fn( err, ret );
	});
};

exports.getAddress = function(user_id, fn){
	if(typeof user_id == 'string' || typeof user_id == 'number' ){
		conn.query('select * from AddressBook where AddressBook.userId=? and AddressBook.isAvailable=1', [user_id], function(err, ret){
			if(fn) fn( err, ret );
		});
		return;
	}
	
	if( !user_id ){
		conn.query('select * from AddressBook where isAvailable=1', function(err, ret){
			if(fn) fn( err, ret );
		});
		return;
	}

	//运行到这里, 必须保证user_id是数组才行啊
	if( !user_id.length ){
		fn( null, []);
		return;
	}
	//运行到这里, 必须保证user_id是数组才行啊
	conn.query('select * from AddressBook where userId in ('+ user_id.join()  +') and isAvailable=1', function(err, ret){
		if(fn) fn( err, ret );
	});

};

exports.getCurrentAddr = function(user_id, fn){
    conn.query('select addressId from UserOrder where userId=? and addressId is not null order by timeStamp desc limit 1', [user_id], fn);
};

exports.getAddressOfShop = function(shop_id, fn){
    conn.query('select name,mobile,userId,address from AddressBook where ( userId in (select id from User where shopId=?)) and ( userId in (select userId from UserOrder where timeStamp>1409500801000) )', [shop_id], function(err, ret){
		if(fn) fn( err, ret );
	});
};

exports.insertAddress = function(user_id, addr, fn){
    conn.query('insert into AddressBook set userId=?,name=?,mobile=?,shortTel=?,address=?,timeStamp=?', [user_id, addr.name, addr.mobile, addr.shortTel, addr.address, new Date().getTime()], function(err, ret){
        if(fn) fn( err, ret );
    });
};
exports.disableAddr = function(addr_id, fn){
    conn.query('update AddressBook set isAvailable=0 where id=?', [ addr_id ], function(err, ret){
        if(fn) fn( err, ret );
    });
};
//向数据表ArticleCategory中插入文章类别---------zed
exports.insertArticleCategory = function(name,fn){
    conn.query('insert into ArticleCategory set name=?',[name],fn);
}
//查询数据库中文章类别---------zed
exports.selectArticleCategory = function(fn){
    conn.query('select id, name ,sortId from ArticleCategory order by sortId desc',fn);
}
//删除数据库中文章类别---------zed
exports.delArticleCategory = function (id,  fn){
    conn.query('delete from ArticleCategory where id=?',[id],fn);
}
//文章加权
exports.sortArticleCategory = function(sort, id ,fn){
    conn.query('update ArticleCategory set sortId=? where id=?', [sort , id] , fn);
}
//更新数据库中文章类别---------zed
exports._updateArticleCategory = function(name, id, fn){
    conn.query('update ArticleCategory set name=? where id=?', [name , id] , fn);
}
// ------------------------------ article -------------------------//
exports.insertArticle = function(article, fn){
    conn.query('insert into Article set title=?,content=?,timeStamp=?,shopId=?,categoryId=?,userId=?,author=?', [article.title, article.content ,article.intime, article.shop_id, article.categoryid,article.user_id, article.author], fn);
};
exports.listArticles = function(shop_id, fn){
    //conn.query('select id,title,content,timeStamp from Article where shopId=? order by id desc', [shop_id], fn);
    conn.query('select id,title,content,timeStamp,shopId,lastUpdateTimeStamp,categoryId  from Article where shopId=? or shopId=0 order by showOrder desc, lastUpdateTimeStamp desc', [shop_id], fn);
};
//默认首先查询的文章
exports.listArticlesStartFromByLength = function(shop_id,category, start, end, fn){
    conn.query('select id,title,content,timeStamp,lastUpdateTimeStamp from Article where shopId in(?,0) and categoryId=? order by showOrder desc, lastUpdateTimeStamp desc limit ?,?', [shop_id,category, start, end], fn);
};
exports.updateArticle = function(article, fn){
    var obj = makeUpdateFieldAndValues( article );
    obj.values.push( article.id );
    conn.query('update Article set '+ obj.fields.join() +' where id=?', obj.values, fn);
};

exports.getArticleById = function(id, fn){
    conn.query('select id,title,content,timeStamp,viewCount,author,showOrder,lastUpdateTimeStamp,commentNum,userId,img from Article where id=?', [id], fn);
};
exports.insertArticleImg = function(img_name, fn){
    conn.query('insert into ArticleImg set imgName=?,timeStamp=?', [img_name, new Date().getTime()], fn);
};
exports.listArticleImgs = function(fn){
    conn.query('select id,imgName,timeStamp from ArticleImg order by id desc', fn);
};
exports.delArticleImg = function(img_id, fn){
    conn.query('delete from ArticleImg where id=?', [img_id], fn);
};
exports.increaseArticleViewCount = function(article_id, fn){
    conn.query('update Article set viewCount = viewCount + 1 where id=?', [article_id], fn);
};
exports.likeArticle = function(obj, fn){
    conn.query('select userId from UserLike where objId=?',[obj.article_id],function(err,ret){
        if(err){
            console.log(err);
        }
        var arry = ret||[];
        var  shot = 'false';
        arry.forEach(function(u,i){
            if(u.userId == obj.user_id){
                console.log(obj.user_id+' 已经点过赞');
                shot = 'ture';
                return;
            }
        });
        if(shot == 'false'){
            conn.query('insert into UserLike set objId=?,userId=?', [obj.article_id, obj.user_id], function(err, ret){
                if( !err ){
                    conn.query('update Article set lastUpdateTimeStamp=CURRENT_TIMESTAMP where id=?', [obj.article_id], fn);
                    return;
                }
                console.log(err);
            });
        }
    });
};
exports.getLikesOfArticle = function(article_id, fn){
    article_id -= 0;
    conn.query('select userId,objId,UserLike.timeStamp,User.nick from UserLike,User where UserLike.userId=User.id and objId=?', [article_id], fn);
};




//------------------------------ finance --------------------------//
exports.listFinanceRecords = function(time_stamp_start, time_stamp_end, shop_id, fn){
	conn.query('select id,digest,inCount,outCount,remain,comment recordTimeStamp,timeStamp,comment from FinanceRecord where recordTimeStamp>=? and recordTimeStamp<=? and shopId=? order by timeStamp', [time_stamp_start, time_stamp_end, shop_id], fn);
};
exports.addFinanceRecord = function(record, shop_id, fn){
    conn.query('insert into FinanceRecord set digest=?,inCount=?,outCount=?,recordTimeStamp=?,comment=?,remain=?,shopId=?', [record.digest, record.inCount, record.outCount, record.recordTimeStamp, record.comment, record.remain, shop_id], fn);
};
exports.getRecordById = function(record_id, fn){
	conn.query('select id,digest,inCount,outCount,remain,recordTimeStamp,timeStamp,comment from FinanceRecord where id=?', [record_id], fn);
};
exports.updateFinanceRecord = function(record, fn){
	var obj = makeUpdateFieldAndValues(record);
	obj.values.push(record.id);
	conn.query('update FinanceRecord set '+ obj.fields +' where id=?', obj.values, fn);
};
exports.delFinanceRecord = function(record_id, fn){
	conn.query('delete from FinanceRecord where id=?', [record_id], fn);
};
//------------------------------ product --------------------------//
exports.insertProduct = function(product, fn){
    conn.query('insert into Product set title=?,img=?,price=?,promotePrice=?,cost=?,unit=?,productStatus=?,timeStamp=?,code=?,shopId=?', [product.title, product.img, product.price, product.promotePrice, product.cost, product.unit, product.productStatus, product.timeStamp, product.code, product.shopId||product.shop_id], fn);
};


exports.listProducts = function(ids, fn){
    if( typeof ids == 'string'){
        var shop_id = ids;
        var sarry = [];
        //保存货架信息
        conn.query('select id,name,content from Section where shopId=?',[ids],function(err,_ret){
            if(!err){
                _ret.forEach(function(tmp,i){
                    var temp = {
                        'id':tmp.id,
                        'name':tmp.name,
                        'content':JSON.parse(tmp.content)
                    };
                    sarry = sarry.concat(temp);
                });
                //防止无须的异步，嵌套操作
                //将每个产品添加所属货架id,货架name属性
                conn.query('select id,code,title,img,price,promotePrice,cost,unit,productStatus,shopId,timeStamp from Product where shopId=? order by id desc', [shop_id], function(err,ret) {
                    if(!err){
                        ret.forEach(function(pro,i){
                            sarry.forEach(function(sc,i){
                                sc.content.forEach(function(si,i){
                                    if(si == pro.id){
                                        pro.sid =sc.id;
                                        pro.sna = sc.name;
                                    }
                                });
                            });
                        });
                        if(fn) fn(err,ret);
                    }
                    console.log(err);
                    return;
                });
            }
            console.log(err);
            return;
        });
    }else{
        conn.query('select id,code,title,img,price,promotePrice,cost,unit,productStatus,shopId,timeStamp from Product where id in ('+ ids.join(',') +') order by id desc', fn);
    }
};
exports.importProductsFromTo = function(from_shop_id, shop_id, fn){
    conn.query('insert IGNORE into Product(code,title,img,price,promotePrice,cost,unit,timeStamp,shopId) select code,title,img,price,promotePrice,cost,unit,CURRENT_TIMESTAMP(),'+ shop_id +' from Product where shopId=?', [from_shop_id], fn);
};
exports.listOnSaleProducts = function(fn){
    conn.query('select id,title,img,price,promotePrice,cost,unit,productStatus,timeStamp from Product where productStatus=0 order by id desc', fn);
};
exports.listOffSaleProducts = function(fn){
    conn.query('select id,title,img,price,promotePrice,cost,unit,productStatus,timeStamp from Product where productStatus=1 order by id desc', fn);
};

exports.getProductsByIds = function(ids, fn, obj){
    if(obj && obj.w_id){
        conn.query('select Product.id,Product.code,Product.title,Product.img,Product.price,Product.promotePrice,Product.cost,Product.unit,Product.productStatus,Product.shopId,Product.timeStamp,Store.productStrategyId from Product left join Store on Store.pId=Product.id where id in ('+ ids.join(',') +') and Store.wId=?' , [obj.w_id], fn);
        return ;
    }
    conn.query('select Product.id,Product.code,Product.title,Product.img,Product.price,Product.promotePrice,Product.cost,Product.unit,Product.productStatus,Product.shopId,Product.timeStamp from Product where id in ('+ ids.join(',') +')' , fn);
};

exports.getStoreProducts = function( data, fn ){
	var query = 'select Product.id,Product.title,Product.img,imgQN,Product.unit,Product.price,Product.promotePrice,Product.cost,Product.timeStamp,Store.pid,Store.productStatus,Store.code,Store.count,Store.secureCount,Store.warningCount,onSelling from Store left join Product on Store.pid = Product.id where Store.productStatus in(0,2) and Store.onSelling=? and wId=? and Store.pid in ('+ data.pids.join(',') +') order by Product.id desc';
    conn.query(query, [1, data.wId], fn);
};

exports.getProductById = function(product_id, fn){
    conn.query('select id,code,title,img,price,promotePrice,cost,unit,productStatus,shopId,timeStamp from Product where id=?', [product_id], fn);
};
exports.delProductByPd = function(product, fn){
    conn.query('delete from Product where id=?', [product.pid], fn);
};
exports.getProductByCode = function(code, shop_id, fn){
    conn.query('select id,code,title,img,price,promotePrice,cost,unit,productStatus,shopId,timeStamp from Product where code=? and shopId=?', [code, shop_id], fn);
};
exports.updateProductStatus = function(product_id, status_code, fn){
    conn.query('update Product set productStatus=? where id=?', [status_code, product_id], fn);
};
exports.updateProductImg = function(product_id, img, fn){
    conn.query('update Product set img=? where id=?', [img, product_id], fn);
};
exports.exportProductsToWarehouse = function(ids, to_w_id, fn){
    conn.query('insert IGNORE into Store(pId,code,wId) select id,code,? from Product where code is not null and code!="" and id in ('+ ids.join() +')', [ to_w_id ], fn);
};
exports.exportProductsToShop = function(ids, to_shop_id, fn){
    conn.query('insert IGNORE into Product(title,img,price,promotePrice,cost,unit,code,shopId,imgQN) select title,img,price,promotePrice,cost,unit,code,?,imgQN from Product where code is not null and code!="" and id in ('+ ids.join() +')', [ to_shop_id ], fn);
};

//更新product的数据, 仅仅更新需要更新的字段
exports.updateProduct = function(product, fn){
	var fields = [];
	var values = [];
    var p;
	for(p in product){
		if( product.hasOwnProperty(p) && p!='id' ){
			fields.push(p+'=?');
			values.push(product[p]);
		}
	}
	values.push(product.id);
    //conn.query('update Product set title=?,price=?,promotePrice=?,cost=?,unit=?,productStatus=? where id=?', [product.title, product.price, product.promotePrice, product.cost, product.unit, product.productStatus, product.id], fn);
    conn.query('update Product set '+ fields.join() +' where id=?', values, fn);
};


exports.updateProductSection = function(s_id, p_ids, fn){
    pool.query('update Product set section=? where id in (?)', [s_id, p_ids], function(err, ret){
        if(fn) fn(err, ret);
    });
};


//-------------------------- Setting ------------------//

exports.listSettings = function(shop_id, fn){
    conn.query('select id,settingKey,settingValue from Setting where shopId=?', [shop_id], fn);
};
exports.delSettingByName = function(setting_name, fn){
    conn.query('delete from Setting where settingKey=?', [setting_name], fn);
};

exports.getSettingByKey = function(key, shop_id, fn){
    conn.query('select id,settingKey,settingValue from Setting where settingKey=? and shopId=?', [key, shop_id], fn);
};
exports.getSettingsByShopId = function(shop_id, fn){
    conn.query('select id,settingKey,settingValue from Setting where shopId=?', [shop_id], fn);
};
exports.updateSetting = function(key, value, fn){
    conn.query('update Setting set settingValue=? where settingKey=?', [value, key], fn);
    //conn.query('insert into Setting set settingKey=?,settingValue=? ', [value, key], fn);
};
exports.updateSettingOfShop = function(key, value, arrays, fn){
    //conn.query('update Setting set settingValue=? where settingKey=? and shopId=?', [value, key, shop_id], fn);
    if( arrays.constructor != Array ){
        arrays = [arrays]
    }
    for(var i=0;i<arrays.length;i++) {
        conn.query('insert into Setting set settingValue=?, settingKey=?, shopId=? on duplicate key update settingValue=?', [value, key, arrays[i], value], fn);
    }

};
exports.clearSetCurLeaveStatus = function(key, value, arrays, fn){
    if( arrays.constructor != Array ){
        arrays = [arrays];
    }
    for(var i=0;i<arrays.length;i++) {
        conn.query('insert into Setting set settingValue=?, settingKey=?, shopId=? on duplicate key update settingValue=?', [value, key, arrays[i], value], fn);
    }

};

exports.insertSetting = function(key, value, fn){
    conn.query('insert into Setting set settingKey=?,settingValue=?', [key, value], fn);
};

//------------ notice----//
exports.insertNotice = function(content, shop_id, fn){
    conn.query('insert into Notice set content=?,shopId=?', [content, shop_id], fn);
};
exports.listNotices = function(shop_id, fn){
    conn.query('select id,content,timeStamp from Notice where shopId=? order by id desc', [shop_id],fn);
};
exports.updateNoticeById  =function(content, id, fn){
    var ts = new Date();
    conn.query('update Notice set content=?,timeStamp=? where id=?', [content, ts, id], fn);
}
exports.delNoticeById = function(id, fn){
    conn.query('delete from Notice where id=?', [id], fn);
};
exports.getCurNotice = function(shop_id, fn){
    conn.query('select id,content,timeStamp from Notice where id in (select settingValue from Setting where settingKey="curNoticeId" and shopId=?);', [shop_id], fn);
};
//------------ section ----//
exports.insertSection = function(section, shop_id, fn){
    conn.query('insert into Section set name=?,content=?,shopId=?,short_title=?', [section.name, section.content, shop_id, section.short_title], fn);
};
exports.listSections = function(shop_id, fn){
    //conn.query('select id,name,content,showOrder from Section where shopId=? order by showOrder desc', [shop_id], fn);
    conn.query('select id,name,content,showOrder,isAvailable,ad,nPin,type,className,short_title,topTime from Section where shopId=? and isAvailable=1 order by showOrder desc', [shop_id], fn);
};
exports.listAllSections = function(shop_id, fn){
    var shop = shop_id,
        condiction = '';
    //传了一个对象过来
    if( typeof shop == 'object'){
        shop_id = shop.shop_id;
        (shop.section_id || shop.section_id == 0) && (condiction = ' and id=' + shop.section_id);
    }
    conn.query('select id,name,content,showOrder,isAvailable,ad,nPin,type from Section where shopId=?'+ condiction +' order by showOrder desc', [shop_id], fn);
};

exports.getSectionById = function(id, fn){
    conn.query('select id,name,content,showOrder,isAvailable,ad,nPin,type, className,short_title,topTime from Section where id=?', [id], fn);
};
exports.updateSection = function(section, fn){
    conn.query('update Section set name=?,content=?,showOrder=?,isAvailable=?,nPin=?,ad=?,type=?,className=?,short_title=?,topTime=? where id=?', [section.name, section.content, section.showOrder, section.isAvailable, section.nPin,section.ad, section.type,section.className, section.short_title,section.topTime, section.id], fn);
};
exports.updateSectionAd = function(section, fn){
    conn.query('update Section set ad=? where id=?', [section.ad, section.id], fn);
};
exports.getAllSectionStrategy = function(fn){
    conn.query('select id,type,mark,content from SectionStrategy', fn);
};
exports.insertSectionStrategy = function(obj, fn){
    conn.query('insert into SectionStrategy set type=?,mark=?,content=?',[obj.type, obj.mark, obj.content], fn);
};
exports.deleteSectionStrategyById = function(arg, fn){
    conn.query('delete from SectionStrategy where id=?', [arg.id], fn);
};

exports.updateSectionOrder = function(shop_id, change, fn){
    var query = '';
    var hasChanges = false;
    //货架的排序有改变, 得更新
    if( change.section_order_changed){
        hasChanges = true;
        var ary_order = change.section_order_changed.ary_order;

        query += ' UPDATE Section SET showOrder = CASE id ';
	    ary_order.forEach(function(section_id, i){
		    query += 'WHEN ' + section_id + ' THEN '+ (ary_order.length-i) +' ';//section 的showOrder 是倒序排列的
	    });
	    query += 'END where id in ('+ ary_order.join() +');';//where id in 很重要, 它将更新限定在了指定的几个section, 不然整个表都被它更新了
    }
    if( change.ary_product_order_changes && change.ary_product_order_changes.length  ){
        hasChanges = true;
        query += ' UPDATE Section SET content = CASE id ';
        var ary_section_id_that_product_order_changed = [];//产品顺序发生改变的货架的section_id
        change.ary_product_order_changes.forEach(function (ch, i) {
            ary_section_id_that_product_order_changed.push( ch.section_id );
		    query += 'WHEN ' + ch.section_id + ' THEN \''+ ch.new_order +'\' ';
        });
	    query += 'END where id in ('+ ary_section_id_that_product_order_changed.join() +');'; //where id in 很重要, 它将更新限定在了指定的几个section, 不然整个表都被它更新了
    }
    if( hasChanges ){
        conn.query(query, fn);
        return;
    }

    fn(null,{
        msg : 'no changes',
        changeObj : change
    });
};

exports.delSectionById = function(id, fn){
    conn.query('delete from Section where id=?', [id], fn);
};

//--------------- TakeawayList 外卖单 ----------------------//
exports.insertTakeawayList = function (takeaway_list, fn) {
    //conn.query('insert into TakeawayList id,name,shopId,description,address,tels,showOrder,food from TakeawayList', fn);
    conn.query('insert into TakeawayList set name=?,shopId=?,description=?,address=?,tels=?,food=?', [takeaway_list.name, takeaway_list.shop_id, takeaway_list.description, takeaway_list.address, takeaway_list.tels, takeaway_list.food], fn);
};
exports.delTakeawayList = function (takeaway_list_id, fn) {
    conn.query('delete from TakeawayList where id=?', [takeaway_list_id], fn);
};
exports.getTakeawayListById = function (takeaway_list_id, fn) {
    conn.query('select id,name,shopId,description,address,tels,food,showOrder from TakeawayList where id=?', [takeaway_list_id], fn);
};
exports.listTakeaways = function (shop_id, fn) {
    conn.query('select id,name,shopId,description,address,tels,food,showOrder from TakeawayList where shopId=? order by showOrder desc', [shop_id], fn);
};
exports.updateTakeawayList = function (takeaway_list, fn) {
    var obj = makeUpdateFieldAndValues( takeaway_list );
    var query = 'update TakeawayList set '+ obj.fields.join() +' where id=?';
    obj.values.push(takeaway_list.id);
    conn.query(query, obj.values, fn);
};

//-------------- LeaveStatus ---------------------//
exports.getCurLeaveStatus = function(shop_id, fn){
    conn.query('select id,content,timestamp from LeaveStatus where id in (select settingvalue from Setting where settingkey="curLeaveStatusId" and shopId=?);', [shop_id], fn);
};
exports.listLeaveStatus = function(shop_id, fn){
    conn.query('select id,content,timeStamp,shopId from LeaveStatus order by id desc', fn);
};
exports.insertLeaveStatus = function(content, shop_id, fn){
    conn.query('insert into LeaveStatus set content=?,shopId=?', [content, shop_id], fn);
};
exports.delLeaveStatusById = function(id, fn){
    conn.query('delete from LeaveStatus where id=?', [id], fn);
};

//-------------- Motto ---------------------//
exports.listMottos = function(shop_id, fn){
    conn.query('select id,content,timeStamp,shopId from Motto order by id desc', fn);
};
exports.insertMotto = function(content, shop_id, fn){
    conn.query('insert into Motto set content=?,shopId=?', [content, shop_id], fn);
};
exports.delMottoById = function(id, fn){
    conn.query('delete from Motto where id=?', [id], fn);
};
exports.getCurMotto = function(shop_id, fn){
    conn.query('select id,content,timestamp from Motto where id in (select settingvalue from Setting where settingkey="curMottoId" and shopId=?);', [shop_id], fn);
};



// ------------- Log -------------//
exports.getVisitorCount = function(shop_id, time_stamp_start, time_stamp_end, fn){
	var time_start = new Date(time_stamp_start).format( 'yyyy-mm-dd HH:MM:ss' );
	var time_end = new Date(time_stamp_end).format( 'yyyy-mm-dd HH:MM:ss' );

    //conn.query('select count(distinct(lValue)) as count from Log where timeStamp>=? and timeStamp<=? and shopId=?',[time_start, time_end, shop_id], function(err, ret){
    /*conn.query('select count(distinct(lValue)) as count from Log where timeStamp>=? and timeStamp<=? and lKey="enter_store" and shopId=?',[time_start, time_end, shop_id], function(err, ret){
		if(!err){
			var obj = ret[0];
			fn(null, obj.count);
			return;
		}
		fn(err);
	});*/
    if(time_stamp_start >= 1422460800000){
        conn.query('select count(str) as count from NewLog where timeStamp>=? and timeStamp<=? and lKey="enter_store" and shopId=?',[time_start, time_end, shop_id], function(err, ret){
            if(!err){
                var obj = ret[0];
                fn(null, obj.count);
                return;
            }
            fn(err);
        });
    }else{
        conn.query('select count(distinct(lValue)) as count from Log where timeStamp>=? and timeStamp<=? and lKey="enter_store" and shopId=?',[time_start, time_end, shop_id], function(err, ret){
            if(!err){
                var obj = ret[0];
                fn(null, obj.count);
                return;
            }
            fn(err);
        });
    }
};
exports.getVisitors = function(shop_id, time_stamp_start, time_stamp_end, fn){
	var time_start = new Date(time_stamp_start).format( 'yyyy-mm-dd HH:MM:ss' );
	var time_end = new Date(time_stamp_end).format( 'yyyy-mm-dd HH:MM:ss' );

    if(time_stamp_start>= 1422460800000){
        conn.query('select lValue,timeStamp from NewLog where timeStamp>=? and timeStamp<=? and lKey="enter_store" and shopId=? order by timeStamp desc',[time_start, time_end, shop_id], fn);
    }else{
        conn.query('select lValue,timeStamp from Log where timeStamp>=? and timeStamp<=? and lKey="enter_store" and shopId=? order by timeStamp desc',[time_start, time_end, shop_id], fn);
    }
//    conn.query('select lValue,timeStamp from Log where timeStamp>=? and timeStamp<=? and lKey="enter_store" and shopId=? order by timeStamp desc',[time_start, time_end, shop_id], fn);
};

exports.getTodayLogNumOfLogKey = function (key, shop_id, time_stamp_start, fn) {

    if(time_stamp_start>=1422460800000){
        var query = 'select count(*) as num from NewLog where to_days(timeStamp) = to_days(now()) and lKey=? and (shopId=? or shopId is null)';
        conn.query( query, [key, shop_id], fn);
    }else{
        var query = 'select count(*) as num from Log where to_days(timeStamp) = to_days(now()) and lKey=? and (shopId=? or shopId is null)';
        conn.query( query, [key, shop_id], fn);
    }

    /*var query = 'select count(*) as num from Log where to_days(timeStamp) = to_days(now()) and lKey=? and (shopId=? or shopId is null)';
    conn.query( query, [key, shop_id], fn);*/
};


//------------------------ ResumeOfDate 每日业绩概览 ---------------------//
exports.upsertResumeOfDate = function(shop_id, date_str, obj_data, fn){
	var str = JSON.stringify(obj_data);
    conn.query('insert into DateResume set dateStr=?,dataStr=?,shopId=? ON DUPLICATE KEY UPDATE dataStr=? ',[date_str, str, shop_id, str], fn);
};
exports.listDateResume = function(shop_id, limit, fn){
    conn.query('select dateStr,dataStr from (select dateStr,dataStr from DateResume where shopId=? order by dateStr DESC limit ?) as tb order by dateStr', [shop_id, limit], fn);
};
exports.getResumeOfDate = function (shop_id, y, m, d, fn) {
    var dateStr =  y + '-' + two(m) + '-'+ two(d);
    conn.query('select dateStr,dataStr from DateResume where shopId=? and dateStr like "%'+ dateStr +'%"', [ shop_id ], fn);
};
exports.getResumesOfDate = function (y, m, d, fn) {
    var dateStr =  y + '-' + two(m) + '-'+ two(d);
    //var query = 'select Shop.id,name,address,description,type,dataStr,dateStr from Shop left join DateResume on Shop.id=DateResume.shopId where dateStr like "%'+ dateStr +'%"';
    var query = 'select Shop.id,name,address,description,type,expandtype,dataStr,dateStr from Shop left join (select * from DateResume where dateStr like "%'+ dateStr +'%") as new_Resume on Shop.id=new_Resume.shopId;';
    conn.query(query, fn);
};

//----------------------------------------- Comment ----------------------//
exports.insertComment = function (comment, fn) {
    conn.query('insert into Comment set content=?,userId=?,articleId=?',[comment.content, comment.user_id, comment.article_id], function(){
        conn.query('update Article set lastUpdateTimeStamp=CURRENT_TIMESTAMP where id=?', [comment.article_id], fn);
    });
};
exports.listComments = function (article_id, fn) {
    //conn.query('select id,content,userId,articleId,timeStamp from Comment where articleId=?',[article_id], fn);
    conn.query('select Comment.id,content,userId,articleId,Comment.timeStamp,User.nick,User.head from Comment,User where Comment.userId=User.id and articleId=?',[article_id], fn);
};

// ----------------------------------------- Msg ---------------//
exports.insertMsg = function (msg, fn) {
    conn.query('insert into Msg set msgType=?,fromUserId=?,toUserId=?,content=?,ext=?',[msg.msgType, msg.fromUserId, msg.toUserId, msg.content, msg.ext], fn);
};
exports.updateMsg = function (obj, fn) {
    conn.query('update Msg set reply=? where id=?',[obj.reply, obj.msg_id], fn);
};
//列出所有消息，sql语句，传过来的shop_id未用到，你懂的！--copy
exports.listallMsgs = function (shop_id, limit, fn) {
    conn.query('select id,content,reply,msgType,fromUserId,toUserId,timeStamp,ext from Msg order by id desc limit ?',[limit], fn);
};

exports.listMsgs = function (shop_id, limit, fn) {
    conn.query('select id,content,reply,msgType,fromUserId,toUserId,timeStamp,ext from Msg where toUserId=? order by id desc limit ?',['s_'+shop_id, limit], fn);
};
exports.listUserMsgs = function (shop_id, user_id, limit, fn) {
    conn.query('select id,content,reply,msgType,fromUserId,toUserId,timeStamp,ext from Msg where (toUserId=? and fromUserId=?) or (toUserId=? and fromUserId=?) order by id desc limit ?',['s_'+shop_id, 'u_'+user_id, 'u_'+user_id, 's_'+shop_id, limit], fn);
};
//点击加载所有消息，传过来的shop_id未用到，你懂的！--copy
exports.getSomeMsgsallLaterThan = function (shop_id, limit, msg_id, fn) {
    conn.query('select id,content,reply,msgType,fromUserId,toUserId,timeStamp,ext from Msg where id<? order by id desc limit ?',[msg_id, limit], fn);
};
exports.getSomeMsgsLaterThan = function (shop_id, limit, msg_id, fn) {
    conn.query('select id,content,reply,msgType,fromUserId,toUserId,timeStamp,ext from Msg where toUserId=? and id<? order by id desc limit ?',['s_'+shop_id, msg_id, limit], fn);
};
exports.getSomeUserMsgsLaterThan = function (shop_id, limit, user_id, msg_id, fn) {
    conn.query('select id,content,reply,msgType,fromUserId,toUserId,timeStamp,ext from Msg where id<? and ((toUserId=? and fromUserId=?) or (toUserId=? and fromUserId=?)) order by id desc limit ?',[msg_id, 's_'+shop_id, 'u_'+user_id, 'u_'+user_id, 's_'+shop_id, limit], fn);
};

//-------------------------------- Todo ---------------------------//
exports.addTodo = function (todo, fn) {
    conn.query('insert into Todo set content=?,shopId=?',[todo.content, todo.shop_id], fn);
};
exports.delTodo = function (todo_id, fn) {
    conn.query('delete from Todo where id=?', [todo_id], fn);
};
exports.getTodos = function (shop_id, fn) {
    conn.query('select id,content,timeStamp,shopId,todoStatus from Todo where shopId=? order by id desc',[shop_id], fn);
};


//--------------------- UserActivity ------------//
exports.insertUserActivity = function(obj, fn){
    //conn.query('insert into UserActivity set data=?,shopId=?,acId=?,userId=?', [obj.data, obj.shop_id, obj.ac_id, obj.user_id], fn);
    conn.query('insert into UserActivity set data=?,shopId=?,acId=?,userId=? on DUPLICATE KEY update data=?', [obj.data, obj.shop_id, obj.ac_id, obj.user_id, obj.data ], fn);
};
exports.getUserActivity = function(user_id, ac_id, fn){
    conn.query('select data,userId,acId,timeStamp from UserActivity where userId=? and acId=?', [user_id, ac_id], fn);
};


//---------------------- UserProfit --------------//
exports.insertUserProfits = function (shop_id, ary, fn) {
    var query = 'insert IGNORE into UserProfit (userId,shopId,totalPay,totalCost) values ';
    var values = [];
    ary.forEach(function (user_profit) {
        values.push( '('+ user_profit.user_id +','+ shop_id +','+ user_profit.total_pay +','+ user_profit.total_cost +') ' );
    });
    query += values.join();
    conn.query( query, fn);
};
exports.listUsersProfit = function (shop_id, fn) {
    //conn.query( 'select userId,shopId,totalPay,totalCost from UserProfit where shopId=? order by (totalPay-totalCost) desc', [ shop_id ],fn);
    conn.query( 'select userId,shopId,totalPay,totalCost from UserProfit where shopId=? order by (totalPay-totalCost) desc', [ shop_id ],fn);
};
exports.delUserProfits = function (shop_id, fn) {
    conn.query( 'delete from UserProfit where shopId=?', [ shop_id ],fn);
};


//--------------------- Tool ------------------//
exports.getUserToolByToolId = function (user_id, t_id, fn) {
    conn.query( 'select UserTool.id,timeStamp,img,title,description,Tool.cValue,isAvailable,type from UserTool left join Tool on UserTool.tId=Tool.id where userId=? and tId=?', [ user_id, t_id ], fn);
};
exports.getUserToolById = function (user_tool_id, fn) {
    conn.query( 'select UserTool.id,timeStamp,img,title,description,Tool.cValue,isAvailable,type from UserTool left join Tool on UserTool.tId=Tool.id where UserTool.id=?', [ user_tool_id ], fn);
};
exports.getUserToolsByIds = function (user_tool_ids, fn) {
    conn.query( 'select UserTool.id,UserTool.userId,timeStamp,img,title,description,Tool.cValue,isAvailable,type,expires from UserTool left join Tool on UserTool.tId=Tool.id where UserTool.id in (' + user_tool_ids.join() + ')',fn);
};

exports.getUserToolsWithIds = function (user_ids, fn) {
    if(!user_ids.length){
        fn(null, []);
        return;
    }
    conn.query( 'select UserTool.userId,UserTool.id,UserTool.tId,UserTool.timeStamp,UserTool.userId,isAvailable,title,img,type,cValue,expires,description,count(*) as num from UserTool left join Tool on UserTool.tId=Tool.id where UserTool.userId in ('+ user_ids.join()+') and UserTool.isAvailable=1 group by UserTool.tId,UserTool.userId',function(err, ret){
        if(fn) fn(err, ret);
    });
};
exports.getUserTools = function (user_id, fn) {
    conn.query( 'select UserTool.id,UserTool.timeStamp,img,title,description,Tool.cValue,Tool.expires,isAvailable,type,UserTool.tId from UserTool left join Tool on UserTool.tId=Tool.id where userId=? and UserTool.isAvailable=1', [ user_id ], fn);
};
exports.getToolsWithIds = function (ids, fn) {
    conn.query( 'select id,expires,title,cValue,type,img,description from Tool where id in ('+ ids.join() +')', fn);
};
//----------------------zed
exports.insertAllTools = function(tool,fn){
    conn.query('insert into Tool set expires=?,title=?,cValue=?,type=?,img=?,description=?',[tool.expires,tool.title,tool.cValue,tool.type,tool.img,tool.description],fn);
};
exports.updateTools = function(tool,fn){
    if(!tool.img||tool.img.length==0){
        conn.query('update Tool set title=?,cValue=?,type=?,description=? where id =?',[tool.title,tool.cValue,tool.type,tool.description,tool.id],fn);
    }else{
        conn.query('update Tool set img=?,title=?,cValue=?,type=?,description=? where id =?',[tool.img,tool.title,tool.cValue,tool.type,tool.description,tool.id],fn);
    }
};
exports.deleteTools = function(id,fn){
    conn.query('delete from Tool where id =?',[id],fn);
};
exports.listAllTools = function (fn) {
    conn.query( 'select id,expires,title,cValue,type,img,description from Tool order by id desc', fn);
};

exports.insertUserTool = function (tool, fn) {
    conn.query( 'insert into UserTool set tId=?,userId=?', [ tool.t_id, tool.user_id ], fn);
};
exports.disableUserTool = function (tool_id, fn) {
    conn.query( 'update UserTool set isAvailable=0 where id=? and isAvailable=1', [ tool_id ], fn);
};
exports.disableUserTools = function (ids, fn) {
    conn.query( 'update UserTool set isAvailable=0 where id in ('+ ids.join() +') and isAvailable=1', fn);
};

exports.getAllUserTools = function(fn){
    conn.query( 'select tId,userId,isAvailable,title,cValue,type,img,description from UserTool left join Tool on UserTool.tId=Tool.id where isAvailable=1', fn);
};

exports.recoverTool = function(recover, fn){
    var userIds = recover.user_id.replace(/^\s*|\s*$/, '');
    conn.query('update UserTool set isAvailable=? where tId=? and userId in ('+ userIds +')', [0, recover.t_id], fn);
};

//---------------- ExpressInfo -------------------//
exports.getUserExpressFetchInfo = function (user_id, fn) {
    conn.query( 'select id,data,timeStamp,userId from ExpressInfo where userId=?', [ user_id ],fn);
};
exports.saveExpressFetchInfo = function (user_id, data, fn) {
    conn.query( 'insert into ExpressInfo set userId=?,data=?', [ user_id, data ],fn);
};
exports.delExpressInfo = function (express_id, fn) {
    conn.query( 'delete from ExpressInfo where id=?', [ express_id ],fn);
};

//---------------- ExpressInfoFetch -------------------//
exports.listExpressInfoFetch = function (shop_id, time_stamp_start, time_stamp_end, fn) {
    //conn.query( 'select id,name,mobile,otherInfo,timeStamp,status,company from ExpressInfoFetch where shopId=? and timeStamp>? and timeStamp<? order by id desc', [shop_id, new Date(time_stamp_start), new Date(time_stamp_end)],fn);
    conn.query( 'select id,name,mobile,otherInfo,timeStamp,status,company from ExpressInfoFetch where shopId=? and timeStamp>? and timeStamp<? order by status,id desc',
               [
                   shop_id, 
                   new Date(time_stamp_start).format( 'yyyy-mm-dd HH:MM:ss' ), 
                   new Date(time_stamp_end).format( 'yyyy-mm-dd HH:MM:ss' )
               ],
    fn);
};
exports.insertExpressInfoFetch = function (exp, fn) {
    conn.query( 'insert into ExpressInfoFetch set shopId=?,name=?,mobile=?,otherInfo=?,company=?,userOrderId=?', [ exp.shop_id, exp.name, exp.mobile, exp.otherInfo, exp.company, exp.orderId?exp.orderId:'0' ], fn);
};
exports.updateExpressInfoFetch = function (fetch_id, status_code, fn) {
    conn.query( 'update ExpressInfoFetch set status=? where id=?', [ status_code, fetch_id ], fn);
};
exports.delExpressInfoFetch = function (fetch_id, fn) {
    conn.query( 'delete from ExpressInfoFetch where id=?', [ fetch_id ], fn);
};
exports.getExpressByUserOrderId = function(order_id, fn){
    conn.query('select * from ExpressInfoFetch where userOrderId=?', [order_id], fn);
}

// ------------ Lucky ---------------//

exports.getLucky = function(wx_id, fn){
    conn.query('select count,luckys,timeStamp from Lucky where wx_id=?', [wx_id],fn);
};
exports.setLucky = function(lucky, fn){
	if( lucky.luck.id == 5 ){//没中奖, 就累加一下count
		conn.query('insert into Lucky set wx_id=?,count=count+1,luckys=? on DUPLICATE KEY update count=count+1', [lucky.wx_id, lucky.content], fn);
		return;	
	}
    conn.query('insert into Lucky set wx_id=?,count=count+1,luckys=? on DUPLICATE KEY update count=count+1,luckys=concat(luckys, "," ,?)', [lucky.wx_id, lucky.content, lucky.content], fn);
};
exports.getLuckyByUserId = function(user_id, fn){
    conn.query('select count,luckys,timeStamp from Lucky where wx_id in (select openId from Open where userId=?)', [user_id], fn);
};



// ----------------- RP -------------------

//返还订单RP
exports.updateOrderRP = function(o_id, rp, fn){
    conn.query('update UserOrder set orderRP=? where id=?', [rp, o_id], function(err, ret){
        if(fn) fn(err, ret);
    });
};

//根据userId获取该用户所有订单返还的RP
exports.getAllOrderRPByUserId = function(u_id, fn){
    conn.query('select sum(orderRP) as rp from UserOrder where UserOrder.userId =?', [u_id], function(err, ret){
        if(fn) fn(err, ret);
        //fn(err, ret);
    });
};

//根据orderId获取该订单返还的RP
exports.getOrderRPByOrderId = function(u_id, fn){
    conn.query('select orderRP from UserOrder where UserOrder.id', [o_id], function(err, ret){
        if(fn) fn(err, ret);
        //fn(err, ret);
    });
};


//记录用户兑换记录
exports.insertUserExchange = function(u_id, t_id, val, fn){
    conn.query( 'insert into UserExchange set tId=?,userId=?,cValue=?', [ t_id, u_id, val ], function(err, ret){
        if(fn) fn(err, ret);
    });
};

//根据userId获取该用户兑换过的所有记录的 RP总合;
exports.getAllExchangeRPByUserId = function(u_id, fn){
    conn.query('select sum(cValue) as rp from UserExchange where UserExchange.userId =?', [u_id], function(err, ret){
        if(fn) fn(err, ret);
    });
};

exports.updateUserRP = function(obj, fn){
    conn.query('insert into UserRP set val=?,userId=? on duplicate key update val=val+?',[obj.val, obj.u_id, obj.val], function(err, ret){
        if(fn) fn(err, ret);
    });
};

exports.getUserRPByUserId = function(u_id, fn){
    conn.query('select val,userId from UserRP where userId=?', [u_id], function(err, ret){
        if(fn) fn(err, ret);
    });
};

exports.getUserWealth = function(u_id, fn){
    conn.query('select val,userId from UserWealth where userId=?', [u_id], function(err, ret){
        if(fn) fn(err, ret);
    });
};

exports.getUserWealthRank = function(shop_id, u_id, fn){
    conn.query('select N.userId,N.shopId,N.val,N.rownum from (select a.userId,a.shopId,a.val,(@rownum:=@rownum+1) as rownum from (select val,UserWealth.userId,shopId from User right join UserWealth on User.id=UserWealth.userId where shopId=?) as a,(select @rownum:=0) as b order by val desc) as N where userId=?', [shop_id, u_id], function(err, ret){
        if(fn) fn(err, ret);
    });
};

exports.updateUserWealth = function(obj, fn){
    conn.query('insert into UserWealth set val=?,userId=? on duplicate key update val=val+?',[obj.val, obj.u_id, obj.val], function(err, ret){
        if(fn) fn(err, ret);
    });
};

exports.listUserWealth = function(shop_id, limit, fn){
    conn.query('select UserWealth.val,UserWealth.userId,Open.openId,User.shopId,User.email,User.nick,User.head from UserWealth left join Open on UserWealth.userId=Open.userId left join User on UserWealth.userId=User.id where User.shopId=? order by UserWealth.val desc limit ?',[shop_id, limit], function(err, ret){
        if(fn) fn(err, ret);
    });
};

exports.getAllUserOrder = function(fn){
    conn.query('select userId,addressId,orderRP,snapshot,orderStatus from UserOrder where orderStatus=2 and addressId<>""', function(err, ret){
        if(fn) fn(err, ret);
    });
};

exports.insertSign = function(o, fn){
    conn.query('insert into Sign set val=?,userId=?,gId=?',[o.rp, o.u_id, o.g_id], function(err, ret){
        if(fn) fn(err, ret);
    });
};
//往数据库插入用户签到一次的统计
exports.insertUserCount = function(userId,userRP,timeStamp,fn){
    conn.query('insert into UserCount set userId=?,userRP=?,timeStamp=?',[userId,userRP,timeStamp],fn);
};

exports.getLastSignByUserId = function(u_id, fn){
    conn.query('select id,userId,gId,val,timeStamp from Sign where userId=? order by id desc limit 1', [u_id], function(err, ret){
        if(fn) fn(err, ret);
    });
};

//------------------------------------- Employee ---------------------------//
exports.listEmployee = function (shop_id, fn) {
    var query = 'select id,name,userId,type,shopId,level,timeStamp,bankName,bankCardNum,qq,mobile,wxNick,idCardNum from Employee';
    conn.query(query, [ shop_id ], function(err, ret){
        if(fn) fn(err, ret);
    });
};

exports.insertEmployee = function (employee, fn) {
    var query = 'insert into Employee set name=?,userId=?,type=?,shopId=?,level=?,bankName=?,bankCardNum=?,qq=?,mobile=?,wxNick=?,idCardNum=?';
    console.log( 'insert', employee );
    conn.query(query, [ employee.name, employee.userId, employee.type, employee.shopId, employee.level, employee.bankName, employee.bankCardNum, employee.qq, employee.mobile, employee.wxNick, employee.idCardNum ], function(err, ret){
        if(fn) fn(err, ret);
    });
};

exports.getEmployee = function (eid, fn) {
    var query = 'select id,name,userId,type,shopId,level,timeStamp,bankName,bankCardNum,qq,mobile,wxNick,idCardNum from Employee where id=?';
    conn.query(query, [ eid ], function(err, ret){
        if(fn) fn(err, ret);
    });
};
exports.updateEmployee = function (employee, fn) {
    var obj = makeUpdateFieldAndValues( employee );
    var query = 'update Employee set '+ obj.fields.join() +' where id=?';
    obj.values.push( employee.id );
    console.log(query);
    console.log(obj.values);

    conn.query(query, obj.values, function(err, ret){
        if(fn) fn(err, ret);
    });
};

exports.insertVoice = function(voice, fn){
    console.log(voice);
    conn.query('insert into Push set title=?,voice=?,shopId=?', [voice.title, voice.voice, voice.shop_id], fn)
};
exports.getVoiceByShopId = function(ids, fn){
    conn.query('select id,title,voice,shopId from Push where shopId in (?)', [ids], fn);
};
exports.getVoiceById = function(id, fn){
    conn.query('select id,title,voice,shopId from Push where id=?', [id], fn);
};
exports.delVoiceById = function(v_id, fn){
    conn.query('delete from Push where id=?', [v_id], fn);
};
exports.updateVoice = function(voice, fn){
    var params = [],
        v_id = voice.v_id;
    delete voice.v_id;
    for(var p in voice){
        if( voice[p] != '' ) params.push(p+'="'+voice[p]+'"');
    }
    conn.query('update Push set ' + params.join(',') + ' where id='+v_id, fn);
};
//--------------------------短信财务接口-------------------------------------
exports.insertMsgFinance = function(content,time,fn){
    conn.query('insert into MsgFinance set content=?,time=?',[content,time],fn);
};
exports.getMsgFinance = function(fn){
    conn.query('select * from MsgFinance order by timeStamp desc', fn)
};
exports.deleteMsgFinance = function(errid,fn){
    conn.query('delete from MsgFinance where id=?',[errid],fn);
};
//-------------------------保存财务报表文件名到数据中-----//
exports.insertFinance = function(fileName, hashFileName, shopID, fn){
    conn.query('insert into FinanceExcels set name=?, hashFileName=?, shopID=?',[fileName,hashFileName,shopID], fn);
};
//-------------------------查询数据库中的记录财务记录-----//
exports.getFinanceExcels = function(shopID,userPower,fn){
    if(userPower == 4){
        conn.query('select * from FinanceExcels order by timeStamp desc', fn);
    }else if(userPower >2){
        conn.query('select * from FinanceExcels where shopID=? order by timeStamp desc',[shopID], fn);
    }

};

//-------------------------删除数据库中的记录财务记录-----//
exports.deleteFinanceExcel = function(id, fn){
//  conn.query('truncate FinanceExcels');
    conn.query('delete from FinanceExcels where id=?',[id],fn);
};

//----------------------------增加新的地址---------------@lufeng---------//
exports.insertSchoolAddress = function(shopId, newSchoolAddress, fn){
    conn.query('insert into Schools set address=?, status=?, shopId=?', [newSchoolAddress, 0, shopId], fn);
};

//----------------------------获取所有地址---------------@lufeng---------//
exports.getAllSchoolAddress = function(fn){
    conn.query('select * from Schools order by status desc, shopId desc, address', fn);
};

//----------------------------设置是否是默认地址---------------@lufeng---------//
exports.updateSchoolStatus = function(schoolId, fn){
    conn.query('update Schools set status=? where id=?', [1,schoolId], fn);
    conn.query('update Schools set status=? where id!=?', [0,schoolId], fn);
};


/*exports.getMaxId = function(fn){
    conn.query('select max(shopId) as shopId from Schools',fn);
}*/
//----------------------------删除地址---------------@lufeng---------//
exports.deleteSchoolAddress = function(schoolId, fn){
    //如果删除的是默认地在，则要重新
    conn.query('delete from Schools where id=?', [schoolId],fn);
};

//----------------------------更新地址---------------@lufeng---------//
exports.updateSchoolAddress = function(schoolId, newAddress, fn){
    conn.query('update Schools set address=? where id=?', [newAddress, schoolId] ,fn);
};
//文章按照内容分类
exports.updateArticleCategory = function(id,category,fn){
    conn.query('update Article set categoryId=? where id=?', [category, id] ,fn);
};
//文章按照shopId分类
exports.updateArticleShopId = function(id,shopId,fn){
    conn.query('update Article set shopId=? where id=?', [shopId, id] ,fn);
};
//查询用户订单---UserOrder-----//
exports.getUserOrderByUserId =function(userId,fn){
    conn.query('select id,timeStamp,productIds from UserOrder where userId=? order by timeStamp desc limit 1', [userId], fn);
};
//根据菜品的id获取菜品的信息
exports.getProductByProductId = function(productIds,fn){
    var productIds = productIds.replace(/\[(.*)\]/ig,'$1');
    conn.query('select id,title,img,price,unit from Product where id in ('+productIds+') and productStatus=?', [0], fn);
};
//从ProductComment表中查询订单中的菜品已评论
exports.getCommentStatusByUserOrderIdProductId = function(userOrderId,productIds,fn){
    var productIds = productIds.replace(/\[(.*)\]/ig,'$1');
//    conn.query('select * from ProductComment where userOrderId=? and productId in ('+productIds+')',[userOrderId],fn);
    conn.query('select * from ProductComment where userOrderId=?',[userOrderId],fn);
};

//提交评论
exports.submitComment = function(userOrderId,userId,productId,content,timeStamp,fn){
    conn.query('insert into ProductComment set userOrderId=?, userId=?,productId=?,content=?,timeStamp=?,status=?',[userOrderId,userId,productId,content,timeStamp,1],fn);
};

//根据productId从评论数据库查询每种2条评论信息
exports.getAllProductComment = function(productIdArr,fn){
    conn.query('select a.id,content,a.productId,head from ProductComment a left join User on a.userId=User.id where productId in ('+productIdArr+') and 2 > (select count(*) from ProductComment where productId = a.productId and timeStamp > a.timeStamp) order by a.productId,a.timeStamp',fn);


    //存储过程
    /*CREATE PROCEDURE `latest_product`(IN `2524` BIGINT)
    _return:BEGIN
    SELECT * FROM product_table WHERE id=product_id ORDER BY time DESC
    END*/
};

//根据shopId从数据库查询出产品的img,title,productId
exports.getAllProductByShopId = function(shopId,fn){
    conn.query('select id,title,img from Product where shopId=?',[shopId],fn);
};

//--------------------start--------签到抽奖---------------@lufeng---------//
exports.getAllSignDraw = function(shopId, fn){
    conn.query('select * from SingDraw where shopId=? order by type desc',[shopId],fn);
};

exports.insertNewDraw = function(signDraw,fn){
  conn.query('insert into SingDraw(title,type,shopId,count,val) values(?,?,?,?,?)',[signDraw.name,signDraw.kind,signDraw.shopId,signDraw.count,signDraw.val],fn);
};

exports.deleteDrawInfo = function(trId,fn){
    conn.query('delete from SingDraw where id = ?',[trId],fn);
};

exports.getAllDrawByShopIdType = function(args, fn){
  conn.query('select * from SingDraw where shopId=? and type=? and count!=?',[args.shopId,args.kind,0],fn);
};

exports.updateSignDrawCount = function(resultDraw, fn){
  conn.query('update SingDraw set count=count-? where id=?',[1, resultDraw.signDrawId],fn);
};

exports.updateDrawInfo = function(info, fn){
    conn.query('update SingDraw set title=?, type=? ,shopId=?, count=?, val=? where id=?',[info.title, info.type, info.shopId, info.count, info.val, info.id],fn);
};

exports.saveGenerateDraw = function(resultDraw, fn){
    conn.query('insert into SignResult(userId,signDrawId,timeStamp,type) values(?,?,?,?)',[resultDraw.userId,resultDraw.signDrawId,resultDraw.timeStamp,resultDraw.type],fn);
};

exports.findSignResult = function(userId, fn){
    conn.query('select SignResult.id,SignResult.userId,SignResult.signDrawId,SignResult.timeStamp,SignResult.status,SignResult.type,SingDraw.title from SignResult left join SingDraw on SignResult.signDrawId=SingDraw.id where SignResult.userId=? and SignResult.status=? and SignResult.type=? order by SignResult.timeStamp desc',[userId,1,2],fn);
};

exports.deleteSignResult = function(deleteSignResult,fn){
    conn.query('update SignResult set status=0 where id=?',[deleteSignResult.sign_result_id],fn);
};

exports.getLastSignTimeStamp = function(userId, fn){
    conn.query('select * from SignResult where userId=? order by timeStamp desc',[userId],fn);
};
//--------------------end--------签到抽奖---------------@lufeng---------//
//------------------guess----------猜中抽奖--------------zed
exports.insertGuess = function(data,fn){
    conn.query('insert into Guess (shopId,userId,type,answer) values(?,?,?,?)',[data.shop_id,data.userId,data.type,data.answer],fn);
};
exports.updateGuess = function(data,fn){
    conn.query('update Guess set status=1 where userId=?',[data],fn);
};
exports.selectGuess = function(data,fn){
    conn.query('select * from Guess where userId =?',[data],fn);
};
//------------------guess----------猜中抽奖--------------zed
exports.insertData = function(type, obj,fn){
    //conn.query('insert into UserOpration(userId,orderId,opration,timeStamp) values(?,?,?,?)',[obj.userId,obj.orderId,obj.opration,obj.time],fn);
    var strObj = JSON.stringify(obj);
    conn.query('insert into SystemMonitor(type, content) values(?,?)',[type, strObj],fn);
};

exports.selectUserOprationInfo = function(type,fn){
//    conn.query('select UserOpration.userId,UserOpration.orderId,UserOpration.opration,UserOpration.timeStamp,User.nick from UserOpration left join User on User.id = UserOpration.userId order by UserOpration.timeStamp desc',function(err,ret){
//        if(fn) fn(err,ret);
//    });
    conn.query('select id,content from SystemMonitor where type = ? order by id desc',[type],fn);
};

exports.updateUserOrderStatus = function(shopId,orderId,fn){
    conn.query('update UserOrder set orderStatus = 0 where shopId = ? and id = ?',[shopId,orderId],fn);
};


//lufeng---------------圣诞

exports.insterChristmasGift = function(objs,fn){

    conn.query('insert into AllActivity(type_key,type_value,shopId,extra) values("christmas",?,?,?)',[JSON.stringify(objs),objs.shopId, objs.userId],fn);
};

exports.findChristmasGift = function(obj, fn){
//    conn.query('select * from AllActivity where type_key=? and shopId=? and extra=?',["christmas", obj.shopId, obj.userId], fn);
    conn.query('select * from AllActivity where type_key=? and extra=?',["christmas", obj.userId], fn);
};

exports.listAllChristmasGifts = function(obj, fn){
    conn.query('select * from AllActivity where type_key=? and shopId=? group by extra order by status desc',["christmas", obj.shopId], fn);
};

exports.updateSendStatus = function(obj, fn){
    conn.query('update AllActivity set status=? where id=?',[0, obj.giftId],fn);
};

exports.sendByGiftId = function(obj, fn){
  conn.query('select * from AllActivity where id=?',[obj.giftId],fn);
};

//lufeng---------------圣诞

exports.monitorOrder = function(obj, time, fn){
    var monitorType = obj.monitorType || 'monitorOrder';
    conn.query('insert into SystemMonitor(type,content,timeStamp) values(?,?,?)',[monitorType,JSON.stringify(obj),time],fn);
};

exports.selectNickById = function(userId, fn){
    conn.query('select nick from User where id = ?',[userId],fn);
};


exports.selectUserValTools = function(userId, fn){
    if(userId == undefined) {
        conn.query('select User.id,User.nick,Tool.title ,UserTool.tId,UserWealth.val from User left join UserTool on User.id = UserTool.userId left join UserWealth on User.id = UserWealth.userId left join Tool on Tool.id = UserTool.tId where isAvailable = 1 and User.id = ?',['1'], fn);
    } else if(userId){
        conn.query('select User.id,User.nick,Tool.title ,UserTool.tId,UserWealth.val from User left join UserTool on User.id = UserTool.userId left join UserWealth on User.id = UserWealth.userId left join Tool on Tool.id = UserTool.tId where isAvailable = 1 and User.id = ?',[userId], fn);
    }
};

exports.deleteActByUserId = function(userId, fn){
    conn.query('delete from AllActivity where extra = ?',[userId],fn);
};

//------start---限次抢购产品
exports.insterPurchase = function(userInfo, limit_pids){

    try{
        console.log('limit_pids=' + limit_pids);
        limit_pids.forEach(function(pId, i){
            conn.query('insert into Purchase(userId,shopId,pId) values(?,?,?)',[userInfo.userId,userInfo.shopId-0,pId], function(err, ret){
                if( err ) console.log(err);
            });
        });
    }catch (e){
        console.log('---插入数据库的限购产品---dao----');
    }

};

exports.getlimitPIdsByUserId = function(userId, fn){
    conn.query('select userId,shopId,pId from Purchase where userId=?', [userId], fn);
};
//------end-----限次抢购产品

//------------用户当前使用版本状态默认是简单版0
exports.insertVersionUseStatus = function(data,fn){
    conn.query('insert into Version (shopId,userId) values(?,?)',[data.shopId,data.userId],fn);
};
exports.selectVersionUseStatus = function(data,fn){
    conn.query('select * from Version where userId=?',[data.userId],fn);
};
exports.selectVersionQuick = function(fn){
    conn.query('select count(id) as count from Version where status=0',fn);
};
exports.selectVersionSimple = function(fn){
    conn.query('select count(id) as count from Version where status=1',fn);
};
exports.selectVersionTotal = function(fn){
    conn.query('select count(id) as count from Version',fn);
};
exports.updateVersionUseStatus = function(status,data,fn){
    conn.query('update Version set status=? where id=?',[status,data],fn);
};
exports.updateVersionUseStatusByUserId = function(status,data,fn){
    conn.query('update Version set status=? where userId=?',[status,data],fn);
};
//------------用户当前使用版本状态默认是简单版0
exports.listUserClickNum = function(fn){
    conn.query('select content from SystemMonitor where type=?', ['clickNum'], fn);
};

exports.selectAnalysis = function(data, fn){
    var timeStamps = data.timeStamps;
    conn.query('select Analysis.content, userId,nick,position,Analysis.timeStamp from Analysis left join User on Analysis.userId = User.id where shopId=? and business=? and Analysis.timeStamp>? and Analysis.timeStamp<? order by Analysis.timeStamp',[data.shop_id, data.business, timeStamps.time_stamp_start, timeStamps.time_stamp_end], fn);
};

exports.delAnalysis = function(data, fn){
    var timeStamps = data.timeStamps;
    conn.query('delete from Analysis where userId in ('+data.userIdSet.join(',')+') and timeStamp>? and timeStamp<?',[timeStamps.time_stamp_start, timeStamps.time_stamp_end], fn);
};


//确认订单已支付状态--by@boylufeng
exports.updateUserOrderPayStatus = function(args, fn){
    conn.query('update UserOrder set payStatus=?,orderStatus=? where id=?', [args.payStatus, args.orderStatus, args.orderId], fn);
};

exports.getUserIds = function(shop_id, time_stamp_start, time_stamp_end, fn){
    var time_start = new Date(time_stamp_start).format( 'yyyy-mm-dd HH:MM:ss' );
    var time_end = new Date(time_stamp_end).format( 'yyyy-mm-dd HH:MM:ss' );

    if(time_stamp_start>=1422460800000){
        conn.query('select distinct(lValue) from NewLog where timeStamp >= ? and timeStamp <= ? and shopId = ? and lKey = "enter_store"',[time_start, time_end, shop_id], fn);
    }else{
        conn.query('select distinct(lValue) from Log where timeStamp >= ? and timeStamp <= ? and shopId = ? and lKey = "enter_store"',[time_start, time_end, shop_id], fn);
    }

//    conn.query('select distinct(lValue) from Log where timeStamp >= ? and timeStamp <= ? and shopId = ? and lKey = "enter_store"',[time_start, time_end, shop_id], fn);
};

exports.getOrdersByIds = function(ids, shop_id, time_stamp_start, fn){
    conn.query('select userId,count(id) as orderNum from UserOrder where userId in ('+ids.join(',')+') and snapshot is not null and orderStatus!=3 and shopId = ? and timeStamp <= ? group by userId',[shop_id, time_stamp_start ], fn);
};
//查看某店某天用户下单数
exports.getOrdersInDay = function(shop_id, time_stamp_start, time_stamp_end, fn){
    conn.query('select UserOrder.id,UserOrder.userId,UserOrder.addressId as addressId,UserOrder.timeStamp,UserOrder.productIds,UserOrder.orderStatus,UserOrder.snapshot,AddressBook.name,AddressBook.mobile,AddressBook.shortTel,AddressBook.address from UserOrder left join AddressBook on UserOrder.addressId=AddressBook.id where UserOrder.snapshot is not null and addressId>0 and UserOrder.timeStamp>=? and UserOrder.timeStamp<=? and UserOrder.shopId=? and UserOrder.orderStatus!=3 group by userId order by UserOrder.timeStamp desc', [time_stamp_start, time_stamp_end, shop_id], fn);
};


exports.getDayOrdersByIds = function(ids, shop_id, time_stamp_start,  fn){
    conn.query('select userId,count(id) as orderNum from UserOrder where  userId in ('+ids.join(',')+') and shopId = ? and timeStamp < ? group by userId',[shop_id, time_stamp_start ], fn);
};

//动态添加修改style--by@boylufeng
exports.getDynamicStyles = function(paramObj, fn){
    conn.query('select id, fileName, status, shopId, applyShopIds from DynamicStyle', fn);
};

exports.insertDynamicStyle = function(obj, fn){
    if(obj.edit=='true' && obj.id){//有记录则更新文件名
        var flag = obj.fileName.indexOf('?v=')-0;
        if(flag !=-1){
            obj.fileName = obj.fileName.substring(0, flag-1);
        }
        conn.query('update DynamicStyle set fileName=? where id=?',[obj.fileName+'?v='+new Date().getTime(), obj.id], fn);
        return;
    }
    var type = 'css';
    conn.query('insert into DynamicStyle(fileName,shopId,styleType) values(?,?,?)', [obj.fileName, obj.shopId, type], fn);
};

exports.deleteStyleFileById = function(file, fn){
    conn.query('delete from DynamicStyle where id=?', [file.id], fn);
};
exports.updateStyleFileStatus = function(file, fn){
    conn.query('update DynamicStyle set status=? where id=?', [file.status==1?0:1, file.id], fn);
};
exports.updateStyleFileShopIds = function(argObj, fn){
    conn.query('update DynamicStyle set applyShopIds=? where id=?', [argObj.shopIds, argObj.fileId], fn);
};

//恢复已付款
exports.recoverPay = function(args, fn){
    conn.query('update UserOrder set payStatus=? where id=?', [args.payStatus, args.orderId], fn);
};

exports.getPowerByUserId = function(oldIds, shop_id, fn){
    conn.query('select id,power from User where id in ('+oldIds.join(',')+') ', fn);
};

exports.zeroinventory = function(obj, fn){
    conn.query('update Store set count = 0 where wId = ?', [obj.wId], fn);
};

exports.getVisitorCountByParam = function(obj, fn){
    var time_start = new Date(obj.startTime).format( 'yyyy-mm-dd HH:MM:ss' );
    var time_end_week = new Date(obj.afterOneWeek).format( 'yyyy-mm-dd HH:MM:ss' );
    var time_end_month = new Date(obj.afterOneMonth).format( 'yyyy-mm-dd HH:MM:ss' );

    if(obj.status == 'oneweek') {
        conn.query('select userId,count(str) as count from NewLog where userId in ('+obj.idsArray+') and timeStamp>=? and timeStamp<=? and lKey="enter_store" and shopId=? group by userId', [time_start, time_end_week, obj.shopId], fn);
    }else{
        conn.query('select userId,count(str) as count from NewLog where userId in ('+obj.idsArray+') and timeStamp>=? and timeStamp<=? and lKey="enter_store" and shopId=? group by userId', [time_start, time_end_month, obj.shopId], fn);
    }
};

exports.getOrderByUserId = function(obj, fn){

    if(obj.status == 'oneweek') {
        conn.query('select userId,count(id) as orderNum from UserOrder where snapshot is not null and userId in ('+obj.idsArray+') and shopId = ? and timeStamp >= ? and timeStamp <= ? group by userId', [ obj.shopId, obj.startTime, obj.afterOneWeek], fn);
    }else{
        conn.query('select userId,count(id) as orderNum from UserOrder where snapshot is not null and userId in ('+obj.idsArray+') and shopId = ? and timeStamp >= ? and timeStamp <= ? group by userId', [ obj.shopId, obj.startTime, obj.afterOneMonth], fn);
    }

};

exports.getUserOrderedNum = function(obj, fn){
    if(obj.status == 'oneweek') {
        conn.query('select UserOrder.id,UserOrder.userId,UserOrder.addressId as addressId,UserOrder.timeStamp,UserOrder.productIds,UserOrder.orderStatus,UserOrder.snapshot,AddressBook.name,AddressBook.mobile,AddressBook.shortTel,AddressBook.address from UserOrder left join AddressBook on UserOrder.addressId=AddressBook.id where UserOrder.snapshot is not null and UserOrder.userId in ('+obj.idsArray+') and addressId>0 and UserOrder.timeStamp>=? and UserOrder.timeStamp<=? and UserOrder.shopId=? and UserOrder.orderStatus!=3 group by userId order by UserOrder.timeStamp desc', [obj.startTime, obj.afterOneWeek, obj.shopId], fn);
    }else{
        conn.query('select UserOrder.id,UserOrder.userId,UserOrder.addressId as addressId,UserOrder.timeStamp,UserOrder.productIds,UserOrder.orderStatus,UserOrder.snapshot,AddressBook.name,AddressBook.mobile,AddressBook.shortTel,AddressBook.address from UserOrder left join AddressBook on UserOrder.addressId=AddressBook.id where UserOrder.snapshot is not null and UserOrder.userId in ('+obj.idsArray+') and addressId>0 and UserOrder.timeStamp>=? and UserOrder.timeStamp<=? and UserOrder.shopId=? and UserOrder.orderStatus!=3 group by userId order by UserOrder.timeStamp desc', [obj.startTime, obj.afterOneMonth, obj.shopId], fn);
    }
};

exports.getNewUserOrderByIds = function(obj, newUserIds, fn) {
    if(obj.status == 'oneweek') {
        conn.query('select userId,count(id) as orderNum from UserOrder where snapshot is not null and userId in ('+newUserIds.join(',')+') and shopId = ? and timeStamp >= ? and timeStamp <= ? group by userId', [ obj.shopId, obj.startTime, obj.afterOneWeek], fn);
    }else{
        conn.query('select userId,count(id) as orderNum from UserOrder where snapshot is not null and userId in ('+newUserIds.join(',')+') and shopId = ? and timeStamp >= ? and timeStamp <= ? group by userId', [ obj.shopId, obj.startTime, obj.afterOneMonth], fn);
    }
};

exports.getCodeByPids = function(pIds, fn){
    conn.query('select id,code from Product where id in ('+pIds+') ', fn);
};

exports.getProIdsByShopId = function(shopId, fn){
    conn.query('select content from Section where shopId=?', [shopId], fn);
};

exports.getUserWXIDByuserId = function(userIdSet, fn){

    if(!userIdSet.checkedUserId || userIdSet.checkedUserId.length<0){
        console.log('>>>>>>>>>>没有发送，数据库查询不到wx_id<<<<<<<<<<<<');
        fn(null,[]);
        return;
    }
    conn.query('select openId from Open where userId in ('+userIdSet.checkedUserId.join(',')+')', fn);
};
//根据道具ID得到道具名称
exports.getToolTitleById = function(toolId, fn){
    conn.query('select title from Tool where id = ?', [toolId], fn);
};

//将用户操作记录到数据库
exports.insertUserOpToSystemMonitor = function(type, op, time, fn){
    var str = JSON.stringify(op);
    conn.query('insert into SystemMonitor set type=?,content=?,timeStamp=?', [type, str, time], fn);
};

//查询用户操作
exports.getUserOPs = function(type, time_stamp_start, time_stamp_end,fn){
    var time_start = new Date(time_stamp_start).format( 'yyyy-mm-dd HH:MM:ss' );
    var time_end = new Date(time_stamp_end).format( 'yyyy-mm-dd HH:MM:ss' );
    conn.query('select id,content,timeStamp from SystemMonitor where type =? and timeStamp>=? and timeStamp<=? order by id desc', [type, time_start, time_end], fn);
};
exports.getUserByOPs = function(type,fn){
//    显示全部的错误日志
    conn.query('select id,content,timeStamp from SystemMonitor where type =? order by id desc', [type], fn);
};

exports.getNickById = function(ids, fn){
    if(!ids || ids.length==0){
        return;
    }else{
        if(typeof (ids)=='string'){
            conn.query('select id,nick from User where id in ('+ids+')', fn);
        }else{
            conn.query('select id,nick from User where id in ('+ids.join(',')+')', fn);
        }
    }
};

exports.getSectionNameById = function(sectionIds, fn){
    if(!sectionIds || sectionIds.length==0){
        return;
    }else{
        conn.query('select id,name from Section where id in ('+sectionIds+')', fn);
    }
};

exports.getProNameByProId = function(pIds, fn){
    if(!pIds || pIds.length==0){
        return;
    }else{
        conn.query('select id,title from Product where id in ('+pIds+')', fn);
    }
};

exports.getOpInfoByIds = function(newStr, time_stamp_start, time_stamp_end, fn){
    var time_start = new Date(time_stamp_start).format( 'yyyy-mm-dd HH:MM:ss' );
    var time_end = new Date(time_stamp_end).format( 'yyyy-mm-dd HH:MM:ss' );
    conn.query('select id,content,timeStamp from SystemMonitor where type = ? and id in ('+newStr.join(',')+') and timeStamp>=? and timeStamp<=? order by id desc', ['productOp', time_start, time_end], fn);
};
//删除用户操作日志
exports.deleteUserOPs = function(errid, fn){
    conn.query('delete from SystemMonitor where id=?', [errid], fn);
};

//保存用户评价--added by lufeng
exports.insertIntoCustomerEvaluation = function(evaluationInfo, fn){
    conn.query('insert into CustomerEvaluation(openId,userId,shopId,content,timeStamp2) values(?,?,?,?,?)', [evaluationInfo.openId,evaluationInfo.userId,evaluationInfo.shopId,JSON.stringify(evaluationInfo.content),new Date().getTime()], fn);
};


exports.getAllCustomerEvaluation = function(argObj, fn){
    conn.query('select *,nick from CustomerEvaluation left join User on User.id=CustomerEvaluation.userId where timeStamp2>? and timeStamp2<? order by CustomerEvaluation.timeStamp desc', [argObj.time_stamp_start,argObj.time_stamp_end], fn);
};
//保存业务员的配送订单条码
exports.insertIntoBarCode = function(arg,fn){
    try{
        var argJson = arg,
            barcodeArr = argJson.barcode,
            sqlVal = '',
            orderId = -1;
        var sql = 'insert into BarCode(shopId,idCardNum,orderId,operationStatus,timeStamp,barcode) values';
        for(var i = 0, len = (barcodeArr.length-1); i < len; i++){
            var operationState = '';
            if(barcodeArr[i].indexOf('J')!=-1){
                operationState = 'J';
                orderId = barcodeArr[i].slice(2);
            }
            if(barcodeArr[i].indexOf('D')!=-1){
                operationState = 'D';
                orderId = barcodeArr[i].slice(2);
            }
            if(barcodeArr[i].indexOf('S')!=-1){
                operationState = 'S';
                orderId = barcodeArr[i].slice(2);
            }
            if(i==(len-1)){
                sqlVal += '('+argJson.shopId+',"'+argJson.idCardNum+'",'+orderId+',"'+operationState+'",'+new Date().getTime()+',"'+(operationState+'-'+orderId)+'")';
            }else{
                sqlVal += '('+argJson.shopId+',"'+argJson.idCardNum+'",'+orderId+',"'+operationState+'",'+new Date().getTime()+',"'+(operationState+'-'+orderId)+'"),';
            }
        }
        sql = sql + sqlVal;
        conn.query(sql,fn);
    }catch (e){
        console.log(e);
    }

};

exports.findBarCodeByUserIdDate = function(arg, fn){
    var sql = 'select * from BarCode where shopId='+arg.shopId+' and operationStatus="'+arg.os+'" and timeStamp<='+arg.end+' and timeStamp>='+arg.start +' order by timeStamp desc';
    conn.query(sql, fn);
};

exports.findAllRecord = function(arg, fn){
    var arr = [];
    arg.forEach(function(ele,i){
        if(ele){
            arr.push('"'+ele+'"');
        }
    });
    var sql = 'select barcode from BarCode where barcode in ('+arr.join(',')+')';
    conn.query(sql, fn);
};

//插入渠道信息
exports.insertChannel = function(channel, timeStamp, fn){
    var time = new Date(timeStamp).format( 'yyyy-mm-dd HH:MM:ss' );
    conn.query('insert into Channel set qId=?,mark=?,shopId=?,timeStamp=?', [channel.qId, channel.mark, channel.shopId, time], fn);
};
//验证渠道ID
exports.queryIdFromChannel = function(id, fn){
    conn.query('select qId from Channel where qId=?', [id], fn);
};
//最新渠道ID
exports.queryLastChannelId = function(fn){
    conn.query('select qId from Channel order by timeStamp desc limit 1', fn);
};
//根据渠道ID得到shopId
exports.getShopIdByQid = function(qId, fn){
    conn.query('select shopId from Channel where qId = ?', [qId], fn);
};
//查询所有渠道信息
exports.queryChannelInfo = function(fn){
    conn.query('select Channel.qId,Channel.mark,Channel.shopId,Channel.timeStamp,count(User.id) as count from Channel left join User on Channel.qId = User.qId group by qId order by Channel.timeStamp desc', fn);
};
//删除渠道信息
exports.delChannelInfoByQid = function(qId, fn){
    conn.query('delete from Channel where qId=?', [qId], fn);
};

exports.insertBadGoodsRegistration = function(shopId, arg, fn){
    var sql = 'insert into BadGoodsRegistration(shopId,code,num,timeStamp) values';
    var sqlVal = '';
    for(var i = 0, len = arg.length; i < len; i++){
        if(i==(len-1)){
            sqlVal += '('+shopId+',"'+arg[i].code+'",'+arg[i].num+','+new Date().getTime()+')';
        }else{
            sqlVal += '('+shopId+',"'+arg[i].code+'",'+arg[i].num+','+new Date().getTime()+'),';
        }
    }
    sql = sql + sqlVal;
    conn.query(sql,fn);
}
// add by@lufeng
exports.findBadGoodsByDate = function(argJson,fn) {
    try {
        conn.query('select settingValue as wId from Setting where shopId=? and settingKey="curWarehouseId"', [argJson.shopId], function (err, rows) {
            if (err) {
                console.log(e);
                fn(err, []);
                return;
            } else {
                var sql = 'select BadGoodsRegistration.code, BadGoodsRegistration.num,t.price,t.code,t.cost,t.title from BadGoodsRegistration left join (select Store.code,Product.price,Product.cost,Product.title from Store left join Product on Store.pId=Product.id where Store.wId=' + rows[0].wId + ')  as t on (t.code=BadGoodsRegistration.code) where BadGoodsRegistration.shopId=' + argJson.shopId + ' and BadGoodsRegistration.timeSTamp>=' + argJson.startDate + ' and BadGoodsRegistration.timeStamp<=' + argJson.endDate;
                conn.query(sql, fn);
            }
        });
    } catch (e) {
        console.log(e);
        fn(e, []);
    }
}

exports.getAllBadGoods = function(argJson,fn){
    try {
        conn.query('select settingValue as wId from Setting where shopId=? and settingKey="curWarehouseId"', [argJson.shopId], function (err, rows) {
            if (err) {
                console.log(e);
                fn(err, []);
                return;
            } else {
                var sql = 'select BadGoodsRegistration.id,BadGoodsRegistration.code, BadGoodsRegistration.num,t.price,t.code,t.cost,t.title from BadGoodsRegistration left join (select Store.code,Product.price,Product.cost,Product.title from Store left join Product on Store.pId=Product.id where Store.wId=' + rows[0].wId + ')  as t on (t.code=BadGoodsRegistration.code) where BadGoodsRegistration.shopId=' + argJson.shopId + ' and BadGoodsRegistration.timeSTamp>=' + argJson.time_stamp_start + ' and BadGoodsRegistration.timeStamp<=' + argJson.time_stamp_end;
                conn.query(sql, fn);
            }
        });
    } catch (e) {
        console.log(e);
        fn(e, []);
    }
};
exports.delBadGoodById = function(id,fn){
    conn.query('delete from BadGoodsRegistration where id=?', [id], fn);
};

exports.getOrderedNum = function(userId, shopId, timeStamp, fn){
    var sql = 'select userId,count(id) as orderNum from UserOrder where userId in ('+userId.join(',')+') and snapshot is not null and orderStatus!=3 and shopId = '+shopId+' and timeStamp <= '+timeStamp+' group by userId';
    conn.query(sql, fn);
};

exports.AllNewUsersPay = function(shopId,timeOne,timeTwo,newUserIds,fn) {
    var sql = 'select userId, snapshot from UserOrder where shopId='+shopId+' and timeStamp>='+timeOne+' and timeStamp<='+timeTwo+' and userId in ('+newUserIds.join(',')+') and orderStatus!=3 and snapshot is not null';
    conn.query(sql,fn);
}
//根据产品编码得到产品
exports.getProTitleByCode = function(obj, fn){
    conn.query('select * from Product where code = ? and shopId = ?', [obj.proCode, obj.shopId], fn);
};

exports.getCloseTime = function(shopId, fn){
    var sql = 'select settingValue from Setting where settingKey = ? and shopId = '+shopId+'';
    conn.query(sql, ['closeTime'], fn);
};

exports.getSignDraws = function(timeStamp1, timeStamp2, fn){
    var time_start = new Date(timeStamp1).format( 'yyyy-mm-dd HH:MM:ss' );
    var time_end = new Date(timeStamp2).format( 'yyyy-mm-dd HH:MM:ss' );
    var sql = 'select content,timeStamp from SystemMonitor where timeStamp>=? and timeStamp<=? and type=? order by timeStamp desc';
    conn.query(sql, [time_start, time_end, 'tool_rp'], fn);
};
//app更新用户头像
exports.updateUserHead = function(filename,user_id,fn){
    conn.query('update User set head = ? where id =?',[filename,user_id],function(err,ret){
        if(fn) fn(err,ret);
    });
};
exports.clearProDataByShopId = function(shopId, fn){
    var sql = 'delete from Product where shopId = ?';
    conn.query(sql, [shopId], fn);
};
exports.updateNickById = function(obj, fn){
    var sql = 'update User set nick = ? where id = ?';
    conn.query(sql, [obj.userNick, obj.userId], fn);
};
exports.countByqId = function(obj, fn){
    var sql = 'select count(qId) as count from User where qId = ?';
    conn.query(sql, [obj.qId], fn);
};

exports.instertClickAppLink = function(obj, fn) {
    conn.query('insert into appLog(version,type,timeStamp,extra) values(?,?,?,?)', [obj.v, obj.type, new Date().getTime(),obj.from], fn);
};
exports.getCountByTimeStamp = function(obj, fn){
    var sql = 'select qId,count(id) as count from User where timeStamp>=? and timeStamp<=? and qId = ?';
    conn.query(sql, [obj.start, obj.end, obj.qId], fn);
};
exports.getRangUser = function(start, end, shopId, fn){
    var sql = 'select UserOrder.id,UserOrder.userId,UserOrder.addressId as addressId,UserOrder.timeStamp,UserOrder.productIds,UserOrder.orderStatus,UserOrder.snapshot,AddressBook.name,AddressBook.mobile,AddressBook.shortTel,AddressBook.address from UserOrder left join AddressBook on UserOrder.addressId=AddressBook.id where UserOrder.snapshot is not null and addressId>0 and UserOrder.timeStamp>='+start+' and UserOrder.timeStamp<='+end+' and UserOrder.shopId='+shopId+' and UserOrder.orderStatus!=3 group by userId order by UserOrder.timeStamp desc';
    conn.query(sql, fn);
};
exports.getOrderByIdArr = function(transObj, fn){
    var sql = 'select UserOrder.id,UserOrder.userId,UserOrder.addressId as addressId,UserOrder.timeStamp,UserOrder.productIds,UserOrder.orderStatus,UserOrder.snapshot,AddressBook.name,AddressBook.mobile,AddressBook.shortTel,AddressBook.address from UserOrder left join AddressBook on UserOrder.addressId=AddressBook.id where UserOrder.snapshot is not null and addressId>0 and UserOrder.timeStamp>='+transObj.start+' and UserOrder.timeStamp<='+transObj.end+' and UserOrder.shopId='+transObj.shopId+' and UserOrder.orderStatus!=3 and UserOrder.userId in ('+transObj.ids.join(',')+') group by userId order by UserOrder.timeStamp desc';
    conn.query(sql, fn);
};   
exports.getProCount = function(obj, fn){
    var sql = 'select count from Store where code = '+obj.pcode+' and wId = '+obj.wid+'';
    conn.query(sql, fn);
};
exports.updateProCount = function(obj, fn){
    var sql = 'update Store set count = '+obj.count+' where code = '+obj.pcode+' and wId = '+obj.wid+'';
    conn.query(sql, fn);
};
exports.getAllAttentionNum = function(obj, fn){
    var sql = 'select  count(*) as allAttentionNum from User where qId = '+obj.qId+'';
    conn.query(sql, fn);
};
exports.getValidAttentionNum = function(obj, fn){
    var sql = 'select  count(*) as validAttentionNum from User where qId = '+obj.qId+' and status = "1"';
    conn.query(sql, fn);
};
exports.getCancelAttentionNum = function(obj, fn){
    var sql = 'select  count(*) as cancelAttentionNum from User where qId = '+obj.qId+' and status = "0"';
    conn.query(sql, fn);
};
exports.queryVisitStoreTime = function( obj, fn){
    var sql = 'select userId,shopId,startTimeStamp,transTime from VisitStoreTime where shopId = ? and startTimeStamp>=? and startTimeStamp<=? order by startTimeStamp desc';
    conn.query(sql, [obj.shopId, obj.start, obj.end], fn);
};
exports.weChatPayByOrderId = function(order_id, fn){
    var sql = 'select snapshot from UserOrder where id='+order_id + ' order by timeStamp desc limit 1';
    conn.query(sql, fn);
};

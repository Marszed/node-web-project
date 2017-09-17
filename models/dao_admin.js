var conf = require('../conf'),
	uutil = require('../lib/util'),
	conn = conf.getConnection();  //打开数据库链接
//--------------------------- 日志配置 ---------------------------//
var li = uutil.getLogger('INFO', 'dao_admin.js');
var ld = uutil.getLogger('DEBUG', 'dao_admin.js');

var makeUpdateFieldAndValues = function(obj){
	var fields = [];
	var values = [];
	for(var p in obj){
		if( obj.hasOwnProperty(p) && p!='id' ){
			fields.push(p+'=?');
			values.push(obj[p]);
		}
	}
	return {
		fields : fields,
		values : values	   
	};
};


exports.listUserComments = function (user_id, fn) {
    conn.query('select id,content,userId,authorName,timeStamp from UserComment where userId=? order by timeStamp desc',[ user_id ], fn);
};
exports.listUsersComments = function (user_ids, fn) {
    var q = conn.query('select id,content,userId,authorName,timeStamp from UserComment where userId in ('+ user_ids.join() +') order by timeStamp desc', function (err, ret) {
        fn(err, ret);
    });
};
exports.insertComment = function (comment, fn) {
    conn.query('insert into UserComment set content=?,authorName=?,userId=?',[ comment.content, comment.author_name, comment.target_user_id], fn);
};
exports.delUserComment = function (comment_id, fn) {
    conn.query('delete from UserComment where id=?',[ comment_id ], fn);
};


//根据shop_id获取进货列表
exports.getWarningList = function(shop_id, pids, fn){
    /*conn.query('select Product.id as pId,Warehouse.id as wId,title,img,imgQN,count,warningCount from Warehouse left join Store on Warehouse.id=Store.wId left join Product on Store.pId=Product.id where Warehouse.shopId=? and Store.onSelling=? and count<=warningCount', [shop_id, 1], function(err, ret){
        fn && fn(err, ret);
    });*/
    var ids = uutil.sureAry(pids);
    conn.query('select title,img,count,warningCount from Product left join Store on Store.pId = Product.id left join Warehouse on Warehouse.id=Store.wId where Product.id in ('+ids.join(',')+') and Store.onSelling=? and count<=warningCount order by count asc', [1], function(err, ret){
        fn && fn(err, ret);
    });
};

//获取推广情况的相关信息
exports.getPromotionList = function(promotion, fn){
    console.log(promotion);
    conn.query('select fromUserId,content from Msg where timeStamp>? and timeStamp<? and content=? group by fromUserId', [promotion.start_time, promotion.end_time, promotion.word], function(err, ret_msg){
        if( err ) console.log(err);
        var ids = [];
        ret_msg.forEach(function(v, i){
            var id = v.fromUserId.replace('u_', '');
            if(id && id != 'undefined' ) ids.push(id);
        });
        if( ids.length == 0 ){
            fn(null, [], ids);
            return;
        }

        conn.query('select userId,addressId,Orders.timeStamp,snapshot,nick from (select userId,addressId,timeStamp,snapshot from UserOrder where timeStamp>? and timeStamp<? and shopId=? and userId>6000 and addressId is not null and userId in ('+ ids.join(',') +') group by userId) as Orders left join User on Orders.userId=User.id where User.timeStamp>? and User.timeStamp<?', [promotion.start_int, promotion.end_int, promotion.shop_id, promotion.start_int, promotion.end_int], function(err, ret){
            conn.query('select id from User where id in ('+ ids.join(',') +') and shopId=? and User.timeStamp>? and User.timeStamp<?', [promotion.shop_id, promotion.start_int, promotion.end_int], function(err_follow, ret_follow){
                var f_ids = [];
                if( err_follow ){
                    console.log(err_follow);
                }
                ret_follow.forEach(function(v, i){
                    f_ids.push(v.id);
                });
                fn && fn(err, ret, f_ids);
            });
        });
    });
};

//根据shop_id获取“预计送达”的公告
exports.getPossibleReach = function(shop_id, fn){
    conn.query('select id,content,timeStamp,shopId,isShow from PossibleReach where shopId=?', [shop_id], fn);
};

//写入或更新“预计送达”的公告
exports.updatePossibleReach = function(possibleReach, fn){
    var fields = [];
	var values = [],
        updates = [],
        r_d = /^\d+$/,
        query = '';
	for(var p in possibleReach){
		if( possibleReach.hasOwnProperty(p) ){
			fields.push(p);
            var val = possibleReach[p];
            val =  val && !r_d.test(val) ? '"'+ val +'"' : val;
            updates.push(p+'='+val);
			values.push(val);
		}
	}
    query = 'insert into PossibleReach ('+ fields.join(',') +') values ('+ values.join(',') +') on duplicate key update ' + updates;
    console.log(query);
    conn.query(query, [possibleReach.content], fn);
};

//获取管理员列表，即power>0的用户
exports.getMembers = function(fn){
    conn.query('select id,nick,power,head,shopId,bindTo,sectionId from User where power>? order by power desc', [0], fn);
};

//更新订单备注
exports.updateSnapshot = function(order_id, snapshot, fn){
    conn.query('update UserOrder set snapshot=? where id=?', [snapshot, order_id], fn);
};

//根据shopId获取该店所有section信息
exports.getSectionsByShopId = function(shopId, fn){
    conn.query('select * from Section where shopId=?', [shopId], fn);
};

//删除指定店铺的货架
exports.delSectionsByShopId = function(shopId, fn){
   conn.query('delete from Section where shopId=?', [shopId], fn);
};

//将section信息拷贝到shopId对应的店
exports.insertSectionInfo = function(section, shopId, fn){
    var keys = [],
        values = [],
        sql = '';
    for(var p in section){
        if( section.hasOwnProperty(p) && p != 'id' ){
            if( typeof section[p] == 'string' ){
                section[p] = '\'' + section[p] + '\'';
            }
            keys.push( p );
            values.push( p == 'shopId' ? shopId : section[p] );
        }
    }
    sql = 'insert into Section ('+ keys.join(',') +') values ('+ values.join(',') +')';
    conn.query(sql, fn);
};

//根据shopId查询该店铺的关联配置
exports.getShopRelation = function(shopId, fn){
    conn.query('select relation,shopType from Shop where id=?', [shopId], fn);
};
//根据shop_id更新其对应店铺的关联配置
exports.updateShopRelation = function(info, fn){
    conn.query('update Shop set relation=?,shopType=? where id=?', [info.value, info.type, info.shop_id], fn);
};

//根据shopId获取它所有的仓库信息
exports.getWarehouseByShopId = function(shopId, fn){
    conn.query('select id,name,shopId,timeStamp from Warehouse where shopId=?', [shopId], fn);
};

//获取所有店的货架信息
exports.getAllSections = function(fn){
    conn.query('select id,name,shopId from Section order by shopId', fn);
};
//根据时间区间得到某店用户id
exports.getUserByTimeRange = function(start, end, shopId, fn){
    var sql = 'select UserOrder.id,UserOrder.userId,UserOrder.addressId as addressId,UserOrder.timeStamp,UserOrder.productIds,UserOrder.orderStatus,UserOrder.snapshot,AddressBook.name,AddressBook.mobile,AddressBook.shortTel,AddressBook.address from UserOrder left join AddressBook on UserOrder.addressId=AddressBook.id where UserOrder.snapshot is not null and addressId>0 and UserOrder.timeStamp>='+start+' and UserOrder.timeStamp<='+end+' and UserOrder.shopId='+shopId+' and UserOrder.orderStatus!=3 group by userId order by UserOrder.timeStamp desc';
    conn.query(sql, fn);
};
//根据时间区间得到某店某用户的订单
exports.getOrderByTimeRange = function(start, end, shopId, userIds, fn){

    var sql = 'select userId, snapshot from UserOrder where shopId='+shopId+' and timeStamp>='+start+' and timeStamp<='+end+' and userId in ('+userIds.join(',')+') and orderStatus!=3 and snapshot is not null';
    conn.query(sql, fn);
};
exports.getIdByTwoTime = function(shop_id, time_stamp_start, time_stamp_end, fn){
    var time_start = new Date(time_stamp_start).format( 'yyyy-mm-dd HH:MM:ss' );
    var time_end = new Date(time_stamp_end).format( 'yyyy-mm-dd HH:MM:ss' );
//大于2015-1-29 0时0分0秒就插入到新记录到店数表NewLog
    if(time_stamp_start>=1422460800000){
        conn.query('select distinct(lValue) from NewLog where timeStamp >= ? and timeStamp <= ? and shopId = ? and lKey = "enter_store"',[time_start, time_end, shop_id], fn);
    }else{
        conn.query('select distinct(lValue) from Log where timeStamp >= ? and timeStamp <= ? and shopId = ? and lKey = "enter_store"',[time_start, time_end, shop_id], fn);
    }
};
exports.getPowerByUserId = function(oldIds, shop_id, fn){
    if(oldIds && oldIds.length != 0) {
        conn.query('select id,power from User where id in ('+oldIds.join(',')+') ', fn);
    }
};
exports.getAppPowerByUserId = function(oldIds, shop_id, fn){
    if(oldIds && oldIds.length != 0) {
        conn.query('select id,power from User where id in ('+oldIds.join(',')+')', fn);
    }

};
exports.insertToolRPSystem = function(content, timeStamp, type, fn){
    var sql = 'insert into SystemMonitor set content=?,timeStamp=?,type=?';
    conn.query(sql, [content, timeStamp, type], fn);
};
//根据店号得到所有货架上的产品ID
exports.getProIdByShopId = function(shopId, fn){
    var sql = 'select id,name,content from Section where shopId =?';
    conn.query(sql, [shopId], fn);
};
//根据店号得到营业时间
exports.getBusinessTimeByshopId = function(shopId, fn){
    var sql = 'select settingValue from Setting where settingKey = ? and shopId = '+shopId+'';
    conn.query(sql, ['closeTime'], fn);
};
exports.getAppUserIds = function(shop_id, time_stamp_start, time_stamp_end, fn){
    var time_start = new Date(time_stamp_start).format( 'yyyy-mm-dd HH:MM:ss' );
    var time_end = new Date(time_stamp_end).format( 'yyyy-mm-dd HH:MM:ss' );

    if(time_stamp_start>=1422460800000){
        conn.query('select distinct(lValue) from NewLog where timeStamp >= ? and timeStamp <= ? and shopId = ? and lKey = "enter_store" and lValue like "%___haoduojieatpyh"',[time_start, time_end, shop_id], fn);
    }else{
        conn.query('select distinct(lValue) from Log where timeStamp >= ? and timeStamp <= ? and shopId = ? and lKey = "enter_store" and lValue like "%___haoduojieatpyh"',[time_start, time_end, shop_id], fn);
    }
};
exports.getOrderByIdArr = function(transObj, fn){
    var sql = 'select UserOrder.id,UserOrder.userId,UserOrder.addressId as addressId,UserOrder.timeStamp,UserOrder.productIds,UserOrder.orderStatus,UserOrder.snapshot,AddressBook.name,AddressBook.mobile,AddressBook.shortTel,AddressBook.address from UserOrder left join AddressBook on UserOrder.addressId=AddressBook.id where UserOrder.snapshot is not null and addressId>0 and UserOrder.timeStamp>='+transObj.start+' and UserOrder.timeStamp<='+transObj.end+' and UserOrder.shopId='+transObj.shopId+' and UserOrder.orderStatus!=3 and UserOrder.userId in ('+transObj.ids.join(',')+') order by UserOrder.timeStamp desc';
    conn.query(sql, fn);
};
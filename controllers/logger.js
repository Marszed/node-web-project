var conf = require('../conf'),
	conn = conf.getConnection();  //打开数据库链接

exports.log = function(key, value, shop_id, fn){
	if(typeof shop_id == 'function'){
		fn = shop_id;	
		shop_id = 0;
	}
    conn.query('insert into Log set lKey=?,lValue=?,shopId=?', [key, value, shop_id], function(err, ret){
        if(fn) fn( err, ret );
    });
};

exports.logNew = function(key, value, shop_id, str, userId, fn){
    if(typeof shop_id == 'function'){
        fn = shop_id;
        shop_id = 0;
    }
    conn.query('insert into NewLog set lKey=?,lValue=?,shopId=?,str=?,userId=?', [key, value, shop_id, str, userId], function(err, ret){
        if(fn) fn( err, ret );
    });
};

exports.visitStore = function(obj, fn){
    conn.query('insert into VisitStoreTime set userId=?,startTimeStamp=?,endTimeStamp=?,shopId=?', [obj.userId, obj.startTimeStamp, obj.endTimeStamp, obj.shopId], fn);
};
exports.updateVisitStore = function(obj, fn){
    conn.query('update VisitStoreTime set ajaxTimeStamp=?,transTime=? where id = ?', [obj.startStamp, obj.transTime, obj.maxId], fn);
};
exports.getMaxId = function(obj, fn){
    conn.query('select * from VisitStoreTime where userId = ? order by startTimeStamp desc limit 1', [obj.userId], fn);
};
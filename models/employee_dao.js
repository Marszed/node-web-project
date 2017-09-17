var conf = require('../conf'),
    uutil = require('../lib/util');
    conn = conf.getConnection();

exports.register = function( obj, fn ){
    var sql = 'insert into UserInfo set userId=?,sex=?,name=?,tel=?,email=?,shopId=?,timeStamp=?';
    conn.query(sql, [obj.infos.userId, obj.infos.sex, obj.infos.name, obj.infos.tel, obj.infos.email,obj.infos.shop, obj.timeStamp], fn);
};
exports.getShop = function( obj, fn ){
    var sql = 'select * from Shop where id not in ('+obj.shopIds.join(',')+') and name != "" order by type asc';
    conn.query(sql, fn);
};
exports.getMaxId = function(fn){
    var sql = 'select max(id) as maxId from UserInfo';
    conn.query(sql, fn);
};
exports.updateJobTime = function(obj, fn){
    var sql = 'update UserInfo set jobtime=? where id =?';
    conn.query(sql, [obj.jobtime, obj.maxId], fn);
};
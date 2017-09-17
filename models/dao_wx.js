var conf = require('../conf'),
	uutil = require('../lib/util'),
	conn = conf.getConnection();  //打开数据库链接
//--------------------------- 日志配置 ---------------------------//
var li = uutil.getLogger('INFO', 'dao_wx.js');
var ld = uutil.getLogger('DEBUG', 'dao_wx.js');


exports.markUnsubscrib = function(user, fn){
    conn.query('update User set status=?,shopId=?,originShopId=? where id=?', [0, 0, user.shopId, user.id], fn);
};
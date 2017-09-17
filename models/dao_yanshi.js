var conf = require('../conf'),
    fs = require('fs'),
    conn = conf.getConnection(), //获取数据库链接
	pool = conf.getPool(); //获取连接池的实例

exports.getMsgByTime = function(data, fn){
    conn.query('select fromUserId,content from Msg where timeStamp>? and timeStamp<? and content=? group by fromUserId', [data.start, data.end, '7'], fn);
};

exports.getUserByIds = function(data, fn){
    //conn.query('select id,shopId from User where timeStamp>? and timeStamp<? and id in (?) and shopId in (2,3)', [data.start_int, data.end_int, data.ids], fn);
    conn.query('select id,shopId from User where id in (?) and shopId in (2,3)', [data.ids], fn);
};
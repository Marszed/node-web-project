var conf = require('../conf'),
    fs = require('fs'),
    conn = conf.getConnection(), //获取数据库链接
	pool = conf.getPool(); //获取连接池的实例

exports.delArticleById = function(id, fn){
    conn.query('delete from Article where id=?', [id], fn);
};

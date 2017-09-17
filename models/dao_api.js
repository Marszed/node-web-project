var conf = require('../conf'),
    fs = require('fs'),
    conn = conf.getConnection(), //获取数据库链接
	pool = conf.getPool(); //获取连接池的实例

exports.setUserRecord = function(data, fn){
    conn.query('insert into Analysis set userId=?,timeStamp=?,content=?,position=?', [data.userId, data.timeStamp, data.content, data.position], fn);
};

exports.savePlan = function( data, fn ){
    conn.query('insert into Plans set userId=?,title=?,startTime=?,endTime=?,color=?', [data.userId, data.title, data.start, data.end, data.color], fn);
};
exports.getPlans = function( data, fn ){
    conn.query('select id,userId,title,startTime,endTime,color from Plans where startTime>=? and endTime<=?', [data.start, data.end], fn);
};
exports.updatePlan = function( data, fn ){
    conn.query(data.sql, data.values, fn);
};
exports.delPlan = function( data, fn ){
    conn.query('delete from Plans where id=?', [data.id], fn);
};
exports.updatePlanColor = function( data, fn ){
    conn.query('update Plans set color=? where userId=?', [data.color, data.userId], fn);
};
var conf = require('../conf'),
    fs = require('fs'),
    conn = conf.getConnection(), //获取数据库链接
	pool = conf.getPool(); //获取连接池的实例

exports.getGuessInfoById = function(id, fn){
    conn.query('select id,userId,timeStamp,randomNum,requestTimes,status from GuessInfo where userId=?', [id], fn);
};

exports.insertGuessInfo = function(info, fn){
    conn.query('insert into GuessInfo set userId=?,timeStamp=?,randomNum=?,requestTimes=? on duplicate key update userId=?,timeStamp=?,randomNum=?,requestTimes=?,status=?', [info.userId, info.timeStamp, info.randomNum, info.requestTimes, info.userId, info.timeStamp, info.randomNum, info.requestTimes, info.status], fn);
};

exports.countGuessInfo = function(info, fn){
    conn.query('insert into CountGuess set userId=?,timeStamp=?,randomNum=?,requestTimes=?', [info.userId, info.timeStamp, info.randomNum, info.requestTimes], fn);
};

exports.getRpByWxId = function(wx_id, fn){
    conn.query('select val as RP,UserRP.userId,openId from UserRP left join Open on UserRP.userId=Open.userId where openId=?', [wx_id], fn);
};

exports.reduceRP = function(data, fn){
    conn.query('update UserRP set val=val-? where userId in (select userId from Open where openId=?)', [data.rp, data.wx_id], fn);
};

exports.giveHeAChance = function(wx_id, timeStamp, fn){
    conn.query('update GuessInfo set timeStamp=? where userId in (select userId from Open where openId=?)', [timeStamp, wx_id], fn);
};

exports.award = function(rp, userId, fn){
    console.log('userId='+userId+'的用户获得 '+ rp + ' 个人品');
    conn.query('update UserRP set val=val+? where userId=?', [rp, userId], fn);
};

exports.countGuessVisit = function(data, fn){
    conn.query('insert into CountGuessVisit set userId=?,timeStamp=?', [data.user_id, data.timeStamp], fn);
};

exports.isHeHasGirlfriend = function(data, fn){
    console.log( data );
    conn.query('select id,tId,userId,timeStamp,isAvailable from UserTool where userId=? and tId=?', [data.user_id, data.tId], fn);
};
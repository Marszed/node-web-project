var fs = require('fs'),
    conf = require('../conf'),
    conn = conf.getConnection();
var asyncMgr = require('../lib/asyncMgr');

var logs = fs.readFileSync('./promotion.log', {encoding:'utf8'}),
    wx_ids = [],
    marker = {},
    wx_id_marker = {},
    open = {};

//logs = logs.replace(/\s+/mg, '');

logs.split('\n').forEach(function(line, i){
    var str = line.replace(/^[^\{]*:\s/g, '');
    str = str.replace(/\s+/mg, '');
    try{
        var obj = JSON.parse(str);
        if( marker[obj.content] == undefined ){
            marker[obj.content] = {follows:0, wx_ids:[]};
        }
        if( !wx_id_marker[obj.fromUserName] ){
            marker[obj.content].wx_ids.push('"' + obj.fromUserName + '"');
            wx_id_marker[obj.fromUserName] = obj.content;
        }
        marker[obj.content].follows++;
    }catch(e){
        console.log(str);
    }
});


console.log('下单情况：');
for(var p in marker){
    var wx = marker[p];
    var ids = wx.wx_ids;

  (function(p){
    conn.query('select userId,openId from Open where openId in ('+ ids.join(',') +') and timeStamp>1415548800000', function(err, ret){
        var userIds = [];
        if( !err ){
		    ret = ret || [];
		    ret.forEach(function(user, i_u){
			if( user.userId ) userIds.push(user.userId);
			open[user.userId] = user.shopId;
		    });
		    if( !userIds.length ) userIds.push(0);
		    console.log('p='+p);
		    console.log('sql=' + 'select count(*) as num from UserOrder where userId in('+ userIds.join(',') +') and shopId=1 and snapshot is not null  group by userId');
		    conn.query('select count(*) as num from UserOrder where userId in('+ userIds.join(',') +') and shopId=1 and snapshot is not null  group by userId', function(err_count, ret_count){
		        console.log('p='+p+', 订单数为:' + ret_count.length);
			console.log(ret_count);
		    });
		    return;
        }
        console.log(err);
    });

  })(p);


}

setTimeout(function(){
    console.log('关注情况：');
    for(var p in marker){
        delete  marker[p].wx_ids;
    }
    console.log(marker);
}, 1000);


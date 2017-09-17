var tokener = require('./weixin_token');
var request = require('request');

/*
* 111 : 1号店
* 112 ：2号店
* 113 ：3号店
* 115 ：5号店
* */

var content = '圣诞节来了，圣诞老人缺席没关系，大师兄陪你玩......\n\n①关注【呼叫大师兄】\n\n②回复“搞”字\n\n③选一份礼物送给TA \n\n完全免费哟~（24号统一派发礼物）';

//var group_id = 111;
var group_id = 111;

tokener.accessToken(function (err, obj) {
    request({
        url : 'https://api.weixin.qq.com/cgi-bin/message/mass/sendall?access_token='+obj.access_token,
        method : 'POST',
        body : JSON.stringify({
            "filter":{
               //"group_id":"100"
               "group_id" : group_id
            },
            "text":{
               "content" : content 
            },
             "msgtype":"text"
        })
    }, function (err, response, body) {
        var obj = JSON.parse( body );
        if( obj.errcode ){
            console.log( '~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~操作失败' );
        }
        console.log( body );
        console.log( '==============================================================');
    });


    
});

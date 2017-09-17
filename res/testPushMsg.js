var request = require('request');
var tokener = require('./weixin_token');


tokener.accessToken_hjdsx(function (err, obj) {
    request({
        url : 'https://api.weixin.qq.com/cgi-bin/message/mass/send?access_token=' + obj.access_token,
        method : 'POST',
        body : JSON.stringify({
            "touser":[
                "ocB9as_ds8oUpwLCHsMXvcFm3_pk",
                "ocB9as7bYt7EOos6xdFpdKbjqc3k"
            ],
            "text":{
               "content" : "just for testing~"
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

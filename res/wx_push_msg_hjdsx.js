var tokener = require('./weixin_token');
var request = require('request');

/*
* 100 : 广药广中医(6)
* 101 ：惠经(1)
* 102 ：广外(9)

* 104 ：广工程东区(3)
* 111 ：广工程西区(2)

* 105 ：广工业东区(13)
* 112 ：广工业西区(15)

* 106 ：华师－学南(17)
* 113 ：华师－学北(18)
*
* 107 ：广大(20)
* 108 ：广美(21)
* 109 ：星海(19)
* 110 ：中山(22)
* 114 ：中山(25)
* 115 : 27号店(27)
* 116 : 28号店(28)
* 117 : 29号店，机电（29）
* 118 ： 30号店，工贸(30)
* 119 : 31号店（31）
* 120 : 32号店，农工商（32）
* 121 : 34号店
* */

var content = '四月时节雨纷纷，特价产品仅两蚊！！两元特卖货架隆重上线，手快有，手慢没呀！(偷偷告诉你，今天下单满15元的，送薯片一包哟~一般人我不告诉他的...)\n\n赶紧回复“大师兄”，进入首页抢购吧，思密达！';
var group_id = 101;

tokener.accessToken_hjdsx(function (err, obj) {
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

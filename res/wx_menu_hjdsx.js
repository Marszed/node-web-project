var request = require('request');
var wx_app_id = 'wx7b52fd89b4cf460f';
var wx_app_secret = '57d56fbe9fcd7d993464743fa2509867';


console.log('================ 正在创建菜单 =============');
request({
	url : 'https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid='+ wx_app_id +'&secret=' + wx_app_secret
}, function(err, res_obj, body){
	var obj = JSON.parse(body);
	var access_token = obj.access_token;
	
	console.log(access_token);
	//接下来进行菜单创建的操作
	request({
		url : 'https://api.weixin.qq.com/cgi-bin/menu/create?access_token='+access_token,
		method : 'POST',
		body : JSON.stringify({
			button : [
                {
                    type : 'click',
                    name : '呼叫大师兄',
                    key : 'key_restaurant'
                },
                {
                    name : '招聘',
                    type : 'click',
                    key : 'key_my_hire'
                },
                {
                    "name" : "更多",
                    "sub_button" :[
                        {
                            name : '订单查询',
                            type : 'click',
                            key : 'key_my_order'
                        },
                        {
                            "type":"view",
                            "name":"关于我们",
                            "url":"http://www.ksmimi.com/dashixiongwx/shop/1/article/646"
                        }
                    ]
                }
            ]
		})
	}, function(err2, res_obj2, body2){
	
		console.log(body2);
		console.log('=============== 操作完成! ============');
	});

});

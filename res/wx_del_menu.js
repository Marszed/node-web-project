var request = require('request');
var wx_app_id = 'wx4f17193b2f6626aa';
var wx_app_secret = 'fd48420c58c2f04f50f7e4364d2014de';


console.log('================ 正在删除你的菜单 =============');
request({
	url : 'https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid='+ wx_app_id +'&secret=' + wx_app_secret
}, function(err, res_obj, body){
	var obj = JSON.parse(body);
	var access_token = obj.access_token;
	
	console.log(access_token);

	request({
		url : 'https://api.weixin.qq.com/cgi-bin/menu/delete?access_token='+access_token
	}, function(err2, res_obj2, body2){
		console.log(body2);
		console.log('=============== 操作完成! ============');
	});

});

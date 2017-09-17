var request = require('request');
var wx_app_id = 'wx4f17193b2f6626aa';
var wx_app_secret = 'fd48420c58c2f04f50f7e4364d2014de';


console.log('================ 正在创建菜单 =============');
request({
	url : 'https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid='+ wx_app_id +'&secret=' + wx_app_secret,
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
				name : '进小卖部',
				key : 'key_store'
			},
            {
				name : '常用功能',
				sub_button : [
                {
				    name : '我的人品',
				    type : 'click',
				    key : 'key_rp'
                },
                {
				    name : '社区',
				    type : 'click',
				    key : 'key_community'
                },
                {
				    name : '发帖',
				    type : 'click',
				    key : 'key_community_post'
                },
                {
				    name : '订单查询',
				    type : 'click',
				    key : 'key_my_order'
                }]
			},
            {
				name : '其他',
				sub_button : [
                {
					type : 'click',
					name : '二维码',
					key : 'key_qr'	 
				},{
                    "type":"view",
                    "name":"海淘",
                    "url":"http://wd.koudai.com/?userid=211327887"
                },{
				   type : 'click',
				   name : '联系电话',
				   key : 'key_tel' 
				},{
				   type : 'click',
				   name : '投诉建议',
				   key : 'key_feed_back' 
				},{
				   type : 'click',
				   name : '招聘',
				   key : 'key_hr' 
				}]
			}]	
		})
	}, function(err2, res_obj2, body2){
		console.log(body2);
		console.log('=============== 操作完成! ============');
	});

});

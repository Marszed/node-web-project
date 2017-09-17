var request = require('request');
var conf = require('../conf');


exports.getQRURL = function( scene_id, fn ){
	console.log('================ 正在获取QR =============');
	request({
		url : 'https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid='+ conf.wxs['hjdsx'].wx_app_id +'&secret=' + conf.wxs['hjdsx'].wx_app_secret
	}, function(err, res_obj, body){
		var obj = JSON.parse(body);
		var access_token = obj.access_token;
		
		console.log('================ 先获取access_token =============');
		console.log(access_token);

		console.log('================ 接下来获取ticket ============');
		request({
			url : 'https://api.weixin.qq.com/cgi-bin/qrcode/create?access_token='+access_token,
			method : 'POST',
			body : JSON.stringify({
				'action_name' : 'QR_LIMIT_SCENE', 
				'action_info' : {
					'scene' : {
						'scene_id': scene_id
					}
				}
			})
		},function(err_ticket, res_obj_ticket, body_ticket){

			console.log('================ 接下来用ticket获取二维码 ============');
			console.log(err_ticket, body_ticket);
			var obj_ticket = JSON.parse(body_ticket);
			var ticket = obj_ticket.ticket;
			var qr_url = 'https://mp.weixin.qq.com/cgi-bin/showqrcode?ticket='+ticket;
			
			fn(null, qr_url);
				
		});
	});
};




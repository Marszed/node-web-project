var words = require('../res/words');
var uutil = require('../lib/util');

var weixin = require('weixin-api');//基础接口用这个来搞
var weixin_senior = require('wechat').API;//高级接口就用这个搞

var request = require('request');
var dashixiong = require('../controllers/dashixiong');

//var df = require( '../lib/date.format' );

//============================== 日志配置 ================================
var li = uutil.getLogger('INFO', 'weixin_service.js');
var ld = uutil.getLogger('DEBUG', 'weixin_service.js');

var pushNotify = uutil.pushNotify; 

var map = words.map;

var wx_token = 'haoduojieatpyh';
var app_id = 'wx4f17193b2f6626aa';
var app_secret = 'fd48420c58c2f04f50f7e4364d2014de';
weixin.token = wx_token;
//========================================================================


exports.route = function(app){

app.get('/dashixiongwx', function(req, res){
	if (weixin.checkSignature(req)) {
		res.end(req.query.echostr);
	} else {
		res.end('fail');
	}
});
app.post('/dashixiongwx', function(req, res){
	weixin.loop(req, res);
});

};//end exports.route




//--------------------------------------- 微信消息处理 -------------------------------------- //
var getAnswer = function(q, fn){
	var answ = map[q];
	if(!answ){//没有预设的答案，那就看看是不是离开状态，如果是就显示离开的留言. 如果连离开留言都没有, 那就只能是求上帝保佑人工能够尽快回复了
		dashixiong.getCurLeaveStatus(function(err, _status){
			if(_status){
				fn(null, _status.content);
				return;
			}
			fn(null, null);
		});
	}
	fn(null, map[q]);
};

var getEntranceResMsgBody = function(msg){
	var articles = [];
	var resMsg;		
	articles.push({
		title : '点击进入大师兄微信小卖部',
		description : '快点呀! ',
		picUrl : 'http://s.ksmimi.com/imgpro/post_order.png',
   		url : 'http://www.ksmimi.com/dashixiongwx/product/list/all?wx_id='+msg.fromUserName
	});

	resMsg = {
		fromUserName : msg.toUserName,
		toUserName : msg.fromUserName,
		msgType : "news",
		articles : articles,
		funcFlag : 0
	};
	return resMsg;

};
var getTakeawayListMsg = function(msg){
	var articles = [];
	var resMsg;		
	articles.push({
		title : '点击查看外卖单!',
		description : '快点呀! ',
		picUrl : 'http://s.ksmimi.com/dashixiong_static/img/takeaway_list.jpg',
   		url : 'http://www.ksmimi.com/dashixiongwx/takeaway/list?wx_id='+msg.fromUserName+'&ver=1#mp.weixin.qq.com'
	});

	resMsg = {
		fromUserName : msg.toUserName,
		toUserName : msg.fromUserName,
		msgType : "news",
		articles : articles,
		funcFlag : 0
	};
	return resMsg;

};

var getQrMsgRes = function(msg){
	var articles = [];
	var resMsg;		
	articles.push({
		title : '扫码二维码，分享大师兄',
		description : '或者搜索公众账号: 大师兄小卖部',
		picUrl : 'http://s.ksmimi.com/dashixiong_static/img/qr_post.jpg',
   		url : 'http://s.ksmimi.com/dashixiong_static/img/dashixiong_qr.jpg'
	});

	resMsg = {
		fromUserName : msg.toUserName,
		toUserName : msg.fromUserName,
		msgType : "news",
		articles : articles,
		funcFlag : 0
	};
	return resMsg;
};
weixin.textMsg(function(msg) {
	li.info('============== 收到微信消息 ============= ');
	li.info(msg);

	//默认情况下是文本消息作为回复
	var resMsg = {
			fromUserName : msg.toUserName, 
			toUserName : msg.fromUserName, 
			msgType : "text",
			funcFlag : 0 
		};

	var content = msg.content;
	content = content.toLowerCase();

	//看看用户发的是什么内容, 做不同的处理
	if(msg.content == 'dsx' || msg.content == '大师兄'){
		var articles = [];
		
		articles.push({
			title : '点击进入大师兄微信小卖部',
			description : '快点呀!',
			picUrl : 'http://s.ksmimi.com/imgpro/post_order.png',
       		url : 'http://www.ksmimi.com/dashixiongwx/product/list/all?wx_id='+msg.fromUserName
		});

		resMsg = {
			fromUserName : msg.toUserName,
			toUserName : msg.fromUserName,
			msgType : "news",
			articles : articles,
			funcFlag : 0
		};
	}else if(msg.content == '大师兄芝麻开门'){

		//resMsg.content = '点击进入<a href=\'http://www.ksmimi.com/dashixiongwx/product/list/all?ver=2&zhimakaimen=1&wx_id='+ msg.fromUserName +'\'>小卖部</a>';
		var articles = [];

		articles.push({
			title : '管理员进入大师兄微信小卖部',
			description : '快点呀!',
			picUrl : 'http://s.ksmimi.com/imgpro/post_order.png',
       		//url : 'http://www.ksmimi.com/dashixiongwx/product/list/all?ver=2&zhimakaimen=1&wx_id='+msg.fromUserName
       		url : 'http://www.ksmimi.com/dashixiongwx/index?zhimakaimen=1&wx_id='+msg.fromUserName
		});

		resMsg = {
			fromUserName : msg.toUserName,
			toUserName : msg.fromUserName,
			msgType : "news",
			articles : articles,
			funcFlag : 0
		};

	}else if(msg.content == '二维码' || msg.content== 'ewm' ){//索取二维码分享给朋友... 应该是吧, 不然他要我的二维码干嘛?
		resMsg = getQrMsgRes(msg);

	}else if(msg.content == '外卖单' || msg.content == '外卖' ){//显示外卖单
		resMsg = getTakeawayListMsg(msg);

	}else if(msg.content == '订单查询' || msg.content == '订单' || msg.content == '查询订单' || msg.content == 'dd' ){
		dashixiong.listValidOrdersByWxId(msg.fromUserName, function(err, orders){
			if(!err){
				resMsg.content = getOrderDetailInText(orders[0]);
				weixin.sendMsg(resMsg);
			}
		});
		return;	
	}else{//其他消息通过getAnswer过一遍数据库, 获得回答
		getAnswer(msg.content, function(err, answer){
			if(!answer){
				//邮件通知
				dashixiong.sendEmail({
					recieverEmail : 'auscar@qq.com',
					subject : '【大师兄】'+msg.content,
					messageContent : msg.content
				});
				pushNotify({
					title : '做客服',
					message : msg.content,
					type : 'message'
				});
				resMsg.content = '';//用空消息回复一下微信, 不然微信在收不到消息5秒后关闭通道, 然后重试几次
				weixin.sendMsg(resMsg);
				return;
			}
			resMsg = {
				fromUserName : msg.toUserName, 
				toUserName : msg.fromUserName, 
				msgType : "text",
				content : answer,
				funcFlag : 0 
			};

			weixin.sendMsg(resMsg);
		});
		return;	
	}
	weixin.sendMsg(resMsg);
});

var getOrderDetailInText = function(order){
	if(!order)return '你貌似还没有下过单咧~ 回复“大师兄”然后按照提示进入小卖部首页下单即可。';

	var txt = [
		'你最新一个订单如下:\n',
		'(当前状态:'+ order.statusText +')\n',
		'时间: ' + uutil.getTimeTxt(order.timeStamp) +'\n',
		'姓名: ' + order.name+'\n',
		'手机: ' + order.mobile+'\n',
		'地址: ' + order.address+'\n'

	];
	txt.push('\n');
	txt.push('共'+ order.total.total_pay.toFixed(1) +' 元 ----------\n');
	order.total.list.forEach(function(product_type, i){
		txt.push( (i+1)+' '+product_type.title+ ' x'+product_type.set.length+'\n' );
	});
	txt = txt.join('');
	li.info(txt);
	return txt;
};
weixin.eventMsg(function(msg){
	var resMsg = {
		fromUserName : msg.toUserName, 
		toUserName : msg.fromUserName, 
		msgType : "text",
		funcFlag : 0 
	};
	
	switch (msg.event){
		case 'subscribe' : {
			var wx_id = msg.fromUserName;
			li.info('=============== 有人关注了, 微信id是 '+ msg.fromUserName +' ==============');
			var shop_id = 1;//TODO: 分店id 通过带参数二维码获得
			if(msg.eventKey){
				var tmp = msg.eventKey.split('_');//扫描关注时的 eventKey 形如 qrscene_2
				if(tmp){
					shop_id = tmp[1];
				}
			}

			
			console.log('=========== 客户扫描的是'+ shop_id +'号店的二维码===========');
			//------------ 给这个微信用户注册一个账号 -----------//
			//先看看用户是不是已经注册过
			dashixiong.getUserByWxId(wx_id, function(err, ret){
				if(!err){
					var user = ret.length?ret[0]:null;
					if(!user){//没注册过, 那就给他注册一下
						console.log('===== 新用户, 自动给TA注册一个号 ~~~~~');
						dashixiong.newUser({shop_id : shop_id, qId : 0}, function(err, new_user_id){
							//获得新用户id之后, 绑定微信id, 然后跟注册过的是一个流程了
							dashixiong.bindUser(new_user_id, wx_id);//TODO: 绑定流程就不管他是不是成功了, 有空可以改进
						});
						return;//下面的代码为用户存在的情况, 故不需要再运行
					}

					//能运行到这里, 说明是一个用户取消关注之后又关注了
					console.log('===== 取消关注的用户再次关注~~~~~');
					//如果当前扫描的shop_id不是TA之前的id, 那就更新一下TA的shop_id, 给他换一间店
					if( user.shopId != shop_id ){
						li.info('===== 用户'+ user.id +'从'+ user.shopId +'店换到'+ shop_id +'店');
						dashixiong.updateUserShop( user.id, shop_id, function(err, ret){
							ld.debug(err);
							ld.debug(ret);
						});
					}
					return;//下面的代码不需要运行了
				}
				ld.debug(err);
			});
			

			//-------------- 给用户发送一个指引消息 --------------//
			var articles = [];
			
			articles.push({
				title : '点击进入大师兄微信小卖部',
				description : '快点呀!',
				picUrl : 'http://s.ksmimi.com/imgpro/post_order.png',
				url : 'http://www.ksmimi.com/dashixiongwx/product/list/all?wx_id='+msg.fromUserName
			});

			resMsg = {
				fromUserName : msg.toUserName,
				toUserName : msg.fromUserName,
				msgType : "news",
				articles : articles,
				funcFlag : 0
			};
			break;
		}
		case 'unsubscribe' : {
			li.info('=============== 有人取消了关注, 微信id是 '+ msg.fromUserName +' ================');
			resMsg.content = '很抱歉你取消了关注!';
			break;
		}
		case 'SCAN' : {
			console.log('老客户扫描二维码...eventKey==',msg.eventKey);
			resMsg.content = '';//回复空消息, 让微信服务器不要再重试
			return;
		}
		case 'CLICK' : {
			if(msg.eventKey == 'key_about'){
				resMsg.content = words.txts.about;	

			}else if(msg.eventKey == 'key_my_order'){//获取我当前的order的状态
				dashixiong.listValidOrdersByWxId(msg.fromUserName, function(err, orders){
					if(!err){
						resMsg.content = getOrderDetailInText(orders[0]);
						weixin.sendMsg(resMsg);
					}
				});
				return;

			}else if(msg.eventKey == 'key_takeaway'){
				resMsg = getTakeawayListMsg(msg);
			}else if(msg.eventKey == 'key_qr'){
				resMsg = getQrMsgRes(msg);
			}else if(msg.eventKey == 'key_tel'){
				resMsg.content = words.txts.tel;
			}
			else if(msg.eventKey == 'key_feed_back'){
				resMsg.content = words.txts.feed_back;	

			}else if(msg.eventKey == 'key_entrance'){
				resMsg = getEntranceResMsgBody(msg);//小卖部入口消息

			}else if(msg.eventKey == 'key_deliver_time'){
				resMsg.content = words.txts.deliver_time;	

			}else if(msg.eventKey == 'key_hr'){
				resMsg.content = words.txts.hr;	

			}else if(msg.eventKey == 'key_good'){
				resMsg.content = words.txts.good;	

			}
			break;			   
		}
		default : {
			return;
			//break;
		}
	}

	weixin.sendMsg(resMsg);

});

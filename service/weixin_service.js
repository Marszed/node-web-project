var conf = require( '../conf' );
var words = require('../res/words');
var uutil = require('../lib/util');
var asyncMgr = require('../lib/asyncMgr');
var fs = require('fs');

var weixin = require('weixin-api-dsx');//基础接口用这个来搞
var weixin_senior = require('wechat').API;//高级接口就用这个搞

var request = require('request');
var dashixiong = require('../controllers/dashixiong'),
    dsx_wx = require('../controllers/weixin'),
    weixin_token = require('../res/weixin_token'),
    accessToken = weixin_token.accessToken,
    accessToken_hjdsx = weixin_token.accessToken_hjdsx;

var sureObj = uutil.sureObj,
    sureAry = uutil.sureAry;

//var df = require( '../lib/date.format' );

//============================== 日志配置 ================================
var li = uutil.getLogger('INFO', 'weixin_service.js');
var ld = uutil.getLogger('DEBUG', 'weixin_service.js');


var map = words.map;//关键字的无逻辑自动回复

//============================= weixin 开发需要的信息(严禁泄露) =====================
var wx_token = conf.wx.wx_app_token;
var app_id = conf.wx_app_id;
var app_secret = conf.wx_app_secret;

weixin.token = wx_token;


//============================= 工具方法 ============================
var getOrderDetailInText = uutil.getOrderDetailInText; 
var getEntranceResMsgBody = uutil.getEntranceResMsgBody;
var getTakeawayListMsg = uutil.getTakeawayListMsg; 
var getQrMsgRes = uutil.getQrMsgRes; 
var end = uutil.end;
var render = uutil.render;

//修改一个weixin 对象的sendMsg 方法这样我们可以在所有发出去的消息后面添加我们公告
//var old_sendMsg = weixin.sendMsg;
//weixin.sendMsg = function (msg) {
//    dashixiong.getToReadNoticeForWxUser(msg.toUserName, function (err, notice_content) {
//        if( !notice_content ){
//            old_sendMsg.call( this, msg );
//            return;
//        }
//        switch(msg.msgType) {
//	    	case 'text' : 
//                var seperator = '\n\n==== 华丽的公告 ====\n';
//                msg.content += seperator + notice_content;
//	    		break;
//	    	case 'news' : 
//	    		break;
//	    }   
//        old_sendMsg.call( this, msg );
//    });
//    
//};

//============================= 接入微信开放平台需要的接口 ============
exports.route = function(app){

app.get('/dashixiongwx', function(req, res){
	if (weixin.checkSignature(req)) {
		res.end(req.query.echostr);
	} else {
		res.end('fail');
	}
});
app.post('/dashixiongwx', function(req, res){
    //TODO: 这里没有checkSignature 好像不太行哦
	weixin.loop(req, res);
});

app.get('/dashixiongwx/weixin/test', function(req, res){
    render( req, res, 'wx_msg_test', {
        layout : true
    });
});
app.post('/dashixiongwx/weixin/dotest', function(req, res){
    var msg = req.body.msg;

    msg.query = req.query;
    msg.res = res;

    //处理非事件类型，如text，image
    if( msg.msgType && /text|image/.test(msg.msgType) ){
        handle(msg);
        return;
    }

    //模拟微信各类事件，如subscrib, unsubscrib, click等
    if(msg.msgType){
        msg.event = msg.msgType;
        msg.toUserName = '0000000000000000000';
        exports.eventHandle(msg ,res);
    }
});

};//end exports.route

// =========================== 加载主要的关键字的处理逻辑 =================== //
var keyword_handlers = [];
var activity_dir = 'weixin_activity';


// ========================== 读取activity =================================//
//fs读取的文件的路径是相对于整个express应用的根; 而require的相对路径则是相对于模块自己
var ac_files = fs.readdirSync('./weixin_activity');
//var files = [];
//基础关键字处理器, 基础业务靠他们处理
var files = [
    'account.js',//获取用户账号信息
    'msg.js',//所有的消息都将被msg记录进入数据库
    'post.js',//发布模式
    'base.js',//基础关键字处理, 如大师兄, 外卖单, 社区等
    '{place_holder}',
    'auto_answer.js'//无逻辑的自动回复
];

//从ac_files 中去除掉基础处理器
var tmp = [];
ac_files.forEach(function (file_name) {
    if( !uutil.isObjInArray( file_name, files ) ){
        tmp.push( file_name ); //将非基础处理器push到tmp中
    }
});

files = files.join();
files = files.replace( '{place_holder}', tmp.join() );
files = files.split( ',' );

var path;
//到这里，整个流程变为：account.js -> msg.js -> post.js -> base.js -> 非基础处理器(tmp) -> auto_answer.js
files.forEach(function (filename, i) {
    path = activity_dir + '/' + filename;
    //确保是一个正常的文件
    if( !fs.statSync( path ).isFile() ){
        return; 
    }
    
    li.info( '正在加载微信活动 '+filename );
    tmp = require( '../'+path );
    if( tmp.constructor == Array ){
        keyword_handlers = keyword_handlers.concat( tmp );
        return;
    }
    keyword_handlers.push( tmp );
});
//====================================== 读取activity end ==========================//    

//处理用户关键字
var handle = function (msg) {
    var tmp_keywords;
    var tmp_keyword_handlers = [].concat( keyword_handlers );//每一次关键字的处理都复制一份handlers, 因为待会的操作会改变handlers数组
    var aa = new asyncMgr.AsyncOrder();
    tmp_keyword_handlers.forEach(function (handler, i) {
        aa.myTurn(function () {
            if( handler.constructor == Function ){
                handler( msg, weixin, function () {
                    aa.next();
                });
                return;
            }
            //运行到这里, 说明handler是一个形如{keywords:['keyword1','keyword2'], fn: function(){...}} 的对象
            var match_word = null;
            handler.keywords.forEach(function (keyword, i) {//拿备选关键字逐个比对
                if( msg.content == keyword ){
                    match_word = keyword;
                    handler.fn( msg, weixin, function () {
                        aa.next();
                    });
                    return false;//发现关键字匹配, 就不需要再看后面的关键字了, 跳出forEach
                }
            });
            if( !match_word ){
                aa.next(); 
            }
        });//end myTurn
    });//end tmp_keyword_handlers.forEach;
    aa.go();
};

//发送出去的消息我们要记录下来
//weixin.addEventListener( 'after_msg_send', function (msg, weixin) {
//    console.log( '==================msg send' );
//
//    var user = msg.user;
//    if( msg.msgType == 'text' ){
//        dashixiong.insertMsg({
//            fromUserId : 's_'+user.shopId,
//            toUserId : 'u_'+user.id,
//            content : msg.content,
//            msgType : msg.msgType
//        }); 
//        return;
//    }
//
//    if( msg.msgType == 'image' ){
//        dashixiong.insertMsg({
//            fromUserId : 's_'+user.shopId,
//            toUserId : 'u_'+user.id,
//            content : '[图片]',
//            msgType : msg.msgType,
//            ext : JSON.stringify({
//                picUrl : msg.picUrl 
//            })
//        }); 
//    }
//
//
//});



//---------------------------------- 消息处理 ---------------------------------- //
weixin.textMsg(function(msg) {
	li.info('============== 收到微信消息 ============= ');
	li.info(msg);

	//看看用户发的是什么内容, 做不同的处理
    handle( msg );
    
});
weixin.imageMsg(function(msg) {
	li.info('============== 收到图片消息 ============= ');
	li.info(msg);

	//看看用户发的是什么内容, 做不同的处理
    handle( msg );
    
});
weixin.voiceMsg(function(msg) {
	li.info('============== 收到语音消息 ============= ');
	li.info(msg);

	//看看用户发的是什么内容, 做不同的处理
    handle( msg );
    
});

//根据微信id获取nick，并更新到我们的数据库
var updateNickByWid = function( wId, userId ){
    accessToken_hjdsx(function ( err, obj ) {
        var access_token = obj.access_token;
        request({
            url : 'https://api.weixin.qq.com/cgi-bin/user/info?openid='+ wId +'&lang=zh_CN&access_token=ACCESS_TOKEN'+obj.access_token,
            method : 'get'
        }, function (err, response, body) {
            if(err){
                console.log(err);
                return;
            }
            var obj = JSON.parse( body),
                nick = obj.nickname;
            if(!nick){
                return;
            }
            console.log('^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^');
            li.info(body);
            console.log('^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^');
            dashixiong.updateUser({
                id : userId,
                nick : nick
            }, function(err, ret){
                if( !err ){
                    li.info('=================================== 微信id为'+wId+'的用户，nick更新成功 ==========================================');
                    return;
                }
                li.info('nick更新失败');
                ld.debug(err);
            });
        });
    });
};

// xiexie_res,在测试模拟新用户关注的时候用到, 不用传
// xiexie_res在测试模拟新用户注册的时候用到 路由是/dashixiongwx/weixin/dotest/;
var eventHandle = function(msg, xiexie_res){
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
			var shop_id = 0;//TODO: 分店id 通过带参数二维码获得, 如果没有eventKey, 可能通过搜索而来
            var tmp;
            var tmpData = 0;//定义的临时变量
            var qId = 0;//渠道ID
			if( msg.eventKey ){ //带参数的二维码
                try {
                    tmp = msg.eventKey.split('_');//扫描关注时的 eventKey 形如 qrscene_2
//					shop_id = tmp[1] - 0;
                    tmpData = tmp[1] - 0;
                    if(tmpData>50000){
                        //说明是渠道ID
                        qId = tmpData;
                        dashixiong.getShopIdByQid(qId, function(err, shopId){
                            if(err){
                                console.log(err);
                                return;
                            }
                            if(shopId){
                                shopId.forEach(function(doEle, i){
                                    shop_id = doEle.shopId;
                                });

                                console.log('有key>50000 shopId = ');
                                console.log(shop_id);
                            }
                        });

                    }else{
                        shop_id = tmpData;
                        qId = 0;
                        console.log('有key<=50000 shopId = ');
                        console.log(shop_id);
                    }
                } catch (e) {
                    /* handle error */
                }
			}else{
                if( msg.query && msg.query.shop_id ){//微信协议是基于http协议的, weixin-api-dsx 中将req的信息也写入到了msg
                    shop_id = msg.query.shop_id - 0;
                    qId = 0;
                    li.info('=============== 有人关注【呼叫大师兄】  ==============');
                }
            }

			li.info('=========== 客户扫描的是'+ shop_id +'号店的二维码===========');
			//------------ 给这个微信用户注册一个账号 -----------//
			//先看看用户是不是已经注册过
			dashixiong.getUserByWxId(wx_id, function(err, ret){
				if(err){
				    ld.debug(err);
				    return;//下面的代码不需要运行了
				}

				var user = ret.length?ret[0]:null;

				if(!user){//没注册过, 那就给他注册一下
                    console.log('渠道ID-------->', qId);
					console.log('===== 新用户, 自动给TA注册一个号 ~~~~~shop_id 是 ', shop_id);

					dashixiong.newUser({shop_id : shop_id, qId : qId}, function(err, new_user_id){
						//获得新用户id之后, 绑定微信id, 然后跟注册过的是一个流程了
						dashixiong.bindUser(new_user_id, wx_id, function(){ //TODO: 绑定流程就不管他是不是成功了, 有空可以改进
                            //-------------- 给用户发送一个指引消息 --------------//
                            dashixiong.getUserById(new_user_id, function(err_user, ret_user){
                                if(err_user) console.log(err_user);
                                if( !msg.user ) msg.user = sureObj(ret_user);
                                getEntranceResMsgBody(msg, function(resMsg){
                                    uutil.sendWxMsg(weixin, resMsg, msg);
                                });
                            });
                        });
                        //更新nick
                        updateNickByWid( wx_id, new_user_id );
					});
					return;//下面的代码为用户存在的情况, 故不需要再运行
				}

				//能运行到这里, 说明是一个用户取消关注之后又关注了
				console.log('===== 取消关注的用户再次关注~~~~~');
				//如果当前扫描的shop_id不是TA之前的id, 那就更新一下TA的shop_id, 给他换一间店
				if( user.shopId != shop_id ){
					li.info('===== 用户'+ user.id +'从'+ user.shopId +'店换到'+ shop_id +'店');
					dashixiong.updateUser({
                        id : user.id,
                        status : 1,
                        shopId : shop_id,
                        qId : qId
                    }, function(err, ret){
						ld.debug(err);
						ld.debug(ret);
					});
				}
                //根据微信id获取nick，并更新到我们的数据库
                updateNickByWid( wx_id, user.id );
                //-------------- 给用户发送一个指引消息 --------------//
                console.log('');
                console.log('user=');
                console.log(user);
                console.log('');
                if( !msg.user ) msg.user = user;
                //如果msg.eventKey存在，说明扫的二维码是有参数的
                if( msg.eventKey ){
                    dashixiong.getShopById(shop_id, function(err_shop, ret_shop){
                        if( err_shop ) console.log(err_shop);
                        var shop_info = sureObj(ret_shop);
                        msg.user.shopId = shop_id;
                        msg.user.relation = shop_info.relation;
                        getEntranceResMsgBody(msg, function(resMsg){
                            if( user.shopType == 'store' ){
                                resMsg.articles[0] || (resMsg.articles[0].title = '感谢你选择了再次相信爱情！点击进入大师兄微信小卖部');
                            }
                            uutil.sendWxMsg(weixin, resMsg, msg);
                        });
                    });
                }else{
                    getEntranceResMsgBody(msg, function(resMsg){
                        if( user.shopType == 'store' ){
                            resMsg.articles[0] || (resMsg.articles[0].title = '感谢你选择了再次相信爱情！点击进入大师兄微信小卖部');
                        }
                        uutil.sendWxMsg(weixin, resMsg, msg);
                    });
                }

			});//end getUserByWxId

            //根据shop_id对用户进行分组
            accessToken_hjdsx(function ( err, obj ) {
                var access_token = obj.access_token;
                ld.info('========================================= 扫描二维码的用户，正在进行分组... ===============================================');
                request({
                    url : 'https://api.weixin.qq.com/cgi-bin/groups/members/update?access_token='+obj.access_token,
                    method : 'POST',
                    body : JSON.stringify({
                        openid : wx_id,
                        to_groupid : conf.wx_group[shop_id]
                    })
                }, function (err, response, body) {
                    if(err){
                        console.log(err);
                        return;
                    }
                    var obj = JSON.parse( body );
                    li.info('==================================== 微信分组api返回结果：==========================================');
                    li.info(body);
                    if( obj.errmsg == 'ok' ){
                        li.info('新关注，被分配到 '+ shop_id + ' 号店的分组了，分组的id为'+ conf.wx_group[shop_id]);
                        return;
                    }
                    li.debug('access_token='+ access_token + ', openid=' + wx_id + ', to_groupid=' + conf.wx_group[shop_id]);
                    li.debug('用户在微信端无法被分配到'+ shop_id + '号店的分组，错误信息为：');
                    li.debug(err);
                });
            });

		    return;//给客户的响应需要异步读取数据库, 这里先返回, 然后在异步函数getUserByWxId的回调里面响应一下客户
			//break;
		}
		case 'unsubscribe' : {
			li.info('=============== 有人取消了关注, 微信id是 '+ msg.fromUserName +' ================');
            dsx_wx.markUnsubscrib(msg.fromUserName, function(){}); //用户取消关注后，User表里status字段要设置成0
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
						resMsg.content = getOrderDetailInText(orders[0], msg.fromUserName);
                        uutil.sendWxMsg(weixin, resMsg, msg);
					}
				});
				return;

			}else if(msg.eventKey == 'key_takeaway'){
                msg.msgType = 'text';
                msg.content = '外卖单';
                handle( msg );
                return;

			}else if(msg.eventKey == 'key_rp'){
                msg.msgType = 'text';
                msg.content = '人品';
                handle( msg );
                return;

			}else if(msg.eventKey == 'key_qr'){
                dashixiong.getUserByWxId(msg.fromUserName, function(err, ret){
                    var user = ret[0];

                    if( !user ){
                        var articles = [];
	                    var resMsg;
	                    articles.push({
	                    	title : '扫码二维码，分享大师兄',
	                    	description : '或者搜索公众账号: 大师兄小卖部',
	                    	picUrl : value,
   	                    	url : value
	                    });

	                    resMsg = {
	                    	fromUserName : msg.toUserName,
	                    	toUserName : msg.fromUserName,
	                    	msgType : "news",
	                    	articles : articles,
	                    	funcFlag : 0
	                    };
                        uutil.sendWxMsg(weixin, resMsg, msg);
                        return;

                    }

                    dashixiong.getSettingValueByKey( 'qrcode', user.shopId, function (err, value) {
                        var articles = [];
	                    var resMsg;
	                    articles.push({
	                    	title : '扫码二维码，分享大师兄',
	                    	description : '或者搜索公众账号: 大师兄小卖部',
	                    	picUrl : value,
   	                    	url : value
	                    });

	                    resMsg = {
	                    	fromUserName : msg.toUserName,
	                    	toUserName : msg.fromUserName,
	                    	msgType : "news",
	                    	articles : articles,
	                    	funcFlag : 0
	                    };
                        uutil.sendWxMsg(weixin, resMsg, msg);
                    });
                });
                return;
			}else if(msg.eventKey == 'key_tel'){//联系电话
			    dashixiong.getUserByWxId(msg.fromUserName, function(err, ret){
                    var user = ret[0];

                    if( !user ){//这些个不存在的用户是少数, 随着时间的推移, 应该都会被自动注册搞定
				        resMsg.content = words.txts.tel;
                        uutil.sendWxMsg(weixin, resMsg, msg);
                        return;
                    }


                    dashixiong.getSettingValueByKey( 'tel', user.shopId, function (err, value) {
			    	    resMsg.content = value;
                        uutil.sendWxMsg(weixin, resMsg, msg);
                    });
                });
                return;
			}
			else if(msg.eventKey == 'key_feed_back'){
				resMsg.content = words.txts.feed_back;

			}else if(msg.eventKey == 'key_restaurant'){
                msg.shopType = 'restaurant';
                dashixiong.getUserByWxId(msg.fromUserName, function(err, ret){
                    var user = (ret && ret[0]) || {};
                    msg.user = user;
                    getEntranceResMsgBody(msg, function(resMsg){
                        //呼叫大师兄入口消息
                        uutil.sendWxMsg(weixin, resMsg, msg);
                    });
                });
                return;
			}else if(msg.eventKey == 'key_store'){
                msg.shopType = 'store';
                dashixiong.getUserByWxId(msg.fromUserName, function(err, ret){
                    var user = (ret && ret[0]) || {};
                    msg.user = user;
                    getEntranceResMsgBody(msg, function(resMsg){
                        //小卖部入口消息
                        uutil.sendWxMsg(weixin, resMsg, msg);
                    });
                });
                return;
            }else if(msg.eventKey == 'key_deliver_time'){
				resMsg.content = words.txts.deliver_time;

			}else if(msg.eventKey == 'key_hr'){
                dashixiong.getUserByWxId(msg.fromUserName, function(err, ret){
                    var user = ret[0];
                    if( !user ){//这些个不存在的用户是少数, 随着时间的推移, 应该都会被自动注册搞定
				        resMsg.content = words.txts.hr;
                        uutil.sendWxMsg(weixin, resMsg, msg);
                        return;
                    }
                    dashixiong.getSettingValueByKey( 'hr', user.shopId, function (err, value) {
			    	    resMsg.content = value;
                        uutil.sendWxMsg(weixin, resMsg, msg);
                    });
                });
                return;

			}else if(msg.eventKey == 'key_good'){
				resMsg.content = words.txts.good;
			}else if(msg.eventKey == 'key_community'){
				//resMsg = uutil.getCommunityEntranceRes( msg );
                msg.msgType = 'text';
                msg.content = '社区';
                handle( msg );
                return;


			}else if(msg.eventKey == 'key_community_post'){
                msg.msgType = 'text';
                msg.content = '#';
                handle( msg );
                return;
			}else if(msg.eventKey == 'key_my_hire' ){
                dashixiong.getUserByWxId(msg.fromUserName, function(err, ret){
                    var user = (ret && ret[0]) || {};
                    var articles = [];
                    var resMsg;
                    articles.push({
                        title : '进入招聘',
                        description : '',
                        picUrl : 'http://img.ksmimi.com/uploads/articles/5572d7c81961f2452b11ecd9e116ef2d.jpg',//招聘图片
                        url : 'http://www.ksmimi.com/dashixiongwx/shop/'+user.shopId+'/employee/type?user_id='+user.id
                    },{
                        title : '进入便利店',
                        description : '',
                        picUrl : 'http://img.ksmimi.com/uploads/articles/4b9f5ff44a594d161aa67e55dccf9066.png', //八戒的头像
                        url : 'http://www.ksmimi.com/dashixiongwx/shop/'+ user.shopId +'/rd/index?wx_id='+msg.fromUserName
                    });
                    resMsg = {
                        fromUserName : msg.toUserName,
                        toUserName : msg.fromUserName,
                        msgType : "news",
                        articles : articles,
                        funcFlag : 0
                    };
                    uutil.sendWxMsg(weixin, resMsg, msg);
                });
                return;
            }else{
                resMsg.content = '';
            }

			break;
		}
		default : {
			return;
			//break;
		}
	}

    uutil.sendWxMsg(weixin, resMsg, msg);
};

weixin.eventMsg(eventHandle);

exports.eventHandle = eventHandle;
exports.handle = handle;
//-------------------- test ------------------------//
//setTimeout(function () {
//    handle({
//        //type : 'image',
//        type : 'text',
//        //picUrl : 'http://img.yeahwen.com/uploads/pics/834f893b7ba4d9ac99f0d22001ad2d33.jpg',
//        //picUrl : 'http://img.yeahwen.com/uploads/pics/35cfabb5f4db8a23b85be003fedfc515.jpg',
//        //picUrl : 'http://img.yeahwen.com/uploads/pics/b0f34f6d2dd0944746af2515084beec3.jpg',
//        //content : '社区',
//        //content : '通过模拟微信发布',
//        content : '#',
//        //content : '都市的繁华有时让人惊叹, 有时却让人胆怯. ',
//        //content : '这个是普通内容, 不应该被记录到文章里',
//        fromUserName : 'oXvPNjv6ZxctraFq85u4ro2m04S4'
//    });
//}, 1000);






var accounter = require( '../controllers/accounter' );
var dashixiong = require('../controllers/dashixiong');
var API = require('wechat').API;
var util = require('../lib/util');
//============================== 日志配置 ================================
var li = util.getLogger('INFO', 'weixin_activity/account.js');
var ld = util.getLogger('DEBUG', 'weixin_activity/account.js');


var app_id = 'wx4f17193b2f6626aa';
var app_secret = 'fd48420c58c2f04f50f7e4364d2014de';

var api = new API(app_id, app_secret);

//确保用户在登录状态, 没有登录的都自动登录
var ensureLogin = function (user, fn) {
    accounter.getUserFromCacheById(user.id, function (err, user_in_cache) {
        if( err ){ 
            fn(err);
            return;
        }

        if( !user_in_cache || !user_in_cache.tickets.length ){//从来没有登录过, 就让他自动登录
            accounter.wxLoginInAction( user, fn);
            return;
        }
        
        var ticket_obj = user_in_cache.wx_dsx_ticket;
        //没自动登陆就没有ticket_obj，或者有ticket_obj但是过期了, 那就wxLoginInAction一下
        if( !ticket_obj || !accounter.isTicketObjAvailableForUser( ticket_obj, user_in_cache ) ){
            accounter.wxLoginInAction( user, fn);
            return;
        }

        //TODO: 这里需要查看一下用户的ticket有没有过期(目前ticket没有过期的设计), 过期的话要重新自动登录, 刷新一下ticket
        fn(null, true, user_in_cache);
        //fn(null, true, user);

    });  
};

//本handler在所有的handler之前, 预先加载一些基本用户/店铺信息
var account = function (msg, weixin, next) {
    dashixiong.getUserByWxId( msg.fromUserName, function (err, ret) {
        if(err){
            util.sendWxMsg(weixin, {
                fromUserName : msg.toUserName, 
		        toUserName : msg.fromUserName, 
		        msgType : "text",
			    content : '出了一点小问题, 我们在狂修!',
		        funcFlag : 0 
            }, msg);
            return; 
        }
        var u = ret[0] || {};

        if( !u.shopId ){
            //记录用户发过来的消息，本来是在msg.js里面记录的，但如果发消息之前没有选学校，就记录不了了，以防万一，针对这种情况在这里先记录
            if( msg.msgType == 'text' ){
                p = {
                    type : 'message',
                    fromUserId : 'u_'+u.id,
                    toUserId : 's_'+u.shopId,
                    content : msg.content,
                    msgType : msg.msgType
                };
                dashixiong.insertMsg(p, function (err, ret) { });
            }

            util.sendWxMsg(weixin, {
                fromUserName : msg.toUserName,
		        toUserName : msg.fromUserName,
		        msgType : "text",
			    content : 'Hi，先<a href="http://www.ksmimi.com/dashixiongwx/shop/0?wx_id='+ msg.fromUserName +'">点击我</a>，选择离你最近的分店吧！！',
		        funcFlag : 0
            }, msg);
            return;
        }
        
        //老用户, 一直在关注, 但是一直没有买东西, 这些用户以前是没有在User表里写东西的(现在只要关注了的用户都有). 先注册然后再登录
        //正常情况下这些用户是咱们1号店里那些没有买过东西的客户
        if( !u ){
            console.log('===== 以前的老用户, 一直关注, 但是没有买东西, 自动给TA注册一个号 ~~~~~');
			accounter.newUser({shop_id : 1, qId : 0}, function(err, new_user_id){
			    //获得新用户id之后, 绑定微信id, 然后跟注册过的是一个流程了
				accounter.bindUser(new_user_id, msg.fromUserName, function (err) {
                    if(err){
                        ld.debug(err);
                        util.sendWxMsg(weixin, {
                            fromUserName : msg.toUserName, 
		                    toUserName : msg.fromUserName, 
		                    msgType : "text",
			                content : '',
		                    funcFlag : 0 
                        }, msg);
                        return;        
                    }
                    //注册完毕之后重新走本流程
                    account( msg, weixin, next );
				});
			});
            return;
        }
        
        //从cache中获取用户的登录信息, 以便获取用户当前的登录状态和其他诸如微信id将来还有头像啊等数据
        ensureLogin( u, function (err, isLogin, user_in_cache) {
            if(err){ next(); return; }
            //运行到这里的话, 说明用户已经登录
            msg.user = user_in_cache;
            //他没有nick, 就使用他的微信名字作为nick
            //如果用户没有head, 就调用微信api 获取用户信息. 进入社区需要用到head, nick
            if( !user_in_cache.head ){
                api.getUser(msg.fromUserName, function (err, wx_user) {
                    if(err){
                        msg.wx_user_info = {};
                        next();
                        return;
                    }
                    msg.wx_user_info = wx_user;
                    dashixiong.updateUser({
                        id : u.id,
                        nick : wx_user.nickname,
                        head : wx_user.headimgurl
                    }, function (err, ret) {
                        next();
                    });
                });
                return;
            }
            next();
        });

    });
};

module.exports = account;



















var dashixiong = require('../controllers/dashixiong');
var uutil = require('../lib/util');

//============================== 日志配置 ================================
var li = uutil.getLogger('INFO', 'weixin_activity/base.js');
var ld = uutil.getLogger('DEBUG', 'weixin_activity/base.js');

var sureObj = uutil.sureObj,
    sureAry = uutil.sureAry;

//------------------------ 工具方法 ------------------------- //
var getOrderDetailInText = uutil.getOrderDetailInText;
var sendErrorMsg = function ( weixin, msg ) {
    weixin.sendMsg({
        fromUserName : msg.toUserName, 
        toUserName : msg.fromUserName, 
        msgType : "text",
        content : '出了点小问题, 我们在狂修。你可以先放下手机喝杯茶~',
        funcFlag : 0 
	}); 
};

//------------------------------------ 基本关键字处理 -------------------------//
var handlers = [];
module.exports = handlers;

handlers.push({
    keywords : [ '大师兄', 'dsx', '大师兄芝麻开门', '大師兄', '小卖部' ],
    fn : function (msg, weixin, next) {
        dashixiong.getUserByWxId(msg.fromUserName, function(err, ret){
            if( err ) console.log(err);
            msg.user = sureObj(ret) || {};
            uutil.getEntranceResMsgBody(msg, function(resMsg){
                uutil.sendWxMsg(weixin, resMsg, msg);
            });
        });
    }
});


handlers.push({
    keywords : [ '二维码', 'ewm' ],
    fn : function (msg, weixin, next) {

        //uutil.getQrMsgRes( msg, weixin );
        dashixiong.getSettingValueByKey( 'qr', msg.user.shopId, function (err, value) {
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

    }
});
    
handlers.push({
    keywords : [ '外卖', '外卖单' ],
    fn : function (msg, weixin, next) {
        var articles = [];
	    var resMsg;		
	    articles.push({
            title : '点击查看外卖单!',
            description : '快点呀! ',
            picUrl : 'http://s.ksmimi.com/dashixiong_static/img/takeaway_list.jpg',
            url : 'http://www.ksmimi.com/dashixiongwx/takeaway/list?wx_id='+msg.fromUserName+'&ver=3#mp.weixin.qq.com'
	    });

	    resMsg = {
            fromUserName : msg.toUserName,
            toUserName : msg.fromUserName,
            msgType : "news",
            articles : articles,
            funcFlag : 0
	    };

        uutil.sendWxMsg(weixin, resMsg, msg);
    }
});



handlers.push({
    keywords : [ '订单查询', '查询订单', '订单', 'dd' ],
    fn : function (msg, weixin, next) {
        dashixiong.listValidOrdersByWxId(msg.fromUserName, function(err, orders){
            var resMsg;
			if(!err){
				resMsg = {
		            fromUserName : msg.toUserName,
		            toUserName : msg.fromUserName,
		            msgType : "text",
				    content : getOrderDetailInText(orders[0]),
		            funcFlag : 0
	            };
			}else{
                resMsg = {
                    fromUserName : msg.toUserName,
                    toUserName : msg.fromUserName,
                    msgType : "text",
                    content : '出了一点小问题, 我们在狂修!',
                    funcFlag : 0
                }
            }
            uutil.sendWxMsg(weixin, resMsg, msg);
		});
    }
});

handlers.push({
    keywords : [ '账号', '设置'],
    fn : function (msg, weixin, next) {
        var resMsg = {
	        fromUserName : msg.toUserName, 
	        toUserName : msg.fromUserName, 
	        msgType : "text",
		    content : '<a href="http://www.ksmimi.com/dashixiongwx/account/'+ msg.fromUserName +'">设置请点</a>',
	        funcFlag : 0 
	    };
        uutil.sendWxMsg(weixin, resMsg, msg);
    }
});
handlers.push({
    keywords : [ '社区', '大师兄小社区', '吹水', '吹吹水'],
    fn : function (msg, weixin, next) {
        dashixiong.getUserByWxId( msg.fromUserName, function (err, ret) {
            if(err){
                sendErrorMsg( weixin, msg );
                return; 
            }
            var user = ret[0];
            if( !user )return;//关注了就会有user对象, 没有的话就实在是太离奇了, 那就不管他


            var articles = [];
	        var resMsg;		
            var url = 'http://www.ksmimi.com/dashixiongwx/shop/'+ user.shopId +'/community' + '?wx_id=' + msg.fromUserName + '&user_id='+ user.id + '&ticket='+msg.user.wx_dsx_ticket.ticket;
            console.log( '进入社区的令牌是:=================================================== ' );
            console.log( url );
	        articles.push({
                title : '社区令牌(点击进入社区)',
                description : '这条消息不要转发给别人哦, 不然别人就可以冒充你到处去拈花惹草了。',
                picUrl : 'http://s.ksmimi.com/dashixiong_static/img/lingpai2.jpg',
                url : url 
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
    }
});




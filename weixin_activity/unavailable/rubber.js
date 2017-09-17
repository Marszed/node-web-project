//抢单活动, 某个时刻在页面上抢到的东西都是你的
var dashixiong = require('../controllers/dashixiong');
var uutil = require('../lib/util');
var conf = require('../conf');

//============================== 日志配置 ================================
var li = uutil.getLogger('INFO', 'weixin_activity/rubber.js');
var ld = uutil.getLogger('DEBUG', 'weixin_activity/rubber.js');

module.exports = {
    keywords : [ '抢', '芝麻开门抢' ],
    fn : function (msg, weixin, next) {
        dashixiong.getUserByWxId( msg.fromUserName, function (err, ret) {
            if(err){
                sendErrorMsg( weixin, msg );
                return; 
            }
            var admin = '';
            if( msg.content == '芝麻开门抢' ){
                admin = '&zhimakaimen=1';
            }
            var user = ret[0];
            if( !user )return;//关注了就会有user对象, 没有的话就实在是太离奇了, 那就不管他

            var p = {
                wx_id :msg.fromUserName,
                wx_app_token : conf.wx.wx_app_token,
                timestamp : new Date().getTime()
            };

            var sig = uutil.makeSig( p, conf.wx.wx_app_token );
            var resMsg = {
                fromUserName : msg.toUserName,
                toUserName : msg.fromUserName,
                msgType : "text",
                //content : '点击这个链接进入抢货页面==>><a href="http://www.ksmimi.com/dashixiongwx/activity/5?wx_id='+ msg.fromUserName + admin +'">点击这里</a>, 要快!' ,
                content : '点击这个链接进入抢货页面==>><a href="http://www.ksmimi.com/dashixiongwx/activity/5?wx_id='+ msg.fromUserName + admin +'&timestamp='+ p.timestamp +'&sig='+ sig +'">点击这里</a>, 要快!' ,
                funcFlag : 0
	        };

            console.log( resMsg.content );
	        weixin.sendMsg( resMsg );
        });
    }
};

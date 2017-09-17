//抢单活动, 某个时刻在页面上抢到的东西都是你的
var dashixiong = require('../controllers/dashixiong');
var uutil = require('../lib/util');
var conf = require('../conf');

//============================== 日志配置 ================================
var li = uutil.getLogger('INFO', 'weixin_activity/rp.js');
var ld = uutil.getLogger('DEBUG', 'weixin_activity/rp.js');

module.exports = {
    keywords : [ '人品', '我的人品' ],
    fn : function (msg, weixin, next) {

        var p = {
            wx_id : msg.fromUserName,
            wx_app_token : conf.wx.wx_app_token,
            timestamp : new Date().getTime()
        };

        var sig = uutil.makeSig( p, conf.wx.wx_app_token );
        var resMsg = {
            fromUserName : msg.toUserName,
            toUserName : msg.fromUserName,
            msgType : "text",
            //content : '点击这个链接进入抢货页面==>><a href="http://www.ksmimi.com/dashixiongwx/activity/5?wx_id='+ msg.fromUserName + admin +'">点击这里</a>, 要快!' ,
            content : '点击这个链接查看人品==>><a href="http://www.ksmimi.com/dashixiongwx/rp/'+ msg.fromUserName +'?wx_id='+ msg.fromUserName +'&timestamp='+ p.timestamp +'&sig='+ sig +'">点击这里</a>' ,
            funcFlag : 0
        };
        console.log( resMsg.content );
        uutil.sendWxMsg(weixin, resMsg, msg);
    }
};

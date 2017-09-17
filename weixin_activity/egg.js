//砸金蛋赢代金券
var dashixiong = require('../controllers/dashixiong');
var uutil = require('../lib/util');
var conf = require('../conf');

//============================== 日志配置 ================================
var li = uutil.getLogger('INFO', 'weixin_activity/jiandaoshitoubu.js');
var ld = uutil.getLogger('DEBUG', 'weixin_activity/jiandaoshitoubu.js');
var end = uutil.end;

module.exports = {
    keywords : [ '砸', '我要豪礼', '我要好礼', '我要好礼！', '我要豪礼！' ],
    fn : function (msg, weixin, next) {
        uutil.sendWxMsg(weixin, {
            fromUserName : msg.toUserName,
            toUserName : msg.fromUserName,
            msgType : "text",
            content : '砸金蛋活动现在开始！猛击<a href="http://www.ksmimi.com/dashixiongwx/activity/8?wx_id='+ msg.fromUserName +'">这个链接</a>go!go!go! ',
            funcFlag : 0
        }, msg);
        return;
    }//end fn
};

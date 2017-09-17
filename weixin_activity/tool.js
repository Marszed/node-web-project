//用户查看自己的道具
var dashixiong = require('../controllers/dashixiong');
var uutil = require('../lib/util');
var conf = require('../conf');

//============================== 日志配置 ================================
var li = uutil.getLogger('INFO', 'weixin_activity/sorry.js');
var ld = uutil.getLogger('DEBUG', 'weixin_activity/sorry.js');
var end = uutil.end;

module.exports = {
    keywords : [ '道具' ],
    fn : function (msg, weixin, next) {
        uutil.sendWxMsg(weixin, {
            fromUserName : msg.toUserName,
            toUserName : msg.fromUserName,
            msgType : "text",
            content : '<a href="http://www.ksmimi.com/dashixiongwx/user/tool/list/'+ msg.fromUserName +'">点击链接</a>查看你所拥有的道具',
            funcFlag : 0
        }, msg);
    }//end fn
};

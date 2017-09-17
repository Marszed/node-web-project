var uutil = require('../../lib/util');
var dashixiong = require('../../controllers/dashixiong');

var pushNotify = uutil.pushNotify,
    sureObj = uutil.sureObj,
    sureAry = uutil.sureAry;

module.exports = function (msg, weixin, next) {
    //如果是纯数字，直接返回用户id
    var content = msg.content.trim() || '0',
        r = /^\d$/,
        wx_id = msg.fromUserName;
    if( r.test(content) ){
        dashixiong.getUserByWxId(wx_id, function(err, ret){
            if( !err ){
                ret = sureObj(ret);
                console.log(ret);
                uutil.sendWxMsg(weixin, {
                    fromUserName : msg.toUserName,
                    toUserName : wx_id,
                    msgType : "text",
                    content : '你的幸运号码是：'+ ret.id + '，请牢记，迎新晚会当晚的抽奖就靠它了！',
                    funcFlag : 0
                }, msg);
                return;
            }
            console.log(err);
        });

        return;
    }
    //如果不是纯数字，直接跳过
    next();
};

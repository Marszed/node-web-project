/**
 * Created by zed on 15-3-24.
 */
var uutil = require('../lib/util');
var dashixiong = require('../controllers/dashixiong');

var pushNotify = uutil.pushNotify,
    sureObj = uutil.sureObj,
    sureAry = uutil.sureAry;

module.exports = function (msg, weixin, next) {
    //如果是纯数字，直接返回用户id
    var content = msg.content.trim() || '0',
        wx_id = msg.fromUserName;
    if('好男人' == content){
        dashixiong.getUserByWxId(wx_id, function(err, ret){
            if( !err ){
                ret = sureObj(ret);

                var cont = '<a href="http://www.ksmimi.com/dashixiongwx/shop/'+ret.shopId+'?wx_id='+wx_id+'&mark='+'betterman'+'">点我</a>进入小卖部';

                uutil.sendWxMsg(weixin, {
                    fromUserName : msg.toUserName,
                    toUserName : wx_id,
                    msgType : "text",
                    content : cont,
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

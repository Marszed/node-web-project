var uutil = require('../lib/util');
var dashixiong = require('../controllers/dashixiong');

var pushNotify = uutil.pushNotify,
    sureObj = uutil.sureObj,
    sureAry = uutil.sureAry;

module.exports = function (msg, weixin, next) {
    //如果是纯数字，直接返回用户id
    var content = msg.content.trim() || '0',
        wx_id = msg.fromUserName;
    if('抽奖' == content){
        dashixiong.getUserByWxId(wx_id, function(err, ret){
            if( !err ){
                ret = sureObj(ret);
                console.log(ret);
                var cont = '';
                if(ret.shopId){
                    cont = '<a href="http://www.ksmimi.com/dashixiongwx/shop/'+ret.shopId+'?wx_id='+wx_id+'">点我去抽奖</a>';
                }
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

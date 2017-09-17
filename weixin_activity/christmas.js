var uutil = require('../lib/util');
var dashixiong = require('../controllers/dashixiong');

var pushNotify = uutil.pushNotify,
    sureObj = uutil.sureObj,
    sureAry = uutil.sureAry;

module.exports = function (msg, weixin, next) {
    //如果是纯数字，直接返回用户id
    var content = msg.content.trim() || '0',
        wx_id = msg.fromUserName;
    if('搞' == content){
        uutil.sendWxMsg(weixin, {
            fromUserName : msg.toUserName,
            toUserName : wx_id,
            msgType : "text",
            content : '活动已结束，谢谢参与',
            funcFlag : 0
        }, msg);
        return;

        dashixiong.getUserByWxId(wx_id, function(err, ret){
            if( !err ){
                ret = sureObj(ret);
                console.log(ret);
                var cont = '';
                if(1==ret.shopId || 2==ret.shopId || 3==ret.shopId){
                    cont = '<a href="http://www.ksmimi.com/dashixiongwx/activity/christmas/shop/'+ret.shopId+'/user/'+ret.id+'?wx_id='+wx_id+'">点我</a>平安夜送Ta一份礼物';
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
    //如果不是---搞，直接跳过
    next();
};

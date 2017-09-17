var uutil = require('../../lib/util');
var dashixiong = require('../../controllers/dashixiong');

var pushNotify = uutil.pushNotify,
    sureObj = uutil.sureObj,
    sureAry = uutil.sureAry;

module.exports = function (msg, weixin, next) {
    //如果是纯数字，直接返回用户id
    var content = msg.content.trim() || '0',
        wx_id = msg.fromUserName;
    if('大师兄我爱你' == content){
        dashixiong.getUserByWxId(wx_id, function(err, ret){
            if( !err ){
                ret = sureObj(ret);
                console.log(ret);
                var cont = '';
                if(1==ret.shopId || 2==ret.shopId || 3==ret.shopId || 13==ret.shopId || 15==ret.shopId){
                    cont = '<a href="http://www.ksmimi.com/dashixiongwx/shop/'+ret.shopId+'?wx_id='+wx_id+'">点我</a>进入小卖部';
                }
                if(6==ret.shopId){
                    cont = '<a href="http://www.ksmimi.com/dashixiongwx/shop/'+ret.shopId+'?wx_id='+wx_id+'">点我</a>进入餐厅';
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

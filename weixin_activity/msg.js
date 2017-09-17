var uutil = require('../lib/util');
var dashixiong = require('../controllers/dashixiong');
var pusMsghayagu = require('../res/push_msg_to_hayagu');

var pushNotify = uutil.pushNotify; 
var pushApp = uutil.pushApp;
var superadmin = ['6216','13389','35607'];
//所有收到的消息必须记录一遍到数据库里, 同时按照每个消息的店铺来源, 通过websocket推送到相应店铺
module.exports = function (msg, weixin, next) {
    var user = msg.user;
    var p = null;
    var shopid = user.shopId;
    if(shopid == 3) {
        shopid = 2;
    }
    //==============来消息了通知客服===========
    var admin = {
        section_id : user.sectionId
    };
    superadmin.forEach(function(su,i){
        if(su==user.id){
            console.log('开始推送给客服'+admin.section_id+'--绑定的货架');
            pushApp(admin);//引入极光推送
            return;
        }
    });
    //===============================
    if( msg.msgType == 'text' ){
        p = {
            type : 'message',
            fromUserId : 'u_'+user.id,
            toUserId : 's_'+user.shopId,
            content : msg.content,
            msgType : msg.msgType
        };
        dashixiong.insertMsg(p, function (err, ret) { });
        p.shop_id = shopid;
        pushNotify(p);

        //TODO 临时给hayagu推送微信消息
        var reg = /^dsxyz:[A-Z0-9]{32}/;
        if(reg.test(msg.content)){
//            pusMsghayagu(p,'www.hayagu.com',6789,function(err, body){
                console.log("**********app--推送消息*******");
//                if(!err){
                    uutil.sendWxMsg(weixin, {
                        fromUserName : msg.toUserName,
                        toUserName : msg.fromUserName,
                        msgType : "text",
                        content : '您已完成验证，请返回“呼叫大师兄app”完成注册。您的财富与道具将同步到app账户。',
                        funcFlag : 0
                    }, msg);
                    return;
//                }
//            });
            return;
        }
    }else if( msg.msgType == 'image' ){
        p = {
            type : 'message',
            fromUserId : 'u_'+user.id,
            toUserId : 's_'+user.shopId,
            content : '[图片]',
            msgType : msg.msgType,
            ext : JSON.stringify({
                picUrl : msg.picUrl 
            })
        };
        dashixiong.insertMsg(p, function (err, ret) { });
        p.shop_id = shopid;
        pushNotify(p);
    }else if( msg.msgType == 'voice' ){
        p = {
            type : 'message',
            fromUserId : 'u_'+user.id,
            toUserId : 's_'+user.shopId,
            content : '[语音]',
            msgType : msg.msgType,
            ext : JSON.stringify({
                mediaId : msg.mediaId
            })
        };
        dashixiong.insertMsg(p, function (err, ret) { });
        p.shop_id = shopid;
        pushNotify(p);
    }
    console.log('*****app发送完毕********');
    next();
};

//砸金蛋赢代金券
var dashixiong = require('../controllers/dashixiong');
var uutil = require('../lib/util');
var conf = require('../conf');

//============================== 日志配置 ================================
var li = uutil.getLogger('INFO', 'weixin_activity/sorry.js');
var ld = uutil.getLogger('DEBUG', 'weixin_activity/sorry.js');
var end = uutil.end;

module.exports = {
    keywords : [ '依然相信爱情', '仍然相信爱情' ],
    fn : function (msg, weixin, next) {

        dashixiong.getUserActivity( msg.user.id, 9, function (err, ret) {
            if( err ){
                next();
                return;
            }

            var ac = ret[0];

            if( !ac ){//没参加过活动
                dashixiong.grantTool({ 
                    user_id : msg.user.id,
                    t_id : 6
                },  function (err, ret) {
                    dashixiong.insertUserActivity({
                        user_id : msg.user.id,
                        shop_id : msg.user.shopId,
                        ac_id : 9//道歉活动
                    }, function (err, ret) {

                    });//end insertUserActivity
                });

                weixin.sendMsg({
                    fromUserName : msg.toUserName,
                    toUserName : msg.fromUserName,
                    msgType : "text",
                    content : '感谢一路有你，道具“忘情水”已经发放到你的账户上，回复“道具”可以查看。',
                    funcFlag : 0
                });
                return;
            }

            //运行到这里, 说明参加过活动
            weixin.sendMsg({
                fromUserName : msg.toUserName,
                toUserName : msg.fromUserName,
                msgType : "text",
                content : '只能拿一次哦~',
                funcFlag : 0
            });

        });
        
    }//end fn
};

//抢单活动, 某个时刻在页面上抢到的东西都是你的
var dashixiong = require('../controllers/dashixiong');
var uutil = require('../lib/util');
var conf = require('../conf');

//============================== 日志配置 ================================
var li = uutil.getLogger('INFO', 'weixin_activity/jiandaoshitoubu.js');
var ld = uutil.getLogger('DEBUG', 'weixin_activity/jiandaoshitoubu.js');
var end = uutil.end;

module.exports = {
    keywords : [ '剪刀', '石头', '布', '我要兑奖' ],
    fn : function (msg, weixin, next) {
        uutil.sendWxMsg(weixin, {
            fromUserName : msg.toUserName,
            toUserName : msg.fromUserName,
            msgType : "text",
            content : '欧巴~ 猜拳赢美乐多活动已经结束咯~ 下次再来吧~ 大概1~2周之后我们会有新的活动哟~',
            funcFlag : 0
        }, msg);
        return;


        if( msg.user.shopId != 2){
            uutil.sendWxMsg(weixin, {
                fromUserName : msg.toUserName,
                toUserName : msg.fromUserName,
                msgType : "text",
                content : '你的账号绑定的分店貌似不是我们【广东工程学院西区店】哦~ 貌似有点小误会~ 没关系, 任何问题, 都可以微信联系我们的客服~',
                funcFlag : 0
            }, msg);
            return;
        }
        
        if( msg.content == '我要兑奖' ){
            uutil.sendWxMsg(weixin, {
                fromUserName : msg.toUserName,
                toUserName : msg.fromUserName,
                msgType : "text",
                content : '兑奖方法(活动仅限西区小伙伴): \n1) 首先，回复“大师兄”，然后按照提示进入小卖部首页。\n2) 找到美乐多，点一下选购一瓶(你可以再买点别的)，然后结账。\n3) 写地址的时候在“特别吩咐”里写上“大师兄，我爱你”，点击配送即可!',
                funcFlag : 0
            }, msg);
            return; 
        }


        var go = function () {
            var resMsg = {};
            var rd = Math.random();
            if ( rd > 0 && rd < 0.34  ){
                word = "剪刀";
            }else if( rd > 0.34 && rd < 0.67 ){
                word = "石头";
            }else{
                word = "布";
            }

            //枚举出剪刀石头布非平手的6种可能！对象键名前面是客户出，后面是系统出， true为客户赢 false为客户输! 
            var result = {
                "剪刀石头" : false,
                "剪刀布" : true,
                "石头布" : false,
                "石头剪刀" : true,
                "布石头" : true,
                "布剪刀" : false
            };
            var tips = '';

            //石头剪刀布 出到一样的
            if( msg.content == word ){
                tips = '小卖部出【'+ word +'】, 你出【'+ msg.content +'】。打平！\n' ;
                tips += '======================\n';
                tips += '竟然是平手,继续出招吧(“剪刀”、“石头”、“布”选一个再回复一次)~~~~~~~~使出你最厉害的招数，嚯！(^o^)/~' ;
            }else{
                var ret = result[ msg.content + word ];
                if( ret ){//玩家胜
                    tips = '小卖部出【'+ word +'】, 你出【'+ msg.content +'】。恭喜！你【赢】了！\n';
                    tips += '======================\n';
                    //tips  += '无敌多年，竟然败在你手上，无奈啊～～～点击<a href="http://www.ksmimi.com/dashixiongwx/activity/7?wx_id='+ msg.fromUserName +'">这里兑奖</a> ';
                    tips  += '无敌多年，竟然败在你手上，无奈啊～～～回复“我要兑奖”查看兑奖方法。大师兄在今晚9点、10点、11点整点为中奖的同学送货。莫急。';

                }else{//玩家输
                    tips = '小卖部出【'+ word +'】, 你出【'+ msg.content +'】。很抱歉！你【输】了！\n';
                    tips += '======================\n';
                    tips  += '运气有点背啊...尘世间最痛苦的事情莫过于到手的美乐多飞了~ 节哀~ 这个夏天，我们还会有更多好玩的活动，敬请期待！';
                }


                console.log( '=============== 记录用户已经参加过活动！ ' );
                //记录下来, 表明这个人已经参加过活动了
                dashixiong.insertUserActivity({
                    data : JSON.stringify({
                        ret : ret
                    }),
                    user_id : msg.user.id,
                    ac_id : 7//代号6的活动, 就是猜拳活动
                }, function (err, ret) {
                    console.log(err, ret);
                });
            }
            
            console.log( tips );
            resMsg = {
                fromUserName : msg.toUserName,
                toUserName : msg.fromUserName,
                msgType : "text",
                content : tips,
                funcFlag : 0
            };
            uutil.sendWxMsg(weixin, resMsg, msg);

        };//end go

        dashixiong.getUserActivity( msg.user.id, 7, function (err, ret) {
            var userAc = ret[0];
            if( !userAc ){//没参加过活动, 那就给他参加吧
                go();
                return;
            }

            li.info( '============== 参加过猜拳活动了, 不好意思 ============ ');
            resMsg = {
                fromUserName : msg.toUserName,
                toUserName : msg.fromUserName,
                msgType : "text",
                content : '哈喽哇~ 一个人只能才加一次活动哦, 不然我们会破产的...',
                funcFlag : 0
            };
            uutil.sendWxMsg(weixin, resMsg, msg);
        });//end getUserActivity

    }//end fn

};

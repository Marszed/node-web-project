var uutil = require('../lib/util');
var dashixiong = require('../controllers/dashixiong');
var md = require('node-markdown').Markdown;
var logger = require('../controllers/logger');
var conf = require('../conf');
var request = require('request');
var hash = require('../lib/md5'),
    game = require('../controllers/game');

var middleware_load_products_map = require('../lib/middleware_load_products_map_of_shop');
var middleware_load_user_by_wx_id = require('../lib/middleware_load_user_by_wx_id');

var accessToken = require('../res/weixin_token').accessToken;

//--------------------------- 日志配置 ---------------------------//
var li = uutil.getLogger('INFO', 'game_service.js');
var ld = uutil.getLogger('DEBUG', 'game_service.js');


//=============== 常用的工具方法 =================
var render = uutil.render;
var end = uutil.end;
var endErr = uutil.endErr;
var alarmAdmin = uutil.alarmAdmin,
    artRender = uutil.artRender,
    sureAry = uutil.sureAry,
    sureObj = uutil.sureObj;

var session_middleware = require('../lib/middleware_session');

exports.route = function (app) {

    //猜数字游戏
    app.get('/dashixiongwx/game/guess',
        session_middleware,
        function(req, res){
            var user_id = req.cookies.user_id,
                wx_id = req.cookies.wx_id;
            if( !user_id ){
                res.end('Sorry, if you see the message, is means that you are not able to play this game...');
                return;
            }
            //顺带统计一下访问情况
            game.countGuessVisit({user_id:user_id, timeStamp:new Date().getTime()}, function(err, ret){});
            //渲染页面
            render(req, res, 'game/guess', {
                layout: true,
                user_id : user_id,
                wx_id : wx_id
            })
        });
    //判断用户猜的数字是否正确
    app.post('/dashixiongwx/game/check/guess/result',
        middleware_load_user_by_wx_id,
        function(req, res){
            var userId = req.cookies.user_id || '0',
                guessNum = req.body.guessNum,
                init = req.body.init; //初始化的标识
            //先获取用户的信息，看看今天是否有猜过
            game.canHeGuess({userId:userId, guessNum:guessNum, init:init}, function(status, guessInfo, rp, hasGirlfriend){
                end(res, {
                    canHeGuess:status,
                    result:!!(guessNum==guessInfo.randomNum),
                    isBigger:guessNum>guessInfo.randomNum,
                    requestTimes:guessInfo.requestTimes,
                    status:guessInfo.status,
                    hasGirlfriend : hasGirlfriend,
                    rp:rp,
                    num:guessInfo.requestTimes>=6 ? guessInfo.randomNum : 0
                });
            });
        });
    //再来一次
    app.get('/dashixiongwx/game/again', function(req, res){
        var wx_id = req.cookies.wx_id,
            rp = 10; //需要消耗10个人品
        game.canHePlayAgain({wx_id:wx_id, rp:rp}, function(can){
            if( can ){ //够资格，把他在GuessInfo里的时间设为过期时间，这样他就可以玩了
                game.giveHeAChance(wx_id, function(err, ret){
                    //res.redirect('/dashixiongwx/game/guess');
                    res.end( JSON.stringify({canHePlay:can}) );
                });
                return;
            }
            res.end( JSON.stringify({canHePlay:can}) );
        });
    });


    //----lufeng-------圣诞免费送活动

    app.get('/dashixiongwx/activity/christmas/shop/:shop_id/user/:user_id', function(req, res){
        var shop_id = req.params.shop_id,
            user_id = req.params.user_id,
            auto_print = req.query.auto_print,
            wx_id = req.query.wx_id;
        var obj = {
          shopId : shop_id,
            userId : user_id
        };

        //判断用户是否已经参加过活动
        dashixiong.findChristmasGift(obj, function(err, ret){
            if(!err){
                console.log('ret = ');
                console.log(ret);
                if(auto_print){
                    render(req, res, 'activity/send_christmas',{
                        layout:false,
                        gifts_str : ret,
                        gifts : JSON.stringify(ret),
                        shopId : shop_id,
                        userId : user_id,
                        wx_id : wx_id
                    });
                    return;
                }
                render(req, res, 'activity/finish_christmas',{
                    layout:false,
                    gifts_str : ret,
                    gifts : JSON.stringify(ret),
                    shopId : shop_id,
                    userId : user_id,
                    wx_id : wx_id
                });
            }
        });


    });

    //用户提交活动内容
    app.post('/dashixiongwx/activity/christmas/submit', function(req, res){
        var obj = req.body.objs,
            timeStamp = new Date().getTime();
        obj.timeStamp = timeStamp;
        dashixiong.insterChristmasGift(obj,function( err ,ret ){
            if(!err){
                res.end("success");
            }
        });
    });

    //管理员查看圣诞活动派送名单
     app.get('/dashixiongwx/admin/shop/:shop_id/christmas',function(req, res){
        var obj = {
          shopId : req.params.shop_id
        };
         dashixiong.listAllChristmasGifts(obj, function(err ,ret){
             ret.forEach(function(v, i){
                 v.type_value = (function(){
                     try{
                         return JSON.parse(v.type_value);
                     }catch(e){
                         return v.type_value;
                     }
                 })();
             });
             render(req, res, 'activity/admin_christmas',{
                 layout : 'admin/layout',
                 gifts : ret
             });
         });

     });

    //打印
    app.get('/dashixiongwx/admin/shop/christmas/gift/send',function(req, res){
        var obj = req.query.obj;
        dashixiong.updateSendStatus(obj, function(err, ret){
            if(!err){
                /*dashixiong.sendByGiftId(obj, function(err2, ret2){
                    render(req, res, 'activity/send_christmas', {
                        layout : false,
                        gift : ret2
                    });
                });*/
                //更新成功
                res.end(JSON.stringify({
                    code : 0,
                    msg : 'sus'
                }));
                return;
            }
            ld.debug(err);
            res.end(JSON.stringify({
                code : 1,
                msg : err
            }));

        });
    });

    app.post('/dashixiongwx/activity/christmas/repeat/submit',function(req, res){
        var obj = req.body.obj;
        dashixiong.findChristmasGift(obj,function(err ,ret){
            var status = 'true';
            if( (ret && ret.length) || err  ) status = 'false';
            res.end(status);
        });
    });

    //----lufeng-------圣诞免费送活动

};//end exports.route

var dao = require('../models/dao_game');
var uutil = require('../lib/util');
var asyncMgr = require('../lib/asyncMgr'),
    dashixiong = require('../controllers/dashixiong');
var end = uutil.end;
var endErr = uutil.endErr,
    sureAry = uutil.sureAry,
    sureObj = uutil.sureObj;

exports.getGuessInfoById = function(userId, fn){
    dao.getGuessInfoById(userId, fn);
};

exports.getRandomNum = function(Min,Max){
    var Range = Max - Min;
    var Rand = Math.random();
    return (1 + Math.round(Rand * Range));
};

exports.insertGuessInfo = function(info, fn){
    dao.insertGuessInfo(info, fn);
};

exports.countGuessInfo = function(info, fn){
    dao.countGuessInfo(info, fn);
};

var initGues = function(data, fn){
    //第一次来玩这个游戏，往数据库写入一条记录，初始化一下
    var randomNum = exports.getRandomNum(1,100);//系统产生的随机数
    var status = true;
    var first = {
        userId : data.userId,
        timeStamp : data.timeStamp,
        randomNum : randomNum,
        status : 1,
        requestTimes : 0
    };
    exports.insertGuessInfo(first, function(err_insert, ret_insert){
        if( err_insert ){
            console.log(err_insert);
        }
        exports.countGuessInfo(first, function(err, ret){ if(err) console.log(err); }); //记录中奖数据
        fn && fn(first.status, first);
    });
};
var guessRule = {
    1 : 100,
    2 : 80,
    3 : 50,
    4 : 20,
    5 : 10,
    6 : 9,
    0 : 0
};
var award = function(requestTimes, userId, fn){
    dao.award(guessRule[requestTimes], userId, function(err, ret){
        if(err) console.log(err);
        fn && fn();
    });
};

exports.canHeGuess = function(data, fn){
    var user_id = data.userId,
        tool_id = 16, //女朋友这个道具的id
        timeStamp = new Date().getTime();

    //判断用户是否有“女朋友”这个道具
    exports.isHeHasGirlfriend({user_id:user_id, tId:tool_id}, function(hasGirlfriend){
        exports.getGuessInfoById(user_id, function(err, ret){
            if( !err ){
                //第一次来玩这个游戏，或者是第二天再玩的，往数据库写入一条记录，初始化一下
                if( ret && ret.length == 0 || timeStamp - ret[0].timeStamp > 3600*24*1000 ){
                    initGues({userId:user_id, timeStamp:timeStamp}, function(status, info){
                        fn(status, info);
                    });
                    return;
                }
                var guessInfo = sureObj(ret);
                //曾经玩过这个游戏，看看是否仍然可用
                if( !guessInfo.status ){ //没有资格再猜，直接把数据返回
                    fn(guessInfo.status, guessInfo);
                    return;
                }
                //有资格猜
                if( data.init == 'false' ){ //非初始化，即正常使用的情况下再执行
                    guessInfo.requestTimes += 1;
                    guessInfo.status = 1;
                    //如果猜中了，记录数据
                    if( data.guessNum == guessInfo.randomNum ){
                        if( hasGirlfriend ){ //如果有女朋友这个道具了，就直接发人品
                            award(guessInfo.requestTimes, user_id); //根据猜中的次数奖励人品
                        }else{ //光棍一枚，赏个女朋友给他
                            dashixiong.grantTool({
                                user_id: user_id,
                                t_id: tool_id,
                                msg: '光棍节送女朋友'
                            },function(){});
                        }
                        exports.countGuessInfo(guessInfo, function(err, ret){ if(err) console.log(err); }); //记录中奖数据
                        guessInfo.status = 0; //状态标记为不可以用
                    }else if(guessInfo.requestTimes >= 6){ //没猜中，但没机会了
                        guessInfo.status = 0; //状态标记为不可以用
                    }
                    exports.insertGuessInfo(guessInfo, function(err, ret){ if(err) console.log(err); }); //又猜了一次，记录下来
                }
                fn(guessInfo.status, guessInfo, guessRule[guessInfo.requestTimes], hasGirlfriend);
            }
            console.log(err);
        });
    });
};

exports.isRpEnough = function(data, fn){
    dao.getRpByWxId(data.wx_id, function(err, ret){
        if( !err ){
            var RP = sureObj(ret).RP || 0,
                enough = false;
            if( RP >= data.rp ) enough = true;
            fn && fn(enough);
            return;
        }
        console.log(err);
    });
};

exports.reduceRP = function(data, fn){
    dao.reduceRP(data, fn);
};

exports.countGuessVisit = function(data, fn){
    dao.countGuessVisit(data, fn);
};

exports.canHePlayAgain = function(data, fn){
    exports.isRpEnough({wx_id:data.wx_id, rp:data.rp}, function(enough){
        if( enough ){
            exports.reduceRP({wx_id:data.wx_id, rp:data.rp}, function(err, ret){
                if( !err ){
                    fn && fn(true);
                    return;
                }
                console.log(err);
            });
            return;
        }
        //人品不够
        fn && fn(false);
    });
};

exports.giveHeAChance = function(wx_id, fn){
    var timeStamp = new Date().getTime() - 3600*25*1000;
    dao.giveHeAChance(wx_id, timeStamp, fn);
};

exports.isHeHasGirlfriend = function(data, fn){
    dao.isHeHasGirlfriend(data, function(err, ret){
        if( !err ){
            ret = sureAry(ret);
            fn && fn( !!ret.length );
            return;
        }
        console.log(err);
    });
};
/**
 * Created by lufeng on 15-1-5.
 * 产看用户对应的订单数与现有人品总数
 */
var conf = require('../conf'),
    conn = conf.getConnection();

conn.query('select count(userId) as userAllOrderCount, userId, shopId from UserOrder group by userId',function(err, ret){

    //下面循环计算出用户根据订单数的总人品
    ret.forEach(function(v, i){
        if(v.shopId == 1){//2号店客单价为：16
            var _userSumRP = (v.userAllOrderCount - 0) * 16 * 1.5;
            v.userSumRP = _userSumRP;
        }else if(v.shopId == 2){//2号店客单价为：14
            var _userSumRP = (v.userAllOrderCount - 0) * 14 * 1.5;
            v.userSumRP = _userSumRP;
        }else{

        }
    });

    //查找出用户人品数大于根据订单总数计算出的人品总数
    conn.query('select val, userId from UserRP', function(_err, _ret){
        var curMapRP = {};
        _ret.forEach(function(v, i){
            var userId = v.userId;
            curMapRP[userId] = v.val;
        });

        var countPerson = 0;
        var newUserRPMap = {};
        ret.forEach(function(v, i){
            var diff = v.userSumRP - curMapRP[v.userId];
            if(diff < 0 ){
                if(-diff > 500){
                    countPerson++;
                    newUserRPMap[v.userId] = v.userSumRP+200;
                }
             }
        });
        console.log('共有 ' + countPerson + ' 个用户人品差值 > 500！');
        console.log('******查找结束************');
        console.log('newUserRPMap = ');
        console.log(newUserRPMap);
        //更新人品规则：差值大于500的在现有基础上减去差值并且加上200

        for(key in newUserRPMap){
            if(!newUserRPMap.hasOwnProperty(key)) continue;
            (function(key){
                conn.query('update UserRP set val=? where userId=?',[newUserRPMap[key], key],function(err){
                    if(err) console.log(err);
                });
            })(key);
            console.log(key +':' + newUserRPMap[key]);
        }
    });



});


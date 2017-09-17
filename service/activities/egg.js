//砸金蛋赢取代金券
var asyncMgr = require('../../lib/asyncMgr');
var uutil = require('../../lib/util');
var dashixiong = require('../../controllers/dashixiong');
var logger = require('../../controllers/logger');
var conf = require('../../conf');

//--------------------------- 日志配置 ---------------------------//
var li = uutil.getLogger('INFO', 'service/activities/egg.js');
var ld = uutil.getLogger('DEBUG', 'servie/activities/egg.js');

//---------------------- 搞一些中间件来玩一下-------------------//
var middleware_load_user_by_wx_id = require( '../../lib/middleware_load_user_by_wx_id' );
var middleware_get_config_of_shop = require( '../../lib/middleware_get_config_of_shop' );

//=============== 常用的工具方法 =================
var render = uutil.render; 
var end = uutil.end; 
var endErr = uutil.endErr; 

//exports.isStop = true;
exports.route = function(app){

//活动首页
app.get('/dashixiongwx/activity/8', middleware_load_user_by_wx_id, middleware_get_config_of_shop, function(req, res){
    //先检查是不是中奖了
    dashixiong.getUserActivity( req.user.id, 8, function (err, ret) {
        if( err ){
            render(req, res, 'wx/activity/msg', {
                msg :  '出了点问题。可以返回再重试。如果问题依旧，微信联系我们~~'
            });
            return;
        }

        var ac = ret[0];
        if( !ac ){//没参加过
            render(req, res, 'wx/activity/ac_8/index', {
                user_id : req.user.id
            });
            return; 
        }

        var data = JSON.parse( ac.data );
        //如果玩了超过3次就不能玩了
        if( data.num >= 3 || data.win ){
            render(req, res, 'wx/activity/msg', {
                msg :  '你已经玩过咯~ 留点机会给别的同学吧~'
            });
            return;
        }

        //运行到这里, 说明用户虽然参加过, 但是还有机会继续砸金蛋
        render(req, res, 'wx/activity/ac_8/index', {
            user_id : req.user.id
        });
        return;
        
                
        

    });
});

var middleware_load_user_activity = function (req, res, next) {
    var user_id = req.params.user_id - 0;
    dashixiong.getUserActivity( user_id, 8, function (err, ret) {
        req.ac = ret[0];
        console.log( req.ac );
        if( !req.ac ){//没有参加过活动
            next();
            return;
        }

        //有参加过活动
        req.ac.data = JSON.parse( req.ac.data );
        next();
    });
};

var getTool = function (ary_tools) {
    var map = {};
    ary_tools.forEach(function (tool) {
        map[ tool.id ]  = tool;
    });
    var rand = Math.random();
    if( rand < 0.5 ){
        return map[ 4 ];//宝马
    }
    if( rand >= 0.5 && rand < 0.8 ){
        return map[ 3 ];//三轮车
    }
    return map[ 5 ];//玛莎拉蒂
};

app.get('/dashixiongwx/activity/8/whatinegg/:user_id', 
    middleware_load_user_activity,        
function(req, res){
    if( req.ac && req.ac.data.num >=3 ){
        end( res, {
            code : 1,
            msg : '3 times only'
        });
        return;
    }

    if( req.ac && req.ac.data.win ){
        end( res, {
            code : 2,
            msg : 'you have already won!'
        });
        return;
    }


    var user_id = req.params.user_id - 0;
    dashixiong.getToolsWithIds([3,4,5], function (err, ret) {
        var data = null;
        if( req.ac ){
            data = {
                num : ++req.ac.data.num,
            };
        }else{
            data = {
                num : 1,
            }; 
        }

        //按照逻辑给道具
        var tool = null;
        
        if( data.num == 1 ){//第一次玩40%的概率没有豪礼
            var rand1 = Math.random();
            if( rand1 <= 0.6 ){
                tool = getTool( ret );
            }
        }else if( data.num == 2 ){//第二次玩, 10%的概率没有豪礼
            var rand2 = Math.random();
            if( rand1 <= 0.8 ){
                tool = getTool( ret );
            }
        
        }else{//第三次玩必须有豪礼
            tool = getTool( ret );
        }

        data.win = tool?1:0;

        console.log( '砸出来的豪礼是 ', tool ) 

        //给完之后记录一下这次砸金蛋的结果:
        dashixiong.insertUserActivity({
            data : JSON.stringify( data ),
            user_id : user_id,
            shop_id : 1,
            ac_id : 8 
        }, function (err, ret) {
            end( res, {
                code : 0,
                tool : tool,
                num_remain : 3-data.num
            });//end end
            
            if( !tool )return;
            //派发道具
            dashixiong.getTool({ 
                user_id : user_id,
                t_id : tool.id
            },  function (err, ret) {
                
            });

        });//end insertUserActivity
           
    });
});




};//end route


var request = require('request');
//var uutil = require('../lib/util');
var conf = require('../conf');
var API = require('wechat').API;
var api = new API(conf.wx.wx_app_id, conf.wx.wx_app_secret);
var dashixiong = require('../controllers/dashixiong');

//--------------------------- 日志配置 ---------------------------//
//var li = uutil.getLogger('INFO', 'res/wx_group.js');
//var ld = uutil.getLogger('DEBUG', 'res/wx_group.js');

var token_obj = null;

var no_group_wx_ids = [ ];

/*
* 111 : 1号店
* 112 ：2号店
* 113 ：3号店
* 115 ：5号店
* */
var shop_id = 5,
    to_group_id = 115;  //微信分组的组id

//console.log( '有'+ no_group_wx_ids.length +'个用户没有分组 ' );
//for( var i=0; i<no_group_wx_ids.length; i++ ){
//    no_group_wx_ids[i] = '\''+no_group_wx_ids[i]+'\'';
//}


//获取访问微信高级权限的access_token
var accessToken = function (fn) {
    var now = new Date().getTime();

    if( token_obj ){//看看是不是过期了, 过期之后得重新获取一下access_token
        if( now - token_obj.expires_in_future >= 0  ){//过期了
            console.log( 'access_token 过期了, set 为null. 即将重新请求' );
            token_obj = null; 
        }
    }
    
    if( !token_obj ){//还没有token 或者 token过期
        request({
        	url : 'https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid='+ conf.wx.wx_app_id +'&secret=' + conf.wx.wx_app_secret
        }, function(err, res_obj, body){
        	token_obj = JSON.parse(body);
            token_obj.expires_in_future = new Date().getTime() + token_obj.expires_in*1000;//未来某个时间过期, 目前微信token 过期的时间是120分钟(7200秒)

            console.log( '请求到的token是: ' );
            console.log( token_obj );

            fn&&fn( null, token_obj);
        });
        return;
    }
    
    console.log( 'access_token 还有'+ ( token_obj.expires_in_future - now )/1000  +'秒过期' );
    fn( null, token_obj );
    
};

var faild_users = [];


dashixiong.getUsersOfShop( shop_id, function (err, users) {
    console.log( users.length, '个用户在'+ shop_id +'号店' );
    users.forEach(function (user) {
        no_group_wx_ids.push( user.openId );
    });
    console.log( '有'+ no_group_wx_ids.length +'个openId ' );
    console.log( '开始分组...... ' );

    classify(to_group_id);
});



    var classify = function (to_groupid) {
        if( !to_groupid ){
            throw 'no to_groupid that weixin needed!'; 
        }
        var wx_id = no_group_wx_ids.shift();
        
        console.log( '将'+ wx_id +'移入'+to_groupid ) ;
        accessToken(function ( err, obj ) {
            request({
                url : 'https://api.weixin.qq.com/cgi-bin/groups/members/update?access_token='+obj.access_token,
                method : 'POST',
                body : JSON.stringify({
                    openid : wx_id,
                    to_groupid : to_groupid 
                })
            }, function (err, response, body) {
		try{
			var obj = JSON.parse( body );
			if( obj.errcode ){
			    console.log( '~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~分组失败' );
			    faild_users.push( wx_id );
			}else{
			    console.log( '########################################################################### 将'+ wx_id +'移入'+ to_groupid +'成功!!! ' );
			}
			console.log( body );
			console.log( '==============================================================');
			if( no_group_wx_ids.length ){
			    classify(to_groupid);
			    return;
			}
			console.log( '有'+ faild_users.length +'个用户无法处理 ' );
			console.log( faild_users );
		}catch(e){}
            });
        });//end accessToken
    };


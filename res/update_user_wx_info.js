var conf = require( '../conf' );
var API = require('wechat').API;
var api = new API(conf.wx.wx_app_id, conf.wx.wx_app_secret);
var pool = conf.getPool();  //打开数据库链接
var dao = require( '../models/dao' );

var query = 'select User.id,openId,userId,head,nick from User left join Open on User.id=Open.userId order by User.id desc';
//var query = 'select * from User';

pool.query( query, function (err, ret) {
    console.log( ret.length );
    popUpdate( ret, ret.length, function () {
        console.log( '搞定!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!' );
    });
    

});

var popUpdate = function (ary, len_origin, fn) {
    if( !ary || !ary.length ){
        fn&&fn();
        return;
    }
    
    console.log( '进度', ary.length+'/'+len_origin );
    var user = ary.shift();
    //获取这个用户的微信数据 

    api.getUser(user.openId, function (err, wx_user) {
		if(!wx_user){
            popUpdate( ary, len_origin, fn );
			return;
		}
        console.log( err, wx_user );
        var gender = 0;
        if( wx_user.sex == 0 ){
            gender = 2;//未知 
        }else if( wx_user.sex == 1 ){
            gender = 1;//男性
        }else if ( wx_user.sex == 2 ){
            gender = 0;//女性
        }
        //获取了用户的信息之后, 把这个信息更新到数据库
        dao.updateUser({
            id : user.id,
            head : wx_user.headimgurl,
            nick : wx_user.nickname,
            gender : gender 
        }, function (err, ret) {
            console.log( '============用户'+ user.id +'的数据更新成功! ' );
            popUpdate( ary, len_origin, fn );
        });
        
    });

    
    
};

//api.getUser(msg.fromUserName, function (err, wx_user) {
//
//
//});

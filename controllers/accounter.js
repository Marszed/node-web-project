var dao = require('../models/dao');
var hash = require( '../lib/md5' );
var cache = require( '../lib/cache' );
var util = require( '../lib/util' );
var dashixiong = require( '../controllers/dashixiong' );

//============================== 日志配置 ================================
var li = util.getLogger('INFO', 'accounter.js');
var ld = util.getLogger('DEBUG', 'accounter.js');


var prefix = 'dsx_wx_';//这个前缀只是用来在键值对数据库中辨识一下这条数据具体是哪个应用的
exports.getUserByEmail = function (email, fn) {
    dao.getUserByEmail(email, fn);
};
exports.cacheUser = function (user, fn) {
    cache.set(prefix+user.id, JSON.stringify(user), function(err){
        fn&&fn(err);
    });
};
exports.isTicketAvailableForUser = function (ticket, user_in_cache) {
    if(!ticket || !user_in_cache || !user_in_cache.tickets || !user_in_cache.tickets.length) {
        return false; 
    }
   
    var ret = false;
    //遍历用户所有可用的ticket, 一旦发现有相同即表示这个用登录成功了
    var i;
    for( i=0; i<user_in_cache.tickets.length; i++ ){
        if(user_in_cache.tickets[i] == ticket){
            ret = true; 
            break;//跳出forEach
        }
    }

    return ret;
};

exports.isTicketAvailableForUserId = function (ticket, user_id, fn) {
    exports.getUserFromCacheById(user_id, function (err, user_in_cache) {
        if(err){
            ld.debug( err );
            fn(err, false);
            return;
        }
       
        if(!ticket || !user_in_cache || !user_in_cache.tickets || !user_in_cache.tickets.length) {
            fn(null, false);
            return;
        }
   
        var ret = false;
        //遍历用户所有可用的ticket, 一旦发现有相同即表示这个用登录成功了
        for( var i=0; i<user_in_cache.tickets.length; i++ ){
            if(user_in_cache.tickets[i] == ticket){
                ret = true; 
                break;//跳出forEach
            }
        }

        fn(null, ret, user_in_cache);
    });
};

exports.isTicketObjAvailableForUser = function (ticket_obj, user_in_cache) {
    if( !ticket_obj )return false;
    var ticket = ticket_obj.ticket;//票
    var expire = ticket_obj.expire;//票过期时间
    if(!ticket || !user_in_cache || !user_in_cache.tickets || !user_in_cache.tickets.length) {
        return false; 
    }
    
    var tmp_time = new Date().getTime() - expire;
    if( tmp_time >= 1000*60*60*24 ){//这个票过期了, 不available了
        return false; 
    }
   
    var ret = false;
    //遍历用户所有可用的ticket, 一旦发现有相同即表示这个用登录成功了
    for( var i=0; i<user_in_cache.tickets.length; i++ ){
        if(user_in_cache.tickets[i] == ticket){
            ret = true; 
            break;//跳出forEach
        }
    }
    return ret;
};


exports.removeTicketByUserId = function (ticket, user_id, fn) {
    exports.getUserFromCacheById(user_id, function (err, user_in_cache) {
        if(err){
            fn(err);
            return;
        }
       
        //删除掉缓存中的相应ticket
        var ret = [];
        /*
        for( var i=0; i<user_in_cache.tickets.length; i++ ){
            if(user_in_cache.tickets[i] != ticket){
                ret.push(user_in_cache.tickets[i]);
            }
        }
        */
        //TODO: cache里面的东西没有设置过期，暂时处理方法改成一退出，就把这个用户的所有ticket清掉
        user_in_cache.tickets = ret;
        exports.cacheUser(user_in_cache, fn);

    });
};

exports.getUserFromCacheById = function (user_id, fn) {
    cache.get(prefix+user_id, function(err, str_obj){
        if(err){
            ld.debug( err );
        }
        var obj = null;
        try {
            obj = JSON.parse(str_obj);
        } catch (e) { }
        fn(err, obj);
    })
};
exports.loginInAction = function (user, fn) {
    li.info( '其他客户端(app/网页)自动登录...' );
    li.info( '数据库中的user是 ' );
    li.info( user );
    //先看看缓存中有木有user对象, 如果有就添加一个ticket. 如果没有, 则创建一个user对象, 然后准备set进内存
   exports.getUserFromCacheById(user.id, function (err, user_in_cache){
        if(err) {
            fn(err);
            return;
        }

        li.info( 'cache中的user是 ' );
        li.info( user_in_cache );
        if( user_in_cache && user_in_cache.wx_dsx_ticket ){//这个用户在cache中, 就要先清掉原来的ticket
            var t = user_in_cache.wx_dsx_ticket.ticket; 
        }

        if( !user_in_cache ){//缓存里没有user对象
            user_in_cache = util.$extend({}, user);
            user_in_cache.tickets = [];
        }else{
            console.log( '===================================================用数据库内的数据更新cache的数据 ' );
            util.$extend(user_in_cache, user);//用最新的user数据更新一下cache中的user数据
        }

        //生成这次登录的ticket
        var ticket = hash.md5( 'dsx_wx' + Math.random() + new Date().getTime() );
        user_in_cache.tickets.push(ticket);

        li.info( '更新后的user数据是 ' );
        li.info( user_in_cache );
        exports.cacheUser(user_in_cache, function (err){
            ld.debug( err );
            user.ticket = ticket;//ticket是本次登录的标识
            fn(null, true, user_in_cache, ticket);
        });
   });
};

exports.wxLoginInAction = function (user, fn) {
    li.info( '微信用户自动登录...' );
    //先看看缓存中有木有user对象, 如果有就添加一个ticket. 如果没有, 则创建一个user对象, 然后准备set进内存
   exports.getUserFromCacheById(user.id, function (err, user_in_cache){
        if(err) {
            fn(err);
            return;
        }

        if( user_in_cache && user_in_cache.wx_dsx_ticket ){//这个用户在cache中, 就要先清掉原来的ticket
            util.$extend(user_in_cache, user);//用最新的user数据更新一下cache中的user数据
            var t = user_in_cache.wx_dsx_ticket.ticket; 
            //删除掉缓存中的相应ticket, 每次登录就把上一次的ticket清掉
            var ret = [];
            for( var i=0; i<user_in_cache.tickets.length; i++ ){
                if(user_in_cache.tickets[i] != t){
                    ret.push(user_in_cache.tickets[i]);
                }
            }
            user_in_cache.tickets = ret;
        }else{//缓存里没有user对象
            user_in_cache = util.$extend({}, user);
            user_in_cache.tickets = [];
        }

        //生成这次登录的ticket
        var ticket = hash.md5( 'dsx_wx' + Math.random() + new Date().getTime() );
        user_in_cache.tickets.push(ticket);
        //专门为微信多增加一个属性, 以标示这个ticket是微信专有, 方便读取 
        user_in_cache.wx_dsx_ticket = {
            ticket : ticket,
            expires : new Date().getTime() + 1000*60*60*24//一天后过期
        };


        exports.cacheUser(user_in_cache, function (err){
            user.ticket = ticket;//ticket是本次登录的标识
            fn(null, true, user_in_cache, ticket);
        });
   });

};

exports.login = function (obj, fn) {
    //通过email 从数据库中获取用户, 然后比对pwd hash
    exports.getUserByEmail(obj.email, function (err, ret) {
        console.log('err=');
        console.log(err);
        if(!err){
            var user = ret[0];
            console.log( '==========getUserByEmail user is ', user );
            if(!user){//没有这个email, 说明这个email没有注册
                fn(null, false, null);
                return;
            }

            var pwd_hash = hash.md5(obj.pwd);
            if(pwd_hash == user.pwdHash){//密码配对, 登录成功
                console.log('密码配对! ');
                exports.loginInAction( user, function (err, isLogin, user_in_cache, ticket) {
                    fn(err, isLogin, user_in_cache, ticket, user.sectionId);
                });
                return;
            }//end if

            //密码对不上, 登录不成功
            fn(null, false, user);
            return;          
        }
        fn(err);
    });
};

exports.updateUserInCache = function (user, fn) {
    exports.getUserFromCacheById( user.id, function (err, user_in_cache) {
        console.log( '#########################', err );
        if( err ){
            fn(err); 
            return;
        }

        //如果用户user_in_cache 为空, 基本上这个用户是新用户
        if( !user_in_cache ){
            user_in_cache = {};
        }

        for( var p in user )  {
            if( p != 'id' ){
                user_in_cache[ p ] = user[ p ];
            }
        }
        exports.cacheUser( user_in_cache, fn);
    });
};

exports.newUser = function(obj, fn){
    dashixiong.newUser( obj, fn );
};

exports.bindUser = function(user_id, wx_id, fn){
    dashixiong.bindUser( user_id, wx_id, fn );
};



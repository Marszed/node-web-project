var hash = require( './md5' );
var cache = require( '../lib/cache' );

exports.isLogin = function(req, res, users){
    var pwd_hash = req.cookies.pwd_hash;

	var pwd = 'haoduojie@pyh';
	var pwd_worker  = 'dashixiong7788';
	var pwd_worker_primary  = 'dashixiong';
	var pwd_hash_on_server = hash.md5(pwd);
	var pwd_hash_for_worker_on_server = hash.md5(pwd_worker);
	var pwd_hash_for_worker_primary_on_server = hash.md5(pwd_worker_primary);
	
    //if( pwd_hash != pwd_hash_on_server && pwd_hash != pwd_hash_for_worker_on_server && pwd_hash != pwd_hash_for_worker_primary_on_server ){
    //    console.log('你丫不是老板, 也不是员工');
    //    return false;
    //}

	return true;
};

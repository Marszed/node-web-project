module.exports = function(getNewId){
    return function IdChecker(req, res, next){
   		var tmpt = req.cookies.tmpt;
		if(!tmpt){//如果没有id就生成一个id
			var tmp_t = getNewId('tmpt');
			res.cookie('tmpt', tmp_t);
			req.cookies.tmpt = tmp_t; 
		}
		next();
    };
};

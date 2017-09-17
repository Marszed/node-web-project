var dashixiong = require( '../controllers/dashixiong' );

function sure(ary){
    return ary && ary.length > 0 ? ary[0] : {};
}

exports.load_open_info = function(req, res, next){
    var user = req.user || {};

    if( user.id ){
        dashixiong.getUserById( user.id, function (err, ret) {
            if( !err ){
                req.open = sure(ret);
                req.open.openId = req.open.openId || 'wx_323mmdiVsds2fbklsdopwvMMn';
                next('route');
                return;
            }
            next('route');
        });
        return;
    }
    next('route');
};

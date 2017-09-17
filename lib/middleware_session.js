var uutil = require('../lib/util'),
    render = uutil.render;

//由于微信与服务器之间没有cookie, 没有办法确认身份
module.exports = function(req, res, next){
    var ticket = req.query.ticket;
    var user_id = req.query.user_id,
        wx_id = req.query.wx_id;
    var url = req.url;
    url = url.replace(/(\??&?user_id=[\d]+)|(\??&?ticket=[^&]+)|(\??&?wx_id=[^&]+)/ig,'');
    //测试用: /dashixiongwx/shop/1/community?wx_id=oXvPNjv6ZxctraFq85u4ro2m04S4&user_id=6&ticket=e879d5d3fb10ccfbf51f80ebc0345a23
    if( wx_id ) uutil.setCookie( 'wx_id', wx_id, res );
    if( user_id )uutil.setCookie( 'user_id', user_id, res );
    if( ticket )uutil.setCookie( 'wx_dsx_ticket', ticket, res);

    if( ticket || user_id && wx_id ){
        render(req, res, 'wx/session', {
            layout : true,
            url : url
        });
        return;
    }
    next();
};
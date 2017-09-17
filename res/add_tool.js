var conf = require('../conf'),
    conn = conf.getConnection();


conn.query('insert into Tool set expires=?,title=?,cValue=?,type=?,img=?,description=?', [1728000000, '女朋友', 200, 'coupon', 'http://img.ksmimi.com/uploads/articles/f0d1dcb667e88a019dd378e23c8b31d7.png', '空虚寂寞冷么？这就是你最想要的！'], function(err, ret){
    var ids = [];
    if( !err ){
        console.log('Good~');
    }
});

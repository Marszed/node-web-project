var dashixiong = require( '../controllers/dashixiong' );

//加载店铺的产品信息, 以便后续的handler需要这些信息来计算成本, 利润啥的
module.exports = function (req, res, next) {
    var pds = req.body.products,
        marker = {},
        pids = [];
    if( typeof pds == 'string' ) pds = JSON.parse(pds);
    pds.forEach(function(v, i){
        if( v.id ){
            //如果是6号店（呼叫大师兄）来的单，由于是拼餐，id有可能是“2194+2214”的形式
            if( typeof v.id == 'string' && v.id.indexOf('+') > -1 ){
                v.id.split('+').forEach(function(id, index){
                    if( !marker[id] ){
                        pids.push(id);
                        marker[id] = true;
                    }
                });
                return;
            }
            pids.push(v.id);
        }
    });
    dashixiong.listProducts( pids, function (err, products) {
        if( !err )  {
            var map = {};
            products.forEach(function (product, i) {
                map[ product.id ]  = product;
            });
            req.products_map = map;
        }
        next();
    });
};

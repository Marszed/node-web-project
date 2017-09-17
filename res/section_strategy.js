//有些分店在学校里面, 不能够明着卖酒卖烟( 他们不跟我买, 也会跟美宜佳买啊~ ) 
//这个是一个货架显示策略, 让那些已经买过酒、烟的同学能够看到我们烟酒货架
exports.doit = function (req, res, shop_id, sections, user_orders) {
    if( shop_id != 1 )return sections;//不是1号店就不需要这个策略
    if( req.query.smoke =='true' ) return sections;
    //三级以上权限能直接看到烟酒货架
    if(req.user.power>=3){
       return sections;
    }


    //检查一下这个客户的过往订单是不是 烟酒 购买户
    var is_client_specail = false;//特殊客户, 即烟酒客户. 默认不是特殊客户
    user_orders.forEach(function (order) {
        if( order.snapshot.indexOf( '香烟' ) != -1 || order.snapshot.indexOf( '酒' ) != -1 ){//购买过烟酒
            is_client_specail = true; 
            return false;
        }
    });
    
    if( is_client_specail ){//买烟酒的同学就显示全部货架
        return sections;  
    }

    //代码运行到这里, 说明这些用户都没买过烟酒, 或者从来没买过东西, 要隐藏烟酒货架
    var ret = [];
    sections.forEach(function (section) {
        if( section.tagName.indexOf( '香烟' ) == -1 && section.tagName.indexOf( '酒' ) == -1 ){
            ret.push( section );
        }
    });

    return ret;
};

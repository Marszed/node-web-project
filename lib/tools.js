var exchangeRP2RMB = function ( rp ) {
    return (rp/100).toFixed(1);
};

//代金券形式的道具
exports.coupon = function (tool_coupon, products, total_num, total_pay) {
    var total_pay = total_pay - exchangeRP2RMB( tool_coupon.cValue );
    var RP2RMB = exchangeRP2RMB( tool_coupon.cValue );
    if( total_pay < 0 ){
        total_pay = 0; 
    }
    return {
        products : products,
        total_num : total_num,
        total_pay : total_pay, //cValue 指的是我们系统内的货币——人品. 人品对人民币的汇率目前是10:1
        RP2RMB : RP2RMB
    };    
};

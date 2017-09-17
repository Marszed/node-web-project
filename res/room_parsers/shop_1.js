var uutil = require( '../../lib/util' );
var chinese_map = uutil.chinese_map;

exports.parser = function ( address ) {
    //----------------- 中文数组换成阿拉伯数字 -----------------//
    var ary_address = [];
    var tmp;
    for(var i=0; i<address.length; i++){
        tmp = address.charAt(i);
        if( chinese_map[ tmp ] !== undefined ){
            tmp = chinese_map[ tmp ];
        }
        ary_address.push( tmp );
    }
    address = ary_address.join( '' );
    //----------------------------------------------------

    address = address.replace( /\s/g, '' );
    var regx = /(\d{1,2})[洞棟栋幢懂董动冻\-，_\.\/~—。／～][^\d]*(\d{3})/;
    if( regx.test(address) ){
        var ret = regx.exec( address );
        return { 
            building : ret[1] - 0, 
            room : ret[2] - 0
        };
    }
    return null;//分析不出地址
};

//动态获取


//这个学校的宿舍分布情况
exports.buildings = [
    { num : 1, row : 6, col : 40  },
    { num : 2, row : 6, col : 40  },
    { num : 3, row : 6, col : 40  },
    { num : 4, row : 6, col : 40  },
    { num : 5, row : 6, col : 40  },
    { num : 6, row : 6, col : 40  },
    { num : 7, row : 6, col : 40  },
    { num : 8, row : 6, col : 40  },
    { num : 9, row : 7, col : 40  },
    { num : 10, row : 8, col : 40  },
    { num : 11, row : 7, col : 40  },
    { num : 12, row : 6, col : 40  },
    { num : 13, row : 6, col : 40  },
    { num : 14, row : 6, col : 40  },
    { num : 15, row : 6, col : 40  },
    { num : 16, row : 8, col : 40  },
    { num : 17, row : 6, col : 40  },
    { num : 18, row : 6, col : 40  },
    { num : 19, row : 6, col : 40  },
    { num : 20, row : 8, col : 40  }
];

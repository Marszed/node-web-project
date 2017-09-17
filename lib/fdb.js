var fs = require( 'fs' );
var db_path = './res/fdbs/';


exports.createDb = function (db_name, fn) {
    var file_path = db_path + db_name + '.js';
    console.log( 'file_path', file_path );
    fs.exists(file_path, function (exists) {
        console.log( 'exists', exists);
        if( !exists ){
            console.log( '创建文件 ', file_path );
            fs.writeFile(  file_path, '',  function (err) {
                console.log(err);
                fn(null);
            });     
            return;
        }
        fn(null);
    });
};



exports.use = function (db_name) {
    var file_path = db_path + db_name + '.js';
    var str = fs.readFileSync( file_path, 'utf8');
    var obj = JSON.parse( str );

    return {
        bind : function (set_name) {
            var set = obj[ set_name ];
            if( !set ){
                obj[ set_name ] = [];
            }
            //各种set的操作方法
            return {
                find : function (fn) {
                    var obj = this._read();
                    var set = obj[ set_name ];
                    (!set)&&( set = [] );
                    var ret = [];
                    for(var i=0; i<set.length; i++){
                        if( fn(set[i]) ) {
                            ret.push( set[i] );
                        }
                    }
                    return ret;
                },
                _read : function () {
                    console.log( file_path );
                    var str = fs.readFileSync( file_path, 'utf8');
                    obj = JSON.parse( str );                    
                    return obj;
                },
                _write : function (obj) {
                    return fs.writeFileSync(file_path, JSON.stringify(obj));
                },
                push : function ( item ) {
                    var db = this._read();
                    console.log(db);
                    db[set_name].push( item );
                    return this._write( obj );
                }
            };
        }//end bind
    }  
};

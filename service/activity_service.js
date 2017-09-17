var fs = require('fs');

var prefix = '../service/activities';

//这个service又去加载别的service, 这些service都是一些活动代码.
exports.route = function(app){
    var module = null;
    fs.readdir('service/activities', function (err, files) {
        files.forEach(function ( file_name ) {
            module = require( prefix + '/' + file_name );
            if( !module.isStop ){
                console.log( '-----加载web活动---->>' + file_name );
                module.route( app );
            }
        });
        
    });
};//end exports.route

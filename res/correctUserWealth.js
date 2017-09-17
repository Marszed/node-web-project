//11590, 18026, 2581
/*

delete from UserTool where id>12266 and userId=2581;
delete from UserTool where id>11423 and userId=18026;
delete from UserTool where id>10929 and userId=11590;
1737
1462

 delete from UserTool where id not in (select id from UserTool where timeStamp>'2014-12-08 00:00:00' group by userId) and timeStamp>'2014-12-08 00:00:00';

 */


var conf = require('../conf'),
    conn = conf.getConnection();

conn.query('select id from UserTool where timeStamp>? group by userId', ['2014-12-08 11:00:00'], function(err, ret){
    var ids = [];
    if( !err ){
        ret.forEach(function(v, i){
            ids.push(v.id);
        });
        conn.query('delete from UserTool where id not in (?) and timeStamp>"2014-12-08 00:00:00"', [ids], function(err, ret){
            if( !err ){
                console.log('affectedRows=' + ret.affectedRows);
                return;
            }
            console.log(err);
        });
    }
});

conn.query('select id from SignResult where type=2 and status=1 group by userId', function(err, ret){
    var ids = [];
    if( !err ){
        ret.forEach(function(v, i){
            ids.push(v.id);
        });
        conn.query('delete from SignResult where id not in (?) and type=2 and status=1', [ids], function(err, ret){
            if( !err ){
                console.log('affectedRows=' + ret.affectedRows);
                return;
            }
            console.log(err);
        });
    }
});

/**
 * Created by lufeng on 15-2-9.
 * 把数据的这个日期格式:yyyy-
 */
var conf = require('../conf'),
    conn = conf.getConnection();

conn.query('select id, timeStamp from CustomerEvaluation', function(err, rows){
    rows.forEach(function(row,i){
        (function(row,i,conn){
                var timeStamp = new Date(row.timeStamp).getTime();
                conn.query('update CustomerEvaluation set timeStamp2=? where id=?',[timeStamp,row.id], function(err){
                    if(err){
                        console.log(err);
                        return;
                    }
                    console.log('***** i = ' + i);
                });
        })(row,i,conn);
    });
});
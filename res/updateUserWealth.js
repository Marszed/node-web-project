/**
 * Created by lufeng on 14-12-15.
 */
var conf = require('../conf'),
    conn = conf.getConnection();

//更新福布斯财富榜
conn.query('select userId from UserWealth',function(err, ret){
    if(!err){
        var ids = [];
        ret.forEach(function(v, i){
           ids.push(v.userId);
        });

        conn.query('select userId,sum(cValue) as total from UserTool left join Tool on UserTool.tId=Tool.id where userId in (?) and isAvailable=1 group by userId', [ids], function(err_tool, ret_tool){
            ret_tool.forEach(function(v, i){
               var userId = v.userId,
                   total = v.total;
               conn.query('update UserWealth set val=? where userId=?', [total, userId], function(err, ret){
                  if( err ) console.log(ret);
                   console.log('done');
               });
            });
        });

        return;
        ret.forEach(function(user,index){
                conn.query('select tId from UserTool where userId=? and isAvailable=?',[user.userId,1],function(err2, ret2){
                    var userToolValues = 0;
                    ret2.forEach(function(toolId,index){
                        conn.query('select cValue from Tool where id=?',[toolId.tId],function(err3, ret3){
                            if(ret3.length>0){
                                userToolValues = userToolValues + ret3[0].cValue;
                            }

                        });
                    });
                    setTimeout(function(){
                        conn.query('update UserWealth set val=? where userId=?', [userToolValues, user.userId]);
                    }, 3000);

                });
        });
        console.log('更新完成～～～');
    }
});


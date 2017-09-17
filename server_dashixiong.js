var cluster = require('cluster'),
	fs = require('fs'),//用来写入pid
    //orkerNum = 2,
    workerNum = require('os').cpus().length,
	app = require('./app');
var port = 6789;
app.listen(port);
console.log('dashixiong server start at '+port);

/*
if(process.env.NODE_ENV == 'deployment'){
    app.ready(function(){
        app.listen(6789);
        console.log('dashixiong server start at 6789');
    });
    //app.listen(6789);//开发环境就一个进程就够了
    return;
}

if (cluster.isMaster) {
	var pid_filename = './pid';
	fs.writeFile(pid_filename, process.pid, function(err){
		if(err)return;
		console.log('====== 主进程的pid('+ process.pid +')已经写入文件 '+ pid_filename +' ======');
	});
    var messageHandler = function(msg){
            //restart all process
            if( msg.msg == 'restartAllProcess' ){
                for (var id in cluster.workers) {
                    cluster.workers[id].destroy();
                }
            }
        };
    //根据 CPU 个数来启动相应数量的 worker
    for (var i = 0; i < workerNum; i++) {
        var worker = cluster.fork().process;
        worker.on('message', messageHandler);
    }

    cluster.on('exit', function(worker) {
        console.log('worker ' + worker.id + ' died, but don\'t worry, restarted...');
        worker = cluster.fork().process;
        worker.on('message', messageHandler);
    });

    console.log('dashixiong master working...');
}else{
	app.ready(function(){
		app.listen(6789);
		console.log('dashixiong server start at 6789');
	});
}
*/

//捕获异常错误，避免进程挂掉
process.on('uncaughtException', function (exception) {
    console.log('========================================= 抛异常 start ================================================');
    console.log(exception);
    console.log('========================================= 抛异常 end ==================================================');
});

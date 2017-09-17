var cluster = require('cluster'),
    workerNum = 2,
	app = require('./app');

	if(process.env.NODE_ENV == 'deployment'){
		app.listen(6789);//开发环境就一个进程就够了
		return;
	}

if (cluster.isMaster) {
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

    console.log('dashixiong master  working...');
}else{
    app.listen(6789);
}

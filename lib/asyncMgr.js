//无序的异步操作
exports.AsyncAction = function(){
    this.asyncs = [];
};
exports.AsyncAction.prototype = {
    doneNum : 0,
    register : function(tickect){
        this.asyncs.push({
            t : tickect,
            done : false
        });
    },
    thisDone : function(tickect){
        var len = this.asyncs.length;
        for( var i=0; i<len; i++ ){
            if( this.asyncs[i].t==tickect&&this.asyncs[i].done===false ){
                this.asyncs[i].done = true;
                this.doneNum++; 
            }
        }
        if( this.doneNum == len && this.doneNum ){
            this.doneNum = 0;
            this.asyncs.length = 0;
            this.onAllDone();
        }
    },
    onAllDone : function(){}
};

//顺序的异步操作
exports.AsyncOrder = function(){
	this.orderList = [];
};
exports.AsyncOrder.prototype = {
	myTurn : function(fn){
		this.orderList.push(fn);	
		return this;
	},
	next : function(){
		var fn = this.orderList.shift();	
		//if(!fn){this.finish();return;}
		if(!fn){this.finish.apply(this, arguments);return;}
		fn.apply(this,arguments);
		return this;
	},
	finish : function(){},
	go : function(){
		this.next.apply(this,arguments);
		return this;
	}
};


//异步的数组操作: 有时候你有一个数组, 你想对每个数组元素都进行异步操作
exports.AsyncArray = function(ary, obj){
	this.ary = ary;
	this.obj = obj;
}
exports.AsyncArray.prototype = {
	forEach : function(fn){
		if(!this.ary||this.ary.length==0){
			this.onAllDone(null);
			return;
		}
		var a = new exports.AsyncAction();
		var allDoneParams = this.obj || {};//这个对象最后会传给onAllDone
		var This = this;
		a.onAllDone = function(){
			This.onAllDone(allDoneParams);
		}
		this.ary.forEach(function(v, i){
			a.register(v);
		});
		this.ary.forEach(function(v, i){
			fn(v, i, function(){
				a.thisDone(v);
			}, allDoneParams);
		});
	},
	onAllDone : function(obj){}
};


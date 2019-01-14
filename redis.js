var redis = require('redis');
var client = redis.createClient();
client.auth("poiuyhjkl@1234567890");

exports.DEBUG = false;

exports.guid = function () {
	return guid();
}

function guid() {
  function s4() {
    return Math.floor((1 + Math.random()) * 0x10000)
      .toString(16)
      .substring(1);
  }
  return s4() + s4() + '-' + s4() + '-' + s4() + '-' + s4() + '-' + s4() + s4() + s4();
}

exports.log = function (msg,d1,d2,d3)
{
	if (exports.DEBUG)
	{
		console.log("redis:" + msg,d1,d2,d3);
	}
}

exports.set = function (key, val, callback) 
{
	client.set(key, JSON.stringify(ret), function (e, msg)
	{
		if (callback) {
			callback(e,msg);
		}
	});
}

exports.keys = function (pattern, callback)
{
	exports.log("keys", pattern);
	client.keys(pattern, function (err, response) {
		if (callback)
		{
			callback(err,response);
		}
	});
}

exports.save = function (tablename, obj, callback)
{
	var data = {data: { }};
	data.data[tablename] = [];
	client.get(tablename, function (err, response) {
		var total = 0.0;
		var bFound = false;
		if (!err)
		{
			var ret = data;
			if (response == null)
			{
				response = data;
			} else {
				ret = JSON.parse(response);
			}
			for (var i=0; i < ret.data[tablename].length; i++)
			{
				var item = ret.data[tablename][i];
				item.order = i;
				if (item != null)
				{
					if (item.id == obj.id)
					{
						// overwrite existing item with
						// object that is passed into this function
						bFound = true;
						item = obj;
						item.order = i;
					}
					// total += parseFloat(item.amount);
					
					data.data[tablename].push(item);
				}
			}
		}
		// the case when an insert is being done.
		if (obj.id == null || !bFound)
		{
			if (obj.id == null || obj.id == undefined)
			{
				obj.id = guid();
			}
			//total += parseFloat(obj.amount);
			//total = total.toFixed(2);
			//data.total = total;
			
			obj.order = data.data[tablename].length;
			data.data[tablename].push(obj);
		} 
		if (bFound)
		{
			obj.action = "saved";
		} else {
			obj.action = "added";
		}
		data.count = data.data.length;
		client.set(tablename, JSON.stringify(data));
		if (callback)
		{
			callback(null, obj);
		}
	});
	
}

exports.get = function (tablename, callback)
{
	client.get(tablename, function (err, data) {
		if (callback)
		{
			var ret = {};
			if (data == null)
			{	
				var obj = "{\"data\": { \"" + tablename + "\" : []}}" ;
				ret = JSON.parse(obj);
				ret.count = ret.data[tablename].length;
				callback(err, ret);
			} else {
				ret = JSON.parse(data);
				ret.count = ret.data[tablename].length;
				callback(err, ret);
			}
		}
	});
}

exports.getone = function (tablename, id, callback)
{
	exports.get(tablename, function (err, data) {
		var users = data.data[tablename];
		for (var i=0; i < users.length; i++)
		{
			var user = users[i];
			if (user.id == id)
			{
				if (callback)
				{
					callback(null,user);
				}
			}
		}
	});
}

exports.del = function (tablename, id, callback)
{
	exports.get(tablename, function (err, ret)
	{
		var newArray = [];
		var bFound = false;
		for (var i=0; i < ret.data[tablename].length; i++)
		{
			var item = ret.data[tablename][i];
			if (item.id != id)
			{
				newArray.push(item);
			} else {
				bFound = true;
			}
		}
		
		
		ret.data[tablename] = newArray;
		ret.count = newArray.length;
		client.set(tablename, JSON.stringify(ret), function (e, msg)
		{
			exports.log("ERROR>>>>>>>>" + e);
			exports.log("MSG>>>>>>>>>>" + msg);
			if (callback)
			{
				if (bFound)
				{
					ret.msg = msg + " Item Successfully Removed";
				} else {
					ret.msg = msg + " Item not Found";
				}
				callback(e, ret);
			}
		});
	});
}

exports.delAll = function (tablename, callback)
{
	client.del(tablename);
	if (callback)
	{
		callback(null, {"msg" : tablename + ' successfully deleted'});
	}
}

exports.filter = function (tablename, data, options)
{
	var ret = [];
	//var options = {options: [{name: 'login', value: 'admin@yahoo.com'}]};
	//console.log(options.options);
	//console.log(options.options.length);
	//console.log(tablename);
	//console.log(data['data'][tablename].length);
	if (options == undefined)
	{
		return;
	}
	if (options.options == undefined)
	{
		return;
	}
	for (var i=0; i < data['data'][tablename].length; i++)
	{
		var obj = data['data'][tablename][i];
		
		bValid = false;
		for (var o=0; o < options.options.length; o++)
		{
			//console.log(obj[options.options[o].name] + "=" + options.options[o].value + "=" + obj[options.options[o].name].indexOf(options.options[o].value));
			if (obj[options.options[o].name].toLowerCase().indexOf(options.options[o].value.toLowerCase()) == 0) {
				bValid = true;
			}
		}
		if (bValid)
		{
			ret.push(obj);
		}
	}
	data['data'][tablename] = ret;
	data.count = data['data'][tablename].length;
}

exports.notfilter = function (tablename, data, options)
{
	var ret = [];
	//var options = {options: [{name: 'login', value: 'admin@yahoo.com'}]};
	//console.log(options.options);
	//console.log(options.options.length);
	//console.log(tablename);
	//console.log(data['data'][tablename].length);
	if (options == undefined)
	{
		return;
	}
	if (options.options == undefined)
	{
		return;
	}
	for (var i=0; i < data['data'][tablename].length; i++)
	{
		var obj = data['data'][tablename][i];
		
		bValid = false;
		for (var o=0; o < options.options.length; o++)
		{
			//console.log(obj[options.options[o].name] + "=" + options.options[o].value + "=" + obj[options.options[o].name].indexOf(options.options[o].value));
			if (obj[options.options[o].name].toLowerCase().indexOf(options.options[o].value.toLowerCase()) == 0) {
				bValid = true;
			}
		}
		if (!bValid)
		{
			ret.push(obj);
		}
	}
	data['data'][tablename] = ret;
	data.count = data['data'][tablename].length;
}

exports.param = function (name, options, _default)
{
	var ret = _default;
	if(options[name] != undefined)
	{
		ret = options[name];
	}
	return ret;
}

exports.sort = function (tablename, data, options)
{
	exports.log(options);
	// { s: 'first_name', d: 'desc', t: 'alpha' }

	var sortparameter = options.s;
	var sorttype = options.t;
	var sortdirection = options.d;

	exports.log("sortdirection=" + sortdirection);
	exports.log(options.t);
	exports.log(options["t"]);
	exports.log(options);
            // example could sort the data before returning
	data.data[tablename].sort(function(obj1, obj2) {
			// Ascending: first age less than the previous
		if (sorttype == "numeric" && sortdirection == "asc")
		{
			return parseFloat(obj1[sortparameter]) > parseFloat(obj2[sortparameter]);
		}
		if (sorttype == "numeric" && sortdirection == "desc")
		{
			return parseFloat(obj1[sortparameter]) < parseFloat(obj2[sortparameter]);
		}
		if (sorttype == "alpha" && sortdirection == "asc")
		{
			return obj1[sortparameter].toLowerCase() > obj2[sortparameter].toLowerCase();
		}
		if (sorttype == "alpha" && sortdirection == "desc")
		{
			return obj1[sortparameter].toLowerCase() < obj2[sortparameter].toLowerCase();
		}
	});
}

exports.page = function (tablename, data, options)
{
	exports.log(options);
	var skip = exports.param('skip', options, 0);
	var take = exports.param('take', options, -1);
	exports.log(take);
	var arrData = data.data[tablename];
	
	var ret = [];
	for (var i=0; i < arrData.length; i++)
	{
		var obj = arrData[i];
		if ((i >= skip && i < (parseInt(skip) + parseInt(take))) || parseInt(take) == -1)
		{
			obj.index = i;
			ret.push(obj);
		}
	}
	data.data[tablename] = ret;
	data.length = ret.length;
	data.skip = parseInt(skip);
	data.take = parseInt(take);
}

var fs = require('fs');
var db = require('./redis.js');
const bcrypt = require('bcrypt-nodejs');

exports.guid = function() {
  function s4() {
    return Math.floor((1 + Math.random()) * 0x10000)
      .toString(16)
      .substring(1);
  }
  return s4() + s4() + '-' + s4() + '-' + s4() + '-' + s4() + '-' + s4() + s4() + s4();
}

exports.log = function (msg) {
	console.log("validate:" + msg);
}
exports.addFirstUser = function () {
	var adminuser = {"name":"Administrator","apikeycode":"admin","roles":[{"name":"administrator","read":1,"edit":1,"create":1,"delete":1},{"name":"public","read":1,"edit":0,"create":0,"delete":0}],"login":"admin@pda.com","password":bcrypt.hashSync("password"),"id":db.Guid};
	db.get("users", function (err, userdata) {
		var bExists = false;
		for (var i=0; i < userdata.data.users.length; i++)
		{
			var user = userdata.data.users[i];
			if (user.login == "admin@pda.com")
			{
				bExists = true;
			}
		}
		if (!bExists) {
			adminuser.order = userdata.data.users.length;
			db.save("users", adminuser, function (err, data) {
				
			});
		}
	});
}

// api/v2/pda_additionalfees/all
exports.addAdditionalFees = function ()
{
	db.get("admin_pda_additionalfees", function (err, data) {
		if (data.data["admin_pda_additionalfees"].length == 0) {
			db.set("admin_pda_additionalfees",JSON.parse("{\"data\":{\"admin_pda_additionalfees\":[{\"name\":\"TUITION FEE\",\"created\":\"2018-11-10T22:41:28.444Z\",\"createdBy\":\"Administrator\",\"id\":\"ab9fa6a4-a5ab-70ce-7a83-0a22ed534a95\",\"order\":0,\"action\":\"added\"},{\"name\":\"STUDENT SERVICES FEES\",\"created\":\"2018-11-10T22:41:36.634Z\",\"createdBy\":\"Administrator\",\"id\":\"d7533879-7420-60c7-1077-1df1b6084929\",\"order\":1,\"action\":\"added\"},{\"name\":\"LAB AND PRINTING FEES\",\"created\":\"2018-11-10T22:41:45.075Z\",\"createdBy\":\"Administrator\",\"id\":\"e17e3605-3f32-be02-8368-6ebb1576e256\",\"order\":2,\"action\":\"added\"},{\"name\":\"OTHER FEES\",\"created\":\"2018-11-10T22:41:54.122Z\",\"createdBy\":\"Administrator\",\"id\":\"96af6453-a9ff-03ae-1bd1-fc14698cf4ff\",\"order\":3,\"action\":\"added\"},{\"name\":\"STUDENT RECORD ARCHIVING FEE\",\"created\":\"2018-11-10T22:42:02.147Z\",\"createdBy\":\"Administrator\",\"id\":\"169e02f3-d83c-bbc9-89e9-86fa6b35029f\",\"order\":4,\"action\":\"added\"},{\"name\":\"TOTAL FEES OWED UNDER THIS CONTRACT\",\"created\":\"2018-11-10T22:42:12.259Z\",\"createdBy\":\"Administrator\",\"id\":\"7f2f2754-0b14-7b1c-054e-3e584105dca1\",\"order\":5,\"action\":\"added\"}]}}"), function (err, data) {
				exports.log("error", error);
				exports.log("data", data);
			});
		}
	});
}
 
exports.populateTable = function (tablename)
{
	db.get(tablename, function (err, data) {
		if (data.data[tablename].length == 0) {
			fs.readFile("data/" + tablename + ".json", function (err2, datafile) {
				if (!err2) {
					db.set(tablename, new Buffer(datafile).toString(), function (e,d) {
						exports.log("error", e);
						exports.log("data", d);
					});
				}
			})
		}
	});
}

exports.registeruser = function (_user, callback)
{
	var bValid = false;
	db.get("users", function (err, userdata) {
		if (userdata != null)
		{
			var users = userdata.data.users;
			for (var i=0; i < users.length; i++)
			{
				var dbUser = users[i];
				/********* MAIN CODE WHERE ACTUAL USER AUTHENTICATION TAKES PLACE ****************/
				// bcrypt.compareSync("bacon", hash)
		        if (dbUser.login == _user.login)
		        {
		            bValid = true;
		            ret = dbUser;
		        } 
			}
			if (!bValid)
			{
				_user.login = _user.login;
				_user.password = _user.password;
				if (_user['payments'] == undefined)
				{
					_user['payments'] = [];
				}
				db.save("users", _user, function (e, results) {
					if (callback)
					{
						callback(e, _user);
					}
				});	
			} else {
				if (callback)
				{
					callback(exports.error(401,"User already exists in the system", []), null);
				}
			}
		}
	});
}

// Validates that a user exists against our redis database.
exports.validate = function (_user, callback)
{
	var bValid = false;
	var ret = null;
	db.get("users", function (err, userdata) {
		if (userdata != null)
		{
			var users = userdata.data.users;
			for (var i=0; i < users.length; i++)
			{
				var user = users[i];
				/********* MAIN CODE WHERE ACTUAL USER AUTHENTICATION TAKES PLACE ****************/
				exports.log(_user.password + "=" + user.password);
		        if (user.login == _user.login && bcrypt.compareSync(_user.password, user.password))
		        {
		            bValid = true;
		            ret = user;
					if (ret['payments'] == undefined)
					{
						ret['payments'] = [];
					}
		        } 
			}
			
			if (callback)
			{
				callback(bValid, ret);
			} 
		}
	});
}

// Validates that a user exists against our redis database.
exports.validatebykey = function (_apikeycode, callback)
{
	var bValid = false;
	var ret = null;
	db.get("users", function (err, userdata) {
		if (userdata != null)
		{
			var users = userdata.data.users;
			for (var i=0; i < users.length; i++)
			{
				var user = users[i];
				/********* MAIN CODE WHERE ACTUAL USER AUTHENTICATION TAKES PLACE ****************/
				exports.log(_apikeycode + "=" + user.apikeycode);
		        if (user.apikeycode == _apikeycode)
		        {
		            bValid = true;
		            ret = user;
		        } 
			}
			
			if (callback)
			{
				callback(bValid, ret);
			} 
		}
	});
}

// Developed as a middleware component to validating a user
// This function calls validate which does the heavy lifting for this call.
exports.validateuser = function (req, res, next)
{
    var bValid = false;
    var ret = {};
	if (exports.validate(req.body, function (bValid, dbUser) {
		if (bValid)
		{
			req.session.user = dbUser;
			next();
		} else {
			var error = {statuscode: 403, msg: "User not logged in", errors: ["User does not have permission to login"]};
	        res.send(error);
		}
	})); 
}

// Developed as a middleware component to validating a user
// This function calls validate which does the heavy lifting for this call.
exports.validateuserbykey = function (req, res, next)
{
	if (req.session.user != undefined)
	{
		next();
		return;
	}
    var bValid = false;
    var ret = {};
	if (exports.validatebykey(req.query.apikeycode, function (bValid, dbUser) {
		if (bValid)
		{
			req.session.user = dbUser;
			next();
		} else {
			var error = {statuscode: 403, msg: "User not logged in", errors: ["User does not have permission to login"]};
	        res.send(error);
		}
	})); 
}

exports.error = function (statuscode, msg, errors)
{
	if (errors == null)
		errors = [];
	var error = {statuscode: statuscode, msg: msg, errors: errors};
	return error;
}

exports.dofieldsexist = function (fieldlist, obj, errors)
{
	var fields = fieldlist.split(",");
	//var errors = [];
	fields.forEach (function (field)
	{
		if (obj[field] == undefined)
		{
			errors.push({name:field, value:"field is not defined on the form"});
		}
	});
}

exports.fieldsrequired = function (fieldlist, obj, errors)
{
	var fields = fieldlist.split(",");
	fields.forEach (function (field)
	{
		if (obj[field] == null || obj[field].length == 0 || (obj[field] + "").trim().length == 0)
		{
			errors.push({name:field, value:"required field"});
		}
	});
}

exports.validateuserinputs = function (req, res, next)
{
    var bValid = exports.validateuser_registration(req, res);
	if (bValid)
	{
		next();
	} else {
        res.send(error);
	}
}

exports.validateuser_registration = function (req, res)
{
    var bValid = false;
    var ret = {};
	var error = {statuscode: 403, msg: "Invalid Fields", errors: []};
	exports.dofieldsexist("reg_name,reg_login,reg_password", req.body, error.errors);
	exports.fieldsrequired("reg_name,reg_login,reg_password", req.body, error.errors);
	bValid = (error.errors.length == 0);

	return bValid;
}


exports.isloggedin = function (req, res, next)
{
    if (req.session.user != null)
        next();
    else
    {
        var error = {statuscode: 403, msg: "User not logged in", errors: []};
        res.send(error);
    }
}

exports.writesecurity = function (req, res, next)
{
    if (exports.check(req.session.user,"create"))
        next();
    else
    {
		var error = exports.error(403,"Write security check failure",["User does not have permission to create"]);
        res.send(error);
    }
}

exports.readsecurity = function (req, res, next)
{
    if (exports.check(req.session.user,"read"))
        next();
    else
    {
		var error = exports.error(403,"Read security check failure",["User does not have permission to read"]);
        res.send(error);
    }
}

exports.deletesecurity = function (req, res, next)
{
    if (exports.check(req.session.user,"delete"))
        next();
    else
    {
		var error = exports.error(403,"Read security check failure",["User does not have permission to delete"]);
        res.send(error);
    }
}

exports.editsecurity = function (req, res, next)
{
    if (exports.check(req.session.user,"edit"))
        next();
    else
    {
		var error = exports.error(403,"Read security check failure",["User does not have permission to edit"]);
        res.send(error);
    }
}

exports.isadministrator = function (req,res,next)
{
	var user = req.session.user;
	if (user == null)
		return false;
	
    if (exports.isrole(user, "administrator"))
	{
		next();
	} else {
		var error = exports.error(403,"Administrator security check failure",["User does not have permission to site"]);
        res.send(error);
	}
}

exports.ispublic = function (req,res,next)
{
	var user = req.session.user;
	if (user == null)
		return false;
	
    if (exports.isrole(user, "public"))
	{
		next();
	} else {
		var error = exports.error(403,"Public security check failure",["User does not have permission to site"]);
        res.send(error);
	}
}

exports.isrole = function (user, rolename)
{
    var flag = false;
	if (user.roles == undefined)
		return false;
  	for (var j=0; j < user.roles.length; j++)
    {
        var role = user.roles[j];
        if (role['name'] == rolename) // equivalent of hard-coding role.create, role.read, role.delete, role.anything
        {
           flag = true;
           return flag;
        }
    }
    return flag;
}

exports.check = function (user, action)
{
    var flag = false;
	if (user.roles == undefined)
		return;
  for (var j=0; j < user.roles.length; j++)
    {
        var role = user.roles[j];
        if (role[action] == 1) // equivalent of hard-coding role.create, role.read, role.delete, role.anything
        {
           flag = true;
           return flag;
        }
    }
    return flag;
}

exports.securepayments = function(req,res,next)
{
    if (exports.isrole(req.session.user, "administrator"))
	{
		next();
		return;
	}
	var tablename = req.params.tablename;
	if (tablename.indexOf('payments_') != -1)
	{
		if (tablename.indexOf(req.session.user.login) != -1)
		{
			next();
			return;
		} else {
			var error = exports.error(403,"security check failure",["May not access another users payments. Please contact your administrator"]);
	        res.send(error);
		}
	} else {
		next ();
		return;
	}
}

exports.enable_cross_scripting = function (req, res, next)
{
	res.setHeader('content-type', 'text/javascript');
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
	next();
}

// function to change password
exports.changepassword = function (id, oldpassword1, oldpassword2, newpassword, callback) {
	db.getone("users", id, function (err, user) {
		var error = null;
		var errors = [];
		
		if (oldpassword1 != oldpassword2)
		{
			errors.push("Passwords entered do not match");
		}
		
		if (user == null)
		{
			errors.push("User not found");
			
		} else {
			if (!bcrypt.compareSync(oldpassword1, user.password)) {
				errors.push("Incorrect password");
			}
		}

		if (errors.length > 0)
		{
			error = exports.error(403,"security check failure",errors);
		} else {
			user.password = bcrypt.hashSync(newpassword);
		}
		
		db.save("users",user, function (dbError, dbData) {
			if (callback) {
				callback(error, dbData);
			}
		});
	});
}

exports.resetpassword = function (id, callback) {
	db.getone("users", id, function (err, user) {
		var error = null;
		var errors = [];		
		if (user == null)
		{
			errors.push("User not found");	
		} 

		if (errors.length > 0)
		{
			error = exports.error(403,"security check failure",errors);
		} else {
			user.password = bcrypt.hashSync("password");
		}
		
		db.save("users",user, function (dbError, dbData) {
			if (callback) {
				callback(error, dbData);
			}
		});
	});
}






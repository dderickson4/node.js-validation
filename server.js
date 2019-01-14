// node/bin/node node/bin/npm install express
// node/bin/node server.js
var http = require('http');
var url = require('url');
var fs = require('fs');
var bodyParser = require('body-parser');
var session = require('express-session');
// export modules importing
var db = require('./routes/redis.js');
var bcrypt = require('bcrypt-nodejs');
var oath = require('./routes/validate.js');
var utility = require('./routes/utility.js');
var s = require('./routes/strings.js');
var stripe_key = "sk_test_XqpdQtTQ6Uytbk2wAGrQ1YLJ";
const stripe = require('stripe')(stripe_key);
var express = require('express');
var redis = require('redis');
const request = require('request');

db.log("stripe key:",stripe_key);

var client = redis.createClient();
client.auth("poiuyhjkl@1234567890");

var app = express();

app.set('view engine', 'ejs');
app.use(express.static('public'));
app.use(express.static('data'));
// support parsing of application/json type post data
app.use(bodyParser.json());

//support parsing of application/x-www-form-urlencoded post data
app.use(bodyParser.urlencoded({ extended: true }));

var sess = {
  secret: 'keyboard cat',
  cookie: {}
}
if (app.get('env') === 'production') {
  app.set('trust proxy', 1) // trust first proxy
  sess.cookie.secure = true // serve secure cookies
}
app.use(session(sess));

/************ DECLARE BASIC VARIABLES *************/

// variable used for debugging
var DEBUG = true;
db.DEBUG = false;
/*********** INITIALIZATION AND CONFIGURATION INFORMATION *********************/
db.log("addFirstUser()");
oath.addFirstUser(); // will add a first user if one doesn't exist
// /api/v2/pda_additionalfees/all
oath.addAdditionalFees(); // checks if fees exist then adds them if there are none.

// will populate pdafees if none exists.
oath.populateTable("admin_pdafees");

/*********** COMMON UTILITY FUNCTIONS **************/
function log (msg, req, res) {
	if (DEBUG) {
		db.log("Server:" + msg);
	}
}
/*********** END COMMON UTILITY FUNCTIONS **************/

/************ BASIC LOGIN SECTION *****************/

app.get ('/', function (req, res) {
	fs.readFile("./public/login.html", function (error, pgResp) {
    if (error) {
        res.writeHead(404);
        res.write('Contents you are looking are Not Found');
    } else {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.write(pgResp);
    }         
	res.end();
	});
});

app.get ('/login', function (req, res) {
	if (req.session.user == undefined) {
		fs.readFile("./public/login.html", function (error, pgResp) {
	    if (error) {
	        res.writeHead(404);
	        res.write('Contents you are looking are Not Found');
	    } else {
	        res.writeHead(200, { 'Content-Type': 'text/html' });
	        res.write(pgResp);
	    }         
		res.end();
		});
	} else {
		res.render('user',{user:req.session.user});
	}
});

app.get ('/logout', function (req, res) {
	fs.readFile("./public/login.html", function (error, pgResp) {
    if (error) {
        res.writeHead(404);
        res.write('Contents you are looking are Not Found');
    } else {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.write(pgResp);
    }         
	res.end();
	});
});


app.post('/login', function (req, res)
{
	log('/login',req, res);
	if (oath.validate(req.body, function (bValid, dbUser) {
		if (bValid)
		{
			req.session.user = dbUser;
			res.render('user',{user:req.session.user});
		} else {
			var error = {statuscode: 403, msg: "Sorry, we don't recognize " + req.body.login + ".", errors: ["User does not have permission to login"]};
	        res.render('login',error);
		}
	})); 
});

app.get('/login', oath.isloggedin, function (req, res)
{
	res.render('user',{user:req.session.user});
});

app.post('/user/payment', oath.isloggedin, findpayment, function (req, res) {
	db.log(req.body);
	//{ total: '24004', stripeToken: 'tok_E1OJti2GwjUBVM' }
	// Token is created using Checkout or Elements!
	// Get the payment token ID submitted by the form:
	// Using Express
	var token = req.body.stripeToken; 
	var total = parseFloat(req.body.total)*100;
	var id = req.body.id;
	db.log(token);
	db.log(total);

	const charge = stripe.charges.create({
	  amount: total,
	  currency: 'cad',
	  description:  'Pacific Design Academy Tuition ' + req.session.user.name,
	  source: token,
	}, function(err, charge) {
		console.log("************************");
		console.log("************************");
		console.log("************************");
		console.log("************************");
		console.log(id);
		console.log("************************");
		console.log("************************");
		console.log("************************");
		console.log(charge);
		db.log(charge);
		var ret = {};
		ret['data'] = charge;
		ret['error'] = err;
		
		// 'charge,amount_refunded,description,country,brand,paid'
		var index = -1;
		for (var i=0; i < req.session.user.payments.length; i++)
		{
			var payment = req.session.user.payments[i];
			if (payment.id == id)
			{
				index = i;
			}
		}
		
		if (index == -1)
		{
			for (var i=0; i < req.session.user.payments.length; i++)
			{
				var payment = req.session.user.payments[i];
				if (payment.statuscode == 'UnPaid')
				{
					index = i;
				}
			}
		}
		if (err)
		{
			req.session.user.payments[index]['statuscode'] = 'UnPaid';
			req.session.user.payments[index]['error'] = err.message;
		} else {
			
			var totalpayment = 0.0;
			var payment = req.session.user.payments[index];
			if (payment['charges'] != null)
			{
				for (var i=0; i < payment.charges.length; i++)
				{
					totalpayment += payment.charges[i].data.amount/100;
				}
			}
			totalpayment += parseFloat(charge.amount/100);
			
			
			
			if (totalpayment == req.session.user.payments[index].GRANDTOTAL) {
				req.session.user.payments[index]['statuscode'] = charge.status;
			} else {
				req.session.user.payments[index]['statuscode'] = "UnPaid";
			}
			delete req.session.user.payments[index]['error'];	
		}
		
		req.session.user.payments[index]['year'] = new Date().getYear();
		req.session.user.payments[index]['date'] = new Date();

		if (req.session.user.payments[index].charges == undefined)
		{
			req.session.user.payments[index].charges = [];
		}
		req.session.user.payments[index].charges.push(ret);
		// save the results to keep track of charges being made
		db.save('charges_' + req.session.user.login, ret, function (e,d) {
			
			db.save('users',req.session.user, function (saverr, savedata) {
				res.render("charge", ret);
			});
			
		});		
	});
});
/*********** SECTION ENDS FOR PAYMENTS

/*********** SECTION STARTS FORM ADMINISTRATION ****************/
function displayname (name)
{
	var bCaps = false;
	var ret = "";
	for (var i=0; i < name.length; i++)
	{
		
		var ch = name[i];
		if (i == 0) ch = ch.toUpperCase();
		
		if (bCaps == true)
		{
			ch = ch.toUpperCase();
			bCaps = false;
		}
		if (ch == "_") {
			bCaps = true;
			ch = " ";
		}
		ret += ch;
	}
	return ret;
}

/*********** SECTION ENDS FORM ADMINISTRATION ******************/


/*********** API ROUTES END HERE **************/
var port = 3000;
console.log("Pacific Design Academy listening on port ", port);
app.listen(port);


listfiles("./");

var totallines = 0;
function listfiles(dir) {
	fs.readdir(dir, (err, files) => {
	  files.forEach(file => {
		if(fs.lstatSync(dir + file).isDirectory()) {
			if (file.indexOf("_") == -1)
			{
				listfiles(dir + file + "/");
			}
		} else {
			var numLines = 0;
			fs.createReadStream(dir + file).on('data', function readStreamOnData(chunk) {
				numLines += chunk
					.toString('utf8')
					.split(/\r\n|[\n\r\u0085\u2028\u2029]/g)
					.length-1;
					
					totallines += numLines;
					console.log(file + ":" + numLines);
			});
			
		}
	  });
	});
	console.log("totallines:" + totallines);
}










var express = require('express');
var path = require('path');

var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');

var index = require('./routes/index');
var secure = require('./routes/secure');
var auth = require('./routes/auth.js');
var session = require('express-session');
var expressProxy = require('express-http-proxy');
var proxyMiddleware = require('http-proxy-middleware');
var environmentVars = require('./config.json');
var url = require('url');
var HttpsProxyAgent = require('https-proxy-agent');


// Setting up express server
var app = express();

// Setting up express server port
var config = {
	express: {
		port: process.env.VCAP_APP_PORT || 3000
	}
};

// Setting up option for UAA
var clientId = '';
var uaaUri = '';
var applicationUrl = '';
var base64ClientCredential = '';
var timeseriesZone = '';
var timeseriesURL = '';


// checking NODE_ENV to load cloud properties from VCAPS
// or development properties from config.json
var node_env = process.env.node_env || 'development';
if(node_env == 'development') {
	var devConfig = environmentVars[node_env];
	//console.log(devConfig);
	clientId = devConfig.clientId;
	uaaUri = devConfig.uaaUri;
	base64ClientCredential  = devConfig.base64ClientCredential;
	applicationUrl = devConfig.appUrl;
	timeseriesZone = devConfig.timeseries_zone;
	timeseriesURL = devConfig.timeseriesURL;

} else {
	// read VCAP_SERVICES
	var vcapsServices = JSON.parse(process.env.VCAP_SERVICES);
	var uaaService = vcapsServices[process.env.uaa_service_label];
	var timeseriesService = vcapsServices['predix-timeseries'];

	var uaaUri = '';

	if(uaaService) {
		//console.log('UAA service URL is  '+uaaService[0].credentials.uri)
		uaaUri = uaaService[0].credentials.uri;
	}
	if(timeseriesService) {
		timeseriesZone = timeseriesService[0].credentials.query["zone-http-header-value"];
		timeseriesURL = timeseriesService[0].credentials.query.uri;
	}
	// read VCAP_APPLICATION
	var vcapsApplication = JSON.parse(process.env.VCAP_APPLICATION);
	applicationUrl = 'https://'+vcapsApplication.uris[0];
	//console.log('First applicationUrl is '+applicationUrl)

	// read env properties
	clientId = process.env.clientId;
	base64ClientCredential = process.env.base64ClientCredential;

}

/* Setting the uaa Config used in the router auth.js*/

	var uaaConfig = {
			clientId: clientId,
			uaaUri : uaaUri,
	    defaultClientRoute : '/index.html',
	    base64ClientCredential: base64ClientCredential,
			callbackUrl: applicationUrl+'/callback',
			appUrl: applicationUrl,
			timeseriesZone: timeseriesZone,
			timeseriesURL: timeseriesURL
		};

		console.log('************'+node_env+'******************');
		console.log('uaaConfig.clientId = ' +uaaConfig.clientId );
		console.log('uaaConfig.uaaUri = ' +uaaConfig.uaaUri );
		console.log('uaaConfig.defaultClientRoute = ' +uaaConfig.defaultClientRoute );
		console.log('uaaConfig.base64ClientCredential = ' +uaaConfig.base64ClientCredential );
		console.log('uaaConfig.callbackUrl = ' +uaaConfig.callbackUrl );
		console.log('uaaConfig.appUrl = ' +uaaConfig.appUrl );
		console.log('uaaConfig.timeseriesZone = ' +uaaConfig.timeseriesZone );
		console.log('uaaConfig.timeseriesURL = ' +uaaConfig.timeseriesURL );
		console.log('*******************************');
		app.set('connectedDeviceConfig', uaaConfig);




var server = app.listen(config.express.port, function () {
  var host = server.address().address;
  var port = server.address().port;
	console.log ('Server Started at ' + uaaConfig.appUrl);
});

//Initializing application modules
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());

// Initializing default session store
// *** this session store in only development use redis for prod **
app.use(session({
	secret: 'predixsample',
	name: 'cookie_name',
	proxy: true,
	resave: true,
	saveUninitialized: true}));

//Initializing auth.js modules with UAA configurations
app.use(auth.init(uaaConfig));

app.get('/favicon.ico', function (req, res) {
  res.send('favicon.ico');
});
//Setting up the proxy for calling the windService microservice from the client
//Since the headers needs to be modified with Authorization header
//and content-type

app.use(express.static(path.join(__dirname, 'public')));

// callback endpoint to removeSession
app.get('/removeSession', function (req, res ,next) {
	auth.deleteSession(req);
	res.redirect("/");
});

//Setting routes
app.use('/', index);
app.use('/secure', secure);


// catch 404 and forward to error handler
app.use(function(req, res, next) {
  var err = new Error('Not Found');
  err.status = 404;
  next(err);
});

// error handlers

// development error handler
// will print stacktrace
if (app.get('env') === 'development') {
	app.use(function(err, req, res, next) {
		if (!res.headersSent) {
	    res.status(err.status || 500);
	    res.send({
	      message: err.message,
	      error: err
	    });
		}
	});
}

// production error handler
// no stacktraces leaked to user
app.use(function(err, req, res, next) {
	if (!res.headersSent) {
	  res.status(err.status || 500);
	  res.send({
	    message: err.message,
	    error: {}
	  });
	}
});

module.exports = app;

#!/usr/bin/env node

var restify = require('restify');
var levelup = require('levelup');
var querystring = require('querystring');
var http = require('http');
var CONFIG = require('config');


var db = levelup(CONFIG.db.path, {
  encoding: 'json',
  createIfMissing: true
});
var server = restify.createServer();


server.pre(function (req, res, next) {
  var query = querystring.parse(req.getQuery());
  req.method = query._method || req.method;
  req.method = req.method.toUpperCase();
  delete query._method;
  delete query.callback;
  if (req.method !== 'GET') {
    req.headers['content-type'] = 'application/json';
    // re-stringify the request so we can check it's length minus the _method and callback
    var _jsonp_body = querystring.stringify(query);
    if (Buffer.byteLength(_jsonp_body, 'utf8') > CONFIG.api.maxRequestSize) {
      var msg = 'Request body size exceeds ' + CONFIG.api.maxRequestSize;
      next(new restify.errors.RequestEntityTooLargeError(msg));
    }
    else {
      req._jsonp_body = query;
    }
  }
  return next();
});

server.use(restify.bodyParser({
  mapParams: false,
  maxBodySize: CONFIG.api.maxRequestSize
}));


// We have to parse the body ourselves here, because restify.bodyParser() 
// creates the reader and parser together, so there's no way to inject anything
server.use(function(req, res, next){
  if (req._jsonp_body) {
    req.body = req._jsonp_body;
  }
  next();
});


server.use(restify.queryParser());
server.use(restify.jsonp());
server.use(restify.acceptParser(server.acceptable));
server.use(restify.throttle({
  burst: CONFIG.api.throttle.burst,
  rate: CONFIG.api.throttle.rate,
  ip: true,
  overrides: {
    '127.0.0.1': {
      rate: 0,
      burst: 0
    }
  }
}));

// we can't do this yet because restify seems to be having some issues
// restify.CORS.ALLOW_HEADERS.push('x-requested-with');
// server.use(restify.CORS());


var corsHandler = function (req, res, next) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Origin, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, X-Response-Time, X-PINGOTHER, X-CSRF-Token, X-Requested-With, X-Page-Token');
  res.setHeader('Access-Control-Allow-Methods', '*');
  res.setHeader('Access-Control-Expose-Headers', 'X-Api-Version, X-Request-Id, X-Response-Time');
  res.setHeader('Access-Control-Max-Age', '1000');
  return next();
}

server.opts('/\ .*/', corsHandler, function (req, res, next) {
  res.send(200);
  return next();
});

server.post('/:key', corsHandler, function (req, res, next) {
  return db.put(req.params.key, req.body, function(err) {
    res.send(200, req.body);
    if (err) {
      return next(err);
    }
    return next();
  });
});

server.get('/:key', corsHandler, function (req, res, next) {
  return db.get(req.params.key, function (err, value) {
    if (err) {
      return next(err);
    } else {
      res.send(value);
      return next();
    }
  });
});


server.get('/', corsHandler, function (req, res, next) {
  res.end('Coffers.IO - A simple and open key/value store web service');
});

server.listen(CONFIG.server.port, function () {
  return console.log("%s listening at %s", server.name, server.url);
});
#!/usr/bin/env node

var restify = require('restify');
var levelup = require('levelup');
var CONFIG = require('config');

var db = levelup(CONFIG.db.path, {
  encoding: 'json',
  createIfMissing: true
});
var server = restify.createServer();

server.use(restify.bodyParser({
  mapParams: false,
  maxBodySize: CONFIG.api.maxRequestSize
}));
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


var corsHandler = function(req, res, next) {
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

server.post('/:key', corsHandler, function(req, res, next) {
  return db.put(req.params.key, req.body, function(err) {
    res.send(err);
    if (err) {
      return next(err);
    }
    return next();
  });
});

server.get('/:key', corsHandler, function(req, res, next) {
  return db.get(req.params.key, function(err, value) {
    if (err) {
      return next(err);
    } else {
      res.send(value);
      return next();
    }
  });
});


server.get('/', corsHandler, function(req, res, next) {
  res.end('Coffers.IO - A simple and open key/value store web service');
});

server.listen(8080, function() {
  var url;
  if (process.env.SUBDOMAIN) {
    url = 'http://' + process.env.SUBDOMAIN + '.jit.su/';
  } else {
    url = server.url;
  }
  return console.log("%s listening at %s", server.name, url);
});
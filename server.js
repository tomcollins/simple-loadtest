var http = require('http')
  , argv = require('optimist').argv
  , request = require('request');
 
var port = argv.port || 3001
  , httpProxy = argv.http_proxy || null
  , noOfRequests = 0
  , clients = [];


http.createServer(function(req, res) {
  switch (req.url) {
    case '/register':
      console.log('Register client', req.connection.remoteAddress);
      registerClient(req.connection.remoteAddress)
      res.writeHead(200);
      res.end('Ok');
      break;
    case '/status':
      console.log('Status');
      res.writeHead(200);
      res.end('Ok');
      break;
    default:
      noOfRequests++;
      res.writeHead(200);
      res.end('Ok');
      break;
  }
}).listen(port);
console.log('Server listening on', port);

function registerClient(ip) {
  clients.push(ip);
  startClient(ip);
};

function startClient(ip) {
  var url = 'http://' +ip +':3000/start';
  request({
    url: url,
    proxy: httpProxy
  }, function(error, response, body) {
    console.log(error, body);
    if (error) {
      console.log('Error starting client', url)
      return;
    } else {
      console.log('Client started', url)
    }
  });
}

setInterval(function(){
  console.log('Update:', noOfRequests);
}, 5000);

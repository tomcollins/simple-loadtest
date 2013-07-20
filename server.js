var http = require('http')
  , argv = require('optimist').argv;
 
var port = argv.port || 3000
  , noOfRequests = 0;

http.createServer(function(req, res) {
  noOfRequests++;
  res.writeHead(200);
  res.end('Ok');
}).listen(port);

setInterval(function(){
  console.log('Update:', noOfRequests);
}, 5000);

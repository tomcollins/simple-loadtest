var tls = require('tls')
  , https = require('https')
  , fs = require('fs')
  , url = require('url')
  , path = require('path')
  , os = require("os")
  , cluster = require('cluster')
  , posix = require('posix')
  , argv = require('optimist').argv
  , colors = require('colors')
  , tunnel = require('./tunnel');

var numCPUs = os.cpus().length
  , port = argv.port || 3000
  , httpProxy = argv.http_proxy || null
  , httpProxyUrl
  , cert = argv.cert || 'cert.pem'
  , key = argv.key || 'key.key'
  , ca = argv.ca || 'ca.pem'
  , caBuffer = fs.readFileSync(ca)
  , keyBuffer = fs.readFileSync(key)
  , certBuffer = fs.readFileSync(cert)
  , maxNumberOfRequestsPerSecond = Number(argv.target) || 10
  , rampUpTimeInSeconds = Number(argv.ramp) || 600
  , targetNumberOfRequestsPerSecond = 1
  , numberOfRequestsPerSecond
  , totalNumberOfRequests = 0
  , averageRate = 0
  , tlsOptions
  , interval = argv.interval || 10
  , host = argv.host || 'api.travel.test.cloud.bbc.co.uk'
  , path = argv.path || '/travel-incident-api/{id}/incidents'
  , noOfOpenRequests = 0
  , maxOpenRequests = posix.getrlimit('nofile').soft - 20
  , inputFile = argv.input || 'locations.csv'
  , inputData
  , testData = []
  , testDataLength
  , testDataIndex = 0
  , requestsSinceUpdate = 0
  , totalTime = 0
  , totalTimeInSeconds = 0
  , updateTime
  , time
  , elapsedTime
  , successCount = 0
  , errorCount = 0;

if (!httpProxy) {
  throw ('You must specify a proxy with --http_proxy');
}
httpProxyUrl = url.parse(httpProxy);

tlsOptions = {
  host: host,
  port: 443,
  path: null,
  rejectUnauthorized: false,
  agent: false
};

inputData = fs.readFileSync(inputFile).toString().split('\n');
inputData.forEach(function(line){
  values = line.split(',');
  testData.push(values[0]);
});
testDataLength = testData.length;

function doRequest(id) {
  var tunnelingAgent = tunnel.httpsOverHttp({
    maxSockets: 5,
    ca: [caBuffer],
    key: keyBuffer,
    cert: certBuffer,
    rejectUnauthorized: false,
    proxy: {
      host: httpProxyUrl.hostname,
      port: httpProxyUrl.port,
      headers: {
        'User-Agent': 'Node'
      }
    }
  });
  tlsOptions.path = path.replace('{id}', id) +'?rand=' +Math.floor(Math.random() * 999999999);;
  tlsOptions.agent = tunnelingAgent;
  noOfOpenRequests++;

  var req = https.get(tlsOptions, function(res) {
    //console.log('Status: ' + res.statusCode);
    //console.log('Headers: ' + JSON.stringify(res.headers));
    res.setEncoding('utf8');
    res.on('data', function (chunk) {
      //console.log('BODY: ' + chunk);
    });
    res.on('end', function (chunk) {
      if (200 == res.statusCode) successCount++;
      else errorCount++;
      noOfOpenRequests--;
      req = null;
      res = null;
    });
  });
  req.on('error', function(e) {
    console.log('problem with request: ' + e.message);
    errorCount++;
    noOfOpenRequests--;
    req = null;
    res = null;
  });
  req.end();
}

function nextRequest() {

  if (totalTimeInSeconds > rampUpTimeInSeconds) {
    targetNumberOfRequestsPerSecond = maxNumberOfRequestsPerSecond;
  } else { 
    targetNumberOfRequestsPerSecond = Math.floor(maxNumberOfRequestsPerSecond * (totalTimeInSeconds/rampUpTimeInSeconds));
  }

  if (requestsSinceUpdate < targetNumberOfRequestsPerSecond && noOfOpenRequests < maxOpenRequests) {
    requestsSinceUpdate++;
    doRequest(testData[testDataIndex++]);
    if (testDataIndex >= testDataLength) testDataIndex = 0;
  }
};
nextRequest();
setInterval(nextRequest, interval);


console.log('Max concurrent requests', maxOpenRequests, '(use ulimit -n $ to increase).');
console.log('Using', testDataLength, 'location ids.')

function update() {
  time = new Date().getTime();
  elapsedTime = time - updateTime;
  totalTime += elapsedTime;
  totalTimeInSeconds = Math.floor(totalTime / 1000);
  updateTime = time;
  totalNumberOfRequests += requestsSinceUpdate;
  numberOfRequestsPerSecond = requestsSinceUpdate ? Number(requestsSinceUpdate/(elapsedTime/1000)) : 0;
  averageRate = totalNumberOfRequests ? Number(totalNumberOfRequests/totalTimeInSeconds).toFixed(1) : 0;
  requestsSinceUpdate = 0;
  process.stdout.clearLine();
  process.stdout.cursorTo(0);
  process.stdout.write(
    ('Time: ' +totalTimeInSeconds +' sec').grey +', '
    + ('Rate: ' +numberOfRequestsPerSecond.toFixed(1) +'/s').cyan +', '
    + ('Average: ' +averageRate +'/s').blue +', '
    + ('S: ' +successCount ).green +', ' 
    + ('E: ' +errorCount).red +', '
    + ('Connections: ' +noOfOpenRequests +'/' +maxOpenRequests).magenta +', '
    + ('Ramp: ' +targetNumberOfRequestsPerSecond +'/s (' +maxNumberOfRequestsPerSecond +'/s over ' +rampUpTimeInSeconds +' sec)').yellow
  );
};
updateTime = new Date().getTime();
setInterval(update, 1000);
update();


var NodeTube = require('./lib/nodetube'),
    fs = require('fs'), 
    URL = require('url'),
    logger = require('./log.json'), 
    active = false;



    
/*
    Helper functions
*/

function videoRegex (url) {
    "use strict";
    
    var regExp = /^.*((youtu.be\/)|(v\/)|(\/u\/\w\/)|(embed\/)|(watch\?))\??v?=?([^#\&\?]*).*/,
        match = url.match(regExp),
        result = false;
    
    if (match && match[7].length === 11) {
        result = match[7];
    } 
    
    return result; 
}


// This function logs the download metadata
function logDownloadData(obj) {
    var data = {}, jsonString;
    
    data.id = obj.id;
    data.ip = obj.ip || 'null';
    data.time = Date.now();
    data.video = obj.video;
    data.format = obj.format;
    data.title = obj.title;
    data.quality = obj.quality;
    
    logger.push(data);
    
    jsonString = JSON.stringify(logger, null, 4);
    
    fs.writeFile('./log.json', jsonString, function (err) {
        if (err) throw err;
        console.log('Dowload has be logged!');
    });
}


// Parses a given youtube url
// @return - (String) video id
function parseUrl (urlStr) {
    "use strict";
    
    var urlObject = URL.parse(urlStr, true),
        vId = '';
                
    if (urlObject.query.v) {
        vId = urlObject.query.v;
    }
    else if (videoRegex(urlStr)) {
        vId = videoRegex(urlStr);
    }

    return vId;    
}


// Parses a video title and concatenates the video extension
// @return - (String) clean video filename
function parseFilename (title, ext) {
   "use strict";
   
    var fname = title.replace(/[\.,\/#!$%\^&\*;:{}=\-_`~()]/g, '');
                
    fname = fname.replace(/ /g, '-') + '.' + ext;

    return fname;    
}


// Server error page
function errorPage (req, res, msg, fn) {
    "use strict";
    
    res.writeHead(500, {'Content-Type': 'text/html'});
    res.end('<p><span style="color:red">' + msg + '.</span> <a href="javascript:history.go(-1);">[ Back ]</a></p>'); 
    
    if (fn) {
        fn();
    }
}



/*
    Main function
*/ 

function Routes (req, res) {
    "use strict";
    
    var url = req.body.video, 
        format = req.body.format || 'flv',
        quality = req.body.quality || '18',
        contentType = (format === 'flv') ? 'video/x-flv' : 'video/mp4',
        stream,
        filename,
        vId = parseUrl(url),
        vUrl,
        logData = {};

    
    if (!vId) {
        errorPage(req, res, 'NodeTube does not understand the URL you entered');       
    }
    
    else if (active) {
        errorPage(req, res, 'This app is currently active and only allows one download at a time. Please try again later');       
    }
    
    else {
        vUrl = 'http://www.youtube.com/watch?v=' + vId;
        
        stream = new NodeTube(vUrl, {quality: quality});
        
        stream.on('error', function () {
            errorPage(req, res, ':( An error occured while trying to fetch the video from YouTube'); 
        });
        
        stream.on('info', function (info, data) {
            filename = parseFilename(info.title, format);
            
            logData.id = vId;
            logData.title = info.title;
            logData.format = format;
            logData.quality = quality;
            logData.ip = req.headers['X-Forwarded-For'];
            
            // if file is bigger than 200mb
            if (data.size > 209715200) {
                errorPage(req, res, 'The file you are trying to download is too big.');
            }
            else {
                active = true;
                
                res.writeHead(200, {
                    'Content-disposition': 'attachment; filename=' + filename,
                    'Content-Type': contentType,
                    'Content-Length': data.size
                });
                
                stream.pipe(res, {end: false});

                
                stream.on('end', function () {
                    active = false;
                    logDownloadData(logData);
                });
            }
        });
    }
}



module.exports.download = Routes;

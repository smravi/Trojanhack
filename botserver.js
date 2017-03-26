// Node.js module imports
var express = require('express');
var bodyParser = require('body-parser');
var apiai = require('apiai');
var request = require('request');
var app = express();
var model = require('./matchquery.json');


// Setting port to default 5000 if there are no assigned ports
app.set('port', (process.env.PORT || 5000));

// authenticating into Facebook and API.AI

var apiaiApp = apiai('558b62ae515d45e9a38b516f6df3a6c8');

console.log(apiaiApp)

// pulling other functions
var misc = require('./js/misc.js');
var cards = require('./js/cards.js');
var qMessages = require('./js/quickMessages.js');

// Process application/x-www-form-urlencoded
app.use(bodyParser.urlencoded({
    extended: false
}));

// Process application/json
app.use(bodyParser.json());
app.use(function(req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
  next();
});


// Index route
app.get('/', function(req, res) {
    res.send('Hello world, I am a chat bot');
});

// for facebook verification
// app.get('/webhook/', function(req, res) {
//     if (req.query['hub.verify_token'] === process.env.facebookSecret) {
//         res.send(req.query['hub.challenge']);
//     }
//     res.send('Error, wrong token');
// });

app.get('/getDetails', function(req, res) {
    text = req.query.text;
    sender = req.query.senderId;
    apiaiCall(text, sender,res);

});
// app.post('/webhook/', function(req, res) {
//     messaging_events = req.body.entry[0].messaging;
//     for (i = 0; i < messaging_events.length; i++) {
//         event = req.body.entry[0].messaging[i];
//         sender = event.sender.id;
//         if (event.message && event.message.text) {
//             text = event.message.text;
//             if (sender != 306268366415607) { // ignores messages sent by Tommy
//                 misc.recordMessageDataAnalytics(1);
//                 misc.sendDots(sender);
//                 apiaiCall(text, sender);
//             }
//         }
//         if (event.postback) {
//             text = event.postback.payload;
//             apiaiCall(text, sender);
//         }
//     }
//     res.sendStatus(200);
// })

function apiaiCall(text, sender,res) {
    var request = apiaiApp.textRequest(text, {
        sessionId: '1234556'
    }); //sends text request to api.ai

    request.on('response', function(response) {
        var result = response.result;
        console.log(response.result);
        if(response && result) {
            speech = result.fulfillment.speech
            if(speech == '') {
              if(result.contexts[0].name === 'cpt-hour') {
                  res.json(model[result.contexts[0].name][result.parameters.semester]);
              }
              else if (result.contexts[0].name === 'cpt-duration') {
                  res.json(model[result.contexts[0].name][result.parameters.final][result.parameters.semester]);
              }
            } else {
                res.json(speech)
            }
        }

    });

    request.on('error', function(error) {
        console.log(error);
    });

    request.end();

}

function sendTextMessage(sender, text) {
    messageData = {
        text: text
    }
    request({
        url: 'https://graph.facebook.com/v2.6/me/messages',
        qs: {
            access_token: token
        },
        method: 'POST',
        json: {
            recipient: {
                id: sender
            },
            message: messageData,
        }
    }, function(error, response, body) {
        if (error) {
            console.log('Error sending messages: ', error);
        } else if (response.body.error) {
            console.log('Error: ', response.body.error);
        }
    })
}

// Spin up the server
app.listen(app.get('port'), function() {
    console.log('running on port', app.get('port'));
})

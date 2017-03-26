// Node.js module imports
var express = require('express');
var bodyParser = require('body-parser');
var apiai = require('apiai');
var request = require('request');
var app = express();
var MongoClient = require('mongodb').MongoClient,
    assert = require('assert');

// Setting port to default 5000 if there are no assigned ports
app.set('port', (process.env.PORT || 5000));
apiaitoken = ''
// authenticating into Facebook and API.AI
var token = (process.env.facebookToken || "hello");
//var apiaiApp = apiai(process.env.apiaiToken || "hello");
var apiaiApp = apiai(apiaitoken)

// connect to database
//var url = (process.env.MONGODB_URI);

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

// Index route
app.get('/', function(req, res) {
    res.send('Hello world, I am a chat bot');
});

// for facebook verification
app.get('/webhook/', function(req, res) {
    if (req.query['hub.verify_token'] === process.env.facebookSecret) {
        res.send(req.query['hub.challenge']);
    }
    res.send('Error, wrong token');
});

app.post('/webhook/', function(req, res) {
    messaging_events = req.body.entry[0].messaging;
    for (i = 0; i < messaging_events.length; i++) {
        event = req.body.entry[0].messaging[i];
        sender = event.sender.id;
        if (event.message && event.message.text) {
            text = event.message.text;
            if (sender != 306268366415607) { // ignores messages sent by Tommy
                misc.recordMessageDataAnalytics(1);
                misc.sendDots(sender);
                apiaiCall(text, sender);
            }
        }
        if (event.postback) {
            text = event.postback.payload;
            apiaiCall(text, sender);
        }
    }
    res.sendStatus(200);
})

function apiaiCall(text, sender) {
    var request = apiaiApp.textRequest(text, {
        sessionId: process.env.apiaiSessionId
    }); //sends text request to api.ai

    request.on('response', function(response) {
        {
            if (response.result.fulfillment.speech != "") {
                sendTextMessage(sender, response.result.fulfillment.speech);
            } else if (response.result.action == "getStarted") {
                misc.getStarted(sender);
            } else if (response.result.action == "getMenu") {
                var date = '';
                var clientDate = new Date();
                utc = clientDate.getTime() + (clientDate.getTimezoneOffset() * 60000);
                var d = new Date(utc + (3600000 * -8)); // this way we can get PST time
                date = misc.formatDate(d);
                if (response.result.parameters['date-period'] == 'tomorrow') {
                    date = misc.formatDate(d.setDate(d.getDate() + 1));
                }
                if (response.result.parameters.dininghall != '') {
                    if (response.result.parameters.mealtype == '') {
                        // sends back FB card for user to select meal time
                        cards.sendMenuChoiceCard(sender, response.result.resolvedQuery);
                    } else if (response.result.parameters.mealtype == 'breakfast') {
                        MongoClient.connect(url, function(err, db) {
                            assert.equal(null, err);
                            console.log("Connected correctly to server");
                            var dininghalls = db.collection('dininghalls'); //finding building
                            dininghalls.find({
                                'name': response.result.parameters.dininghall,
                                'mealtype': "Breakfast",
                                'date': date
                            }).toArray(function(err, returnedMenu) {
                                cards.sendMenuCard(sender, returnedMenu, 'none', response.result.parameters.dininghall);
                            });
                            db.close();
                        });
                    } else if (response.result.parameters.mealtype == 'brunch') {
                        MongoClient.connect(url, function(err, db) {
                            assert.equal(null, err);
                            console.log("Connected correctly to server");
                            var dininghalls = db.collection('dininghalls'); //finding building
                            dininghalls.find({
                                'name': response.result.parameters.dininghall,
                                'mealtype': "Brunch",
                                'date': date
                            }).toArray(function(err, returnedMenu) {
                                cards.sendMenuCard(sender, returnedMenu, 'none', response.result.parameters.dininghall);
                            });
                            db.close();
                        });
                    } else if (response.result.parameters.mealtype == 'lunch') {
                        MongoClient.connect(url, function(err, db) {
                            assert.equal(null, err);
                            console.log("Connected correctly to server");
                            var dininghalls = db.collection('dininghalls'); //finding building
                            dininghalls.find({
                                'name': response.result.parameters.dininghall,
                                'mealtype': "Lunch",
                                'date': date
                            }).toArray(function(err, returnedMenu) {
                                cards.sendMenuCard(sender, returnedMenu, 'none', response.result.parameters.dininghall);
                            });
                            db.close();
                        });
                    } else if (response.result.parameters.mealtype == 'dinner') {
                        MongoClient.connect(url, function(err, db) {
                            assert.equal(null, err);
                            console.log("Connected correctly to server");
                            console.log(response.result.parameters.dininghall + ' and ' + date);
                            var dininghalls = db.collection('dininghalls'); //finding building
                            dininghalls.find({
                                'name': response.result.parameters.dininghall,
                                'mealtype': "Dinner",
                                'date': date
                            }).toArray(function(err, returnedMenu) {
                                cards.sendMenuCard(sender, returnedMenu, 'none', response.result.parameters.dininghall);
                            });
                            db.close();
                        });
                    }
                } else {
                    qMessages.sendDiningQuickRepliesMessage(sender, 'Pick from the options below for which dining hall menu you want!');
                }
            } else if (response.result.action == "getLocation") {
                if (response.result.parameters.building != '') {
                    MongoClient.connect(url, function(err, db) {
                        assert.equal(null, err);
                        console.log("Connected correctly to server");
                        var buildings = db.collection('buildings'); //finding building
                        buildings.find({
                            'id': response.result.parameters.building
                        }).toArray(function(err, returnedBuilding) {
                            var hyperlinkBuildingAddress = returnedBuilding[0].address.replace(/ /g, "%20"); //reformats text for hyperlink
                            cards.sendBuildingCard(sender, returnedBuilding[0], hyperlinkBuildingAddress);
                            sendTextMessage(sender, "Mobile users - open the navigation in browser for more optimal performance.");
                        });
                        db.close();
                    });
                } else {
                    sendTextMessage(sender, "Sorry, I couldn't understand that - can you be more specific or try your building's 3-letter code? For a full list of buildings at USC visit - http://fmsmaps4.usc.edu/usc/php/bl_list_no.php");
                }
            } else if (response.result.action == "getAcademicEvent") {
                MongoClient.connect(url, function(err, db) {
                    assert.equal(null, err);
                    console.log("Connected correctly to server");
                    var calender = db.collection('academicCalender'); //find dates
                    calender.find({
                        'id': response.result.parameters.eventtype
                    }).toArray(function(err, returnedEvent) {
                        if (returnedEvent.length != 0) {
                            sendTextMessage(sender, returnedEvent[0].value + "!");
                        } else {
                            sendTextMessage(sender, "I could not find that event! You can try rephrasing your question, or visit this site for a schedule of classes - http://classes.usc.edu/term-20171/calendar/ - and this site for an overall academic schedule - http://academics.usc.edu/calendar/")
                        }
                    });
                    db.close();
                });
            } else if (response.result.action == "getHours") {
                MongoClient.connect(url, function(err, db) {
                    assert.equal(null, err);
                    console.log("Connected correctly to server");
                    var hours = db.collection('buildingHours'); // find stored building hours
                    hours.find({
                        'Building': response.result.parameters.buildingHours
                    }).toArray(function(err, returnedEvent) {

                        var clientDate = new Date();
                        utc = clientDate.getTime() + (clientDate.getTimezoneOffset() * 60000);
                        var d = new Date(utc + (3600000 * -8)); // this way we can get PST time
                        var n = d.getDay();

                        if (response.result.parameters['date-period'] != '') {
                            var temp = response.result.parameters['date-period'].toLowerCase();
                            if (temp == 'tomorrow') {
                                n = n + 1;
                            } else if (temp == 'sunday') {
                                n = 0;
                            } else if (temp == 'monday') {
                                n = 1;
                            } else if (temp == 'tuesday') {
                                n = 2;
                            } else if (temp == 'wednesday') {
                                n = 3;
                            } else if (temp == 'thursday') {
                                n = 4;
                            } else if (temp == 'friday') {
                                n = 5;
                            } else if (temp == 'saturday') {
                                n = 6;
                            }
                        }

                        if (returnedEvent.length != 0) {

                            if (n == 0) {
                                sendTextMessage(sender, response.result.parameters.buildingHours + "'s hours Sunday are " + returnedEvent[0].Sunday + "!");
                            } else if (n == 1) {
                                sendTextMessage(sender, response.result.parameters.buildingHours + "'s hours Monday are " + returnedEvent[0].Monday + "!");
                            } else if (n == 2) {
                                sendTextMessage(sender, response.result.parameters.buildingHours + "'s hours Tuesday are " + returnedEvent[0].Tuesday + "!");
                            } else if (n == 3) {
                                sendTextMessage(sender, response.result.parameters.buildingHours + "'s hours Wednesday are " + returnedEvent[0].Wednesday + "!");
                            } else if (n == 4) {
                                sendTextMessage(sender, response.result.parameters.buildingHours + "'s hours Thursday are " + returnedEvent[0].Thursday + "!");
                            } else if (n == 5) {
                                sendTextMessage(sender, response.result.parameters.buildingHours + "'s hours Friday are " + returnedEvent[0].Friday + "!");
                            } else if (n == 6) {
                                sendTextMessage(sender, response.result.parameters.buildingHours + "'s hours Saturday are " + returnedEvent[0].Saturday + "!");
                            }
                        } else {
                            sendTextMessage(sender, "Hmm, I don't have the hours of that building, could you try rewriting the building please?");
                        }
                    });
                    db.close();
                });
            } else if (response.result.action == "getGeneral") {
                if (response.result.parameters.generalCategories == 'directions') {
                    qMessages.sendLocationQuickRepliesMessage(sender, 'What building can I direct you to? Choose one of the more popular buildings below or ask by yourself with "Where is ___?" I understand 3 letter codes best.');
                } else if (response.result.parameters.generalCategories == 'hours') {
                    qMessages.sendHoursQuickRepliesMessage(sender, 'What building can I get you hours for? Choose one of the more popular options below or ask by yourself with "hours for _____?"');
                } else if (response.result.parameters.generalCategories == 'dining') {
                    qMessages.sendDiningQuickRepliesMessage(sender, 'Pick from the options below for which dining hall menu you want!');
                } else if (response.result.parameters.generalCategories == 'events') {
                    qMessages.sendEventQuickRepliesMessage(sender, 'Pick from the options below for what type of event you want!');
                }
            } else if (response.result.action == "getEvent") {
                {
                    if (response.result.parameters['date-period'] != "" && response.result.parameters.calendartype != "") {
                        console.log('checkpoint 3');
                        var date = '';
                        var dates = [];
                        var clientDate = new Date();
                        utc = clientDate.getTime() + (clientDate.getTimezoneOffset() * 60000);
                        var d = new Date(utc + (3600000 * -8)); // this way we can get PST time
                        date = misc.formatDateYY(d);
                        if (response.result.parameters['date-period'] == 'today') {
                            dates.push(date);
                        } else if (response.result.parameters['date-period'] == 'tomorrow') {
                            console.log('tomorrow checkpoint');
                            date = misc.formatDateYY(d.setDate(d.getDate() + 1));
                            dates.push(date);
                        } else if (response.result.parameters['date-period'] != 'today') {
                            dates.push(date);
                            for (var i = 0; i < 6; i++) {
                                dates.push(misc.formatDateYY(d.setDate(d.getDate() + 1)));
                            }
                        }
                        if (response.result.parameters.calendartype == 'VandV') {
                            MongoClient.connect(url, function(err, db) {
                                assert.equal(null, err);
                                console.log("Connected correctly to server");
                                var calender = db.collection('visionsAndVoices'); //find dates for Visions and Voices
                                calender.find({
                                    'date': {
                                        $in: dates
                                    }
                                }).limit(10).toArray(function(err, returnedEvents) {
                                    cards.sendEventsCard(sender, returnedEvents);
                                });
                                db.close();
                            });
                        } else if (response.result.parameters.calendartype == 'Viterbi') {
                            MongoClient.connect(url, function(err, db) {
                                assert.equal(null, err);
                                console.log("Connected correctly to server");
                                var calender = db.collection('viterbiCalendar'); //find dates for Visions and Voices
                                calender.find({
                                    'date': {
                                        $in: dates
                                    }
                                }).limit(10).toArray(function(err, returnedEvents) {
                                    cards.sendEventsCard(sender, returnedEvents);
                                });
                                db.close();
                            });
                        } else if (response.result.parameters.calendartype == 'Miscellaneous') {
                            MongoClient.connect(url, function(err, db) {
                                assert.equal(null, err);
                                console.log("Connected correctly to server");
                                var calender = db.collection('eventsCalendar'); //find dates for Visions and Voices
                                calender.find({
                                    'date': {
                                        $in: dates
                                    }
                                }).limit(10).toArray(function(err, returnedEvents) {
                                    cards.sendEventsCard(sender, returnedEvents);
                                });
                                db.close();
                            });
                        } else if (response.result.parameters.calendartype == 'Sports') {
                            sendTextMessage(sender, "Sorry, the sport's calendar is not available yet :(");
                            //sendEventsChoiceCard(sender, 'Sports');
                        } else if (response.result.parameters.calendartype == 'Dornsife') {
                            MongoClient.connect(url, function(err, db) {
                                assert.equal(null, err);
                                console.log("Connected correctly to server");
                                var calender = db.collection('dornsifeCalendar'); //find dates for Visions and Voices
                                calender.find({
                                    'date': {
                                        $in: dates
                                    }
                                }).limit(10).toArray(function(err, returnedEvents) {
                                    cards.sendEventsCard(sender, returnedEvents);
                                });
                                db.close();
                            });
                        }
                    } else if (response.result.parameters.calendartype != "") {
                        if (response.result.parameters.calendartype == 'VandV') {
                            cards.sendEventsChoiceCard(sender, 'Visions and Voices');
                        } else if (response.result.parameters.calendartype == 'Viterbi') {
                            cards.sendEventsChoiceCard(sender, 'Viterbi');
                        } else if (response.result.parameters.calendartype == 'Miscellaneous') {
                            cards.sendEventsChoiceCard(sender, 'Miscellaneous');
                        } else if (response.result.parameters.calendartype == 'Sports') {
                            sendTextMessage(sender, "Sorry, the sport's calendar is not available yet :(");
                        } else if (response.result.parameters.calendartype == 'Dornsife') {
                            cards.sendEventsChoiceCard(sender, 'Dornsife');
                        }
                    } else {
                        qMessages.sendEventQuickRepliesMessage(sender, 'You want events? Pick from the options below for what type of event you want!');
                    }
                }
            } else if (response.result.action == "getDailyTrojan") {

                MongoClient.connect(url, function(err, db) {
                    assert.equal(null, err);
                    console.log("Connected correctly to server");

                    var dailyTrojanHeadlines;

                    if (response.result.parameters.dailyTrojan == 'lifestyle' || response.result.parameters.dailyTrojan == 'opinion') {
                        dailyTrojanHeadlines = db.collection('DailyTrojanLO'); // find stored building hours
                        dailyTrojanHeadlines.find({
                            'category': response.result.parameters.dailyTrojan
                        }).limit(10).toArray(function(err, returnedEvent) {
                            cards.sendHeadlinesCard(sender, returnedEvent);
                        });
                        db.close();
                    } else if (response.result.parameters.dailyTrojan == 'news' || response.result.parameters.dailyTrojan == 'sports') {
                        dailyTrojanHeadlines = db.collection('DailyTrojanNS');
                        dailyTrojanHeadlines.find({
                            'category': response.result.parameters.dailyTrojan
                        }).limit(10).toArray(function(err, returnedEvent) {
                            cards.sendHeadlinesCard(sender, returnedEvent);
                        });
                        db.close();
                    } else {

                        qMessages.sendDTQuickRepliesMessage(sender, 'Pick the type of headline you want!');
                    }
                });
            } else {
                sendTextMessage(sender, "Sorry, I couldn't understand that. Can you try rephrasing the question? Keep in mind I am in open beta.");

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
            access_token: 'EAAIaHfhtRbUBAPOvf6BWDzwfSKiALeCZASRZBuiRkISnv8Mzl0cwu4AxCwae6k4ZB3iMdVe3rxvrBXo5fm6MHYXoiS13ZCnUfxWBfrOZBMkpgbxBwrgD0CJc7fjkZBGI49BNsPlfF5qjAIysp80ZC3d0In4RFPRjQ0io3PBz9ZAxy6AOSNXnZAXk4'
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
